import { setTodoSchedule, listEventsBetween, listTodos } from './api.js';
import { toDateKey, addDays, fromKeys } from './dates.js';
import { PERIODS, periodRange, findPeriodIndexes, busyByPeriod } from './timetable.js';

// 할 일 아래 시계 버튼을 누르면 뜨는 패널:
// 맨 위에서 요일을 고르고, 그날 교시가 세로로 쭉 나옵니다.
// 이미 일정이 있거나 지난 교시는 회색으로 막고 옆에 일정 이름을 적습니다.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const dialog = document.createElement('dialog');
dialog.className = 'period-picker';
dialog.innerHTML = `
  <form method="dialog">
    <p class="todo-title"></p>
    <div class="week">
      <button type="button" class="icon-btn" data-week="-1" aria-label="이전 주">‹</button>
      <div class="days"></div>
      <button type="button" class="icon-btn" data-week="1" aria-label="다음 주">›</button>
    </div>
    <p class="all-day"></p>
    <ol class="rows"></ol>
    <p class="hint">여러 교시를 이어서 하려면 첫 교시와 마지막 교시를 차례로 누르세요.</p>
    <div class="actions">
      <button type="button" class="danger" data-action="clear">시간 지우기</button>
      <span class="spacer"></span>
      <button type="button" data-action="cancel">취소</button>
      <button type="submit" class="primary">저장</button>
    </div>
  </form>`;
document.body.append(dialog);

const form = dialog.querySelector('form');
const titleEl = dialog.querySelector('.todo-title');
const daysEl = dialog.querySelector('.days');
const allDayEl = dialog.querySelector('.all-day');
const rowsEl = dialog.querySelector('.rows');
const clearButton = dialog.querySelector('[data-action="clear"]');

let todo = null;
let onSaved = () => {};
let weekStart = null; // 요일 줄의 첫 날
let dateKey = null; // 고른 날
let selection = null; // [첫 교시, 마지막 교시] 인덱스
let blocked = []; // 교시마다 막혔는지
let loadToken = 0; // 요일을 빠르게 바꿀 때 늦게 온 응답을 무시하기 위한 번호

dialog.querySelector('.week').addEventListener('click', (e) => {
  const move = e.target.closest('[data-week]');
  if (move) {
    weekStart = addDays(weekStart, 7 * Number(move.dataset.week));
    const today = fromKeys(toDateKey(new Date()));
    if (weekStart < today) weekStart = today; // 지난 날로는 가지 않습니다
    renderDays();
    return;
  }
  const day = e.target.closest('[data-date]');
  if (day && !day.disabled) selectDay(day.dataset.date);
});

rowsEl.addEventListener('click', (e) => {
  const row = e.target.closest('[data-index]');
  if (!row || row.disabled) return;
  const i = Number(row.dataset.index);
  if (!selection || selection[0] !== selection[1]) {
    selection = [i, i]; // 처음 누르거나 이미 범위가 있으면 새로 한 칸
  } else if (i === selection[0]) {
    selection = null; // 같은 칸을 다시 누르면 해제
  } else {
    const range = [Math.min(i, selection[0]), Math.max(i, selection[0])];
    // 중간에 막힌 교시가 끼어 있으면 이어서 고를 수 없으니 새로 한 칸만 고릅니다
    const crossesBlocked = blocked.slice(range[0], range[1] + 1).some(Boolean);
    selection = crossesBlocked ? [i, i] : range;
  }
  renderSelection();
});

function renderDays() {
  const todayKey = toDateKey(new Date());
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const key = toDateKey(d);
    const classes = [key === dateKey ? 'selected' : '', d.getDay() === 0 ? 'sun' : '', d.getDay() === 6 ? 'sat' : '']
      .filter(Boolean)
      .join(' ');
    html += `<button type="button" data-date="${key}" class="${classes}">
      <b>${WEEKDAYS[d.getDay()]}</b><small>${key === todayKey ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`}</small>
    </button>`;
  }
  daysEl.innerHTML = html;
}

async function selectDay(key) {
  if (key !== dateKey) selection = null;
  dateKey = key;
  renderDays();
  rowsEl.classList.add('loading');
  const token = ++loadToken;

  const from = fromKeys(key);
  const to = addDays(from, 1);
  const [events, todos] = await Promise.all([listEventsBetween(from, to), listTodos()]);
  if (token !== loadToken) return;

  // 이 할 일 자신은 빼고, 그날의 일정과 다른 할 일(교시를 정한 것)을 모읍니다
  const timed = events
    .filter((ev) => !ev.all_day)
    .map((ev) => ({ title: ev.title, start: new Date(ev.start_at), end: new Date(ev.end_at) }));
  const otherTodos = todos
    .filter((t) => t.id !== todo.id && !t.done && t.scheduled_start)
    .map((t) => ({ title: '○ ' + t.title, start: new Date(t.scheduled_start), end: new Date(t.scheduled_end) }));
  const busy = busyByPeriod(key, [...timed, ...otherTodos]);

  const allDay = events.filter((ev) => ev.all_day).map((ev) => ev.title);
  allDayEl.textContent = allDay.length ? `종일: ${allDay.join(', ')}` : '';
  allDayEl.hidden = allDay.length === 0;

  const now = new Date();
  blocked = PERIODS.map((p, i) => busy[i].length > 0 || fromKeys(key, p.end) <= now);
  if (selection && blocked.slice(selection[0], selection[1] + 1).some(Boolean)) selection = null;

  rowsEl.innerHTML = PERIODS.map((p, i) => {
    return `<li><button type="button" class="row" data-index="${i}" ${blocked[i] ? 'disabled' : ''}>
      <span class="name">${p.label}</span>
      <span class="time">${p.start}</span>
      <span class="what"></span>
    </button></li>`;
  }).join('');
  // 일정 이름은 사용자가 쓴 글이라 textContent로 넣습니다
  rowsEl.querySelectorAll('.what').forEach((el, i) => {
    const past = fromKeys(key, PERIODS[i].end) <= now;
    el.textContent = busy[i].join(', ') || (past ? '지난 시간' : '');
  });
  rowsEl.classList.remove('loading');
  renderSelection();
}

function renderSelection() {
  for (const row of rowsEl.querySelectorAll('[data-index]')) {
    const i = Number(row.dataset.index);
    row.classList.toggle('selected', !!selection && i >= selection[0] && i <= selection[1]);
  }
}

form.querySelector('[data-action="cancel"]').addEventListener('click', () => dialog.close());
clearButton.addEventListener('click', async () => {
  await setTodoSchedule(todo.id, null, null);
  dialog.close();
  onSaved();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selection) {
    dialog.close();
    return;
  }
  const { startAt, endAt } = periodRange(dateKey, selection[0], selection[1]);
  await setTodoSchedule(todo.id, startAt, endAt);
  dialog.close();
  onSaved();
});

// 바깥(어두운 부분)을 누르면 닫습니다
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

export function openPeriodPicker(row, anchor, saved) {
  todo = row;
  onSaved = saved;
  titleEl.textContent = row.title;
  const todayKey = toDateKey(new Date());
  let key = todayKey;
  selection = null;
  if (row.scheduled_start && toDateKey(new Date(row.scheduled_start)) >= todayKey) {
    const start = new Date(row.scheduled_start);
    key = toDateKey(start);
    selection = findPeriodIndexes(start, new Date(row.scheduled_end));
  }
  // 요일 줄은 오늘부터 시작하고, 고른 날이 그 뒤 주에 있으면 그 주를 보여 줍니다
  weekStart = fromKeys(todayKey);
  while (fromKeys(key) >= addDays(weekStart, 7)) weekStart = addDays(weekStart, 7);
  clearButton.hidden = !row.scheduled_start;
  rowsEl.innerHTML = '';
  allDayEl.hidden = true;
  dateKey = null;
  const keep = selection;
  dialog.showModal();
  place(anchor);
  selectDay(key).then(() => {
    // 처음 열 때는 저장돼 있던 선택을 다시 보여 줍니다 (막힌 칸과 겹치면 selectDay가 지웁니다)
    if (keep && !selection && !blocked.slice(keep[0], keep[1] + 1).some(Boolean)) {
      selection = keep;
      renderSelection();
    }
  });
}

// 넓은 화면에서는 버튼 옆에, 좁은 화면(사이드 패널)에서는 아래에서 올라오게 띄웁니다
function place(anchor) {
  dialog.style.margin = '0';
  const narrow = window.innerWidth < 560;
  dialog.classList.toggle('sheet', narrow);
  if (narrow) {
    dialog.style.left = '0';
    dialog.style.top = 'auto';
    return;
  }
  const r = anchor.getBoundingClientRect();
  const w = dialog.offsetWidth;
  const left = Math.min(r.right + 8, window.innerWidth - w - 12);
  dialog.style.left = `${left}px`;
  dialog.style.top = '12px';
}
