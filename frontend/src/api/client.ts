import { setAccessToken, getAccessToken, setRefreshToken, getRefreshToken, clearAuth, setCurrentUser } from "../stores/auth";
import type { User } from "./types";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, payload: unknown) {
    super(formatDrfError(payload));
    this.status = status;
    this.payload = payload;
  }
}

export function formatDrfError(payload: unknown): string {
  if (!payload) return "Ошибка запроса";
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object") return "Ошибка запроса";
  const data = payload as Record<string, unknown>;
  if (typeof data.detail === "string") return data.detail;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) parts.push(`${key}: ${value.join(" ")}`);
    else if (typeof value === "string") parts.push(`${key}: ${value}`);
  }
  return parts.join("\n") || "Ошибка запроса";
}

export function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(`${API}/api/auth/jwt/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearAuth();
    return false;
  }
  const data = (await res.json()) as { access: string };
  setAccessToken(data.access);
  return true;
}

export async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401 && retry && !path.includes("/api/auth/jwt/")) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, options, false);
  }
  if (res.status === 204) return undefined as T;
  const body = await parseBody(res);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export async function bootstrapSession(): Promise<boolean> {
  const ok = await tryRefresh();
  if (!ok) return false;
  const me = await request<User>("/api/auth/users/me/");
  setCurrentUser(me);
  return true;
}

export async function login(email: string, password: string) {
  const data = await request<{ access: string; refresh: string }>("/api/auth/jwt/create/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.access);
  setRefreshToken(data.refresh);
  return data;
}

export async function downloadCsv(path: string) {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res = await fetch(`${API}${path}`, { headers });
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) {
      headers.set("Authorization", `Bearer ${getAccessToken()}`);
      res = await fetch(`${API}${path}`, { headers });
    }
  }
  if (!res.ok) throw new ApiError(res.status, await parseBody(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "report.csv";
  a.click();
  URL.revokeObjectURL(url);
}
