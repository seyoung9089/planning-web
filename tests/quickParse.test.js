import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick } from '../src/shared/quickParse.js';

// 어느 컴퓨터에서 돌려도 같은 결과가 나오도록 한국 시간으로 고정합니다
process.env.TZ = 'Asia/Seoul';

// 기준 시각: 2026-10-28 (수) 14:10
const now = new Date(2026, 9, 28, 14, 10);
const day = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function summary(input) {
  const r = parseQuick(input, now);
  if (r.kind === 'event') return `일정 ${r.title} ${day(r.startAt)} ${hm(r.startAt)}-${hm(r.endAt)}`;
  return `할일 ${r.title} ${r.dueDate ? day(r.dueDate) : '-'}`;
}

const cases = {
  '내일 7시 학원': '일정 학원 10/29 19:00-20:00',
  '오늘 오후 3시~5시 독서실': '일정 독서실 10/28 15:00-17:00',
  '저녁 8시부터 10시까지 독서실': '일정 독서실 10/28 20:00-22:00',
  '11/3 오전 9시 반 병원': '일정 병원 11/3 09:30-10:30',
  '10시 30분 동아리': '일정 동아리 10/28 10:30-11:30',
  '수요일 6:30 학원': '일정 학원 10/28 18:30-19:30',
  '금요일 수행평가': '할일 수행평가 10/30',
  '다음주 월요일 영어 단어': '할일 영어 단어 11/2',
  '월요일 과제': '할일 과제 11/2',
  '11월 5일 수학 시험': '할일 수학 시험 11/5',
  '3일 체육대회': '할일 체육대회 11/3',
  '수학 문제집 3쪽': '할일 수학 문제집 3쪽 -',
  '책 반납': '할일 책 반납 -',
};

for (const [input, want] of Object.entries(cases)) {
  test(input, () => assert.equal(summary(input), want));
}

// 저녁활동: 시간을 직접 쓰지 않아도 학교 규칙대로 시간이 정해집니다
const eveningSummary = (input, at = now) => {
  const r = parseQuick(input, at);
  const sc = r.schedule;
  return `${r.kind} ${r.title} ${sc ? `${day(sc.startAt)} ${hm(sc.startAt)}-${hm(sc.endAt)}` : '-'}`;
};

test('저녁활동 1', () => assert.equal(eveningSummary('저녁활동 1 수학 숙제'), 'todo 수학 숙제 10/28 19:00-20:00'));
test('저녁활동 2교시', () => assert.equal(eveningSummary('저녁활동 2교시 영어'), 'todo 영어 10/28 20:00-21:00'));
test('저녁활동 1~2', () => assert.equal(eveningSummary('저녁활동 1~2 독서'), 'todo 독서 10/28 19:00-21:00'));
test('그냥 저녁활동', () => assert.equal(eveningSummary('저녁활동 과학 보고서'), 'todo 과학 보고서 10/28 19:00-21:00'));
test('내일 저녁활동 2', () => assert.equal(eveningSummary('내일 저녁활동 2 수행평가'), 'todo 수행평가 10/29 20:00-21:00'));
test('오늘 저녁활동이 이미 끝났으면 내일로', () =>
  assert.equal(eveningSummary('저녁활동 1 숙제', new Date(2026, 9, 28, 21, 30)), 'todo 숙제 10/29 19:00-20:00'));
test('저녁 8시처럼 시간을 직접 쓰면 일정', () => assert.equal(summary('저녁 8시 저녁활동 독서'), '일정 저녁활동 독서 10/28 20:00-21:00'));
