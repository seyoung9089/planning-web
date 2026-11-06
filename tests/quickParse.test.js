import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick, parseTodoDate, parseDueText } from '../src/shared/quickParse.js';

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

test('할 일 칸: 요일·날짜는 마감일로 바꾸고 제목에서 뺀다', () => {
  let r = parseTodoDate('금요일 수행평가', now);
  assert.equal(r.title, '수행평가');
  assert.equal(day(r.date), '10/30');
  r = parseTodoDate('영어 단어 다음주 월요일', now);
  assert.equal(r.title, '영어 단어');
  assert.equal(day(r.date), '11/2');
  r = parseTodoDate('11/3 독후감', now);
  assert.equal(r.title, '독후감');
  assert.equal(day(r.date), '11/3');
  r = parseTodoDate('수학 숙제', now);
  assert.equal(r.title, '수학 숙제');
  assert.equal(r.date, null);
});

test('마감 칸: 날짜 말만 알아보고, 다른 글자가 섞이면 null', () => {
  // 기준: 2026-10-29 (목)
  const thu = new Date(2026, 9, 29, 9, 0);
  assert.equal(day(parseDueText('다음주 화요일', thu)), '11/3');
  assert.equal(day(parseDueText('다음 주 화', thu)), '11/3');
  assert.equal(day(parseDueText('금', thu)), '10/30');
  assert.equal(day(parseDueText('내일', thu)), '10/30');
  assert.equal(day(parseDueText('11/3', thu)), '11/3');
  assert.equal(day(parseDueText('11월 3일 (화)', thu)), '11/3');
  assert.equal(parseDueText('', thu), null);
  assert.equal(parseDueText('다음주쯤', thu), null);
  assert.equal(parseDueText('화요일 수행평가', thu), null);
});

test('마감 칸: 요일·날짜는 마감일, 교시를 쓰면 그 시간 일정', async () => {
  const { parseDueInput } = await import('../src/shared/quickParse.js');
  const now = new Date(2026, 10, 4, 13, 0); // 11/4(수) 오후 1시
  const hm = (d) => `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const show = (r) => r && (r.schedule ? `${hm(r.schedule.startAt)}-${hm(r.schedule.endAt).slice(-5)}` : `마감 ${r.date.getMonth() + 1}/${r.date.getDate()}`);
  assert.equal(show(parseDueInput('금', now)), '마감 11/6');
  assert.equal(show(parseDueInput('다음주 화', now)), '마감 11/10');
  assert.equal(show(parseDueInput('목 2교시', now)), '11/5 09:50-10:35');
  assert.equal(show(parseDueInput('목요일 3~4교시', now)), '11/5 10:40-12:10');
  assert.equal(show(parseDueInput('11/6 3-4교시', now)), '11/6 10:40-12:10');
  assert.equal(show(parseDueInput('저녁활동 2', now)), '11/4 20:00-21:00');
  assert.equal(show(parseDueInput('내일 저녁활동', now)), '11/5 19:00-21:00');
  assert.equal(show(parseDueInput('7교시', now)), '11/4 14:50-15:35');
  assert.equal(show(parseDueInput('2교시', now)), '11/5 09:50-10:35'); // 오늘 2교시는 지남 → 내일
  assert.equal(show(parseDueInput('점심', now)), '11/4 12:10-13:10'); // 13:10에 끝나서 아직 오늘
  for (const bad of ['13교시', '목 2교시 숙제', '아무거나', '']) assert.equal(parseDueInput(bad, now), null, bad);
});

test('할 일 칸: "오늘 10교시", "화요일 10교시"는 그 시간 일정, 요일만 쓰면 마감일', async () => {
  const { parseEvening, parseTodoDate, parseQuick } = await import('../src/shared/quickParse.js');
  const now = new Date(2026, 10, 4, 13, 0); // 11/4(수) 오후 1시
  const hm = (d) => `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let r = parseEvening('오늘 10교시 수학 숙제', now);
  assert.equal(r.title, '수학 숙제');
  assert.equal(`${hm(r.schedule.startAt)}-${hm(r.schedule.endAt)}`, '11/4 17:20-11/4 18:05');
  r = parseEvening('화요일 10교시 영어', now);
  assert.equal(r.title, '영어');
  assert.equal(hm(r.schedule.startAt), '11/10 17:20');
  r = parseEvening('3~4교시 발표 준비', now); // 오늘 3~4교시는 지남 → 내일
  assert.equal(hm(r.schedule.startAt), '11/5 10:40');
  assert.equal(parseEvening('화요일 수행평가', now), null);
  assert.equal(parseTodoDate('화요일 수행평가', now).date.getDate(), 10);
  const q = parseQuick('목요일 10교시 독서', now);
  assert.equal(q.kind, 'todo');
  assert.equal(hm(q.schedule.startAt), '11/5 17:20');
});

test('점심시간·저녁시간도 그 시간 일정으로', async () => {
  const { parseEvening, parseQuick, parseDueInput } = await import('../src/shared/quickParse.js');
  const now = new Date(2026, 10, 4, 9, 0); // 11/4(수) 오전 9시
  const hm = (d) => `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let r = parseEvening('점심시간 단어 외우기', now);
  assert.equal(r.title, '단어 외우기');
  assert.equal(`${hm(r.schedule.startAt)}-${hm(r.schedule.endAt)}`, '11/4 12:10-11/4 13:10');
  r = parseEvening('내일 저녁시간 독서', now);
  assert.equal(r.title, '독서');
  assert.equal(`${hm(r.schedule.startAt)}-${hm(r.schedule.endAt)}`, '11/5 18:10-11/5 18:55');
  assert.equal(hm(parseQuick('금요일 저녁 시간 회의', now).schedule.startAt), '11/6 18:10');
  assert.equal(parseQuick('저녁 7시 학원', now).kind, 'event'); // "저녁 7시"는 그대로 시각
  assert.equal(hm(parseDueInput('목 저녁시간', now).schedule.startAt), '11/5 18:10');
});

test('매주: "매주 화요일 점심"은 첫 화요일 점심 일정, 반복은 저장할 때 펼침', async () => {
  const { parseWeekly, parseQuick } = await import('../src/shared/quickParse.js');
  const now = new Date(2026, 10, 4, 15, 0); // 11/4(수) 오후 3시
  const hm = (d) => `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let r = parseWeekly('매주 화요일 점심 독서', now);
  assert.equal(r.title, '독서');
  assert.equal(`${hm(r.startAt)}-${hm(r.endAt)}`, '11/10 12:10-11/10 13:10');
  assert.equal(r.allDay, false);
  r = parseWeekly('매주 수 점심 회의', now); // 오늘 점심은 지남 → 다음 주
  assert.equal(hm(r.startAt), '11/11 12:10');
  r = parseWeekly('매주 목 10교시 동아리', now);
  assert.equal(hm(r.startAt), '11/5 17:20');
  r = parseWeekly('매주 금요일 오후 4시 학원', now);
  assert.equal(`${hm(r.startAt)}-${hm(r.endAt)}`, '11/6 16:00-11/6 17:00');
  r = parseWeekly('매주 월요일 단어시험', now);
  assert.equal(r.allDay, true);
  assert.equal(hm(r.startAt), '11/9 00:00');
  r = parseWeekly('매주 화학 공부', now); // "화학"의 화는 요일이 아님 → 오늘 요일
  assert.equal(r.title, '화학 공부');
  assert.equal(r.startAt.getDay(), 3);
  assert.equal(parseWeekly('화요일 점심 독서', now), null);
  assert.equal(parseQuick('매주 화요일 점심 독서', now).kind, 'weekly');
});

test('다다음주·다음달·N달 뒤 같은 말도 날짜로 알아본다', () => {
  const fri = new Date(2026, 10, 6, 9, 0); // 11/6(금)
  const due = (s) => {
    const d = parseDueText(s, fri);
    return d ? day(d) : null;
  };
  const cases = {
    '다음주 화': '11/10',
    '다다음주 화': '11/17',
    '다다다음주 화요일': '11/24',
    '담주 월': '11/9',
    '다음주': '11/13',
    '다다음주': '11/20',
    '다다다음주': '11/27',
    '이번 주 토': '11/7',
    '2주 뒤': '11/20',
    '3주 후': '11/27',
    '일주일 뒤': '11/13',
    '2주 뒤 수요일': '11/18',
    '다음달': '12/6',
    '다음 달 5일': '12/5',
    '다다음달': '1/6',
    '다음달 화요일': '12/1',
    '이번 달 30일': '11/30',
    '2달 뒤': '1/6',
    '2달 후': '1/6',
    '한 달 뒤': '12/6',
    '3개월 후': '2/6',
    '2달 뒤 화요일': '1/12',
    '2달 뒤 화': '1/12',
    '3일 뒤': '11/9',
    '이틀 후': '11/8',
    '10일 후': '11/16',
  };
  for (const [input, want] of Object.entries(cases)) assert.equal(due(input), want, input);
  for (const bad of ['다음주쯤', '이번 달 31일', '이번 주', '3 뒤', '한 달']) assert.equal(due(bad), null, bad);
  // 1/31의 한 달 뒤는 2월 마지막 날
  assert.equal(day(parseDueText('한 달 뒤', new Date(2027, 0, 31))), '2/28');
});

test('할 일 칸·빠른 입력에서도 새 날짜 말을 제목과 나눈다', async () => {
  const { parseEvening } = await import('../src/shared/quickParse.js');
  const fri = new Date(2026, 10, 6, 9, 0);
  let r = parseTodoDate('다다음주 금요일 수행평가', fri);
  assert.equal(r.title, '수행평가');
  assert.equal(day(r.date), '11/20');
  r = parseTodoDate('독후감 다음달 5일', fri);
  assert.equal(r.title, '독후감');
  assert.equal(day(r.date), '12/5');
  r = parseTodoDate('2달 뒤 화요일 모의고사', fri);
  assert.equal(r.title, '모의고사');
  assert.equal(day(r.date), '1/12');
  const q = parseQuick('3일 뒤 오후 4시 병원', fri);
  assert.equal(q.kind, 'event');
  assert.equal(`${q.title} ${day(q.startAt)} ${hm(q.startAt)}`, '병원 11/9 16:00');
  const e = parseEvening('다다음주 화 10교시 영어', fri);
  assert.equal(e.title, '영어');
  assert.equal(`${day(e.schedule.startAt)} ${hm(e.schedule.startAt)}`, '11/17 17:20');
  // 일정 일찍처럼 '일'로 시작하는 글자는 요일로 보지 않습니다
  r = parseTodoDate('다음주 일찍 가기', fri);
  assert.equal(r.title, '일찍 가기');
  assert.equal(day(r.date), '11/13');
});
