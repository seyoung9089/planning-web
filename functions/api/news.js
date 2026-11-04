// Cloudflare Pages Function: GET /api/news
// 공신력 있는 언론사의 RSS를 모아, 기획·구상에 다른 관점을 줄 만한 기사를 골라 돌려줍니다.
// 브라우저에서는 언론사 RSS를 바로 읽을 수 없어서(CORS) 서버에서 대신 가져옵니다.

const FEEDS = [
  { source: '한겨레', section: '문화', url: 'https://www.hani.co.kr/rss/culture/' },
  { source: '한겨레', section: '과학', url: 'https://www.hani.co.kr/rss/science/' },
  { source: '경향신문', section: '문화', url: 'https://www.khan.co.kr/rss/rssdata/culture_news.xml' },
  { source: '경향신문', section: '과학', url: 'https://www.khan.co.kr/rss/rssdata/science_news.xml' },
  { source: 'BBC 코리아', section: '세계', url: 'https://feeds.bbci.co.uk/korean/rss.xml' },
];

// 새로운 시각·이야기·발견이 담긴 기사일수록 점수를 올립니다
const BOOST = ['인터뷰', '칼럼', '기획', '이야기', '생각', '질문', '왜', '어떻게', '미래', '실험', '발견', '연구',
  '도전', '상상', '철학', '예술', '디자인', '건축', '교육', '청년', '기록', '역사', '자연', '우주', '기술', '창작'];
// 정쟁·사건사고·단순 행사 안내는 점수를 내립니다
const PENALTY = ['민주당', '국민의힘', '대통령실', '검찰', '선거', '의원', '사망', '살해', '체포', '혐의',
  '개최', '개막', '공연 안내', '할인', '모집', '부고', '포토'];

const TOTAL = 8;
const PER_SOURCE = 2;
const CACHE_SECONDS = 1800;

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : '';
}

function parse(xml, feed) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
  return items.map((it) => {
    const title = tag(it, 'title');
    const summary = tag(it, 'description').slice(0, 160);
    const date = new Date(tag(it, 'pubDate') || tag(it, 'dc:date'));
    return {
      title,
      summary,
      link: tag(it, 'link'),
      source: feed.source,
      section: feed.section,
      publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    };
  });
}

function score(item, now) {
  const text = `${item.title} ${item.summary}`;
  let s = 0;
  for (const w of BOOST) if (text.includes(w)) s += 2;
  for (const w of PENALTY) if (text.includes(w)) s -= 3;
  if (item.summary.length > 60) s += 1; // 요약이 있는 기사가 읽을거리가 많습니다
  if (item.publishedAt) {
    const hours = (now - new Date(item.publishedAt)) / 3600000;
    if (hours > 72) s -= 4;
    else if (hours < 24) s += 1;
  }
  return s;
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'planning-web dashboard' },
    signal: AbortSignal.timeout(6000),
    cf: { cacheTtl: CACHE_SECONDS },
  });
  if (!res.ok) throw new Error(`${feed.source} ${res.status}`);
  return parse(await res.text(), feed);
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/news', context.request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const now = Date.now();
  const seen = new Set();
  const all = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((it) => it.title && it.link && !seen.has(it.title) && seen.add(it.title))
    .map((it) => ({ ...it, score: score(it, now) }))
    .sort((a, b) => b.score - a.score || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  const picked = [];
  const perSource = {};
  for (const it of all) {
    if (picked.length >= TOTAL) break;
    if ((perSource[it.source] ?? 0) >= PER_SOURCE) continue;
    perSource[it.source] = (perSource[it.source] ?? 0) + 1;
    const { score: _s, ...rest } = it;
    picked.push(rest);
  }

  const body = JSON.stringify({
    updatedAt: new Date(now).toISOString(),
    failed: results.flatMap((r, i) => (r.status === 'rejected' ? [FEEDS[i].source + ' ' + FEEDS[i].section] : [])),
    items: picked,
  });
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
  if (picked.length) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
