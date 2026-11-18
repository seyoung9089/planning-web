// 일기장: 날짜와 상관없이 한 장씩 쌓입니다. 사이트 「일기」 탭과 사이드 패널이 함께 씁니다
// ‹ 왼쪽 화살표 = 이전 장, 오른쪽 = 다음 장(›). 마지막 장에서는 오른쪽 버튼이 「+」(새 장 만들기)로 바뀝니다
// 쓰는 동안 잠깐 멈추면 자동 저장됩니다
import { listDiary, addDiary, updateDiary, deleteDiary } from './api.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const SAVE_DELAY = 700;

// "11월 18일 (수) 13:40"
function stamp(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function loadFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function saveFlag(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* 저장 못 해도 동작에는 문제없음 */
  }
}

/**
 * @param {HTMLElement} container
 * @param {{ collapsible?: boolean, rows?: number }} options
 *   collapsible: 사이드 패널처럼 한 줄로 접었다 펴기
 */
export function createDiary(container, { collapsible = false, rows = 6 } = {}) {
  const OPEN_KEY = 'diary-open';
  container.classList.add('diary');
  container.innerHTML = `
    ${collapsible ? `
    <button type="button" class="diary-toggle" aria-expanded="false">
      <span class="diary-arrow" aria-hidden="true">›</span>
      <span class="diary-name">일기</span>
      <span class="diary-count"></span>
    </button>` : ''}
    <div class="diary-body">
      <div class="diary-nav">
        <button type="button" class="diary-prev" aria-label="이전 일기" title="이전 일기">‹</button>
        <div class="diary-where">
          <strong class="diary-page"></strong>
          <span class="diary-date"></span>
        </div>
        <button type="button" class="diary-next"></button>
      </div>
      <textarea class="diary-text" rows="${rows}" maxlength="20000" aria-label="일기 쓰기"></textarea>
      <div class="diary-foot">
        <span class="diary-status" aria-live="polite"></span>
        <button type="button" class="diary-del">이 장 지우기</button>
      </div>
    </div>`;

  const toggle = container.querySelector('.diary-toggle');
  const body = container.querySelector('.diary-body');
  const count = container.querySelector('.diary-count');
  const prevBtn = container.querySelector('.diary-prev');
  const nextBtn = container.querySelector('.diary-next');
  const pageEl = container.querySelector('.diary-page');
  const dateEl = container.querySelector('.diary-date');
  const text = container.querySelector('.diary-text');
  const status = container.querySelector('.diary-status');
  const delBtn = container.querySelector('.diary-del');

  let entries = []; // 오래된 것부터
  let idx = 0; // entries.length 이면 아직 저장 안 한 새 장
  let loaded = false;
  let timer = null;
  let chain = Promise.resolve(); // 저장을 하나씩 차례로 (새 장이 두 번 만들어지지 않게)

  const isDraft = () => idx >= entries.length;
  const current = () => (isDraft() ? null : entries[idx]);

  if (collapsible) {
    const setOpen = (open, focus = false) => {
      body.hidden = !open;
      container.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      saveFlag(OPEN_KEY, open);
      if (open && focus) text.focus();
    };
    toggle.addEventListener('click', () => {
      if (!body.hidden) flush();
      setOpen(body.hidden, true);
    });
    setOpen(loadFlag(OPEN_KEY));
  }

  function render() {
    const total = entries.length;
    if (count) count.textContent = total ? `${total}장` : '';
    const entry = current();
    if (entry) {
      pageEl.textContent = `${idx + 1} / ${total}`;
      dateEl.textContent = stamp(entry.created_at);
      text.placeholder = '';
    } else {
      pageEl.textContent = total ? `새 일기 · ${total + 1}장째` : '첫 일기';
      dateEl.textContent = '';
      text.placeholder = '오늘 있었던 일, 느낀 점을 자유롭게 써 보세요. 쓰면 자동 저장돼요.';
    }
    text.value = entry ? entry.body : (text.dataset.draft ?? '');
    prevBtn.disabled = idx === 0;
    // 오른쪽 버튼: 마지막 장(또는 새 장)에서는 「+」, 앞쪽 장에서는 「›」
    const atEnd = idx >= entries.length - 1;
    nextBtn.textContent = atEnd ? '+' : '›';
    nextBtn.classList.toggle('plus', atEnd);
    nextBtn.setAttribute('aria-label', atEnd ? '새 일기 만들기' : '다음 일기');
    nextBtn.title = atEnd ? '새 일기 만들기' : '다음 일기';
    nextBtn.disabled = isDraft(); // 이미 새 장이면 또 만들 필요 없음
    delBtn.hidden = !entry;
  }

  function saveNow() {
    clearTimeout(timer);
    timer = null;
    const value = text.value;
    const entry = current();
    chain = chain
      .then(async () => {
        if (entry) {
          if (entry.body === value) return;
          await updateDiary(entry.id, value);
          entry.body = value;
        } else {
          if (!value.trim()) return;
          const row = await addDiary(value);
          // 저장하는 사이 화면이 바뀌지 않았으면 이 장이 방금 만든 일기가 됩니다
          if (!entries.some((e) => e.id === row.id)) entries.push(row);
          if (isDraft() && text.value === value) idx = entries.indexOf(row);
          delete text.dataset.draft;
          render();
        }
        status.textContent = '저장됨';
        status.classList.remove('error');
      })
      .catch((err) => {
        status.textContent = '저장 실패: ' + err.message;
        status.classList.add('error');
      });
    return chain;
  }
  const flush = () => (timer ? saveNow() : chain);

  text.addEventListener('input', () => {
    if (isDraft()) text.dataset.draft = text.value;
    status.textContent = '쓰는 중…';
    status.classList.remove('error');
    clearTimeout(timer);
    timer = setTimeout(saveNow, SAVE_DELAY);
  });
  text.addEventListener('blur', () => flush());

  // 다른 장으로 넘어갑니다. 비워 둔 장은 남기지 않고 지웁니다
  async function go(newIdx) {
    await flush();
    const leaving = current();
    if (leaving && !leaving.body.trim() && entries.length > 0) {
      try {
        await deleteDiary(leaving.id);
        const at = entries.indexOf(leaving);
        entries.splice(at, 1);
        if (newIdx > at) newIdx -= 1;
      } catch {
        /* 못 지우면 그냥 둡니다 */
      }
    }
    idx = Math.max(0, Math.min(newIdx, entries.length));
    status.textContent = '';
    render();
    text.focus();
  }

  prevBtn.addEventListener('click', () => go(idx - 1));
  nextBtn.addEventListener('click', () => {
    if (idx < entries.length - 1) go(idx + 1);
    else go(entries.length); // 새 장
  });

  delBtn.addEventListener('click', async () => {
    const entry = current();
    if (!entry) return;
    if (entry.body.trim() && !window.confirm('이 일기를 지울까요? 되돌릴 수 없습니다.')) return;
    clearTimeout(timer);
    timer = null;
    try {
      await deleteDiary(entry.id);
      entries = entries.filter((e) => e !== entry);
      idx = Math.max(0, Math.min(idx, entries.length - 1));
      if (entries.length === 0) idx = 0;
      status.textContent = '지웠어요';
      render();
    } catch (err) {
      status.textContent = '지우기 실패: ' + err.message;
      status.classList.add('error');
    }
  });

  // 처음 열 때는 가장 최근 장을 보여 줍니다. 다른 곳(사이트↔패널)에서 바뀌면 다시 읽습니다
  async function refresh() {
    try {
      const keepId = current()?.id;
      const wasDraft = loaded && isDraft();
      const fresh = await listDiary();
      // 내가 쓰고 있는 장은 화면 글을 그대로 둡니다
      const typing = timer || document.activeElement === text;
      const mine = current();
      entries = fresh.map((row) => (typing && mine && row.id === mine.id ? { ...row, body: mine.body } : row));
      if (!loaded) {
        idx = Math.max(0, entries.length - 1);
        loaded = true;
      } else if (wasDraft) {
        idx = entries.length;
      } else {
        const at = entries.findIndex((e) => e.id === keepId);
        idx = at >= 0 ? at : Math.max(0, entries.length - 1);
      }
      if (typing && current()?.id === keepId && keepId) {
        // 글 칸은 건드리지 않고 위 줄(쪽수·버튼)만 다시 그립니다
        const value = text.value;
        render();
        text.value = value;
      } else if (typing && wasDraft) {
        const value = text.value;
        render();
        text.value = value;
      } else {
        render();
      }
    } catch (err) {
      status.textContent = '일기를 못 불러왔어요: ' + err.message;
      status.classList.add('error');
    }
  }

  render();
  return { refresh, flush };
}
