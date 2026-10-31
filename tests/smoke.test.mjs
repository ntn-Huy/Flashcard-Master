// Kiểm thử tự động bằng jsdom: chạy "npm test"
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const opened = [];
afterEach(() => { while (opened.length) { try { opened.pop().window.close(); } catch (e) {} } });

function makeXlsx() {
  const rows = [['Word', 'Phonetic', 'Meaning', 'Example']];
  const words = ['apple', 'book', 'cat', 'dog', 'egg', '<img src=x onerror="window.__xss=1">'];
  words.forEach((w, i) => rows.push([w, '/x/', 'nghĩa ' + i, 'ex ' + w]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function boot({ ls = {}, files = ['Test_Deck.xlsx'] } = {}) {
  let html = read('index.html');
  const inline = (src) => `<script>${read(src).replace(/<\/script>/g, '<\\/script>')}</script>`;
  html = html.replace(/<script defer src="\.\/vendor\/confetti[^"]*"><\/script>/, '')
    .replace(/<script defer src="\.\/js\/app\.js[^"]*"><\/script>/, inline('js/app.js'))
    .replace(/<script defer src="\.\/js\/features\.js[^"]*"><\/script>/, inline('js/features.js'))
    .replace(/<link rel="stylesheet"[^>]*>/g, '');
  const xbuf = makeXlsx();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      Object.entries(ls).forEach(([k, v]) => w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
      w.localStorage.setItem('flash_onboarded', '1');
      w.confetti = () => {}; w.alert = () => {}; w.confirm = () => true; w.prompt = () => 'X';
      w.XLSX = XLSX;
      w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
      w.speechSynthesis = { cancel() {}, speak() {}, getVoices: () => [] };
      w.SpeechSynthesisUtterance = function () {};
      w.fetch = async (url) => {
        const u = String(url);
        if (u.endsWith('data/files.json')) return { ok: true, json: async () => files, headers: { get: () => null } };
        if (u.endsWith('Test_Deck.xlsx')) return { ok: true, arrayBuffer: async () => xbuf.buffer.slice(xbuf.byteOffset, xbuf.byteOffset + xbuf.byteLength), headers: { get: (h) => (h === 'etag' ? 'abc' : null) } };
        return { ok: false, headers: { get: () => null } };
      };
    }
  });
  opened.push(dom);
  const w = dom.window;
  const ev = (c) => w.eval(c);
  for (let i = 0; i < 60; i++) {
    await sleep(50);
    try { if (ev("typeof decks === 'object' && Object.keys(decks).length > 0 && document.getElementById('range-mode-select').options.length > 0")) break; } catch (e) {}
  }
  await sleep(100);
  return { w, ev, dom };
}
const mode = (ev, m) => ev(`switchMode('${m}')`);

test('nạp bộ bài từ data/, tên bộ bài, bộ bài mặc định không lưu vào bộ nhớ người dùng', async () => {
  const { ev } = await boot();
  assert.equal(ev("Object.keys(decks).join()"), 'Test Deck');
  assert.equal(ev("decks['Test Deck'].length"), 6);
  assert.equal(ev("repoDeckNames.has('Test Deck')"), true);
  assert.equal(ev("Object.keys(userDecksOnly()).length"), 0);
  assert.match(ev("decks['Test Deck'][0].id"), /^Test Deck::apple$/);
});

test('chống XSS: tên/nội dung độc hại không tạo phần tử HTML', async () => {
  const { w, ev } = await boot();
  ev(`decks['<img src=x onerror=window.__xss=2>'] = [{id:'z1', Word:'<svg onload=window.__xss=3>', Meaning:'<img src=y onerror=window.__xss=4>', Phonetic:'', Example:'', POS:'word'}]`);
  ev('renderDecksList()');
  mode(ev, 'quiz'); mode(ev, 'spelling');
  ev("currentSpellingWord = {Word:'<b>x</b>', Meaning:'m'}; spellLocked=false; document.getElementById('spelling-input').value='<img src=q onerror=window.__xss=5>'; checkSpelling({preventDefault(){}})");
  ev("handleQuizAnswer('a', '<img src=n onerror=window.__xss=6>', document.createElement('button'))");
  assert.equal(w.document.querySelectorAll('img[src], svg[onload]').length, 0);
  assert.equal(w.__xss, undefined);
  assert.equal(ev("esc('<a href=\"x\">&</a>')"), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('flashcard theo phiên: thuộc thì rời vòng, ôn lại quay lại, xong thì chúc mừng', async () => {
  const { ev } = await boot();
  ev("document.getElementById('range-mode-select').value='all_range'; applyStudySettings()");
  assert.equal(ev('filteredWords.length'), 6);
  const first = ev('filteredWords[0].Word');
  ev("markStatus('review')");
  assert.equal(ev('filteredWords.length'), 6);
  assert.notEqual(ev('filteredWords[0].Word'), first);
  assert.equal(ev('filteredWords[4].Word'), first); // quay lại sau đúng 4 thẻ khác
  let guard = 0;
  while (ev('filteredWords.length') > 0 && guard++ < 30) ev("markStatus('mastered')");
  assert.equal(ev("document.getElementById('cards-done').classList.contains('hidden')"), false);
  assert.match(ev("document.getElementById('cards-done-msg').textContent"), /Số lượt ôn lại: 1/);
  assert.equal(ev("U('cardSessions')"), 1);
  assert.equal(ev('masteredIds.size'), 6);
});

test('hoàn tác khôi phục hàng đợi, trạng thái thuộc, SRS và XP', async () => {
  const { ev } = await boot();
  ev("document.getElementById('range-mode-select').value='all_range'; applyStudySettings()");
  const xp0 = ev('userStats.xp'), k = ev('wkey(filteredWords[0])');
  ev("markStatus('mastered')");
  assert.equal(ev('masteredIds.size'), 1);
  assert.ok(ev(`!!srs[${JSON.stringify(k)}]`));
  ev('undoMark()');
  assert.equal(ev('masteredIds.size'), 0);
  assert.equal(ev('filteredWords.length'), 6);
  assert.equal(ev(`srs[${JSON.stringify(k)}]`), undefined);
  assert.equal(ev('userStats.xp'), xp0);
});

test('SRS 4 mức: Quên / Khó / Tốt / Dễ', async () => {
  const { ev } = await boot();
  ev("document.getElementById('range-mode-select').value='all_range'; applyStudySettings()");
  const keys = [0, 1, 2, 3].map((i) => ev(`wkey(filteredWords[${i}])`));
  ev("markStatus('easy')");   // từ 0 -> hộp 2
  ev("markStatus('mastered')"); // -> hộp 1
  ev("markStatus('hard')");   // -> hộp 1, đến hạn ngày mai
  assert.equal(ev(`srs[${JSON.stringify(keys[0])}].box`), 2);
  assert.equal(ev(`srs[${JSON.stringify(keys[1])}].box`), 1);
  const hardSt = ev(`srs[${JSON.stringify(keys[2])}]`);
  assert.equal(hardSt.box, 1);
  assert.equal(hardSt.due, ev('todayNum() + 1'));
  ev("markStatus('review')");
  assert.equal(ev(`srs[${JSON.stringify(keys[3])}].lapses`), 1);
});

test('trắc nghiệm Việt→Anh, đáp án nhiễu thông minh, tự chuyển câu khi đúng', async () => {
  const { w, ev } = await boot();
  ev("setSetting('dir', 'vi2en')");
  mode(ev, 'quiz');
  const target = ev('currentQuizWord');
  assert.equal(ev("document.getElementById('quiz-target-word').textContent"), target.Meaning);
  const btns = [...w.document.querySelectorAll('#quiz-options button')];
  assert.ok(btns.length >= 4);
  btns.find((b) => b.textContent === target.Word).click();
  await sleep(1250);
  assert.notEqual(ev('currentQuizWord.Word'), target.Word);
  assert.equal(ev('quizQueue.length'), 5);
});

test('chính tả: gợi ý, so sánh chữ khi sai, từ sai quay lại', async () => {
  const { ev } = await boot();
  mode(ev, 'spelling');
  const word = ev('currentSpellingWord.Word');
  ev('spellHint()');
  assert.match(ev("document.getElementById('spelling-hint').textContent"), /_/);
  ev("document.getElementById('spelling-input').value='zzz'; checkSpelling({preventDefault(){}})");
  assert.match(ev("document.getElementById('spelling-feedback').textContent"), /Bạn gõ/);
  assert.equal(ev('spellQueue.length'), 6);
  assert.equal(ev('spellQueue[spellQueue.length-1].Word'), word);
});

test('học hôm nay, danh hiệu, nhiệm vụ, cấp độ, đóng băng chuỗi', async () => {
  const { w, ev } = await boot();
  assert.match(w.document.getElementById('today-card').textContent, /Bắt đầu học hôm nay/);
  ev('startToday()');
  assert.equal(ev("document.getElementById('range-mode-select').value"), 'today');
  assert.equal(ev('filteredWords.length'), 6);
  assert.equal(ev('BADGES.length'), 24);
  assert.equal(new Set(ev('todayQuests().map(x => x.q.id)')).size, 3);
  ev('addXP(500)');
  assert.ok(ev('levelOf(userStats.xp)') >= 3);
  ev('userStats.streak = 5; userStats.freeze = 1; userStats.lastDate = todayNum() - 2; touchStreak()');
  assert.equal(ev('userStats.streak'), 6);
  assert.equal(ev('userStats.freeze'), 0);
});

test('lưu và tiếp tục phiên học dở', async () => {
  const { ev } = await boot();
  ev("document.getElementById('range-mode-select').value='all_range'; applyStudySettings()");
  ev("markStatus('mastered'); markStatus('mastered')");
  ev('saveSessionNow()');
  assert.ok(ev('!!getPendingSession()'));
  ev('applyStudySettings()');
  assert.equal(ev('filteredWords.length'), 6);
  ev('resumeSession()');
  assert.equal(ev('filteredWords.length'), 4);
  assert.equal(ev('cardTotal'), 6);
  assert.equal(ev('activeMode'), 'flashcard');
});

test('thống kê nâng cao, sao lưu và cài đặt', async () => {
  const { w, ev } = await boot();
  ev("markStatus('mastered')");
  mode(ev, 'dashboard');
  const txt = w.document.getElementById('stats-extra').textContent;
  assert.match(txt, /Lịch hoạt động/);
  assert.match(txt, /Top 10 từ khó nhất/);
  const b = ev('collectBackup()');
  assert.equal(b.app, 'english-flashcards');
  assert.equal(b.mastered.length, 1);
  assert.equal(Object.keys(b.userDecks).length, 0);
  ev("setSetting('font', 115); setSetting('reduce', true); setSetting('sfx', false)");
  assert.equal(w.document.documentElement.style.fontSize, '115%');
  assert.equal(w.document.documentElement.classList.contains('reduce-motion'), true);
  ev('openSettings()');
  assert.equal(w.document.getElementById('settings-modal').classList.contains('hidden'), false);
});

test('di chuyển dữ liệu phiên bản cũ: mã từ cũ -> mã ổn định, bỏ flash_decks', async () => {
  const old = { 'Bo Cu': [{ id: 'file_1700000000000_1', Word: 'Cat', Meaning: 'mèo' }, { id: 'file_1700000000000_2', Word: 'dog', Meaning: 'chó' }] };
  const { w, ev } = await boot({ files: [], ls: { flash_decks: old, flash_mastered: ['file_1700000000000_1'], flash_srs: { file_1700000000000_2: { box: 2, due: 1, reps: 3 } } } });
  assert.equal(ev("decks['Bo Cu'].map(x => x.id).join()"), 'Bo Cu::cat,Bo Cu::dog');
  assert.equal(ev('[...masteredIds].join()'), 'Bo Cu::cat');
  assert.equal(ev('Object.keys(srs).join()'), 'Bo Cu::dog');
  assert.equal(w.localStorage.getItem('flash_decks'), null);
});

test('không còn phụ thuộc CDN; có CSP; có tệp PWA', () => {
  const html = read('index.html');
  assert.ok(!/https?:\/\//.test(html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')), 'index.html không được gọi tài nguyên ngoài');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /manifest\.webmanifest/);
  for (const f of ['js/app.js', 'js/features.js']) assert.ok(!/https?:\/\/(cdn|unpkg)/.test(read(f)));
});
