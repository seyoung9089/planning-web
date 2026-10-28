import { addEvent, updateEvent, deleteEvent } from './shared/api.js';
import { toDateKey, toTimeKey, fromKeys, addDays, parseTime } from './shared/dates.js';
import { EVENT_COLORS, DEFAULT_COLOR } from './colors.js';

const dialog = document.createElement('dialog');
dialog.className = 'event-dialog';
dialog.innerHTML = `
  <form method="dialog">
    <input name="title" class="title-input" placeholder="제목 추가" maxlength="200" required autocomplete="off" />
    <label class="check"><input name="allDay" type="checkbox" /> 하루 종일</label>
    <div class="when">
      <input name="startDate" type="date" required aria-label="시작 날짜" />
      <input name="startTime" class="time-input" placeholder="13:05" maxlength="12" autocomplete="off" aria-label="시작 시간" />
      <span class="dash">–</span>
      <input name="endDate" type="date" required aria-label="끝 날짜" />
      <input name="endTime" class="time-input" placeholder="14:00" maxlength="12" autocomplete="off" aria-label="끝 시간" />
    </div>
    <div class="colors" role="radiogroup" aria-label="색상">
      ${EVENT_COLORS.map(
        (c) => `<label title="${c.name}"><input type="radio" name="color" value="${c.value}" /><span style="background:${c.value}"></span></label>`,
      ).join('')}
    </div>
    <textarea name="memo" rows="2" placeholder="메모 (선택)" maxlength="1000"></textarea>
    <p class="message" role="status"></p>
    <div class="actions">
      <button type="button" class="danger" data-action="delete">삭제</button>
      <span class="spacer"></span>
      <button type="button" data-action="cancel">취소</button>
      <button type="submit" class="primary">저장</button>
    </div>
  </form>`;
document.body.append(dialog);

const form = dialog.querySelector('form');
const message = form.querySelector('.message');
const deleteButton = form.querySelector('[data-action="delete"]');
let editingId = null;
let onSaved = () => {};

function syncAllDay() {
  const allDay = form.allDay.checked;
  form.startTime.hidden = allDay;
  form.endTime.hidden = allDay;
}
form.allDay.addEventListener('change', () => {
  if (!form.allDay.checked && !form.startTime.value) {
    form.startTime.value = '09:00';
    form.endTime.value = '10:00';
  }
  syncAllDay();
});

// 시간은 직접 씁니다. "1305", "오후 1시 5분"처럼 써도 13:05로 고쳐 주고, 못 알아보면 빨간 테두리와 안내를 띄웁니다
const TIME_ERROR = '시간 형식이 맞지 않습니다. 13:05처럼 써 주세요.';
function readTime(input) {
  const value = parseTime(input.value);
  input.classList.toggle('invalid', !value);
  input.setAttribute('aria-invalid', String(!value));
  if (value) input.value = value;
  return value;
}
for (const input of [form.startTime, form.endTime]) {
  input.addEventListener('input', () => input.classList.remove('invalid'));
  input.addEventListener('change', () => {
    message.textContent = readTime(input) ? '' : TIME_ERROR;
  });
}

// 시작 시간을 바꾸면 길이(예: 1시간)를 유지한 채 끝 시간도 같이 옮깁니다
let lastStart = null;
function rememberStart() {
  const time = parseTime(form.startTime.value);
  lastStart = time && form.startDate.value ? fromKeys(form.startDate.value, time) : null;
}
form.startTime.addEventListener('focus', rememberStart);
form.startDate.addEventListener('focus', rememberStart);
for (const input of [form.startDate, form.startTime]) {
  input.addEventListener('change', () => {
    const startTime = form.allDay.checked ? '00:00' : parseTime(form.startTime.value);
    const endTime = form.allDay.checked ? '00:00' : parseTime(form.endTime.value);
    if (!lastStart || !form.startDate.value || !startTime || !endTime) return;
    const newStart = fromKeys(form.startDate.value, startTime);
    const oldEnd = fromKeys(form.endDate.value, endTime);
    const newEnd = new Date(oldEnd.getTime() + (newStart - lastStart));
    form.endDate.value = toDateKey(newEnd);
    if (!form.allDay.checked) form.endTime.value = toTimeKey(newEnd);
    lastStart = newStart;
  });
}

form.querySelector('[data-action="cancel"]').addEventListener('click', () => dialog.close());

deleteButton.addEventListener('click', async () => {
  if (!editingId) return;
  try {
    await deleteEvent(editingId);
    dialog.close();
    onSaved();
  } catch (err) {
    message.textContent = '삭제 실패: ' + err.message;
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.textContent = '';
  const allDay = form.allDay.checked;
  const startTime = allDay ? '00:00' : readTime(form.startTime);
  const endTime = allDay ? '00:00' : readTime(form.endTime);
  if (!startTime || !endTime) {
    message.textContent = TIME_ERROR;
    (startTime ? form.endTime : form.startTime).focus();
    return;
  }
  const startAt = fromKeys(form.startDate.value, startTime);
  // 하루 종일 일정은 "끝 날짜의 다음 날 0시"로 저장합니다 (캘린더 라이브러리 규칙)
  const endAt = allDay ? addDays(fromKeys(form.endDate.value), 1) : fromKeys(form.endDate.value, endTime);
  if (endAt <= startAt) {
    message.textContent = '끝나는 시간이 시작 시간보다 늦어야 합니다.';
    return;
  }
  const fields = {
    title: form.title.value.trim(),
    startAt,
    endAt,
    allDay,
    color: form.color.value || DEFAULT_COLOR,
    memo: form.memo.value.trim() || null,
  };
  try {
    if (editingId) await updateEvent(editingId, fields);
    else await addEvent(fields);
    dialog.close();
    onSaved();
  } catch (err) {
    message.textContent = '저장 실패: ' + err.message;
  }
});

// 새 일정 만들기: start/end는 캘린더에서 고른 범위입니다
export function openNewEvent({ start, end, allDay }, saved) {
  fill({ title: '', start, end, allDay, color: DEFAULT_COLOR, memo: '' });
  editingId = null;
  onSaved = saved;
  deleteButton.hidden = true;
  dialog.showModal();
}

// 기존 일정 수정하기
export function openEditEvent(row, saved) {
  fill({
    title: row.title,
    start: new Date(row.start_at),
    end: new Date(row.end_at),
    allDay: row.all_day,
    color: row.color || DEFAULT_COLOR,
    memo: row.memo || '',
  });
  editingId = row.id;
  onSaved = saved;
  deleteButton.hidden = false;
  dialog.showModal();
}

function fill({ title, start, end, allDay, color, memo }) {
  message.textContent = '';
  form.title.value = title;
  form.allDay.checked = allDay;
  form.startDate.value = toDateKey(start);
  form.endDate.value = toDateKey(allDay ? addDays(end, -1) : end);
  form.startTime.value = allDay ? '' : toTimeKey(start);
  form.endTime.value = allDay ? '' : toTimeKey(end);
  form.memo.value = memo;
  for (const input of [form.startTime, form.endTime]) input.classList.remove('invalid');
  for (const radio of form.querySelectorAll('[name="color"]')) radio.checked = radio.value === color;
  syncAllDay();
}
