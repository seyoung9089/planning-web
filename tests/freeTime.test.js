import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGaps } from '../src/shared/freeTime.js';

process.env.TZ = 'Asia/Seoul';

const at = (h, m = 0) => new Date(2026, 9, 28, h, m).toISOString();
const ev = (s, e, extra = {}) => ({ start_at: at(...s), end_at: at(...e), all_day: false, ...extra });
const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const show = (gaps) => gaps.map((g) => `${hm(g.start)}-${hm(g.end)}`);

test('일정 사이의 빈 시간을 찾는다', () => {
  const items = [ev([13, 10], [14, 45]), ev([8, 30], [9, 50]), ev([10, 40], [12, 10])];
  assert.deepEqual(show(findGaps(items)), ['09:50-10:40', '12:10-13:10']);
});

test('10분보다 짧은 쉬는 시간은 빼고, 겹치는 일정은 하나로 본다', () => {
  const items = [ev([9, 5], [10, 35]), ev([10, 40], [12, 10]), ev([9, 30], [11, 0]), ev([12, 30], [13, 0])];
  assert.deepEqual(show(findGaps(items)), ['12:10-12:30']);
});

test('긴 일정 안에 들어간 짧은 일정은 빈 시간을 만들지 않는다', () => {
  const items = [ev([13, 0], [18, 0]), ev([14, 0], [15, 0]), ev([18, 30], [19, 0])];
  assert.deepEqual(show(findGaps(items)), ['18:00-18:30']);
});

test('종일 일정은 무시하고, 일정이 하나 이하면 빈 시간이 없다', () => {
  assert.deepEqual(findGaps([ev([0, 0], [0, 0], { all_day: true }), ev([9, 0], [10, 0])]), []);
  assert.deepEqual(findGaps([]), []);
});
