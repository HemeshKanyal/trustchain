"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrImage({ value, size = 180, className = "", label }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: "#04060d", light: "#ffffff" } }).then(setSrc);
  }, [value, size]);
  return (
    <div className={`inline-block rounded-xl bg-white p-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} width={size} height={size} alt={label ?? "QR code"} data-testid="qr-image" />}
    </div>
  );
}
