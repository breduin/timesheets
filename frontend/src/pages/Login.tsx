import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { login, request } from "../api/client";
import { setCurrentUser } from "../stores/auth";
import type { User } from "../api/types";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [pending, setPending] = createSignal(false);

  async function submit(e: Event) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(email(), password());
      const me = await request<User>("/api/auth/users/me/");
      setCurrentUser(me);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  return (
    <div class="auth">
      <form class="card grid" onSubmit={submit}>
        <h1>Вход</h1>
        <div>
          <label>Email</label>
          <input type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required />
        </div>
        <div>
          <label>Пароль</label>
          <input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required />
        </div>
        {error() && <div class="error">{error()}</div>}
        <button type="submit" disabled={pending()}>Войти</button>
        <div class="muted">
          Нет аккаунта? <A href="/register">Регистрация</A>
        </div>
      </form>
    </div>
  );
}
