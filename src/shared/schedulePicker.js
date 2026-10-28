import { setTodoSchedule } from './api.js';
import { toDateKey, addDays, fromKeys } from './dates.js';
import { PERIODS, PERIOD_GROUPS, periodRange, findPeriodIndexes } from './timetable.js';

// 할 일 옆 작은 버튼을 누르면 뜨는 패널: 날짜와 교시를 골라 "언제 할지" 정합니다
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const dialog = document.createElement('dialog');
dialog.className = 'period-picker';
dialog.innerHTML = `
  <form method="dialog">
    <p class="todo-title"></p>
    <div class="days"></div>
    <div class="groups"></div>
    <p class="hint">여러 교시를 연속으로 하려면 첫 교시와 마지막 교시를 차례로 누르세요.</p>
    <div class="actions">
      <button type="button" class="ghost danger" data-action="clear">시간 지우기</button>
      <span class="spacer"></span>
      <button type="button" data-action="cancel">취소</button>
      <button type="submit" class="primary">저장</button>
    </div>
  </form>`;
document.body.append(dialog);

const form = dialog.querySelector('form');
const titleEl = dialog.querySelector('.todo-title');
const daysEl = dialog.querySelector('.days');
const groupsEl = dialog.querySelector('.groups');
const clearButton = dialog.querySelector('[data-action="clear"]');

let todo = null;
let onSaved = () => {};
let dateKey = null;
let selection = null; // [첫 교시, 마지막 교시] 인덱스

groupsEl.innerHTML = PERIOD_GROUPS.map(
  (group) => `
    <div class="group">
      <span class="group-name">${group}</span>
      <div class="periods">
        ${PERIODS.map((p, i) => (p.group === group ? `<button type="button" class="period" data-index="${i}"><b>${p.label}</b><small>${p.start}</small></button>` : '')).join('')}
      </div>
    </div>`,
).join('');

groupsEl.addEventListener('click', (e) => {
  const button = e.target.closest('[data-index]');
  if (!button) return;
  const i = Number(button.dataset.index);
  if (!selection || selection[0] !== selection[1]) {
    // 처음 누르거나, 이미 범위가 잡혀 있으면 새로 한 칸만 고릅니다
    selection = [i, i];
  } else if (i === selection[0]) {
    selection = null; // 같은 칸을 다시 누르면 선택 해제
  } else {
    // 두 번째로 누른 칸까지 이어서 고릅니다
    selection = [Math.min(i, selection[0]), Math.max(i, selection[0])];
  }
  renderSelection();
});

daysEl.addEventListener('click', (e) => {
  const button = e.target.closest('[data-date]');
  if (!button) return;
  dateKey = button.dataset.date;
  renderDays();
});
daysEl.addEventListener('change', (e) => {
  if (e.target.name === 'date' && e.target.value) {
    dateKey = e.target.value;
    renderDays();
  }
});

function renderDays() {
  const today = new Date();
  const choices = [
    [toDateKey(today), '오늘'],
    [toDateKey(addDays(today, 1)), '내일'],
  ];
  if (todo.due_date && !choices.some(([k]) => k === todo.due_date)) choices.push([todo.due_date, '마감일']);
  const isCustom = !choices.some(([k]) => k === dateKey);
  daysEl.innerHTML =
    choices
      .map(([key, name]) => {
        const d = fromKeys(key);
        return `<button type="button" data-date="${key}" class="${key === dateKey ? 'selected' : ''}">${name} <small>${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})</small></button>`;
      })
      .join('') + `<input type="date" name="date" value="${dateKey}" class="${isCustom ? 'selected' : ''}" aria-label="다른 날짜" />`;
}

function renderSelection() {
  for (const button of groupsEl.querySelectorAll('[data-index]')) {
    const i = Number(button.dataset.index);
    button.classList.toggle('selected', !!selection && i >= selection[0] && i <= selection[1]);
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
  if (row.scheduled_start) {
    const start = new Date(row.scheduled_start);
    dateKey = toDateKey(start);
    selection = findPeriodIndexes(start, new Date(row.scheduled_end));
  } else {
    dateKey = row.due_date && row.due_date >= toDateKey(new Date()) ? row.due_date : toDateKey(new Date());
    selection = null;
  }
  clearButton.hidden = !row.scheduled_start;
  renderDays();
  renderSelection();
  dialog.showModal();
  place(anchor);
}

// 넓은 화면에서는 버튼 옆에, 좁은 화면(사이드 패널)에서는 아래쪽에 붙여서 띄웁니다
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
  const h = dialog.offsetHeight;
  const left = Math.min(r.right + 8, window.innerWidth - w - 12);
  const top = Math.max(12, Math.min(r.top - 20, window.innerHeight - h - 12));
  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
}
