import { signIn, signUp, listTodos, addTodo, setTodoDone, deleteTodo } from './api.js';
import { toDateKey, addDays, dueLabel } from './dates.js';

// 로그인 폼: 사이트와 사이드 패널이 같이 씁니다
export function renderAuthForm(container) {
  container.innerHTML = `
    <form class="auth">
      <h2>로그인</h2>
      <input name="email" type="email" placeholder="이메일" autocomplete="email" required />
      <input name="password" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="current-password" minlength="6" required />
      <div class="row">
        <button type="submit" class="primary">로그인</button>
        <button type="button" data-action="signup">회원가입</button>
      </div>
      <p class="message" role="status"></p>
    </form>`;
  const form = container.querySelector('form');
  const message = form.querySelector('.message');
  const values = () => [form.email.value.trim(), form.password.value];

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';
    try {
      await signIn(...values());
    } catch (err) {
      message.textContent = '로그인 실패: ' + err.message;
    }
  });

  form.querySelector('[data-action="signup"]').addEventListener('click', async () => {
    if (!form.reportValidity()) return;
    message.textContent = '';
    try {
      const { needsConfirm } = await signUp(...values());
      if (needsConfirm) message.textContent = '메일함에서 인증 링크를 눌러 주세요.';
    } catch (err) {
      message.textContent = '회원가입 실패: ' + err.message;
    }
  });
}

// 할 일 목록: 추가(마감일 선택), 완료 체크, 삭제
export function createTodoList(container, { onChange, showForm = true } = {}) {
  container.innerHTML = `
    <form class="todo-add" ${showForm ? '' : 'hidden'}>
      <input name="title" placeholder="할 일을 입력하고 Enter" maxlength="200" required />
      <div class="due-row">
        <span>마감</span>
        <button type="button" data-due="0">오늘</button>
        <button type="button" data-due="1">내일</button>
        <input name="due" type="date" aria-label="마감일" />
      </div>
    </form>
    <ul class="todos"></ul>`;
  const form = container.querySelector('form');
  const list = container.querySelector('ul');

  for (const button of form.querySelectorAll('[data-due]')) {
    button.addEventListener('click', () => {
      const key = toDateKey(addDays(new Date(), Number(button.dataset.due)));
      // 같은 버튼을 다시 누르면 마감일을 지웁니다
      form.due.value = form.due.value === key ? '' : key;
      syncDueButtons();
    });
  }
  form.due.addEventListener('change', syncDueButtons);

  function syncDueButtons() {
    for (const button of form.querySelectorAll('[data-due]')) {
      const key = toDateKey(addDays(new Date(), Number(button.dataset.due)));
      button.classList.toggle('selected', form.due.value === key);
    }
  }

  async function refresh() {
    const todos = await listTodos();
    list.innerHTML = '';
    if (todos.length === 0) {
      list.innerHTML = '<li class="empty">아직 할 일이 없습니다.</li>';
      return;
    }
    for (const todo of todos) {
      const li = document.createElement('li');
      li.className = todo.done ? 'done' : '';
      li.innerHTML = `
        <label><input type="checkbox" ${todo.done ? 'checked' : ''} /> <span class="title"></span></label>
        <span class="due"></span>
        <button class="icon" title="삭제" aria-label="삭제">×</button>`;
      li.querySelector('.title').textContent = todo.title;
      const due = dueLabel(todo.due_date);
      if (due && !todo.done) {
        const badge = li.querySelector('.due');
        badge.textContent = due.text;
        badge.classList.add(due.tone);
      }
      li.querySelector('input').addEventListener('change', (e) => setTodoDone(todo.id, e.target.checked).then(changed));
      li.querySelector('button').addEventListener('click', () => deleteTodo(todo.id).then(changed));
      list.append(li);
    }
  }

  function changed() {
    refresh();
    onChange?.();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return;
    await addTodo(title, form.due.value || null);
    form.title.value = '';
    form.due.value = '';
    syncDueButtons();
    changed();
  });

  return { refresh };
}
