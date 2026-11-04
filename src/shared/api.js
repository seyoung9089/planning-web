import { supabase } from './supabase.js';
export { RECOVERY_IN_URL, URL_AUTH_ERROR } from './supabase.js';
import { toDateKey } from './dates.js';
import { QUARTER, weeklyRepeats } from './timetable.js';
import { quarterRange, DEFAULT_WEEKS } from './quarterPlan.js';

// ---- 로그인 ----

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// 인증 메일의 링크를 누르면 돌아올 주소 (확장에서 가입해도 사이트로 오게 고정)
const SITE_URL = 'https://planning-web.pages.dev/';

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: SITE_URL },
  });
  if (error) throw error;
  // 이미 가입된 이메일이면 Supabase는 오류 대신 빈 identities를 돌려줍니다
  if (data.user && data.user.identities?.length === 0) {
    throw Object.assign(new Error('이미 가입된 이메일'), { code: 'user_already_exists' });
  }
  // 이메일 인증이 켜져 있으면 session이 비어 있습니다
  return { needsConfirm: !data.session };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// 비밀번호를 잊었을 때: 재설정 메일을 보냅니다. 메일 링크를 누르면 사이트의 「새 비밀번호 정하기」 화면이 뜹니다
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
  if (error) throw error;
}

// 로그인된 상태(재설정 링크로 들어온 상태 포함)에서 비밀번호를 바꿉니다
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// callback(session, event): event가 'PASSWORD_RECOVERY'면 재설정 링크로 들어온 것입니다
export function onAuthChange(callback) {
  supabase.auth.getSession().then(({ data }) => callback(data.session, 'INITIAL'));
  supabase.auth.onAuthStateChange((event, session) => callback(session, event));
}

// ---- 할 일 ----

export async function listTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('done')
    .order('due_date', { nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// schedule: { startAt, endAt }를 주면 처음부터 그 시간(교시)에 하기로 정해 저장합니다
// 날짜를 안 정한 할 일은 오늘 날짜로 넣어서 캘린더의 오늘 「종일」 칸에 보이게 합니다
export async function addTodo(title, dueDate = null, schedule = null) {
  const row = { title, due_date: dueDate ?? (schedule ? toDateKey(schedule.startAt) : toDateKey(new Date())) };
  if (schedule) {
    row.scheduled_start = schedule.startAt.toISOString();
    row.scheduled_end = schedule.endAt.toISOString();
  }
  const { error } = await supabase.from('todos').insert(row);
  if (error) throw error;
}

export async function setTodoDone(id, done) {
  const { error } = await supabase
    .from('todos')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function setTodoDueDate(id, dueDate) {
  const { error } = await supabase.from('todos').update({ due_date: dueDate }).eq('id', id);
  if (error) throw error;
}

// 할 일을 언제 할지(시작·끝 시각) 정합니다. null을 넘기면 지웁니다
export async function setTodoSchedule(id, startAt, endAt) {
  const { error } = await supabase
    .from('todos')
    .update({ scheduled_start: startAt?.toISOString() ?? null, scheduled_end: endAt?.toISOString() ?? null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTodo(id) {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
}

// ---- 일정 ----

export async function listEventsBetween(from, to) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .lt('start_at', to.toISOString())
    .gt('end_at', from.toISOString())
    .order('start_at');
  if (error) throw error;
  return data;
}

// 화면에서 쓰는 이름(startAt 등)을 데이터베이스 칸 이름(start_at 등)으로 바꿉니다
function toEventRow({ title, startAt, endAt, allDay, color, memo, isTimetable }) {
  const row = {};
  if (title !== undefined) row.title = title;
  if (startAt !== undefined) row.start_at = startAt.toISOString();
  if (endAt !== undefined) row.end_at = endAt.toISOString();
  if (allDay !== undefined) row.all_day = allDay;
  if (color !== undefined) row.color = color;
  if (memo !== undefined) row.memo = memo;
  if (isTimetable !== undefined) row.is_timetable = isTimetable;
  return row;
}

// 수업 시간표처럼 일정을 한꺼번에 넣습니다
export async function addEvents(list) {
  if (list.length === 0) return;
  const { error } = await supabase.from('events').insert(list.map(toEventRow));
  if (error) throw error;
}

export async function addEvent({ title, startAt, endAt, allDay = false, color = null, memo = null, isTimetable = false }) {
  const { error } = await supabase.from('events').insert(toEventRow({ title, startAt, endAt, allDay, color, memo, isTimetable }));
  if (error) throw error;
}

export async function updateEvent(id, fields) {
  const { error } = await supabase.from('events').update(toEventRow(fields)).eq('id', id);
  if (error) throw error;
}

// 같은 이름의 수업 시간표 전체(모든 주)의 색을 한 번에 바꿉니다
export async function setTimetableColor(title, color) {
  const { error } = await supabase.from('events').update({ color }).eq('is_timetable', true).eq('title', title);
  if (error) throw error;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

// ---- 실시간 동기화 ----
// 다른 곳(사이트 ↔ 사이드 패널)에서 바뀌면 callback이 불립니다
export function subscribeChanges(callback) {
  const channel = supabase
    .channel('my-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, callback)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---- 쿼터(학기 구간) ----
// 사용자마다 쿼터 시작일을 저장합니다. 저장한 적이 없으면 null
export async function getQuarterSetting() {
  const { data, error } = await supabase.from('user_settings').select('quarter_start, quarter_weeks').maybeSingle();
  if (error) throw error;
  return data?.quarter_start ? { start: data.quarter_start, weeks: data.quarter_weeks } : null;
}

export async function saveQuarterSetting(start, weeks) {
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: data.user.id, quarter_start: start, quarter_weeks: weeks, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function listTimetableBetween(from, to) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_timetable', true)
    .gte('start_at', from.toISOString())
    .lt('start_at', to.toISOString())
    .order('start_at');
  if (error) throw error;
  return data;
}

export async function deleteEvents(ids) {
  // 한 번에 너무 많은 id를 보내지 않도록 나눠서 지웁니다
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from('events').delete().in('id', ids.slice(i, i + 100));
    if (error) throw error;
  }
}

// "매주 화요일 점심"처럼 매주 하는 일정: 첫 날부터 이번 쿼터(9주) 끝까지 매주 같은 요일·시간에 넣습니다.
// 쿼터가 이미 끝났거나 정한 적이 없으면 첫 날부터 9주. 넣은 개수와 마지막 날을 돌려줍니다
export async function addWeeklyEvents({ title, startAt, endAt, allDay }) {
  const setting = await getQuarterSetting().catch(() => null);
  let range = setting ? quarterRange(setting.start, setting.weeks) : QUARTER;
  if (toDateKey(startAt) > range.end) range = quarterRange(toDateKey(startAt), setting?.weeks ?? DEFAULT_WEEKS);
  const list = [
    { startAt, endAt },
    ...weeklyRepeats(startAt, endAt, range).filter((r) => r.startAt > startAt),
  ].map((r) => ({ title, startAt: r.startAt, endAt: r.endAt, allDay, color: null, memo: null, isTimetable: false }));
  await addEvents(list);
  return { count: list.length, last: list[list.length - 1].startAt, range };
}
