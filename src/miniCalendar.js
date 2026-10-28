import { toDateKey, addDays } from './shared/dates.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 왼쪽 사이드바의 작은 달력: 날짜를 누르면 큰 캘린더가 그 날짜로 이동합니다
export function createMiniCalendar(container, { onPick }) {
  let month = new Date();
  month.setDate(1);
  let range = null; // 큰 캘린더가 지금 보여 주는 기간

  container.classList.add('mini-cal');
  container.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-move]');
    if (nav) {
      month.setMonth(month.getMonth() + Number(nav.dataset.move));
      render();
      return;
    }
    const day = e.target.closest('[data-date]');
    if (day) {
      const [y, m, d] = day.dataset.date.split('-').map(Number);
      onPick(new Date(y, m - 1, d));
    }
  });

  function render() {
    const todayKey = toDateKey(new Date());
    const first = addDays(month, -month.getDay());
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const date = addDays(first, i);
      const key = toDateKey(date);
      const classes = ['day'];
      if (date.getMonth() !== month.getMonth()) classes.push('other');
      if (key === todayKey) classes.push('today');
      if (range && date >= range.start && date < range.end) classes.push('in-range');
      if (date.getDay() === 0) classes.push('sun');
      cells += `<button class="${classes.join(' ')}" data-date="${key}">${date.getDate()}</button>`;
    }
    container.innerHTML = `
      <div class="mini-head">
        <strong>${month.getFullYear()}년 ${month.getMonth() + 1}월</strong>
        <span>
          <button class="icon-btn" data-move="-1" aria-label="이전 달">‹</button>
          <button class="icon-btn" data-move="1" aria-label="다음 달">›</button>
        </span>
      </div>
      <div class="mini-grid">
        ${WEEKDAYS.map((w) => `<span class="dow">${w}</span>`).join('')}
        ${cells}
      </div>`;
  }

  render();
  return {
    // 큰 캘린더가 이동하면 미니 달력도 그 달로 따라가고, 보이는 기간을 칠합니다
    highlight(start, end, shade = true) {
      range = shade ? { start, end } : null;
      const middle = new Date((start.getTime() + end.getTime()) / 2);
      month = new Date(middle.getFullYear(), middle.getMonth(), 1);
      render();
    },
  };
}
