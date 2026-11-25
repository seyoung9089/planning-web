// 사이트 키보드 단축키. 글자를 쓰는 중(입력 칸·글 칸)이나 창이 열려 있을 때는 동작하지 않습니다
// 한글 자판이어도 되도록 e.key 대신 자판 위치(e.code)로 봅니다
const SHORTCUTS = [
  ['T', '오늘로 가기'],
  ['← / →', '이전 / 다음'],
  ['M / W / D', '월 / 주 / 일 보기'],
  ['N 또는 /', '할 일 입력 칸으로'],
  ['?', '이 목록 보기'],
  ['Esc', '창·메뉴 닫기'],
];

const dialog = document.createElement('dialog');
dialog.className = 'shortcut-dialog';
dialog.innerHTML = `
  <h2>단축키</h2>
  <dl>${SHORTCUTS.map(([k, v]) => `<dt>${k.split(' ').map((x) => (/^[a-zA-Z?/←→]|Esc/.test(x) ? `<kbd>${x}</kbd>` : x)).join(' ')}</dt><dd>${v}</dd>`).join('')}</dl>
  <p class="note">글자를 쓰는 중에는 단축키가 동작하지 않아요.</p>
  <form method="dialog"><button class="primary">닫기</button></form>`;
document.body.append(dialog);

export function openShortcutHelp() {
  if (!dialog.open) dialog.showModal();
}

function isTyping(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

// calendar: createCalendar가 돌려준 객체. isCalendarTab: 지금 캘린더 탭인지. focusInput: 할 일 입력 칸으로
export function attachShortcuts({ calendar, isCalendarTab, focusInput }) {
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
    const code = e.code;
    if (e.key === '?' || (code === 'Slash' && e.shiftKey)) {
      e.preventDefault();
      openShortcutHelp();
      return;
    }
    if (code === 'KeyN' || code === 'Slash') {
      e.preventDefault();
      focusInput();
      return;
    }
    if (!isCalendarTab() || e.shiftKey) return;
    const actions = {
      KeyT: () => calendar.today(),
      ArrowLeft: () => calendar.prev(),
      ArrowRight: () => calendar.next(),
      KeyM: () => calendar.changeView('dayGridMonth'),
      KeyW: () => calendar.changeView('timeGridWeek'),
      KeyD: () => calendar.changeView('timeGridDay'),
    };
    const action = actions[code];
    if (!action) return;
    // 버튼에 포커스가 있을 때 ←/→는 원래 동작(스크롤 등)을 막지 않아도 되지만, 캘린더 이동이 더 자연스러워 막습니다
    e.preventDefault();
    action();
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
