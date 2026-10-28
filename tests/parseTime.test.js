import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime } from '../src/shared/dates.js';

test('흔히 쓰는 시간 모양을 HH:MM으로 바꾼다', () => {
  assert.equal(parseTime('13:05'), '13:05');
  assert.equal(parseTime('1:05'), '01:05');
  assert.equal(parseTime(' 9:30 '), '09:30');
  assert.equal(parseTime('1305'), '13:05');
  assert.equal(parseTime('905'), '09:05');
  assert.equal(parseTime('13'), '13:00');
  assert.equal(parseTime('0:00'), '00:00');
});

test('한국어로 쓴 시간도 알아본다', () => {
  assert.equal(parseTime('13시'), '13:00');
  assert.equal(parseTime('13시 5분'), '13:05');
  assert.equal(parseTime('오후 1:05'), '13:05');
  assert.equal(parseTime('오후 1시 5분'), '13:05');
  assert.equal(parseTime('오전 9시 30분'), '09:30');
  assert.equal(parseTime('오전 12:10'), '00:10');
  assert.equal(parseTime('오후 12시'), '12:00');
});

test('형식이 틀리면 null', () => {
  for (const bad of ['', '   ', 'abc', '25:00', '13:60', '24:00', '1:5:3', '오후 13시', '오전 0시', '12345', '1시간']) {
    assert.equal(parseTime(bad), null, bad);
  }
});
