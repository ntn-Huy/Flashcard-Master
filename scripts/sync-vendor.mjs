// Chép các thư viện từ node_modules vào thư mục vendor/ (chạy: npm run vendor)
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('vendor/fontawesome/css', { recursive: true });
mkdirSync('vendor/fontawesome/webfonts', { recursive: true });
cpSync('node_modules/xlsx/dist/xlsx.full.min.js', 'vendor/xlsx.full.min.js');
cpSync('node_modules/canvas-confetti/dist/confetti.browser.js', 'vendor/confetti.browser.js');
cpSync('node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'vendor/fontawesome/css/all.min.css');
for (const f of ['fa-solid-900.woff2', 'fa-regular-400.woff2']) {
  cpSync(`node_modules/@fortawesome/fontawesome-free/webfonts/${f}`, `vendor/fontawesome/webfonts/${f}`);
}
console.log('Đã chép thư viện vào vendor/');
