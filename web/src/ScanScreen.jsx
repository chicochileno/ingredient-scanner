import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { scanImage, scanBarcode } from './api';
import './ScanScreen.css';

export default function ScanScreen({ onResult, onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState('label');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const navigate = useNavigate();

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
    startCamera();
    return stopCamera;
  }, []);

  // ZXing continuous barcode scanning — active only in barcode mode
  useEffect(() => {
    if (mode !== 'barcode' || !cameraReady) return;

    const reader = new BrowserMultiFormatReader();
    let triggered = false;

    reader.decodeFromVideoElement(videoRef.current, async (result, _err, controls) => {
      if (triggered) return;
      if (result) {
        triggered = true;
        controls.stop();
        setLoading(true);
        setError(null);
        try {
          const data = await scanBarcode(result.getText());
          onResult(data, 'barcode', null);
        } catch (e) {
          if (e.message === 'scan_limit_reached') {
            navigate('/upgrade');
            return;
          }
          setError(e.message);
          setLoading(false);
          triggered = false;
        }
      }
    }).catch(() => {});

    return () => {
      triggered = true;
      try { reader.reset(); } catch {}
    };
  }, [mode, cameraReady]);

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
      onResult(result, 'camera', base64);
    } catch (e) {
      if (e.message === 'scan_limit_reached') {
        navigate('/upgrade');
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="scan-root">
      <video ref={videoRef} className="scan-video" autoPlay playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="scan-overlay">
        <div className="scan-top">
          {onBack && (
            <button className="scan-back" onClick={onBack}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <h1 className="scan-title">Ingredient Scanner</h1>
          <p className="scan-sub">
            {mode === 'label' ? 'Point at an ingredient list' : 'Hold barcode steady in frame'}
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
              onClick={() => { setMode('label'); setError(null); }}
            >Label</button>
            <button
              className={`mode-btn ${mode === 'barcode' ? 'active' : ''}`}
              onClick={() => { setMode('barcode'); setError(null); }}
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
            <div className="barcode-status">
              {loading
                ? <span className="spinner white" />
                : <span className="barcode-scanning-label">Auto-scanning…</span>
              }
            </div>
          )}
        </div>

        {error && (
          <div className="scan-error">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
