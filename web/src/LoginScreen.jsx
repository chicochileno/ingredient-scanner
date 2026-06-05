import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, appleProvider } from './firebase';
import './LoginScreen.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor">
      <path d="M13.197 9.425c-.02-2.065 1.686-3.063 1.762-3.11-0.96-1.402-2.452-1.594-2.983-1.614-1.27-.128-2.484.748-3.127.748-.643 0-1.634-.731-2.688-.711-1.385.02-2.665.806-3.378 2.045C1.07 9.13 2.1 13.463 3.77 15.82c.833 1.2 1.825 2.545 3.123 2.496 1.257-.05 1.728-.806 3.245-.806 1.517 0 1.944.806 3.267.78 1.348-.022 2.2-1.222 3.024-2.429.955-1.393 1.348-2.743 1.367-2.812-.03-.013-2.617-1.003-2.599-3.624zM11.08 3.13C11.77 2.297 12.237 1.15 12.11 0c-.984.04-2.175.655-2.879 1.487C8.56 2.313 8.01 3.483 8.156 4.596c1.095.084 2.218-.556 2.924-1.465z"/>
    </svg>
  );
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  async function handleGoogle() {
    setLoading('google');
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleApple() {
    setLoading('apple');
    setError(null);
    try {
      await signInWithPopup(auth, appleProvider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('Sign in failed. Please try again.');
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="login-root">
      <div className="login-inner">
        <div className="login-brand">
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="#4A7C59"/>
              <path d="M8 11h2v10H8zM11 8h2v16h-2zM14 10h2v12h-2zM17 9h2v14h-2zM20 11h2v10h-2zM23 13h1v6h-1z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <h1 className="login-title">Ingredient<br />Scanner</h1>
          <p className="login-sub">Know what's in your child's food.</p>
        </div>

        <div className="login-buttons">
          <button
            className="login-btn login-btn-google"
            onClick={handleGoogle}
            disabled={!!loading}
          >
            {loading === 'google' ? <span className="login-spinner login-spinner-dark" /> : <GoogleIcon />}
            <span>Continue with Google</span>
          </button>

          <button
            className="login-btn login-btn-apple"
            onClick={handleApple}
            disabled={!!loading}
          >
            {loading === 'apple' ? <span className="login-spinner login-spinner-white" /> : <AppleIcon />}
            <span>Continue with Apple</span>
          </button>
        </div>

        {error && <p className="login-error">{error}</p>}

        <p className="login-privacy">
          Your scan history is private and only visible to you.
        </p>
      </div>
    </div>
  );
}
