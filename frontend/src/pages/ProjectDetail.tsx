import { useParams } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { request } from "../api/client";
import type { Invite, InviteKind, Membership, Project, Role, Task } from "../api/types";
import { minutesLabel } from "../lib/time";

const INVITE_ROLES: Role[] = ["manager", "developer", "viewer"];
const INVITE_KINDS: { id: InviteKind; label: string }[] = [
  { id: "email", label: "Через почту" },
  { id: "link", label: "Сгенерировать ссылку" },
  { id: "token", label: "Сгенерировать токен" },
];
const KIND_LABEL: Record<InviteKind, string> = {
  email: "почта",
  link: "ссылка",
  token: "токен",
};
const TASK_STATUSES = [
  ["todo", "К работе"],
  ["in_progress", "В работе"],
  ["done", "Готово"],
  ["cancelled", "Отменена"],
] as const;

export default function ProjectDetail() {
  const params = useParams();
  const id = () => params.id;
  const [error, setError] = createSignal("");
  const [taskName, setTaskName] = createSignal("");
  const [inviteEmail, setInviteEmail] = createSignal("");
  const [inviteRole, setInviteRole] = createSignal<Role>("developer");
  const [inviteKind, setInviteKind] = createSignal<InviteKind>("email");
  const [copied, setCopied] = createSignal("");

  const [project, { refetch: refetchProject }] = createResource(id, (pid) =>
    request<Project>(`/api/projects/${pid}/`),
  );
  const [members, { refetch: refetchMembers }] = createResource(id, (pid) =>
    request<Membership[]>(`/api/projects/${pid}/members/`),
  );
  const [tasks, { refetch: refetchTasks }] = createResource(id, (pid) =>
    request<Task[]>(`/api/projects/${pid}/tasks/`),
  );
  const [invites, { refetch: refetchInvites }] = createResource(id, async (pid) => {
    try {
      return await request<Invite[]>(`/api/projects/${pid}/invites/`);
    } catch {
      return [] as Invite[];
    }
  });

  const canManageProject = () => project()?.role === "owner";
  const canManageMembers = () => ["owner", "manager", "developer"].includes(project()?.role || "");
  const canManageTasks = () => ["owner", "manager"].includes(project()?.role || "");

  async function saveProject(e: Event) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setError("");
    try {
      await request(`/api/projects/${id()}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.get("name"),
          description: data.get("description"),
          status: data.get("status"),
          rate: Number(data.get("rate") || 0),
        }),
      });
      refetchProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function addTask(e: Event) {
    e.preventDefault();
    setError("");
    try {
      await request(`/api/projects/${id()}/tasks/`, {
        method: "POST",
        body: JSON.stringify({ name: taskName() }),
      });
      setTaskName("");
      refetchTasks();
      refetchProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function patchTask(task: Task, body: Partial<Task>) {
    setError("");
    try {
      await request(`/api/tasks/${task.id}/`, { method: "PATCH", body: JSON.stringify(body) });
      refetchTasks();
      refetchProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function sendInvite(e: Event) {
    e.preventDefault();
    setError("");
    try {
      const body: Record<string, string> = { role: inviteRole(), kind: inviteKind() };
      if (inviteKind() === "email") body.email = inviteEmail();
      await request(`/api/projects/${id()}/invites/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setInviteEmail("");
      refetchInvites();
      refetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  function inviteValue(inv: Invite) {
    if (inv.kind === "link") return `${window.location.origin}/invite/${inv.token}`;
    if (inv.kind === "token") return inv.token;
    return inv.email;
  }

  async function copyInvite(inv: Invite) {
    const text = inviteValue(inv);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(`${inv.id}`);
  }

  async function changeRole(userId: number, role: Role) {
    try {
      await request(`/api/projects/${id()}/members/${userId}/`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      refetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function removeMember(userId: number) {
    try {
      await request(`/api/projects/${id()}/members/${userId}/`, { method: "DELETE" });
      refetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div>
      <Show when={project()} fallback={<div class="muted">Загрузка…</div>}>
        {(p) => (
          <>
            <h1>{p().name}</h1>
            {error() && <p class="error">{error()}</p>}
            <form class="card grid" onSubmit={saveProject}>
              <div>
                <label>Название</label>
                <input name="name" value={p().name} disabled={!canManageProject()} />
              </div>
              <div>
                <label>Описание</label>
                <textarea name="description" value={p().description} disabled={!canManageProject()} />
              </div>
              <div>
                <label>Ставка</label>
                <input
                  name="rate"
                  type="number"
                  min="0"
                  step="1"
                  value={p().rate}
                  disabled={!canManageProject()}
                />
              </div>
              <div>
                <label>Статус</label>
                <select name="status" value={p().status} disabled={!canManageProject()}>
                  <option value="active">Активный</option>
                  <option value="paused">На паузе</option>
                  <option value="archived">Архив</option>
                </select>
              </div>
              <Show when={canManageProject()}>
                <button type="submit">Сохранить</button>
              </Show>
            </form>

            <div class="grid cols-3" style={{ "margin-top": "16px" }}>
              <div class="card">
                <div class="muted">Задачи</div>
                <div class="stat">
                  {p().tasks_total} / {p().tasks_done}
                </div>
                <div class="muted">всего / выполнено</div>
              </div>
              <div class="card">
                <div class="muted">Время по проекту</div>
                <div class="stat">{minutesLabel(p().total_minutes)}</div>
              </div>
              <div class="card">
                <div class="muted">Ставка</div>
                <div class="stat">{p().rate}</div>
              </div>
            </div>

            <h2>Задачи</h2>
            <Show when={canManageTasks()}>
              <form class="card row" onSubmit={addTask}>
                <div>
                  <label>Новая задача</label>
                  <input value={taskName()} onInput={(e) => setTaskName(e.currentTarget.value)} required />
                </div>
                <button type="submit">Добавить</button>
              </form>
            </Show>
            <div class="card">
              <table class="stack">
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Статус</th>
                    <th>Часы</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={tasks() ?? []}>
                    {(t) => (
                      <tr>
                        <td data-label="Задача">{t.name}</td>
                        <td data-label="Статус">
                          <Show when={canManageTasks()} fallback={t.status}>
                            <select
                              value={t.status}
                              onChange={(e) => patchTask(t, { status: e.currentTarget.value as Task["status"] })}
                            >
                              <For each={TASK_STATUSES}>
                                {(s) => <option value={s[0]}>{s[1]}</option>}
                              </For>
                            </select>
                          </Show>
                        </td>
                        <td data-label="Часы">{minutesLabel(t.total_minutes || 0)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            <h2>Участники</h2>
            <div class="card">
              <table class="stack">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Роль</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <For each={members() ?? []}>
                    {(m) => (
                      <tr>
                        <td data-label="Email">{m.user.email}</td>
                        <td data-label="Роль">
                          <Show when={canManageMembers() && m.role !== "owner"} fallback={m.role}>
                            <select value={m.role} onChange={(e) => changeRole(m.user.id, e.currentTarget.value as Role)}>
                              <For each={INVITE_ROLES}>{(r) => <option value={r}>{r}</option>}</For>
                            </select>
                          </Show>
                        </td>
                        <td>
                          <Show when={canManageMembers() && m.role !== "owner"}>
                            <button class="danger" type="button" onClick={() => removeMember(m.user.id)}>
                              Убрать
                            </button>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            <Show when={canManageMembers()}>
              <h2>Пригласить</h2>
              <form class="card grid" onSubmit={sendInvite}>
                <div>
                  <label>Способ</label>
                  <select
                    value={inviteKind()}
                    onChange={(e) => setInviteKind(e.currentTarget.value as InviteKind)}
                  >
                    <For each={INVITE_KINDS}>{(k) => <option value={k.id}>{k.label}</option>}</For>
                  </select>
                </div>
                <Show when={inviteKind() === "email"}>
                  <div>
                    <label>Email</label>
                    <input
                      type="email"
                      value={inviteEmail()}
                      onInput={(e) => setInviteEmail(e.currentTarget.value)}
                      required
                    />
                  </div>
                </Show>
                <div class="row">
                  <div>
                    <label>Роль</label>
                    <select value={inviteRole()} onChange={(e) => setInviteRole(e.currentTarget.value as Role)}>
                      <For each={INVITE_ROLES}>{(r) => <option value={r}>{r}</option>}</For>
                    </select>
                  </div>
                  <button type="submit">
                    {inviteKind() === "email" ? "Отправить" : "Сгенерировать"}
                  </button>
                </div>
              </form>
              <For each={invites() ?? []}>
                {(inv) => (
                  <div class="card" style={{ "margin-top": "8px" }}>
                    <div class="muted">
                      Ожидает: {KIND_LABEL[inv.kind]} ({inv.role})
                      <Show when={inv.kind === "email"}> {inv.email}</Show>
                    </div>
                    <Show when={inv.kind !== "email"}>
                      <code class="mono">{inviteValue(inv)}</code>
                      <button
                        class="secondary"
                        type="button"
                        style={{ "margin-top": "8px" }}
                        onClick={() => copyInvite(inv)}
                      >
                        {copied() === String(inv.id) ? "Скопировано" : "Копировать"}
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
