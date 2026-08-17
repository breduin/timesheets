import { createSignal } from "solid-js";
import type { User } from "../api/types";

const [accessToken, setAccessTokenSignal] = createSignal<string | null>(null);
const [currentUser, setCurrentUser] = createSignal<User | null>(null);

export function getAccessToken() {
  return accessToken();
}

export function setAccessToken(token: string | null) {
  setAccessTokenSignal(token);
}

export function getRefreshToken() {
  return localStorage.getItem("refresh");
}

export function setRefreshToken(token: string) {
  localStorage.setItem("refresh", token);
}

export function clearAuth() {
  setAccessTokenSignal(null);
  setCurrentUser(null);
  localStorage.removeItem("refresh");
}

export { currentUser, setCurrentUser, accessToken };
