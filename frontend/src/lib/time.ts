export function minutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toLocalISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toLocalISO(new Date());
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return toLocalISO(new Date(year, month - 1, day + days));
}

export function startOfIsoWeek(date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - mondayOffset);
  return toLocalISO(local);
}

export function weekdayNames(): string[] {
  return ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
}
