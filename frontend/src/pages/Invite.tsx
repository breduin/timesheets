import { A, useNavigate, useParams } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { request } from "../api/client";
import { getAccessToken } from "../stores/auth";

type Preview = { email: string; role: string; project_name: string; expires_at: string };

export default function Invite() {
  const params = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = createSignal<Preview | null>(null);
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [pending, setPending] = createSignal(false);

  onMount(async () => {
    try {
      const data = await request<Preview>(`/api/invites/${params.token}/`);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Приглашение не найдено");
    }
  });

  async function submit(e: Event) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const body: Record<string, string> = {};
      if (!getAccessToken()) body.password = password();
      await request(`/api/invites/${params.token}/accept/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось принять");
    } finally {
      setPending(false);
    }
  }

  return (
    <div class="auth">
      <form class="card grid" onSubmit={submit}>
        <h1>Приглашение</h1>
        <Show when={preview()}>
          {(p) => (
            <p>
              Проект <b>{p().project_name}</b>, роль <b>{p().role}</b>, email {p().email}
            </p>
          )}
        </Show>
        <Show when={!getAccessToken()}>
          <div>
            <label>Пароль для нового аккаунта</label>
            <input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required />
          </div>
        </Show>
        {error() && <div class="error">{error()}</div>}
        <button type="submit" disabled={pending() || !preview()}>Принять</button>
        <A href="/login">Ко входу</A>
      </form>
    </div>
  );
}
