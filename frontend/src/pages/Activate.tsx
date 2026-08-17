import { A, useParams } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { request } from "../api/client";

export default function Activate() {
  const params = useParams();
  const [error, setError] = createSignal("");
  const [ok, setOk] = createSignal(false);

  onMount(async () => {
    try {
      await request("/api/auth/users/activation/", {
        method: "POST",
        body: JSON.stringify({ uid: params.uid, token: params.token }),
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось активировать");
    }
  });

  return (
    <div class="auth">
      <div class="card grid">
        <h1>Активация</h1>
        {ok() && (
          <>
            <p class="ok">Аккаунт активирован.</p>
            <A href="/login">Войти</A>
          </>
        )}
        {error() && <div class="error">{error()}</div>}
        {!ok() && !error() && <p class="muted">Проверяем ссылку…</p>}
      </div>
    </div>
  );
}
