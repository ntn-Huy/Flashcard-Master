'use strict';
/* =====================================================================
   features.js - Các hệ thống bổ sung cho English Flashcards Master
   (chạy sau js/app.js, dùng chung biến toàn cục với app.js)
   - Tiện ích & bảo mật (esc), cài đặt, âm thanh, rung, hiệu ứng
   - Lưu trữ IndexedDB, sao lưu / khôi phục tiến độ
   - Nhật ký học, cấp độ, nhiệm vụ ngày, đóng băng chuỗi
   - Học hôm nay, tiếp tục phiên dở, hoàn tác, mẹo nhớ, từ ma
   - Thống kê nâng cao, hướng dẫn nhanh, khả năng tiếp cận
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. TIỆN ÍCH & BẢO MẬT
// ---------------------------------------------------------------------
const byId = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function safeJSON(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
const pad2 = n => String(n).padStart(2, '0');
function dayToDate(day) { return new Date(day * DAY_MS + new Date().getTimezoneOffset() * 60000); }
function fmtDM(day) { const d = dayToDate(day); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`; }

// ---------------------------------------------------------------------
// 2. CÀI ĐẶT
// ---------------------------------------------------------------------
const SETTINGS_DEFAULT = { sfx: true, vol: 60, voice: 'en-US', rate: 0.9, dir: 'en2vi', gap: 4, haptic: true, font: 100, reduce: false };
let S = Object.assign({}, SETTINGS_DEFAULT, safeJSON(localStorage.getItem('flash_settings'), {}));
const saveSettings = () => localStorage.setItem('flash_settings', JSON.stringify(S));
const reviewGap = () => Math.max(1, parseInt(S.gap, 10) || 4);

function applySettings() {
    document.documentElement.style.fontSize = (S.font || 100) + '%';
    let sysReduce = false;
    try { sysReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    document.documentElement.classList.toggle('reduce-motion', !!S.reduce || sysReduce);
    document.querySelectorAll('.js-dir-label').forEach(el => { el.textContent = S.dir === 'vi2en' ? 'Việt → Anh' : 'Anh → Việt'; });
}
function fx(opts) {
    if (S.reduce || typeof window.confetti !== 'function') return;
    try { window.confetti(opts); } catch (e) {}
}
function haptic(ms) { if (S.haptic && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

// ---------------------------------------------------------------------
// 3. ÂM THANH, GIỌNG ĐỌC, THÔNG BÁO
// ---------------------------------------------------------------------
function pickVoice(lang) {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices) ? speechSynthesis.getVoices() : [];
    return vs.find(v => v.lang === lang) || vs.find(v => v.lang && v.lang.slice(0, 2) === lang.slice(0, 2)) || null;
}
function say(text) {
    if (!text || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = S.voice;
    u.rate = S.rate;
    const v = pickVoice(S.voice);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
}

let audioCtx = null;
function playSoundEffect(type) {
    if (!S.sfx || S.vol <= 0) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const t = audioCtx.currentTime, k = S.vol / 100;
        const tone = (freq, start, dur, wave, vol, endFreq) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = wave;
            o.frequency.setValueAtTime(freq, t + start);
            if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + start + dur);
            g.gain.setValueAtTime(vol * k, t + start);
            g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t + start); o.stop(t + start + dur);
        };
        if (type === 'correct') { tone(523.25, 0, 0.15, 'sine', 0.3); tone(659.25, 0.12, 0.15, 'sine', 0.3); tone(783.99, 0.24, 0.3, 'sine', 0.3); }
        else if (type === 'wrong') { tone(220, 0, 0.18, 'sawtooth', 0.2, 140); tone(160, 0.16, 0.3, 'sawtooth', 0.2, 90); }
        else { tone(440, 0, 0.08, 'triangle', 0.18); }
    } catch (e) {}
}

function toast(msg) {
    let t = byId('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.setAttribute('role', 'status');
        t.setAttribute('aria-live', 'polite');
        t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] text-center bg-slate-900 dark:bg-slate-700 text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-xl transition-opacity pointer-events-none';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = 1;
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.opacity = 0; }, 2800);
}
let _tq = 0;
function toastLater(msg) {
    setTimeout(() => { toast(msg); _tq = Math.max(0, _tq - 1); }, _tq++ * 2900);
}

// ---------------------------------------------------------------------
// 4. LƯU TRỮ: IndexedDB (có dự phòng localStorage)
// ---------------------------------------------------------------------
const KV = (() => {
    let dbp = null;
    const hasIDB = () => typeof indexedDB !== 'undefined' && indexedDB;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
        try {
            const r = indexedDB.open('flashcard-db', 1);
            r.onupgradeneeded = () => r.result.createObjectStore('kv');
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        } catch (e) { rej(e); }
    }));
    const ls = k => 'kv_' + k;
    return {
        async get(k) {
            if (hasIDB()) {
                try {
                    const db = await open();
                    return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
                } catch (e) { /* dùng dự phòng */ }
            }
            return safeJSON(localStorage.getItem(ls(k)), undefined);
        },
        async set(k, v) {
            if (hasIDB()) {
                try {
                    const db = await open();
                    return await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
                } catch (e) { /* dùng dự phòng */ }
            }
            try { localStorage.setItem(ls(k), JSON.stringify(v)); } catch (e) { toast('⚠ Bộ nhớ trình duyệt đã đầy, hãy sao lưu và xóa bớt bộ bài'); }
        }
    };
})();

const repoDeckNames = new Set();           // bộ bài lấy từ thư mục data/ (không lưu vào bộ nhớ người dùng)
let hiddenDecks = new Set(safeJSON(localStorage.getItem('flash_hidden'), []));
const userDecksOnly = () => {
    const o = {};
    Object.keys(decks).forEach(n => { if (!repoDeckNames.has(n)) o[n] = decks[n]; });
    return o;
};
let _persistT;
function persistDecks() {
    clearTimeout(_persistT);
    _persistT = setTimeout(() => KV.set('userDecks', userDecksOnly()), 250);
}
async function loadUserDecks() {
    let ud = await KV.get('userDecks');
    const legacy = localStorage.getItem('flash_decks'); // dữ liệu phiên bản cũ
    if (legacy) {
        ud = Object.assign({}, safeJSON(legacy, {}), ud || {});
        await KV.set('userDecks', ud);
        localStorage.removeItem('flash_decks');
        localStorage.removeItem('flash_sigs');
    }
    return ud || {};
}

let _xlsxP = null;
function ensureXLSX() {
    if (window.XLSX) return Promise.resolve();
    if (_xlsxP) return _xlsxP;
    _xlsxP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = './vendor/xlsx.full.min.js?v=5';
        s.onload = () => res();
        s.onerror = () => { _xlsxP = null; rej(new Error('Không tải được thư viện đọc Excel')); };
        document.head.appendChild(s);
    });
    return _xlsxP;
}

// ---------------------------------------------------------------------
// 5. SAO LƯU / KHÔI PHỤC TIẾN ĐỘ
// ---------------------------------------------------------------------
function collectBackup() {
    return {
        app: 'english-flashcards', version: 5, savedAt: new Date().toISOString(),
        userDecks: userDecksOnly(), hiddenDecks: [...hiddenDecks],
        mastered: [...masteredIds], review: [...reviewIds], srs, stats: userStats,
        log: actLog, notes, settings: S, dailyLimit: dailyWordLimit, autoPlay
    };
}
function downloadBackup() {
    const d = new Date();
    const name = `flashcard-backup-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.json`;
    const blob = new Blob([JSON.stringify(collectBackup())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    localStorage.setItem('flash_last_backup', String(Date.now()));
    refreshBackupInfo();
    toast('💾 Đã tạo file sao lưu: ' + name);
}
function pickBackupFile() { byId('backup-input').click(); }
async function restoreBackup(file) {
    if (!file) return;
    let b;
    try { b = JSON.parse(await file.text()); } catch (e) { alert('File không đọc được. Hãy chọn đúng file sao lưu (.json) do web tạo ra.'); return; }
    if (!b || b.app !== 'english-flashcards' || !Array.isArray(b.mastered)) { alert('Đây không phải file sao lưu hợp lệ của ứng dụng này.'); return; }
    if (!confirm(`Khôi phục dữ liệu từ bản sao lưu ngày ${(b.savedAt || '').slice(0, 10)}?\nDữ liệu hiện tại trên thiết bị này sẽ bị thay thế.`)) return;
    await KV.set('userDecks', b.userDecks || {});
    const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    set('flash_mastered', b.mastered || []); set('flash_review', b.review || []);
    set('flash_srs', b.srs || {}); set('flash_user_stats', b.stats || {});
    set('flash_log', b.log || {}); set('flash_notes', b.notes || {});
    set('flash_settings', b.settings || {}); set('flash_hidden', b.hiddenDecks || []);
    if (b.dailyLimit) set('flash_daily_limit', String(b.dailyLimit));
    set('flash_autoplay', b.autoPlay === false ? '0' : '1');
    localStorage.removeItem(SESSION_KEY);
    localStorage.setItem('flash_last_backup', String(Date.now()));
    alert('Đã khôi phục xong. Trang sẽ tải lại.');
    location.reload();
}
function refreshBackupInfo() {
    const el = byId('backup-info');
    if (!el) return;
    const t = parseInt(localStorage.getItem('flash_last_backup') || '0', 10);
    el.textContent = t ? `Sao lưu gần nhất: ${new Date(t).toLocaleDateString('vi-VN')}` : 'Bạn chưa sao lưu lần nào.';
}
function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
}
function backupReminder() {
    const hasProgress = masteredIds.size >= 10 || userStats.xp >= 100;
    const last = parseInt(localStorage.getItem('flash_last_backup') || '0', 10);
    if (hasProgress && Date.now() - last > 14 * DAY_MS && !sessionStorage.getItem('flash_backup_nag')) {
        sessionStorage.setItem('flash_backup_nag', '1');
        setTimeout(() => toast('💾 Đã lâu bạn chưa sao lưu tiến độ. Vào Thống kê → Sao lưu để tránh mất dữ liệu.'), 2500);
    }
}

// ---------------------------------------------------------------------
// 6. NHẬT KÝ HỌC, CẤP ĐỘ, NHIỆM VỤ, ĐÓNG BĂNG CHUỖI
// ---------------------------------------------------------------------
let actLog = safeJSON(localStorage.getItem('flash_log'), {});
const saveLog = () => { try { localStorage.setItem('flash_log', JSON.stringify(actLog)); } catch (e) {} };
function todayLog() {
    const t = todayNum();
    if (!actLog[t]) actLog[t] = { w: 0, xp: 0, sec: 0, cm: 0, qc: 0, sc: 0, po: 0, dr: 0, ok: { card: 0, quiz: 0, spell: 0 }, bad: { card: 0, quiz: 0, spell: 0 }, qd: [] };
    return actLog[t];
}
function pruneLog() {
    const min = todayNum() - 400;
    Object.keys(actLog).forEach(d => { if (parseInt(d, 10) < min) delete actLog[d]; });
}
function logEvent(mode, ok) {
    const l = todayLog();
    (ok ? l.ok : l.bad)[mode]++;
    if (ok) { l.w++; if (mode === 'card') l.cm++; else if (mode === 'quiz') l.qc++; else if (mode === 'spell') l.sc++; }
    saveLog();
    checkQuests();
}
function trackSecond() {
    if (document.visibilityState === 'hidden') return;
    const l = todayLog();
    l.sec++;
    if (l.sec % 15 === 0) saveLog();
}

const LEVEL_NAMES = ['Tập sự', 'Học viên', 'Chăm học', 'Khá giỏi', 'Thành thạo', 'Tinh anh', 'Cao thủ', 'Bậc thầy', 'Đại sư', 'Huyền thoại'];
const levelOf = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1;
const levelName = lv => LEVEL_NAMES[Math.min(lv, LEVEL_NAMES.length) - 1];
const levelStart = lv => 60 * (lv - 1) * (lv - 1);

function addXP(n) {
    const lv0 = levelOf(userStats.xp);
    userStats.xp += n;
    const hr = new Date().getHours();
    if (hr >= 22 || hr < 4) userStats.owl = 1;
    if (hr >= 4 && hr < 6) userStats.early = 1;
    todayLog().xp += n;
    saveLog();
    touchStreak();
    saveStats();
    updateStatsDisplay();
    const lv1 = levelOf(userStats.xp);
    if (lv1 > lv0) toastLater(`🎉 Lên cấp ${lv1}: ${levelName(lv1)}!`);
}

// Chấm SRS: ok=false -> học lại hôm nay; ok=true: step 0 = Khó (+1 ngày), 1 = Tốt, 2 = Dễ
function srsRate(w, ok, step = 1) {
    if (!w) return;
    const k = wkey(w), t = todayNum();
    const wasDue = !!srs[k] && srs[k].due <= t;
    const st = srs[k] || { box: 0, due: t, reps: 0, lapses: 0 };
    st.reps++;
    if (ok) {
        if (step === 0) { st.box = Math.max(1, st.box); st.due = t + 1; }
        else { st.box = Math.min(st.box + step, 7); st.due = t + INTERVALS[st.box]; }
    } else {
        st.box = 0; st.due = t; st.lapses = (st.lapses || 0) + 1;
    }
    srs[k] = st;
    if (wasDue) { const l = todayLog(); l.dr = (l.dr || 0) + 1; saveLog(); }
    saveSrs();
    touchStreak();
}

function normalizeStreak() {
    if (userStats.freeze === undefined) userStats.freeze = 1;
    const gap = todayNum() - (userStats.lastDate || 0);
    if (!userStats.lastDate || gap > 2 || (gap === 2 && !(userStats.freeze > 0))) userStats.streak = 0;
}
function touchStreak() {
    const t = todayNum();
    if (userStats.lastDate === t) return;
    const gap = userStats.lastDate ? t - userStats.lastDate : 99;
    if (gap === 1) userStats.streak++;
    else if (gap === 2 && U('freeze') > 0 && userStats.streak > 0) {
        userStats.streak++;
        userStats.freeze--;
        toastLater('🧊 Đã dùng 1 đóng băng để giữ chuỗi ngày học của bạn!');
    } else userStats.streak = 1;
    userStats.lastDate = t;
    userStats.bestStreak = Math.max(U('bestStreak'), userStats.streak);
    if (userStats.streak % 7 === 0) { userStats.freeze = Math.min(2, U('freeze') + 1); toastLater('🧊 Bạn nhận thêm 1 đóng băng chuỗi (mỗi 7 ngày liên tiếp)'); }
    saveStats();
    updateStatsDisplay();
    checkBadges();
}
function streakReminder() {
    if (userStats.lastDate === todayNum() - 1 && userStats.streak > 0) {
        setTimeout(() => toast(`🔥 Chuỗi ${userStats.streak} ngày sắp đứt! Học một chút hôm nay để giữ chuỗi.`), 3500);
    }
}

const QUEST_POOL = [
    { id: 'cm', icon: 'fa-layer-group', text: n => `Thuộc ${n} từ bằng flashcard`, opts: [10, 15, 20], val: l => l.cm || 0 },
    { id: 'qc', icon: 'fa-list-check', text: n => `Trả lời đúng ${n} câu trắc nghiệm`, opts: [10, 15, 20], val: l => l.qc || 0 },
    { id: 'sc', icon: 'fa-keyboard', text: n => `Viết đúng ${n} từ chính tả`, opts: [5, 8, 10], val: l => l.sc || 0 },
    { id: 'po', icon: 'fa-microphone', text: n => `Phát âm đạt ${n} lần`, opts: [3, 5, 8], val: l => l.po || 0 },
    { id: 'min', icon: 'fa-stopwatch', text: n => `Học đủ ${n} phút`, opts: [5, 10, 15], val: l => Math.floor((l.sec || 0) / 60) },
    { id: 'dr', icon: 'fa-rotate', text: n => `Ôn ${n} từ đến hạn (SRS)`, opts: [5, 10, 15], val: l => l.dr || 0 }
];
function todayQuests() {
    let seed = (todayNum() * 9301 + 49297) % 233280;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const pool = [...QUEST_POOL], out = [];
    while (out.length < 3) {
        const q = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        out.push({ q, target: q.opts[Math.floor(rnd() * q.opts.length)] });
    }
    return out;
}
function checkQuests() {
    const l = todayLog();
    let changed = false;
    todayQuests().forEach(({ q, target }) => {
        if (!l.qd.includes(q.id) && q.val(l) >= target) {
            l.qd.push(q.id);
            changed = true;
            addXP(30);
            toastLater(`✅ Nhiệm vụ hoàn thành: ${q.text(target)} (+30 XP)`);
        }
    });
    if (changed) {
        if (l.qd.length >= 3 && !l.qb) { l.qb = 1; addXP(40); toastLater('🎁 Hoàn thành cả 3 nhiệm vụ hôm nay (+40 XP)'); }
        saveLog();
        renderToday();
    }
}
function questsHTML() {
    const l = todayLog();
    return todayQuests().map(({ q, target }) => {
        const v = Math.min(q.val(l), target), done = l.qd.includes(q.id), pct = Math.round(v / target * 100);
        return `<div class="flex items-center gap-3 py-1.5">
            <span class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs ${done ? 'bg-emerald-500 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300'}"><i class="fa-solid ${done ? 'fa-check' : q.icon}"></i></span>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold ${done ? 'text-emerald-600 dark:text-emerald-400 line-through' : 'text-slate-700 dark:text-slate-200'}">${esc(q.text(target))}</p>
                <div class="mt-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden"><div class="${done ? 'bg-emerald-500' : 'bg-indigo-500'} h-full rounded-full" style="width:${pct}%"></div></div>
            </div>
            <span class="text-[11px] font-semibold text-slate-400 shrink-0">${v}/${target}</span>
        </div>`;
    }).join('');
}

// ---------------------------------------------------------------------
// 7. HỌC HÔM NAY & TIẾP TỤC PHIÊN DỞ
// ---------------------------------------------------------------------
const newWordsForToday = () => rawSourceWords.filter(w => !srs[wkey(w)] && !masteredIds.has(wkey(w))).slice(0, dailyWordLimit);
const todayWords = () => [...dueWords().slice(0, 100), ...newWordsForToday()];

function startToday() {
    if (!todayWords().length) { toast('🎉 Hôm nay không còn từ nào cần học!'); return; }
    const rs = byId('range-mode-select');
    if (![...rs.options].some(o => o.value === 'today')) updateRangeDropdown();
    rs.value = 'today';
    byId('filter-select').value = 'all';
    onRangeModeChange();
    switchMode('flashcard');
}

const SESSION_KEY = 'flash_session';
const curVal = id => { const el = byId(id); return el ? el.value : ''; };
const curSig = () => [selectedSourceDeck, curVal('range-mode-select'), curVal('order-mode-select'), curVal('filter-select'), dailyWordLimit].join('|');
let _sessT;
function persistSession() { clearTimeout(_sessT); _sessT = setTimeout(saveSessionNow, 300); }
function saveSessionNow() {
    const s = {
        sig: curSig(), t: Date.now(), mode: activeMode,
        ui: { deck: selectedSourceDeck, range: curVal('range-mode-select'), order: curVal('order-mode-select'), filter: curVal('filter-select'), cs: curVal('custom-start-input'), ce: curVal('custom-end-input') }
    };
    let any = false;
    if (cardTotal > 0 && filteredWords.length > 0 && cardRated.size > 0) {
        s.card = { q: filteredWords.map(wkey), i: currentIndex, total: cardTotal, rated: [...cardRated], rmap: [...cardReviewMap].map(([k, v]) => [k, v.n]) };
        any = true;
    }
    if (quizQueue && quizQueue.length > 0 && quizQueue.length < quizTotal) {
        s.quiz = { q: quizQueue.map(wkey), total: quizTotal, errors: quizErrors, failed: [...quizFailedSet], score: quizScore };
        any = true;
    }
    if (spellQueue && spellQueue.length > 0 && spellQueue.length < spellTotal) {
        s.spell = { q: spellQueue.map(wkey), total: spellTotal, errors: spellErrors, failed: [...spellFailedSet] };
        any = true;
    }
    if (any) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} }
}
function dropSessionPart(part) {
    const s = safeJSON(localStorage.getItem(SESSION_KEY), null);
    if (!s) return;
    delete s[part];
    if (!s.card && !s.quiz && !s.spell) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
function getPendingSession() {
    const s = safeJSON(localStorage.getItem(SESSION_KEY), null);
    if (!s || Date.now() - s.t > 3 * DAY_MS || !(s.card || s.quiz || s.spell)) return null;
    return s;
}
function hasLiveProgress() {
    return cardRated.size > 0 || (quizQueue && quizQueue.length < quizTotal) || (spellQueue && spellQueue.length < spellTotal);
}
function dismissSession() { localStorage.removeItem(SESSION_KEY); renderToday(); }
function resumeSession() {
    const s = getPendingSession();
    if (!s) return;
    const u = s.ui || {};
    selectedSourceDeck = (u.deck === 'ALL' || decks[u.deck]) ? u.deck : 'ALL';
    populateSourceDeckDropdown();
    updateRangeDropdown();
    const rs = byId('range-mode-select');
    if ([...rs.options].some(o => o.value === u.range)) rs.value = u.range;
    if (u.cs) byId('custom-start-input').value = u.cs;
    if (u.ce) byId('custom-end-input').value = u.ce;
    if (u.order) byId('order-mode-select').value = u.order;
    if (u.filter) byId('filter-select').value = u.filter;
    byId('custom-range-box').classList.toggle('hidden', rs.value !== 'custom');
    applyStudySettings();

    const map = new Map(allWordsList().map(w => [wkey(w), w]));
    const toWords = keys => keys.map(k => map.get(k)).filter(Boolean);
    let used = null;
    if (s.card) {
        const q = toWords(s.card.q);
        if (q.length) {
            filteredWords = q; currentIndex = Math.min(s.card.i || 0, q.length - 1); cardTotal = s.card.total;
            cardRated = new Set(s.card.rated);
            cardReviewMap = new Map(s.card.rmap.map(([k, n]) => [k, { w: map.get(k), n }]).filter(([k, v]) => v.w));
            renderCard(); used = used || 'flashcard';
        }
    }
    if (s.quiz) {
        const q = toWords(s.quiz.q);
        if (q.length) {
            quizQueue = q; quizTotal = s.quiz.total; quizErrors = s.quiz.errors; quizScore = s.quiz.score || 0;
            quizFailedSet = new Set(s.quiz.failed); quizDone = false;
            byId('quiz-body').classList.remove('hidden'); byId('quiz-done').classList.add('hidden');
            byId('quiz-score').textContent = `Điểm: ${quizScore}`;
            used = used || 'quiz';
        }
    }
    if (s.spell) {
        const q = toWords(s.spell.q);
        if (q.length) {
            spellQueue = q; spellTotal = s.spell.total; spellErrors = s.spell.errors;
            spellFailedSet = new Set(s.spell.failed); spellDone = false;
            byId('spelling-body').classList.remove('hidden'); byId('spelling-done').classList.add('hidden');
            used = used || 'spelling';
        }
    }
    if (!used) { dismissSession(); toast('Không khôi phục được phiên học (dữ liệu đã thay đổi)'); return; }
    switchMode(['flashcard', 'quiz', 'spelling'].includes(s.mode) ? s.mode : used);
}

function renderToday() {
    const el = byId('today-card');
    if (!el) return;
    const due = dueWords().length, news = newWordsForToday().length, goal = dailyWordLimit;
    const l = todayLog();
    const pct = Math.min(100, Math.round(l.w / goal * 100));
    const lv = levelOf(userStats.xp);
    const pend = !hasLiveProgress() ? getPendingSession() : null;
    let pendHTML = '';
    if (pend) {
        const parts = [];
        if (pend.card) parts.push(`Flashcard (còn ${pend.card.q.length} từ)`);
        if (pend.quiz) parts.push(`Trắc nghiệm (còn ${pend.quiz.q.length} từ)`);
        if (pend.spell) parts.push(`Chính tả (còn ${pend.spell.q.length} từ)`);
        pendHTML = `<div class="mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p class="text-xs text-amber-800 dark:text-amber-300"><i class="fa-solid fa-clock-rotate-left mr-1.5"></i><b>Bạn có phiên học dở:</b> ${esc(parts.join(' · '))}</p>
            <div class="flex gap-2 shrink-0">
                <button onclick="resumeSession()" class="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Tiếp tục</button>
                <button onclick="dismissSession()" class="text-xs font-semibold text-amber-700 dark:text-amber-300 px-2 py-1.5">Bỏ qua</button>
            </div></div>`;
    }
    el.innerHTML = `<div class="w-full mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 sm:p-6 shadow-sm">
        ${pendHTML}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-white"><i class="fa-solid fa-bullseye text-indigo-500 mr-2"></i>Học hôm nay</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cấp ${lv} · ${esc(levelName(lv))} · <i class="fa-solid fa-fire text-amber-500"></i> ${userStats.streak} ngày · 🧊 ${U('freeze')}</p>
            </div>
            <button onclick="startToday()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-2xl text-sm shadow-sm transition ${due + news === 0 ? 'opacity-60' : ''}">
                <i class="fa-solid fa-play mr-1.5"></i> ${due + news === 0 ? 'Đã xong hôm nay' : 'Bắt đầu học hôm nay'}
            </button>
        </div>
        <div class="grid grid-cols-3 gap-3 mb-4 text-center">
            <div class="rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 p-3"><p class="text-xl font-extrabold text-indigo-600 dark:text-indigo-300">${due}</p><p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Từ đến hạn ôn</p></div>
            <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 p-3"><p class="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">${news}</p><p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Từ mới (mục tiêu ${goal})</p></div>
            <div class="rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-3"><p class="text-xl font-extrabold text-amber-600 dark:text-amber-400">${l.w}</p><p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Đã làm đúng hôm nay</p></div>
        </div>
        <div class="mb-4" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Tiến độ mục tiêu hôm nay">
            <div class="flex justify-between text-[11px] font-semibold text-slate-400 mb-1"><span>Mục tiêu ngày</span><span>${pct}%</span></div>
            <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden"><div class="bg-indigo-600 h-full rounded-full transition-all" style="width:${pct}%"></div></div>
        </div>
        <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Nhiệm vụ hôm nay</p>
        ${questsHTML()}
    </div>`;
}

// ---------------------------------------------------------------------
// 8. HOÀN TÁC (UNDO)
// ---------------------------------------------------------------------
let undoStack = [];
function pushUndo(k) {
    undoStack.push({
        queue: filteredWords.slice(), idx: currentIndex, rated: new Set(cardRated),
        rmap: new Map([...cardReviewMap].map(([a, b]) => [a, { w: b.w, n: b.n }])),
        mastered: new Set(masteredIds), review: new Set(reviewIds),
        k, srsOld: srs[k] ? Object.assign({}, srs[k]) : null,
        xp: userStats.xp, hard: U('hardCleared'), sessions: U('cardSessions'), total: cardTotal,
        log: JSON.stringify(todayLog()), combo: U('combo')
    });
    if (undoStack.length > 15) undoStack.shift();
    updateUndoBtn();
}
function updateUndoBtn() {
    const b = byId('btn-undo');
    if (b) { b.disabled = undoStack.length === 0; b.classList.toggle('opacity-40', undoStack.length === 0); }
}
function undoMark() {
    const s = undoStack.pop();
    if (!s) { toast('Không có thao tác nào để hoàn tác'); return; }
    filteredWords = s.queue; currentIndex = s.idx; cardRated = s.rated; cardReviewMap = s.rmap;
    masteredIds = s.mastered; reviewIds = s.review; cardTotal = s.total;
    if (s.srsOld) srs[s.k] = s.srsOld; else delete srs[s.k];
    saveSrs();
    userStats.xp = s.xp; userStats.hardCleared = s.hard; userStats.cardSessions = s.sessions; userStats.combo = s.combo;
    actLog[todayNum()] = JSON.parse(s.log);
    saveLog(); saveStats();
    byId('cards-body').classList.remove('hidden');
    byId('cards-done').classList.add('hidden');
    saveData();
    renderCard();
    updateStatsDisplay();
    updateUndoBtn();
    toast('↩ Đã hoàn tác thao tác vừa rồi');
}

// ---------------------------------------------------------------------
// 9. THẺ: HAI CHIỀU, MẸO NHỚ, TỪ MA
// ---------------------------------------------------------------------
let notes = safeJSON(localStorage.getItem('flash_notes'), {});
function ensureCardExtras() {
    if (byId('card-extra')) return;
    const ex = byId('card-example');
    const box = document.createElement('div');
    box.id = 'card-extra';
    box.className = 'mt-2 flex flex-col items-center gap-2';
    box.innerHTML = '<p id="card-note" class="hidden text-amber-200 text-xs sm:text-sm bg-indigo-950/60 border border-amber-400/30 rounded-xl px-3 py-2 max-w-md"></p>' +
        '<button type="button" id="btn-note" class="text-[11px] sm:text-xs text-indigo-200 hover:text-white underline underline-offset-2"><i class="fa-solid fa-pen mr-1"></i><span>Ghi mẹo nhớ</span></button>';
    ex.parentNode.appendChild(box);
    byId('btn-note').addEventListener('click', e => { e.stopPropagation(); editNote(); });
    const pos = byId('card-pos-front');
    const leech = document.createElement('span');
    leech.id = 'card-leech';
    leech.className = 'hidden ml-2 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded-md text-[11px] font-semibold normal-case tracking-normal';
    leech.title = 'Từ ma: bạn đã quên từ này từ 5 lần trở lên. Hãy ghi mẹo nhớ ở mặt sau.';
    leech.textContent = '👻 Từ ma';
    pos.parentNode.insertBefore(leech, pos.nextSibling);
}
function applyCardDirection(cur) {
    ensureCardExtras();
    const vi = S.dir === 'vi2en', k = wkey(cur), st = srs[k];
    if (vi) {
        byId('card-word').textContent = cur.Meaning || '';
        byId('card-phonetic').textContent = '';
        byId('card-meaning').textContent = cur.Word || '';
        byId('card-example').textContent = [cur.Phonetic, cur.Example ? `"${cur.Example}"` : ''].filter(Boolean).join('  ·  ');
    }
    document.querySelectorAll('#card-inner button[title="Phát âm"], #btn-card-mic').forEach(b => b.classList.toggle('hidden', vi));
    byId('card-leech').classList.toggle('hidden', !(st && (st.lapses || 0) >= 5));
    const note = notes[k];
    const n = byId('card-note');
    n.textContent = note ? '💡 ' + note : '';
    n.classList.toggle('hidden', !note);
    byId('btn-note').querySelector('span').textContent = note ? 'Sửa mẹo nhớ' : 'Ghi mẹo nhớ';
}
function editNote() {
    const cur = filteredWords[currentIndex];
    if (!cur) return;
    const k = wkey(cur);
    const v = prompt(`Mẹo nhớ cho từ "${cur.Word}" (để trống để xóa):`, notes[k] || '');
    if (v === null) return;
    const t = v.trim().slice(0, 300);
    if (t) notes[k] = t; else delete notes[k];
    localStorage.setItem('flash_notes', JSON.stringify(notes));
    applyCardDirection(cur);
}
function toggleDirection() {
    S.dir = S.dir === 'vi2en' ? 'en2vi' : 'vi2en';
    saveSettings();
    applySettings();
    if (activeMode === 'flashcard') renderCard();
    if (activeMode === 'quiz' && quizQueue) generateQuizQuestion();
    toast(S.dir === 'vi2en' ? 'Chế độ Việt → Anh: nhìn nghĩa, đoán từ' : 'Chế độ Anh → Việt: nhìn từ, đoán nghĩa');
}

// Đáp án nhiễu thông minh: ưu tiên cùng loại từ, độ dài và chữ gần giống
function buildOptions(target, pool, field) {
    const tv = String(target[field] || '');
    const seen = new Set([tv]);
    let sample = pool.length > 300 ? pool.slice().sort(() => Math.random() - 0.5).slice(0, 300) : pool;
    const cands = [];
    sample.forEach(w => {
        const v = String(w[field] || '');
        if (!v || seen.has(v)) return;
        seen.add(v);
        let sc = Math.random() * 0.6;
        if (w.POS && target.POS && w.POS === target.POS && target.POS !== 'word') sc += 2;
        sc += 1 - Math.min(1, Math.abs(v.length - tv.length) / 10);
        if (field === 'Word') sc += (1 - levenshtein(v.toLowerCase(), tv.toLowerCase()) / Math.max(v.length, tv.length, 1)) * 1.5;
        cands.push({ v, sc });
    });
    cands.sort((a, b) => b.sc - a.sc);
    const picks = cands.slice(0, 8).sort(() => Math.random() - 0.5).slice(0, 3).map(c => c.v);
    return [tv, ...picks].sort(() => Math.random() - 0.5);
}

// ---------------------------------------------------------------------
// 10. CHÍNH TẢ: GỢI Ý & SO SÁNH CHỮ
// ---------------------------------------------------------------------
let spellHintLevel = 0;
function spellHintText() {
    const w = currentSpellingWord.Word;
    if (spellHintLevel === 0) return `Gợi ý: Từ có ${w.length} ký tự (Bắt đầu bằng '${w[0]}')`;
    const show = Math.max(1, Math.ceil(w.length * (spellHintLevel === 1 ? 0.4 : 0.7)));
    return 'Gợi ý: ' + w.split('').map((c, i) => (c === ' ' || i < show) ? c : '_').join(' ');
}
function spellHint() {
    if (!currentSpellingWord || spellLocked) return;
    spellHintLevel = Math.min(2, spellHintLevel + 1);
    byId('spelling-hint').textContent = spellHintText();
    const k = wkey(currentSpellingWord);
    if (!spellFailedSet.has(k)) { spellFailedSet.add(k); spellErrors++; } // dùng gợi ý: không tính "không sai câu nào"
    toast(spellHintLevel >= 2 ? 'Đã hiện hầu hết chữ cái' : '💡 Đã hiện thêm chữ cái (từ này không còn được tính hoàn hảo)');
}
function diffHtml(input, target) {
    const a = String(input), b = String(target), n = Math.max(a.length, b.length);
    let out = '';
    for (let i = 0; i < n; i++) {
        const ca = a[i] || '', cb = b[i] || '';
        if (!ca) out += '<span class="text-slate-400">_</span>';
        else out += ca.toLowerCase() === cb.toLowerCase() ? `<span class="text-emerald-600 dark:text-emerald-400">${esc(ca)}</span>` : `<span class="text-rose-600 dark:text-rose-400 underline">${esc(ca)}</span>`;
    }
    return out;
}
function spellWrongHTML(input, target) {
    return `<div class="text-center space-y-1">
        <div class="text-rose-600 dark:text-rose-400 font-bold"><i class="fa-solid fa-circle-xmark mr-1"></i> Chưa đúng</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">Bạn gõ: <span class="font-mono font-bold tracking-wider">${diffHtml(input, target)}</span></div>
        <div class="text-xs text-slate-500 dark:text-slate-400">Từ đúng: <span class="font-bold text-slate-800 dark:text-slate-100">${esc(target)}</span></div>
    </div>`;
}

// ---------------------------------------------------------------------
// 11. THỐNG KÊ NÂNG CAO (lịch hoạt động, biểu đồ, điểm yếu, cấp độ)
// ---------------------------------------------------------------------
function heatClass(w) { return w <= 0 ? 'heat-0' : w < 10 ? 'heat-1' : w < 25 ? 'heat-2' : w < 50 ? 'heat-3' : 'heat-4'; }
function renderStatsExtra() {
    const el = byId('stats-extra');
    if (!el) return;
    const t = todayNum(), xp = userStats.xp, lv = levelOf(xp);
    const a = levelStart(lv), b = levelStart(lv + 1), lvPct = Math.min(100, Math.round((xp - a) / (b - a) * 100));
    const card = (title, body) => `<div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm"><h4 class="text-sm font-bold text-slate-900 dark:text-white mb-3">${title}</h4>${body}</div>`;

    // Cấp độ + nhiệm vụ
    const levelHTML = card('Cấp độ & Nhiệm vụ hôm nay', `
        <div class="flex items-center justify-between mb-1.5"><span class="text-sm font-bold text-indigo-600 dark:text-indigo-300">Cấp ${lv} · ${esc(levelName(lv))}</span><span class="text-xs text-slate-400 font-medium">${xp - a}/${b - a} XP · 🧊 ${U('freeze')} đóng băng</span></div>
        <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-4" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lvPct}" aria-label="Tiến độ lên cấp"><div class="bg-indigo-600 h-full rounded-full" style="width:${lvPct}%"></div></div>
        ${questsHTML()}`);

    // Lịch hoạt động 12 tuần
    let cells = '';
    for (let i = 83; i >= 0; i--) {
        const d = t - i, l = actLog[d], w = l ? l.w : 0, m = l ? Math.floor(l.sec / 60) : 0;
        cells += `<div class="heat-cell ${heatClass(w)}" title="${fmtDM(d)}: ${w} từ đúng, ${m} phút"></div>`;
    }
    const heatHTML = card('Lịch hoạt động (12 tuần gần nhất)', `<div style="display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,1fr);gap:3px">${cells}</div>
        <div class="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400">Ít <span class="heat-cell heat-0" style="width:12px"></span><span class="heat-cell heat-1" style="width:12px"></span><span class="heat-cell heat-2" style="width:12px"></span><span class="heat-cell heat-3" style="width:12px"></span><span class="heat-cell heat-4" style="width:12px"></span> Nhiều</div>`);

    // Biểu đồ 14 ngày
    const days = Array.from({ length: 14 }, (_, i) => t - 13 + i);
    const maxW = Math.max(5, ...days.map(d => (actLog[d] ? actLog[d].w : 0)));
    const bars = days.map(d => {
        const l = actLog[d], w = l ? l.w : 0, h = Math.round(w / maxW * 100);
        return `<div class="flex-1 flex flex-col items-center justify-end h-full" title="${fmtDM(d)}: ${w} từ đúng, ${l ? l.xp : 0} XP, ${l ? Math.floor(l.sec / 60) : 0} phút">
            <span class="text-[9px] text-slate-400">${w || ''}</span>
            <div class="w-full rounded-t-md ${d === t ? 'bg-indigo-600' : 'bg-indigo-300 dark:bg-indigo-800'}" style="height:${Math.max(h, w ? 4 : 1)}%"></div></div>`;
    }).join('');
    const labels = days.map(d => `<span class="flex-1 text-center text-[9px] text-slate-400">${fmtDM(d).slice(0, 2)}</span>`).join('');
    const chartHTML = card('Số từ làm đúng mỗi ngày (14 ngày)', `<div class="flex items-end gap-1 h-28">${bars}</div><div class="flex gap-1 mt-1">${labels}</div>`);

    // Độ chính xác theo chế độ
    const tot = { card: [0, 0], quiz: [0, 0], spell: [0, 0] };
    Object.values(actLog).forEach(l => ['card', 'quiz', 'spell'].forEach(m => { tot[m][0] += (l.ok && l.ok[m]) || 0; tot[m][1] += (l.bad && l.bad[m]) || 0; }));
    const names = { card: 'Flashcard', quiz: 'Trắc nghiệm', spell: 'Chính tả' };
    const accHTML = card('Độ chính xác theo chế độ', ['card', 'quiz', 'spell'].map(m => {
        const n = tot[m][0] + tot[m][1], p = n ? Math.round(tot[m][0] / n * 100) : 0;
        return `<div class="mb-2.5"><div class="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1"><span>${names[m]}</span><span>${n ? p + '%' : 'Chưa có dữ liệu'} ${n ? `<span class="font-normal text-slate-400">(${n} lượt)</span>` : ''}</span></div>
            <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden"><div class="bg-emerald-500 h-full rounded-full" style="width:${p}%"></div></div></div>`;
    }).join(''));

    // Phân bố SRS
    const all = allWordsList();
    const dist = { n: 0, l: 0, k: 0, m: 0 };
    all.forEach(w => { const s = srs[wkey(w)]; if (!s) dist.n++; else if (s.box <= 2) dist.l++; else if (s.box <= 4) dist.k++; else dist.m++; });
    const totalW = Math.max(1, all.length);
    const seg = (n, cls) => `<div class="${cls} h-full" style="width:${n / totalW * 100}%"></div>`;
    const legend = (n, cls, label) => `<span class="flex items-center"><span class="w-2.5 h-2.5 rounded-full ${cls} inline-block mr-1.5"></span>${label} (${n})</span>`;
    const distHTML = card('Trạng thái ghi nhớ (SRS)', `<div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden flex">${seg(dist.n, 'bg-slate-300 dark:bg-slate-600')}${seg(dist.l, 'bg-amber-400')}${seg(dist.k, 'bg-sky-400')}${seg(dist.m, 'bg-emerald-500')}</div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">${legend(dist.n, 'bg-slate-300 dark:bg-slate-600', 'Mới')}${legend(dist.l, 'bg-amber-400', 'Đang học')}${legend(dist.k, 'bg-sky-400', 'Quen')}${legend(dist.m, 'bg-emerald-500', 'Thuộc lâu')}</div>`);

    // Top từ khó nhất
    const wmap = new Map(all.map(w => [wkey(w), w]));
    const hard = Object.entries(srs).filter(([k, s]) => (s.lapses || 0) > 0 && wmap.has(k)).sort((x, y) => (y[1].lapses || 0) - (x[1].lapses || 0)).slice(0, 10);
    const hardHTML = card('Top 10 từ khó nhất', hard.length ? `<ol class="space-y-1.5">${hard.map(([k, s], i) => {
        const w = wmap.get(k);
        return `<li class="flex items-center justify-between gap-2 text-sm"><span class="min-w-0 truncate"><span class="text-slate-400 text-xs mr-2">${i + 1}.</span><b class="text-slate-800 dark:text-slate-100">${esc(w.Word)}</b> <span class="text-slate-500 dark:text-slate-400 text-xs">- ${esc(w.Meaning)}</span></span><span class="shrink-0 text-xs font-semibold ${s.lapses >= 5 ? 'text-rose-500' : 'text-amber-500'}">${s.lapses >= 5 ? '👻 ' : ''}quên ${s.lapses} lần</span></li>`;
    }).join('')}</ol>` : '<p class="text-xs text-slate-400">Chưa có từ nào bị quên. Cứ học tiếp nhé!</p>');

    el.innerHTML = levelHTML + heatHTML + chartHTML + accHTML + distHTML + hardHTML;
}

// ---------------------------------------------------------------------
// 12. MODAL: CÀI ĐẶT & HƯỚNG DẪN NHANH
// ---------------------------------------------------------------------
const MODAL_IDS = ['excel-guide', 'settings-modal', 'help-modal'];
let _lastFocus = null;
function showModal(id) {
    const m = byId(id);
    if (!m) return;
    _lastFocus = document.activeElement;
    m.classList.remove('hidden');
    const f = m.querySelector('button, input, select');
    if (f) f.focus();
}
function hideModal(id) {
    const m = byId(id);
    if (m) m.classList.add('hidden');
    if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (e) {} }
}
const anyModalOpen = () => MODAL_IDS.some(id => { const m = byId(id); return m && !m.classList.contains('hidden'); });
function closeTopModal() { MODAL_IDS.forEach(id => { const m = byId(id); if (m && !m.classList.contains('hidden')) hideModal(id); }); }

function makeModal(id, label, inner) {
    let m = byId(id);
    if (!m) {
        m = document.createElement('div');
        m.id = id;
        m.className = 'hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-modal', 'true');
        m.setAttribute('aria-label', label);
        m.addEventListener('click', e => { if (e.target === m) hideModal(id); });
        document.body.appendChild(m);
    }
    m.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">${inner}</div>`;
    return m;
}

function setSetting(key, v) {
    if (['vol', 'font', 'gap'].includes(key)) v = parseInt(v, 10);
    if (key === 'rate') v = parseFloat(v);
    S[key] = v;
    saveSettings();
    applySettings();
    if (key === 'sfx' || key === 'vol') playSoundEffect('correct');
    if (key === 'rate' || key === 'voice') say('Hello, this is a test');
    if (key === 'dir' && activeMode === 'flashcard') renderCard();
}
function setAutoPlay(v) { autoPlay = !!v; localStorage.setItem('flash_autoplay', autoPlay ? '1' : '0'); }
function unhideDecks() { hiddenDecks.clear(); localStorage.setItem('flash_hidden', '[]'); toast('Đã bật lại các bộ bài đã ẩn, đang tải lại...'); setTimeout(() => location.reload(), 800); }
function resetSettings() { S = Object.assign({}, SETTINGS_DEFAULT); saveSettings(); applySettings(); openSettings(); toast('Đã khôi phục cài đặt mặc định'); }

function openSettings() {
    const row = (label, ctl, hint) => `<div class="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700/60"><div class="min-w-0"><p class="text-sm font-semibold text-slate-800 dark:text-slate-100">${label}</p>${hint ? `<p class="text-[11px] text-slate-500 dark:text-slate-400">${hint}</p>` : ''}</div>${ctl}</div>`;
    const sel = 'bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm';
    const chk = (label, on, fn) => `<input type="checkbox" aria-label="${label}" class="w-5 h-5 accent-indigo-600" ${on ? 'checked' : ''} onchange="${fn}">`;
    const opt = (v, t, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${t}</option>`;
    const hiddenN = hiddenDecks.size;
    makeModal('settings-modal', 'Cài đặt', `
        <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white"><i class="fa-solid fa-gear text-indigo-500 mr-2"></i>Cài đặt</h3>
            <button onclick="hideModal('settings-modal')" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Đóng"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
        ${row('Âm thanh hiệu ứng', chk('Âm thanh hiệu ứng', S.sfx, "setSetting('sfx', this.checked)"), 'Tiếng khi trả lời đúng / sai')}
        ${row('Âm lượng', `<input type="range" min="0" max="100" value="${S.vol}" aria-label="Âm lượng" class="w-32 accent-indigo-600" onchange="setSetting('vol', this.value)">`)}
        ${row('Tự động đọc từ', chk('Tự động đọc từ', autoPlay, 'setAutoPlay(this.checked)'), 'Đọc khi sang thẻ / câu mới')}
        ${row('Giọng đọc', `<select class="${sel}" aria-label="Giọng đọc" onchange="setSetting('voice', this.value)">${opt('en-US', 'Anh - Mỹ', S.voice)}${opt('en-GB', 'Anh - Anh', S.voice)}</select>`)}
        ${row('Tốc độ đọc', `<input type="range" min="0.6" max="1.2" step="0.1" value="${S.rate}" aria-label="Tốc độ đọc" class="w-32 accent-indigo-600" onchange="setSetting('rate', this.value)">`)}
        ${row('Hướng học', `<select class="${sel}" aria-label="Hướng học" onchange="setSetting('dir', this.value)">${opt('en2vi', 'Anh → Việt', S.dir)}${opt('vi2en', 'Việt → Anh', S.dir)}</select>`, 'Áp dụng cho Flashcard và Trắc nghiệm')}
        ${row('Thẻ "Ôn lại" quay lại sau', `<select class="${sel}" aria-label="Số thẻ" onchange="setSetting('gap', this.value)">${[2, 3, 4, 5, 6, 8, 10].map(n => opt(n, n + ' thẻ', S.gap)).join('')}</select>`)}
        ${row('Rung khi chấm', chk('Rung khi chấm', S.haptic, "setSetting('haptic', this.checked)"), 'Trên điện thoại hỗ trợ rung')}
        ${row('Cỡ chữ', `<select class="${sel}" aria-label="Cỡ chữ" onchange="setSetting('font', this.value)">${opt(90, 'Nhỏ', S.font)}${opt(100, 'Vừa', S.font)}${opt(115, 'Lớn', S.font)}${opt(130, 'Rất lớn', S.font)}</select>`)}
        ${row('Giảm hiệu ứng chuyển động', chk('Giảm hiệu ứng', S.reduce, "setSetting('reduce', this.checked)"), 'Tắt lật thẻ mượt, pháo giấy...')}
        <div class="flex flex-wrap gap-2 mt-4">
            <button onclick="hideModal('settings-modal'); openHelp(0)" class="text-xs font-semibold px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"><i class="fa-solid fa-circle-question mr-1"></i> Hướng dẫn nhanh & phím tắt</button>
            ${hiddenN ? `<button onclick="unhideDecks()" class="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Hiện lại ${hiddenN} bộ bài đã ẩn</button>` : ''}
            <button onclick="resetSettings()" class="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">Khôi phục mặc định</button>
        </div>`);
    showModal('settings-modal');
}

const HELP_STEPS = [
    { icon: 'fa-layer-group', title: 'Học bằng Flashcard', body: `<ul class="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5"><li><b>Chạm vào thẻ</b> để lật xem nghĩa và ví dụ.</li><li><b>Vuốt trái</b> = Ôn lại · <b>Vuốt phải</b> = Đã thuộc.</li><li>Từ đã thuộc rời khỏi vòng, từ ôn lại sẽ quay lại sau vài thẻ. Học hết là hoàn thành phiên.</li><li>Chấm nhầm? Bấm <b>Hoàn tác</b> (phím Z).</li></ul>` },
    { icon: 'fa-bullseye', title: 'Ôn tập thông minh', body: `<ul class="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5"><li>Ở trang <b>Bộ bài</b>, bấm <b>Bắt đầu học hôm nay</b>: web tự gom từ đến hạn ôn và từ mới.</li><li>Từ càng nhớ lâu thì càng được ôn thưa dần (SRS). Từ quên nhiều lần bị gắn nhãn 👻 <b>Từ ma</b>, hãy ghi mẹo nhớ.</li><li>Luyện thêm bằng <b>Trắc nghiệm</b> và <b>Chính tả</b>; kiếm XP, nhiệm vụ ngày và danh hiệu.</li><li>Nhớ <b>sao lưu tiến độ</b> ở tab Thống kê.</li></ul>` },
    { icon: 'fa-keyboard', title: 'Nhập từ vựng & phím tắt', body: `<p class="text-sm text-slate-700 dark:text-slate-300 mb-2">Bấm <b>Nhập Excel</b> để xem hướng dẫn định dạng và tải file mẫu.</p>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">Space</kbd> Lật thẻ</span><span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">1</kbd> Quên / Ôn lại</span>
            <span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">←</kbd> Ôn lại</span><span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">2</kbd> Khó (nhớ nhưng khó)</span>
            <span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">→</kbd> Đã thuộc</span><span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">3</kbd> Tốt (đã thuộc)</span>
            <span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">Shift+←/→</kbd> Thẻ trước/sau</span><span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">4</kbd> Dễ (ôn thưa hơn)</span>
            <span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">Z</kbd> Hoàn tác</span><span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">?</kbd> Mở hướng dẫn này</span>
            <span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">1-4</kbd> Trắc nghiệm: chọn đáp án</span><span><kbd class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 rounded">Enter</kbd> Câu tiếp theo</span>
        </div>` }
];
let helpStep = 0;
function openHelp(step) {
    helpStep = Math.max(0, Math.min(HELP_STEPS.length - 1, step || 0));
    const s = HELP_STEPS[helpStep], last = helpStep === HELP_STEPS.length - 1;
    makeModal('help-modal', 'Hướng dẫn nhanh', `
        <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Bước ${helpStep + 1}/${HELP_STEPS.length}</span>
            <button onclick="closeHelp()" class="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400">Bỏ qua</button>
        </div>
        <div class="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mb-3"><i class="fa-solid ${s.icon} text-2xl text-indigo-600 dark:text-indigo-300"></i></div>
        <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-3">${s.title}</h3>
        <div class="mb-5">${s.body}</div>
        <div class="flex gap-2">
            ${helpStep > 0 ? `<button onclick="openHelp(${helpStep - 1})" class="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium py-2.5 rounded-2xl text-sm">Quay lại</button>` : ''}
            <button onclick="${last ? 'closeHelp()' : `openHelp(${helpStep + 1})`}" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-2xl text-sm">${last ? 'Bắt đầu học' : 'Tiếp theo'}</button>
        </div>`);
    showModal('help-modal');
}
function closeHelp() { localStorage.setItem('flash_onboarded', '1'); hideModal('help-modal'); }

// ---------------------------------------------------------------------
// 13. KHẢ NĂNG TIẾP CẬN
// ---------------------------------------------------------------------
function enhanceA11y() {
    document.querySelectorAll('button[title]').forEach(b => {
        if (!b.getAttribute('aria-label') && !b.textContent.trim()) b.setAttribute('aria-label', b.title);
    });
    [['quiz-bar', 'Tiến độ trắc nghiệm'], ['spell-bar', 'Tiến độ chính tả'], ['card-bar', 'Tiến độ học thẻ']].forEach(([id, label]) => {
        const el = byId(id);
        if (el && el.parentElement) {
            const p = el.parentElement;
            p.setAttribute('role', 'progressbar'); p.setAttribute('aria-label', label);
            p.setAttribute('aria-valuemin', '0'); p.setAttribute('aria-valuemax', '100'); p.setAttribute('aria-valuenow', '0');
        }
    });
    const g = byId('excel-guide');
    if (g) { g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', 'Hướng dẫn nhập file Excel'); }
}
function setBarAria(id, pct) {
    const el = byId(id);
    if (el && el.parentElement) el.parentElement.setAttribute('aria-valuenow', String(pct));
}

// ---------------------------------------------------------------------
// 14. PHÍM TẮT
// ---------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (anyModalOpen()) { closeTopModal(); } return; }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (anyModalOpen()) return;
    if (e.key === '?') { openHelp(2); return; }
    if (activeMode === 'flashcard') {
        const lock = byId('cards-body') && byId('cards-body').classList.contains('hidden');
        if ((e.key === 'z' || e.key === 'Z') && !e.altKey) { e.preventDefault(); undoMark(); return; }
        if (lock) return;
        if (e.code === 'Space') { e.preventDefault(); flipCard(); }
        else if (e.code === 'ArrowLeft') { e.shiftKey ? prevCard() : markStatus('review'); }
        else if (e.code === 'ArrowRight') { e.shiftKey ? nextCard() : markStatus('mastered'); }
        else if (e.key === '1') markStatus('review');
        else if (e.key === '2') markStatus('hard');
        else if (e.key === '3') markStatus('mastered');
        else if (e.key === '4') markStatus('easy');
    } else if (activeMode === 'quiz') {
        if (/^[1-4]$/.test(e.key)) {
            const b = document.querySelectorAll('#quiz-options button')[parseInt(e.key, 10) - 1];
            if (b) b.click();
        } else if (e.key === 'Enter' && quizAnswered) nextQuizQuestion();
    }
});

// ---------------------------------------------------------------------
// 15. KHỞI TẠO (được app.js gọi)
// ---------------------------------------------------------------------
function initFeatures() {
    pruneLog();
    normalizeStreak();
    applySettings();
    enhanceA11y();
    requestPersist();
    const bi = byId('backup-input');
    if (bi) bi.addEventListener('change', e => { restoreBackup(e.target.files[0]); e.target.value = ''; });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { saveSessionNow(); saveLog(); } });
    window.addEventListener('pagehide', () => { saveSessionNow(); saveLog(); });
    updateUndoBtn();
}
function afterLoad() {
    renderToday();
    refreshBackupInfo();
    backupReminder();
    streakReminder();
    if (!localStorage.getItem('flash_onboarded')) setTimeout(() => openHelp(0), 600);
}
