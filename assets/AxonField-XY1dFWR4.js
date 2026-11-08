import{n as e,r as t,t as n}from"./index-Y-3SIgGK.js";var r=t(e(),1),i=`
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`,a=`
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
`;function o(e,t,n){let r=e.createShader(t);if(!r)throw Error(`shader alloc failed`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`shader: ${t}`)}return r}function s(e,t){let n={alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:`low-power`,preserveDrawingBuffer:!1},r=e.getContext(`webgl`,n)||e.getContext(`experimental-webgl`,n);if(!r)throw Error(`no webgl`);let s=r.createProgram();if(!s)throw Error(`program alloc failed`);let c=o(r,r.VERTEX_SHADER,i),l=o(r,r.FRAGMENT_SHADER,a);if(r.attachShader(s,c),r.attachShader(s,l),r.linkProgram(s),!r.getProgramParameter(s,r.LINK_STATUS))throw Error(`link: ${r.getProgramInfoLog(s)}`);r.useProgram(s);let u=r.createBuffer();r.bindBuffer(r.ARRAY_BUFFER,u),r.bufferData(r.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),r.STATIC_DRAW);let d=r.getAttribLocation(s,`aPos`);r.enableVertexAttribArray(d),r.vertexAttribPointer(d,2,r.FLOAT,!1,0,0);let f=r.getUniformLocation(s,`uTex`),p=r.getUniformLocation(s,`uTexRes`),m=r.getUniformLocation(s,`uRes`),h=r.getUniformLocation(s,`uTime`),g=r.getUniformLocation(s,`uHit`),_=r.getUniformLocation(s,`uLoaded`),v=r.createTexture();r.bindTexture(r.TEXTURE_2D,v),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texImage2D(r.TEXTURE_2D,0,r.RGB,1,1,0,r.RGB,r.UNSIGNED_BYTE,new Uint8Array([1,14,17])),r.uniform1i(f,0);let y=1,b=1,x=0,S=!1,C=new Image;C.decoding=`async`,C.onload=()=>{S||(r.bindTexture(r.TEXTURE_2D,v),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,1),r.texImage2D(r.TEXTURE_2D,0,r.RGB,r.RGB,r.UNSIGNED_BYTE,C),y=C.naturalWidth||1,b=C.naturalHeight||1,x=1,k=-1)},C.src=t;let w=new Float32Array(16).fill(0);for(let e=0;e<4;e++)w[e*4+3]=-1;let T=0,E=0,D=0,O=0,k=0,A=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,j=()=>{let t=Math.min(window.devicePixelRatio||1,2),n=e.clientWidth||window.innerWidth,i=e.clientHeight||window.innerHeight,a=t*.9,o=26e5;n*i*a*a>o&&(a=Math.sqrt(o/(n*i))),e.width=Math.max(2,Math.round(n*a)),e.height=Math.max(2,Math.round(i*a)),r.viewport(0,0,e.width,e.height),k=-1},M=()=>{r.uniform2f(m,e.width,e.height),r.uniform2f(p,y,b),r.uniform1f(h,E),r.uniform1f(_,x),r.uniform4fv(g,w),r.drawArrays(r.TRIANGLES,0,3)},N=e=>{if(S)return;D=requestAnimationFrame(N);let t=O?Math.min((e-O)/1e3,.05):.016;if(O=e,A){if(k>0)return}else E+=t;M(),k++},P=()=>{j(),A&&M()},F=()=>{document.hidden?(cancelAnimationFrame(D),D=0):!A&&!S&&!D&&(O=0,D=requestAnimationFrame(N))};return j(),A?(M(),k=1):D=requestAnimationFrame(N),window.addEventListener(`resize`,P),document.addEventListener(`visibilitychange`,F),{ripple(t,n){if(S)return;let r=e.getBoundingClientRect();r.width&&r.height&&(w[T*4]=(t-r.left)/r.width,w[T*4+1]=1-(n-r.top)/r.height,w[T*4+2]=E,w[T*4+3]=1,T=(T+1)%4)},dispose(){S=!0,cancelAnimationFrame(D),window.removeEventListener(`resize`,P),document.removeEventListener(`visibilitychange`,F),C.onload=null,r.deleteTexture(v),r.deleteBuffer(u),r.deleteProgram(s),r.deleteShader(c),r.deleteShader(l)}}}var c=new URL(`loading-pond-ueYYywd3.webp`,import.meta.url).href,l=n();function u(){let e=(0,r.useRef)(null),t=(0,r.useRef)(null),n=(0,r.useRef)(null);return(0,r.useEffect)(()=>{if(e.current){try{n.current=s(e.current,c)}catch(t){e.current.style.display=`none`,console.warn(`[axon] water disabled:`,t)}return()=>{n.current?.dispose(),n.current=null}}},[]),(0,r.useEffect)(()=>{let e=t.current;if(!e)return;let r=t=>{n.current?.ripple(t.clientX,t.clientY);for(let n of[0,120]){let r=document.createElement(`i`);r.style.left=`${t.clientX}px`,r.style.top=`${t.clientY}px`,n&&(r.style.animationDelay=`${n}ms`),e.appendChild(r),r.addEventListener(`animationend`,()=>r.remove(),{once:!0})}for(;e.childElementCount>8;)e.firstElementChild?.remove()};return window.addEventListener(`pointerdown`,r,{passive:!0}),()=>window.removeEventListener(`pointerdown`,r)},[]),(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(`canvas`,{ref:e,className:`axon-bg`,"aria-hidden":`true`}),(0,l.jsx)(`div`,{className:`axon-shade`,"aria-hidden":`true`}),(0,l.jsx)(`div`,{ref:t,className:`axon-ripples`,"aria-hidden":`true`})]})}export{u as default};