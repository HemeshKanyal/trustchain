import { API_URL } from "./config";

export async function api(path) {
  const r = await fetch(`${API_URL}${path}`);
  if (!r.ok) throw new Error(`Backend ${r.status}`);
  return r.json();
}
