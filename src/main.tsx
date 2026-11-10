import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { OIDC_ENABLED, bootstrap } from './services/oidc'

const ACTIVE_USER_KEY = 'lens_active_user'
const ACTIVE_SCREEN_KEY = 'lens_active_screen'

/**
 * With OIDC, the session is the Keycloak token, never a localStorage record.
 * Before the app mounts we complete any pending sign-in and then either
 * (a) rewrite the stored profile from the verified token claims, so a forged
 *     role/org in localStorage is always overwritten, or
 * (b) clear it, so the app starts on the sign-in screen.
 */
async function prepareSession() {
  if (!OIDC_ENABLED) return
  const profile = await bootstrap()
  try {
    if (!profile) {
      localStorage.removeItem(ACTIVE_USER_KEY)
      localStorage.removeItem(ACTIVE_SCREEN_KEY)
      return
    }
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify({
      id: profile.sub,
      email: profile.email,
      name: profile.name || profile.email,
      role: profile.isAdmin ? 'admin' : 'user',
      orgId: profile.orgId,
      company: '',
      isNewUser: false,
    }))
    const screen = localStorage.getItem(ACTIVE_SCREEN_KEY)
    if (!screen || screen === 'login') localStorage.setItem(ACTIVE_SCREEN_KEY, 'dashboard')
  } catch {
    /* storage unavailable: app falls back to the sign-in screen */
  }
}

prepareSession().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
