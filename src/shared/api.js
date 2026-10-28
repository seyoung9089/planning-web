import { supabase } from './supabase.js';
import { TIMETABLE_MEMO } from './timetable.js';

// ---- 로그인 ----

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // 이메일 인증이 켜져 있으면 session이 비어 있습니다
  return { needsConfirm: !data.session };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  supabase.auth.getSession().then(({ data }) => callback(data.session));
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
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
export async function addTodo(title, dueDate = null, schedule = null) {
  const row = { title, due_date: dueDate };
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
function toEventRow({ title, startAt, endAt, allDay, color, memo }) {
  const row = {};
  if (title !== undefined) row.title = title;
  if (startAt !== undefined) row.start_at = startAt.toISOString();
  if (endAt !== undefined) row.end_at = endAt.toISOString();
  if (allDay !== undefined) row.all_day = allDay;
  if (color !== undefined) row.color = color;
  if (memo !== undefined) row.memo = memo;
  return row;
}

export async function addEvent({ title, startAt, endAt, allDay = false, color = null, memo = null }) {
  const { error } = await supabase.from('events').insert(toEventRow({ title, startAt, endAt, allDay, color, memo }));
  if (error) throw error;
}

export async function updateEvent(id, fields) {
  const { error } = await supabase.from('events').update(toEventRow(fields)).eq('id', id);
  if (error) throw error;
}

// 같은 이름의 수업 시간표 전체(모든 주)의 색을 한 번에 바꿉니다
export async function setTimetableColor(title, color) {
  const { error } = await supabase.from('events').update({ color }).eq('memo', TIMETABLE_MEMO).eq('title', title);
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
