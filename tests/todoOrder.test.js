import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTodos, topTodosForToday } from '../src/shared/todoOrder.js';

test('교시를 정한 할 일이 빠른 시간 순으로 맨 앞에 옵니다', () => {
  const todos = [
    { id: 'a', done: false, scheduled_start: null },
    { id: 'b', done: false, scheduled_start: '2026-10-28T10:00:00Z' },
    { id: 'c', done: true, scheduled_start: '2026-10-28T01:00:00Z' },
    { id: 'd', done: false, scheduled_start: '2026-10-28T05:50:00Z' },
    { id: 'e', done: false, scheduled_start: null },
  ];
  assert.deepEqual(sortTodos(todos).map((t) => t.id), ['d', 'b', 'a', 'e', 'c']);
});

test('오늘 종일 칸에는 가장 급한 할 일 3개를 띄우고, 이미 오늘 마감인 것은 겹치지 않게 뺀다', () => {
  const todos = [
    { id: 'a', done: false, due_date: '2026-10-29', scheduled_start: null },
    { id: 'b', done: false, due_date: '2026-11-01', scheduled_start: null },
    { id: 'c', done: true, due_date: '2026-10-30', scheduled_start: null },
    { id: 'd', done: false, due_date: '2026-11-02', scheduled_start: null },
    { id: 'e', done: false, due_date: '2026-11-03', scheduled_start: null },
  ];
  assert.deepEqual(topTodosForToday(todos, '2026-10-29').map((t) => t.id), ['b', 'd']);
  assert.deepEqual(topTodosForToday(todos, '2026-10-28').map((t) => t.id), ['a', 'b', 'd']);
});
