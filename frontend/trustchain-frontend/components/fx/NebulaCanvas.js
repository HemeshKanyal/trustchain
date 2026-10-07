"use client";
import { useEffect, useRef } from "react";

// Same domain-warped fbm "cloud" as the story site (trustchain.hemeshkanyal.com), in plain WebGL.
const PALETTES = {
  teal: ["#2dd4bf", "#3b82f6"], // story "solution"
  rose: ["#f43f5e", "#7c3aed"], // story "problem"
  amber: ["#fbbf24", "#7c3aed"],
  violet: ["#7c3aed", "#3b82f6"],
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const VERT = `attribute vec2 a; varying vec2 vUv; void main(){ vUv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
const FRAG = `precision mediump float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
void main(){
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = (vUv - 0.5) * aspect; vec2 m = (uMouse - 0.5) * aspect;
  float d = length(p - m); vec2 push = (p - m) * exp(-d * d * 6.0) * 1.6;
  float t = uTime * 0.035;
  vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 3.1));
  vec2 r = vec2(fbm(p * 1.4 + 2.0 * q + push * 2.5 + vec2(1.7, 9.2) + t * 1.3), fbm(p * 1.4 + 2.0 * q + push * 2.5 + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.4 + 2.5 * r);
  vec3 flow = mix(uA, uB, clamp(length(q) * 1.1, 0.0, 1.0));
  vec3 c = vec3(0.016, 0.024, 0.043);
  c += flow * smoothstep(0.22, 1.0, f) * 0.62;
  c += mix(uA, uB, 0.5) * exp(-d * d * 7.0) * 0.16;
  c *= 1.0 - 0.25 * length(vUv - 0.5);
  c += (hash(vUv * uRes + uTime) - 0.5) * 0.012;
  gl_FragColor = vec4(c, 1.0);
}`;

/** Full-screen animated cloud. Returns false (via onFail) when WebGL is unavailable so the CSS fallback stays. */
export default function NebulaCanvas({ tone = "teal", onFail }) {
  const canvas = useRef(null);
  const target = useRef(PALETTES.teal);
  useEffect(() => {
    target.current = PALETTES[tone] ?? PALETTES.teal;
  }, [tone]);

  useEffect(() => {
    const cv = canvas.current;
    const gl = cv.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return onFail?.();
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return onFail?.();
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n) => gl.getUniformLocation(prog, n);
    const uTime = u("uTime"), uRes = u("uRes"), uMouse = u("uMouse"), uA = u("uA"), uB = u("uB");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scale = Math.min(window.devicePixelRatio || 1, 1) * (window.innerWidth < 768 ? 0.35 : 0.5); // render small, CSS scales up (it's a blur anyway)
    const resize = () => {
      cv.width = Math.max(1, Math.floor(window.innerWidth * scale));
      cv.height = Math.max(1, Math.floor(window.innerHeight * scale));
      gl.viewport(0, 0, cv.width, cv.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const mouse = [0.5, 0.5], goal = [0.5, 0.5];
    const onMove = (e) => {
      goal[0] = e.clientX / window.innerWidth;
      goal[1] = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let a = rgb(target.current[0]), b = rgb(target.current[1]);
    let raf, t0 = performance.now();
    const frame = (now) => {
      const ta = rgb(target.current[0]), tb = rgb(target.current[1]);
      a = a.map((v, i) => v + (ta[i] - v) * 0.03);
      b = b.map((v, i) => v + (tb[i] - v) * 0.03);
      mouse[0] += (goal[0] - mouse[0]) * 0.04;
      mouse[1] += (goal[1] - mouse[1]) * 0.04;
      gl.uniform1f(uTime, reduce ? 12 : (now - t0) / 1000);
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform2f(uMouse, mouse[0], mouse[1]);
      gl.uniform3fv(uA, a);
      gl.uniform3fv(uB, b);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [onFail]);

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
