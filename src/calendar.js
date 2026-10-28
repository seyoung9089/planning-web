import { Calendar } from '@fullcalendar/core';
import koLocale from '@fullcalendar/core/locales/ko';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { listEventsBetween, listTodos, updateEvent, setTodoDone, setTodoDueDate, setTodoSchedule } from './shared/api.js';
import { toDateKey, toTimeKey, addDays } from './shared/dates.js';
import { openNewEvent, openEditEvent } from './eventDialog.js';
import { DEFAULT_COLOR } from './colors.js';
import { isTimetable } from './shared/timetable.js';

const VIEW_KEY = 'planning-web:view';
const FULL_DAY_KEY = 'planning-web:full-day';
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
  let shownAsMonth = savedView() === 'dayGridMonth';
  const calendar = new Calendar(container, {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    locale: koLocale,
    initialView: savedView() || (window.innerWidth < 700 ? 'timeGridDay' : 'timeGridWeek'),
    headerToolbar: false,
    height: '100%',
    nowIndicator: true,
    ...(fullDay ? FULL_DAY : SCHOOL_HOURS),
    dayMaxEvents: true,
    eventDisplay: 'block',
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
        success([...shown.map(eventToCalendar), ...visibleTodos.map(todoToCalendar)]);
      } catch (err) {
        failure(err);
      }
    },

    // 일정 색은 CSS 변수로 넘겨서 "연한 배경 + 진한 왼쪽 선"으로 그립니다
    eventDidMount: (info) => {
      const color = info.event.extendedProps.color;
      if (color) info.el.style.setProperty('--ev', color);
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
      for (const [key, value] of Object.entries(fullDay ? FULL_DAY : SCHOOL_HOURS)) calendar.setOption(key, value);
      calendar.scrollToTime(fullDay ? FULL_DAY.scrollTime : SCHOOL_HOURS.scrollTime);
      return fullDay;
    },
    isFullDay: () => fullDay,
    prev: () => calendar.prev(),
    next: () => calendar.next(),
  };
}
