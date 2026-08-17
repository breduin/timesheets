import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { request, unwrapList } from "../api/client";
import type { Project, TimeEntry } from "../api/types";
import { addDays, minutesLabel, startOfIsoWeek, todayISO } from "../lib/time";

export default function Home() {
  const navigate = useNavigate();
  const from = startOfIsoWeek();
  const to = addDays(from, 6);
  const today = todayISO();

  const [week] = createResource(() =>
    request<{ results: TimeEntry[] }>(
      `/api/time-entries/?spent_on_after=${from}&spent_on_before=${to}&page_size=500`,
    ),
  );
  const [todayEntries] = createResource(() =>
    request<{ results: TimeEntry[] }>(
      `/api/time-entries/?spent_on_after=${today}&spent_on_before=${today}&page_size=100`,
    ),
  );
  const [projects] = createResource(() => request<{ results: Project[] }>("/api/projects/"));

  const weekMinutes = () => unwrapList(week() ?? { results: [] }).reduce((s, e) => s + e.duration_minutes, 0);
  const todayMinutes = () => unwrapList(todayEntries() ?? { results: [] }).reduce((s, e) => s + e.duration_minutes, 0);
  const last = () => unwrapList(week() ?? { results: [] })[0];

  function continueLast() {
    const entry = last();
    if (!entry) return;
    navigate(`/time?project=${entry.project_id}&task=${entry.task}&comment=${encodeURIComponent(entry.comment || "")}`);
  }

  return (
    <div>
      <h1>Сегодня</h1>
      <div class="grid cols-3">
        <div class="card">
          <div class="muted">Сегодня</div>
          <div class="stat">{minutesLabel(todayMinutes())}</div>
        </div>
        <div class="card">
          <div class="muted">Эта неделя</div>
          <div class="stat">{minutesLabel(weekMinutes())}</div>
        </div>
        <div class="card">
          <div class="muted">Последняя запись</div>
          <Show when={last()} fallback={<div class="empty">Пока пусто</div>}>
            {(e) => (
              <>
                <div>
                  {e().project_name} / {e().task_name}
                </div>
                <button onClick={continueLast}>Продолжить</button>
              </>
            )}
          </Show>
        </div>
      </div>
      <h2>Проекты</h2>
      <div class="card list">
        <For each={unwrapList(projects() ?? { results: [] }).filter((p) => p.status === "active")} fallback={<div class="empty">Нет проектов</div>}>
          {(p) => (
            <A href={`/projects/${p.id}`}>
              {p.name} <span class="muted">({p.role})</span>
            </A>
          )}
        </For>
      </div>
      <h2>Сегодняшние записи</h2>
      <div class="card">
        <For each={unwrapList(todayEntries() ?? { results: [] })} fallback={<div class="empty">Нет записей</div>}>
          {(e) => (
            <div>
              {e.task_name}: {minutesLabel(e.duration_minutes)} {e.comment}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
