import { A, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, onMount, ParentProps, Show } from "solid-js";
import { bootstrapSession } from "./api/client";
import { clearAuth, currentUser } from "./stores/auth";

export default function App(props: ParentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);

  onMount(async () => {
    const ok = await bootstrapSession();
    if (!ok) {
      navigate("/login");
      return;
    }
    setReady(true);
  });

  createEffect(() => {
    location.pathname;
    setMenuOpen(false);
  });

  createEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen());
  });
  onCleanup(() => document.body.classList.remove("menu-open"));

  function logout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <Show when={ready()} fallback={<div class="main muted">Загрузка…</div>}>
      <div class="layout" classList={{ "menu-open": menuOpen() }}>
        <header class="topbar">
          <button
            class="menu-toggle"
            type="button"
            aria-label="Меню"
            aria-expanded={menuOpen()}
            onClick={() => setMenuOpen(!menuOpen())}
          >
            <span />
            <span />
            <span />
          </button>
          <div class="brand">Timesheets</div>
        </header>
        <button
          class="nav-backdrop"
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
        <nav class="nav" onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
        }}>
          <div class="nav-head">
            <div class="brand">Timesheets</div>
            <button
              class="menu-close secondary"
              type="button"
              aria-label="Закрыть"
              onClick={() => setMenuOpen(false)}
            >
              ✕
            </button>
          </div>
          <A href="/" end>
            Главная
          </A>
          <A href="/projects">Проекты</A>
          <A href="/time">Учёт</A>
          <A href="/time/week">Неделя</A>
          <A href="/reports">Отчёты</A>
          <div class="spacer" />
          <div class="muted nav-user">{currentUser()?.email}</div>
          <button class="secondary" onClick={logout}>
            Выйти
          </button>
        </nav>
        <main class="main">{props.children}</main>
      </div>
    </Show>
  );
}
