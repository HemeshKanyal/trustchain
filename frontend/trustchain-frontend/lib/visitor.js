"use client";
/** Random anonymous id per browser: lets the AI count *different* people scanning a code, without identifying anyone. */
export function visitorId() {
  try {
    let v = localStorage.getItem("trustchain:visitor");
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem("trustchain:visitor", v);
    }
    return v;
  } catch {
    return "00000000-anon";
  }
}
