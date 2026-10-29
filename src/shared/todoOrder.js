// 할 일 목록 순서:
// ① 교시(시간)를 정한 안 끝난 할 일 — 빠른 시간 순
// ② 나머지 안 끝난 할 일 — 서버에서 온 순서(마감일 순) 그대로
// ③ 끝낸 할 일
export function sortTodos(todos) {
  const group = (t) => (t.done ? 2 : t.scheduled_start ? 0 : 1);
  return todos
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const g = group(a.t) - group(b.t);
      if (g) return g;
      if (group(a.t) === 0) {
        const d = new Date(a.t.scheduled_start) - new Date(b.t.scheduled_start);
        if (d) return d;
      }
      return a.i - b.i;
    })
    .map(({ t }) => t);
}

// 오늘 「종일」 칸에 띄울 가장 급한 할 일 n개 (목록 맨 위 순서 그대로, 안 끝난 것만).
// 마감일이 오늘이라 이미 오늘 종일 칸에 나오는 할 일은 같은 칸에 두 번 그리지 않도록 빼고 돌려줍니다
export function topTodosForToday(todos, todayKey, n = 3) {
  return sortTodos(todos)
    .filter((t) => !t.done)
    .slice(0, n)
    .filter((t) => t.scheduled_start || t.due_date !== todayKey);
}
