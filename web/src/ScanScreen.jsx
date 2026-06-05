import { useRef, useEffect, useState, useCallback } from 'react';
import { scanImage, scanBarcode } from './api';
import './ScanScreen.css';

export default function ScanScreen({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const [mode, setMode] = useState('label');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setError('Camera access denied. Please allow camera access and reload.');
    }
  }, []);

  useEffect(() => {
    if (mode === 'label') {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [mode]);

  async function handleCapture() {
    if (!cameraReady || loading) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    setLoading(true);
    try {
      const result = await scanImage(base64);
      onResult(result, 'camera');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Barcode mode: use native camera capture → send image to Vision API for barcode detection
  async function handleBarcodeCapture(e) {
    const file = e.target.files[0];
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1];
        // Try Vision API for barcode first
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/scan/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, detectBarcode: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Scan failed');
        onResult(data, 'barcode');
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  return (
    <div className="scan-root">
      {mode === 'label' && (
        <video ref={videoRef} className="scan-video" autoPlay playsInline muted />
      )}
      {mode === 'barcode' && (
        <div className="barcode-bg" />
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="scan-overlay">
        <div className="scan-top">
          <h1 className="scan-title">Ingredient Scanner</h1>
          <p className="scan-sub">
            {mode === 'label' ? 'Point at an ingredient list' : 'Take a photo of the barcode'}
          </p>
        </div>

        {mode === 'label' && (
          <div className="scan-frame">
            <span className="corner tl" /><span className="corner tr" />
            <span className="corner bl" /><span className="corner br" />
          </div>
        )}

        {mode === 'barcode' && (
          <div className="barcode-frame">
            <span className="barcode-line" />
          </div>
        )}

        <div className="scan-bottom">
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'label' ? 'active' : ''}`}
              onClick={() => setMode('label')}
            >Label</button>
            <button
              className={`mode-btn ${mode === 'barcode' ? 'active' : ''}`}
              onClick={() => setMode('barcode')}
            >Barcode</button>
          </div>

          {mode === 'label' && (
            <button
              className={`capture-btn ${loading ? 'loading' : ''}`}
              onClick={handleCapture}
              disabled={loading || !cameraReady}
            >
              {loading ? <span className="spinner" /> : <span className="capture-inner" />}
            </button>
          )}

          {mode === 'barcode' && (
            <label className={`capture-btn ${loading ? 'loading' : ''}`}>
              {loading
                ? <span className="spinner" />
                : <span className="capture-inner" />}
              <input
                ref={barcodeInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleBarcodeCapture}
                disabled={loading}
              />
            </label>
          )}
        </div>

        {error && (
          <div className="scan-error">
            <span>{error}</span>
            <button onClick={() => { setError(null); if (mode === 'label') startCamera(); }}>Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
