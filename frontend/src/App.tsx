import { A, useNavigate } from "@solidjs/router";
import { createSignal, onMount, ParentProps, Show } from "solid-js";
import { bootstrapSession } from "./api/client";
import { clearAuth, currentUser } from "./stores/auth";

export default function App(props: ParentProps) {
  const navigate = useNavigate();
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    const ok = await bootstrapSession();
    if (!ok) {
      navigate("/login");
      return;
    }
    setReady(true);
  });

  function logout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <Show when={ready()} fallback={<div class="main muted">Загрузка…</div>}>
      <div class="layout">
        <nav class="nav">
          <div class="brand">Timesheets</div>
          <A href="/" end>Главная</A>
          <A href="/projects">Проекты</A>
          <A href="/time">Время</A>
          <A href="/time/week">Неделя</A>
          <A href="/reports">Отчёты</A>
          <div class="spacer" />
          <div class="muted">{currentUser()?.email}</div>
          <button class="secondary" onClick={logout}>Выйти</button>
        </nav>
        <main class="main">{props.children}</main>
      </div>
    </Show>
  );
}
