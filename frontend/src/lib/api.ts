import { clearToken, getToken } from "@/lib/auth";
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message); this.name = "ApiError";
  }
}
export function errorMessage(error: unknown, fallback = "No pudimos completar la operación") {
  return error instanceof Error ? error.message : fallback;
}
function record(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
function detail(data: unknown): { code?: string; message: string } {
  const d = record(data) ? data.detail ?? data.message : data;
  if (typeof d === "string") {
    const messages: Record<string, string> = {
      EMAIL_ALREADY_EXISTS: "Este correo ya tiene una cuenta. Inicia sesión.",
      INVALID_CREDENTIALS: "El correo o la contraseña no son correctos.",
      APPOINTMENT_OVERLAP: "Ese horario ya está ocupado. Elige otro turno.",
      APPOINTMENT_IN_PAST: "Elige una fecha y hora futuras.",
      INVALID_STATUS_TRANSITION: "El estado de esta cita ha cambiado. Actualiza tu agenda.",
      OUTSIDE_AVAILABILITY: "Elige un turno dentro del horario de atención.",
      INVALID_TOKEN: "Tu sesión terminó. Vuelve a iniciar sesión.",
      UNAUTHORIZED: "Inicia sesión para continuar.",
      USER_INACTIVE: "Esta cuenta no está activa.",
    };
    return { code: d, message: messages[d] || "Revisa los datos e inténtalo de nuevo." };
  }
  if (Array.isArray(d)) return { message: d.map(item => record(item) && typeof item.msg === "string"
    ? `${Array.isArray(item.loc) ? item.loc.slice(1).join(".") + ": " : ""}${item.msg}` : "Invalid input").join("; ") };
  if (record(d) && typeof d.message === "string") return { code: typeof d.code === "string" ? d.code : undefined, message: d.message };
  return { message: "No pudimos completar la solicitud. Inténtalo de nuevo." };
}
export async function api<T>(path: string, opts: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...request } = opts;
  const headers = new Headers(request.headers); headers.set("Content-Type", "application/json");
  if (auth) { const token = getToken(); if (token) headers.set("Authorization", `Bearer ${token}`); }
  let res: Response;
  try { res = await fetch(`${BASE_URL}${path}`, { ...request, headers, cache: "no-store" }); }
  catch { throw new ApiError(0, "NETWORK_ERROR", "No pudimos conectar con la barbería. Inténtalo de nuevo."); }
  const text = await res.text(); let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (res.status === 401 && auth) { clearToken(); if (typeof window !== "undefined") window.location.assign("/login"); }
  if (!res.ok) { const d = detail(data); throw new ApiError(res.status, d.code, d.message); }
  return data as T;
}
