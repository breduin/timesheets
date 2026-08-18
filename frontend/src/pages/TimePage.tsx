import { useSearchParams } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import { request, unwrapList } from "../api/client";
import type { Project, Task, TimeEntry } from "../api/types";
import { addDays, minutesLabel, todayISO } from "../lib/time";

export default function TimePage() {
  const [params] = useSearchParams();
  const [projects] = createResource(() => request<{ results: Project[] }>("/api/projects/"));
  const [projectId, setProjectId] = createSignal("");
  const [taskId, setTaskId] = createSignal("");
  const [date, setDate] = createSignal(todayISO());
  const [hours, setHours] = createSignal("1");
  const [minutes, setMinutes] = createSignal("0");
  const [comment, setComment] = createSignal("");
  const [error, setError] = createSignal("");
  // По умолчанию показываем записи за последний месяц.
  const [from, setFrom] = createSignal(addDays(todayISO(), -30));
  const [to, setTo] = createSignal(todayISO());
  const [editing, setEditing] = createSignal<TimeEntry | null>(null);
  const [editHours, setEditHours] = createSignal("0");
  const [editMinutes, setEditMinutes] = createSignal("0");
  const [editDate, setEditDate] = createSignal("");
  const [editComment, setEditComment] = createSignal("");
  const [editError, setEditError] = createSignal("");

  const [tasks] = createResource(projectId, async (pid) => {
    if (!pid) return [] as Task[];
    return request<Task[]>(`/api/projects/${pid}/tasks/?status=in_progress`);
  });
  const [entries, { refetch }] = createResource(
    () => `${from()}|${to()}`,
    () =>
      request<{ results: TimeEntry[] }>(
        `/api/time-entries/?spent_on_after=${from()}&spent_on_before=${to()}&page_size=200`,
      ),
  );

  onMount(() => {
    if (params.project) setProjectId(String(params.project));
    if (params.task) setTaskId(String(params.task));
    if (params.comment) setComment(String(params.comment));
  });

  const projectList = createMemo(() => unwrapList(projects() ?? { results: [] }));

  async function submit(e: Event) {
    e.preventDefault();
    setError("");
    const duration = Number(hours()) * 60 + Number(minutes());
    try {
      await request("/api/time-entries/", {
        method: "POST",
        body: JSON.stringify({
          task: Number(taskId()),
          spent_on: date(),
          duration_minutes: duration,
          comment: comment(),
        }),
      });
      setComment("");
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  function openEdit(entry: TimeEntry) {
    setEditing(entry);
    setEditHours(String(Math.floor(entry.duration_minutes / 60)));
    setEditMinutes(String(entry.duration_minutes % 60));
    setEditDate(entry.spent_on);
    setEditComment(entry.comment || "");
    setEditError("");
  }

  async function saveEdit(e: Event) {
    e.preventDefault();
    const entry = editing();
    if (!entry) return;
    setEditError("");
    try {
      await request(`/api/time-entries/${entry.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          spent_on: editDate(),
          duration_minutes: Number(editHours()) * 60 + Number(editMinutes()),
          comment: editComment(),
        }),
      });
      setEditing(null);
      refetch();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function removeEntry(entry: TimeEntry) {
    if (entry.task_status !== "in_progress") return; // как и для редактирования
    setError("");
    try {
      await request(`/api/time-entries/${entry.id}/`, { method: "DELETE" });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div>
      <h1>Учёт времени</h1>
      <form class="card grid" onSubmit={submit}>
        <div class="row">
          <div>
            <label>Проект</label>
            <select
              value={projectId()}
              onChange={(e) => {
                setProjectId(e.currentTarget.value);
                setTaskId("");
              }}
              required
            >
              <option value="">—</option>
              <For each={projectList()}>{(p) => <option value={p.id}>{p.name}</option>}</For>
            </select>
          </div>
          <div>
            <label>Задача (в работе)</label>
            <select value={taskId()} onChange={(e) => setTaskId(e.currentTarget.value)} required>
              <option value="">—</option>
              <For each={tasks() ?? []}>{(t) => <option value={t.id}>{t.name}</option>}</For>
            </select>
          </div>
          <div>
            <label>Дата</label>
            <input type="date" value={date()} onInput={(e) => setDate(e.currentTarget.value)} required />
          </div>
          <div>
            <label>Часы</label>
            <input type="number" min="0" value={hours()} onInput={(e) => setHours(e.currentTarget.value)} />
          </div>
          <div>
            <label>Минуты</label>
            <input type="number" min="0" max="59" value={minutes()} onInput={(e) => setMinutes(e.currentTarget.value)} />
          </div>
        </div>
        <div>
          <label>Комментарий</label>
          <input value={comment()} onInput={(e) => setComment(e.currentTarget.value)} />
        </div>
        {error() && <div class="error">{error()}</div>}
        <button type="submit">Сохранить</button>
      </form>

      <h2>Записи</h2>
      <div class="row">
        <div>
          <label>С</label>
          <input type="date" value={from()} onInput={(e) => setFrom(e.currentTarget.value)} />
        </div>
        <div>
          <label>По</label>
          <input type="date" value={to()} onInput={(e) => setTo(e.currentTarget.value)} />
        </div>
      </div>
      <div class="card" style={{ "margin-top": "12px" }}>
        <table class="stack">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Проект</th>
              <th>Задача</th>
              <th>Время</th>
              <th>Комментарий</th>
              <th>Управление</th>
            </tr>
          </thead>
          <tbody>
            <For each={unwrapList(entries() ?? { results: [] })}>
              {(e) => (
                <tr>
                  <td data-label="Дата">{e.spent_on}</td>
                  <td data-label="Проект">{e.project_name}</td>
                  <td data-label="Задача">{e.task_name}</td>
                  <td data-label="Время">{minutesLabel(e.duration_minutes)}</td>
                  <td data-label="Комментарий">{e.comment}</td>
                  <td data-label="Управление">
                    <div class="row">
                      <span
                        style={{
                          display: "inline-block",
                          cursor: e.task_status === "in_progress" ? undefined : "not-allowed",
                        }}
                        title={
                          e.task_status === "in_progress"
                            ? undefined
                            : "Редактировать можно только записи по задачам в статусе «В работе»"
                        }
                      >
                        <button
                          type="button"
                          class="secondary"
                          disabled={e.task_status !== "in_progress"}
                          onClick={() => openEdit(e)}
                        >
                          Редактировать
                        </button>
                      </span>
                      <span
                        style={{
                          display: "inline-block",
                          cursor: e.task_status === "in_progress" ? undefined : "not-allowed",
                        }}
                        title={
                          e.task_status === "in_progress"
                            ? undefined
                            : "Удалять можно только записи по задачам в статусе «В работе»"
                        }
                      >
                        <button
                          type="button"
                          class="danger"
                          disabled={e.task_status !== "in_progress"}
                          onClick={() => removeEntry(e)}
                        >
                          Удалить
                        </button>
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={editing()}>
        {(entry) => (
          <div class="modal-backdrop" onClick={() => setEditing(null)}>
            <form class="card modal grid" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
              <h2>Редактировать запись</h2>
              <p class="muted">
                {entry().project_name} / {entry().task_name}
              </p>
              <div>
                <label>Дата</label>
                <input type="date" value={editDate()} onInput={(e) => setEditDate(e.currentTarget.value)} required />
              </div>
              <div class="row">
                <div>
                  <label>Часы</label>
                  <input type="number" min="0" value={editHours()} onInput={(e) => setEditHours(e.currentTarget.value)} />
                </div>
                <div>
                  <label>Минуты</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={editMinutes()}
                    onInput={(e) => setEditMinutes(e.currentTarget.value)}
                  />
                </div>
              </div>
              <div>
                <label>Комментарий</label>
                <input value={editComment()} onInput={(e) => setEditComment(e.currentTarget.value)} />
              </div>
              {editError() && <div class="error">{editError()}</div>}
              <div class="row">
                <button type="submit">Сохранить</button>
                <button class="secondary" type="button" onClick={() => setEditing(null)}>
                  Закрыть
                </button>
              </div>
            </form>
          </div>
        )}
      </Show>
    </div>
  );
}
