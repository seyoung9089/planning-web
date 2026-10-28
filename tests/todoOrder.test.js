import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortTodos } from '../src/shared/todoOrder.js';

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
