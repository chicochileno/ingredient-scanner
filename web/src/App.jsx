import { useState, useEffect } from 'react';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import LoginScreen from './LoginScreen';
import HomeScreen from './HomeScreen';
import ScanScreen from './ScanScreen';
import ResultsScreen from './ResultsScreen';
import HistoryScreen from './HistoryScreen';

async function saveScan(uid, result, source, imageBase64) {
  const scanRef = doc(collection(db, 'users', uid, 'scans'));
  let imageUrl = null;

  if (imageBase64) {
    try {
      const storageRef = ref(storage, `scans/${uid}/${scanRef.id}.jpg`);
      await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/jpeg' });
      imageUrl = await getDownloadURL(storageRef);
    } catch (e) {
      console.error('Image upload failed', e);
    }
  }

  await setDoc(scanRef, {
    createdAt: serverTimestamp(),
    mode: source,
    productName: result.productName || null,
    rawText: result.rawText || '',
    flagged: result.flagged || [],
    ingredientCount: result.ingredientCount || 0,
    imageUrl,
  });
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('home');
  const [result, setResult] = useState(null);
  const [resultSource, setResultSource] = useState(null);
  const [resultImageUrl, setResultImageUrl] = useState(null);
  const [selectedScan, setSelectedScan] = useState(null);

  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        setUser(result.user);
        setAuthReady(true);
      }
    }).catch((e) => {
      console.error('Redirect result error:', e);
      // Surface the error code on the login screen for debugging
      window.__authError = e.code + ': ' + e.message;
    });

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) setScreen('home');
    });
  }, []);

  async function handleResult(data, src, imageBase64) {
    setResult(data);
    setResultSource(src);
    setResultImageUrl(null);
    setScreen('results');

    if (user) {
      try {
        const scanRef = doc(collection(db, 'users', user.uid, 'scans'));
        let imageUrl = null;

        if (imageBase64) {
          const storageRef = ref(storage, `scans/${user.uid}/${scanRef.id}.jpg`);
          await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/jpeg' });
          imageUrl = await getDownloadURL(storageRef);
          setResultImageUrl(imageUrl);
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
  }

  if (!authReady) {
    return (
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
    );
  }

  if (!user) return <LoginScreen onSignedIn={(u) => { setUser(u); setAuthReady(true); }} />;

  if (screen === 'home') {
    return (
      <HomeScreen
        user={user}
        onScan={() => setScreen('scan')}
        onHistory={() => setScreen('history')}
      />
    );
  }

  if (screen === 'scan') {
    return (
      <ScanScreen
        onResult={handleResult}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'results') {
    return (
      <ResultsScreen
        result={result}
        source={resultSource}
        imageUrl={resultImageUrl}
        onScanAgain={() => setScreen('scan')}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'history') {
    if (selectedScan) {
      return (
        <ResultsScreen
          result={selectedScan}
          source={selectedScan.mode}
          imageUrl={selectedScan.imageUrl}
          onBack={() => setSelectedScan(null)}
        />
      );
    }
    return (
      <HistoryScreen
        user={user}
        onBack={() => setScreen('home')}
        onSelect={(scan) => setSelectedScan(scan)}
      />
    );
  }

  return null;
}
