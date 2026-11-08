import type { CSSProperties } from 'react'
import './LoadingScreen.css'

/**
 * 首屏加载页：深色底 + 一块液态玻璃，玻璃里是会翻字的 Loading。
 *
 * 玻璃本体用的是 index.css 里那套 .liquid-glass-strong（Tailwind `@layer components`）：
 * 几乎全透的底 + blur(50px) + 一圈 1.4px、中段渐隐的描边 —— 描边亮在两头、
 * 在中段化到没有，玻璃的边界才是「光」，不是一圈框。
 * 这里把白描边换成橹穆应援色（顶蓝 #aee4ff / 底粉 #ffccd5），
 * 并在玻璃背后铺一层左蓝右粉的光：blur 会把那团光拉进玻璃里，蓝粉不用涂在玻璃上。
 *
 * 「Loa」先摆在那儿，i / n / g 依次被拎起来、向后翻倒，再拍回字里 ——
 * 落地那一下自己压成扁的，同时把前一个字母撞得往左退一格再弹回来，像果冻。
 * 节奏全写在 LoadingScreen.css：2000ms 一个循环，每 280ms 落一个，
 * 落点（16%）和前一个字母的 --r 对齐。
 */

/** 每一格：被拎起来的时刻，和被撞后回弹的时刻（ms，同一个 2000ms 周期里） */
const LETTERS: { ch: string; flip?: number; hit?: number }[] = [
  { ch: 'L' },
  { ch: 'o' },
  { ch: 'a' },
  { ch: 'd', hit: 320 },
  { ch: 'i', flip: 0, hit: 600 },
  { ch: 'n', flip: 280, hit: 880 },
  { ch: 'g', flip: 560 },
]

export default function LoadingScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={leaving ? 'ld-screen is-out' : 'ld-screen'}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="ld-stage">
        {/* 左蓝右粉的一团光：玻璃的大半径 blur 会把它拉进去，成玻璃里的蓝粉 */}
        <span className="ld-glow" aria-hidden="true" />

        <div className="ld-glass liquid-glass-strong rounded-full">
          {/* 斜向折射光带：主光带 + 一道更细的副光，全画面唯一的「斜」 */}
          <span className="ld-band" aria-hidden="true" />

          <p className="ld-word" aria-hidden="true">
            {LETTERS.map((l) => (
              <span
                key={l.ch}
                className={l.flip === undefined ? 'ld-l' : 'ld-l is-flip'}
                style={{ '--d': `${l.flip ?? 0}ms` } as CSSProperties}
              >
                <span
                  className={l.hit === undefined ? 'ld-g' : 'ld-g is-hit'}
                  style={{ '--r': `${l.hit ?? 0}ms` } as CSSProperties}
                >
                  {l.ch}
                </span>
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  )
}
