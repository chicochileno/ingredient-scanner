import { useRef, useEffect, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { scanImage, scanBarcode } from './api';
import './ScanScreen.css';

export default function ScanScreen({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const qrRef = useRef(null);
  const [mode, setMode] = useState('label');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (qrRef.current) {
      qrRef.current.stop().catch(() => {});
      qrRef.current = null;
    }
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
      if (qrRef.current) {
        qrRef.current.stop().catch(() => {});
        qrRef.current = null;
      }
      startCamera();
    } else {
      stopCamera();
      setCameraReady(false);
      const qr = new Html5Qrcode('qr-reader');
      qrRef.current = qr;
      qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (loading) return;
          setLoading(true);
          try {
            const result = await scanBarcode(decodedText);
            stopCamera();
            onResult(result, 'barcode');
          } catch (e) {
            setError(e.message);
            setLoading(false);
          }
        },
        () => {}
      ).catch(() => setError('Could not start barcode scanner.'));
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

  return (
    <div className="scan-root">
      {mode === 'label' ? (
        <video ref={videoRef} className="scan-video" autoPlay playsInline muted />
      ) : (
        <div id="qr-reader" className="scan-video" />
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="scan-overlay">
        <div className="scan-top">
          <h1 className="scan-title">Ingredient Scanner</h1>
          <p className="scan-sub">
            {mode === 'label' ? 'Point at an ingredient list' : 'Point at a product barcode'}
          </p>
        </div>

        {mode === 'label' && (
          <div className="scan-frame">
            <span className="corner tl" /><span className="corner tr" />
            <span className="corner bl" /><span className="corner br" />
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

          {mode === 'barcode' && loading && <div className="barcode-loading"><span className="spinner white" /></div>}
        </div>

        {error && (
          <div className="scan-error">
            <span>{error}</span>
            <button onClick={() => { setError(null); startCamera(); }}>Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
