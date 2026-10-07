"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import NebulaCanvas from "./NebulaCanvas";

/** Page backdrop in the story site's style: drifting nebula blobs + star dust. Tone follows the page's state. */
const TONES = {
  teal: ["#0a3a5e", "#0f766e", "#1e1b4b"],
  rose: ["#4c0519", "#581c87", "#1e1b4b"],
  violet: ["#3b0764", "#1e3a8a", "#134e4a"],
  amber: ["#422006", "#3b0764", "#0c4a6e"],
};

const Ctx = createContext({ tone: "teal", setTone: () => {} });

export function NebulaProvider({ children }) {
  const [tone, setTone] = useState("teal");
  return <Ctx.Provider value={{ tone, setTone }}>{children}</Ctx.Provider>;
}

/** Call from a page to set the backdrop; resets to teal when the page unmounts. */
export function useNebula(tone) {
  const { setTone } = useContext(Ctx);
  useEffect(() => {
    setTone(tone ?? "teal");
    return () => setTone("teal");
  }, [tone, setTone]);
}

export default function Nebula() {
  const { tone } = useContext(Ctx);
  const [a, b, c] = TONES[tone] ?? TONES.teal;
  const [gl, setGl] = useState(true);
  const fail = useCallback(() => setGl(false), []);
  return (
    <div className="nebula" aria-hidden="true">
      {gl ? (
        <NebulaCanvas tone={tone} onFail={fail} />
      ) : (
        <>
          <div className="nebula-blob nebula-a" style={{ backgroundColor: a }} />
          <div className="nebula-blob nebula-b" style={{ backgroundColor: b }} />
          <div className="nebula-blob nebula-c" style={{ backgroundColor: c }} />
        </>
      )}
      <div className="nebula-stars" />
      <div className="nebula-vignette" />
    </div>
  );
}
