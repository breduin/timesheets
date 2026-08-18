import { A, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For } from "solid-js";
import { request, unwrapList } from "../api/client";
import type { Project } from "../api/types";

export default function Projects() {
  const navigate = useNavigate();
  const [projects, { refetch }] = createResource(() => request<{ results: Project[] }>("/api/projects/"));
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [inviteToken, setInviteToken] = createSignal("");
  const [error, setError] = createSignal("");

  async function create(e: Event) {
    e.preventDefault();
    setError("");
    try {
      await request("/api/projects/", {
        method: "POST",
        body: JSON.stringify({ name: name(), description: description() }),
      });
      setName("");
      setDescription("");
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function joinByToken(e: Event) {
    e.preventDefault();
    setError("");
    const token = inviteToken().trim();
    if (!token) return;
    try {
      const data = await request<{ detail: string; project_id: number }>(
        `/api/invites/${encodeURIComponent(token)}/accept/`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setInviteToken("");
      navigate(`/projects/${data.project_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div>
      <h1>Проекты</h1>
      <form class="card row" onSubmit={create}>
        <div>
          <label>Название</label>
          <input value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
        </div>
        <div>
          <label>Описание</label>
          <input value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
        </div>
        <button type="submit">Создать</button>
      </form>
      <form class="card row" style={{ "margin-top": "12px" }} onSubmit={joinByToken}>
        <div>
          <label>Токен приглашения</label>
          <input
            value={inviteToken()}
            onInput={(e) => setInviteToken(e.currentTarget.value)}
            placeholder="Вставьте токен"
            required
          />
        </div>
        <button type="submit">Присоединиться</button>
      </form>
      {error() && <p class="error">{error()}</p>}
      <div class="card list" style={{ "margin-top": "16px" }}>
        <For each={unwrapList(projects() ?? { results: [] })} fallback={<div class="empty">Нет проектов</div>}>
          {(p) => (
            <A href={`/projects/${p.id}`}>
              {p.name} — {p.status} <span class="muted">({p.role})</span>
            </A>
          )}
        </For>
      </div>
    </div>
  );
}
