import './shared/base.css';
import './styles.css';
import { onAuthChange, signOut, subscribeChanges } from './shared/api.js';
import { renderAuthForm, createTodoList } from './shared/ui.js';
import { createCalendar } from './calendar.js';

const app = document.getElementById('app');
const logoutButton = document.getElementById('logout');
let unsubscribe = null;
let currentUserId; // 처음엔 undefined여야 "로그아웃 상태"도 한 번 그려집니다

logoutButton.addEventListener('click', signOut);

onAuthChange((session) => {
  const userId = session?.user.id ?? null;
  if (userId === currentUserId) return; // 토큰 갱신 같은 이벤트에서는 다시 그리지 않습니다
  currentUserId = userId;

  unsubscribe?.();
  unsubscribe = null;
  logoutButton.hidden = !session;

  if (!session) {
    renderAuthForm(app);
    return;
  }

  app.innerHTML = `
    <section class="calendar-panel"><div id="calendar"></div></section>
    <section class="todo-panel">
      <h2>할 일</h2>
      <div id="todo-list"></div>
    </section>`;
  // 캘린더와 할 일 목록은 서로 영향을 주므로 한쪽이 바뀌면 다른 쪽도 새로고침합니다
  const todoList = createTodoList(document.getElementById('todo-list'), { onChange: () => calendar.refresh() });
  const calendar = createCalendar(document.getElementById('calendar'), { onChange: () => todoList.refresh() });
  todoList.refresh();
  unsubscribe = subscribeChanges(() => {
    todoList.refresh();
    calendar.refresh();
  });
});
