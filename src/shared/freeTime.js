// 시간이 정해진 일정들 사이의 빈 시간을 찾습니다.
// items: [{ start_at, end_at, all_day }], 종일 일정은 건너뜁니다.
// minMinutes보다 짧은 틈(예: 쉬는 시간 5분)은 빼고 [{ start, end }]를 돌려줍니다.
export function findGaps(items, minMinutes = 10) {
  const timed = items
    .filter((it) => !it.all_day)
    .map((it) => ({ start: new Date(it.start_at), end: new Date(it.end_at) }))
    .sort((a, b) => a.start - b.start);
  const gaps = [];
  let cursor = null; // 지금까지 일정이 차 있는 마지막 시각
  for (const { start, end } of timed) {
    if (cursor && start - cursor >= minMinutes * 60000) gaps.push({ start: cursor, end: start });
    if (!cursor || end > cursor) cursor = end;
  }
  return gaps;
}
