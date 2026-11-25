import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueOccurrence } from '../src/shared/repeat.js';

test('반복 할 일은 오늘 포함 가장 최근 반복 날 하나만 만든다', () => {
  const daily = { weekdays: [0, 1, 2, 3, 4, 5, 6], start_date: '2026-11-25', last_generated: null };
  assert.equal(dueOccurrence(daily, '2026-11-25'), '2026-11-25');
  assert.equal(dueOccurrence({ ...daily, last_generated: '2026-11-25' }, '2026-11-25'), null); // 이미 만듦
  assert.equal(dueOccurrence({ ...daily, last_generated: '2026-11-25' }, '2026-11-28'), '2026-11-28'); // 며칠 안 열어도 오늘 것 하나만
  const monday = { weekdays: [1], start_date: '2026-11-25', last_generated: null }; // 수요일에 등록
  assert.equal(dueOccurrence(monday, '2026-11-25'), null); // 지난 월요일은 등록 전
  assert.equal(dueOccurrence(monday, '2026-11-30'), '2026-11-30');
  assert.equal(dueOccurrence(monday, '2026-12-01'), '2026-11-30'); // 월요일에 안 열었으면 화요일에 월요일 것
  assert.equal(dueOccurrence({ ...monday, last_generated: '2026-11-30' }, '2026-12-01'), null);
});
