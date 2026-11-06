import * as THREE from 'three';
import Lenis from 'lenis';
import { Ambient } from './audio.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const small = Math.min(innerWidth, innerHeight) < 700;

/* ------------------------------------------------------------------ */
/* scroll morbido e navigazione                                        */
/* ------------------------------------------------------------------ */
const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
const nav = $('.nav');
const progress = $('#progress');

$$('#menu a, .scroll-hint').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id.startsWith('#')) return;
    e.preventDefault();
    document.body.classList.remove('menu-open');
    lenis.scrollTo(id, { duration: 1.8, offset: -40, easing: (t) => 1 - Math.pow(1 - t, 4) });
  });
});
$('#burger').addEventListener('click', () => document.body.classList.toggle('menu-open'));

// voce di menu attiva
const sections = $$('main section[id]');
const links = new Map($$('#menu a').map((a) => [a.getAttribute('href').slice(1), a]));
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    let id = en.target.id;
    if (id === 'vuoto') id = 'chi';
    if (id === 'squadra') id = 'contatti';
    links.forEach((a) => a.classList.remove('on'));
    links.get(id)?.classList.add('on');
    tone.target = +(en.target.dataset.tone || 0);
  });
}, { rootMargin: '-45% 0px -45% 0px' });
sections.forEach((s) => io.observe(s));

/* ------------------------------------------------------------------ */
/* comparse: titoli parola per parola, blocchi che salgono, numeri     */
/* ------------------------------------------------------------------ */
$$('[data-split]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(' ');
});
const fmt = (v, dec) => v.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
function countUp(el) {
  const to = parseFloat(el.dataset.count);
  const dec = +(el.dataset.dec || 0);
  const plus = el.hasAttribute('data-plus') ? '+' : '';
  const t0 = performance.now();
  const dur = 1600;
  (function step(now) {
    const k = clamp((now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e, dec) + (k === 1 ? plus : '');
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
const reveal = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    $$('[data-count]', en.target).forEach(countUp);
    if (en.target.matches('[data-count]')) countUp(en.target);
    reveal.unobserve(en.target);
  });
}, { rootMargin: '0px 0px -12% 0px' });
$$('[data-r], [data-split]').forEach((el) => reveal.observe(el));

/* ------------------------------------------------------------------ */
/* il futuro: quanto manca, e gli appuntamenti passati si spengono      */
/* ------------------------------------------------------------------ */
const today = new Date(); today.setHours(0, 0, 0, 0);
$$('#upcoming [data-date]').forEach((a) => {
  const d = new Date(a.dataset.date + 'T00:00:00');
  const days = Math.round((d - today) / 86400000);
  const c = $('.count', a);
  if (days < 0) a.classList.add('past');
  else if (days === 0) c.textContent = 'oggi';
  else if (days === 1) c.textContent = 'domani';
  else if (days <= 30) c.textContent = `tra ${days} giorni`;
});

/* ------------------------------------------------------------------ */
/* binario dei format: si trascina                                     */
/* ------------------------------------------------------------------ */
const rail = $('#rail');
let drag = null;
rail.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  drag = { x: e.clientX, s: rail.scrollLeft, v: 0, last: e.clientX };
  rail.classList.add('drag');
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.v = e.clientX - drag.last;
  drag.last = e.clientX;
  rail.scrollLeft = drag.s - (e.clientX - drag.x);
});
addEventListener('pointerup', () => {
  if (!drag) return;
  let v = drag.v;
  drag = null;
  (function glide() {
    v *= 0.94;
    rail.scrollLeft -= v;
    if (Math.abs(v) > 0.4) requestAnimationFrame(glide);
    else rail.classList.remove('drag');
  })();
});
// le carte si inclinano verso il puntatore
$$('.card').forEach((c) => {
  c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(10px)`;
  });
  c.addEventListener('pointerleave', () => { c.style.transform = ''; });
});

/* ------------------------------------------------------------------ */
/* fondo vivo: grani di luce e un alone che cambia colore con la sezione */
/* ------------------------------------------------------------------ */
const canvas = $('#bg');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const TONES = [
  new THREE.Color('#800200'), // rosso Locus
  new THREE.Color('#9a1a06'),
  new THREE.Color('#b8400a'), // verso l'arancio degli eventi
  new THREE.Color('#d0560c'),
];
const tone = { target: 0, value: 0 };
const bgUni = {
  uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
  uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uScroll: { value: 0 },
  uColor: { value: TONES[0].clone() },
};
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: bgUni,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uScroll; uniform vec2 uRes, uMouse; uniform vec3 uColor;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
    void main(){
      vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      vec2 p = vUv * asp;
      // due aloni morbidi: uno segue il puntatore, uno respira lento in alto a destra
      vec2 m = uMouse * asp;
      float g1 = 1.0 - smoothstep(0.0, 0.85, length(p - m));
      vec2 c2 = vec2(0.82, 0.78) * asp + vec2(sin(uTime*0.12), cos(uTime*0.1)) * 0.08;
      float g2 = 1.0 - smoothstep(0.0, 1.1, length(p - c2));
      float n = noise(p * 2.2 + vec2(uTime * 0.04, -uScroll * 0.6));
      vec3 base = vec3(0.078, 0.016, 0.016);
      vec3 col = base + uColor * (g1 * g1 * 0.32 + g2 * g2 * 0.42) * (0.75 + n * 0.5);
      gl_FragColor = vec4(col, 1.0);
    }`,
})));
// grani che salgono piano, e fuggono al passaggio dello scroll
const N = small ? 500 : 1100;
const pg = new THREE.BufferGeometry();
const pp = new Float32Array(N * 3);
const ps = new Float32Array(N);
for (let i = 0; i < N; i++) { pp.set([Math.random() * 2 - 1, Math.random() * 2 - 1, 0], i * 3); ps[i] = Math.random(); }
pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
pg.setAttribute('aSeed', new THREE.BufferAttribute(ps, 1));
const ptUni = { uTime: { value: 0 }, uScroll: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uVel: { value: 0 } };
scene.add(new THREE.Points(pg, new THREE.ShaderMaterial({
  uniforms: ptUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute float aSeed; uniform float uTime, uScroll, uPixel, uVel; varying float vA;
    void main(){
      vec2 p = position.xy;
      p.y = mod(p.y + 1.0 + uTime * (0.006 + aSeed * 0.012) + uScroll * (0.3 + aSeed * 0.9), 2.0) - 1.0;
      p.x += sin(uTime * 0.3 + aSeed * 30.0) * 0.01;
      gl_Position = vec4(p, 0.0, 1.0);
      gl_PointSize = (1.2 + aSeed * 2.6) * uPixel * (1.0 + abs(uVel) * 0.6);
      vA = 0.25 + aSeed * 0.55;
    }`,
  fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.96, 0.85, 0.75) * vA * (1.0 - smoothstep(0.1, 0.5, r)), 1.0); }`,
})));

/* ------------------------------------------------------------------ */
/* immagini in parallasse, cursore, barra di avanzamento               */
/* ------------------------------------------------------------------ */
const parallax = $$('[data-speed]').map((el) => ({ el, img: $('img', el), k: +el.dataset.speed }));
const cursor = $('#cursor');
const cur = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
const mouseUV = new THREE.Vector2(0.5, 0.5);
addEventListener('pointermove', (e) => {
  cur.tx = e.clientX; cur.ty = e.clientY;
  mouseUV.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
});

const clock = new THREE.Clock();
function frame(time) {
  lenis.raf(time);
  const t = clock.getElapsedTime();
  const y = lenis.scroll;
  const lim = lenis.limit || 1;
  progress.style.transform = `scaleX(${(y / lim).toFixed(4)})`;
  nav.classList.toggle('solid', y > 40);

  tone.value = lerp(tone.value, tone.target, 0.03);
  const i0 = Math.floor(tone.value), i1 = Math.min(TONES.length - 1, i0 + 1);
  bgUni.uColor.value.copy(TONES[i0]).lerp(TONES[i1], tone.value - i0);
  bgUni.uTime.value = t;
  bgUni.uMouse.value.lerp(mouseUV, 0.04);
  bgUni.uScroll.value = y / innerHeight;
  ptUni.uTime.value = t;
  ptUni.uScroll.value = y / innerHeight * 0.12;
  ptUni.uVel.value = lerp(ptUni.uVel.value, clamp(lenis.velocity / 40, -1, 1), 0.1);

  for (const p of parallax) {
    const r = p.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    p.img.style.transform = `scale(1.18) translateY(${(c * p.k * 100).toFixed(2)}%)`;
  }

  cur.x = lerp(cur.x, cur.tx, 0.22);
  cur.y = lerp(cur.y, cur.ty, 0.22);
  cursor.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
  cursor.classList.toggle('hot', !!document.querySelector('a:hover, button:hover, .card:hover'));

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  bgUni.uRes.value.set(innerWidth, innerHeight);
});

/* ------------------------------------------------------------------ */
/* ingresso e uscita: velo, e musica che si dissolve                    */
/* ------------------------------------------------------------------ */
const veil = $('#veil');
requestAnimationFrame(() => setTimeout(() => veil.classList.remove('on'), 60));
if (location.hash) {
  const target = location.hash;
  setTimeout(() => lenis.scrollTo(target, { duration: 2.2, offset: -40 }), 700);
}

const audio = new Ambient();
const soundBtn = $('#sound');
const MUTE = new URLSearchParams(location.search).has('muto');
let want = 'on';
try { want = localStorage.getItem('locus-suono') || 'on'; } catch (e) {}
if (MUTE) want = 'off';
// il browser fa partire il suono solo dopo un gesto: al primo tocco o tasto, se era acceso
function firstGesture() {
  removeEventListener('pointerdown', firstGesture);
  removeEventListener('keydown', firstGesture);
  if (want === 'on' && !audio.ctx) { audio.start(); soundBtn.classList.add('on'); }
}
addEventListener('pointerdown', firstGesture);
addEventListener('keydown', firstGesture);
soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!audio.ctx) { want = 'on'; audio.start(); soundBtn.classList.add('on'); }
  else { const m = !audio.muted; audio.setMuted(m); soundBtn.classList.toggle('on', !m); want = m ? 'off' : 'on'; }
  try { localStorage.setItem('locus-suono', want); } catch (er) {}
});
document.addEventListener('visibilitychange', () => audio.duck(document.hidden));
addEventListener('blur', () => audio.duck(true));
addEventListener('focus', () => { if (!document.hidden) audio.duck(false); });

$$('[data-dissolve]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    veil.classList.add('leave', 'on');
    lenis.stop();
    const wait = audio.ctx ? audio.dissolve(3.2) : new Promise((r) => setTimeout(r, 1700));
    wait.then(() => { location.href = a.href; });
  });
});
