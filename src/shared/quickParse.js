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

// 날짜 표현을 찾아서 [날짜, 남은 글자]를 돌려줍니다
function takeDate(text, now) {
  const today = startOfDay(now);
  const rules = [
    [/(^|\s)오늘(\s|$)/, () => today],
    [/(^|\s)내일(\s|$)/, () => addDays(today, 1)],
    [/(^|\s)모레(\s|$)/, () => addDays(today, 2)],
    [/(^|\s)(?:(이번\s?주|다음\s?주|담주)\s?)?([일월화수목금토])요일?(\s|$)/, (m) => {
      const target = WEEKDAY[m[3]];
      if (m[2]) {
        // "이번 주 금요일"은 이번 주(일~토) 안에서, "다음 주"는 그다음 주
        const sunday = addDays(today, -today.getDay());
        const base = /다음|담/.test(m[2]) ? addDays(sunday, 7) : sunday;
        return addDays(base, target);
      }
      // 그냥 "금요일"은 오늘 포함 가장 가까운 금요일
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

// 글에 저녁활동이 있으면 { title, date(글에 쓴 날짜 또는 null), schedule: { startAt, endAt } }를, 없으면 null을 돌려줍니다.
// 날짜를 안 썼으면 오늘, 오늘 저녁활동이 이미 끝났으면 내일로 잡습니다.
export function parseEvening(input, now = new Date()) {
  const text = ` ${input.trim()} `;
  const m = text.match(EVENING);
  if (!m) return null;
  const first = m[1] ? Number(m[1]) : 1;
  const last = m[2] ? Number(m[2]) : m[1] ? first : 2;
  const [date, rest] = takeDate(text.replace(m[0], ' '), now);
  const title = rest.replace(/\s+/g, ' ').trim();
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  const range = (day) => periodRange(toDateKey(day), EV_INDEX + lo - 1, EV_INDEX + hi - 1);
  let day = date ?? startOfDay(now);
  let schedule = range(day);
  if (!date && schedule.endAt <= now) {
    day = addDays(day, 1);
    schedule = range(day);
  }
  return { title: title || input.trim(), date, schedule };
}

export function parseQuick(input, now = new Date()) {
  let text = ` ${input.trim()} `;
  const [time, afterTime] = takeTime(text);
  text = afterTime;
  // 시간을 직접 쓰지 않고 저녁활동이라고만 썼으면 그 교시에 하는 할 일로 만듭니다
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
