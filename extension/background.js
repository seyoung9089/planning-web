// 크롬 확장의 백그라운드: 패널 열기 버튼 설정 + 일정 알림
import { supabase } from '../src/shared/supabase.js';
import { listEventsBetween, listTodos } from '../src/shared/api.js';
import { toDateKey } from '../src/shared/dates.js';

const REMIND_BEFORE_MIN = 10; // 일정 몇 분 전에 알릴지
const DUE_REMINDER_HOUR = 18; // 오늘 마감인 할 일을 몇 시에 알릴지

// 툴바 아이콘(또는 Alt+S)을 누르면 사이드 패널이 열리게 합니다
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sync', { periodInMinutes: 15 });
  syncReminders();
});
chrome.runtime.onStartup.addListener(syncReminders);

// 사이드 패널에서 일정이 바뀌면 바로 알림 예약을 다시 합니다
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'schedule-changed') syncReminders();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sync') return syncReminders();
  const { reminders = {} } = await chrome.storage.local.get('reminders');
  const reminder = reminders[alarm.name];
  if (!reminder) return;
  chrome.notifications.create(alarm.name, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: reminder.title,
    message: reminder.message,
    priority: 2,
  });
});

// 알림을 누르면 사이드 패널을 엽니다
chrome.notifications.onClicked.addListener(async () => {
  const [win] = await chrome.windows.getAll({ windowTypes: ['normal'] });
  if (win) chrome.sidePanel.open({ windowId: win.id }).catch(() => {});
});

const pad = (n) => String(n).padStart(2, '0');
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// 앞으로 하루 동안의 일정과 오늘 마감 할 일을 읽어서 알림을 예약합니다
async function syncReminders() {
  const { data } = await supabase.auth.getSession();
  // 이전 예약은 지우고 새로 만듭니다 (주기 알람 'sync'는 남겨 둡니다)
  for (const alarm of await chrome.alarms.getAll()) {
    if (alarm.name !== 'sync') chrome.alarms.clear(alarm.name);
  }
  const reminders = {};
  if (data.session) {
    const now = new Date();
    try {
      const events = await listEventsBetween(now, new Date(now.getTime() + 24 * 3600000));
      for (const ev of events) {
        if (ev.all_day) continue;
        const start = new Date(ev.start_at);
        const when = start.getTime() - REMIND_BEFORE_MIN * 60000;
        if (when <= Date.now()) continue;
        const name = 'ev:' + ev.id;
        reminders[name] = { title: `${REMIND_BEFORE_MIN}분 뒤: ${ev.title}`, message: `${hm(start)} – ${hm(new Date(ev.end_at))}` };
        chrome.alarms.create(name, { when });
      }

      const todos = await listTodos();
      // 몇 교시에 하기로 정한 할 일도 시작 10분 전에 알려 줍니다
      for (const t of todos) {
        if (t.done || !t.scheduled_start) continue;
        const start = new Date(t.scheduled_start);
        const when = start.getTime() - REMIND_BEFORE_MIN * 60000;
        if (when <= Date.now() || start.getTime() > now.getTime() + 24 * 3600000) continue;
        const name = 'todo:' + t.id;
        reminders[name] = { title: `${REMIND_BEFORE_MIN}분 뒤 할 일: ${t.title}`, message: `${hm(start)} – ${hm(new Date(t.scheduled_end))}` };
        chrome.alarms.create(name, { when });
      }

      const todayKey = toDateKey(now);
      const dueToday = todos.filter((t) => !t.done && t.due_date === todayKey);
      const dueAt = new Date(now);
      dueAt.setHours(DUE_REMINDER_HOUR, 0, 0, 0);
      if (dueToday.length > 0 && dueAt > now) {
        reminders['due:' + todayKey] = {
          title: `오늘 마감인 할 일이 ${dueToday.length}개 남았어요`,
          message: dueToday.map((t) => '• ' + t.title).join('\n'),
        };
        chrome.alarms.create('due:' + todayKey, { when: dueAt.getTime() });
      }
    } catch (err) {
      console.warn('알림 예약 실패', err);
    }
  }
  await chrome.storage.local.set({ reminders });
}
