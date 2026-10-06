import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Camera, CameraOff, ImagePlus, Loader2, RotateCcw, ScanLine, X
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const REGION_ID = 'audit-scanner-region';

export default function ScannerModal({ open, title = 'Scan code', onScan, onClose }) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const lastScanRef = useRef({ code: '', at: 0 });
  const photoInputRef = useRef(null);

  const [mode, setMode] = useState('ask');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');

  const stopScanner = useCallback(() => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) s.stop().then(() => s.clear()).catch(() => {});
  }, []);

  const startCamera = useCallback(async () => {
    setBusy(true);
    setError('');
    stopScanner();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      stream.getTracks().forEach((t) => t.stop());

      const instance = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = instance;

      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 180 } },
        (decodedText) => {
          const code = (decodedText || '').trim();
          if (!code) return;
          const now = Date.now();
          if (code === lastScanRef.current.code && now - lastScanRef.current.at < 2000) return;
          lastScanRef.current = { code, at: now };
          onScanRef.current?.(code);
        },
        () => {}
      );

      setMode('live');
      setBusy(false);
    } catch (err) {
      const s = scannerRef.current;
      if (s) {
        scannerRef.current = null;
        s.clear().catch(() => {});
      }
      setBusy(false);
      setMode('blocked');
      const name = err?.name || '';
      if (name === 'NotAllowedError' || /permission|denied/i.test(`${err}`)) {
        setError('Live camera was blocked. You can still scan with the photo option below, or type the code.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('No usable camera was found. Use the photo option or type the code.');
      } else {
        setError(`Could not start the live camera${err?.message ? `: ${err.message}` : ''}. Use the photo option below.`);
      }
    }
  }, [stopScanner]);

  const handlePhotoFile = (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setBusy(true);

    const instance = new Html5Qrcode(REGION_ID, { verbose: false });
    instance
      .scanFile(file, false) 
      .then((decoded) => {
        const code = String(decoded || '').trim();
        if (!code) throw new Error('No code found.');
        onScanRef.current?.(code); 
      })
      .catch(() => {
        setBusy(false);
        setError('Could not read a code from that photo. Fill the frame with the barcode, hold steady, and retake — or type the code below.');
      })
      .finally(() => {
        try { instance.clear(); } catch (e) {}
      });
  };

  useEffect(() => {
    if (!open) return;

    setMode('ask');
    setBusy(false);
    setError('');
    setManualCode('');
    lastScanRef.current = { code: '', at: 0 };

    (async () => {
      try {
        const status = await navigator.permissions?.query?.({ name: 'camera' });
        if (status?.state === 'granted') startCamera();
      } catch (e) {}
    })();

    return () => stopScanner();
  }, [open, startCamera, stopScanner]);

  if (!open) return null;

  const submitManual = () => {
    const code = manualCode.trim();
    if (code) onScanRef.current?.(code);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-bold text-slate-800">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <div id={REGION_ID} className="w-full h-72 bg-slate-950 overflow-hidden" />

          {mode === 'ask' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 px-8 text-center">
              <Camera className="w-10 h-10 text-slate-400" />
              <div className="text-sm font-bold text-slate-200">Camera access required</div>
              <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-[260px]">
                Tap below — your browser will ask to use the camera. Scanning starts once allowed.
              </p>
              <button
                type="button"
                onClick={startCamera}
                disabled={busy}
                className="mt-1 flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {busy ? 'Waiting for permission…' : 'Allow camera'}
              </button>
            </div>
          )}

          {mode === 'live' && (
            <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-2 text-center text-[11px] font-semibold text-slate-300">
              Point the camera at the barcode / QR code
            </div>
          )}

          {mode === 'blocked' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 px-8 text-center">
              <CameraOff className="w-8 h-8 text-slate-500" />
              <div className="flex items-start gap-2 text-[11px] font-semibold text-slate-300 text-left leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry camera
                </button>
                <button
                  type="button"
                  onClick={() => { setError(''); setMode('photo'); }}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Photo scan
                </button>
              </div>
            </div>
          )}

          {mode === 'photo' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 px-8 text-center">
              {busy ? (
                <>
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                  <div className="text-xs font-bold text-slate-300">Reading code from photo…</div>
                </>
              ) : (
                <>
                  <ImagePlus className="w-10 h-10 text-slate-400" />
                  <div className="text-sm font-bold text-slate-200">Scan with your camera</div>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-[280px]">
                    Tap below — your phone camera opens. Take a clear photo of the barcode / QR code and the code is read automatically.
                  </p>
                  {error && (
                    <div className="flex items-start gap-2 text-[11px] font-semibold text-amber-400 text-left leading-relaxed max-w-[280px]">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="mt-1 flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4" /> Open camera & scan
                  </button>
                </>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoFile}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 border-t border-slate-100">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
            placeholder="Or type the code here"
            className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button
            type="button"
            onClick={submitManual}
            disabled={!manualCode.trim()}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            Use
          </button>
        </div>
      </div>
    </div>
  );
}