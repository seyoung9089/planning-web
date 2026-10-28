// 날짜를 'YYYY-MM-DD' 글자로 바꿉니다 (한국 시간 기준, toISOString은 UTC라 날짜가 하루 밀릴 수 있어 직접 만듭니다)
export function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 'YYYY-MM-DD'(+ 'HH:MM')를 내 컴퓨터 시간 기준 Date로 바꿉니다
export function fromKeys(dateKey, timeKey = '00:00') {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, min] = timeKey.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// 마감일을 "오늘", "내일", "D-3", "2일 지남"처럼 바로 알아보게 바꿉니다
export function dueLabel(dueDateKey) {
  if (!dueDateKey) return null;
  const today = fromKeys(toDateKey(new Date()));
  const diff = Math.round((fromKeys(dueDateKey) - today) / 86400000);
  if (diff < 0) return { text: `${-diff}일 지남`, tone: 'overdue' };
  if (diff === 0) return { text: '오늘', tone: 'today' };
  if (diff === 1) return { text: '내일', tone: 'soon' };
  if (diff <= 7) return { text: `D-${diff}`, tone: 'soon' };
  const [, m, d] = dueDateKey.split('-').map(Number);
  return { text: `${m}/${d}`, tone: 'later' };
}
