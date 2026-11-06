import { signIn, signUp, sendPasswordReset, updatePassword, listTodos, addTodo, setTodoDone, deleteTodo, addWeeklyEvents } from './api.js';
import { toDateKey, addDays, dueLabel, fromKeys } from './dates.js';
import { periodLabel } from './timetable.js';
import { openPeriodPicker } from './schedulePicker.js';
import { sortTodos } from './todoOrder.js';
import { parseEvening, parseTodoDate, parseDueInput, parseWeekly } from './quickParse.js';

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

// Supabase 로그인 오류를 알아보기 쉬운 한국어로 바꿉니다
export function authErrorText(err) {
  const code = err?.code || '';
  const msg = err?.message || '';
  if (code === 'over_email_send_rate_limit' || err?.status === 429 || /rate limit|after \d+ seconds/i.test(msg)) {
    const sec = msg.match(/after (\d+) seconds/)?.[1];
    return sec
      ? `너무 자주 눌렀습니다. ${sec}초 뒤에 다시 눌러 주세요. (이미 보낸 인증 메일이 있다면 그 메일의 링크를 누르면 됩니다)`
      : '인증 메일을 너무 많이 보냈습니다. 잠시 뒤에 다시 해 주세요. (이미 받은 메일이 있다면 그 링크를 누르면 됩니다)';
  }
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return '이미 가입된 이메일입니다. 「로그인」을 눌러 주세요.';
  if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return '아직 이메일 인증을 안 했습니다. 메일함(스팸함 포함)에서 인증 링크를 눌러 주세요.';
  if (code === 'invalid_credentials' || /invalid login/i.test(msg)) return '이메일 또는 비밀번호가 틀렸습니다. 처음이라면 「회원가입」을 눌러 주세요.';
  if (code === 'weak_password' || /password/i.test(msg)) return '비밀번호는 6자 이상으로 해 주세요.';
  if (code === 'email_address_invalid' || /email.*invalid|invalid.*email/i.test(msg)) return '이메일 주소를 다시 확인해 주세요.';
  if (code === 'same_password') return '예전과 다른 비밀번호로 정해 주세요.';
  if (code === 'otp_expired') return '메일 링크가 만료됐거나 이미 사용한 링크입니다. 「비밀번호를 잊으셨나요?」에서 메일을 다시 받아 주세요.';
  if (code === 'signup_disabled') return '지금은 회원가입이 꺼져 있습니다.';
  if (/fetch|network/i.test(msg)) return '인터넷 연결을 확인해 주세요.';
  return msg;
}

// 로그인·회원가입 폼: 사이트와 사이드 패널이 같이 씁니다
// 위 탭으로 「로그인」과 「회원가입」 화면을 바꿉니다. 「비밀번호를 잊으셨나요?」를 누르면 재설정 메일 화면이 됩니다
// notice: 처음에 보여 줄 오류 코드 (예: 만료된 메일 링크로 들어왔을 때 'otp_expired')
export function renderAuthForm(container, { notice = null } = {}) {
  container.innerHTML = `
    <form class="auth" data-mode="login">
      <div class="auth-tabs" role="tablist">
        <button type="button" role="tab" data-mode="login">로그인</button>
        <button type="button" role="tab" data-mode="signup">회원가입</button>
      </div>
      <h2>로그인</h2>
      <p class="auth-sub"></p>
      <input name="email" type="email" placeholder="이메일" autocomplete="email" required />
      <input name="password" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="current-password" minlength="6" required />
      <input name="password2" type="password" placeholder="비밀번호 한 번 더" autocomplete="new-password" minlength="6" hidden />
      <button type="submit" class="primary">로그인</button>
      <button type="button" class="link forgot">비밀번호를 잊으셨나요?</button>
      <p class="message" role="status"></p>
      <p class="auth-switch"><span></span> <button type="button" class="link"></button></p>
    </form>`;
  const form = container.querySelector('form');
  const title = form.querySelector('h2');
  const sub = form.querySelector('.auth-sub');
  const submit = form.querySelector('button[type="submit"]');
  const message = form.querySelector('.message');
  const switchText = form.querySelector('.auth-switch span');
  const switchBtn = form.querySelector('.auth-switch button');
  const forgot = form.querySelector('.forgot');
  const buttons = form.querySelectorAll('button');
  let mode = 'login';

  const setMode = (next) => {
    mode = next;
    const signup = mode === 'signup';
    const reset = mode === 'reset';
    form.dataset.mode = mode;
    form.querySelectorAll('.auth-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    title.textContent = signup ? '회원가입' : reset ? '비밀번호 재설정' : '로그인';
    sub.textContent = signup
      ? '이메일과 비밀번호를 정해 새 계정을 만듭니다.'
      : reset
        ? '가입한 이메일을 쓰면 재설정 메일을 보내 드립니다. 메일의 링크를 누르면 새 비밀번호를 정하는 화면이 뜹니다.'
        : '';
    submit.textContent = signup ? '가입하기' : reset ? '재설정 메일 보내기' : '로그인';
    form.password.hidden = reset;
    form.password.required = !reset;
    form.password.autocomplete = signup ? 'new-password' : 'current-password';
    form.password2.hidden = !signup;
    form.password2.required = signup;
    forgot.hidden = mode !== 'login';
    switchText.textContent = signup ? '이미 계정이 있나요?' : reset ? '비밀번호가 기억났나요?' : '처음이신가요?';
    switchBtn.textContent = signup || reset ? '로그인' : '회원가입';
    message.className = 'message';
    message.textContent = '';
    form.email.focus();
  };
  forgot.addEventListener('click', () => setMode('reset'));
  form.querySelectorAll('.auth-tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  switchBtn.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

  // 누르는 동안 버튼을 잠가 두 번 눌러 메일 제한에 걸리지 않게 합니다
  const busy = (on, text = '') => {
    buttons.forEach((b) => (b.disabled = on));
    message.classList.remove('ok');
    message.classList.toggle('info', on);
    message.textContent = text;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (mode === 'reset') {
      busy(true, '메일 보내는 중…');
      try {
        await sendPasswordReset(email);
        busy(false);
        message.classList.add('ok');
        message.textContent = `${email} 메일함(스팸함도)에 재설정 메일을 보냈습니다. 메일의 링크를 누르면 새 비밀번호를 정할 수 있습니다.`;
      } catch (err) {
        busy(false, '메일 보내기 실패: ' + authErrorText(err));
      }
      return;
    }
    if (mode === 'login') {
      busy(true, '로그인 중…');
      try {
        await signIn(email, password);
        busy(false);
      } catch (err) {
        busy(false, '로그인 실패: ' + authErrorText(err));
      }
      return;
    }
    if (password !== form.password2.value) {
      message.className = 'message';
      message.textContent = '비밀번호 두 칸이 서로 다릅니다.';
      form.password2.focus();
      return;
    }
    busy(true, '가입 중…');
    try {
      const { needsConfirm } = await signUp(email, password);
      busy(false);
      if (needsConfirm) {
        setMode('login');
        form.email.value = email;
        message.classList.add('ok');
        message.textContent = `가입 신청 완료! ${email} 메일함(스팸함도)에서 인증 링크를 누른 뒤 여기서 로그인해 주세요.`;
      }
    } catch (err) {
      busy(false, '회원가입 실패: ' + authErrorText(err));
    }
  });

  setMode('login');
  if (notice) message.textContent = authErrorText({ code: notice });
}

// 비밀번호 재설정 링크로 들어왔을 때: 새 비밀번호를 정해야 사이트로 들어갑니다
export function renderNewPasswordForm(container, { email = '', onDone } = {}) {
  container.innerHTML = `
    <form class="auth">
      <h2>새 비밀번호 정하기</h2>
      <p class="auth-sub"></p>
      <input name="password" type="password" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password" minlength="6" required />
      <input name="password2" type="password" placeholder="새 비밀번호 한 번 더" autocomplete="new-password" minlength="6" required />
      <button type="submit" class="primary">비밀번호 바꾸기</button>
      <p class="message" role="status"></p>
    </form>`;
  const form = container.querySelector('form');
  const message = form.querySelector('.message');
  const submit = form.querySelector('button');
  form.querySelector('.auth-sub').textContent = `${email} 계정의 비밀번호를 새로 정합니다. 앞으로는 이 비밀번호로 로그인합니다.`;
  form.password.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.className = 'message';
    if (form.password.value !== form.password2.value) {
      message.textContent = '비밀번호 두 칸이 서로 다릅니다.';
      form.password2.focus();
      return;
    }
    submit.disabled = true;
    message.classList.add('info');
    message.textContent = '바꾸는 중…';
    try {
      await updatePassword(form.password.value);
      message.className = 'message ok';
      message.textContent = '비밀번호를 바꿨습니다!';
      setTimeout(() => onDone?.(), 800);
    } catch (err) {
      submit.disabled = false;
      message.className = 'message';
      message.textContent = '바꾸기 실패: ' + authErrorText(err);
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
  // 마감 칸에 "목 2교시"처럼 교시까지 쓰면 마감일과 함께 그 시간(일정)도 기억해 둡니다
  let dueSchedule = null;
  const BAD_DUE = '날짜를 알아보지 못했습니다 (예: 다다음주 화, 다음달 5일, 2달 뒤, 11/3, 목 2교시)';
  const dayText = (date) => `${date.getMonth() + 1}월 ${date.getDate()}일 (${'일월화수목금토'[date.getDay()]})`;
  const dueHintText = (date, schedule) =>
    schedule ? `→ ${dayText(date)} ${periodLabel(schedule.startAt, schedule.endAt)}에 하기 (캘린더 일정)` : `→ ${dayText(date)} 마감`;

  for (const button of form.querySelectorAll('[data-due]')) {
    button.addEventListener('click', () => {
      const key = toDateKey(addDays(new Date(), Number(button.dataset.due)));
      // 같은 버튼을 다시 누르면 마감일을 지웁니다
      form.due.value = form.due.value === key ? '' : key;
      dueSchedule = null;
      syncDueButtons();
    });
  }
  const dueHint = form.querySelector('.due-hint');
  const popup = form.querySelector('.due-popup');
  const popHint = form.querySelector('.pop-hint');

  // 할 일을 쓰고 Enter → 마감일 팝업이 뜨고 → 날짜를 쓰고 Enter로 저장. 마우스 없이 끝납니다.
  // 마감일을 이미 골랐거나 제목에 날짜·교시를 썼으면 팝업 없이 바로 저장합니다
  form.title.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return;
    if (form.due.value || parseWeekly(title) || parseEvening(title) || parseTodoDate(title).date) form.requestSubmit();
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
    const parsed = text ? parseDueInput(text) : null;
    const date = parsed?.date ?? null;
    const bad = showError && Boolean(text) && !date;
    form.popDue.classList.toggle('invalid', bad);
    popHint.className = 'pop-hint' + (bad ? ' error' : '');
    if (!text) popHint.textContent = '→ 오늘 마감';
    else if (date) popHint.textContent = dueHintText(date, parsed.schedule);
    else popHint.textContent = bad ? BAD_DUE : '';
    return { text, date, schedule: parsed?.schedule ?? null };
  }
  form.popDue.addEventListener('input', () => showPopHint());
  form.popDue.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopup(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const { text, date, schedule } = showPopHint(true);
      if (text && !date) return; // 잘못 쓴 날짜면 고칠 때까지 기다립니다
      form.due.value = date ? toDateKey(date) : '';
      dueSchedule = schedule;
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
    dueSchedule = null;
    form.dueText.value = form.due.value ? shortDate(form.due.value) : '';
    syncDueButtons();
  });

  // "다음주 화"처럼 쓰는 대로 날짜를 찾아 마감일로 넣고, 아래에 "→ 11월 3일 (화)"처럼 보여 줍니다
  form.dueText.addEventListener('input', () => {
    const text = form.dueText.value.trim();
    const parsed = text ? parseDueInput(text) : null;
    form.due.value = parsed ? toDateKey(parsed.date) : '';
    dueSchedule = parsed?.schedule ?? null;
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
      dueHint.textContent = dueHintText(date, dueSchedule);
      dueHint.className = 'due-hint';
    } else if (text && showError) {
      dueHint.textContent = BAD_DUE;
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
    // "저녁활동 1 수학 숙제", "화요일 10교시 영어"처럼 교시를 쓰면 그 시간에 하는 할 일로 저장합니다
    // "매주 화요일 점심 독서"처럼 '매주'를 쓰면 이번 쿼터 끝까지 매주 캘린더 일정으로 넣습니다
    const weekly = parseWeekly(title);
    if (weekly) {
      try {
        const { count, last } = await addWeeklyEvents(weekly);
        form.title.value = '';
        form.due.value = '';
        dueSchedule = null;
        syncDueButtons();
        dueHint.textContent = `✓ 「${weekly.title}」 매주 ${'일월화수목금토'[weekly.startAt.getDay()]}요일 일정 ${count}개를 ${last.getMonth() + 1}/${last.getDate()}까지 넣었습니다`;
        changed();
      } catch (err) {
        dueHint.textContent = '저장 실패: ' + err.message;
        dueHint.className = 'due-hint error';
      }
      return;
    }
    const evening = parseEvening(title);
    if (dueSchedule) {
      // 마감 칸에 교시를 썼으면 그 시간에 하는 할 일(캘린더 일정)로 넣습니다
      await addTodo(parseTodoDate(title).title, form.due.value, dueSchedule);
    } else if (evening) {
      await addTodo(evening.title, form.due.value || (evening.date ? toDateKey(evening.date) : null), evening.schedule);
    } else {
      // "금요일 수행평가"처럼 요일·날짜를 쓰면 그 날을 마감일로 하고 제목에서는 뺍니다
      const parsed = parseTodoDate(title);
      await addTodo(parsed.title, form.due.value || (parsed.date ? toDateKey(parsed.date) : null));
    }
    form.title.value = '';
    form.due.value = '';
    dueSchedule = null;
    syncDueButtons();
    changed();
  });

  return { refresh };
}
