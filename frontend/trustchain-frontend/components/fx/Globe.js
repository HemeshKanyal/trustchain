"use client";
import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { useReducedMotion } from "framer-motion";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/**
 * Dotted globe (story site style). markers: [{location:[lat,lon], tone:'teal'|'rose', size}], arcs: [{from,to,tone}].
 * Starts facing India.
 */
export default function Globe({ markers = [], arcs = [], size = 560, className = "" }) {
  const canvas = useRef(null);
  const reduce = useReducedMotion();
  const key = JSON.stringify([markers, arcs]);

  useEffect(() => {
    // cobe's angle convention: phi = π − (lon − 90°), theta = lat. Start centred on India (22°N, 78°E).
    let phi = Math.PI - ((78 * Math.PI) / 180 - Math.PI / 2);
    const globe = createGlobe(canvas.current, {
      devicePixelRatio: 2,
      width: size * 2,
      height: size * 2,
      phi,
      theta: 0.32,
      dark: 1,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 6,
      mapBaseBrightness: 0.02,
      baseColor: [0.32, 0.38, 0.62],
      markerColor: hex("#2dd4bf"),
      glowColor: [0.12, 0.35, 0.42],
      // Shipments in transit light up both ends (sender and receiver) brighter than ordinary members.
      markers: [
        ...markers.map((m) => ({ location: m.location, size: m.size ?? 0.05 })),
        ...arcs.flatMap((a) => [{ location: a.from, size: 0.08 }, { location: a.to, size: 0.08 }]),
      ],
      onRender: (state) => {
        state.phi = phi;
        if (!reduce) phi += 0.0012;
      },
    });
    return () => globe.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size, reduce]);

  return (
    <div className={`relative ${className}`} style={{ width: "100%", maxWidth: size, aspectRatio: "1" }}>
      <div className="pointer-events-none absolute inset-[6%] rounded-full shadow-[0_0_120px_20px_rgba(45,212,191,0.12)]" />
      <canvas ref={canvas} style={{ width: "100%", height: "100%" }} width={size * 2} height={size * 2} aria-label="Globe of the TrustChain network" />
    </div>
  );
}
