// Default Sample Vocabulary Data fallback
const SAMPLE_DECKS = {
    "Vocabulary A2": [
        { id: "v_a2_1", Word: "ability", Phonetic: "/ə'bɪləti/", Meaning: "khả năng", Example: "She has the ability to pass the exam.", POS: "word" },
        { id: "v_a2_2", Word: "able", Phonetic: "/'eɪbl/", Meaning: "có thể", Example: "I am able to swim.", POS: "word" },
        { id: "v_a2_3", Word: "abroad", Phonetic: "/ə'brɔ:d/", Meaning: "nước ngoài", Example: "They went abroad for their holiday.", POS: "adv" },
        { id: "v_a2_4", Word: "accept", Phonetic: "/ək'sept/", Meaning: "chấp nhận", Example: "He accepted the new job offer.", POS: "verb" },
        { id: "v_a2_5", Word: "accident", Phonetic: "/'æksɪdənt/", Meaning: "tai nạn", Example: "She was injured in a car accident.", POS: "noun" }
    ]
};

// Danh sách các file mặc định trong thư mục /data
const DEFAULT_DATA_FILES = [
    "./data/Vocabulary A1.xlsx",
    "./data/Vocabulary A2.xlsx",
    "./data/Vocabulary B1.xlsx",
    "./data/Vocabulary B2.xlsx",
    "./data/Vocabulary C1.xlsx",
    "./data/Vocabulary C2.xlsx",
    "./data/default_decks.json"
];

// Application State
let decks = {};
let selectedSourceDeck = "ALL";
let rawSourceWords = [];
let activeWords = [];
let filteredWords = [];
let currentIndex = 0;
let isFlipped = false;
let activeMode = 'decks';

// Daily Progress Settings
let dailyWordLimit = 30;
let selectedDay = 1;

// Saved status sets
let masteredIds = new Set();
let reviewIds = new Set();

// Timer & Game States
let timerSeconds = 0;
let timerInterval = null;
let isTimerRunning = false;
let currentQuizWord = null;
let quizScore = 0;
let currentSpellingWord = null;

// -------------------------------------------------------------
// TÍNH NĂNG BỔ SUNG: SRS, XP, STREAK, HUY HIỆU, ĐỌC TỰ ĐỘNG, MIC, PWA
// -------------------------------------------------------------
const DAY_MS = 86400000;
const todayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / DAY_MS);
const wkey = w => w.id || w.Word;
const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120]; // ngày giãn cách theo từng "hộp"
let srs = JSON.parse(localStorage.getItem('flash_srs') || '{}');
let userStats = Object.assign({ xp: 0, streak: 0, lastDate: 0, badges: [] }, JSON.parse(localStorage.getItem('flash_user_stats') || '{}'));
let autoPlay = localStorage.getItem('flash_autoplay') !== '0';
let quizAnswered = false, spellFailed = false, spellLocked = false, spellStreak = 0;
// Phiên làm bài: mỗi từ phải trả lời đúng; từ sai sẽ được xếp lại cuối hàng cho tới khi đúng hết
let quizQueue = null, quizTotal = 0, quizErrors = 0, quizDone = false, quizFailedSet = new Set();
let spellQueue = null, spellTotal = 0, spellErrors = 0, spellDone = false, spellFailedSet = new Set();

const saveSrs = () => localStorage.setItem('flash_srs', JSON.stringify(srs));
const saveStats = () => localStorage.setItem('flash_user_stats', JSON.stringify(userStats));

const allWordsList = () => Object.values(decks).flat();
const dueWords = () => allWordsList().filter(w => { const st = srs[wkey(w)]; return st && st.due <= todayNum(); });
const reviewWordsAll = () => allWordsList().filter(w => reviewIds.has(wkey(w)));

function refreshSpecialRangeLabels() {
    const sel = document.getElementById('range-mode-select');
    if (!sel) return;
    [...sel.options].forEach(o => {
        if (o.value === 'srs_due') o.textContent = `🔁 Đến hạn ôn hôm nay - SRS (${dueWords().length} từ)`;
        if (o.value === 'review_all') o.textContent = `⚠ Từ hay quên - tất cả bài (${reviewWordsAll().length} từ)`;
    });
}

// ----- Streak / XP / Badges -----

function updateStatsDisplay() {
    document.querySelectorAll('.js-streak').forEach(el => el.textContent = userStats.streak);
    document.querySelectorAll('.js-xp').forEach(el => el.textContent = userStats.xp);
}

const U = k => userStats[k] || 0;
const srsBox4 = () => Object.values(srs).filter(s => s.box >= 4).length;
const deckMastered = () => Object.values(decks).some(d => d.length >= 10 && d.every(w => masteredIds.has(wkey(w)))) ? 1 : 0;
const bestStreakNow = () => Math.max(userStats.streak, U('bestStreak'));
// [id, nhóm, bậc(0-3), tên, mô tả, icon, mục tiêu, hàm giá trị, bí mật?]
const BADGES = [
    ['newbie', 'Từ vựng', 1, 'Tân thủ', 'Thuộc 50 từ', 'fa-seedling', 50, () => masteredIds.size],
    ['scholar', 'Từ vựng', 2, 'Học giả', 'Thuộc 200 từ', 'fa-book-open', 200, () => masteredIds.size],
    ['sage', 'Từ vựng', 3, 'Bác học', 'Thuộc 500 từ', 'fa-graduation-cap', 500, () => masteredIds.size],
    ['master', 'Từ vựng', 3, 'Thông thái', 'Thuộc 1000 từ', 'fa-crown', 1000, () => masteredIds.size],
    ['diligent', 'Chuỗi ngày', 1, 'Chăm chỉ', 'Học 7 ngày liên tiếp', 'fa-calendar-check', 7, bestStreakNow],
    ['persist', 'Chuỗi ngày', 2, 'Kiên trì', 'Học 14 ngày liên tiếp', 'fa-calendar-day', 14, bestStreakNow],
    ['tough', 'Chuỗi ngày', 3, 'Bền bỉ', 'Học 30 ngày liên tiếp', 'fa-fire', 30, bestStreakNow],
    ['legend', 'Chuỗi ngày', 3, 'Huyền thoại', 'Học 100 ngày liên tiếp', 'fa-medal', 100, bestStreakNow],
    ['speller', 'Chính tả', 1, 'Thánh chính tả', '1 bài chính tả không sai câu nào', 'fa-spell-check', 1, () => U('spellPerfect')],
    ['goldhand', 'Chính tả', 3, 'Bàn tay vàng', '5 bài chính tả không sai câu nào', 'fa-pen-nib', 5, () => U('spellPerfect')],
    ['quizking', 'Trắc nghiệm', 1, 'Nhà vô địch', '1 bài trắc nghiệm không sai câu nào', 'fa-trophy', 1, () => U('quizPerfect')],
    ['combo10', 'Trắc nghiệm', 2, 'Combo 10', 'Đúng liên tiếp 10 câu', 'fa-bolt', 10, () => U('bestCombo')],
    ['combo25', 'Trắc nghiệm', 3, 'Combo 25', 'Đúng liên tiếp 25 câu', 'fa-rocket', 25, () => U('bestCombo')],
    ['voice20', 'Phát âm', 1, 'Giọng chuẩn', 'Phát âm đạt 20 lần', 'fa-microphone', 20, () => U('pronOk')],
    ['voice100', 'Phát âm', 3, 'Giọng bản xứ', 'Phát âm đạt 100 lần', 'fa-headphones', 100, () => U('pronOk')],
    ['steel', 'Ôn tập SRS', 2, 'Trí nhớ thép', '20 từ đạt hộp 4 trở lên', 'fa-brain', 20, srsBox4],
    ['hardslayer', 'Ôn tập SRS', 2, 'Diệt từ khó', 'Đưa 20 từ ra khỏi danh sách hay quên', 'fa-shield-halved', 20, () => U('hardCleared')],
    ['firstday', 'Hoàn thành', 1, 'Khởi đầu', 'Hoàn thành 1 phiên học thẻ', 'fa-flag-checkered', 1, () => U('cardSessions')],
    ['deckmaster', 'Hoàn thành', 3, 'Chinh phục bộ bài', 'Thuộc 100% một bộ bài (từ 10 từ)', 'fa-gem', 1, deckMastered],
    ['xp500', 'Điểm XP', 1, 'Tích lũy', 'Đạt 500 XP', 'fa-star', 500, () => userStats.xp],
    ['xp2000', 'Điểm XP', 2, 'Sung sức', 'Đạt 2.000 XP', 'fa-star-half-stroke', 2000, () => userStats.xp],
    ['xp10000', 'Điểm XP', 3, 'Cao thủ', 'Đạt 10.000 XP', 'fa-ranking-star', 10000, () => userStats.xp],
    ['owl', 'Bí mật', 0, 'Cú đêm', 'Học sau 22h đêm', 'fa-moon', 1, () => U('owl'), true],
    ['early', 'Bí mật', 0, 'Chim sớm', 'Học trước 6h sáng', 'fa-sun', 1, () => U('early'), true]
].map(a => ({ id: a[0], g: a[1], t: a[2], name: a[3], desc: a[4], icon: a[5], target: a[6], value: a[7], secret: !!a[8] }));

let badgeQ = 0;
function awardBadge(id) {
    if (userStats.badges.includes(id)) return;
    userStats.badges.push(id);
    userStats.xp += 50;
    saveStats();
    updateStatsDisplay();
    const b = BADGES.find(x => x.id === id);
    if (!b) return;
    setTimeout(() => { toast(`🏅 Danh hiệu mới: ${b.name} (+50 XP)`); badgeQ = Math.max(0, badgeQ - 1); }, badgeQ++ * 2900);
}
function checkBadges() {
    let any = false;
    BADGES.forEach(b => { if (!userStats.badges.includes(b.id) && b.value() >= b.target) { awardBadge(b.id); any = true; } });
    if (any) fx({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
}
function renderBadges() {
    const grid = document.getElementById('badges-grid');
    if (!grid) return;
    const tierCls = ['text-amber-500', 'text-orange-500', 'text-slate-400', 'text-yellow-500'];
    let html = '', lastG = '', got = 0;
    BADGES.forEach(b => {
        if (b.g !== lastG) { lastG = b.g; html += `<p class="col-span-full text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-2">${b.g}</p>`; }
        const ok = userStats.badges.includes(b.id);
        if (ok) got++;
        const v = Math.min(b.value(), b.target), pct = Math.round(v / b.target * 100);
        const hide = b.secret && !ok;
        html += `<div class="p-3 rounded-2xl border ${ok ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 opacity-70'}">
            <div class="flex items-center gap-3">
                <i class="fa-solid ${ok ? b.icon : (hide ? 'fa-question' : 'fa-lock')} text-lg w-6 text-center ${ok ? tierCls[b.t] : 'text-slate-400'}"></i>
                <div class="min-w-0"><p class="text-xs font-bold text-slate-900 dark:text-white">${hide ? '???' : b.name}</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">${hide ? 'Danh hiệu bí mật' : b.desc}</p></div>
            </div>
            ${(ok || hide) ? '' : `<div class="mt-2 flex items-center gap-2"><div class="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden"><div class="bg-indigo-500 h-full rounded-full" style="width:${pct}%"></div></div><span class="text-[10px] font-semibold text-slate-400">${v}/${b.target}</span></div>`}
        </div>`;
    });
    grid.innerHTML = html;
    const bc = document.getElementById('badge-count');
    if (bc) bc.textContent = `(Đã mở ${got}/${BADGES.length})`;
    const due = document.getElementById('stat-due');
    if (due) due.textContent = dueWords().length;
}

// ----- Toast -----

// ----- Phát âm tự động -----

const autoSpeak = text => { if (autoPlay) say(text); };
function autoSpeakCurrent() {
    if (S.dir === 'vi2en') return;
    if (filteredWords.length && activeMode === 'flashcard') autoSpeak(filteredWords[currentIndex].Word);
}

// ----- Luyện nói (Speech Recognition) -----
const normW = s => (s || '').toLowerCase().replace(/[^a-z0-9' ]/g, '').trim();
function levenshtein(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
}
function recognizeSpeech(btn, target, onDone) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Trình duyệt không hỗ trợ micro (hãy dùng Chrome/Safari)'); return; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const rec = new SR();
    rec.lang = 'en-US';
    rec.maxAlternatives = 5;
    const pulse = v => { btn.classList.toggle('animate-pulse', v); btn.classList.toggle('text-rose-500', v); };
    pulse(true);
    toast('🎤 Đang nghe... hãy đọc to từ này');
    rec.onresult = (e) => {
        const t = normW(target);
        let best = 0, heard = '';
        [...e.results[0]].forEach(a => {
            const n = normW(a.transcript);
            const sc = 1 - levenshtein(n, t) / Math.max(n.length, t.length, 1);
            if (sc >= best) { best = sc; heard = a.transcript; }
        });
        onDone(best, heard.trim());
    };
    rec.onerror = () => { pulse(false); toast('Không nghe rõ, hãy thử lại!'); };
    rec.onend = () => pulse(false);
    try { rec.start(); } catch (err) { pulse(false); }
}
function practicePronunciation(e) {
    if (e) e.stopPropagation();
    if (!filteredWords.length) return;
    const cur = filteredWords[currentIndex];
    recognizeSpeech(document.getElementById('btn-card-mic'), cur.Word, (score, heard) => {
        const pct = Math.round(score * 100);
        if (score >= 0.8) { playSoundEffect('correct'); userStats.pronOk = U('pronOk') + 1; saveStats(); const pl = todayLog(); pl.po++; saveLog(); checkQuests(); addXP(5); toast(`✅ Phát âm tốt! (${pct}%) - nghe được: "${heard}"`); }
        else { playSoundEffect('wrong'); toast(`❌ Chưa chuẩn (${pct}%) - nghe được: "${heard}"`); }
    });
}
function startSpellingMic() {
    if (!currentSpellingWord) return;
    recognizeSpeech(document.getElementById('btn-spell-mic'), currentSpellingWord.Word, (score, heard) => {
        document.getElementById('spelling-input').value = heard.toLowerCase().replace(/[.,!?]+$/, '');
        const f = document.getElementById('spelling-form');
        f.requestSubmit ? f.requestSubmit() : checkSpelling({ preventDefault() {} });
    });
}

// ----- PWA (GitHub Pages): đăng ký service worker -----
function registerSW() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const nw = reg.installing;
                if (nw) nw.addEventListener('statechange', () => {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('✨ Có phiên bản mới - hãy tải lại trang để cập nhật');
                });
            });
        }).catch(() => {});
    });
}

// ----- Hướng dẫn nhập Excel -----
function openExcelGuide() { document.getElementById('excel-guide').classList.remove('hidden'); }
function closeExcelGuide() { document.getElementById('excel-guide').classList.add('hidden'); }
function pickExcelFile() { closeExcelGuide(); document.getElementById('excel-upload').click(); }
async function downloadExcelTemplate() {
    try { await ensureXLSX(); } catch (e) { alert(e.message); return; }
    const rows = [
        ['Word', 'Phonetic', 'Meaning', 'Example'],
        ['apple', '/ˈæp.əl/', 'quả táo', 'I eat an apple every day.'],
        ['book', '/bʊk/', 'quyển sách', 'She is reading a book.'],
        ['beautiful', '/ˈbjuː.tɪ.fəl/', 'xinh đẹp', 'What a beautiful day!']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 44 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vocabulary');
    XLSX.writeFile(wb, 'Mau_Flashcard.xlsx');
}

// ----- ID ổn định + cập nhật bộ bài từ thư mục data/ -----
function assignStableIds(name, words) {
    const seen = {};
    words.forEach(w => {
        const base = `${name}::${String(w.Word || '').trim().toLowerCase()}`;
        const n = (seen[base] = (seen[base] || 0) + 1);
        w.id = n === 1 ? base : `${base}#${n}`;
    });
}
function migrateIds() {
    const old = /^(file|imported|auto)_\d+_/;
    const map = {};
    Object.entries(decks).forEach(([name, ws]) => {
        if (!Array.isArray(ws) || !ws.some(w => old.test(String(w.id)))) return;
        const before = ws.map(w => w.id);
        assignStableIds(name, ws);
        ws.forEach((w, i) => { if (before[i] !== w.id) map[before[i]] = w.id; });
    });
    if (!Object.keys(map).length) return;
    const mv = set => [...set].forEach(k => { if (map[k]) { set.delete(k); set.add(map[k]); } });
    mv(masteredIds); mv(reviewIds);
    Object.keys(srs).forEach(k => { if (map[k]) { srs[map[k]] = srs[k]; delete srs[k]; } });
    saveSrs();
    localStorage.setItem('flash_mastered', JSON.stringify([...masteredIds]));
    localStorage.setItem('flash_review', JSON.stringify([...reviewIds]));
    persistDecks();
}
async function getDataFileList() {
    try {
        const r = await fetch('./data/files.json', { cache: 'no-cache' });
        if (r.ok) {
            const a = await r.json();
            if (Array.isArray(a) && a.length) return a.map(n => /^(\.|https?:)/.test(n) ? n : './data/' + n);
        }
    } catch (e) {}
    return DEFAULT_DATA_FILES;
}

// ----- Phiên học thẻ -----
let cardTotal = 0, cardRated = new Set(), cardReviewMap = new Map();
function updateCardBar() {
    const done = cardTotal - filteredWords.length;
    const pct = cardTotal > 0 ? Math.round(done / cardTotal * 100) : 0;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('card-done-count', Math.max(done, 0)); set('card-total', cardTotal); set('card-percent', pct + '%');
    const b = document.getElementById('card-bar'); if (b) b.style.width = pct + '%';
    setBarAria('card-bar', pct);
}
function finishCards() {
    userStats.cardSessions = U('cardSessions') + 1;
    saveStats();
    const vals = [...cardReviewMap.values()];
    const reviews = vals.reduce((a, b) => a + b.n, 0);
    const hardest = vals.sort((a, b) => b.n - a.n)[0];
    let msg = `Bạn đã thuộc tất cả ${cardTotal} từ trong phạm vi này.`;
    if (reviews === 0) { addXP(50); msg = `Tuyệt vời! Thuộc cả ${cardTotal} từ mà không phải ôn lại lần nào (+50 XP).`; }
    else msg += ` Số lượt ôn lại: ${reviews}` + (hardest ? ` · Từ khó nhất: "${hardest.w.Word}" (${hardest.n} lần)` : '');
    document.getElementById('cards-done-msg').textContent = msg;
    document.getElementById('cards-body').classList.add('hidden');
    document.getElementById('cards-done').classList.remove('hidden');
    updateCardBar();
    fx({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    checkBadges();
    dropSessionPart('card');
}
function comboHit(ok) {
    if (!ok) { userStats.combo = 0; return; }
    userStats.combo = U('combo') + 1;
    if (userStats.combo > U('bestCombo')) { userStats.bestCombo = userStats.combo; saveStats(); }
}

// ----- Phiên Trắc nghiệm -----
function sessionPool() { return activeWords.length > 0 ? activeWords : rawSourceWords; }
function setBar(prefix, remaining, total) {
    const pct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0;
    document.getElementById(prefix + '-remaining').textContent = remaining;
    document.getElementById(prefix + '-percent').textContent = pct + '%';
    document.getElementById(prefix + '-bar').style.width = pct + '%';
    setBarAria(prefix + '-bar', pct);
}
function updateQuizProgress() { setBar('quiz', quizQueue ? quizQueue.length : 0, quizTotal); }

function startQuizSession() {
    quizQueue = [...sessionPool()].sort(() => Math.random() - 0.5);
    quizTotal = quizQueue.length;
    quizErrors = 0; quizDone = false; quizScore = 0; quizFailedSet = new Set();
    document.getElementById('quiz-score').textContent = 'Điểm: 0';
    document.getElementById('quiz-body').classList.remove('hidden');
    document.getElementById('quiz-done').classList.add('hidden');
    updateQuizProgress();
    generateQuizQuestion();
}
function nextQuizQuestion() {
    // bấm "Câu tiếp theo" khi chưa trả lời = bỏ qua tạm, từ đó sẽ quay lại sau
    if (!quizAnswered && quizQueue && quizQueue.length > 1) quizQueue.push(quizQueue.shift());
    generateQuizQuestion();
}
function finishQuiz() {
    document.getElementById('quiz-body').classList.add('hidden');
    document.getElementById('quiz-done').classList.remove('hidden');
    updateQuizProgress();
    if (!quizDone) {
        quizDone = true;
        fx({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
        let msg = `Bạn đã trả lời đúng tất cả ${quizTotal} từ trong phạm vi này.`;
        if (quizErrors === 0) {
            userStats.quizPerfect = U('quizPerfect') + 1; saveStats(); addXP(50);
            msg = `Tuyệt vời! Đúng 100% ngay lần đầu cả ${quizTotal} từ (+50 XP).`;
        } else msg += ` (Sai ${quizErrors} lượt)`;
        document.getElementById('quiz-done-msg').textContent = msg;
    }
    checkBadges();
    dropSessionPart('quiz');
}

// ----- Phiên Chính tả -----
function updateSpellProgress() { setBar('spell', spellQueue ? spellQueue.length : 0, spellTotal); }
function startSpellingSession() {
    spellQueue = [...sessionPool()].sort(() => Math.random() - 0.5);
    spellTotal = spellQueue.length;
    spellErrors = 0; spellDone = false; spellFailedSet = new Set();
    document.getElementById('spelling-body').classList.remove('hidden');
    document.getElementById('spelling-done').classList.add('hidden');
    updateSpellProgress();
    generateSpellingQuestion();
}
function finishSpelling() {
    document.getElementById('spelling-body').classList.add('hidden');
    document.getElementById('spelling-done').classList.remove('hidden');
    updateSpellProgress();
    if (!spellDone) {
        spellDone = true;
        fx({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
        let msg = `Bạn đã viết đúng tất cả ${spellTotal} từ trong phạm vi này.`;
        if (spellErrors === 0) {
            userStats.spellPerfect = U('spellPerfect') + 1; saveStats(); addXP(50);
            msg = `Tuyệt vời! Không sai câu nào, đúng cả ${spellTotal} từ (+50 XP).`;
        } else msg += ` (Sai ${spellErrors} lượt)`;
        document.getElementById('spelling-done-msg').textContent = msg;
    }
    checkBadges();
    dropSessionPart('spell');
}

// ----- Âm thanh hiệu ứng đúng / sai -----

// ----- Vuốt thẻ: trái = Ôn lại, phải = Đã thuộc -----
let swipeMoved = false;
function onCardClick() {
    if (swipeMoved) { swipeMoved = false; return; }
    flipCard();
}
function initCardSwipe() {
    const card = document.getElementById('flashcard');
    const ovL = document.getElementById('swipe-left');
    const ovR = document.getElementById('swipe-right');
    if (!card) return;
    let startX = 0, dx = 0, drag = false, pid = null;

    const clear = () => { card.style.transform = ''; card.style.opacity = 1; ovL.style.opacity = 0; ovR.style.opacity = 0; };

    card.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || !filteredWords.length) return;
        drag = true; startX = e.clientX; dx = 0; pid = e.pointerId;
        card.style.transition = 'none';
    });
    window.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== pid) return;
        dx = e.clientX - startX;
        if (Math.abs(dx) > 6) swipeMoved = true;
        card.style.transform = `translateX(${dx}px) rotate(${dx * 0.04}deg)`;
        const o = Math.min(Math.abs(dx) / 120, 1);
        ovR.style.opacity = dx > 0 ? o : 0;
        ovL.style.opacity = dx < 0 ? o : 0;
    });
    const end = (e) => {
        if (!drag || (e && e.pointerId !== pid)) return;
        drag = false;
        if (Math.abs(dx) > 110) {
            const dir = dx > 0 ? 1 : -1;
            card.style.transition = 'transform .2s ease, opacity .2s ease';
            card.style.transform = `translateX(${dir * 500}px) rotate(${dir * 20}deg)`;
            card.style.opacity = 0;
            setTimeout(() => {
                card.style.transition = 'none';
                clear();
                markStatus(dir > 0 ? 'mastered' : 'review');
            }, 200);
        } else {
            card.style.transition = 'transform .25s ease';
            clear();
        }
        setTimeout(() => { swipeMoved = false; }, 50);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    initFeatures();
    initTheme();
    startTimer();
    updateStatsDisplay();
    registerSW();
    initCardSwipe();
    setupExcelReader();
    await loadSavedDataAndDefaultFiles();
    afterLoad();
});

// -------------------------------------------------------------
// STORAGE & DECKS MANAGEMENT + AUTOMATIC /DATA FETCHING
// -------------------------------------------------------------
async function loadSavedDataAndDefaultFiles() {
    const savedMastered = localStorage.getItem('flash_mastered');
    const savedReview = localStorage.getItem('flash_review');
    const savedLimit = localStorage.getItem('flash_daily_limit');

    if (savedMastered) masteredIds = new Set(safeJSON(savedMastered, []));
    if (savedReview) reviewIds = new Set(safeJSON(savedReview, []));
    if (savedLimit) dailyWordLimit = parseInt(savedLimit, 10) || 30;
    document.getElementById('daily-limit-input').value = dailyWordLimit;

    decks = await loadUserDecks();   // bộ bài do người dùng nhập (IndexedDB)
    migrateIds();

    // Tự động tải các file từ thư mục /data/ (cập nhật khi file trên GitHub thay đổi)
    await fetchDefaultDataFiles();

    // Nếu vẫn trống thì dùng mẫu dự phòng
    if (Object.keys(decks).length === 0) {
        decks = JSON.parse(JSON.stringify(SAMPLE_DECKS));
    }

    populateSourceDeckDropdown();
    renderDecksList();
    updateRangeDropdown();
    applyStudySettings();
}

async function fetchDefaultDataFiles() {
    const cache = (await KV.get('repoCache')) || {};
    const next = {};
    const useCache = (filePath, fileName) => {
        const c = cache[filePath];
        if (c && Array.isArray(c.words) && !hiddenDecks.has(fileName)) {
            decks[fileName] = c.words;
            repoDeckNames.add(fileName);
            next[filePath] = c;
        }
    };
    for (const filePath of await getDataFileList()) {
        const fileName = filePath.split('/').pop().replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        let response;
        try {
            response = await fetch(filePath);
        } catch (err) {            // mất mạng: dùng bản đã lưu
            useCache(filePath, fileName);
            continue;
        }
        if (!response.ok) continue; // file không tồn tại (đã xóa khỏi repo)
        try {
            if (filePath.endsWith('.json')) {
                const jsonData = await response.json();
                const add = (name, items) => {
                    if (hiddenDecks.has(name) || !Array.isArray(items)) return;
                    const list = parseWordList(items);
                    if (list.length && list.every(w => /^auto_\d+_/.test(String(w.id)))) assignStableIds(name, list);
                    decks[name] = list;
                    repoDeckNames.add(name);
                };
                if (Array.isArray(jsonData)) add(fileName, jsonData);
                else if (jsonData && typeof jsonData === 'object') Object.keys(jsonData).forEach(n => add(n, jsonData[n]));
            } else if (/\.xlsx?$/.test(filePath)) {
                if (hiddenDecks.has(fileName)) continue;
                const buffer = await response.arrayBuffer();
                const sig = buffer.byteLength + ':' + (response.headers.get('etag') || response.headers.get('last-modified') || '');
                const c = cache[filePath];
                let words;
                if (c && c.sig === sig && Array.isArray(c.words)) {
                    words = c.words;           // file không đổi: dùng bản đã đọc, không cần tải thư viện Excel
                } else {
                    await ensureXLSX();
                    words = parseExcelBuffer(buffer);
                    assignStableIds(fileName, words);
                }
                if (words.length) {
                    decks[fileName] = words;
                    repoDeckNames.add(fileName);
                    next[filePath] = { sig, words };
                }
            }
        } catch (err) {
            console.log(`Không thể đọc file: ${filePath}`, err);
            useCache(filePath, fileName);
        }
    }
    await KV.set('repoCache', next);
    saveData();
}

function parseWordList(items) {
    return items.map((item, idx) => ({
        id: item.id || `auto_${Date.now()}_${idx}`,
        Word: item.Word || '',
        Phonetic: item.Phonetic || '',
        Meaning: item.Meaning || '',
        Example: item.Example || '',
        POS: item.POS || 'word'
    }));
}

function parseExcelBuffer(arrayBuffer) {
    const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (!rows || rows.length === 0) return [];

    let headerIdx = -1;
    let colMap = {};
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] || [];
        for (let j = 0; j < row.length; j++) {
            const val = String(row[j] || '').trim().toLowerCase();
            if (val === 'word' || val === 'từ vựng' || val === 'tu vung') colMap.word = j;
            if (val === 'phonetic' || val === 'phiên âm' || val === 'phien am') colMap.phonetic = j;
            if (val === 'meaning' || val === 'nghĩa' || val === 'nghia') colMap.meaning = j;
            if (val === 'example' || val === 'ví dụ' || val === 'vi du') colMap.example = j;
        }
        if (colMap.word !== undefined && colMap.meaning !== undefined) { headerIdx = i; break; }
    }
    if (headerIdx === -1) { colMap = { word: 1, phonetic: 2, meaning: 3, example: 4 }; headerIdx = 1; }

    const parsedWords = [];
    for (let r = headerIdx + 1; r < rows.length && parsedWords.length < 20000; r++) {
        const row = rows[r] || [];
        const wordVal = clip(row[colMap.word], 200);
        const meaningVal = clip(row[colMap.meaning], 400);
        if (wordVal && meaningVal) {
            parsedWords.push({
                id: `file_${Date.now()}_${r}`,
                Word: wordVal,
                Phonetic: colMap.phonetic !== undefined ? clip(row[colMap.phonetic], 100) : '',
                Meaning: meaningVal,
                Example: colMap.example !== undefined ? clip(row[colMap.example], 500) : '',
                POS: 'word'
            });
        }
    }
    return parsedWords;
}

function saveData() {
    persistDecks();
    localStorage.setItem('flash_mastered', JSON.stringify(Array.from(masteredIds)));
    localStorage.setItem('flash_review', JSON.stringify(Array.from(reviewIds)));
    localStorage.setItem('flash_daily_limit', dailyWordLimit);
    renderDecksList();
    updateDashboard();
    renderToday();
}

function renderDecksList() {
    const grid = document.getElementById('decks-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const deckNames = Object.keys(decks);

    if (deckNames.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                <i class="fa-solid fa-folder-open text-4xl text-slate-300 dark:text-slate-600 mb-3"></i>
                <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">Chưa có bộ bài học nào</p>
                <p class="text-xs text-slate-400 mt-1">Hãy tải lên file Excel/CSV để bắt đầu. <button onclick="openExcelGuide()" class="text-indigo-600 dark:text-indigo-400 underline">Xem hướng dẫn định dạng</button></p>
            </div>`;
        return;
    }

    deckNames.forEach(dName => {
        const words = decks[dName] || [];
        let masteredCount = 0;
        words.forEach(w => {
            const key = w.id || w.Word;
            if (masteredIds.has(key)) masteredCount++;
        });

        const pct = words.length > 0 ? Math.round((masteredCount / words.length) * 100) : 0;

        const card = document.createElement('div');
        card.className = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between";
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-3">
                    <h3 class="font-bold text-slate-900 dark:text-white text-base line-clamp-1">${esc(dName)}</h3>
                    <button data-act="del" class="text-slate-400 hover:text-rose-500 transition text-xs p-1" title="Xóa bộ bài">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-4"><i class="fa-solid fa-book-bookmark mr-1 text-indigo-500"></i> ${words.length} từ vựng</p>
                
                <div class="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-1">
                    <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${pct}%"></div>
                </div>
                <div class="flex justify-between text-[11px] font-medium text-slate-400 mb-4">
                    <span>Đã thuộc: ${masteredCount}/${words.length}</span>
                    <span>${pct}%</span>
                </div>
            </div>

            <button data-act="study" class="w-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs font-bold py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 transition flex items-center justify-center">
                <i class="fa-solid fa-play mr-1.5"></i> Học ngay
            </button>
        `;
        card.querySelector('[data-act="del"]').addEventListener('click', () => deleteDeck(dName));
        card.querySelector('[data-act="study"]').addEventListener('click', () => selectDeck(dName));
        grid.appendChild(card);
    });
}

function deleteDeck(dName) {
    const isRepo = repoDeckNames.has(dName);
    const msg = isRepo
        ? `Bộ bài "${dName}" là bộ mặc định của website. Bạn muốn ẩn nó khỏi thiết bị này? (Có thể hiện lại trong Cài đặt)`
        : `Bạn có chắc muốn xóa bộ bài "${dName}" không?`;
    if (!confirm(msg)) return;
    if (isRepo) {
        hiddenDecks.add(dName);
        localStorage.setItem('flash_hidden', JSON.stringify([...hiddenDecks]));
        repoDeckNames.delete(dName);
    }
    delete decks[dName];
    if (selectedSourceDeck === dName) selectedSourceDeck = 'ALL';
    saveData();
    populateSourceDeckDropdown();
    updateRangeDropdown();
    applyStudySettings();
}

async function clearStudyData() {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ tiến độ học tập và danh sách bộ bài?\nHãy bấm Hủy và dùng nút Sao lưu trước nếu bạn muốn giữ lại bản dự phòng.")) return;
    localStorage.clear();
    sessionStorage.clear();
    await KV.set('userDecks', {});
    await KV.set('repoCache', {});
    location.reload();
}

function populateSourceDeckDropdown() {
    const select = document.getElementById('global-deck-select');
    if (!select) return;
    select.innerHTML = `<option value="ALL">💥 Tất cả các bộ bài (Trộn lẫn)</option>`;
    
    Object.keys(decks).forEach(dName => {
        const opt = document.createElement('option');
        opt.value = dName;
        opt.textContent = `📚 ${dName} (${decks[dName].length} từ)`;
        select.appendChild(opt);
    });

    select.value = selectedSourceDeck;
}

function onSourceDeckChange() {
    selectedSourceDeck = document.getElementById('global-deck-select').value;
    updateRangeDropdown();
    applyStudySettings();
}

function onDailyLimitChange() {
    const val = parseInt(document.getElementById('daily-limit-input').value, 10);
    if (val && val > 0) {
        dailyWordLimit = val;
        saveData();
        updateRangeDropdown();
        applyStudySettings();
    }
}

function updateRangeDropdown() {
    if (selectedSourceDeck === 'ALL') {
        rawSourceWords = Object.values(decks).flat();
    } else {
        rawSourceWords = decks[selectedSourceDeck] || [];
    }

    const total = rawSourceWords.length;
    const totalDays = Math.ceil(total / dailyWordLimit) || 1;
    const rangeSelect = document.getElementById('range-mode-select');
    if (!rangeSelect) return;
    
    rangeSelect.innerHTML = '';

    const optToday = document.createElement('option');
    optToday.value = 'today';
    optToday.textContent = '🎯 Học hôm nay (từ đến hạn + từ mới)';
    rangeSelect.appendChild(optToday);

    for (let d = 1; d <= totalDays; d++) {
        const start = (d - 1) * dailyWordLimit + 1;
        const end = Math.min(d * dailyWordLimit, total);
        const opt = document.createElement('option');
        opt.value = `day_${d}`;
        opt.textContent = `Ngày ${d} (Từ ${start} - ${end})`;
        rangeSelect.appendChild(opt);
    }

    if (totalDays > 1) {
        const optCum = document.createElement('option');
        optCum.value = `cum_today`;
        optCum.textContent = `Ôn tập tích lũy (Từ Ngày 1 đến Ngày hiện tại)`;
        rangeSelect.appendChild(optCum);
    }

    const optAll = document.createElement('option');
    optAll.value = `all_range`;
    optAll.textContent = `Toàn bộ ${total} từ`;
    rangeSelect.appendChild(optAll);

    const optSrs = document.createElement('option');
    optSrs.value = 'srs_due';
    optSrs.textContent = `🔁 Đến hạn ôn hôm nay - SRS (${dueWords().length} từ)`;
    rangeSelect.appendChild(optSrs);

    const optRev = document.createElement('option');
    optRev.value = 'review_all';
    optRev.textContent = `⚠ Từ hay quên - tất cả bài (${reviewWordsAll().length} từ)`;
    rangeSelect.appendChild(optRev);

    const optCustom = document.createElement('option');
    optCustom.value = `custom`;
    optCustom.textContent = `Tự chọn khoảng...`;
    rangeSelect.appendChild(optCustom);

    rangeSelect.value = `day_1`;
    onRangeModeChange();
}

function onRangeModeChange() {
    const val = document.getElementById('range-mode-select').value;
    const customBox = document.getElementById('custom-range-box');

    if (val === 'custom') {
        customBox.classList.remove('hidden');
    } else {
        customBox.classList.add('hidden');
    }

    applyStudySettings();
}

function applyStudySettings() {
    const total = rawSourceWords.length;
    const rangeVal = document.getElementById('range-mode-select').value;
    const orderVal = document.getElementById('order-mode-select').value;

    let slicedWords = [];

    if (rangeVal.startsWith('day_')) {
        const dayNum = parseInt(rangeVal.split('_')[1], 10);
        selectedDay = dayNum;
        const startIdx = (dayNum - 1) * dailyWordLimit;
        const endIdx = Math.min(dayNum * dailyWordLimit, total);
        slicedWords = rawSourceWords.slice(startIdx, endIdx);
    } else if (rangeVal === 'cum_today') {
        const endIdx = Math.min(selectedDay * dailyWordLimit, total);
        slicedWords = rawSourceWords.slice(0, endIdx);
    } else if (rangeVal === 'today') {
        slicedWords = todayWords();
    } else if (rangeVal === 'srs_due') {
        slicedWords = dueWords();
    } else if (rangeVal === 'review_all') {
        slicedWords = reviewWordsAll();
    } else if (rangeVal === 'custom') {
        const startPos = Math.max(1, parseInt(document.getElementById('custom-start-input').value, 10) || 1);
        const endPos = Math.min(total, parseInt(document.getElementById('custom-end-input').value, 10) || total);
        slicedWords = rawSourceWords.slice(startPos - 1, endPos);
    } else {
        slicedWords = [...rawSourceWords];
    }

    if (orderVal === 'shuffle') {
        activeWords = [...slicedWords].sort(() => Math.random() - 0.5);
    } else {
        activeWords = [...slicedWords];
    }

    applyFilter();

    quizQueue = null;
    spellQueue = null;
    if (activeMode === 'quiz') generateQuizQuestion();
    if (activeMode === 'spelling') generateSpellingQuestion();
}

function applyFilter() {
    const filterVal = document.getElementById('filter-select').value;
    if (filterVal === 'mastered') filteredWords = activeWords.filter(w => masteredIds.has(wkey(w)));
    else if (filterVal === 'review') filteredWords = activeWords.filter(w => reviewIds.has(wkey(w)));
    else filteredWords = [...activeWords];

    // Bắt đầu một phiên học thẻ mới
    currentIndex = 0;
    isFlipped = false;
    cardTotal = filteredWords.length;
    cardRated = new Set();
    cardReviewMap = new Map();
    undoStack = [];
    updateUndoBtn();
    document.getElementById('cards-body').classList.remove('hidden');
    document.getElementById('cards-done').classList.add('hidden');
    renderCard();
}

function selectDeck(deckName) {
    selectedSourceDeck = deckName;
    const select = document.getElementById('global-deck-select');
    if (select) select.value = deckName;
    onSourceDeckChange();
    switchMode('flashcard');
}

function switchMode(mode) {
    activeMode = mode;
    
    ['decks', 'flashcard', 'quiz', 'spelling', 'dashboard'].forEach(m => {
        const el = document.getElementById(`sec-${m}`);
        if (el) el.classList.add('hidden');
    });
    const targetSec = document.getElementById(`sec-${mode}`);
    if (targetSec) targetSec.classList.remove('hidden');

    const controlPanel = document.getElementById('learning-control-panel');
    if (mode === 'decks' || mode === 'dashboard') {
        controlPanel.classList.add('hidden');
    } else {
        controlPanel.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.className = "nav-tab px-3.5 py-1.5 rounded-lg text-sm font-medium transition text-slate-600 dark:text-slate-300 hover:text-indigo-600";
    });
    const activeTab = document.getElementById(`nav-${mode}`);
    if (activeTab) {
        activeTab.className = "nav-tab px-3.5 py-1.5 rounded-lg text-sm font-medium transition text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 shadow-sm";
    }

    if (mode === 'quiz') generateQuizQuestion();
    if (mode === 'spelling') { spellStreak = 0; generateSpellingQuestion(); }
    if (mode === 'dashboard') updateDashboard();
    if (mode === 'decks') renderToday();
    if (mode === 'flashcard') { renderCard(); autoSpeakCurrent(); }
}

// -------------------------------------------------------------
// FLASHCARD DISPLAY & CONTROLS
// -------------------------------------------------------------
function renderCard() {
    updateCardBar();
    const cardInner = document.getElementById('card-inner');
    if (isFlipped) {
        cardInner.classList.remove('rotate-y-180');
        isFlipped = false;
    }

    let masteredCount = 0;
    let reviewCount = 0;

    activeWords.forEach(w => {
        const key = w.id || w.Word;
        if (masteredIds.has(key)) masteredCount++;
        if (reviewIds.has(key)) reviewCount++;
    });

    document.getElementById('count-mastered').textContent = masteredCount;
    document.getElementById('count-review').textContent = reviewCount;

    if (filteredWords.length === 0) {
        document.getElementById('card-counter').textContent = "Còn lại: 0";
        document.getElementById('card-word').textContent = "Không có từ";
        document.getElementById('card-phonetic').textContent = "";
        document.getElementById('card-meaning').textContent = "Hãy chọn phạm vi học khác hoặc bỏ bộ lọc";
        document.getElementById('card-example').textContent = "";
        return;
    }

    if (currentIndex >= filteredWords.length) currentIndex = 0;
    if (currentIndex < 0) currentIndex = filteredWords.length - 1;

    const current = filteredWords[currentIndex];
    const wordKey = current.id || current.Word;

    document.getElementById('card-counter').textContent = `Còn lại: ${filteredWords.length}`;
    document.getElementById('card-word').textContent = current.Word || '';
    document.getElementById('card-phonetic').textContent = current.Phonetic || '';
    document.getElementById('card-pos-front').textContent = current.POS || 'word';
    document.getElementById('card-pos-back').textContent = current.POS || 'word';
    document.getElementById('card-meaning').textContent = current.Meaning || '';
    document.getElementById('card-example').textContent = current.Example ? `"${current.Example}"` : '';
    applyCardDirection(current);

    const starBtn = document.getElementById('btn-star-front');
    if (reviewIds.has(wordKey)) {
        starBtn.innerHTML = `<i class="fa-solid fa-star text-amber-500 text-lg"></i>`;
    } else {
        starBtn.innerHTML = `<i class="fa-regular fa-star text-lg"></i>`;
    }
}

function flipCard() {
    if (filteredWords.length === 0) return;
    isFlipped = !isFlipped;
    const inner = document.getElementById('card-inner');
    if (isFlipped) {
        inner.classList.add('rotate-y-180');
        if (S.dir === 'vi2en') autoSpeak(filteredWords[currentIndex].Word); // chế độ Việt→Anh: đọc từ khi lật
    } else {
        inner.classList.remove('rotate-y-180');
    }
}

function nextCard() {
    if (filteredWords.length === 0) return;
    currentIndex = (currentIndex + 1) % filteredWords.length;
    renderCard();
    autoSpeakCurrent();
}

function prevCard() {
    if (filteredWords.length === 0) return;
    currentIndex = (currentIndex - 1 + filteredWords.length) % filteredWords.length;
    renderCard();
    autoSpeakCurrent();
}

function shuffleWords() {
    filteredWords.sort(() => Math.random() - 0.5); // chỉ xáo các thẻ còn lại, giữ tiến độ phiên
    currentIndex = 0;
    renderCard();
    autoSpeakCurrent();
}

function toggleStarCurrent(e) {
    e.stopPropagation();
    if (filteredWords.length === 0) return;
    const current = filteredWords[currentIndex];
    const wordKey = current.id || current.Word;

    if (reviewIds.has(wordKey)) {
        reviewIds.delete(wordKey);
    } else {
        reviewIds.add(wordKey);
        masteredIds.delete(wordKey);
    }
    saveData();
    renderCard();
}

function markStatus(status) {
    // status: 'review' (Quên/Ôn lại) | 'hard' (Khó) | 'mastered' (Tốt) | 'easy' (Dễ)
    if (filteredWords.length === 0) return;
    const current = filteredWords[currentIndex];
    const k = wkey(current);
    const first = !cardRated.has(k); // chỉ lần chấm đầu tiên trong phiên được tính SRS/XP
    pushUndo(k);

    if (status !== 'review') {
        const wasReview = reviewIds.has(k);
        masteredIds.add(k);
        reviewIds.delete(k);
        playSoundEffect('correct');
        haptic(15);
        if (first) {
            srsRate(current, true, status === 'easy' ? 2 : (status === 'hard' ? 0 : 1));
            addXP(5);
        }
        if (wasReview) { userStats.hardCleared = U('hardCleared') + 1; saveStats(); }
        logEvent('card', true);
        fx({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
        filteredWords.splice(currentIndex, 1); // đã thuộc: rời khỏi phiên
    } else {
        reviewIds.add(k);
        masteredIds.delete(k);
        playSoundEffect('tick');
        haptic(30);
        if (first) srsRate(current, false);
        logEvent('card', false);
        const rec = cardReviewMap.get(k);
        cardReviewMap.set(k, { w: current, n: (rec ? rec.n : 0) + 1 });
        filteredWords.splice(currentIndex, 1);
        if (currentIndex >= filteredWords.length) currentIndex = 0;
        // ôn lại: quay lại sau vài thẻ nữa
        filteredWords.splice(Math.min(currentIndex + reviewGap(), filteredWords.length), 0, current);
    }
    cardRated.add(k);
    saveData();
    persistSession();

    if (filteredWords.length === 0) { finishCards(); return; }
    if (currentIndex >= filteredWords.length) currentIndex = 0;
    renderCard();
    autoSpeakCurrent();
}

function speakWord(e) {
    if (e) e.stopPropagation();
    if (filteredWords.length === 0) return;
    const current = filteredWords[currentIndex];
    say(current.Word);
}

// -------------------------------------------------------------
// QUIZ & SPELLING MODE UPDATE
// -------------------------------------------------------------
function generateQuizQuestion() {
    if (!quizQueue) { startQuizSession(); return; }
    if (quizQueue.length === 0 && quizTotal > 0) { finishQuiz(); return; }
    const wordPool = activeWords.length > 0 ? activeWords : rawSourceWords;
    if (wordPool.length < 2) {
        document.getElementById('quiz-target-word').textContent = "Cần ít nhất 2 từ vựng";
        document.getElementById('quiz-options').innerHTML = `<p class="text-xs text-center text-slate-400 py-4">Hãy chọn phạm vi học rộng hơn hoặc đổi bộ bài.</p>`;
        return;
    }

    const target = quizQueue[0];
    updateQuizProgress();
    currentQuizWord = target;
    quizAnswered = false;
    if (S.dir !== 'vi2en') autoSpeak(target.Word);

    document.getElementById('quiz-target-word').textContent = S.dir === 'vi2en' ? target.Meaning : target.Word;
    document.getElementById('quiz-phonetic').textContent = S.dir === 'vi2en' ? '' : (target.Phonetic || '');
    document.getElementById('quiz-pos').textContent = target.POS || 'word';
    document.getElementById('quiz-feedback').textContent = '';

    const field = S.dir === 'vi2en' ? 'Word' : 'Meaning';
    const distractorPool = rawSourceWords.length >= 4 ? rawSourceWords : Object.values(decks).flat();
    const options = buildOptions(target, distractorPool, field);

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    options.forEach(optionText => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-slate-700 font-medium text-sm text-slate-800 dark:text-slate-200 transition";
        btn.textContent = optionText;
        btn.onclick = () => handleQuizAnswer(optionText, target[field], btn);
        optionsContainer.appendChild(btn);
    });
}

function handleQuizAnswer(selected, correct, btn) {
    if (quizAnswered) return;
    quizAnswered = true;
    const feedbackEl = document.getElementById('quiz-feedback');
    if (selected === correct) {
        const qk = wkey(currentQuizWord);
        playSoundEffect('correct');
        if (!quizFailedSet.has(qk)) srsRate(currentQuizWord, true);
        addXP(10);
        quizQueue.shift();
        updateQuizProgress();
        const answeredWord = currentQuizWord;
        if (quizQueue.length === 0) setTimeout(finishQuiz, 1300);
        else setTimeout(() => { if (currentQuizWord === answeredWord) generateQuizQuestion(); }, 1000);
        comboHit(true);
        btn.className = "w-full text-left p-4 rounded-2xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-sm transition";
        feedbackEl.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-circle-check mr-1"></i> Chính xác!</span>`;
        quizScore += 10;
        logEvent('quiz', true);
        haptic(15);
        fx({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    } else {
        btn.className = "w-full text-left p-4 rounded-2xl border border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-sm transition";
        feedbackEl.innerHTML = `<span class="text-rose-600 dark:text-rose-400"><i class="fa-solid fa-circle-xmark mr-1"></i> Sai rồi! Đáp án đúng: ${esc(correct)}</span>`;
        const qk = wkey(currentQuizWord);
        playSoundEffect('wrong');
        comboHit(false);
        if (!quizFailedSet.has(qk)) srsRate(currentQuizWord, false);
        quizFailedSet.add(qk);
        quizErrors++;
        logEvent('quiz', false);
        haptic(30);
        quizQueue.push(quizQueue.shift());
    }
    document.getElementById('quiz-score').textContent = `Điểm: ${quizScore}`;
    if (S.dir === 'vi2en') autoSpeak(currentQuizWord.Word);
    persistSession();
}

function generateSpellingQuestion() {
    if (!spellQueue) { startSpellingSession(); return; }
    if (spellQueue.length === 0 && spellTotal > 0) { finishSpelling(); return; }
    const wordPool = activeWords.length > 0 ? activeWords : rawSourceWords;
    if (wordPool.length === 0) return;

    currentSpellingWord = spellQueue[0];
    updateSpellProgress();
    spellFailed = false;
    spellLocked = false;
    autoSpeak(currentSpellingWord.Word);

    document.getElementById('spelling-meaning').textContent = currentSpellingWord.Meaning;
    spellHintLevel = 0;
    document.getElementById('spelling-hint').textContent = spellHintText();
    document.getElementById('spelling-input').value = '';
    document.getElementById('spelling-feedback').textContent = '';
}

function checkSpelling(e) {
    e.preventDefault();
    if (!currentSpellingWord || spellLocked) return;

    const inputVal = document.getElementById('spelling-input').value.trim().toLowerCase().replace(/[.,!?]+$/, '');
    const targetVal = currentSpellingWord.Word.trim().toLowerCase();
    const feedbackEl = document.getElementById('spelling-feedback');

    if (inputVal === targetVal) {
        feedbackEl.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold"><i class="fa-solid fa-circle-check mr-1"></i> Chuẩn xác!</span>`;
        fx({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
        spellLocked = true;
        playSoundEffect('correct');
        comboHit(true);
        if (!spellFailedSet.has(wkey(currentSpellingWord))) srsRate(currentSpellingWord, true);
        addXP(15);
        spellQueue.shift();
        logEvent('spell', true);
        haptic(15);
        updateSpellProgress();
        setTimeout(generateSpellingQuestion, 1500);
        persistSession();
    } else {
        feedbackEl.innerHTML = spellWrongHTML(inputVal, currentSpellingWord.Word);
        const sk = wkey(currentSpellingWord);
        playSoundEffect('wrong');
        comboHit(false);
        if (!spellFailedSet.has(sk)) srsRate(currentSpellingWord, false);
        spellFailedSet.add(sk);
        spellErrors++;
        logEvent('spell', false);
        haptic(30);
        spellLocked = true;
        spellQueue.push(spellQueue.shift()); // từ sai quay lại cuối hàng
        setTimeout(generateSpellingQuestion, 1800);
        persistSession();
    }
}

function speakSpellingTarget() {
    if (currentSpellingWord) {
        say(currentSpellingWord.Word);
    }
}

// -------------------------------------------------------------
// EXCEL / CSV PARSER WITH ANY-ROW HEADER SEARCH
// -------------------------------------------------------------
function setupExcelReader() {
    const fileInput = document.getElementById('excel-upload');
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                await ensureXLSX();
                const parsedWords = parseExcelBuffer(evt.target.result);
                if (parsedWords.length === 0) {
                    alert("Không tìm thấy từ vựng hợp lệ. File cần có ít nhất 2 cột Word (Từ vựng) và Meaning (Nghĩa) ở Sheet đầu tiên. Bấm Nhập Excel để xem hướng dẫn và tải file mẫu.");
                    return;
                }
                const defaultDeckName = file.name.replace(/\.[^/.]+$/, "");
                const deckName = (prompt("Nhập tên bộ Flashcard:", defaultDeckName) || defaultDeckName).trim().slice(0, 80) || defaultDeckName;
                if (repoDeckNames.has(deckName)) {
                    alert('Tên này trùng với một bộ bài mặc định của website. Hãy nhập lại với tên khác.');
                    return;
                }
                assignStableIds(deckName, parsedWords);
                decks[deckName] = parsedWords;
                selectedSourceDeck = deckName;
                saveData();
                populateSourceDeckDropdown();
                updateRangeDropdown();
                applyStudySettings();
                switchMode('flashcard');
                alert(`Đã tải thành công ${parsedWords.length} từ vựng vào bộ bài "${deckName}"!`);
            } catch (err) {
                console.error(err);
                alert("Đã xảy ra lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file!");
            }
        };
        reader.readAsArrayBuffer(file);
        fileInput.value = '';
    });
}

// -------------------------------------------------------------
// DASHBOARD & STATS
// -------------------------------------------------------------
function updateDashboard() {
    const allWordsArray = Object.values(decks).flat();
    const total = allWordsArray.length;
    const mastered = masteredIds.size;
    const review = reviewIds.size;

    const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    const reviewPct = total > 0 ? Math.round((review / total) * 100) : 0;
    const unlearnedPct = Math.max(0, 100 - masteredPct - reviewPct);

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-mastered').textContent = mastered;
    document.getElementById('stat-review').textContent = review;
    document.getElementById('stat-rate').textContent = `${masteredPct}%`;

    document.getElementById('bar-mastered').style.width = `${masteredPct}%`;
    document.getElementById('bar-review').style.width = `${reviewPct}%`;

    document.getElementById('pct-mastered').textContent = `${masteredPct}%`;
    document.getElementById('pct-review').textContent = `${reviewPct}%`;
    document.getElementById('pct-unlearned').textContent = `${unlearnedPct}%`;

    checkBadges();
    renderBadges();
    renderStatsExtra();
    refreshBackupInfo();
    refreshSpecialRangeLabels();
    updateStatsDisplay();
}

// Timer Logic
function startTimer() {
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds++;
        const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
        const secs = String(timerSeconds % 60).padStart(2, '0');
        document.getElementById('timer-display').textContent = `${mins}:${secs}`;
        if (typeof trackSecond === 'function') trackSecond();
    }, 1000);
}

function toggleTimer() {
    const icon = document.getElementById('timer-icon');
    if (isTimerRunning) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        icon.className = "fa-solid fa-play text-xs";
    } else {
        startTimer();
        icon.className = "fa-solid fa-pause text-xs";
    }
}

// Theme Toggle
function initTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-icon').className = "fa-solid fa-sun text-lg text-amber-400";
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('theme-icon').className = "fa-solid fa-moon text-lg";
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    document.getElementById('theme-icon').className = isDark 
        ? "fa-solid fa-sun text-lg text-amber-400" 
        : "fa-solid fa-moon text-lg";
}
