import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Asia/Seoul';
const { PERIODS, periodRange, periodLabel, findPeriodIndexes, busyByPeriod, weeklyRepeats } = await import('../src/shared/timetable.js');

const idx = (label) => PERIODS.findIndex((p) => p.label === label);

test('7교시 하나', () => {
  const { startAt, endAt } = periodRange('2026-10-28', idx('7교시'), idx('7교시'));
  assert.equal(startAt.getHours() * 60 + startAt.getMinutes(), 14 * 60 + 50);
  assert.equal(periodLabel(startAt, endAt), '7교시');
});

test('7~8교시 연속', () => {
  const { startAt, endAt } = periodRange('2026-10-28', idx('7교시'), idx('8교시'));
  assert.equal(periodLabel(startAt, endAt), '7–8교시');
  assert.deepEqual(findPeriodIndexes(startAt, endAt), [idx('7교시'), idx('8교시')]);
});

test('저녁활동 1~2', () => {
  const { startAt, endAt } = periodRange('2026-10-28', idx('저녁활동 1'), idx('저녁활동 2'));
  assert.equal(periodLabel(startAt, endAt), '저녁활동 1–2');
});

test('점심~5교시', () => {
  const { startAt, endAt } = periodRange('2026-10-28', idx('점심'), idx('5교시'));
  assert.equal(periodLabel(startAt, endAt), '점심–5교시');
});

test('교시와 안 맞는 시간은 시각으로', () => {
  assert.equal(periodLabel(new Date(2026, 9, 28, 15, 0), new Date(2026, 9, 28, 16, 0)), '15:00–16:00');
});

test('겹치는 일정이 있는 교시만 바쁨으로 표시', () => {
  const busy = busyByPeriod('2026-10-28', [
    { title: '정보 수업', start: new Date(2026, 9, 28, 13, 10), end: new Date(2026, 9, 28, 15, 0) },
    { title: '다른 날 일정', start: new Date(2026, 9, 29, 9, 0), end: new Date(2026, 9, 29, 10, 0) },
  ]);
  assert.deepEqual(busy[idx('5교시')], ['정보 수업']);
  assert.deepEqual(busy[idx('6교시')], ['정보 수업']);
  // 15:00에 끝나므로 7교시(14:50~)와도 겹칩니다
  assert.deepEqual(busy[idx('7교시')], ['정보 수업']);
  assert.deepEqual(busy[idx('8교시')], []);
  assert.deepEqual(busy[idx('1교시')], []);
});

test('끝나는 시각이 교시 시작과 같으면 겹치지 않음', () => {
  const busy = busyByPeriod('2026-10-28', [
    { title: '자습', start: new Date(2026, 9, 28, 9, 5), end: new Date(2026, 9, 28, 9, 50) },
  ]);
  assert.deepEqual(busy[idx('1교시')], ['자습']);
  assert.deepEqual(busy[idx('2교시')], []);
});

test('수업을 쿼터 동안 매주 같은 요일·시간으로 반복한다 (원래 주는 뺌)', () => {
  const start = new Date(2026, 10, 2, 19, 0); // 11/2(월) 19:00
  const end = new Date(2026, 10, 2, 21, 0);
  const list = weeklyRepeats(start, end, { start: '2026-10-19', end: '2026-12-18' });
  const days = list.map((r) => `${r.startAt.getMonth() + 1}/${r.startAt.getDate()} ${r.startAt.getHours()}-${r.endAt.getHours()}`);
  assert.deepEqual(days, ['10/19 19-21', '10/26 19-21', '11/9 19-21', '11/16 19-21', '11/23 19-21', '11/30 19-21', '12/7 19-21', '12/14 19-21']);
});

test('weeklyRepeats는 긴 쿼터(20주)도 끝까지 펼친다', async () => {
  const { weeklyRepeats } = await import('../src/shared/timetable.js');
  const s = new Date(2026, 0, 5, 9, 0);
  const list = weeklyRepeats(s, new Date(2026, 0, 5, 10, 0), { start: '2026-01-05', end: '2026-05-24' });
  assert.equal(list.length, 19);
});
