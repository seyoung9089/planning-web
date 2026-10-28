import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Asia/Seoul';
const { PERIODS, periodRange, periodLabel, findPeriodIndexes } = await import('../src/shared/timetable.js');

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
