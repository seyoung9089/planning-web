import '../src/shared/base.css';
import './sidepanel.css';
import { onAuthChange, signOut, subscribeChanges, listEventsBetween, addEvent } from '../src/shared/api.js';
import { renderAuthForm, createTodoList } from '../src/shared/ui.js';

const app = document.getElementById('app');
const logoutButton = document.getElementById('logout');
let unsubscribe = null;
let currentUserId; // 처음엔 undefined여야 "로그아웃 상태"도 한 번 그려집니다

logoutButton.addEventListener('click', signOut);

function todayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

function timeAt(base, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

async function refreshEvents(list) {
  const { from, to } = todayRange();
  const events = await listEventsBetween(from, to);
  list.innerHTML = '';
  if (events.length === 0) {
    list.innerHTML = '<li class="empty">오늘 일정이 없습니다.</li>';
    return;
  }
  const now = Date.now();
  for (const ev of events) {
    const li = document.createElement('li');
    if (new Date(ev.end_at).getTime() < now) li.className = 'past';
    li.innerHTML = '<span class="time"></span><span class="title"></span>';
    li.querySelector('.time').textContent = ev.all_day ? '하루 종일' : `${formatTime(ev.start_at)}–${formatTime(ev.end_at)}`;
    li.querySelector('.title').textContent = ev.title;
    list.append(li);
  }
}

function renderPanel() {
  app.innerHTML = `
    <section>
      <h2>오늘 일정</h2>
      <ul class="events"></ul>
      <form class="event-add">
        <input name="title" placeholder="일정 이름 (예: 수학 학원)" maxlength="200" required />
        <div class="row">
          <input name="start" type="time" required />
          <span class="dash">–</span>
          <input name="end" type="time" required />
          <button type="submit" class="primary">추가</button>
        </div>
        <p class="message" role="status"></p>
      </form>
    </section>
    <section>
      <h2>할 일</h2>
      <div id="todo-list"></div>
    </section>`;

  const eventList = app.querySelector('.events');
  const form = app.querySelector('.event-add');
  const message = form.querySelector('.message');

  // 기본값: 다음 정각부터 1시간
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  form.start.value = `${pad(next.getHours())}:00`;
  form.end.value = `${pad((next.getHours() + 1) % 24)}:00`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';
    const { from } = todayRange();
    const startAt = timeAt(from, form.start.value);
    const endAt = timeAt(from, form.end.value);
    if (endAt <= startAt) {
      message.textContent = '끝나는 시간이 시작 시간보다 늦어야 합니다.';
      return;
    }
    try {
      await addEvent({ title: form.title.value.trim(), startAt, endAt });
      form.title.value = '';
      refreshEvents(eventList);
    } catch (err) {
      message.textContent = '추가 실패: ' + err.message;
    }
  });

  const todoList = createTodoList(document.getElementById('todo-list'));
  const refreshAll = () => {
    refreshEvents(eventList);
    todoList.refresh();
  };
  refreshAll();
  return refreshAll;
}

onAuthChange((session) => {
  const userId = session?.user.id ?? null;
  if (userId === currentUserId) return;
  currentUserId = userId;

  unsubscribe?.();
  unsubscribe = null;
  logoutButton.hidden = !session;

  if (!session) {
    renderAuthForm(app);
    return;
  }
  const refreshAll = renderPanel();
  unsubscribe = subscribeChanges(refreshAll);
});
