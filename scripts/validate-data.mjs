// Kiểm tra dữ liệu trước khi đưa lên GitHub: chạy "npm run validate"
// - Mỗi file trong data/files.json phải tồn tại
// - Mỗi file Excel phải có cột Word + Meaning (hoặc theo cách đọc không tiêu đề của ứng dụng)
// - Cảnh báo từ trùng lặp trong cùng một file
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.error('✖ LỖI: ' + m); };
const warn = (m) => { warnings++; console.warn('! Cảnh báo: ' + m); };

if (!existsSync('data')) { console.log('Chưa có thư mục data/, bỏ qua kiểm tra dữ liệu.'); process.exit(0); }

let files;
if (existsSync('data/files.json')) {
  let list;
  try { list = JSON.parse(readFileSync('data/files.json', 'utf8')); } catch (e) { err('data/files.json không phải JSON hợp lệ: ' + e.message); process.exit(1); }
  if (!Array.isArray(list)) { err('data/files.json phải là một mảng, ví dụ ["Vocabulary_A1.xlsx"]'); process.exit(1); }
  files = list;
  for (const f of list) if (!existsSync('data/' + f)) err(`data/files.json nhắc tới "${f}" nhưng không có file này trong thư mục data/`);
  const listed = new Set(list);
  for (const f of readdirSync('data')) if (/\.(xlsx|xls)$/i.test(f) && !listed.has(f)) warn(`data/${f} chưa được ghi trong data/files.json nên website sẽ không nạp file này`);
} else {
  files = readdirSync('data').filter((f) => /\.(xlsx|xls|json)$/i.test(f));
  console.log('Không có data/files.json: website dùng danh sách mặc định trong js/app.js (DEFAULT_DATA_FILES).');
}

for (const f of files) {
  const path = 'data/' + f;
  if (!existsSync(path) || !/\.(xlsx|xls)$/i.test(f)) continue;
  try {
    const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    let colMap = {}, headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10) && headerIdx < 0; i++) {
      (rows[i] || []).forEach((c, j) => {
        const v = String(c || '').trim().toLowerCase();
        if (['word', 'từ vựng', 'tu vung'].includes(v)) colMap.word = j;
        if (['meaning', 'nghĩa', 'nghia'].includes(v)) colMap.meaning = j;
      });
      if (colMap.word !== undefined && colMap.meaning !== undefined) headerIdx = i;
    }
    if (headerIdx < 0) { warn(`${path}: không tìm thấy tiêu đề Word/Meaning, web sẽ đọc theo cột B (từ) và D (nghĩa) từ dòng 2`); colMap = { word: 1, meaning: 3 }; headerIdx = 1; }
    let n = 0; const seen = new Set();
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const w = String((rows[r] || [])[colMap.word] || '').trim();
      const m = String((rows[r] || [])[colMap.meaning] || '').trim();
      if (w && m) { n++; const k = w.toLowerCase(); if (seen.has(k)) warn(`${path}: từ "${w}" bị trùng (dòng ${r + 1})`); seen.add(k); }
    }
    if (n === 0) err(`${path}: không có dòng từ vựng hợp lệ nào (cần cả Word và Meaning)`);
    else console.log(`✔ ${path}: ${n} từ`);
  } catch (e) { err(`${path}: không đọc được file (${e.message})`); }
}

// Kiểm tra số phiên bản ?v= trong index.html khớp với sw.js
const html = readFileSync('index.html', 'utf8'), sw = readFileSync('sw.js', 'utf8');
const vs = [...new Set([...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]))];
const swv = (sw.match(/flashcard-v(\d+)/) || [])[1];
if (vs.length !== 1) err('Các số "?v=" trong index.html không giống nhau: ' + vs.join(', '));
else if (vs[0] !== swv) err(`Số phiên bản không khớp: index.html dùng ?v=${vs[0]} nhưng sw.js là flashcard-v${swv}`);
else console.log(`✔ Số phiên bản khớp (v${swv})`);

console.log(`\nHoàn tất: ${errors} lỗi, ${warnings} cảnh báo.`);
process.exit(errors ? 1 : 0);
