import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '../src/shared/base.css';
import './sidepanel.css';
import { onAuthChange, signOut, subscribeChanges, listEventsBetween, listTodos, addEvent, addTodo, addRepeatEvents, addRepeat, addNote, subscribeNotes, subscribeDiary } from '../src/shared/api.js';
import { createDiary } from '../src/shared/diary.js';
import { periodLabel, isTimetable } from '../src/shared/timetable.js';
import { renderAuthForm, createTodoList, attachDuePopup } from '../src/shared/ui.js';
import { parseQuick, parseNote, repeatLabel } from '../src/shared/quickParse.js';
import { createNotePad } from './notepad.js';
import { findGaps } from '../src/shared/freeTime.js';
import { toDateKey, addDays } from '../src/shared/dates.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const app = document.getElementById('app');
const logoutButton = document.getElementById('logout');
const todayTitle = document.getElementById('today-title');
let unsubscribe = null;
let unsubscribeNotes = null;
let unsubscribeDiary = null;
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

// 백그라운드에 알림 예약을 다시 하라고 알려 줍니다
function notifyBackground() {
  chrome.runtime?.sendMessage?.({ type: 'schedule-changed' }).catch?.(() => {});
}

function renderPanel() {
  app.innerHTML = `
    <form class="quick">
      <input name="text" placeholder="예: 내일 7시 학원 / 금요일 수행평가" autocomplete="off" maxlength="200" autofocus />
      <p class="preview" aria-live="polite"></p>
    </form>
    <section class="memo" id="memo"></section>
    <section id="diary"></section>
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
  const eventList = app.querySelector('.events');
  let todayEvents = [];

  // 입력하는 동안 어떻게 저장될지 미리 보여 줍니다
  function showPreview() {
    const text = form.text.value.trim();
    if (!text) {
      preview.innerHTML = '<span class="hint">시간을 쓰면 일정, 안 쓰면 할 일(「화요일 10교시」, 「매일 영어 단어」처럼 반복도 돼요). 「메모 …」는 메모장으로. Enter로 추가</span>';
      return;
    }
    preview.innerHTML = '';
    const chip = document.createElement('span');
    const note = parseNote(text);
    if (note) {
      chip.className = 'chip note';
      chip.textContent = `📝 메모 · ${note}`;
      preview.append(chip);
      return;
    }
    const parsed = parseQuick(text);
    if (parsed.kind === 'repeatTodo') {
      chip.className = 'chip todo';
      chip.textContent = `↻ 반복 할 일 · ${repeatLabel(parsed.weekdays)} · ${parsed.title}`;
    } else if (parsed.kind === 'weekly') {
      chip.className = 'chip event';
      chip.textContent = `🔁 ${repeatLabel(parsed.weekdays)} ${periodLabel(parsed.startAt, parsed.endAt)} · ${parsed.title} (쿼터 끝까지)`;
    } else if (parsed.kind === 'event') {
      chip.className = 'chip event';
      chip.textContent = `📅 일정 · ${dayName(parsed.startAt)} ${hm(parsed.startAt)}–${hm(parsed.endAt)} · ${parsed.title}`;
    } else {
      chip.className = 'chip todo';
      chip.textContent = parsed.schedule
        ? `☑ 할 일 · ${dayName(parsed.schedule.startAt)} ${periodLabel(parsed.schedule.startAt, parsed.schedule.endAt)} · ${parsed.title}`
        : parsed.dueDate
          ? `☑ 할 일 · 마감 ${dayName(parsed.dueDate)} · ${parsed.title}`
          : `☑ 할 일 · ${parsed.title} · Enter 누르면 마감일 입력`;
    }
    preview.append(chip);
  }
  form.text.addEventListener('input', showPreview);
  showPreview();

  // 사이트 할 일 칸과 똑같이: 날짜·시간 없이 할 일을 쓰고 Enter → 마감일 팝업 → 날짜 쓰고 Enter로 저장
  // (비우면 오늘, Esc 취소). 날짜·시간·교시·'매주'를 이미 썼으면 팝업 없이 바로 저장합니다
  const needsDue = (parsed) => parsed.kind === 'todo' && !parsed.dueDate && !parsed.schedule;
  const duePopup = attachDuePopup(form, form.text, ({ date, schedule }) => save({ dueDate: date, schedule }));

  form.text.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const text = form.text.value.trim();
    if (!text) return;
    if (parseNote(text)) saveNote();
    else if (needsDue(parseQuick(text))) duePopup.open();
    else save();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  // 「메모 …」로 쓴 글은 할 일 대신 메모장에 넣습니다
  async function saveNote() {
    const body = parseNote(form.text.value);
    if (!body) return;
    try {
      await addNote(body);
      form.text.value = '';
      showPreview();
      preview.insertAdjacentHTML('afterbegin', '<span class="saved">✓ 메모장에 넣었어요</span>');
      notePad.refresh();
    } catch (err) {
      preview.textContent = '메모 저장 실패: ' + err.message;
    }
  }

  async function save(due = null) {
    const text = form.text.value.trim();
    if (!text) return;
    const parsed = parseQuick(text);
    try {
      if (parsed.kind === 'repeatTodo') {
        await addRepeat(parsed);
      } else if (parsed.kind === 'weekly') {
        await addRepeatEvents(parsed);
      } else if (parsed.kind === 'event') {
        await addEvent({ title: parsed.title, startAt: parsed.startAt, endAt: parsed.endAt });
      } else {
        const dueDate = due ? due.dueDate : parsed.dueDate;
        const schedule = due ? due.schedule : parsed.schedule;
        await addTodo(parsed.title, dueDate ? toDateKey(dueDate) : null, schedule);
      }
      form.text.value = '';
      showPreview();
      preview.insertAdjacentHTML('afterbegin', '<span class="saved">✓ 추가했어요</span>');
      refreshAll();
      notifyBackground();
    } catch (err) {
      preview.textContent = '추가 실패: ' + err.message;
    }
  }

  function renderEvents() {
    eventList.innerHTML = '';
    if (todayEvents.length === 0) {
      eventList.innerHTML = '<li class="empty">오늘 일정이 없습니다.</li>';
      return;
    }
    const now = Date.now();
    // 일정 사이 빈 시간(10분 이상)은 시간만 적힌 빈 칸으로 끼워 넣습니다
    const rows = [
      ...todayEvents.map((ev) => ({ ev, allDay: ev.all_day, start: new Date(ev.start_at) })),
      ...findGaps(todayEvents).map((gap) => ({ gap, allDay: false, start: gap.start })),
    ].sort((a, b) => (a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.start - b.start));
    for (const { ev, gap } of rows) {
      if (gap) {
        const li = document.createElement('li');
        li.className = 'gap';
        li.innerHTML = '<span class="time"></span><span class="title"></span>';
        li.querySelector('.time').textContent = `${hm(gap.start)}–${hm(gap.end)}`;
        eventList.append(li);
        continue;
      }
      const li = document.createElement('li');
      // 수업 시간표는 지나간 것도 흐리게 하지 않습니다
      li.classList.toggle('past', new Date(ev.end_at).getTime() < now && !isTimetable(ev));
      li.classList.toggle('todo', ev.kind === 'todo');
      li.style.setProperty('--ev', ev.color || '#2383e2');
      li.innerHTML = '<span class="time"></span><span class="title"></span>';
      const start = new Date(ev.start_at);
      const end = new Date(ev.end_at);
      li.querySelector('.time').textContent = ev.all_day ? '종일' : `${hm(start)}–${hm(end)}`;
      li.querySelector('.title').textContent = ev.kind === 'todo' ? `○ ${ev.title} · ${periodLabel(start, end)}` : ev.title;
      if (ev.location) {
        const where = document.createElement('span');
        where.className = 'ev-place';
        where.textContent = ev.location;
        li.querySelector('.title').after(where);
      }
      eventList.append(li);
    }
  }

  async function refreshEvents() {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = addDays(from, 1);
    const [events, todos] = await Promise.all([listEventsBetween(from, to), listTodos()]);
    // 오늘 몇 교시에 하기로 정한 할 일도 일정처럼 함께 보여 줍니다
    const scheduledTodos = todos
      .filter((t) => !t.done && t.scheduled_start && new Date(t.scheduled_start) < to && new Date(t.scheduled_end) > from)
      .map((t) => ({
        id: t.id,
        title: t.title,
        start_at: t.scheduled_start,
        end_at: t.scheduled_end,
        all_day: false,
        kind: 'todo',
      }));
    todayEvents = [...events, ...scheduledTodos].sort((a, b) => {
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return new Date(a.start_at) - new Date(b.start_at);
    });
    renderEvents();
  }

  const notePad = createNotePad(document.getElementById('memo'));
  // 「지금/다음」 칸이 있던 자리: 접었다 펴는 일기장 (사이트 「일기」 탭과 같은 내용)
  const diary = createDiary(document.getElementById('diary'), { collapsible: true, rows: 7 });

  const todoList = createTodoList(document.getElementById('todo-list'), {
    showForm: false,
    onChange: () => {
      refreshEvents();
      notifyBackground();
    },
  });
  function refreshAll() {
    refreshEvents();
    todoList.refresh();
    notePad.refresh();
    diary.refresh();
  }

  refreshAll();
  // 1분마다 지난 일정을 흐리게 다시 그리고, 날짜가 바뀌면 오늘 일정을 다시 읽습니다
  let shownDay = toDateKey(new Date());
  ticker = setInterval(() => {
    updateTitle();
    if (toDateKey(new Date()) !== shownDay) {
      shownDay = toDateKey(new Date());
      refreshAll();
    } else {
      renderEvents();
    }
  }, 60000);
  // Alt+S로 패널을 열면 클릭하지 않아도 바로 쓸 수 있게 입력 칸에 커서를 둡니다
  const focusInput = () => {
    if (document.activeElement?.closest?.('#todo-list, .due-popup, .memo, .diary')) return; // 할 일 목록·마감일 팝업·메모장·일기를 쓰는 중이면 그대로 둡니다
    window.focus();
    form.text.focus();
  };
  focusInput();
  requestAnimationFrame(focusInput);
  window.addEventListener('focus', focusInput);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') focusInput();
  });
  return { refreshAll, refreshNotes: notePad.refresh, refreshDiary: diary.refresh };
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
  unsubscribeNotes?.();
  unsubscribeNotes = null;
  unsubscribeDiary?.();
  unsubscribeDiary = null;
  clearInterval(ticker);
  logoutButton.hidden = !session;
  notifyBackground();

  if (!session) {
    renderAuthForm(app);
    return;
  }
  const { refreshAll, refreshNotes, refreshDiary } = renderPanel();
  unsubscribe = subscribeChanges(() => {
    refreshAll();
    notifyBackground();
  });
  unsubscribeNotes = subscribeNotes(refreshNotes);
  unsubscribeDiary = subscribeDiary(refreshDiary);
});
