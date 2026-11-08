/**
 * AXON 粒子场：GPU 粒子云（SDF 塑形的镂空环）+ 光标驱动的 GPU 流体。
 *
 * 结构：
 *   1. 流体：256² 速度场 + 512² 染料，curl → vorticity → divergence → pressure ×5 → subtract → advect
 *   2. 粒子：512²（桌面 262144 点）位置贴图做 ping-pong，每帧回写一次
 *   3. 渲染：Points + 加色混合，位置顶点着色器里从贴图取值
 */
import * as THREE from 'three'

/* ───────────────────────── 公共 GLSL ───────────────────────── */

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
varying vec2 vL, vR, vT, vB;
uniform vec2 uTexel;
void main() {
  vUv = uv;
  vL = uv - vec2(uTexel.x, 0.0);
  vR = uv + vec2(uTexel.x, 0.0);
  vT = uv + vec2(0.0, uTexel.y);
  vB = uv - vec2(0.0, uTexel.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/* 形状：把深度轴镜像 + 四元数旋转后，一条被弯折、拧过的环 */
const SDF = /* glsl */ `
vec3 qrot(vec3 v, vec4 q) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdfShape(vec3 p) {
  // 前后对称，中间留一道软缝
  p.z = sqrt(p.z * p.z + 0.0215) - sqrt(0.012);
  p = qrot(p, normalize(vec4(0.5, 0.5, 0.5, 0.5)));
  if (length(p) > 0.8) return length(p) - 0.7;

  // 沿 y 弯折
  float a = p.y * 1.35;
  float ca = cos(a), sa = sin(a);
  vec3 q = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);

  // 顺着环再拧一下
  float tw = q.y * 2.1;
  float ct = cos(tw), st = sin(tw);
  q.xz = vec2(ct * q.x - st * q.z, st * q.x + ct * q.z);

  float d = sdTorus(q, vec2(0.40, 0.155));

  // 几处柔软的凸起，让它不像一个几何体
  d += 0.032 * sin(q.x * 6.0) * cos(q.y * 5.0) * sin(q.z * 6.0);
  d += 0.018 * cos(q.y * 9.0 + q.x * 3.0);
  return d;
}

vec3 sdfNormal(vec3 p) {
  const float e = 0.001;
  return normalize(vec3(
    sdfShape(p + vec3(e, 0.0, 0.0)) - sdfShape(p - vec3(e, 0.0, 0.0)),
    sdfShape(p + vec3(0.0, e, 0.0)) - sdfShape(p - vec3(0.0, e, 0.0)),
    sdfShape(p + vec3(0.0, 0.0, e)) - sdfShape(p - vec3(0.0, 0.0, e))
  ));
}

/* 三个正弦势的解析 curl */
vec3 potential(vec3 p) {
  return vec3(
    sin(p.y * 1.3 + 0.3) * cos(p.z * 1.1 + 1.7),
    sin(p.z * 1.7 + 1.7) * cos(p.x * 1.2 + 0.4),
    sin(p.x * 1.5 + 4.1) * cos(p.y * 1.4 + 2.2)
  );
}

vec3 curlNoise(vec3 p) {
  const float e = 0.05;
  vec3 dx = vec3(e, 0.0, 0.0), dy = vec3(0.0, e, 0.0), dz = vec3(0.0, 0.0, e);
  vec3 px0 = potential(p - dx), px1 = potential(p + dx);
  vec3 py0 = potential(p - dy), py1 = potential(p + dy);
  vec3 pz0 = potential(p - dz), pz1 = potential(p + dz);
  vec3 c = vec3(
    (pz1.y - pz0.y) - (py1.z - py0.z),
    (px1.z - px0.z) - (pz1.x - pz0.x),
    (py1.x - py0.x) - (px1.y - px0.y)
  );
  return normalize(c / (2.0 * e));
}
`

/* ───────────────────────── 流体 ───────────────────────── */

const FLUID = {
  sim: 256,
  dye: 512,
  velocityDissipation: 0.98,
  densityDissipation: 0.97,
  pressureDissipation: 0.95,
  pressureIterations: 5,
  curl: 30,
  dt: 1 / 60,
}

/* 全屏 pass 的片元着色器都得自己声明一遍 varying */
const QUAD_FS_HEAD = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vL, vR, vT, vB;
`

const FS_CURL = /* glsl */ `
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}
`

const FS_VORTICITY = /* glsl */ `
uniform sampler2D uVelocity, uCurl;
uniform float uCurlValue, dt;
void main() {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlValue * C;
  force.y *= -1.0;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy + force * dt, 0.0, 1.0);
}
`

const FS_DIVERGENCE = /* glsl */ `
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`

const FS_PRESSURE = /* glsl */ `
uniform sampler2D uPressure, uDivergence;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}
`

const FS_GRADIENT = /* glsl */ `
uniform sampler2D uPressure, uVelocity;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`

const FS_ADVECT = /* glsl */ `
uniform sampler2D uVelocity, uSource;
uniform float dt, uDissipation;
uniform vec2 uTexel;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * uTexel;
  vec4 result = uDissipation * texture2D(uSource, coord);
  result.a = 1.0;
  gl_FragColor = result;
}
`

const FS_SPLAT = /* glsl */ `
uniform sampler2D uTarget;
uniform float uAspect, uRadius;
uniform vec3 uColor;
uniform vec2 uPoint;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
}
`

const FS_CLEAR = /* glsl */ `
uniform sampler2D uTexture;
uniform float uValue;
void main() { gl_FragColor = uValue * texture2D(uTexture, vUv); }
`

/* ───────────────────────── 粒子 ───────────────────────── */

const SIM_FS = /* glsl */ `
precision highp float;
uniform sampler2D uPos, uOrigin, uVel, uDen;
uniform float uTime, uHZ;
uniform mat4 uModelMat, uProjView;
uniform mat3 uCamRot;
varying vec2 vUv;

${SDF}

void main() {
  vec3 pos = texture2D(uPos, vUv).xyz;
  if (length(pos) > 0.7) pos /= 2.0;

  pos += curlNoise(pos * 0.1 + uTime * 0.05) * 0.0002 * uHZ;

  // 先算屏幕上这一点的流体密度：被搅过的地方先松开形状束缚，粒子才跟得上水流
  vec4 clip0 = uProjView * uModelMat * vec4(pos, 1.0);
  vec2 uv0 = clip0.xy / max(clip0.w, 0.0001) * 0.5 + 0.5;
  float wet = min(texture2D(uDen, uv0).r, 1.0);

  vec3 grad = sdfNormal(pos);
  float d = sdfShape(pos);
  pos += cross(normalize(pos), normalize(grad)) * 0.0005;
  pos += -grad * d * 0.5 * (1.0 - 0.75 * wet);

  vec3 origin = texture2D(uOrigin, vUv).xyz;
  pos += (origin - pos) * 0.0002 * uHZ;

  // 光标流体：把屏幕空间的速度转回世界方向
  vec4 clip = uProjView * uModelMat * vec4(pos, 1.0);
  vec2 uv = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
  // 速度/密度都要封顶：叠加式 splat 在连划几下之后会累积到几万，粒子会被甩出形状
  vec2 vel = clamp(texture2D(uVel, uv).xy, -260.0, 260.0);
  pos += (uCamRot * vec3(vel, 0.0)) * 0.0001 * uHZ * 0.4 * wet * 6.0;

  // 出了 0.75 就按半径拉回来，保证任何时候都能被环重新吸住（否则会掉到外面的球面上回不来）
  float r = length(pos);
  if (r > 0.75) pos *= 0.75 / r;

  gl_FragColor = vec4(pos, 1.0);
}
`

const POINTS_VS = /* glsl */ `
uniform sampler2D uPos;
uniform float uDpr;
uniform float uRipTime;
uniform float uAspect;
uniform vec3 uHit[3];          // xy = 点击的屏幕 uv，z = 发生时刻
attribute vec4 aRandom;
varying vec4 vRandom;
varying float vScale;
varying float vRip;

void main() {
  vec3 p = texture2D(uPos, position.xy).xyz;
  vRandom = aRandom;
  p *= mix(1.0, 1.5, pow(aRandom.y, 150.0));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.1);
  vScale = smoothstep(3.0, 15.0, dist) * mix(0.5, 1.0, aRandom.z);

  vec4 clip = projectionMatrix * mv;

  /* 点击涟漪：不落纹理、不进位置贴图，纯按「落点 + 时间」现算。
     粒子只在环上有，纹波得自己去扫过每一个点，不能靠波场从洞里传过去。 */
  vec2 suv = clip.xy / max(abs(clip.w), 0.0001) * 0.5 + 0.5;
  vec2 asp = vec2(uAspect, 1.0);
  float wave = 0.0;

  for (int i = 0; i < 3; i++) {
    float age = uRipTime - uHit[i].z;
    if (age > 0.0 && age < 3.0) {
      vec2 d2 = (suv - uHit[i].xy) * asp;
      float d = length(d2);
      float x = d - age * 0.34;                       // 离波前还有多远
      float env = exp(-x * x * 300.0) * exp(-age * 1.15) * (1.0 - smoothstep(2.4, 3.0, age));
      wave += sin(x * 92.0) * env;
    }
  }

  vRip = clamp(wave, -1.0, 1.0);
  // 不做几何位移：粒子是 3D 表面，屏幕方向一推边缘就折成硬角。
  // 水波本来也主要是明暗，交给片元去表达。

  gl_PointSize = clamp(
    0.036 * uDpr * 2.0 * vScale * (1000.0 / dist) * (1.0 + vRip * 0.22),
    0.0, 14.0
  );
  gl_Position = clip;
}
`

const POINTS_FS = /* glsl */ `
uniform sampler2D uMatcap;
uniform float uTime, uReveal;
varying vec4 vRandom;
varying float vScale;
varying float vRip;

float softLight(float b, float s) { return (1.0 - 2.0 * s) * b * b + 2.0 * s * b; }
float overlay(float b, float s) { return b < 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s); }

void main() {
  if (vScale < 0.1) discard;
  vec2 uv = gl_PointCoord - 0.5;
  if (dot(uv, uv) > 0.25) discard;

  float g = mix(0.0, 0.16, vRandom.x);
  vec3 col = vec3(g);
  col = mix(col, vec3(0.6, 0.45, 1.0), pow(vRandom.z, 100.0));

  float sparkle = 0.5 + (0.4 + sin(uTime * 4.0 + vRandom.y * 20.0)) * pow(vRandom.z, 10.0) * 2.5;
  col *= sparkle;

  float a = sin(uTime + vRandom.z * 20.0) * 0.5 + 1.0;
  float ca = cos(a), sa = sin(a);
  vec2 muv = vec2(ca * uv.x - sa * uv.y, sa * uv.x + ca * uv.y) + 0.5;
  vec3 mat = texture2D(uMatcap, muv).rgb;

  col = mix(col, vec3(softLight(col.r, mat.r), softLight(col.g, mat.g), softLight(col.b, mat.b)), 0.8);
  col = mix(col, vec3(overlay(col.r, mat.r), overlay(col.g, mat.g), overlay(col.b, mat.b)), 0.2);

  // 波脊提亮、波谷压暗：涟漪才有「水面反光」的样子
  col *= clamp(1.0 + vRip * 2.4, 0.3, 3.0);

  gl_FragColor = vec4(col * 0.85 * uReveal, 1.0);
}
`

/* ───────────────────────── 工具 ───────────────────────── */

/** 64×64 的柔光球 matcap：左上打光，边缘暗下去 */
function matcapTexture() {
  const S = 64
  const data = new Uint8Array(S * S * 4)
  const L = [(-0.42), 0.55, 0.72]
  const len = Math.hypot(L[0], L[1], L[2])
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = ((x + 0.5) / S) * 2 - 1
      const ny = 1 - ((y + 0.5) / S) * 2
      const r2 = nx * nx + ny * ny
      const i = (y * S + x) * 4
      if (r2 >= 1) {
        data[i] = data[i + 1] = data[i + 2] = 0
        data[i + 3] = 255
        continue
      }
      const nz = Math.sqrt(1 - r2)
      const diff = Math.max((nx * L[0] + ny * L[1] + nz * L[2]) / len, 0)
      // 半朗伯 + 一点上缘高光，边缘压暗
      const shade = 0.16 + 0.84 * Math.pow(diff, 0.85)
      const gloss = Math.pow(diff, 26) * 0.5
      const edge = 1 - Math.pow(r2, 3) * 0.55
      const v = Math.min(255, Math.round((shade * edge + gloss) * 255))
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const mapRange = (v: number, a: number, b: number, c: number, d: number) => c + ((clamp(v, a, b) - a) / (b - a)) * (d - c)

/* ───────────────────────── 主类 ───────────────────────── */

export interface FieldHandle {
  dispose(): void
}

export function createField(canvas: HTMLCanvasElement): FieldHandle {
  const coarse = matchMedia('(pointer: coarse)').matches
  // 触屏 16k 点；桌面 262k，核数少的机器降到 65k，别让后台编辑卡在这个背景上
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4
  const RES = coarse ? 128 : weak ? 256 : 512
  const COUNT = RES * RES

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 1)
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.autoClear = false

  const canFloat = renderer.extensions.has('EXT_color_buffer_float')
  const posType = canFloat ? THREE.FloatType : THREE.HalfFloatType
  const simType = THREE.HalfFloatType

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000)
  const BASE = new THREE.Vector3(-1.17, 0, 6)
  camera.position.copy(BASE)
  camera.lookAt(0, 0, 0)

  const scene = new THREE.Scene()

  /* 全屏 pass 用的四边形 */
  const quadScene = new THREE.Scene()
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
  quad.frustumCulled = false
  quadScene.add(quad)

  const materials: THREE.ShaderMaterial[] = []
  const targets: THREE.WebGLRenderTarget[] = []

  const makeMat = (fs: string, uniforms: Record<string, THREE.IUniform>) => {
    const m = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false })
    materials.push(m)
    return m
  }
  const makeQuadMat = (fs: string, uniforms: Record<string, THREE.IUniform>) => makeMat(QUAD_FS_HEAD + fs, uniforms)

  const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = mat
    renderer.setRenderTarget(target)
    renderer.render(quadScene, quadCam)
  }

  /* ── 流体 target ── */
  const makeRT = (size: number, type: THREE.TextureDataType) => {
    const rt = new THREE.WebGLRenderTarget(size, size, {
      type,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    })
    targets.push(rt)
    return rt
  }
  const makePair = (size: number, type: THREE.TextureDataType) => {
    const a = makeRT(size, type)
    const b = makeRT(size, type)
    return {
      read: a,
      write: b,
      swap() {
        const t = this.read
        this.read = this.write
        this.write = t
      },
    }
  }

  const velocity = makePair(FLUID.sim, simType)
  const density = makePair(FLUID.dye, simType)
  const pressure = makePair(FLUID.sim, simType)
  const divergence = makeRT(FLUID.sim, simType)
  const curl = makeRT(FLUID.sim, simType)

  const simTexel = new THREE.Vector2(1 / FLUID.sim, 1 / FLUID.sim)

  const matCurl = makeQuadMat(FS_CURL, { uVelocity: { value: null }, uTexel: { value: simTexel } })
  const matVorticity = makeQuadMat(FS_VORTICITY, {
    uVelocity: { value: null }, uCurl: { value: null }, uTexel: { value: simTexel },
    uCurlValue: { value: FLUID.curl }, dt: { value: FLUID.dt },
  })
  const matDivergence = makeQuadMat(FS_DIVERGENCE, { uVelocity: { value: null }, uTexel: { value: simTexel } })
  const matPressure = makeQuadMat(FS_PRESSURE, {
    uPressure: { value: null }, uDivergence: { value: null }, uTexel: { value: simTexel },
  })
  const matClear = makeQuadMat(FS_CLEAR, { uTexture: { value: null }, uValue: { value: FLUID.pressureDissipation } })
  const matGradient = makeQuadMat(FS_GRADIENT, {
    uPressure: { value: null }, uVelocity: { value: null }, uTexel: { value: simTexel },
  })
  const matAdvect = makeQuadMat(FS_ADVECT, {
    uVelocity: { value: null }, uSource: { value: null }, uTexel: { value: simTexel },
    dt: { value: FLUID.dt }, uDissipation: { value: FLUID.velocityDissipation },
  })
  const matSplat = makeQuadMat(FS_SPLAT, {
    uTarget: { value: null }, uAspect: { value: 1 }, uColor: { value: new THREE.Vector3() },
    uPoint: { value: new THREE.Vector2() }, uRadius: { value: 0.25 },
  })


  const fluidAspect = () => window.innerWidth / window.innerHeight

  const splat = (
    pair: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget; swap(): void },
    x: number, y: number, radius: number, color: THREE.Vector3,
  ) => {
    matSplat.uniforms.uTarget.value = pair.read.texture
    matSplat.uniforms.uAspect.value = fluidAspect()
    matSplat.uniforms.uPoint.value.set(x, y)
    matSplat.uniforms.uRadius.value = radius
    matSplat.uniforms.uColor.value.copy(color)
    pass(matSplat, pair.write)
    pair.swap()
  }

  /* ── 点击涟漪：只留最近三次落点，其余全交给顶点着色器现算 ── */
  const hits = [0, 1, 2].map(() => new THREE.Vector3(0, 0, -999))
  let hitCursor = 0
  const addHit = (x: number, y: number) => {
    hits[hitCursor % hits.length].set(x, y, elapsed)
    hitCursor++
  }

  /* ── 粒子：位置 / 原点贴图 ── */
  const posData = new Float32Array(COUNT * 4)
  const originData = new Float32Array(COUNT * 4)
  const randoms = new Float32Array(COUNT * 4)
  const verts = new Float32Array(COUNT * 3)

  for (let i = 0; i < COUNT; i++) {
    const ox = Math.random() * 2 - 1
    const oy = Math.random() * 2 - 1
    const oz = Math.random() * 2 - 1
    originData[i * 4] = ox
    originData[i * 4 + 1] = oy
    originData[i * 4 + 2] = oz
    originData[i * 4 + 3] = 1
    posData[i * 4] = ox
    posData[i * 4 + 1] = oy
    posData[i * 4 + 2] = oz
    posData[i * 4 + 3] = 1

    randoms[i * 4] = Math.random()
    randoms[i * 4 + 1] = Math.random()
    randoms[i * 4 + 2] = Math.random()
    randoms[i * 4 + 3] = Math.random()

    const px = i % RES
    const py = (i / RES) | 0
    verts[i * 3] = (px + 0.5) / RES
    verts[i * 3 + 1] = (py + 0.5) / RES
    verts[i * 3 + 2] = 0
  }

  const posRTs = (() => {
    const make = () => {
      const tex = new THREE.DataTexture(posData, RES, RES, THREE.RGBAFormat, posType)
      tex.minFilter = THREE.NearestFilter
      tex.magFilter = THREE.NearestFilter
      tex.needsUpdate = true
      const rt = new THREE.WebGLRenderTarget(RES, RES, {
        type: posType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
      })
      targets.push(rt)
      // 首帧把初始位置烘进去
      const bake = makeQuadMat(FS_CLEAR, { uTexture: { value: tex }, uValue: { value: 1 } })
      pass(bake, rt)
      return rt
    }
    const a = make()
    const b = make()
    return {
      read: a,
      write: b,
      swap() {
        const t = this.read
        this.read = this.write
        this.write = t
      },
    }
  })()

  const originTex = new THREE.DataTexture(originData, RES, RES, THREE.RGBAFormat, THREE.FloatType)
  originTex.minFilter = THREE.NearestFilter
  originTex.magFilter = THREE.NearestFilter
  originTex.needsUpdate = true

  const matSim = makeMat(SIM_FS, {
    uPos: { value: null },
    uOrigin: { value: originTex },
    uVel: { value: null },
    uDen: { value: null },
    uTime: { value: 0 },
    uHZ: { value: 1 },
    uModelMat: { value: new THREE.Matrix4() },
    uProjView: { value: new THREE.Matrix4() },
    uCamRot: { value: new THREE.Matrix3() },
  })
  matSim.depthTest = false

  /* ── 粒子主体 ── */
  const group = new THREE.Group()
  group.position.set(0.343, 0.16, -1)
  group.rotation.set(
    THREE.MathUtils.degToRad(-28.4),
    THREE.MathUtils.degToRad(390),
    THREE.MathUtils.degToRad(4.92),
  )
  group.scale.set(5, 5, 6)
  scene.add(group)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 4))

  const matcap = matcapTexture()
  const matPoints = new THREE.ShaderMaterial({
    vertexShader: POINTS_VS,
    fragmentShader: POINTS_FS,
    uniforms: {
      uPos: { value: posRTs.read.texture },
      uHit: { value: hits },
      uRipTime: { value: 0 },
      uAspect: { value: 1 },
      uDpr: { value: Math.min(window.devicePixelRatio, 2) },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uMatcap: { value: matcap },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  })
  materials.push(matPoints)

  const points = new THREE.Points(geo, matPoints)
  points.frustumCulled = false
  group.add(points)

  /* ── 尺寸 ── */
  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    matPoints.uniforms.uDpr.value = Math.min(window.devicePixelRatio, 2)
  }
  resize()
  window.addEventListener('resize', resize)

  /* ── 指针 → 流体 ── */
  const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false, last: 0 }
  const look = { x: 0, y: 0 }
  const tmpColor = new THREE.Vector3()

  const onMove = (cx: number, cy: number) => {
    const x = cx / window.innerWidth
    const y = 1 - cy / window.innerHeight
    look.x = (x * 2 - 1)
    look.y = ((1 - y) * 2 - 1)
    pointer.x = x
    pointer.y = y
    pointer.moved = true
  }

  const onPointerMove = (e: PointerEvent) => onMove(e.clientX, e.clientY)
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0]
    if (t) onMove(t.clientX, t.clientY)
  }
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    onMove(t.clientX, t.clientY)
    pointer.px = pointer.x
    pointer.py = pointer.y
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: true })

  // 点击 = 往水面按一下；点按钮也一样，落在哪儿就在哪儿起一圈
  const onPointerDown = (e: PointerEvent) => {
    addHit(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight)
  }
  window.addEventListener('pointerdown', onPointerDown, { passive: true })

  const applyPointer = (now: number) => {
    if (!pointer.moved) return pointer.px = pointer.x, pointer.py = pointer.y
    const dx = (pointer.x - pointer.px) * window.innerWidth
    const dy = (pointer.y - pointer.py) * window.innerHeight
    const len = Math.hypot(dx, dy)
    if (len > 0.01) {
      const mult = mapRange(len, 0, 15, 0, 10)
      let radius = mapRange(len, 0, 5, 0, 60) * 0.6 * (coarse ? 0.8 : 1)
      radius = Math.max(radius, 0.6)
      const startX = now - pointer.last > 50 ? pointer.x : pointer.px
      const startY = now - pointer.last > 50 ? pointer.y : pointer.py
      const steps = Math.max(1, Math.min(6, Math.ceil(len / 18)))
      const uvRadius = Math.pow(radius / 200, 2) * 4

      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const sx = startX + (pointer.x - startX) * t
        const sy = startY + (pointer.y - startY) * t
        tmpColor.set((dx * mult * 0.06) / steps, (-dy * mult * 0.06) / steps, 1)
        splat(velocity, sx, sy, uvRadius, tmpColor)
        tmpColor.set(0.055 / steps, 0.055 / steps, 0.06 / steps)
        splat(density, sx, sy, uvRadius * 0.9, tmpColor)
      }
      pointer.last = now
    }
    pointer.px = pointer.x
    pointer.py = pointer.y
    pointer.moved = false
  }

  /* ── 每帧 ── */
  const clock = new THREE.Clock()
  let raf = 0
  let elapsed = 0

  const stepFluid = () => {
    matCurl.uniforms.uVelocity.value = velocity.read.texture
    pass(matCurl, curl)

    matVorticity.uniforms.uVelocity.value = velocity.read.texture
    matVorticity.uniforms.uCurl.value = curl.texture
    pass(matVorticity, velocity.write)
    velocity.swap()

    matDivergence.uniforms.uVelocity.value = velocity.read.texture
    pass(matDivergence, divergence)

    matClear.uniforms.uTexture.value = pressure.read.texture
    pass(matClear, pressure.write)
    pressure.swap()

    matPressure.uniforms.uDivergence.value = divergence.texture
    for (let i = 0; i < FLUID.pressureIterations; i++) {
      matPressure.uniforms.uPressure.value = pressure.read.texture
      pass(matPressure, pressure.write)
      pressure.swap()
    }

    matGradient.uniforms.uPressure.value = pressure.read.texture
    matGradient.uniforms.uVelocity.value = velocity.read.texture
    pass(matGradient, velocity.write)
    velocity.swap()

    // 速度平流
    matAdvect.uniforms.uTexel.value = simTexel
    matAdvect.uniforms.uDissipation.value = FLUID.velocityDissipation
    matAdvect.uniforms.uVelocity.value = velocity.read.texture
    matAdvect.uniforms.uSource.value = velocity.read.texture
    pass(matAdvect, velocity.write)
    velocity.swap()

    // 染料平流
    matAdvect.uniforms.uTexel.value = new THREE.Vector2(1 / FLUID.dye, 1 / FLUID.dye)
    matAdvect.uniforms.uDissipation.value = FLUID.densityDissipation
    matAdvect.uniforms.uVelocity.value = velocity.read.texture
    matAdvect.uniforms.uSource.value = density.read.texture
    pass(matAdvect, density.write)
    density.swap()
  }

  const stepParticles = (dt: number) => {
    matSim.uniforms.uPos.value = posRTs.read.texture
    matSim.uniforms.uVel.value = velocity.read.texture
    matSim.uniforms.uDen.value = density.read.texture
    matSim.uniforms.uTime.value = elapsed
    matSim.uniforms.uHZ.value = Math.min(Math.max(dt * 60, 0.2), 1.5)
    matSim.uniforms.uModelMat.value = group.matrixWorld
    pass(matSim, posRTs.write)
    posRTs.swap()
    matPoints.uniforms.uPos.value = posRTs.read.texture
  }

  const gaze = new THREE.Vector3()
  const frame = () => {
    raf = requestAnimationFrame(frame)
    if (document.hidden) return
    const dt = Math.min(clock.getDelta(), 1 / 30)
    elapsed += dt

    applyPointer(performance.now())

    // 相机随光标轻移
    // 后台要能点得动：相机只轻轻跟着走（原值 ±1 / ±2 幅度太大，鼠标一动画面就甩）
    gaze.set(BASE.x + look.x * -0.45, BASE.y + look.y * 0.7, BASE.z)
    // 阻尼跟着帧间隔走：掉帧的机器上也是同样的跟随速度
    camera.position.lerp(gaze, 1 - Math.pow(0.95, dt * 60))
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    group.updateMatrixWorld()

    matSim.uniforms.uProjView.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    matSim.uniforms.uCamRot.value.setFromMatrix4(camera.matrixWorld)

    stepFluid()
    stepParticles(dt)

    matPoints.uniforms.uRipTime.value = elapsed
    matPoints.uniforms.uAspect.value = camera.aspect

    matPoints.uniforms.uTime.value = elapsed
    matPoints.uniforms.uReveal.value = Math.min(1, Math.max(0, (elapsed - 0.35) / 1.6))
    renderer.setRenderTarget(null)
    renderer.clear()
    renderer.render(scene, camera)
  }
  frame()

  return {
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      geo.dispose()
      materials.forEach((m) => m.dispose())
      targets.forEach((t) => t.dispose())
      matcap.dispose()
      originTex.dispose()
      renderer.dispose()
    },
  }
}
