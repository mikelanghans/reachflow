import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ResetPassword from './ResetPassword.jsx'
import OnboardingConnected from './OnboardingConnected.jsx'
import OnboardingConnectFailed from './OnboardingConnectFailed.jsx'

// No router library in this app — a simple path lookup is enough since
// only a handful of routes need to bypass the normal app shell.
const routes = {
  '/reset-password':            ResetPassword,
  '/onboarding/connected':      OnboardingConnected,
  '/onboarding/connect-failed': OnboardingConnectFailed,
}
const RouteComponent = routes[window.location.pathname]

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {RouteComponent ? <RouteComponent /> : <App />}
  </React.StrictMode>
)
