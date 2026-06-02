import { useState } from 'react';
import ScanScreen from './ScanScreen';
import ResultsScreen from './ResultsScreen';

export default function App() {
  const [screen, setScreen] = useState('scan');
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(null);

  function handleResult(data, src) {
    setResult(data);
    setSource(src);
    setScreen('results');
  }

  return screen === 'scan'
    ? <ScanScreen onResult={handleResult} />
    : <ResultsScreen result={result} source={source} onScanAgain={() => setScreen('scan')} />;
}
