-- 일정에 장소와 알림 시간을 따로 저장합니다 (2026-11-25, planning-web 프로젝트에 적용함)
-- location: 장소 (없으면 null)
-- remind_minutes: 몇 분 전에 알릴지. null = 기본(10분), 0 = 알림 없음
-- 기존 일정은 바꾸지 않습니다 (둘 다 null로 남음). RLS 정책(본인 행만)은 표 단위라 새 칸에도 그대로 적용됩니다.
alter table public.events
  add column if not exists location text check (location is null or char_length(location) <= 200),
  add column if not exists remind_minutes integer check (remind_minutes is null or (remind_minutes >= 0 and remind_minutes <= 1440));
