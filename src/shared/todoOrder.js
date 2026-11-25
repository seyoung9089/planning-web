import { toDateKey } from './dates.js';

// 할 일이 어느 날의 일인지: 교시(시간)를 정했으면 그날, 아니면 마감일. 둘 다 없으면 null
export function todoDay(t) {
  if (t.scheduled_start) return toDateKey(new Date(t.scheduled_start));
  return t.due_date ?? null;
}

// 할 일 목록 순서:
// ① 안 끝난 할 일 — 날짜 순(기한 지남 → 오늘 → 내일 → 그 뒤 가까운 순), 날짜 없는 것은 맨 뒤
//    같은 날 안에서는 교시(시간)를 정한 것이 빠른 시간 순으로 먼저, 나머지는 서버에서 온 순서 그대로
// ② 끝낸 할 일 — 최근에 끝낸 것부터
export function sortTodos(todos) {
  return todos
    .map((t, i) => ({ t, i, day: todoDay(t) }))
    .sort((a, b) => {
      if (a.t.done !== b.t.done) return a.t.done ? 1 : -1;
      if (a.t.done) return doneTime(b.t) - doneTime(a.t) || a.i - b.i;
      if (a.day !== b.day) {
        if (!a.day) return 1;
        if (!b.day) return -1;
        return a.day < b.day ? -1 : 1;
      }
      const sa = a.t.scheduled_start ? new Date(a.t.scheduled_start).getTime() : null;
      const sb = b.t.scheduled_start ? new Date(b.t.scheduled_start).getTime() : null;
      if (sa !== null && sb !== null && sa !== sb) return sa - sb;
      if ((sa === null) !== (sb === null)) return sa === null ? 1 : -1;
      return a.i - b.i;
    })
    .map(({ t }) => t);
}

const doneTime = (t) => new Date(t.done_at || t.updated_at || t.created_at || 0).getTime() || 0;

// 목록을 세 묶음으로 나눕니다: 기한 지남(안 끝났고 날짜가 오늘보다 앞) / 나머지 안 끝난 것 / 끝낸 것(최근 순)
export function groupTodos(todos, todayKey) {
  const sorted = sortTodos(todos);
  const overdue = [];
  const open = [];
  const done = [];
  for (const t of sorted) {
    if (t.done) done.push(t);
    else if (todoDay(t) && todoDay(t) < todayKey) overdue.push(t);
    else open.push(t);
  }
  return { overdue, open, done };
}

// 오늘 「종일」 칸에 띄울 가장 급한 할 일 n개 (목록 맨 위 순서 그대로, 안 끝난 것만).
// 마감일이 오늘이라 이미 오늘 종일 칸에 나오는 할 일은 같은 칸에 두 번 그리지 않도록 빼고 돌려줍니다
export function topTodosForToday(todos, todayKey, n = 3) {
  return sortTodos(todos)
    .filter((t) => !t.done)
    .slice(0, n)
    .filter((t) => t.scheduled_start || t.due_date !== todayKey);
}
