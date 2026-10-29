import { signIn, signUp, listTodos, addTodo, setTodoDone, deleteTodo } from './api.js';
import { toDateKey, addDays, dueLabel, fromKeys } from './dates.js';
import { periodLabel } from './timetable.js';
import { openPeriodPicker } from './schedulePicker.js';
import { sortTodos } from './todoOrder.js';
import { parseEvening, parseTodoDate, parseDueText } from './quickParse.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// "오늘 7교시", "내일 7–8교시", "11/3(화) 점심"
function scheduleText(todo) {
  const start = new Date(todo.scheduled_start);
  const key = toDateKey(start);
  let day = `${start.getMonth() + 1}/${start.getDate()}(${WEEKDAYS[start.getDay()]})`;
  if (key === toDateKey(new Date())) day = '오늘';
  else if (key === toDateKey(addDays(new Date(), 1))) day = '내일';
  return `${day} ${periodLabel(start, new Date(todo.scheduled_end))}`;
}

// 시계 모양의 선 아이콘
const CLOCK_ICON =
  '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

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
        <input name="dueText" class="due-text" placeholder="마감 기한" maxlength="20" autocomplete="off" aria-label="마감일 직접 쓰기" />
        <button type="button" class="due-pick" title="달력에서 고르기" aria-label="달력에서 고르기">📅</button>
        <input name="due" type="date" class="due-date" tabindex="-1" aria-hidden="true" />
      </div>
      <p class="due-hint" aria-live="polite"></p>
      <div class="due-popup" role="dialog" aria-label="마감일 입력" hidden>
        <div class="due-popup-head"><b>마감일</b><span>Enter 저장 · 비우면 오늘 · Esc 취소</span></div>
        <input name="popDue" placeholder="마감 기한" maxlength="20" autocomplete="off" />
        <p class="pop-hint" aria-live="polite"></p>
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
  const dueHint = form.querySelector('.due-hint');
  const popup = form.querySelector('.due-popup');
  const popHint = form.querySelector('.pop-hint');

  // 할 일을 쓰고 Enter → 마감일 팝업이 뜨고 → 날짜를 쓰고 Enter로 저장. 마우스 없이 끝납니다.
  // 마감일을 이미 골랐거나 제목에 날짜·저녁활동을 썼으면 팝업 없이 바로 저장합니다
  form.title.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return;
    if (form.due.value || parseEvening(title) || parseTodoDate(title).date) form.requestSubmit();
    else openPopup();
  });
  form.dueText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  function openPopup() {
    popup.hidden = false;
    form.popDue.value = '';
    showPopHint();
    form.popDue.focus();
  }
  function closePopup(backToTitle) {
    popup.hidden = true;
    if (backToTitle) form.title.focus();
  }
  // 쓰는 동안에는 알아본 날짜만 보여 주고, 못 알아본다는 오류는 Enter를 눌렀을 때만 띄웁니다
  function showPopHint(showError = false) {
    const text = form.popDue.value.trim();
    const date = text ? parseDueText(text) : null;
    const bad = showError && Boolean(text) && !date;
    form.popDue.classList.toggle('invalid', bad);
    popHint.className = 'pop-hint' + (bad ? ' error' : '');
    if (!text) popHint.textContent = '→ 오늘 마감';
    else if (date) popHint.textContent = `→ ${date.getMonth() + 1}월 ${date.getDate()}일 (${'일월화수목금토'[date.getDay()]}) 마감`;
    else popHint.textContent = bad ? '날짜를 알아보지 못했습니다 (예: 다음주 화, 금요일, 11/3)' : '';
    return { text, date };
  }
  form.popDue.addEventListener('input', () => showPopHint());
  form.popDue.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopup(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const { text, date } = showPopHint(true);
      if (text && !date) return; // 잘못 쓴 날짜면 고칠 때까지 기다립니다
      form.due.value = date ? toDateKey(date) : '';
      closePopup(true);
      form.requestSubmit();
    }
  });
  // 팝업 밖을 누르면 닫습니다 (쓴 할 일은 그대로 남습니다)
  form.popDue.addEventListener('blur', () => setTimeout(() => closePopup(false), 0));
  form.querySelector('.due-pick').addEventListener('click', () => {
    try {
      form.due.showPicker();
    } catch {
      form.due.click();
    }
  });
  form.due.addEventListener('change', () => {
    form.dueText.value = form.due.value ? shortDate(form.due.value) : '';
    syncDueButtons();
  });

  // "다음주 화"처럼 쓰는 대로 날짜를 찾아 마감일로 넣고, 아래에 "→ 11월 3일 (화)"처럼 보여 줍니다
  form.dueText.addEventListener('input', () => {
    const text = form.dueText.value.trim();
    const date = text ? parseDueText(text) : null;
    form.due.value = date ? toDateKey(date) : '';
    form.dueText.classList.remove('invalid');
    syncDueButtons(false);
  });

  function shortDate(key) {
    const [, m, d] = key.split('-').map(Number);
    return `${m}/${d}`;
  }

  function syncDueButtons(updateText = true, showError = false) {
    for (const button of form.querySelectorAll('[data-due]')) {
      const key = toDateKey(addDays(new Date(), Number(button.dataset.due)));
      button.classList.toggle('selected', form.due.value === key);
    }
    if (updateText) form.dueText.value = form.due.value ? shortDate(form.due.value) : '';
    const text = form.dueText.value.trim();
    if (form.due.value) {
      const date = fromKeys(form.due.value);
      dueHint.textContent = `→ ${date.getMonth() + 1}월 ${date.getDate()}일 (${'일월화수목금토'[date.getDay()]}) 마감`;
      dueHint.className = 'due-hint';
    } else if (text && showError) {
      dueHint.textContent = '날짜를 알아보지 못했습니다 (예: 다음주 화, 금요일, 11/3)';
      dueHint.className = 'due-hint error';
    } else {
      dueHint.textContent = '';
      dueHint.className = 'due-hint';
    }
  }

  async function refresh() {
    const todos = sortTodos(await listTodos());
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
        <button class="icon" title="삭제" aria-label="삭제">×</button>
        <div class="meta">
          <button type="button" class="when" title="몇 교시에 할지 정하기">${CLOCK_ICON}<span>교시</span></button>
          <span class="due"></span>
        </div>`;
      li.querySelector('.title').textContent = todo.title;
      const due = dueLabel(todo.due_date);
      if (due && !todo.done) {
        const badge = li.querySelector('.due');
        badge.textContent = due.text;
        badge.classList.add(due.tone);
      }
      const when = li.querySelector('.when');
      if (todo.scheduled_start) {
        when.classList.add('set');
        when.querySelector('span').textContent = scheduleText(todo);
      }
      if (todo.done) when.hidden = !todo.scheduled_start;
      when.addEventListener('click', () => openPeriodPicker(todo, when, changed));
      li.querySelector('input').addEventListener('change', (e) => setTodoDone(todo.id, e.target.checked).then(changed));
      li.querySelector('button.icon').addEventListener('click', () => deleteTodo(todo.id).then(changed));
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
    if (form.dueText.value.trim() && !form.due.value) {
      form.dueText.classList.add('invalid');
      syncDueButtons(false, true);
      form.dueText.focus();
      return;
    }
    // "저녁활동 1 수학 숙제"처럼 쓰면 오후 7~8시로 정해서 저장합니다
    const evening = parseEvening(title);
    if (evening) {
      await addTodo(evening.title, form.due.value || (evening.date ? toDateKey(evening.date) : null), evening.schedule);
    } else {
      // "금요일 수행평가"처럼 요일·날짜를 쓰면 그 날을 마감일로 하고 제목에서는 뺍니다
      const parsed = parseTodoDate(title);
      await addTodo(parsed.title, form.due.value || (parsed.date ? toDateKey(parsed.date) : null));
    }
    form.title.value = '';
    form.due.value = '';
    syncDueButtons();
    changed();
  });

  return { refresh };
}
