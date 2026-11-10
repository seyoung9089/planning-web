import { addDays, toDateKey } from './dates.js';
import { PERIODS, periodRange } from './timetable.js';

// "내일 7시 학원", "금요일 수행평가", "11/3 오후 3시~5시 독서실" 같은 한 줄을 읽어서
// 시간이 있으면 일정, 없으면 마감일이 있는 할 일로 바꿉니다.

const WEEKDAY = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// "한 달", "두 주"처럼 숫자를 한글로 써도 알아봅니다
const COUNT_WORD = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 하루: 1, 이틀: 2, 사흘: 3, 나흘: 4 };
const toCount = (s) => (/^\d+$/.test(s) ? Number(s) : COUNT_WORD[s]);

// n달 뒤 같은 날짜 (1/31의 한 달 뒤처럼 그 날짜가 없으면 그달 마지막 날)
function addMonths(date, n) {
  const first = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last));
}

// 주·달을 기준으로 하는 말: "다음주", "다다음주", "다다다음주", "담주", "이번 달", "다음달", "다다음달",
// "2주 뒤", "일주일 후", "한 달 뒤", "3개월 후", "3일 뒤", "이틀 후"
// 뒤에 요일("다다음주 화", "2달 뒤 화요일")이나 날짜("다음달 5일")가 붙으면 함께 읽습니다
const REL = new RegExp(
  String.raw`(^|\s)(?:(이번|(다{0,2})(?:다음|담))\s?(주|달)|(일주일)\s?(?:뒤|후|있다가)|(\d{1,3}|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|하루|이틀|사흘|나흘)\s?(주일?|주|달|개월|일)?\s?(?:뒤|후|있다가))` +
    String.raw`(?:\s?(?:([일월화수목금토])(?:요일)?|(\d{1,2})일))?(?=\s|$)`,
);

function relativeDate(m, today) {
  const [, , word, extraDa, namedUnit, oneWeek, countText, countUnitRaw, weekday, dayOfMonth] = m;
  let unit; // 'week' | 'month' | 'day'
  let n;
  let calendar = false; // "다음달", "이번 주"처럼 달력 칸(주·달) 단위로 세는지
  if (word) {
    unit = namedUnit === '주' ? 'week' : 'month';
    n = word === '이번' ? 0 : extraDa.length + 1;
    calendar = true;
  } else if (oneWeek) {
    unit = 'week';
    n = 1;
  } else {
    n = toCount(countText);
    const u = countUnitRaw ?? '';
    if (u.startsWith('주')) unit = 'week';
    else if (u === '달' || u === '개월') unit = 'month';
    else if (u === '일' || /^(하루|이틀|사흘|나흘)$/.test(countText)) unit = 'day';
    else return null; // "3 뒤"처럼 단위가 없으면 날짜 말이 아닙니다
    if (/^(하루|이틀|사흘|나흘)$/.test(countText) && u) return null;
  }
  if (!n && n !== 0) return null;
  const target = weekday ? WEEKDAY[weekday] : null;

  if (unit === 'day') {
    if (target !== null || dayOfMonth) return null;
    return addDays(today, n);
  }
  if (unit === 'week') {
    if (dayOfMonth) return null;
    // 요일을 쓰면 그 주(일~토)의 그 요일, 안 쓰면 같은 요일 (이번 주만 쓰면 날짜 말로 보지 않습니다)
    if (target === null) return n === 0 ? null : addDays(today, 7 * n);
    const sunday = addDays(today, 7 * n - today.getDay());
    return addDays(sunday, target);
  }
  // 달: "다음달 5일"은 다음 달 5일, "다음달 화요일"은 다음 달 첫 화요일,
  // "2달 뒤"는 두 달 뒤 같은 날짜, "2달 뒤 화요일"은 그날부터 가장 가까운 화요일
  const base = calendar
    ? n === 0
      ? today
      : new Date(today.getFullYear(), today.getMonth() + n, 1)
    : addMonths(today, n);
  if (dayOfMonth) {
    const d = Number(dayOfMonth);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    if (d < 1 || d > last) return null;
    return new Date(base.getFullYear(), base.getMonth(), d);
  }
  if (target !== null) return addDays(base, (target - base.getDay() + 7) % 7);
  if (calendar) return n === 0 ? null : addMonths(today, n); // "다음달"만 쓰면 다음 달 같은 날짜
  return base;
}

// 날짜 표현을 찾아서 [날짜, 남은 글자]를 돌려줍니다
function takeDate(text, now) {
  const today = startOfDay(now);
  // "다음달 5일", "3일 뒤"가 아래 "5일"·"3일" 규칙에 먼저 잡히지 않도록 가장 먼저 봅니다
  const rel = text.match(REL);
  if (rel) {
    const date = relativeDate(rel, today);
    if (date && !isNaN(date)) return [date, text.replace(rel[0], rel[1] || ' ')];
  }
  const rules = [
    [/(^|\s)오늘(\s|$)/, () => today],
    [/(^|\s)내일(\s|$)/, () => addDays(today, 1)],
    [/(^|\s)모레(\s|$)/, () => addDays(today, 2)],
    [/(^|\s)([일월화수목금토])요일?(\s|$)/, (m) => {
      // 그냥 "금요일"은 오늘 포함 가장 가까운 금요일
      const target = WEEKDAY[m[2]];
      return addDays(today, (target - today.getDay() + 7) % 7);
    }],
    [/(^|\s)(\d{1,2})[/.](\d{1,2})(\s|$)/, (m) => monthDay(today, Number(m[2]), Number(m[3]))],
    [/(^|\s)(\d{1,2})월\s?(\d{1,2})일(\s|$)/, (m) => monthDay(today, Number(m[2]), Number(m[3]))],
    [/(^|\s)(\d{1,2})일(\s|$)/, (m) => {
      // "3일"만 쓰면 이번 달 3일, 이미 지났으면 다음 달 3일
      const d = new Date(today.getFullYear(), today.getMonth(), Number(m[2]));
      return d < today ? new Date(today.getFullYear(), today.getMonth() + 1, Number(m[2])) : d;
    }],
  ];
  // "월요일"의 "월"이 "11월"과 헷갈리지 않도록 월/일 규칙을 먼저 봅니다
  const order = [0, 1, 2, 4, 5, 3, 6];
  for (const i of order) {
    const [re, toDate] = rules[i];
    const m = text.match(re);
    if (m) {
      const date = toDate(m);
      if (date && !isNaN(date)) return [date, text.replace(m[0], ' ')];
    }
  }
  return [null, text];
}

// 올해 날짜가 이미 많이 지났으면 내년으로 봅니다 (12월에 "1/5"라고 쓰는 경우)
function monthDay(today, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(today.getFullYear(), month - 1, day);
  return d < addDays(today, -60) ? new Date(today.getFullYear() + 1, month - 1, day) : d;
}

const TIME = String.raw`(오전|오후|아침|저녁|밤)?\s?(\d{1,2})(?:시\s?(?:(\d{1,2})분|(반))?|:(\d{2}))`;

function toMinutes(m, offset, fallbackMeridiem) {
  const meridiem = m[offset] || fallbackMeridiem;
  let h = Number(m[offset + 1]);
  const min = m[offset + 4] ? Number(m[offset + 4]) : m[offset + 3] ? 30 : Number(m[offset + 2] || 0);
  if (h > 24 || min > 59) return null;
  if (/오후|저녁|밤/.test(meridiem || '') && h < 12) h += 12;
  else if (/오전|아침/.test(meridiem || '') && h === 12) h = 0;
  // 오전/오후를 안 쓰고 1~7시라고 하면 학생 생활상 대부분 오후입니다
  else if (!meridiem && h >= 1 && h <= 7) h += 12;
  return h * 60 + min;
}

function takeTime(text) {
  const range = text.match(new RegExp(TIME + String.raw`\s?(?:~|-|부터)\s?` + TIME + '(?:까지)?'));
  if (range) {
    const start = toMinutes(range, 1, null);
    // "오후 3시~5시"처럼 뒤에 오전/오후가 없으면 앞의 것을 따릅니다
    let end = toMinutes(range, 6, range[1]);
    if (start !== null && end !== null) {
      if (end <= start && end + 720 > start && !range[6]) end += 720;
      return [{ start, end }, text.replace(range[0], ' ')];
    }
  }
  const single = text.match(new RegExp(TIME));
  if (single) {
    const start = toMinutes(single, 1, null);
    if (start !== null) return [{ start, end: start + 60 }, text.replace(single[0], ' ')];
  }
  return [null, text];
}

// "저녁활동 1" → 19:00~20:00, "저녁활동 2" → 20:00~21:00, "저녁활동 1~2"나 그냥 "저녁활동" → 19:00~21:00
// (저녁활동 1·2교시는 우리 학교 시간표 규칙입니다)
const EVENING = /저녁\s?활동\s?(?:([12])(?:\s?(?:~|-|,|·)\s?([12]))?)?\s?(?:교시)?/;
const EV_INDEX = PERIODS.findIndex((p) => p.id === 'ev1');

// 글에 교시(저녁활동 1, 10교시, 3~4교시, 점심)가 있으면 { title, date(글에 쓴 날짜 또는 null), schedule: { startAt, endAt } }를, 없으면 null을 돌려줍니다.
// 날짜를 안 썼으면 오늘, 오늘 그 교시가 이미 끝났으면 내일로 잡습니다.
// 예: "오늘 10교시 수학 숙제", "화요일 10교시 영어", "저녁활동 1 독서"
export function parseEvening(input, now = new Date()) {
  const text = ` ${input.trim()} `;
  const [period, rest] = takePeriod(text);
  if (!period) return null;
  const [date, left] = takeDate(rest, now);
  const title = left.replace(/\s+/g, ' ').trim();
  const range = (day) => periodRange(toDateKey(day), period[0], period[1]);
  let day = date ?? startOfDay(now);
  let schedule = range(day);
  if (!date && schedule.endAt <= now) {
    day = addDays(day, 1);
    schedule = range(day);
  }
  return { title: title || input.trim(), date, schedule };
}
export const parsePeriodTodo = parseEvening;

// "메모 엄마한테 전화", "메모: 준비물 확인"처럼 '메모'로 시작하면 할 일 대신 메모장에 넣을 글을 돌려줍니다.
// '메모'로 시작하지 않거나 뒤에 아무 글도 없으면 null ("메모하기"처럼 붙여 쓴 말은 메모로 보지 않습니다)
export function parseNote(input) {
  const m = String(input ?? '').match(/^\s*메모\s*(?:[:：]\s*|\s+)([\s\S]*\S)/);
  return m ? m[1].trim() : null;
}

export function parseQuick(input, now = new Date()) {
  const weekly = parseWeekly(input, now);
  if (weekly) return { kind: 'weekly', ...weekly };
  let text = ` ${input.trim()} `;
  const [time, afterTime] = takeTime(text);
  text = afterTime;
  // 시간을 직접 쓰지 않고 교시(저녁활동, 10교시 등)를 썼으면 그 교시에 하는 할 일로 만듭니다
  if (!time) {
    const evening = parseEvening(input, now);
    if (evening) return { kind: 'todo', title: evening.title, dueDate: evening.date, schedule: evening.schedule };
  }
  const [date, afterDate] = takeDate(text, now);
  text = afterDate;
  const title = text.replace(/\s+/g, ' ').trim();

  if (time) {
    const day = date ?? startOfDay(now);
    const startAt = new Date(day.getTime() + time.start * 60000);
    const endAt = new Date(day.getTime() + time.end * 60000);
    return { kind: 'event', title: title || '새 일정', startAt, endAt };
  }
  return { kind: 'todo', title: title || input.trim(), dueDate: date };
}

// 할 일 입력 칸용: "금요일 수행평가"의 날짜 말을 마감일로 바꾸고 제목에서 뺍니다. 시간은 보지 않습니다
// { title, date(없으면 null) }
export function parseTodoDate(input, now = new Date()) {
  const [date, rest] = takeDate(` ${input.trim()} `, now);
  const title = rest.replace(/\s+/g, ' ').trim();
  return { title: title || input.trim(), date };
}

// 마감 칸에 쓴 "다음주 화요일", "금", "11/3", "11월 3일 (화)" 같은 날짜 말을 Date로 바꿉니다.
// 날짜 말 말고 다른 글자가 남으면 잘못 쓴 것으로 보고 null
export function parseDueText(input, now = new Date()) {
  let cleaned = String(input ?? '').replace(/\([일월화수목금토]\)/g, ' ').trim();
  if (!cleaned) return null;
  // 마감 칸에서는 "화", "다음주 금"처럼 요일 한 글자만 써도 알아봅니다
  if (/(^|\s|주|달|뒤|후)[일월화수목금토]$/.test(cleaned)) cleaned += '요일';
  const [date, rest] = takeDate(` ${cleaned} `, now);
  return date && !rest.trim() ? date : null;
}

// 마감 칸에 교시까지 쓰면("목 2교시", "3~4교시", "내일 저녁활동 1", "점심") 그 시간에 하는 일정으로 봅니다.
// 돌려주는 값: { date, schedule } — 교시가 없으면 schedule은 null(마감일만), 못 알아보면 null
// 날짜 없이 교시만 쓰면 오늘, 오늘 그 교시가 이미 끝났으면 내일로 잡습니다
const CLASS_PERIOD = /(^|\s)(\d{1,2})\s?(?:(?:~|-|,|·)\s?(\d{1,2})\s?)?교시(?=\s|$)/;
const LUNCH = /(^|\s)점심(?:\s?시간)?(?=\s|$)/;
const DINNER = /(^|\s)저녁\s?시간(?=\s|$)/;
const DINNER_INDEX = PERIODS.findIndex((p) => p.id === 'dinner');
const LUNCH_INDEX = PERIODS.findIndex((p) => p.id === 'lunch');
const periodIndex = (n) => PERIODS.findIndex((p) => p.label === `${n}교시`);

function takePeriod(text) {
  let m = text.match(EVENING);
  if (m) {
    const first = m[1] ? Number(m[1]) : 1;
    const last = m[2] ? Number(m[2]) : m[1] ? first : 2;
    return [[EV_INDEX + Math.min(first, last) - 1, EV_INDEX + Math.max(first, last) - 1], text.replace(m[0], ' ')];
  }
  m = text.match(CLASS_PERIOD);
  if (m) {
    const a = periodIndex(Number(m[2]));
    const b = m[3] ? periodIndex(Number(m[3])) : a;
    if (a < 0 || b < 0) return [false, text];
    return [[Math.min(a, b), Math.max(a, b)], text.replace(m[0], ' ')];
  }
  m = text.match(LUNCH);
  if (m) return [[LUNCH_INDEX, LUNCH_INDEX], text.replace(m[0], ' ')];
  m = text.match(DINNER);
  if (m) return [[DINNER_INDEX, DINNER_INDEX], text.replace(m[0], ' ')];
  return [null, text];
}

export function parseDueInput(input, now = new Date()) {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const [period, rest] = takePeriod(` ${text} `);
  if (period === false) return null; // "13교시"처럼 없는 교시
  if (!period) {
    const date = parseDueText(text, now);
    return date ? { date, schedule: null } : null;
  }
  const dateText = rest.trim();
  let date = dateText ? parseDueText(dateText, now) : null;
  if (dateText && !date) return null;
  const pick = (day) => periodRange(toDateKey(day), period[0], period[1]);
  if (!date) {
    date = startOfDay(now);
    if (pick(date).endAt <= now) date = addDays(date, 1);
  }
  return { date, schedule: pick(date) };
}

// "매주 화요일 점심 독서", "매주 목 10교시 회의", "매주 금 오후 4시 학원"처럼 '매주'를 쓰면
// 첫 번째 날의 일정 { title, startAt, endAt, allDay }을 돌려줍니다 (매주 반복은 저장할 때 쿼터 끝까지 펼칩니다).
// 요일을 안 쓰면 오늘 요일, 시간·교시를 안 쓰면 그 요일 종일 일정. '매주'가 없으면 null
const WEEKLY = /(^|\s)매\s?주\s?(?:([일월화수목금토])(?:요일)?)?(?=\s|$)/;
export function parseWeekly(input, now = new Date()) {
  const text = ` ${String(input ?? '').trim()} `;
  const m = text.match(WEEKLY);
  if (!m) return null;
  const today = startOfDay(now);
  const target = m[2] ? WEEKDAY[m[2]] : today.getDay();
  let day = addDays(today, (target - today.getDay() + 7) % 7);
  let rest = text.replace(m[0], ' ');
  let at;
  const [period, afterPeriod] = takePeriod(rest);
  if (period) {
    rest = afterPeriod;
    at = (d) => ({ ...periodRange(toDateKey(d), period[0], period[1]), allDay: false });
  } else {
    const [time, afterTime] = takeTime(rest);
    if (time) {
      rest = afterTime;
      at = (d) => ({ startAt: new Date(d.getTime() + time.start * 60000), endAt: new Date(d.getTime() + time.end * 60000), allDay: false });
    } else {
      at = (d) => ({ startAt: d, endAt: addDays(d, 1), allDay: true });
    }
  }
  let first = at(day);
  // 오늘 그 시간이 이미 끝났으면 다음 주부터
  if (!first.allDay && first.endAt <= now) first = at(addDays(day, 7));
  const title = rest.replace(/\s+/g, ' ').trim();
  return { title: title || '매주 일정', ...first };
}
