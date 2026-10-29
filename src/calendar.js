import { Calendar } from '@fullcalendar/core';
import koLocale from '@fullcalendar/core/locales/ko';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { listEventsBetween, listTodos, updateEvent, setTodoDone, setTodoDueDate, setTodoSchedule } from './shared/api.js';
import { toDateKey, toTimeKey, addDays, dueLabel } from './shared/dates.js';
import { topTodosForToday } from './shared/todoOrder.js';
import { openNewEvent, openEditEvent } from './eventDialog.js';
import { DEFAULT_COLOR } from './colors.js';
import { isTimetable, TIMETABLE_MEMO } from './shared/timetable.js';

const VIEW_KEY = 'planning-web:view';
const FULL_DAY_KEY = 'planning-web:full-day';
const SNAP_KEY = 'planning-web:snap-minutes';
export const SNAP_CHOICES = [5, 10, 30, 60];
// 평소에는 학교 일과 시간(아침 8:30 ~ 밤 10:00)만 보여 줍니다. 저녁 9시 줄에도 시간 글자가 붙도록 10시까지 둡니다
const SCHOOL_HOURS = { slotMinTime: '08:30:00', slotMaxTime: '22:00:00', scrollTime: '08:30:00' };
const FULL_DAY = { slotMinTime: '00:00:00', slotMaxTime: '24:00:00', scrollTime: '08:00:00' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function savedFullDay() {
  try {
    return localStorage.getItem(FULL_DAY_KEY) === '1';
  } catch {
    return false;
  }
}

// 끌어서 시간을 잡을 때 몇 분 단위로 맞출지 (기본 30분)
function savedSnap() {
  try {
    const minutes = Number(localStorage.getItem(SNAP_KEY));
    return SNAP_CHOICES.includes(minutes) ? minutes : 30;
  } catch {
    return 30;
  }
}

// 1시간 단위일 때 8:30부터 시작하면 8:30, 9:30…으로 맞춰지므로 8:00부터 보여 줍니다
function hoursFor(fullDay, snapMinutes) {
  if (fullDay) return FULL_DAY;
  return snapMinutes === 60 ? { ...SCHOOL_HOURS, slotMinTime: '08:00:00' } : SCHOOL_HOURS;
}

const pad = (n) => String(n).padStart(2, '0');
const minutesToDuration = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;

// 시간 칸 위에 마우스를 올리면, 지금 누르면 시작될 시간을 마우스 옆에 "오후 1:05"처럼 보여 줍니다
function attachHoverTime(container, getSnap) {
  const tip = document.createElement('div');
  tip.className = 'hover-time';
  tip.hidden = true;
  document.body.append(tip);

  container.addEventListener('mousemove', (e) => {
    // 시간 칸 안쪽만 (일정 위나 왼쪽 시간 글자 위는 제외)
    const inGrid = e.target.closest('.fc-timegrid-body');
    if (!inGrid || e.target.closest('.fc-event, .fc-timegrid-slot-label, .fc-timegrid-axis')) {
      tip.hidden = true;
      return;
    }
    let minutes = null;
    for (const lane of container.querySelectorAll('.fc-timegrid-slot-lane[data-time]')) {
      const rect = lane.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY >= rect.bottom) continue;
      const [h, m] = lane.dataset.time.split(':').map(Number);
      // 시간 칸 한 줄은 30분입니다
      minutes = h * 60 + m + ((e.clientY - rect.top) / rect.height) * 30;
      break;
    }
    if (minutes === null) {
      tip.hidden = true;
      return;
    }
    const snap = getSnap();
    const snapped = Math.floor(minutes / snap) * snap;
    const h = Math.floor(snapped / 60) % 24;
    tip.textContent = `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(snapped % 60)}`;
    tip.style.left = e.clientX + 14 + 'px';
    tip.style.top = e.clientY - 30 + 'px';
    tip.hidden = false;
  });
  container.addEventListener('mouseleave', () => (tip.hidden = true));
}

function savedView() {
  try {
    return localStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

// 일정(events 테이블)을 캘린더가 이해하는 모양으로 바꿉니다
function eventToCalendar(row) {
  const timetable = isTimetable(row);
  const past = new Date(row.end_at) < new Date();
  return {
    id: row.id,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    allDay: row.all_day,
    // 수업 시간표는 지나간 것도 흐리게 하지 않고, 실수로 끌어서 옮기지 않게 고정합니다
    classNames: ['ev', timetable ? 'timetable' : past ? 'past' : ''],
    ...(timetable ? { startEditable: false, durationEditable: false } : {}),
    extendedProps: { kind: 'event', row, color: row.color || DEFAULT_COLOR },
  };
}

// 할 일은 체크 표시와 함께 보여 줍니다.
// 교시(시간)를 정했으면 그 시간 칸에, 아니면 마감일 칸에 나옵니다.
function todoToCalendar(row) {
  const overdue = !row.done && row.due_date && row.due_date < toDateKey(new Date());
  const base = {
    id: 'todo-' + row.id,
    title: (row.done ? '✓ ' : '○ ') + row.title,
    classNames: ['todo-item', row.done ? 'done' : '', overdue ? 'overdue' : ''],
    extendedProps: { kind: 'todo', row },
  };
  if (row.scheduled_start) {
    return { ...base, start: row.scheduled_start, end: row.scheduled_end, allDay: false, classNames: [...base.classNames, 'scheduled'] };
  }
  return { ...base, start: row.due_date, allDay: true, durationEditable: false };
}

// 가장 급한 할 일은 마감일과 상관없이 오늘 「종일」 칸에도 띄웁니다 (원래 마감일 칸에도 그대로 있습니다)
function topTodoToCalendar(row, todayKey, rank) {
  const due = dueLabel(row.due_date);
  return {
    id: 'top-' + row.id,
    title: '○ ' + row.title + (due ? ` · ${due.text}` : ''),
    start: todayKey,
    allDay: true,
    editable: false,
    classNames: ['todo-item', 'top'],
    extendedProps: { kind: 'todo', row, rank },
  };
}

function todoVisible(row, from, to) {
  if (row.scheduled_start) return new Date(row.scheduled_start) < to && new Date(row.scheduled_end) > from;
  return row.due_date && row.due_date >= toDateKey(from) && row.due_date < toDateKey(to);
}

// 제목: 월 보기는 "2026년 10월", 주 보기는 "2026년 10월" 또는 "2026년 10월 – 11월", 일 보기는 "10월 28일 (수)"
function titleFor(view) {
  const start = view.currentStart;
  const last = addDays(view.currentEnd, -1);
  if (view.type === 'timeGridDay') {
    return `${start.getMonth() + 1}월 ${start.getDate()}일 (${WEEKDAYS[start.getDay()]})`;
  }
  if (view.type === 'timeGridWeek' && last.getMonth() !== start.getMonth()) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 – ${last.getMonth() + 1}월`;
  }
  return `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
}

export function createCalendar(container, { onChange, onDatesSet } = {}) {
  const changed = () => {
    calendar.refetchEvents();
    onChange?.();
  };

  let fullDay = savedFullDay();
  let snapMinutes = savedSnap();
  let shownAsMonth = savedView() === 'dayGridMonth';
  const calendar = new Calendar(container, {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    locale: koLocale,
    initialView: savedView() || (window.innerWidth < 700 ? 'timeGridDay' : 'timeGridWeek'),
    headerToolbar: false,
    height: '100%',
    nowIndicator: true,
    ...hoursFor(fullDay, snapMinutes),
    snapDuration: minutesToDuration(snapMinutes),
    dayMaxEvents: true,
    eventDisplay: 'block',
    // 급한 할 일(rank 0~2)은 목록 순서대로 보이게 합니다
    eventOrder: 'start,-duration,allDay,rank,title',
    selectable: true,
    selectMirror: true,
    editable: true,
    allDayText: '종일',
    // 8:30부터 시작해도 시간 글자가 정각 줄에 붙도록 30분마다 칸을 나누고 정각에만 "오전 9시"처럼 씁니다
    slotLabelInterval: '00:30',
    slotLabelContent: (arg) => {
      if (arg.date.getMinutes() !== 0) return '';
      const h = arg.date.getHours();
      return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시`;
    },
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },

    // 요일 머리글: "수 28"처럼 쓰고, 오늘은 빨간 배지로 표시합니다
    dayHeaderContent: (arg) => {
      const dow = WEEKDAYS[arg.date.getDay()];
      if (arg.view.type === 'dayGridMonth') return dow;
      return { html: `<span class="dow">${dow}</span><span class="num">${arg.date.getDate()}</span>` };
    },
    dayCellContent: (arg) => (arg.view.type === 'dayGridMonth' ? String(arg.date.getDate()) : ''),

    // 현재 시각 선 왼쪽에 "14:07" 같은 시간 표시
    nowIndicatorContent: (arg) => (arg.isAxis ? { html: `<span class="now-label">${toTimeKey(arg.date)}</span>` } : null),

    events: async (info, success, failure) => {
      try {
        const [events, todos] = await Promise.all([listEventsBetween(info.start, info.end), listTodos()]);
        const visibleTodos = todos.filter((t) => todoVisible(t, info.start, info.end));
        // 월 보기는 한 달 계획용이라 수업 시간표는 숨기고 할 일과 내가 넣은 일정만 보여 줍니다
        const shown = calendar.view?.type === 'dayGridMonth' ? events.filter((row) => !isTimetable(row)) : events;
        const todayKey = toDateKey(new Date());
        const tops = todayKey >= toDateKey(info.start) && todayKey < toDateKey(info.end) ? topTodosForToday(todos, todayKey) : [];
        success([
          ...shown.map(eventToCalendar),
          ...tops.map((row, i) => topTodoToCalendar(row, todayKey, i)),
          ...visibleTodos.map(todoToCalendar),
        ]);
      } catch (err) {
        failure(err);
      }
    },

    // 일정 색은 CSS 변수로 넘겨서 "연한 배경 + 진한 왼쪽 선"으로 그립니다
    eventDidMount: (info) => {
      const { color, row, kind } = info.event.extendedProps;
      if (color) info.el.style.setProperty('--ev', color);
      // 메모가 있으면 제목 아래에 작게 보여 줍니다
      const memo = kind === 'event' && row.memo !== TIMETABLE_MEMO ? row.memo : null;
      const frame = info.el.querySelector('.fc-event-title-container') ?? info.el.querySelector('.fc-event-main-frame');
      if (memo && frame) {
        const note = document.createElement('div');
        note.className = 'ev-memo';
        note.textContent = memo;
        frame.append(note);
        info.el.title = `${info.event.title}\n${memo}`;
      }
    },

    // 빈 칸을 누르거나 끌어서 범위를 고르면 새 일정 창을 엽니다
    select: (info) => {
      calendar.unselect();
      openNewEvent({ start: info.start, end: info.end, allDay: info.allDay }, changed);
    },

    // 일정을 누르면 수정 창, 할 일을 누르면 완료/미완료가 바뀝니다
    eventClick: async (info) => {
      const { kind, row } = info.event.extendedProps;
      if (kind === 'todo') {
        await setTodoDone(row.id, !row.done);
        changed();
      } else {
        openEditEvent(row, changed);
      }
    },

    // 끌어서 옮기거나 길이를 바꾸면 바로 저장합니다
    eventDrop: (info) => saveMoved(info),
    eventResize: (info) => saveMoved(info),

    datesSet: (info) => {
      // 월 ↔ 주·일을 오갈 때 수업 시간표를 보였다 숨겼다 하도록 다시 불러옵니다
      const monthView = info.view.type === 'dayGridMonth';
      if (monthView !== shownAsMonth) {
        shownAsMonth = monthView;
        queueMicrotask(() => calendar.refetchEvents());
      }
      try {
        localStorage.setItem(VIEW_KEY, info.view.type);
      } catch {
        // 저장이 안 되는 환경이면 다음에 기본 보기로 열립니다
      }
      onDatesSet?.({
        title: titleFor(info.view),
        viewType: info.view.type,
        start: info.view.currentStart,
        end: info.view.currentEnd,
      });
    },
  });

  async function saveMoved(info) {
    const ev = info.event;
    const { kind, row } = ev.extendedProps;
    try {
      if (kind === 'todo' && ev.allDay) {
        // 종일 칸으로 옮기면 정해 둔 시간을 지우고 그 날을 마감일로 합니다
        if (row.scheduled_start) await setTodoSchedule(row.id, null, null);
        await setTodoDueDate(row.id, toDateKey(ev.start));
      } else if (kind === 'todo') {
        const end = ev.end ?? new Date(ev.start.getTime() + 45 * 60000);
        await setTodoSchedule(row.id, ev.start, end);
      } else {
        // 끝 시간이 비어 있으면 하루 종일은 1일, 시간 일정은 1시간으로 봅니다
        const end = ev.end ?? (ev.allDay ? addDays(ev.start, 1) : new Date(ev.start.getTime() + 3600000));
        await updateEvent(row.id, { startAt: ev.start, endAt: end, allDay: ev.allDay });
      }
      changed();
    } catch (err) {
      info.revert();
      alert('저장하지 못했습니다: ' + err.message);
    }
  }

  calendar.render();
  attachHoverTime(container, () => snapMinutes);
  return {
    refresh: () => calendar.refetchEvents(),
    gotoDate: (date) => calendar.gotoDate(date),
    changeView: (type) => calendar.changeView(type),
    today: () => calendar.today(),
    // 전체 시간(0~24시) ↔ 학교 일과 시간 전환. 바뀐 상태(true면 전체)를 돌려줍니다
    toggleFullDay: () => {
      fullDay = !fullDay;
      try {
        localStorage.setItem(FULL_DAY_KEY, fullDay ? '1' : '0');
      } catch {
        // 저장이 안 되면 이번에만 적용됩니다
      }
      const hours = hoursFor(fullDay, snapMinutes);
      for (const [key, value] of Object.entries(hours)) calendar.setOption(key, value);
      calendar.scrollToTime(hours.scrollTime);
      return fullDay;
    },
    isFullDay: () => fullDay,
    // 끌기 단위(분) 바꾸기: 5, 10, 30, 60
    setSnap: (minutes) => {
      if (!SNAP_CHOICES.includes(minutes)) return;
      snapMinutes = minutes;
      try {
        localStorage.setItem(SNAP_KEY, String(minutes));
      } catch {
        // 저장이 안 되면 이번에만 적용됩니다
      }
      calendar.setOption('snapDuration', minutesToDuration(minutes));
      calendar.setOption('slotMinTime', hoursFor(fullDay, minutes).slotMinTime);
    },
    getSnap: () => snapMinutes,
    prev: () => calendar.prev(),
    next: () => calendar.next(),
  };
}
