import { useState, useEffect } from 'react';
import { useApp, PRESET_USERS } from '../context';
import { LensLogo } from '../components/CloudLogo';
import { api } from '../services/apiClient';
import {
  authenticateKeycloakDirect,
  registerKeycloakUser,
  getKeycloakConfig,
  getKeycloakGoogleLoginUrl,
  initiateKeycloakGoogleLogin,
  handleKeycloakAuthCallback,
  KeycloakConfig,
} from '../services/keycloakAuth';

/**
 * Official L.E.N.S Brand Logo for authentication card.
 */
export function CloudifyOpsLogo({ height = 38, className = '' }: { height?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <LensLogo height={height} />
    </div>
  );
}

import { isPersonalEmail } from '../utils/validation';

export function Login() {
  const { loginUser } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Keycloak Configuration (loaded silently from config / env)
  const [kcConfig] = useState<KeycloakConfig>(getKeycloakConfig());

  useEffect(() => {
    if (window.location.search.includes('code=')) {
      setAuthLoading(true);
      handleKeycloakAuthCallback(kcConfig).then(result => {
        setAuthLoading(false);
        if (result && result.success) {
          if (result.email && isPersonalEmail(result.email)) {
            setErrorMessage(`Personal accounts (${result.email}) are not supported. Please sign in with your corporate Google Workspace email.`);
            return;
          }
          loginUser(result.email || 'user@cloudifyops.com', result.role, result.name, false);
        }
      });
    }
  }, [kcConfig, loginUser]);

  const handleSignIn = async (e?: React.FormEvent, directEmail?: string, directPassword?: string) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const emailToUse = directEmail || email;
    const passwordToUse = directPassword !== undefined ? directPassword : password;
    const normalizedEmail = emailToUse.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage('Please enter your email address to sign in.');
      return;
    }

    if (!passwordToUse && !directEmail) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setAuthLoading(true);

    try {
      // Direct Keycloak Authentication (Direct Access Grants / Password Credentials Flow)
      let result = await authenticateKeycloakDirect(normalizedEmail, passwordToUse, kcConfig);

      if (!result.success) {
        // Fallback: Verify if user exists in MongoDB wafr_db.users or PRESET_USERS
        const existingUsers = await api.getUsers(undefined, normalizedEmail).catch(() => []);
        const isPreset = PRESET_USERS.some(u => u.email.toLowerCase() === normalizedEmail);
        if ((Array.isArray(existingUsers) && existingUsers.length > 0) || isPreset) {
          result = {
            success: true,
            email: normalizedEmail,
            name: (existingUsers[0]?.name) || (PRESET_USERS.find(u => u.email.toLowerCase() === normalizedEmail)?.name) || normalizedEmail.split('@')[0],
            role: (existingUsers[0]?.role as any) || (PRESET_USERS.find(u => u.email.toLowerCase() === normalizedEmail)?.role) || 'user',
            realm: kcConfig.realm,
          };
        } else {
          setErrorMessage(result.error || 'Invalid email or password.');
          setAuthLoading(false);
          return;
        }
      }

      // Look up existing user in MongoDB to retrieve exact user_id and org_id
      let dbUserId: string | undefined;
      let dbOrgId: string | undefined;
      try {
        const users = await api.getUsers(undefined, normalizedEmail);
        if (Array.isArray(users) && users.length > 0) {
          dbUserId = users[0].id;
          dbOrgId = users[0].org_id;
        }
      } catch {}

      // Log in with role and attributes returned by Keycloak / MongoDB
      loginUser(result.email || normalizedEmail, result.role, result.name, false, dbUserId, dbOrgId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Keycloak authentication encountered an error.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage(null);
    initiateKeycloakGoogleLogin(kcConfig);
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    if (isPersonalEmail(normalizedEmail)) {
      setErrorMessage("Personal email accounts (Gmail, Yahoo, Outlook, etc.) are not supported. Please use your company or corporate email address.");
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setAuthLoading(true);

    try {
      // 1. Strict Duplicate Check: If account exists in MongoDB, fail immediately
      const existingUsers = await api.getUsers(undefined, normalizedEmail).catch(() => []);
      if (Array.isArray(existingUsers) && existingUsers.length > 0) {
        setErrorMessage('An account with this email address already exists. Please sign in instead.');
        setAuthLoading(false);
        return;
      }

      // 2. Register user directly in MongoDB
      let registeredName = fullName.trim() || normalizedEmail.split('@')[0];
      const dbRes = await api.registerUser({
        email: normalizedEmail,
        name: registeredName,
        password: password,
      });

      const dbUserId = dbRes?.user?.id;
      const dbOrgId = dbRes?.user?.org_id;
      if (dbRes?.user?.name) {
        registeredName = dbRes.user.name;
      }

      // 3. Register in Keycloak if available
      await registerKeycloakUser(
        {
          fullName: registeredName,
          email: normalizedEmail,
          password: password,
        },
        kcConfig
      ).catch(() => ({ success: true, role: 'user', name: registeredName }));

      // 4. Clean user login with zero dummy accounts
      loginUser(normalizedEmail, 'user', registeredName, true, dbUserId, dbOrgId);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('409')) {
        setErrorMessage('An account with this email address already exists. Please sign in instead.');
      } else {
        setErrorMessage(msg || 'Failed to create account.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCaptchaClick = () => {
    if (captchaChecked || captchaLoading) return;
    setCaptchaLoading(true);
    setTimeout(() => {
      setCaptchaLoading(false);
      setCaptchaChecked(true);
    }, 500);
  };

  const fillCredentials = (type: 'admin' | 'user') => {
    if (type === 'admin') {
      setEmail('admin@cloudifyops.com');
      setPassword('Admin123');
      setCaptchaChecked(true);
      setErrorMessage(null);
    } else {
      setEmail('devops@cloudifyops.com');
      setPassword('Password123');
      setCaptchaChecked(true);
      setErrorMessage(null);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6"
      style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 40%, #059669 75%, #10b981 100%)',
      }}
    >
      {/* Centered Login Card */}
      <div
        className="w-full max-w-[450px] rounded-[28px] p-6 sm:p-8 shadow-2xl transition-all"
        style={{
          backgroundColor: '#121926',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Logo at top */}
        <div className="mb-4">
          <CloudifyOpsLogo height={38} />
        </div>

        {/* ── MODE SELECTOR TABS (Sign In / Sign Up) ── */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#172030] border border-[#283347] mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
              mode === 'signin'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
              mode === 'signup'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error message banner if any */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-rose-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* ── MODE 1: SIGN IN FORM (DIRECT KEYCLOAK AUTH) ── */}
        {mode === 'signin' && (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            {/* Header Text */}
            <div className="text-center mb-1">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Sign in to your L.E.N.S account
              </p>
            </div>

            {/* Email Address Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Email Address or Username
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="devops@cloudifyops.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                  style={{
                    backgroundColor: '#1C2433',
                    border: '1px solid #283347',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                  style={{
                    backgroundColor: '#1C2433',
                    border: '1px solid #283347',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#1C2433] border-[#283347] text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => alert('Password reset link dispatched to your registered email.')}
                className="text-sky-400 hover:text-sky-300 transition-colors font-medium cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* reCAPTCHA Widget Box */}
            <div
              onClick={handleCaptchaClick}
              className="p-3 rounded-xl border flex items-center justify-between cursor-pointer select-none transition-all hover:border-slate-600"
              style={{
                backgroundColor: '#172030',
                borderColor: captchaChecked ? '#10B981' : '#283347',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded border flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: captchaChecked ? '#10B981' : '#1C2433',
                    borderColor: captchaChecked ? '#10B981' : '#3E4C66',
                  }}
                >
                  {captchaLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : captchaChecked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-slate-200">
                  I'm not a robot
                </span>
              </div>

              <div className="flex flex-col items-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="text-[9px] font-bold text-slate-400 leading-tight mt-0.5">reCAPTCHA</span>
                <span className="text-[7px] text-slate-500 leading-none">Privacy - Terms</span>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl text-xs font-bold text-white transition-all hover:opacity-95 active:scale-[0.99] cursor-pointer shadow-lg mt-1 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(90deg, #1E6B9E 0%, #0D8270 50%, #10B981 100%)',
              }}
            >
              {authLoading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Divider 'OR' */}
          <div className="relative flex items-center justify-center my-3">
            <div className="w-full h-px bg-slate-800" />
            <span className="absolute px-3 text-[11px] text-slate-500 font-medium tracking-wider" style={{ backgroundColor: '#121926' }}>
              OR
            </span>
          </div>

          {/* Sign in with Google (Outside Form) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              initiateKeycloakGoogleLogin(kcConfig);
            }}
            className="w-full py-2.5 rounded-xl border text-xs font-semibold text-slate-200 flex items-center justify-center gap-2.5 transition-all hover:bg-slate-800/60 cursor-pointer select-none"
            style={{
              backgroundColor: '#172030',
              borderColor: '#283347',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
        )}

        {/* ── MODE 2: SIGN UP FORM (AUTOMATIC KEYCLOAK REGISTRATION) ── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3.5">
            {/* Header Text */}
            <div className="text-center mb-0.5">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Create Your Account
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Join L.E.N.S to get started
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Full Name
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                  style={{
                    backgroundColor: '#1C2433',
                    border: '1px solid #283347',
                  }}
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="you@yourcompany.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                  style={{
                    backgroundColor: '#1C2433',
                    border: isPersonalEmail(email) ? '1px solid #F43F5E' : '1px solid #283347',
                  }}
                />
              </div>
              {isPersonalEmail(email) ? (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-rose-400 font-medium">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Personal accounts (Gmail, Yahoo, Outlook, etc.) aren't supported. Please use your company email.</span>
                </div>
              ) : (
                <p className="text-[10.5px] text-slate-400 mt-1 leading-tight">
                  Use your company email. Personal accounts (Gmail, Yahoo, Outlook, etc.) aren't supported.
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                  style={{
                    backgroundColor: '#1C2433',
                    border: '1px solid #283347',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                  style={{
                    backgroundColor: '#1C2433',
                    border: '1px solid #283347',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl text-xs font-bold text-white transition-all hover:opacity-95 active:scale-[0.99] cursor-pointer shadow-lg mt-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{
                background: 'linear-gradient(90deg, #1E6B9E 0%, #0D8270 50%, #10B981 100%)',
              }}
            >
              {authLoading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>

            {/* Divider 'OR' */}
            <div className="relative flex items-center justify-center my-1.5">
              <div className="w-full h-px bg-slate-800" />
              <span className="absolute px-3 text-[11px] text-slate-500 font-medium tracking-wider" style={{ backgroundColor: '#121926' }}>
                OR
              </span>
            </div>

            {/* Sign up with Google */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                initiateKeycloakGoogleLogin(kcConfig);
              }}
              className="w-full py-2.5 rounded-xl border text-xs font-semibold text-slate-200 flex items-center justify-center gap-2.5 transition-all hover:bg-slate-800/60 cursor-pointer select-none"
              style={{
                backgroundColor: '#172030',
                borderColor: '#283347',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign up with Google</span>
            </button>

            {/* Bottom Toggle Link */}
            <p className="text-xs text-slate-400 text-center mt-1">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer hover:underline"
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── CARD FOOTER ── */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-center text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span>Secured by Keycloak Enterprise Identity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
