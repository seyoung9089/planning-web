import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '../src/shared/base.css';
import './sidepanel.css';
import { onAuthChange, signOut, subscribeChanges, listEventsBetween, addEvent, addTodo } from '../src/shared/api.js';
import { renderAuthForm, createTodoList } from '../src/shared/ui.js';
import { parseQuick } from '../src/shared/quickParse.js';
import { toDateKey, addDays } from '../src/shared/dates.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const app = document.getElementById('app');
const logoutButton = document.getElementById('logout');
const todayTitle = document.getElementById('today-title');
let unsubscribe = null;
let ticker = null;
let currentUserId; // 처음엔 undefined여야 "로그아웃 상태"도 한 번 그려집니다

logoutButton.addEventListener('click', signOut);

const pad = (n) => String(n).padStart(2, '0');
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function dayName(date) {
  const today = toDateKey(new Date());
  const key = toDateKey(date);
  const base = `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
  if (key === today) return `오늘 ${base}`;
  if (key === toDateKey(addDays(new Date(), 1))) return `내일 ${base}`;
  return base;
}

// "1시간 5분", "35분"
function duration(ms) {
  const total = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
}

// 백그라운드에 알림 예약을 다시 하라고 알려 줍니다
function notifyBackground() {
  chrome.runtime?.sendMessage?.({ type: 'schedule-changed' }).catch?.(() => {});
}

function renderPanel() {
  app.innerHTML = `
    <form class="quick">
      <input name="text" placeholder="예: 내일 7시 학원 / 금요일 수행평가" autocomplete="off" maxlength="200" />
      <p class="preview" aria-live="polite"></p>
    </form>
    <section class="now-next"></section>
    <section>
      <h2>오늘 일정</h2>
      <ul class="events"></ul>
    </section>
    <section>
      <h2>할 일</h2>
      <div id="todo-list"></div>
    </section>`;

  const form = app.querySelector('.quick');
  const preview = app.querySelector('.preview');
  const nowNext = app.querySelector('.now-next');
  const eventList = app.querySelector('.events');
  let todayEvents = [];

  // 입력하는 동안 어떻게 저장될지 미리 보여 줍니다
  function showPreview() {
    const text = form.text.value.trim();
    if (!text) {
      preview.innerHTML = '<span class="hint">시간을 쓰면 일정, 안 쓰면 할 일로 저장돼요. Enter로 추가</span>';
      return;
    }
    const parsed = parseQuick(text);
    preview.innerHTML = '';
    const chip = document.createElement('span');
    if (parsed.kind === 'event') {
      chip.className = 'chip event';
      chip.textContent = `📅 일정 · ${dayName(parsed.startAt)} ${hm(parsed.startAt)}–${hm(parsed.endAt)} · ${parsed.title}`;
    } else {
      chip.className = 'chip todo';
      chip.textContent = `☑ 할 일${parsed.dueDate ? ` · 마감 ${dayName(parsed.dueDate)}` : ''} · ${parsed.title}`;
    }
    preview.append(chip);
  }
  form.text.addEventListener('input', showPreview);
  showPreview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text) return;
    const parsed = parseQuick(text);
    try {
      if (parsed.kind === 'event') {
        await addEvent({ title: parsed.title, startAt: parsed.startAt, endAt: parsed.endAt });
      } else {
        await addTodo(parsed.title, parsed.dueDate ? toDateKey(parsed.dueDate) : null);
      }
      form.text.value = '';
      showPreview();
      preview.insertAdjacentHTML('afterbegin', '<span class="saved">✓ 추가했어요</span>');
      refreshAll();
      notifyBackground();
    } catch (err) {
      preview.textContent = '추가 실패: ' + err.message;
    }
  });

  // "지금 하는 일"과 "다음 일정"을 한눈에
  function renderNowNext() {
    const now = Date.now();
    const timed = todayEvents.filter((ev) => !ev.all_day);
    const current = timed.find((ev) => new Date(ev.start_at) <= now && new Date(ev.end_at) > now);
    const next = timed.find((ev) => new Date(ev.start_at) > now);
    nowNext.innerHTML = '';

    if (current) {
      const start = new Date(current.start_at);
      const end = new Date(current.end_at);
      const progress = Math.round(((now - start) / (end - start)) * 100);
      nowNext.insertAdjacentHTML(
        'beforeend',
        `<div class="card now" style="--ev:${current.color || '#2383e2'}">
          <span class="label">지금</span><strong class="title"></strong>
          <span class="meta">${hm(end)}까지 · ${duration(end - now)} 남음</span>
          <div class="bar"><span style="width:${progress}%"></span></div>
        </div>`,
      );
      nowNext.lastElementChild.querySelector('.title').textContent = current.title;
    }
    if (next) {
      const start = new Date(next.start_at);
      nowNext.insertAdjacentHTML(
        'beforeend',
        `<div class="card next" style="--ev:${next.color || '#2383e2'}">
          <span class="label">다음</span><strong class="title"></strong>
          <span class="meta">${hm(start)} 시작 · <b>${duration(start - now)} 후</b></span>
        </div>`,
      );
      nowNext.lastElementChild.querySelector('.title').textContent = next.title;
    }
    if (!current && !next) {
      nowNext.innerHTML = '<div class="card empty">오늘 남은 일정이 없어요 🎉</div>';
    }
  }

  function renderEvents() {
    eventList.innerHTML = '';
    if (todayEvents.length === 0) {
      eventList.innerHTML = '<li class="empty">오늘 일정이 없습니다.</li>';
      return;
    }
    const now = Date.now();
    for (const ev of todayEvents) {
      const li = document.createElement('li');
      if (new Date(ev.end_at).getTime() < now) li.className = 'past';
      li.style.setProperty('--ev', ev.color || '#2383e2');
      li.innerHTML = '<span class="time"></span><span class="title"></span>';
      li.querySelector('.time').textContent = ev.all_day ? '종일' : `${hm(new Date(ev.start_at))}–${hm(new Date(ev.end_at))}`;
      li.querySelector('.title').textContent = ev.title;
      eventList.append(li);
    }
  }

  async function refreshEvents() {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    todayEvents = await listEventsBetween(from, addDays(from, 1));
    renderNowNext();
    renderEvents();
  }

  const todoList = createTodoList(document.getElementById('todo-list'), { showForm: false, onChange: notifyBackground });
  function refreshAll() {
    refreshEvents();
    todoList.refresh();
  }

  refreshAll();
  // 1분마다 "몇 분 남음"을 새로 계산하고, 날짜가 바뀌면 오늘 일정을 다시 읽습니다
  let shownDay = toDateKey(new Date());
  ticker = setInterval(() => {
    updateTitle();
    if (toDateKey(new Date()) !== shownDay) {
      shownDay = toDateKey(new Date());
      refreshAll();
    } else {
      renderNowNext();
      renderEvents();
    }
  }, 60000);
  form.text.focus();
  return refreshAll;
}

function updateTitle() {
  const d = new Date();
  todayTitle.textContent = `📅 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}
updateTitle();

onAuthChange((session) => {
  const userId = session?.user.id ?? null;
  if (userId === currentUserId) return;
  currentUserId = userId;

  unsubscribe?.();
  unsubscribe = null;
  clearInterval(ticker);
  logoutButton.hidden = !session;
  notifyBackground();

  if (!session) {
    renderAuthForm(app);
    return;
  }
  const refreshAll = renderPanel();
  unsubscribe = subscribeChanges(() => {
    refreshAll();
    notifyBackground();
  });
});
