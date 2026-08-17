import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { downloadCsv, request, unwrapList } from "../api/client";
import type { Project, Report, Task } from "../api/types";
import { addDays, minutesLabel, startOfIsoWeek } from "../lib/time";

export default function Reports() {
  const defaultFrom = startOfIsoWeek();
  const [from, setFrom] = createSignal(defaultFrom);
  const [to, setTo] = createSignal(addDays(defaultFrom, 6));
  const [projectId, setProjectId] = createSignal("");
  const [taskId, setTaskId] = createSignal("");
  const [userId, setUserId] = createSignal("");
  const [error, setError] = createSignal("");

  const [projects] = createResource(() => request<{ results: Project[] }>("/api/projects/"));
  const [tasks] = createResource(projectId, async (pid) => {
    if (!pid) return [] as Task[];
    return request<Task[]>(`/api/projects/${pid}/tasks/`);
  });

  const query = createMemo(() => {
    const q = new URLSearchParams();
    if (from()) q.set("from", from());
    if (to()) q.set("to", to());
    if (projectId()) q.set("project", projectId());
    if (taskId()) q.set("task", taskId());
    if (userId()) q.set("user", userId());
    return q.toString();
  });

  const [report, { refetch }] = createResource(query, (q) => request<Report>(`/api/reports/summary/?${q}`));

  const canFilterUser = createMemo(() =>
    unwrapList(projects() ?? { results: [] }).some((p) => p.role === "owner" || p.role === "manager"),
  );

  async function csv() {
    setError("");
    try {
      await downloadCsv(`/api/reports/summary/?${query()}&format=csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div>
      <h1>Отчёты</h1>
      <div class="card row">
        <div>
          <label>С</label>
          <input type="date" value={from()} onInput={(e) => setFrom(e.currentTarget.value)} />
        </div>
        <div>
          <label>По</label>
          <input type="date" value={to()} onInput={(e) => setTo(e.currentTarget.value)} />
        </div>
        <div>
          <label>Проект</label>
          <select
            value={projectId()}
            onChange={(e) => {
              setProjectId(e.currentTarget.value);
              setTaskId("");
            }}
          >
            <option value="">Все</option>
            <For each={unwrapList(projects() ?? { results: [] })}>
              {(p) => <option value={p.id}>{p.name}</option>}
            </For>
          </select>
        </div>
        <div>
          <label>Задача</label>
          <select value={taskId()} onChange={(e) => setTaskId(e.currentTarget.value)}>
            <option value="">Все</option>
            <For each={tasks() ?? []}>{(t) => <option value={t.id}>{t.name}</option>}</For>
          </select>
        </div>
        <Show when={canFilterUser()}>
          <div>
            <label>User id</label>
            <input value={userId()} onInput={(e) => setUserId(e.currentTarget.value)} placeholder="необязательно" />
          </div>
        </Show>
        <button type="button" class="secondary" onClick={() => refetch()}>
          Обновить
        </button>
        <button type="button" onClick={csv}>
          CSV
        </button>
      </div>
      {error() && <p class="error">{error()}</p>}
      <Show when={report()}>
        {(r) => (
          <>
            <h2>Итого: {minutesLabel(r().totals.minutes)}</h2>
            <div class="grid cols-2">
              <div class="card">
                <h2>По проектам</h2>
                <For each={r().by_project}>
                  {(row) => (
                    <div>
                      {row.project_name}: {minutesLabel(row.minutes)}
                    </div>
                  )}
                </For>
              </div>
              <div class="card">
                <h2>По задачам</h2>
                <For each={r().by_task}>
                  {(row) => (
                    <div>
                      {row.project_name} / {row.task_name}: {minutesLabel(row.minutes)}
                    </div>
                  )}
                </For>
              </div>
            </div>
            <Show when={r().by_user}>
              <div class="card" style={{ "margin-top": "12px" }}>
                <h2>По людям</h2>
                <For each={r().by_user}>
                  {(row) => (
                    <div>
                      {row.email}: {minutesLabel(row.minutes)}
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={r().entries}>
              <div class="card" style={{ "margin-top": "12px" }}>
                <h2>Детализация</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Проект</th>
                      <th>Задача</th>
                      <Show when={r().by_user}>
                        <th>Кто</th>
                      </Show>
                      <th>Время</th>
                      <th>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={r().entries}>
                      {(e) => (
                        <tr>
                          <td>{e.spent_on}</td>
                          <td>{e.project_name}</td>
                          <td>{e.task_name}</td>
                          <Show when={r().by_user}>
                            <td>{e.user_email}</td>
                          </Show>
                          <td>{minutesLabel(e.duration_minutes)}</td>
                          <td>{e.comment}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
