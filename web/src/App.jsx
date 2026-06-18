import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { onAuthStateChanged, getRedirectResult, signInWithCustomToken } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import LoginScreen from './LoginScreen';
import HomeScreen from './HomeScreen';
import ScanScreen from './ScanScreen';
import ResultsScreen from './ResultsScreen';
import HistoryScreen from './HistoryScreen';
import { useAllergens, AllergenContext } from './useAllergens';
import AllergensScreen from './AllergensScreen';

function RequireAuth({ user, authReady, children }) {
  if (!authReady) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function HomeRoute({ user, onScan, onHistory, onAllergens }) {
  return <HomeScreen user={user} onScan={onScan} onHistory={onHistory} onAllergens={onAllergens} />;
}

function ResultsRoute() {
  const navigate = useNavigate();
  const { state } = useLocation();
  if (!state?.result) return <Navigate to="/home" replace />;
  return (
    <ResultsScreen
      result={state.result}
      source={state.source}
      imageUrl={state.imageUrl}
      onScanAgain={() => navigate('/scan')}
      onBack={() => navigate('/home')}
    />
  );
}

function HistoryScanRoute({ user }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { scanId } = useParams();
  const [scan, setScan] = useState(state?.scan || null);
  const [loading, setLoading] = useState(!state?.scan);

  useEffect(() => {
    if (state?.scan) return;
    getDoc(doc(db, 'users', user.uid, 'scans', scanId))
      .then(d => {
        if (d.exists()) setScan({ id: d.id, ...d.data() });
        else navigate('/history', { replace: true });
      })
      .catch(() => navigate('/history', { replace: true }))
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading) return null;
  if (!scan) return null;

  return (
    <ResultsScreen
      result={scan}
      source={scan.mode}
      imageUrl={scan.imageUrl}
      onBack={() => navigate('/history')}
      onScanAgain={() => navigate('/scan')}
    />
  );
}

function AppRoutes({ user, authReady, setUser, setAuthReady }) {
  const navigate = useNavigate();
  const allergenAPI = useAllergens(user);

  async function handleResult(data, src, imageBase64) {
    let imageUrl = null;

    if (user) {
      try {
        const scanRef = doc(collection(db, 'users', user.uid, 'scans'));
        if (imageBase64) {
          const storageRef = ref(storage, `scans/${user.uid}/${scanRef.id}.jpg`);
          await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/jpeg' });
          imageUrl = await getDownloadURL(storageRef);
        }
        await setDoc(scanRef, {
          createdAt: serverTimestamp(),
          mode: src,
          productName: data.productName || null,
          rawText: data.rawText || '',
          flagged: data.flagged || [],
          ingredientCount: data.ingredientCount || 0,
          imageUrl,
        });
      } catch (e) {
        console.error('Failed to save scan', e);
      }
    }

    navigate('/results', { state: { result: data, source: src, imageUrl } });
  }

  if (!authReady) {
    return (
      <AllergenContext.Provider value={allergenAPI}>
        <div style={{
          position: 'fixed', inset: 0,
          background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '2px solid var(--border)', borderTopColor: 'var(--sage)',
            display: 'block', animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      </AllergenContext.Provider>
    );
  }

  return (
    <AllergenContext.Provider value={allergenAPI}>
      <Routes>
        <Route
          path="/"
          element={
            user
              ? <Navigate to="/home" replace />
              : <LoginScreen onSignedIn={(u) => { setUser(u); setAuthReady(true); }} />
          }
        />
        <Route
          path="/home"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <HomeRoute
                user={user}
                onScan={() => navigate('/scan')}
                onHistory={() => navigate('/history')}
                onAllergens={() => navigate('/allergens')}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/scan"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <ScanScreen
                onResult={handleResult}
                onBack={() => navigate('/home')}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/results"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <ResultsRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <HistoryScreen
                user={user}
                onBack={() => navigate('/home')}
                onSelect={(scan) => navigate(`/history/${scan.id}`, { state: { scan } })}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/history/:scanId"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <HistoryScanRoute user={user} />
            </RequireAuth>
          }
        />
        <Route
          path="/allergens"
          element={
            <RequireAuth user={user} authReady={authReady}>
              <AllergensScreen onBack={() => navigate('/home')} />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to={user ? '/home' : '/'} replace />} />
      </Routes>
    </AllergenContext.Provider>
  );
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const firebaseToken = params.get('firebaseToken');

    if (firebaseToken) {
      window.history.replaceState({}, '', window.location.pathname);
      signInWithCustomToken(auth, firebaseToken).catch((e) => {
        console.error('Custom token sign-in failed:', e);
      });
    } else {
      getRedirectResult(auth).catch((e) => console.error('Redirect result error:', e));
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  return (
    <AppRoutes
      user={user}
      authReady={authReady}
      setUser={setUser}
      setAuthReady={setAuthReady}
    />
  );
}
