import { fromKeys, toTimeKey } from './dates.js';

// 우리 학교 하루 시간표. 할 일을 "몇 교시에 할지" 고를 때 씁니다.
// 시간표가 바뀌면 이 목록만 고치면 됩니다.
export const PERIODS = [
  { id: 'am1', label: '아침활동', start: '07:00', end: '07:30', group: '아침' },
  { id: 'am2', label: '아침식사', start: '07:30', end: '08:30', group: '아침' },
  { id: 'am3', label: '아침묵상', start: '08:30', end: '09:00', group: '아침' },
  { id: 'p1', label: '1교시', start: '09:05', end: '09:50', group: '오전' },
  { id: 'p2', label: '2교시', start: '09:50', end: '10:35', group: '오전' },
  { id: 'p3', label: '3교시', start: '10:40', end: '11:25', group: '오전' },
  { id: 'p4', label: '4교시', start: '11:25', end: '12:10', group: '오전' },
  { id: 'lunch', label: '점심', start: '12:10', end: '13:10', group: '점심' },
  { id: 'p5', label: '5교시', start: '13:10', end: '13:55', group: '오후' },
  { id: 'p6', label: '6교시', start: '14:00', end: '14:45', group: '오후' },
  { id: 'p7', label: '7교시', start: '14:50', end: '15:35', group: '오후' },
  { id: 'p8', label: '8교시', start: '15:40', end: '16:25', group: '오후' },
  { id: 'p9', label: '9교시', start: '16:30', end: '17:15', group: '오후', note: '방과후 1' },
  { id: 'p10', label: '10교시', start: '17:20', end: '18:05', group: '오후', note: '방과후 2' },
  { id: 'dinner', label: '저녁식사', start: '18:05', end: '18:55', group: '저녁' },
  { id: 'ev1', label: '저녁활동 1', start: '19:00', end: '20:00', group: '저녁' },
  { id: 'ev2', label: '저녁활동 2', start: '20:00', end: '21:00', group: '저녁' },
];

export const PERIOD_GROUPS = ['아침', '오전', '점심', '오후', '저녁'];

// 날짜(YYYY-MM-DD) + 교시 범위(첫 교시~마지막 교시) → 실제 시작·끝 시각
export function periodRange(dateKey, firstIndex, lastIndex) {
  return {
    startAt: fromKeys(dateKey, PERIODS[firstIndex].start),
    endAt: fromKeys(dateKey, PERIODS[lastIndex].end),
  };
}

// 저장된 시각이 어느 교시 범위와 딱 맞으면 그 인덱스를 돌려줍니다 (패널을 다시 열 때 선택 표시용)
export function findPeriodIndexes(startAt, endAt) {
  const first = PERIODS.findIndex((p) => p.start === toTimeKey(startAt));
  const last = PERIODS.findIndex((p) => p.end === toTimeKey(endAt));
  return first >= 0 && last >= first ? [first, last] : null;
}

// "7교시", "7–8교시", "점심", "저녁활동 1–2", 맞는 교시가 없으면 "15:00–16:00"
export function periodLabel(startAt, endAt) {
  const found = findPeriodIndexes(startAt, endAt);
  if (!found) return `${toTimeKey(startAt)}–${toTimeKey(endAt)}`;
  const [a, b] = found.map((i) => PERIODS[i].label);
  if (a === b) return a;
  // "7교시"+"8교시" → "7–8교시", "저녁활동 1"+"저녁활동 2" → "저녁활동 1–2"
  const re = /^(.*?)(\d+)(교시)?$/;
  const ma = a.match(re);
  const mb = b.match(re);
  if (ma && mb && ma[1] === mb[1] && ma[3] === mb[3]) return `${ma[1]}${ma[2]}–${mb[2]}${ma[3] ?? ''}`;
  return `${a}–${b}`;
}
