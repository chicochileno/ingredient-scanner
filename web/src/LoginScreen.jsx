import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// Chrome on iOS opens popups as a new tab and loses the opener reference,
// so postMessage back to the original tab never arrives. Use redirect instead.
const isChromeIOS = /CriOS/.test(navigator.userAgent);
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


export default function LoginScreen({ onSignedIn }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  async function handleGoogle() {
    setLoading('google');
    setError(null);
    try {
      if (isChromeIOS) {
        // Server-side OAuth — bypasses Chrome iOS cross-origin storage restrictions
        window.location.href = `${import.meta.env.VITE_API_URL || ''}/auth/google`;
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        onSignedIn(result.user);
      }
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(`Sign in failed: ${e.message}`);
      }
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

        </div>

        {error && <p className="login-error">{error}</p>}

        <p className="login-privacy">
          Your scan history is private and only visible to you.
        </p>
      </div>
    </div>
  );
}
