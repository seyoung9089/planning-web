import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './shared/base.css';
import './styles.css';
import { onAuthChange, signOut, subscribeChanges, subscribeDiary, RECOVERY_IN_URL, URL_AUTH_ERROR } from './shared/api.js';
import { createDiary } from './shared/diary.js';
import { renderAuthForm, renderNewPasswordForm, createTodoList } from './shared/ui.js';
import { createCalendar } from './calendar.js';
import { createMiniCalendar } from './miniCalendar.js';
import { fromKeys } from './shared/dates.js';
import { openInstallGuide } from './installGuide.js';
import { openQuarterDialog } from './quarterDialog.js';
import { attachShortcuts, openShortcutHelp } from './shortcuts.js';
import { setupInstallBanner } from './installBanner.js';

const app = document.getElementById('app');
let unsubscribe = null;
let unsubscribeDiary = null;
let shortcutsOff = null;
const TAB_KEY = 'main-tab';
let currentUserId; // 처음엔 undefined여야 "로그아웃 상태"도 한 번 그려집니다
// 비밀번호 재설정 링크로 들어오면 Supabase가 로그인까지 시켜 주지만, 새 비밀번호를 정하기 전에는 사이트를 보여 주지 않습니다
let recovering = RECOVERY_IN_URL;

onAuthChange(function render(session, event) {
  if (event === 'PASSWORD_RECOVERY') recovering = true;
  if (recovering && session) {
    if (currentUserId === 'recovery') return;
    currentUserId = 'recovery';
    unsubscribe?.();
    unsubscribe = null;
    unsubscribeDiary?.();
    unsubscribeDiary = null;
    app.className = 'logged-out';
    app.innerHTML = '<h1 class="brand">📅 planning-web</h1><div id="auth"></div>';
    renderNewPasswordForm(document.getElementById('auth'), {
      email: session.user.email,
      onDone: () => {
        recovering = false;
        currentUserId = undefined;
        render(session, 'PASSWORD_UPDATED');
      },
    });
    return;
  }

  const userId = session?.user.id ?? null;
  if (userId === currentUserId) return; // 토큰 갱신 같은 이벤트에서는 다시 그리지 않습니다
  currentUserId = userId;

  unsubscribe?.();
  unsubscribe = null;
  unsubscribeDiary?.();
  unsubscribeDiary = null;

  shortcutsOff?.();
  shortcutsOff = null;
  if (!session) {
    app.className = 'logged-out';
    app.innerHTML = '<h1 class="brand">📅 planning-web</h1><div id="auth"></div>';
    renderAuthForm(document.getElementById('auth'), { notice: URL_AUTH_ERROR });
    return;
  }

  app.className = 'shell';
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand-row">
        <span class="brand">📅 planning-web</span>
        <div class="segmented main-tabs" role="tablist" aria-label="화면">
          <button role="tab" data-tab="calendar">캘린더</button>
          <button role="tab" data-tab="diary">일기</button>
        </div>
      </div>
      <div class="install-banner" hidden>
        <button type="button" class="banner-main">🧩 <b>어느 화면에서든</b> <kbd>Alt</kbd>+<kbd>S</kbd>로 여는 패널을 설치해 보세요</button>
        <button type="button" class="banner-close" aria-label="안내 닫기" title="다시 보지 않기">×</button>
      </div>
      <section class="side-section">
        <h2>할 일</h2>
        <div id="todo-list"></div>
      </section>
      <div id="mini-calendar"></div>
      <footer class="account">
        <span class="email"></span>
        <div class="settings">
          <button id="settings" class="ghost settings-btn" aria-haspopup="menu" aria-expanded="false" title="설정">⚙ 설정</button>
          <div class="settings-menu" role="menu" hidden>
            <button role="menuitem" id="quarter">🗓 쿼터 시간표 등록</button>
            <button role="menuitem" id="install">🧩 사이드 패널 설치 안내</button>
            <button role="menuitem" id="shortcuts">단축키 보기 <kbd>?</kbd></button>
            <hr />
            <button role="menuitem" id="logout">로그아웃</button>
          </div>
        </div>
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
          <button id="show-done" class="ghost-toggle" aria-pressed="false" title="끝낸 할 일도 캘린더에 보이기">완료 표시</button>
          <button id="full-day" class="ghost-toggle" aria-pressed="false" title="0시~24시 전체 보기">전체 시간</button>
          <label class="snap-select" title="끌어서 일정을 잡을 때 맞춰지는 시간 단위">
            <span>드래그 단위</span>
            <select id="snap">
              <option value="5">5분</option>
              <option value="10">10분</option>
              <option value="30">30분</option>
              <option value="60">1시간</option>
            </select>
          </label>
          <button data-nav="today">오늘</button>
          <button data-nav="prev" class="icon-btn" aria-label="이전">‹</button>
          <button data-nav="next" class="icon-btn" aria-label="다음">›</button>
        </div>
      </header>
      <div id="calendar"></div>
    </main>
    <main class="diary-main" hidden>
      <header class="cal-header">
        <h1>일기</h1>
      </header>
      <div class="diary-page-wrap"><section id="diary"></section></div>
    </main>`;
  app.querySelector('.email').textContent = session.user.email;
  // ⚙ 설정: 자주 안 쓰는 버튼(쿼터 시간표, 패널 설치, 단축키, 로그아웃)은 작은 메뉴 안에 둡니다
  const settingsButton = app.querySelector('#settings');
  const settingsMenu = app.querySelector('.settings-menu');
  const setMenu = (open) => {
    settingsMenu.hidden = !open;
    settingsButton.setAttribute('aria-expanded', String(open));
  };
  settingsButton.addEventListener('click', () => setMenu(settingsMenu.hidden));
  document.addEventListener('click', (e) => {
    if (!settingsMenu.hidden && !e.target.closest('.settings')) setMenu(false);
  });
  settingsMenu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setMenu(false);
      settingsButton.focus();
    }
  });
  settingsMenu.addEventListener('click', (e) => {
    if (e.target.closest('button')) setMenu(false);
  });
  app.querySelector('#logout').addEventListener('click', signOut);
  app.querySelector('#install').addEventListener('click', openInstallGuide);
  app.querySelector('#shortcuts').addEventListener('click', openShortcutHelp);
  app.querySelector('#quarter').addEventListener('click', () =>
    openQuarterDialog((range) => {
      calendar.refresh();
      calendar.gotoDate(fromKeys(range.start));
    }),
  );
  setupInstallBanner(app.querySelector('.install-banner'));

  const title = document.getElementById('cal-title');
  const viewButtons = app.querySelectorAll('[data-view]');
  const fullDayButton = document.getElementById('full-day');
  const snapSelect = document.getElementById('snap');

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
      fullDayButton.hidden = viewType === 'dayGridMonth'; // 월 보기에는 시간 칸이 없습니다
      snapSelect.parentElement.hidden = viewType === 'dayGridMonth';
    },
  });

  for (const b of viewButtons) b.addEventListener('click', () => calendar.changeView(b.dataset.view));
  const syncFullDay = (on) => {
    fullDayButton.classList.toggle('active', on);
    fullDayButton.setAttribute('aria-pressed', String(on));
  };
  syncFullDay(calendar.isFullDay());
  fullDayButton.addEventListener('click', () => syncFullDay(calendar.toggleFullDay()));
  const showDoneButton = document.getElementById('show-done');
  const syncShowDone = (on) => {
    showDoneButton.classList.toggle('active', on);
    showDoneButton.setAttribute('aria-pressed', String(on));
  };
  syncShowDone(calendar.isShowDone());
  showDoneButton.addEventListener('click', () => syncShowDone(calendar.toggleShowDone()));
  snapSelect.value = String(calendar.getSnap());
  snapSelect.addEventListener('change', () => calendar.setSnap(Number(snapSelect.value)));
  app.querySelector('[data-nav="today"]').addEventListener('click', () => calendar.today());
  app.querySelector('[data-nav="prev"]').addEventListener('click', () => calendar.prev());
  app.querySelector('[data-nav="next"]').addEventListener('click', () => calendar.next());

  // 캘린더 ↔ 일기 탭. 마지막에 본 탭을 이 컴퓨터에 기억합니다
  const diary = createDiary(document.getElementById('diary'), { rows: 18 });
  const calMain = app.querySelector('.cal-main');
  const diaryMain = app.querySelector('.diary-main');
  const tabButtons = app.querySelectorAll('[data-tab]');
  function showTab(tab) {
    const isDiary = tab === 'diary';
    if (!isDiary) diary.flush();
    calMain.hidden = isDiary;
    diaryMain.hidden = !isDiary;
    for (const b of tabButtons) {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    }
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* 기억 못 해도 괜찮습니다 */
    }
    if (isDiary) diaryMain.querySelector('.diary-text').focus();
    else calendar.updateSize();
  }
  for (const b of tabButtons) b.addEventListener('click', () => showTab(b.dataset.tab));
  let savedTab = 'calendar';
  try {
    savedTab = localStorage.getItem(TAB_KEY) === 'diary' ? 'diary' : 'calendar';
  } catch {
    /* 기본은 캘린더 */
  }
  showTab(savedTab);
  diary.refresh();
  unsubscribeDiary = subscribeDiary(diary.refresh);

  shortcutsOff?.();
  shortcutsOff = attachShortcuts({
    calendar,
    isCalendarTab: () => !calMain.hidden,
    focusInput: () => {
      if (calMain.hidden) showTab('calendar');
      app.querySelector('.todo-add input[name="title"]').focus();
    },
  });

  // 확장 패널의 「새 버전이 있어요」 배너를 누르면 ?install=1로 들어와 설치 안내 창을 엽니다
  if (new URLSearchParams(location.search).get('install') === '1') {
    history.replaceState(null, '', location.pathname);
    openInstallGuide();
  }

  todoList.refresh();
  unsubscribe = subscribeChanges(() => {
    todoList.refresh();
    calendar.refresh();
  });
});
