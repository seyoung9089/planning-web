import { signIn, signUp, listTodos, addTodo, setTodoDone, deleteTodo } from './api.js';

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

// 할 일 목록: 추가, 완료 체크, 삭제
export function createTodoList(container) {
  container.innerHTML = `
    <form class="todo-add">
      <input name="title" placeholder="할 일을 입력하고 Enter" maxlength="200" required />
    </form>
    <ul class="todos"></ul>`;
  const form = container.querySelector('form');
  const list = container.querySelector('ul');

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
        <label><input type="checkbox" ${todo.done ? 'checked' : ''} /> <span></span></label>
        <button class="icon" title="삭제" aria-label="삭제">×</button>`;
      li.querySelector('span').textContent = todo.title;
      li.querySelector('input').addEventListener('change', (e) => setTodoDone(todo.id, e.target.checked).then(refresh));
      li.querySelector('button').addEventListener('click', () => deleteTodo(todo.id).then(refresh));
      list.append(li);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return;
    form.title.value = '';
    await addTodo(title);
    refresh();
  });

  return { refresh };
}
