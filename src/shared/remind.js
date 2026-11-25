// 일정 알림 기본값: 10분 전. events.remind_minutes가 null이면 이 값을 씁니다 (0이면 알리지 않습니다)
export const DEFAULT_REMIND_MIN = 10;

export function remindMinutes(row) {
  const v = row?.remind_minutes;
  return v === null || v === undefined ? DEFAULT_REMIND_MIN : v;
}
