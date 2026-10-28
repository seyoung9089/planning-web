import { Calendar } from '@fullcalendar/core';
import koLocale from '@fullcalendar/core/locales/ko';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { listEventsBetween, listTodos, updateEvent, setTodoDone, setTodoDueDate } from './shared/api.js';
import { toDateKey, addDays } from './shared/dates.js';
import { openNewEvent, openEditEvent } from './eventDialog.js';
import { DEFAULT_COLOR } from './colors.js';

const VIEW_KEY = 'planning-web:view';

function savedView() {
  try {
    return localStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

// 일정(events 테이블)을 캘린더가 이해하는 모양으로 바꿉니다
function eventToCalendar(row) {
  return {
    id: row.id,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    allDay: row.all_day,
    backgroundColor: row.color || DEFAULT_COLOR,
    borderColor: row.color || DEFAULT_COLOR,
    extendedProps: { kind: 'event', row },
  };
}

// 마감일이 있는 할 일은 그날 칸에 체크 표시와 함께 보여 줍니다
function todoToCalendar(row) {
  const overdue = !row.done && row.due_date < toDateKey(new Date());
  return {
    id: 'todo-' + row.id,
    title: (row.done ? '✓ ' : '○ ') + row.title,
    start: row.due_date,
    allDay: true,
    classNames: ['todo-item', row.done ? 'done' : '', overdue ? 'overdue' : ''],
    durationEditable: false,
    extendedProps: { kind: 'todo', row },
  };
}

export function createCalendar(container, { onChange } = {}) {
  const changed = () => {
    calendar.refetchEvents();
    onChange?.();
  };

  const calendar = new Calendar(container, {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    locale: koLocale,
    initialView: savedView() || (window.innerWidth < 700 ? 'timeGridDay' : 'dayGridMonth'),
    headerToolbar: {
      left: 'today prev,next title',
      center: '',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    views: {
      timeGridWeek: { dayHeaderFormat: { day: 'numeric', weekday: 'short' } },
    },
    buttonText: { today: '오늘', month: '월', week: '주', day: '일' },
    height: '100%',
    nowIndicator: true,
    scrollTime: '08:00:00',
    dayMaxEvents: true,
    selectable: true,
    selectMirror: true,
    editable: true,
    eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' },

    events: async (info, success, failure) => {
      try {
        const [events, todos] = await Promise.all([listEventsBetween(info.start, info.end), listTodos()]);
        const from = toDateKey(info.start);
        const to = toDateKey(info.end);
        const visibleTodos = todos.filter((t) => t.due_date && t.due_date >= from && t.due_date < to);
        success([...events.map(eventToCalendar), ...visibleTodos.map(todoToCalendar)]);
      } catch (err) {
        failure(err);
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

    viewDidMount: (info) => {
      try {
        localStorage.setItem(VIEW_KEY, info.view.type);
      } catch {
        // 저장이 안 되는 환경이면 다음에 기본 보기로 열립니다
      }
    },
  });

  async function saveMoved(info) {
    const ev = info.event;
    const { kind, row } = ev.extendedProps;
    try {
      if (kind === 'todo') {
        await setTodoDueDate(row.id, toDateKey(ev.start));
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
  return { refresh: () => calendar.refetchEvents() };
}
