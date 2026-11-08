/**
 * 水面：一块全屏的 WebGL 片元着色器。
 *
 * 参考视频里的水「像」，靠的不是程序化噪声 —— 噪声再怎么调，出来都是一张
 * 等高线图。真正的解法是拿一张真实的荷塘照片当底，再让着色器做两件事：
 *
 *   1. 折射扭曲 —— 用噪声法线去掰采样坐标，照片里本来静止的水纹就活起来；
 *   2. 色阶映射 —— 只取照片的亮度，重新映射到参考视频那三档青绿上
 *      （深处 rgb(0,40,46)、中间调 rgb(28,104,101)、浪尖近白）。
 *      这样照片原本的黄花、黄叶不会闯进画面，而水波的结构、落在水上的
 *      白花瓣、细碎的焦散全都留着。
 *
 * 点击的波纹不写进任何贴图，只留最近四次落点的坐标和时刻，在着色器里现算：
 * 连点不会累积、不会漂移，页面挂一天也不会糊。
 */
const VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uTexRes;
uniform float uTime;
uniform float uLoaded;
uniform vec4 uHit[4];   // xy = 落点（uv，y 向上），z = 起波时刻，负值 = 空槽

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float field(vec2 p) {
  return vnoise(p) * 0.60 + vnoise(p * 2.03 + 17.3) * 0.40;
}

/* 参考视频的四档水色：最深 → 中间调 → 亮面 → 浪尖。
   档位是按参考帧的亮度分布定的，不是随手挑的：
   参考帧 p50 只有 46/255（很暗），亮的地方全集中在浪脊和花瓣上 */
vec3 waterRamp(float l) {
  vec3 c0 = vec3(0.008, 0.072, 0.084);   // #021215
  vec3 c1 = vec3(0.030, 0.180, 0.180);   // #082e2e
  vec3 c2 = vec3(0.110, 0.410, 0.400);   // #1c6866
  vec3 c3 = vec3(0.560, 0.900, 0.850);
  vec3 col = mix(c0, c1, smoothstep(0.0, 0.28, l));
  col = mix(col, c2, smoothstep(0.26, 0.62, l));
  return mix(col, c3, smoothstep(0.60, 1.0, l));
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = uTime;

  /* 两股方向不同的水流，叠在一起就不会看出「整体在平移」 */
  vec2 f1 = vec2(t * 0.019, t * 0.010);
  vec2 f2 = vec2(-t * 0.012, t * 0.016);

  /* 折射用的法线：中频噪声的有限差分 */
  vec2 bp = p * 4.2 + f2 + 3.7;
  const float e = 0.02;
  vec2 g = vec2(
    field(bp + vec2(e, 0.0)) - field(bp - vec2(e, 0.0)),
    field(bp + vec2(0.0, e)) - field(bp - vec2(0.0, e))
  ) / (2.0 * e);

  /* 波纹：四次落点，各自一圈同心波往外跑 */
  float rh = 0.0;
  float rings = 0.0;
  vec2 rg = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 hit = uHit[i];
    float age = t - hit.z;
    if (hit.z < 0.0 || age < 0.0 || age > 3.4) continue;

    vec2 d = (uv - hit.xy) * vec2(aspect, 1.0);
    float r = length(d) + 0.0001;
    // 正中心那一小块收住：不然几十道环挤在一个点，会烧成一个亮疙瘩
    float guard = smoothstep(0.035, 0.14, r);
    float x = r - age * 0.21;
    float env = exp(-x * x * 62.0)           // 只有一个波包在跑，不是整片荡开
              * exp(-age * 0.58)             // 越远越弱
              * (1.0 - smoothstep(2.6, 3.4, age));
    float ph = x * 74.0;
    rh += sin(ph) * env * guard;
    // |sin| 抬到 6 次方 → 只剩细细的亮弧，那才是同心涟漪的样子；
    // 直接拿 sin 当亮度，出来的是一坨会融化的斑
    rings += pow(abs(sin(ph)), 6.0) * env * guard;
    rg += (d / r) * cos(ph) * 74.0 * env * guard;
  }

  /* 采样坐标：cover 铺满 + 极慢的漂移 + 两股水流 + 波纹位移。
     窗口大小先算出来再卡住 —— 只要它没跑出 [0,1]，就不会采到边上的拉伸糊条，
     上一版那两道横着的拉丝就是这么来的 */
  float texAspect = uTexRes.x / max(uTexRes.y, 1.0);
  vec2 cover = aspect > texAspect
    ? vec2(1.0, texAspect / aspect)
    : vec2(aspect / texAspect, 1.0);

  vec2 duv = g * 0.010 + f1 * 0.05;
  duv += rg * 0.00028;

  vec2 halfWin = min(cover * 0.5 * 1.12, vec2(0.474));
  vec2 tuv = (uv - 0.5) * halfWin * 2.0 + 0.5 + duv;
  tuv = clamp(tuv, vec2(0.001), vec2(0.999));

  vec3 tex = texture2D(uTex, tuv).rgb;
  float raw = dot(tex, vec3(0.299, 0.587, 0.114));

  /* 照片的亮度分布（p5/p50/p95 = 0.18/0.49/0.88）压到参考帧那一档
     （0.10/0.19/0.45）：指数 1.47、增益 0.55 是照这两组数解出来的，
     不是试出来的 —— 所以画面暗下来了，但浪脊的层次还在。 */
  float body = 0.56 * pow(clamp(raw, 0.0, 1.0), 1.68) + 0.015;
  // 照片里那几团天光反射是虚焦的，映射上去就是几块油渍：亮度封顶，
  // 真正的亮交给下面的「波脊」和高光
  body = min(body, 0.34);

  vec3 col = waterRamp(body) * uLoaded;

  /* 波脊：拿同一点跟它旁边一点比，比周围亮的才是浪脊。
     这一项用的是照片本身的水纹，所以亮丝永远落在真实的水波上，
     而不是落在一张随机噪声的等高线上 —— 视频里最抓人的就是这些细亮丝 */
  float rawNear = dot(texture2D(uTex, tuv + vec2(0.0052, 0.0041)).rgb, vec3(0.299, 0.587, 0.114));
  float ridge = clamp((raw - rawNear) * 7.0, 0.0, 1.0);
  // 只让最陡的那几道亮：整面都在闪，就成了一张金属箔
  ridge = smoothstep(0.2, 0.62, ridge);
  col += vec3(0.58, 0.935, 0.875) * ridge * 0.33 * uLoaded;

  /* 高光：波峰朝光的那一面才亮。用扭曲的法线算镜面，不是盖一层白蒙版 */
  vec3 n = normalize(vec3(-g * 0.45, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.5, 0.66, 0.56));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(n, H), 0.0), 96.0);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 2.4);

  col += vec3(1.0, 0.985, 0.945) * spec * 0.45 * uLoaded;
  col += vec3(0.62, 0.95, 0.89) * fres * 0.12 * uLoaded;

  /* 波纹：亮的一半加光，暗的一半压暗，环才有起伏 */
  col += vec3(0.78, 0.99, 0.95) * rings * 0.5;
  col *= 1.0 - max(-rh, 0.0) * 0.18;

  /* 四角压暗：UI 压在上面，边上要沉下去，中间才透 */
  vec2 vd = (uv - 0.5) * vec2(aspect * 0.72, 1.0);
  col *= mix(0.55, 1.0, smoothstep(1.02, 0.18, length(vd)));
  // 底部再沉一点，给页脚与滚动条留出落点
  col *= mix(0.72, 1.0, smoothstep(0.0, 0.32, uv.y));

  // 颗粒：修掉大面积渐变的色阶
  col += (hash21(uv * uRes + fract(t)) - 0.5) * 0.014;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`

export type WaterHandle = {
  dispose(): void
  ripple(x: number, y: number): void
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('shader alloc failed')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader: ${log}`)
  }
  return sh
}

/** 画布铺满整页。失败时抛错，由调用方退回到 CSS 底色。 */
export function createWater(canvas: HTMLCanvasElement, textureUrl: string): WaterHandle {
  const opts: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  }
  const gl = (canvas.getContext('webgl', opts) ||
    canvas.getContext('experimental-webgl', opts)) as WebGLRenderingContext | null
  if (!gl) throw new Error('no webgl')

  const prog = gl.createProgram()
  if (!prog) throw new Error('program alloc failed')
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`link: ${gl.getProgramInfoLog(prog)}`)
  }
  gl.useProgram(prog)

  // 一个三角形铺满裁剪空间，不需要任何几何数据以外的东西
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uTex = gl.getUniformLocation(prog, 'uTex')
  const uTexRes = gl.getUniformLocation(prog, 'uTexRes')
  const uRes = gl.getUniformLocation(prog, 'uRes')
  const uTime = gl.getUniformLocation(prog, 'uTime')
  const uHit = gl.getUniformLocation(prog, 'uHit')
  const uLoaded = gl.getUniformLocation(prog, 'uLoaded')

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  // 先塞一个 1×1 的深青：图没到之前也有底色，不会闪白
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE,
    new Uint8Array([1, 14, 17]),
  )
  gl.uniform1i(uTex, 0)

  let texW = 1
  let texH = 1
  let loaded = 0
  let dead = false

  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    if (dead) return
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
    texW = img.naturalWidth || 1
    texH = img.naturalHeight || 1
    loaded = 1
    drawn = -1
  }
  img.src = textureUrl

  const hits = new Float32Array(16).fill(0)
  for (let i = 0; i < 4; i++) hits[i * 4 + 3] = -1 // z = -1：空槽
  let cursor = 0

  let elapsed = 0
  let raf = 0
  let last = 0
  let drawn = 0

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /** 渲染倍率：水是柔的，按 0.9 倍画再让 CSS 拉满，看不出差别，省一大半像素 */
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = canvas.clientWidth || window.innerWidth
    const cssH = canvas.clientHeight || window.innerHeight
    let scale = dpr * 0.9
    const budget = 2_600_000
    if (cssW * cssH * scale * scale > budget) scale = Math.sqrt(budget / (cssW * cssH))
    canvas.width = Math.max(2, Math.round(cssW * scale))
    canvas.height = Math.max(2, Math.round(cssH * scale))
    gl.viewport(0, 0, canvas.width, canvas.height)
    drawn = -1
  }

  const draw = () => {
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.uniform2f(uTexRes, texW, texH)
    gl.uniform1f(uTime, elapsed)
    gl.uniform1f(uLoaded, loaded)
    gl.uniform4fv(uHit, hits)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const loop = (now: number) => {
    if (dead) return
    raf = requestAnimationFrame(loop)
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
    last = now
    if (reduced) {
      if (drawn > 0) return
    } else {
      elapsed += dt
    }
    draw()
    drawn++
  }

  const onResize = () => {
    resize()
    if (reduced) draw()
  }

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf)
      raf = 0
    } else if (!reduced && !dead && !raf) {
      last = 0
      raf = requestAnimationFrame(loop)
    }
  }

  resize()
  if (reduced) {
    draw()
    drawn = 1
  } else {
    raf = requestAnimationFrame(loop)
  }
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    ripple(cx: number, cy: number) {
      if (dead) return
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      hits[cursor * 4] = (cx - rect.left) / rect.width
      hits[cursor * 4 + 1] = 1 - (cy - rect.top) / rect.height
      hits[cursor * 4 + 2] = elapsed
      hits[cursor * 4 + 3] = 1
      cursor = (cursor + 1) % 4
    },
    dispose() {
      dead = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      img.onload = null
      gl.deleteTexture(tex)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      // 不调 loseContext：StrictMode 会二次挂载，抢掉上下文画布就白了
    },
  }
}
