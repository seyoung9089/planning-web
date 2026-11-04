import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './shared/base.css';
import './dashboard.css';
import { onAuthChange, signOut, listTodos, listEventsBetween, setTodoDone, subscribeChanges } from './shared/api.js';
import { renderAuthForm } from './shared/ui.js';
import { sortTodos } from './shared/todoOrder.js';
import { dueLabel, toDateKey, toTimeKey, addDays, fromKeys } from './shared/dates.js';
import { isTimetable, periodLabel } from './shared/timetable.js';

// 학교 위치: 충남 금산군 남일면 별무리길 근처
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=36.05&longitude=127.47' +
  '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
  '&hourly=temperature_2m,precipitation_probability,weather_code' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
  '&timezone=Asia%2FSeoul&forecast_days=2';

const LINKS = [
  { label: '캘린더', href: '/' },
  { label: 'Altsis', href: 'https://next.altsis.org/bmr/bmrhs/boards' },
  { label: 'Classroom', href: 'https://classroom.google.com/' },
];

const MEMO_KEY = 'dashboard-memo';

const app = document.getElementById('app');
let unsubscribe = null;
let timer = null;
let currentUserId;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

onAuthChange((session) => {
  const userId = session?.user.id ?? null;
  if (userId === currentUserId) return;
  currentUserId = userId;
  unsubscribe?.();
  unsubscribe = null;
  clearInterval(timer);

  if (!session) {
    app.className = 'logged-out';
    app.innerHTML = '<h1 class="brand">📅 planning-web</h1><div id="auth"></div>';
    renderAuthForm(document.getElementById('auth'));
    return;
  }

  app.className = 'dash';
  app.innerHTML = `
    <header class="dash-head">
      <div>
        <p class="dash-date" id="today-date"></p>
        <h1 id="now-line">불러오는 중…</h1>
        <p class="dash-sub" id="next-line"></p>
      </div>
      <nav class="dash-links">
        ${LINKS.map((l) => `<a href="${l.href}" ${l.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${l.label}</a>`).join('')}
        <button id="logout" class="ghost">로그아웃</button>
      </nav>
    </header>
    <div class="dash-grid">
      <section class="card card-todo">
        <h2>할 일 <span class="count" id="todo-count"></span></h2>
        <ul class="dash-todos" id="todos"></ul>
      </section>
      <section class="card card-weather">
        <h2>날씨 <span class="where">금산 남일면</span></h2>
        <div id="weather"><p class="muted">불러오는 중…</p></div>
      </section>
      <section class="card card-today">
        <h2>오늘 일정</h2>
        <ol class="agenda" id="agenda"></ol>
      </section>
      <section class="card card-news">
        <h2>오늘의 관점 <span class="where" id="news-meta"></span></h2>
        <ul class="news" id="news"><li class="muted">불러오는 중…</li></ul>
      </section>
      <section class="card card-memo">
        <h2>메모</h2>
        <textarea id="memo" placeholder="떠오른 생각을 적어 두세요. 이 브라우저에만 저장됩니다."></textarea>
      </section>
    </div>`;

  app.querySelector('#logout').addEventListener('click', signOut);
  setupMemo();
  loadWeather();
  loadNews();

  const refresh = () => loadPlans().catch((e) => console.error(e));
  refresh();
  unsubscribe = subscribeChanges(refresh);
  timer = setInterval(refresh, 60_000); // 지금/다음 줄이 시간에 맞게 바뀌도록 1분마다 다시 그립니다
});

// ---- 할 일 + 오늘 일정 ----

let todoCache = [];

async function loadPlans() {
  const now = new Date();
  const start = fromKeys(toDateKey(now));
  const [todos, events] = await Promise.all([listTodos(), listEventsBetween(start, addDays(start, 1))]);
  todoCache = todos;
  renderHeader(now, events);
  renderTodos(todos);
  renderAgenda(now, events, todos);
}

function renderHeader(now, events) {
  document.getElementById('today-date').textContent = now.toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'long',
  });
  const timed = events.filter((e) => !e.all_day);
  const current = timed.find((e) => new Date(e.start_at) <= now && now < new Date(e.end_at));
  const next = timed.find((e) => new Date(e.start_at) > now);
  const mins = (d) => Math.max(0, Math.round((d - now) / 60000));
  const span = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);

  document.getElementById('now-line').textContent = current
    ? `지금: ${current.title} · ${span(mins(new Date(current.end_at)))} 남음`
    : '지금은 비어 있는 시간이에요';
  document.getElementById('next-line').textContent = next
    ? `다음: ${toTimeKey(new Date(next.start_at))} ${next.title} (${span(mins(new Date(next.start_at)))} 뒤)`
    : '오늘 남은 일정이 없어요';
}

function renderTodos(todos) {
  const open = sortTodos(todos).filter((t) => !t.done);
  document.getElementById('todo-count').textContent = open.length ? `${open.length}개` : '';
  const ul = document.getElementById('todos');
  if (!open.length) {
    ul.innerHTML = '<li class="muted">남은 할 일이 없어요</li>';
    return;
  }
  ul.innerHTML = open
    .map((t) => {
      const due = dueLabel(t.due_date);
      const when = t.scheduled_start ? periodLabel(new Date(t.scheduled_start), new Date(t.scheduled_end)) : '';
      return `<li>
        <label>
          <input type="checkbox" data-id="${t.id}" />
          <span class="title">${esc(t.title)}</span>
        </label>
        <span class="tags">
          ${when ? `<span class="tag when">${esc(when)}</span>` : ''}
          ${due ? `<span class="tag ${due.tone}">${due.text}</span>` : ''}
        </span>
      </li>`;
    })
    .join('');
  for (const box of ul.querySelectorAll('input[type=checkbox]')) {
    box.addEventListener('change', async () => {
      box.closest('li').classList.add('done');
      await setTodoDone(box.dataset.id, true).catch(() => box.closest('li').classList.remove('done'));
    });
  }
}

function renderAgenda(now, events, todos) {
  const todayKey = toDateKey(now);
  const scheduled = todos
    .filter((t) => !t.done && t.scheduled_start && toDateKey(new Date(t.scheduled_start)) === todayKey)
    .map((t) => ({ title: t.title, start_at: t.scheduled_start, end_at: t.scheduled_end, todo: true }));
  const rows = [...events.filter((e) => !e.all_day), ...scheduled].sort(
    (a, b) => new Date(a.start_at) - new Date(b.start_at),
  );
  const ol = document.getElementById('agenda');
  if (!rows.length) {
    ol.innerHTML = '<li class="muted">오늘 일정이 없어요</li>';
    return;
  }
  ol.innerHTML = rows
    .map((e) => {
      const s = new Date(e.start_at);
      const en = new Date(e.end_at);
      const state = en <= now ? 'past' : s <= now ? 'now' : '';
      const kind = e.todo ? 'todo' : isTimetable(e) ? 'class' : 'event';
      return `<li class="${state} ${kind}">
        <span class="time">${toTimeKey(s)}–${toTimeKey(en)}</span>
        <span class="what">${esc(e.title)}</span>
      </li>`;
    })
    .join('');
}

// ---- 날씨 ----

const WMO = {
  0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '짙은 안개',
  51: '약한 이슬비', 53: '이슬비', 55: '강한 이슬비', 61: '약한 비', 63: '비', 65: '강한 비',
  66: '어는 비', 67: '강한 어는 비', 71: '약한 눈', 73: '눈', 75: '많은 눈', 77: '싸락눈',
  80: '소나기', 81: '소나기', 82: '강한 소나기', 85: '눈 소나기', 86: '강한 눈 소나기',
  95: '뇌우', 96: '뇌우·우박', 99: '강한 뇌우·우박',
};
const wmo = (c) => WMO[c] ?? '-';

async function loadWeather() {
  const box = document.getElementById('weather');
  try {
    const res = await fetch(WEATHER_URL);
    if (!res.ok) throw new Error(res.status);
    const w = await res.json();
    const c = w.current;
    const d = w.daily;
    const nowIdx = w.hourly.time.findIndex((t) => new Date(t) >= new Date(Date.now() - 3600000));
    const hours = [0, 3, 6, 9, 12]
      .map((k) => nowIdx + k)
      .filter((i) => i >= 0 && i < w.hourly.time.length)
      .map((i) => ({
        h: new Date(w.hourly.time[i]).getHours(),
        t: Math.round(w.hourly.temperature_2m[i]),
        p: w.hourly.precipitation_probability[i],
      }));

    const tips = [];
    if (d.precipitation_probability_max[0] >= 50) tips.push('우산 챙기기');
    if (d.temperature_2m_min[0] <= 5) tips.push('두꺼운 겉옷');
    else if (d.temperature_2m_max[0] - d.temperature_2m_min[0] >= 10) tips.push('일교차 큼, 겉옷');

    box.innerHTML = `
      <div class="wx-now">
        <span class="wx-temp">${Math.round(c.temperature_2m)}°</span>
        <div>
          <p class="wx-state">${wmo(c.weather_code)}</p>
          <p class="muted">체감 ${Math.round(c.apparent_temperature)}° · 바람 ${Math.round(c.wind_speed_10m)}km/h</p>
        </div>
      </div>
      <p class="wx-day">최고 ${Math.round(d.temperature_2m_max[0])}° / 최저 ${Math.round(d.temperature_2m_min[0])}° · 강수확률 ${d.precipitation_probability_max[0]}%</p>
      <ul class="wx-hours">
        ${hours.map((x) => `<li><span>${x.h}시</span><b>${x.t}°</b><span class="muted">${x.p}%</span></li>`).join('')}
      </ul>
      ${tips.length ? `<p class="wx-tip">${tips.join(' · ')}</p>` : ''}
      <p class="wx-tomorrow muted">내일 ${wmo(d.weather_code[1])}, ${Math.round(d.temperature_2m_min[1])}°~${Math.round(d.temperature_2m_max[1])}°, 강수확률 ${d.precipitation_probability_max[1]}%</p>`;
  } catch {
    box.innerHTML = '<p class="muted">날씨를 불러오지 못했어요.</p>';
  }
}

// ---- 뉴스 ----

async function loadNews() {
  const ul = document.getElementById('news');
  try {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (!data.items?.length) throw new Error('empty');
    document.getElementById('news-meta').textContent = `${new Date(data.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준`;
    ul.innerHTML = data.items
      .map(
        (n) => `<li>
        <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
        ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
        <span class="src">${esc(n.source)} · ${esc(n.section)}</span>
      </li>`,
      )
      .join('');
  } catch {
    ul.innerHTML = '<li class="muted">뉴스를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</li>';
  }
}

// ---- 메모 (이 브라우저에만 저장) ----

function setupMemo() {
  const area = document.getElementById('memo');
  try {
    area.value = localStorage.getItem(MEMO_KEY) ?? '';
  } catch {
    /* 저장소를 못 쓰는 환경이면 비워 둡니다 */
  }
  area.addEventListener('input', () => {
    try {
      localStorage.setItem(MEMO_KEY, area.value);
    } catch {
      /* 무시 */
    }
  });
}
