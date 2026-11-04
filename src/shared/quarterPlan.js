import { PERIODS } from './timetable.js';
import { fromKeys, toDateKey, toTimeKey, addDays } from './dates.js';

// 쿼터 시간표 창의 줄(교시). 학교 교시 앞에 아침(묵상·예배) 칸을 하나 더 둡니다
export const GRID_ROWS = [{ id: 'morning', label: '아침', start: '08:30', end: '09:00' }, ...PERIODS];

// 창의 칸(요일). getDay() 값: 1=월 … 6=토, 0=일
export const GRID_DAYS = [
  { dow: 1, label: '월' },
  { dow: 2, label: '화' },
  { dow: 3, label: '수' },
  { dow: 4, label: '목' },
  { dow: 5, label: '금' },
  { dow: 6, label: '토' },
  { dow: 0, label: '일' },
];

export const DEFAULT_WEEKS = 9;

// 시작일(YYYY-MM-DD)부터 weeks주. end는 마지막 주의 마지막 날입니다 (월요일 시작이면 9주차 일요일)
export function quarterRange(startKey, weeks = DEFAULT_WEEKS) {
  return { start: startKey, end: toDateKey(addDays(fromKeys(startKey), weeks * 7 - 1)), weeks };
}

// 표 칸 → 수업 덩어리. 같은 요일에 같은 이름이 이어진 교시는 하나로 합칩니다 (3·4교시 → 10:40~12:10)
// cells: { [dow]: { [rowIndex]: '수업 이름' } }
export function blocksFromGrid(cells) {
  const blocks = [];
  for (const { dow } of GRID_DAYS) {
    const col = cells[dow] || {};
    let i = 0;
    while (i < GRID_ROWS.length) {
      const title = (col[i] || '').trim();
      if (!title) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < GRID_ROWS.length && (col[j + 1] || '').trim() === title) j++;
      blocks.push({ dow, start: GRID_ROWS[i].start, end: GRID_ROWS[j].end, title });
      i = j + 1;
    }
  }
  return blocks;
}

const keyOf = (t) => `${t.dow}|${t.start}|${t.end}|${t.title}`;

// 저장된 수업 일정(events 행)을 요일·시간·이름별로 묶습니다. 몇 주 있었는지(count)도 셉니다
export function groupTimetable(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.all_day) continue;
    const s = new Date(row.start_at);
    const e = new Date(row.end_at);
    if (toDateKey(s) !== toDateKey(e) && toTimeKey(e) !== '00:00') continue; // 여러 날에 걸친 일정은 빼고
    const t = { dow: s.getDay(), start: toTimeKey(s), end: toTimeKey(e), title: row.title };
    const k = keyOf(t);
    const g = groups.get(k) || { ...t, color: row.color, count: 0, ids: [] };
    g.count++;
    g.ids.push(row.id);
    groups.set(k, g);
  }
  return [...groups.values()];
}

// 지난 수업 일정으로 표를 미리 채웁니다. 2주 이상 반복된 것만 쓰고, 칸이 겹치면 더 자주 있던 수업이 이깁니다.
// 교시 칸에 딱 맞지 않는 반복 수업은 extras로 따로 돌려줍니다
export function gridFromEvents(rows) {
  const cells = {};
  const colors = {};
  const extras = [];
  const groups = groupTimetable(rows)
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count);
  for (const g of groups) {
    const first = GRID_ROWS.findIndex((r) => r.start === g.start);
    const last = GRID_ROWS.findIndex((r, i) => i >= first && r.end === g.end);
    const col = (cells[g.dow] ||= {});
    if (first < 0 || last < 0) {
      extras.push({ dow: g.dow, start: g.start, end: g.end, title: g.title, color: g.color });
    } else {
      let free = true;
      for (let i = first; i <= last; i++) if (col[i]) free = false;
      if (!free) continue;
      for (let i = first; i <= last; i++) col[i] = g.title;
    }
    if (g.color && !colors[g.title]) colors[g.title] = g.color;
  }
  return { cells, colors, extras };
}

// 수업 틀(요일·시간)을 쿼터 기간 동안 매주 일정으로 펼칩니다
export function expandTemplates(templates, range) {
  const from = fromKeys(range.start);
  const list = [];
  for (const t of templates) {
    let day = addDays(from, (t.dow - from.getDay() + 7) % 7);
    while (toDateKey(day) <= range.end) {
      const key = toDateKey(day);
      const startAt = fromKeys(key, t.start);
      let endAt = fromKeys(key, t.end);
      if (endAt <= startAt) endAt = addDays(endAt, 1); // 자정을 넘기는 경우
      list.push({ title: t.title, startAt, endAt, color: t.color, allDay: false, memo: null, isTimetable: true });
      day = addDays(day, 7);
    }
  }
  return list.sort((a, b) => a.startAt - b.startAt);
}

// 새 기간 안에서 지울 기존 수업: 매주 반복되던 것(2주 이상) + 새로 넣을 것과 똑같은 한 번짜리.
// 한 번만 있는 일정(멘토링 같은)은 그대로 둡니다
export function rowsToReplace(existingRows, newEvents) {
  const newKeys = new Set(newEvents.map((e) => `${e.title}|${e.startAt.getTime()}`));
  const ids = [];
  for (const g of groupTimetable(existingRows)) {
    if (g.count >= 2) ids.push(...g.ids);
  }
  for (const row of existingRows) {
    if (newKeys.has(`${row.title}|${new Date(row.start_at).getTime()}`) && !ids.includes(row.id)) ids.push(row.id);
  }
  return ids;
}
