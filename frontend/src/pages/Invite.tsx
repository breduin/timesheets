import { A, useNavigate, useParams } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { bootstrapSession, login, request } from "../api/client";
import type { InviteKind } from "../api/types";

type Preview = {
  email: string;
  kind: InviteKind;
  role: string;
  project_id: number;
  project_name: string;
  expires_at: string;
};

export default function Invite() {
  const params = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = createSignal<Preview | null>(null);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [authed, setAuthed] = createSignal(false);
  const [joining, setJoining] = createSignal(false);

  async function accept(body: Record<string, string> = {}) {
    return request<{ detail: string; project_id: number }>(`/api/invites/${params.token}/accept/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  onMount(async () => {
    const ok = await bootstrapSession();
    setAuthed(ok);
    try {
      const data = await request<Preview>(`/api/invites/${params.token}/`);
      setPreview(data);
      if (ok && (data.kind === "link" || data.kind === "token")) {
        setJoining(true);
        const result = await accept();
        navigate(`/projects/${result.project_id}`);
      }
    } catch (err) {
      setJoining(false);
      setError(err instanceof Error ? err.message : "Приглашение не найдено");
    }
  });

  async function submit(e: Event) {
    e.preventDefault();
    if (!preview() || joining()) return;
    if (preview()?.kind === "token" && !authed()) return;
    setPending(true);
    setError("");
    try {
      const kind = preview()?.kind;
      const body: Record<string, string> = {};
      if (!authed()) {
        if (kind === "link") {
          body.email = email();
          body.password = password();
        } else if (kind === "email") {
          body.password = password();
        }
      }
      const result = await accept(body);
      if (kind === "link" && !authed()) {
        await login(email(), password());
        navigate(`/projects/${result.project_id}`);
        return;
      }
      if (authed()) {
        navigate(`/projects/${result.project_id}`);
        return;
      }
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось принять");
    } finally {
      setPending(false);
    }
  }

  const loginHref = () => `/login?next=/invite/${params.token}`;

  return (
    <div class="auth">
      <form class="card grid" onSubmit={submit}>
        <h1>Приглашение</h1>
        <Show when={preview()}>
          {(p) => (
            <p>
              Проект <b>{p().project_name}</b>, роль <b>{p().role}</b>
              <Show when={p().email}>
                , email {p().email}
              </Show>
            </p>
          )}
        </Show>
        <Show when={joining()}>
          <p class="muted">Подключаем к проекту…</p>
        </Show>
        <Show when={preview()?.kind === "token" && !authed()}>
          <p>
            Этот токен для авторизованных пользователей. Войдите и введите его в разделе «Проекты».
          </p>
          <A href="/login?next=/projects">Войти</A>
        </Show>
        <Show when={preview()?.kind === "link" && !authed() && !joining()}>
          <div>
            <label>Email</label>
            <input type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required />
          </div>
          <div>
            <label>Пароль</label>
            <input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required />
          </div>
          <p class="muted">
            Уже есть аккаунт? <A href={loginHref()}>Войти</A> — после входа вы сразу попадёте в проект.
          </p>
        </Show>
        <Show when={preview()?.kind === "email" && !authed()}>
          <div>
            <label>Пароль для нового аккаунта</label>
            <input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required />
          </div>
        </Show>
        {error() && <div class="error">{error()}</div>}
        <Show
          when={
            preview() &&
            !joining() &&
            (preview()?.kind !== "token" || authed())
          }
        >
          <button type="submit" disabled={pending()}>
            {preview()?.kind === "link" && !authed() ? "Создать аккаунт и присоединиться" : "Принять"}
          </button>
        </Show>
        <A href="/login">Ко входу</A>
      </form>
    </div>
  );
}
