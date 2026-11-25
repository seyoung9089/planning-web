import { addDays, fromKeys, toDateKey } from './dates.js';

// 반복 할 일 규칙 { weekdays, start_date, last_generated }에서 지금 만들어야 할 날짜('YYYY-MM-DD')를 고릅니다.
// 오늘을 포함해 가장 최근의 반복 날짜 하나만 봅니다 (며칠 동안 안 열었어도 밀린 할 일이 한꺼번에 쌓이지 않게).
// 그날이 시작일보다 앞이거나 이미 만든 날이면 null
export function dueOccurrence(rule, todayKey) {
  const today = fromKeys(todayKey);
  for (let back = 0; back < 7; back++) {
    const day = addDays(today, -back);
    if (!rule.weekdays.includes(day.getDay())) continue;
    const key = toDateKey(day);
    if (key < rule.start_date) return null;
    if (rule.last_generated && key <= rule.last_generated) return null;
    return key;
  }
  return null;
}
