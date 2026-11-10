import { useState } from 'react';
import { LensLogo } from '../components/CloudLogo';
import { login, oidcConfigOk } from '../services/oidc';

/**
 * Sign-in screen for OIDC builds. Credentials are entered on Keycloak's own
 * login page (password policy, lockout, reset and MFA are configured there),
 * never in this app.
 */
export function OidcSignIn() {
  const [redirecting, setRedirecting] = useState(false);

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 40%, #059669 75%, #10b981 100%)' }}
    >
      <div className="w-full max-w-sm rounded-3xl p-8 flex flex-col items-center gap-5 bg-[#0f172a] text-white shadow-2xl">
        <LensLogo height={38} />
        <div className="text-center">
          <h1 className="text-xl font-semibold">Sign in to L.E.N.S</h1>
          <p className="text-sm mt-1 text-slate-400">Use your organization account.</p>
        </div>
        {oidcConfigOk ? (
          <button
            type="button"
            disabled={redirecting}
            onClick={() => { setRedirecting(true); login(); }}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-600 to-emerald-500 hover:opacity-95 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            {redirecting ? 'Redirecting…' : 'Sign in'}
          </button>
        ) : (
          <p role="alert" className="text-sm text-rose-300 text-center">
            Sign-in is not configured for this build (VITE_KEYCLOAK_URL / REALM / CLIENT_ID).
          </p>
        )}
        <p className="text-xs text-slate-500 text-center">
          Need access? Ask your organization administrator to invite you.
        </p>
      </div>
    </main>
  );
}
