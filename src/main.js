import './shared/base.css';
import './styles.css';
import { onAuthChange, signOut, subscribeChanges } from './shared/api.js';
import { renderAuthForm, createTodoList } from './shared/ui.js';

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

  // 2단계에서 이 자리에 월간·주간 캘린더가 들어갑니다
  app.innerHTML = `
    <section class="calendar-placeholder">
      <h2>캘린더</h2>
      <p>2단계에서 구글 캘린더 스타일의 월간·주간 캘린더가 들어갈 자리입니다.</p>
    </section>
    <section class="todo-panel">
      <h2>할 일</h2>
      <div id="todo-list"></div>
    </section>`;
  const todoList = createTodoList(document.getElementById('todo-list'));
  todoList.refresh();
  unsubscribe = subscribeChanges(() => todoList.refresh());
});
