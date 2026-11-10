// 할 일 입력 칸 바로 아래의 접었다 펴는 메모장
// 접힌 상태: 「메모장 N」 한 줄만. 펼치면 메모 전용 입력 칸 + 최근 메모 목록
import { listNotes, addNote, deleteNote } from '../src/shared/api.js';
import { toDateKey, addDays } from '../src/shared/dates.js';

const OPEN_KEY = 'notepad-open';
const pad = (n) => String(n).padStart(2, '0');

// 펼침 여부는 이 컴퓨터에만 기억합니다 (못 읽으면 접힌 채로 시작)
function loadOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}
function saveOpen(open) {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    /* 저장 못 해도 동작에는 문제없음 */
  }
}

// "14:02", "어제 21:10", "11/3 09:00"
function whenText(iso) {
  const d = new Date(iso);
  const key = toDateKey(d);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (key === toDateKey(new Date())) return time;
  if (key === toDateKey(addDays(new Date(), -1))) return `어제 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export function createNotePad(container) {
  container.innerHTML = `
    <button type="button" class="memo-toggle" aria-expanded="false" aria-controls="memo-body">
      <span class="memo-arrow" aria-hidden="true">›</span>
      <span class="memo-name">메모장</span>
      <span class="memo-count"></span>
    </button>
    <div class="memo-body" id="memo-body" hidden>
      <form class="memo-add">
        <textarea name="body" rows="2" maxlength="2000" placeholder="메모를 쓰고 Enter (줄바꿈은 Shift+Enter)" aria-label="메모 쓰기"></textarea>
      </form>
      <p class="memo-status" aria-live="polite"></p>
      <ul class="memo-list"></ul>
    </div>`;
  const toggle = container.querySelector('.memo-toggle');
  const body = container.querySelector('.memo-body');
  const count = container.querySelector('.memo-count');
  const form = container.querySelector('.memo-add');
  const status = container.querySelector('.memo-status');
  const list = container.querySelector('.memo-list');
  let notes = [];

  function setOpen(open, focus = false) {
    body.hidden = !open;
    container.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    saveOpen(open);
    if (open && focus) form.body.focus();
  }
  toggle.addEventListener('click', () => setOpen(body.hidden, true));
  setOpen(loadOpen());

  function render() {
    count.textContent = notes.length ? String(notes.length) : '';
    list.innerHTML = '';
    if (notes.length === 0) {
      list.innerHTML = '<li class="memo-empty">아직 메모가 없습니다. 위 칸이나 할 일 칸에 「메모 …」로 써 보세요.</li>';
      return;
    }
    for (const note of notes) {
      const li = document.createElement('li');
      li.innerHTML = `
        <p class="memo-text"></p>
        <span class="memo-time"></span>
        <button type="button" class="memo-del" title="메모 지우기" aria-label="메모 지우기">×</button>`;
      li.querySelector('.memo-text').textContent = note.body;
      li.querySelector('.memo-time').textContent = whenText(note.created_at);
      li.querySelector('.memo-del').addEventListener('click', async () => {
        try {
          await deleteNote(note.id);
          refresh();
        } catch (err) {
          status.textContent = '지우기 실패: ' + err.message;
        }
      });
      list.append(li);
    }
  }

  async function refresh() {
    try {
      notes = await listNotes();
      render();
    } catch (err) {
      status.textContent = '메모를 못 불러왔어요: ' + err.message;
    }
  }

  async function save() {
    const text = form.body.value.trim();
    if (!text) return;
    try {
      await addNote(text);
      form.body.value = '';
      status.textContent = '';
      refresh();
    } catch (err) {
      status.textContent = '메모 저장 실패: ' + err.message;
    }
  }
  form.body.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });

  return { refresh };
}
