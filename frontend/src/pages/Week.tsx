import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { request, unwrapList } from "../api/client";
import type { Project, Task, TimeEntry } from "../api/types";
import { addDays, minutesLabel, startOfIsoWeek, weekdayNames } from "../lib/time";

type CellKey = string;

export default function Week() {
  const [weekStart, setWeekStart] = createSignal(startOfIsoWeek());
  const [modal, setModal] = createSignal<{ task: Task; date: string; entry?: TimeEntry } | null>(null);
  const [hours, setHours] = createSignal("1");
  const [minutes, setMinutes] = createSignal("0");
  const [comment, setComment] = createSignal("");
  const [error, setError] = createSignal("");

  const days = createMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart(), i)));
  const rangeKey = createMemo(() => `${weekStart()}|${addDays(weekStart(), 6)}`);

  const [projects] = createResource(() => request<{ results: Project[] }>("/api/projects/"));
  const [taskMap] = createResource(projects, async (plist) => {
    const all: Task[] = [];
    for (const p of unwrapList(plist)) {
      const tasks = await request<Task[]>(`/api/projects/${p.id}/tasks/`);
      all.push(...tasks);
    }
    return all;
  });
    const [entries, { refetch }] = createResource(rangeKey, (key) => {
    const [from, to] = key.split("|");
    return request<{ results: TimeEntry[] }>(
      `/api/time-entries/?spent_on_after=${from}&spent_on_before=${to}&page_size=500`,
    );
  });

  const grouped = createMemo(() => {
    const map = new Map<CellKey, number>();
    const byCell = new Map<CellKey, TimeEntry[]>();
    for (const e of unwrapList(entries() ?? { results: [] })) {
      const key = `${e.task}:${e.spent_on}`;
      map.set(key, (map.get(key) || 0) + e.duration_minutes);
      const list = byCell.get(key) || [];
      list.push(e);
      byCell.set(key, list);
    }
    return { map, byCell };
  });

  function openCell(task: Task, date: string) {
    if (task.status !== "in_progress") return;
    const items = grouped().byCell.get(`${task.id}:${date}`) || [];
    const entry = items.length === 1 ? items[0] : items[0];
    setHours(entry ? String(Math.floor(entry.duration_minutes / 60)) : "1");
    setMinutes(entry ? String(entry.duration_minutes % 60) : "0");
    setComment(entry?.comment || "");
    setError("");
    setModal({ task, date, entry });
  }

  async function save(e: Event) {
    e.preventDefault();
    const m = modal();
    if (!m) return;
    const duration = Number(hours()) * 60 + Number(minutes());
    try {
      if (m.entry) {
        await request(`/api/time-entries/${m.entry.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ duration_minutes: duration, comment: comment() }),
        });
      } else {
        await request("/api/time-entries/", {
          method: "POST",
          body: JSON.stringify({
            task: m.task.id,
            spent_on: m.date,
            duration_minutes: duration,
            comment: comment(),
          }),
        });
      }
      setModal(null);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  const tasksByProject = createMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const t of taskMap() ?? []) {
      const key = t.project_name;
      const list = groups.get(key) || [];
      list.push(t);
      groups.set(key, list);
    }
    return [...groups.entries()];
  });

  return (
    <div>
      <h1>Неделя</h1>
      <div class="row toolbar">
        <button class="secondary" type="button" onClick={() => setWeekStart(addDays(weekStart(), -7))}>
          ←
        </button>
        <div class="muted">
          {weekStart()} — {addDays(weekStart(), 6)}
        </div>
        <button class="secondary" type="button" onClick={() => setWeekStart(addDays(weekStart(), 7))}>
          →
        </button>
      </div>
      <div class="card table-scroll" style={{ "margin-top": "12px" }}>
        <table class="week">
          <thead>
            <tr>
              <th>Задача</th>
              <For each={days()}>
                {(d, i) => (
                  <th>
                    {weekdayNames()[i()]}
                    <div class="muted">{d.slice(5)}</div>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={tasksByProject()}>
              {([projectName, tasks]) => (
                <>
                  <tr>
                    <td colSpan="8">
                      <b>{projectName}</b>
                    </td>
                  </tr>
                  <For each={tasks}>
                    {(task) => (
                      <tr>
                        <td>{task.name}</td>
                        <For each={days()}>
                          {(d) => {
                            const mins = grouped().map.get(`${task.id}:${d}`) || 0;
                            return (
                              <td
                                class={task.status === "in_progress" ? undefined : "locked"}
                                onClick={() => openCell(task, d)}
                              >
                                {mins ? minutesLabel(mins) : ""}
                              </td>
                            );
                          }}
                        </For>
                      </tr>
                    )}
                  </For>
                </>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <Show when={modal()}>
        {(m) => (
          <div class="modal-backdrop" onClick={() => setModal(null)}>
            <form
              class="card modal grid"
              onClick={(e) => e.stopPropagation()}
              onSubmit={save}
            >
              <h2>
                {m().task.name} — {m().date}
              </h2>
              <div class="row">
                <div>
                  <label>Часы</label>
                  <input type="number" min="0" value={hours()} onInput={(e) => setHours(e.currentTarget.value)} />
                </div>
                <div>
                  <label>Минуты</label>
                  <input type="number" min="0" value={minutes()} onInput={(e) => setMinutes(e.currentTarget.value)} />
                </div>
              </div>
              <div>
                <label>Комментарий</label>
                <input value={comment()} onInput={(e) => setComment(e.currentTarget.value)} />
              </div>
              {error() && <div class="error">{error()}</div>}
              <div class="row">
                <button type="submit">Сохранить</button>
                <button class="secondary" type="button" onClick={() => setModal(null)}>
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
