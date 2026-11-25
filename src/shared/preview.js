// 입력 칸 아래에 "→ 11/27(목) 2교시 · 일정"처럼 어떻게 저장될지 미리 보여 주는 글.
// 사이트 할 일 칸과 확장 사이드 패널이 같은 글을 씁니다
import { parseQuick, parseNote, repeatLabel } from './quickParse.js';
import { periodLabel } from './timetable.js';
import { toDateKey, addDays } from './dates.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function dayName(date, now = new Date()) {
  const base = `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
  const key = toDateKey(date);
  if (key === toDateKey(now)) return `오늘 ${base}`;
  if (key === toDateKey(addDays(now, 1))) return `내일 ${base}`;
  return base;
}

// 돌려주는 값: { kind: 'note' | 'event' | 'todo' | 'repeat', text, needsDue }
// needsDue가 true면 Enter를 눌렀을 때 마감일 팝업이 뜹니다
export function previewOf(input, now = new Date()) {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const note = parseNote(text);
  if (note) return { kind: 'note', text: `📝 메모 · ${note}`, needsDue: false };
  const parsed = parseQuick(text, now);
  if (parsed.kind === 'repeatTodo') {
    return { kind: 'repeat', text: `↻ 반복 할 일 · ${repeatLabel(parsed.weekdays)} · ${parsed.title}`, needsDue: false };
  }
  if (parsed.kind === 'weekly') {
    return { kind: 'repeat', text: `🔁 ${repeatLabel(parsed.weekdays)} ${periodLabel(parsed.startAt, parsed.endAt)} · ${parsed.title} (쿼터 끝까지)`, needsDue: false };
  }
  if (parsed.kind === 'event') {
    const where = parsed.location ? ` · 📍 ${parsed.location}` : '';
    return { kind: 'event', text: `📅 일정 · ${dayName(parsed.startAt, now)} ${hm(parsed.startAt)}–${hm(parsed.endAt)} · ${parsed.title}${where}`, needsDue: false };
  }
  if (parsed.schedule) {
    return {
      kind: 'todo',
      text: `☑ 할 일 · ${dayName(parsed.schedule.startAt, now)} ${periodLabel(parsed.schedule.startAt, parsed.schedule.endAt)} · ${parsed.title}`,
      needsDue: false,
    };
  }
  if (parsed.dueDate) return { kind: 'todo', text: `☑ 할 일 · 마감 ${dayName(parsed.dueDate, now)} · ${parsed.title}`, needsDue: false };
  return { kind: 'todo', text: `☑ 할 일 · ${parsed.title} · Enter 누르면 마감일 입력`, needsDue: true };
}

export const EMPTY_HINT =
  '시간을 쓰면 일정, 안 쓰면 할 일이 돼요. 「화요일 10교시」, 「매일 영어 단어」처럼 써도 돼요. Enter로 추가';
