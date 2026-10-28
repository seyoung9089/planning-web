import { supabase } from './supabase.js';

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
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addTodo(title, dueDate = null) {
  const { error } = await supabase.from('todos').insert({ title, due_date: dueDate });
  if (error) throw error;
}

export async function setTodoDone(id, done) {
  const { error } = await supabase
    .from('todos')
    .update({ done, done_at: done ? new Date().toISOString() : null })
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
    .gte('end_at', from.toISOString())
    .order('start_at');
  if (error) throw error;
  return data;
}

export async function addEvent({ title, startAt, endAt, allDay = false }) {
  const { error } = await supabase.from('events').insert({
    title,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    all_day: allDay,
  });
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
