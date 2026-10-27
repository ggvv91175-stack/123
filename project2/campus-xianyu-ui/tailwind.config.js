/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx,js}'],
  // 关闭 preflight：避免 Tailwind 重置样式破坏 Element Plus 组件外观
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#409eff', dark: '#337ecc' },
      },
    },
  },
  plugins: [],
}
