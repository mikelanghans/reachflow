import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ResetPassword from './ResetPassword.jsx'

// No router library in this app — a single path check is enough since
// /reset-password is the only route that needs to bypass the normal app.
const isResetPasswordPage = window.location.pathname === '/reset-password'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isResetPasswordPage ? <ResetPassword /> : <App />}
  </React.StrictMode>
)
