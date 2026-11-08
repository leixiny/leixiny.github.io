import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: {
    /**
     * 站点原有的版式是手写 CSS（index.css + 各页面自己的 css），
     * Tailwind 的 preflight 会把 h1~h6 的 margin、列表、按钮、img 全部重置，
     * 那一下会直接把首页/后台的排布打散。
     * 所以这里只借它的 utilities 和 @layer components，reset 仍用我们自己的。
     */
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Instrument Serif'", 'serif'],
        body: ["'Barlow'", 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
