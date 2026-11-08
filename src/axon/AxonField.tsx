import { useEffect, useRef } from 'react'
import { createField } from './field'

/** 背景粒子云：整页固定，UI 全在它上面 */
export default function AxonField() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ripples = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvas.current) return
    let handle: { dispose(): void } | undefined
    try {
      handle = createField(canvas.current)
    } catch (error) {
      // WebGL 不可用就安静地留一块黑底，UI 照常用（画布留着会画成白块）
      canvas.current.style.display = 'none'
      console.warn('[axon] particle field disabled:', error)
    }
    return () => handle?.dispose()
  }, [])

  /* 粒子层的波纹只在背景露出来的地方看得见，面板上的点击补一圈细环。
     纯 DOM，不碰 WebGL，WebGL 挂了也照样有反馈。 */
  useEffect(() => {
    const host = ripples.current
    if (!host) return
    const onDown = (e: PointerEvent) => {
      // 一次点击放两圈，前一圈稍晚、更淡，像水面上的第二道波
      for (const delay of [0, 120]) {
        const dot = document.createElement('i')
        dot.style.left = `${e.clientX}px`
        dot.style.top = `${e.clientY}px`
        if (delay) dot.style.animationDelay = `${delay}ms`
        host.appendChild(dot)
        dot.addEventListener('animationend', () => dot.remove(), { once: true })
      }
      // 连点时不至于堆一屏
      while (host.childElementCount > 8) host.firstElementChild?.remove()
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  return (
    <>
      <canvas ref={canvas} className="axon-bg" aria-hidden="true" />
      <div ref={ripples} className="axon-ripples" aria-hidden="true" />
    </>
  )
}
