import { toDateKey, addDays } from './shared/dates.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 왼쪽 사이드바의 작은 달력: 이번 주와 다음 주, 2주만 보여 줍니다.
// 날짜를 누르면 큰 캘린더가 그 날짜로 이동하고, ‹ › 로 한 주씩 옮깁니다
const weekStart = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(d, -d.getDay());
};

export function createMiniCalendar(container, { onPick }) {
  let anchor = weekStart(new Date()); // 맨 윗줄(첫 주)의 일요일
  let range = null; // 큰 캘린더가 지금 보여 주는 기간

  container.classList.add('mini-cal');
  container.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-move]');
    if (nav) {
      anchor = addDays(anchor, 7 * Number(nav.dataset.move));
      render();
      return;
    }
    const day = e.target.closest('[data-date]');
    if (day) {
      const [y, m, d] = day.dataset.date.split('-').map(Number);
      onPick(new Date(y, m - 1, d));
    }
  });

  function title() {
    const end = addDays(anchor, 13);
    const a = `${anchor.getMonth() + 1}월 ${anchor.getDate()}일`;
    const b = end.getMonth() === anchor.getMonth() ? `${end.getDate()}일` : `${end.getMonth() + 1}월 ${end.getDate()}일`;
    return `${a} – ${b}`;
  }

  function render() {
    const todayKey = toDateKey(new Date());
    let cells = '';
    for (let i = 0; i < 14; i++) {
      const date = addDays(anchor, i);
      const key = toDateKey(date);
      const classes = ['day'];
      if (key === todayKey) classes.push('today');
      if (range && date >= range.start && date < range.end) classes.push('in-range');
      if (date.getDay() === 0) classes.push('sun');
      // 달이 바뀌는 날은 "12/1"처럼 달을 같이 적습니다
      const label = date.getDate() === 1 ? `${date.getMonth() + 1}/1` : date.getDate();
      cells += `<button class="${classes.join(' ')}" data-date="${key}">${label}</button>`;
    }
    container.innerHTML = `
      <div class="mini-head">
        <strong>${title()}</strong>
        <span>
          <button class="icon-btn" data-move="-1" aria-label="이전 주">‹</button>
          <button class="icon-btn" data-move="1" aria-label="다음 주">›</button>
        </span>
      </div>
      <div class="mini-grid">
        ${WEEKDAYS.map((w) => `<span class="dow">${w}</span>`).join('')}
        ${cells}
      </div>`;
  }

  render();
  return {
    // 큰 캘린더가 보여 주는 기간을 칠하고, 그 기간이 2주 안에 없으면 그쪽으로 따라갑니다
    highlight(start, end, shade = true) {
      range = shade ? { start, end } : null;
      const shownEnd = addDays(anchor, 14);
      if (end <= anchor || start >= shownEnd) {
        const today = new Date();
        anchor = weekStart(today >= start && today < end ? today : start);
      }
      render();
    },
  };
}
