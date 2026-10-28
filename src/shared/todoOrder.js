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
