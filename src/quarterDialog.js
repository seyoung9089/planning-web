// 쿼터 시간표 등록 창: 요일 × 교시 표에 수업 이름을 쓰고, 시작일만 정하면 그 쿼터(9주) 동안 매주 들어갑니다
import { getQuarterSetting, saveQuarterSetting, listTimetableBetween, addEvents, deleteEvents } from './shared/api.js';
import { GRID_ROWS, GRID_DAYS, DEFAULT_WEEKS, quarterRange, blocksFromGrid, gridFromEvents, expandTemplates, rowsToReplace } from './shared/quarterPlan.js';
import { fromKeys, toDateKey, addDays } from './shared/dates.js';
import { EVENT_COLORS, DEFAULT_COLOR } from './colors.js';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const short = (key) => {
  const d = fromKeys(key);
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
};
const fmtTime = (hm) => hm.replace(/^0/, '');

const dialog = document.createElement('dialog');
dialog.className = 'quarter-dialog';
dialog.innerHTML = `
  <form method="dialog">
    <header class="q-head">
      <h2>🗓 쿼터 시간표 등록</h2>
      <p class="lead">칸에 수업 이름을 쓰면 됩니다. 같은 이름을 이어서 쓴 교시는 하나의 수업으로 합쳐져요. <kbd>Enter</kbd>는 아래 칸으로 이동합니다.</p>
    </header>
    <div class="q-range">
      <label>쿼터 시작일 <input name="start" type="date" required /></label>
      <label>기간 <select name="weeks"></select></label>
      <span class="range-text"></span>
    </div>
    <div class="q-grid-wrap"><table class="q-grid"></table></div>
    <datalist id="q-names"></datalist>
    <section class="q-colors" hidden>
      <h3>수업 색</h3>
      <ul></ul>
    </section>
    <section class="q-extras" hidden>
      <h3>교시 칸에 안 맞는 반복 수업 <small>(그대로 매주 넣습니다. 빼려면 ✕)</small></h3>
      <ul></ul>
    </section>
    <p class="q-summary" role="status"></p>
    <p class="message" role="alert"></p>
    <div class="actions">
      <button type="button" data-action="clear" class="ghost">표 비우기</button>
      <span class="spacer"></span>
      <button type="button" data-action="cancel">취소</button>
      <button type="submit" class="primary">이 쿼터에 저장</button>
    </div>
  </form>`;
document.body.append(dialog);

const form = dialog.querySelector('form');
const table = dialog.querySelector('.q-grid');
const names = dialog.querySelector('#q-names');
const colorSection = dialog.querySelector('.q-colors');
const extrasSection = dialog.querySelector('.q-extras');
const summary = dialog.querySelector('.q-summary');
const message = dialog.querySelector('.message');
const saveButton = form.querySelector('[type="submit"]');

for (let w = 4; w <= 20; w++) form.weeks.add(new Option(`${w}주`, String(w)));

// 표 만들기: 줄 = 교시, 칸 = 요일
table.innerHTML = `
  <thead><tr><th></th>${GRID_DAYS.map((d) => `<th class="${d.dow === 0 || d.dow === 6 ? 'weekend' : ''}">${d.label}</th>`).join('')}</tr></thead>
  <tbody>${GRID_ROWS.map(
    (r, i) => `<tr>
      <th><b>${r.label}</b><small>${fmtTime(r.start)}~${fmtTime(r.end)}</small></th>
      ${GRID_DAYS.map(
        (d) => `<td class="${d.dow === 0 || d.dow === 6 ? 'weekend' : ''}"><input data-dow="${d.dow}" data-row="${i}" list="q-names" maxlength="200" autocomplete="off" aria-label="${d.label} ${r.label}" /></td>`,
      ).join('')}
    </tr>`,
  ).join('')}</tbody>`;
const inputs = [...table.querySelectorAll('input')];
const cellAt = (dow, row) => table.querySelector(`input[data-dow="${dow}"][data-row="${row}"]`);

let colors = {}; // 수업 이름 → 색
let extras = []; // 교시에 안 맞는 반복 수업
let onSaved = () => {};
let existing = []; // 새 기간 안의 기존 수업 일정
let loadToken = 0;

function readCells() {
  const cells = {};
  for (const input of inputs) {
    if (!input.value.trim()) continue;
    (cells[input.dataset.dow] ||= {})[input.dataset.row] = input.value;
  }
  return cells;
}

function currentRange() {
  return form.start.value ? quarterRange(form.start.value, Number(form.weeks.value)) : null;
}

function templates() {
  const list = [...blocksFromGrid(readCells()), ...extras];
  return list.map((t) => ({ ...t, color: colors[t.title] || DEFAULT_COLOR }));
}

function newEvents() {
  const range = currentRange();
  return range ? expandTemplates(templates(), range) : [];
}

// 칸 색칠 + 같은 수업이 이어지는 칸은 테두리를 지워 한 덩어리로 보이게 합니다
function paint() {
  for (const input of inputs) {
    const title = input.value.trim();
    const td = input.parentElement;
    td.style.setProperty('--c', title ? colors[title] || DEFAULT_COLOR : 'transparent');
    td.classList.toggle('filled', !!title);
    const below = cellAt(input.dataset.dow, Number(input.dataset.row) + 1);
    td.classList.toggle('joined', !!title && below?.value.trim() === title);
    const above = cellAt(input.dataset.dow, Number(input.dataset.row) - 1);
    td.classList.toggle('cont', !!title && above?.value.trim() === title);
  }
  const titles = [...new Set([...inputs.map((i) => i.value.trim()), ...extras.map((e) => e.title)].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ko'),
  );
  for (const t of titles) colors[t] ||= DEFAULT_COLOR;
  colorSection.hidden = titles.length === 0;
  colorSection.querySelector('ul').innerHTML = titles
    .map(
      (t, ti) => `<li><span class="name"></span><span class="dots">${EVENT_COLORS.map(
        (c) => `<button type="button" class="dot${colors[t] === c.value ? ' on' : ''}" data-title-index="${ti}" data-color="${c.value}" title="${c.name}" style="background:${c.value}"></button>`,
      ).join('')}</span></li>`,
    )
    .join('');
  colorSection.querySelectorAll('.name').forEach((el, i) => (el.textContent = titles[i]));
  colorSection.dataset.titles = JSON.stringify(titles);

  extrasSection.hidden = extras.length === 0;
  extrasSection.querySelector('ul').innerHTML = extras
    .map((e, i) => `<li><span>${DAY_NAMES[e.dow]} ${fmtTime(e.start)}~${fmtTime(e.end)}</span> <span class="name"></span> <button type="button" class="x" data-extra="${i}" aria-label="빼기">✕</button></li>`)
    .join('');
  extrasSection.querySelectorAll('.name').forEach((el, i) => (el.textContent = extras[i].title));

  names.innerHTML = '';
  for (const t of titles) names.append(new Option(t));
  updateSummary();
}

function updateSummary() {
  const range = currentRange();
  if (!range) {
    summary.textContent = '쿼터 시작일을 골라 주세요.';
    return;
  }
  dialog.querySelector('.range-text').textContent = `${short(range.start)} ~ ${short(range.end)}`;
  const events = newEvents();
  const removing = rowsToReplace(existing, events).length;
  summary.textContent =
    `저장하면 ${short(range.start)}~${short(range.end)}에 수업 ${events.length}개가 들어갑니다.` +
    (removing ? ` 이 기간에 있던 기존 반복 수업 ${removing}개는 지우고 새 시간표로 바꿉니다.` : '') +
    ' 한 번만 있는 일정은 그대로 둡니다.';
}

// 시작일·기간이 바뀌면 그 기간에 이미 들어 있는 수업을 다시 불러옵니다
async function loadExisting() {
  const range = currentRange();
  const token = ++loadToken;
  existing = [];
  if (!range) return updateSummary();
  summary.textContent = '이 기간의 기존 수업을 확인하는 중…';
  saveButton.disabled = true;
  try {
    const rows = await listTimetableBetween(fromKeys(range.start), addDays(fromKeys(range.end), 1));
    if (token !== loadToken) return;
    existing = rows;
  } catch (err) {
    message.textContent = '기존 수업을 불러오지 못했습니다: ' + err.message;
  }
  saveButton.disabled = false;
  updateSummary();
}

table.addEventListener('input', paint);
table.addEventListener('keydown', (e) => {
  const input = e.target.closest('input');
  if (!input || e.isComposing) return;
  const row = Number(input.dataset.row);
  let next = null;
  if (e.key === 'Enter' || e.key === 'ArrowDown') next = cellAt(input.dataset.dow, e.shiftKey && e.key === 'Enter' ? row - 1 : row + 1);
  else if (e.key === 'ArrowUp') next = cellAt(input.dataset.dow, row - 1);
  else return;
  e.preventDefault();
  next?.focus();
  next?.select();
});
colorSection.addEventListener('click', (e) => {
  const dot = e.target.closest('.dot');
  if (!dot) return;
  const titles = JSON.parse(colorSection.dataset.titles);
  colors[titles[Number(dot.dataset.titleIndex)]] = dot.dataset.color;
  paint();
});
extrasSection.addEventListener('click', (e) => {
  const x = e.target.closest('[data-extra]');
  if (!x) return;
  extras.splice(Number(x.dataset.extra), 1);
  paint();
});
form.start.addEventListener('change', loadExisting);
form.weeks.addEventListener('change', loadExisting);
form.querySelector('[data-action="cancel"]').addEventListener('click', () => dialog.close());
form.querySelector('[data-action="clear"]').addEventListener('click', () => {
  for (const input of inputs) input.value = '';
  extras = [];
  paint();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.textContent = '';
  const range = currentRange();
  if (!range) return;
  const events = newEvents();
  saveButton.disabled = true;
  saveButton.textContent = '저장 중…';
  try {
    // 새 수업을 먼저 넣고 나서 옛 수업을 지웁니다 (중간에 실패해도 시간표가 통째로 사라지지 않게)
    const oldIds = rowsToReplace(existing, events);
    await addEvents(events);
    await deleteEvents(oldIds);
    await saveQuarterSetting(range.start, range.weeks);
    dialog.close();
    onSaved(range);
  } catch (err) {
    message.textContent = '저장 실패: ' + err.message;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = '이 쿼터에 저장';
  }
});

// 다음 월요일 (오늘이 월요일이면 오늘)
function nextMonday(from = new Date()) {
  const d = fromKeys(toDateKey(from));
  return addDays(d, (8 - d.getDay()) % 7);
}

export async function openQuarterDialog(saved = () => {}) {
  onSaved = saved;
  message.textContent = '';
  for (const input of inputs) input.value = '';
  colors = {};
  extras = [];
  form.weeks.value = String(DEFAULT_WEEKS);
  dialog.showModal();

  // 지난(또는 지금) 쿼터 시간표로 표를 미리 채워서, 바뀐 수업만 고치면 되게 합니다
  let setting = null;
  try {
    setting = await getQuarterSetting();
  } catch {
    /* 설정이 없어도 창은 씁니다 */
  }
  const today = toDateKey(new Date());
  const last = setting ? quarterRange(setting.start, setting.weeks) : null;
  const source = last || { start: toDateKey(addDays(new Date(), -63)), end: toDateKey(addDays(new Date(), 63)) };
  if (last) form.weeks.value = String(setting.weeks);
  // 지금이 저장된 쿼터 안이면 그 쿼터를 고치는 것으로, 지났으면 다음 쿼터로 봅니다
  form.start.value = last && today <= last.end ? last.start : toDateKey(nextMonday());
  try {
    const rows = await listTimetableBetween(fromKeys(source.start), addDays(fromKeys(source.end), 1));
    const grid = gridFromEvents(rows);
    for (const [dow, col] of Object.entries(grid.cells)) {
      for (const [row, title] of Object.entries(col)) cellAt(dow, row).value = title;
    }
    colors = grid.colors;
    extras = grid.extras;
  } catch (err) {
    message.textContent = '지난 시간표를 불러오지 못했습니다: ' + err.message;
  }
  paint();
  await loadExisting();
  inputs[GRID_DAYS.length]?.focus(); // 1교시 월요일 칸
}
