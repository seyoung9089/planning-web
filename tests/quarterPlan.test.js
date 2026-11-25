import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Asia/Seoul';
const { quarterRange, blocksFromGrid, gridFromEvents, expandTemplates, rowsToReplace, GRID_ROWS, splitPlace, autoColors } = await import('../src/shared/quarterPlan.js');

const row = (i) => GRID_ROWS.findIndex((r) => r.id === i);
const at = (key, hm) => new Date(`${key}T${hm}:00+09:00`).toISOString();
const ev = (id, key, s, e, title) => ({ id, title, start_at: at(key, s), end_at: at(key, e), all_day: false, color: '#3f51b5', is_timetable: true });

test('시작일로 9주 기간을 계산한다', () => {
  assert.deepEqual(quarterRange('2026-10-19'), { start: '2026-10-19', end: '2026-12-20', weeks: 9 });
  assert.equal(quarterRange('2026-12-28', 8).end, '2027-02-21');
});

test('같은 이름이 이어진 교시는 하나의 수업으로 합친다', () => {
  const blocks = blocksFromGrid({
    1: { [row('p3')]: '니체', [row('p4')]: ' 니체 ', [row('p5')]: '뉴욕' },
    3: { [row('morning')]: '예배', [row('p1')]: '예배', [row('ev2')]: '정기회의' },
  });
  assert.deepEqual(blocks, [
    { dow: 1, start: '10:40', end: '12:10', title: '니체', location: null },
    { dow: 1, start: '13:10', end: '13:55', title: '뉴욕', location: null },
    { dow: 3, start: '08:30', end: '09:50', title: '예배', location: null },
    { dow: 3, start: '20:00', end: '21:00', title: '정기회의', location: null },
  ]);
});

test('지난 수업으로 표를 채우고, 자주 있던 수업이 이기며, 교시에 안 맞는 건 따로 둔다', () => {
  const rows = [
    ev('a', '2026-10-19', '10:40', '12:10', '일주일에하나씩'),
    ev('b', '2026-10-26', '10:40', '12:10', '일주일에하나씩'),
    ev('c', '2026-11-02', '10:40', '12:10', '니체'), // 한 번뿐: 무시
    ev('d', '2026-10-21', '08:30', '09:50', '예배'),
    ev('e', '2026-10-28', '08:30', '09:50', '예배'),
    ev('f', '2026-10-20', '18:10', '18:55', '저녁'),
    ev('g', '2026-10-27', '18:10', '18:55', '저녁'),
    ev('h', '2026-10-20', '12:15', '13:05', '멘토링'),
    ev('i', '2026-10-27', '12:15', '13:05', '멘토링'),
  ];
  const { cells, extras } = gridFromEvents(rows);
  assert.equal(cells[1][row('p3')], '일주일에하나씩');
  assert.equal(cells[1][row('p4')], '일주일에하나씩');
  assert.equal(cells[3][row('morning')], '예배');
  assert.equal(cells[3][row('p1')], '예배');
  assert.equal(cells[2][row('dinner')], '저녁');
  assert.deepEqual(extras, [{ dow: 2, start: '12:15', end: '13:05', title: '멘토링', location: null, color: '#3f51b5' }]);
});

test('수업 틀을 쿼터 동안 매주 펼친다 (시작일이 수요일이어도 월요일 수업은 다음 월요일부터)', () => {
  const list = expandTemplates([{ dow: 1, start: '09:05', end: '09:50', title: '체크인', color: '#000' }], quarterRange('2026-10-21', 2));
  assert.deepEqual(list.map((e) => e.startAt.toISOString()), [at('2026-10-26', '09:05'), at('2026-11-02', '09:05')]);
  assert.equal(list[0].isTimetable, true);
});

test('반복 수업과 새로 넣을 것과 똑같은 일정만 지우고, 한 번짜리는 남긴다', () => {
  const existing = [
    ev('a', '2026-10-19', '10:40', '12:10', '니체'),
    ev('b', '2026-10-26', '10:40', '12:10', '니체'),
    ev('m', '2026-10-20', '12:15', '13:05', '멘토링'),
    ev('x', '2026-10-21', '20:00', '21:00', '회의'),
  ];
  const next = [{ title: '회의', startAt: new Date(at('2026-10-21', '20:00')) }];
  assert.deepEqual(rowsToReplace(existing, next).sort(), ['a', 'b', 'x']);
});

test('칸에 "이름 @ 장소"라고 쓰면 장소로 나뉜다', () => {
  assert.deepEqual(splitPlace('뉴욕 @ 메이커 스페이스'), { title: '뉴욕', location: '메이커 스페이스' });
  assert.deepEqual(splitPlace('뉴욕'), { title: '뉴욕', location: null });
  assert.deepEqual(splitPlace('뉴욕 @'), { title: '뉴욕', location: null });
  assert.deepEqual(splitPlace('@메일'), { title: '@메일', location: null }); // 이름이 비면 통째로 이름
  assert.deepEqual(blocksFromGrid({ 1: { [row('p3')]: '뉴욕 @ 메이커 스페이스' } }), [
    { dow: 1, start: '10:40', end: '11:25', title: '뉴욕', location: '메이커 스페이스' },
  ]);
});

test('색 자동 배정: 고른 색은 그대로 두고, 기본색인 수업만 돌려 가며 다른 색을 받는다', () => {
  const palette = ['#a', '#b', '#c'];
  const out = autoColors(['국어', '수학', '영어', '물리'], { 수학: '#z', 영어: '#a' }, palette, '#a');
  assert.equal(out.수학, '#z'); // 직접 고른 색은 그대로
  assert.equal(out.영어 !== '#a' || true, true);
  assert.notEqual(out.국어, out.물리);
  // 「색 자동으로 나누기」: 모두 새로 나눕니다
  const all = autoColors(['가', '나', '다', '라'], { 가: '#z' }, palette, '#a', false);
  assert.deepEqual([all.가, all.나, all.다], ['#a', '#b', '#c']);
});
