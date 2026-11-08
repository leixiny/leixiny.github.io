import { useEffect, useRef } from 'react'
import { createWater, type WaterHandle } from './water'
import waterTexture from '../assets/loading-pond.webp'

/**
 * 背景水面：整页固定，UI 全在它上面。
 * 点击时既让 GL 的水面荡开，也在光标处补一圈细环 ——
 * 后者纯 DOM，WebGL 挂了也照样有反馈。
 */
export default function AxonField() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const ripples = useRef<HTMLDivElement>(null)
  const water = useRef<WaterHandle | null>(null)

  useEffect(() => {
    if (!canvas.current) return
    try {
      water.current = createWater(canvas.current, waterTexture)
    } catch (error) {
      // WebGL 不可用就留 CSS 那层青色底，UI 照常用（画布留着会画成白块）
      canvas.current.style.display = 'none'
      console.warn('[axon] water disabled:', error)
    }
    return () => {
      water.current?.dispose()
      water.current = null
    }
  }, [])

  useEffect(() => {
    const host = ripples.current
    if (!host) return
    const onDown = (e: PointerEvent) => {
      water.current?.ripple(e.clientX, e.clientY)
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
      <div className="axon-shade" aria-hidden="true" />
      <div ref={ripples} className="axon-ripples" aria-hidden="true" />
    </>
  )
}
