"use client";
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button, Modal } from "./ui";

/** Camera QR scanner. Calls onResult(text) once and closes. */
export default function QrScanner({ onResult, label = "Scan QR", size = "md", variant = "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <Camera className="h-4 w-4" /> {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Scan a strip QR code">
        {open && (
          <ScannerView
            onResult={(t) => {
              setOpen(false);
              onResult(t);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function ScannerView({ onResult }) {
  const video = useRef(null);
  const [error, setError] = useState(null);
  const cb = useRef(onResult);
  useEffect(() => {
    cb.current = onResult;
  });
  useEffect(() => {
    let scanner;
    let done = false;
    (async () => {
      try {
        const QrScannerLib = (await import("qr-scanner")).default;
        scanner = new QrScannerLib(
          video.current,
          (r) => {
            if (done) return;
            done = true;
            cb.current(r.data);
          },
          { highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: "environment" },
        );
        await scanner.start();
      } catch (e) {
        setError(e?.message ?? String(e));
      }
    })();
    return () => scanner?.destroy();
  }, []);
  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-black">
        <video ref={video} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {error ? `Camera unavailable: ${error}. You can paste the code instead.` : "Point the camera at the QR code on the strip."}
      </p>
    </div>
  );
}
