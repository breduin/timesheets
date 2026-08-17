import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { request } from "../api/client";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [done, setDone] = createSignal(false);
  const [pending, setPending] = createSignal(false);

  async function submit(e: Event) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await request("/api/auth/users/", {
        method: "POST",
        body: JSON.stringify({ email: email(), password: password() }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setPending(false);
    }
  }

  if (done()) {
    return (
      <div class="auth">
        <div class="card grid">
          <h1>Подтвердите email</h1>
          <p>
            На почту <b>{email()}</b> отправлено письмо. Проверьте почту и подтвердите регистрацию.
          </p>
          <button type="button" onClick={() => navigate("/login")}>
            Ок
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="auth">
      <form class="card grid" onSubmit={submit}>
        <h1>Регистрация</h1>
        <div>
          <label>Email</label>
          <input type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required />
        </div>
        <div>
          <label>Пароль</label>
          <input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required />
        </div>
        {error() && <div class="error">{error()}</div>}
        <button type="submit" disabled={pending()}>Создать аккаунт</button>
        <div class="muted">
          Уже есть аккаунт? <A href="/login">Вход</A>
        </div>
      </form>
    </div>
  );
}
