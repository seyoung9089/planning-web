import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './shared/base.css';
import './styles.css';
import { onAuthChange, signOut, subscribeChanges } from './shared/api.js';
import { renderAuthForm, createTodoList } from './shared/ui.js';
import { createCalendar } from './calendar.js';
import { createMiniCalendar } from './miniCalendar.js';

const app = document.getElementById('app');
let unsubscribe = null;
let currentUserId; // 처음엔 undefined여야 "로그아웃 상태"도 한 번 그려집니다

onAuthChange((session) => {
  const userId = session?.user.id ?? null;
  if (userId === currentUserId) return; // 토큰 갱신 같은 이벤트에서는 다시 그리지 않습니다
  currentUserId = userId;

  unsubscribe?.();
  unsubscribe = null;

  if (!session) {
    app.className = 'logged-out';
    app.innerHTML = '<h1 class="brand">📅 planning-web</h1><div id="auth"></div>';
    renderAuthForm(document.getElementById('auth'));
    return;
  }

  app.className = 'shell';
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand-row">
        <span class="brand">📅 planning-web</span>
      </div>
      <div id="mini-calendar"></div>
      <section class="side-section">
        <h2>할 일</h2>
        <div id="todo-list"></div>
      </section>
      <footer class="account">
        <span class="email"></span>
        <button id="logout" class="ghost">로그아웃</button>
      </footer>
    </aside>
    <main class="cal-main">
      <header class="cal-header">
        <h1 id="cal-title"></h1>
        <div class="cal-controls">
          <div class="segmented" role="group" aria-label="보기">
            <button data-view="dayGridMonth">월</button>
            <button data-view="timeGridWeek">주</button>
            <button data-view="timeGridDay">일</button>
          </div>
          <button data-nav="today">오늘</button>
          <button data-nav="prev" class="icon-btn" aria-label="이전">‹</button>
          <button data-nav="next" class="icon-btn" aria-label="다음">›</button>
        </div>
      </header>
      <div id="calendar"></div>
    </main>`;
  app.querySelector('.email').textContent = session.user.email;
  app.querySelector('#logout').addEventListener('click', signOut);

  const title = document.getElementById('cal-title');
  const viewButtons = app.querySelectorAll('[data-view]');

  // 캘린더·미니 달력·할 일 목록은 서로 영향을 주므로 한쪽이 바뀌면 다른 쪽도 새로고침합니다
  const todoList = createTodoList(document.getElementById('todo-list'), { onChange: () => calendar.refresh() });
  const mini = createMiniCalendar(document.getElementById('mini-calendar'), {
    onPick: (date) => calendar.gotoDate(date),
  });
  const calendar = createCalendar(document.getElementById('calendar'), {
    onChange: () => todoList.refresh(),
    onDatesSet: ({ title: text, viewType, start, end }) => {
      title.textContent = text;
      for (const b of viewButtons) b.classList.toggle('active', b.dataset.view === viewType);
      mini.highlight(start, end, viewType !== 'dayGridMonth');
    },
  });

  for (const b of viewButtons) b.addEventListener('click', () => calendar.changeView(b.dataset.view));
  app.querySelector('[data-nav="today"]').addEventListener('click', () => calendar.today());
  app.querySelector('[data-nav="prev"]').addEventListener('click', () => calendar.prev());
  app.querySelector('[data-nav="next"]').addEventListener('click', () => calendar.next());

  todoList.refresh();
  unsubscribe = subscribeChanges(() => {
    todoList.refresh();
    calendar.refresh();
  });
});
