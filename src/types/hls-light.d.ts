/* hls.js 的轻量构建：只少了字幕、备用音轨这些这一层背景根本用不到的东西，
   体积却小一截。包本身没带 d.ts，这里把它声明成和主包同一个类型 */
declare module 'hls.js/light' {
  import Hls from 'hls.js'
  export default Hls
}
