/** Cấu hình Tailwind: quét class trong index.html và js/*.js rồi biên dịch ra css/tailwind.css */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#f0f9ff', 100: '#e0f2fe', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1' }
      }
    }
  }
};
