import Lenis from 'lenis';
import { FORMATI } from './formati.js';
import { storia } from './storia.js';
import { leggi, inserisci, segnala, indirizzoCopertina, appuntamenti } from './dati.js';
import { dataItaliana } from './testo.js';
import { apriPortaSegreta, PORTA_ATTESA } from './porta-segreta.js';
segnala('chi-siamo', 'arrivo');

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
    menu(false);
    // ogni sezione raggiunta dal menu è un passo della cronologia
    history.replaceState({ ...(history.state || {}), y: scrollY }, '');
    history.pushState({ sec: id }, '', id);
    lenis.scrollTo(id, { duration: 1.8, offset: -40, easing: (t) => 1 - Math.pow(1 - t, 4) });
  });
});
// a menù aperto la pagina sotto resta ferma (sul telefono prima continuava a scorrere sotto la tendina)
function menu(aperto) {
  document.body.classList.toggle('menu-open', aperto);
  document.documentElement.classList.toggle('menu-open', aperto);
  if (aperto) lenis.stop(); else lenis.start();
}
$('#burger').addEventListener('click', () => menu(!document.body.classList.contains('menu-open')));

// voce di menu attiva
const sections = $$('main section[id]');
const links = new Map($$('#menu a').map((a) => [a.getAttribute('href').slice(1), a]));
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    let id = en.target.id;
    if (id === 'squadra' || id === 'instagram') id = 'contatti';
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
/* il futuro: gli appuntamenti in ordine, dal più vicino                */
/* REGOLA (Cristiano, 12/11/2026): il primo è quello che arriva a breve; */
/* quelli già passati spariscono da questa sezione, da soli, ogni giorno.*/
/* Gli appuntamenti senza data (data-date assente) restano in fondo.     */
/* ------------------------------------------------------------------ */
/* Dal 12/11 gli appuntamenti arrivano dal gestionale (scheda Eventi) e dai post di Instagram con una data:  */
/* quelli scritti in chi-siamo.html restano solo come riserva, se l'archivio non risponde.                 */
const today = new Date(); today.setHours(0, 0, 0, 0);
const upcoming = $('#upcoming');
const giorno = (a) => new Date(a.dataset.date + 'T00:00:00');
function ordinaAppuntamenti() {
  const datati = $$('#upcoming [data-date]').filter((a) => {
    if (giorno(a) >= today) return true;
    a.remove(); // passato: fuori dalla sezione
    return false;
  }).sort((x, y) => giorno(x) - giorno(y));
  const senzaData = $$('#upcoming > article:not([data-date])');
  [...datati, ...senzaData].forEach((a) => upcoming.appendChild(a));
  datati.forEach((a) => {
    const days = Math.round((giorno(a) - today) / 86400000);
    const c = $('.count', a);
    if (days === 0) c.textContent = 'oggi';
    else if (days === 1) c.textContent = 'domani';
    else if (days <= 30) c.textContent = `tra ${days} giorni`;
  });
}
ordinaAppuntamenti();
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
appuntamenti().then((elenco) => {
  const vivi = elenco.filter((e) => e.stato === 'visibile' && e.titolo);
  if (!elenco.length) return; // archivio vuoto: restano quelli scritti nella pagina
  upcoming.innerHTML = vivi.map((e) => {
    const d = e.data ? new Date(e.data + 'T00:00:00') : null;
    const [b, s] = d ? [d.getDate(), MESI[d.getMonth()]] : (e.riquadro || 'presto').split(' ');
    return `<article data-r ${d ? `data-date="${e.data}"` : ''}>
      <div class="d"><b>${esc(b)}</b><span>${esc(s || '')}</span></div>
      <div class="t"><p class="when">${esc(e.quando || '')} <em class="count"></em></p><h3>${esc(e.titolo)}</h3>${e.testo ? `<p>${esc(e.testo)}</p>` : ''}
      ${e.link ? `<p><a href="${esc(e.link)}" target="_blank" rel="noopener">Il post su Instagram ↗</a></p>` : ''}</div>
    </article>`;
  }).join('');
  ordinaAppuntamenti();
  $$('#upcoming [data-r]').forEach((a) => reveal.observe(a));
}).catch(() => { /* restano quelli scritti nella pagina */ });

/* ------------------------------------------------------------------ */
/* binario dei format: si trascina                                     */
/* ------------------------------------------------------------------ */
const rail = $('#rail');
let drag = null, railMoved = 0;
rail.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  drag = { x: e.clientX, s: rail.scrollLeft, v: 0, last: e.clientX };
  railMoved = 0;
  rail.classList.add('drag');
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.v = e.clientX - drag.last;
  railMoved = Math.max(railMoved, Math.abs(e.clientX - drag.x));
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
// Dal 18/11/2026 senza Three.js (la pagina scarica circa 160 KB in meno): WebGL diretto, stessi shader di prima.
// Three passava i colori allo shader in valori lineari: qui si fa la stessa conversione, così il fondo resta identico.
const canvas = $('#bg');
const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
const lineare = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const TONES = [
  lineare('#800200'), // rosso Locus
  lineare('#9a1a06'),
  lineare('#b8400a'), // verso l'arancio degli eventi
  lineare('#d0560c'),
];
const tone = { target: 0, value: 0 };
const pixel = Math.min(devicePixelRatio, 1.5);
const bgUni = { uTime: 0, uScroll: 0, uMouse: [0.5, 0.5], uColor: TONES[0].slice() };
const ptUni = { uTime: 0, uScroll: 0, uVel: 0 };

function programma(vs, fs) {
  const p = gl.createProgram();
  [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([tipo, src]) => {
    const sh = gl.createShader(tipo);
    gl.shaderSource(sh, 'precision highp float;\n' + src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  });
  gl.linkProgram(p);
  return p;
}
function attributo(p, nome, dati, n) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, dati, gl.STATIC_DRAW);
  return { loc: gl.getAttribLocation(p, nome), b, n };
}
function usa(attr) {
  for (const a of attr) { gl.bindBuffer(gl.ARRAY_BUFFER, a.b); gl.enableVertexAttribArray(a.loc); gl.vertexAttribPointer(a.loc, a.n, gl.FLOAT, false, 0, 0); }
}

let fondo = null, grani = null;
if (gl) {
  // l'alone: un rettangolo che copre lo schermo
  const pf = programma(
    `attribute vec2 position; varying vec2 vUv; void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`,
    /* glsl */ `
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
      vec3 base = vec3(0.13, 0.024, 0.02);
      vec3 col = base + uColor * (g1 * g1 * 0.42 + g2 * g2 * 0.56) * (0.75 + n * 0.5);
      gl_FragColor = vec4(col, 1.0);
    }`);
  fondo = { p: pf, attr: [attributo(pf, 'position', new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), 2)] };
  // grani che salgono piano, e fuggono al passaggio dello scroll
  const N = small ? 500 : 1100;
  const pp = new Float32Array(N * 2);
  const ps = new Float32Array(N);
  for (let i = 0; i < N; i++) { pp.set([Math.random() * 2 - 1, Math.random() * 2 - 1], i * 2); ps[i] = Math.random(); }
  const pg = programma(/* glsl */ `
    attribute vec2 position; attribute float aSeed; uniform float uTime, uScroll, uPixel, uVel; varying float vA;
    void main(){
      vec2 p = position;
      p.y = mod(p.y + 1.0 + uTime * (0.006 + aSeed * 0.012) + uScroll * (0.3 + aSeed * 0.9), 2.0) - 1.0;
      p.x += sin(uTime * 0.3 + aSeed * 30.0) * 0.01;
      gl_Position = vec4(p, 0.0, 1.0);
      gl_PointSize = (1.2 + aSeed * 2.6) * uPixel * (1.0 + abs(uVel) * 0.6);
      vA = 0.25 + aSeed * 0.55;
    }`,
  `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.96, 0.85, 0.75) * vA * (1.0 - smoothstep(0.1, 0.5, r)), 1.0); }`);
  grani = { p: pg, n: N, attr: [attributo(pg, 'position', pp, 2), attributo(pg, 'aSeed', ps, 1)] };
}
const U = (p, nome) => gl.getUniformLocation(p, nome);
function dimensiona() {
  canvas.width = Math.round(innerWidth * pixel);
  canvas.height = Math.round(innerHeight * pixel);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  gl?.viewport(0, 0, canvas.width, canvas.height);
}
dimensiona();
function disegnaFondo() {
  if (!gl) return;
  gl.disable(gl.BLEND);
  gl.useProgram(fondo.p);
  gl.uniform1f(U(fondo.p, 'uTime'), bgUni.uTime);
  gl.uniform1f(U(fondo.p, 'uScroll'), bgUni.uScroll);
  gl.uniform2f(U(fondo.p, 'uRes'), innerWidth, innerHeight);
  gl.uniform2f(U(fondo.p, 'uMouse'), ...bgUni.uMouse);
  gl.uniform3f(U(fondo.p, 'uColor'), ...bgUni.uColor);
  usa(fondo.attr);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disableVertexAttribArray(fondo.attr[0].loc);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // grani che si sommano alla luce, come prima
  gl.useProgram(grani.p);
  gl.uniform1f(U(grani.p, 'uTime'), ptUni.uTime);
  gl.uniform1f(U(grani.p, 'uScroll'), ptUni.uScroll);
  gl.uniform1f(U(grani.p, 'uPixel'), pixel);
  gl.uniform1f(U(grani.p, 'uVel'), ptUni.uVel);
  usa(grani.attr);
  gl.drawArrays(gl.POINTS, 0, grani.n);
  grani.attr.forEach((a) => gl.disableVertexAttribArray(a.loc));
}

/* ------------------------------------------------------------------ */
/* immagini in parallasse, cursore, barra di avanzamento               */
/* ------------------------------------------------------------------ */
const parallax = $$('[data-speed]').map((el) => ({ el, img: $('img', el), k: +el.dataset.speed }));
const cursor = $('#cursor');
const cur = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
const mouseUV = [0.5, 0.5];
addEventListener('pointermove', (e) => {
  cur.tx = e.clientX; cur.ty = e.clientY;
  // il mirino si sposta qui, subito, e non nel ciclo della scena: così non dipende dagli fps del 3D
  cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  mouseUV[0] = e.clientX / innerWidth; mouseUV[1] = 1 - e.clientY / innerHeight;
});

addEventListener('pointerover', (e) => { cursor.classList.toggle('hot', !!e.target.closest?.('a, button, .card')); });

const inizio = performance.now();
function frame(time) {
  lenis.raf(time);
  const t = (performance.now() - inizio) / 1000;
  const y = lenis.scroll;
  const lim = lenis.limit || 1;
  progress.style.transform = `scaleX(${(y / lim).toFixed(4)})`;
  nav.classList.toggle('solid', y > 40);

  tone.value = lerp(tone.value, tone.target, 0.03);
  const i0 = Math.floor(tone.value), i1 = Math.min(TONES.length - 1, i0 + 1);
  for (let k = 0; k < 3; k++) bgUni.uColor[k] = lerp(TONES[i0][k], TONES[i1][k], tone.value - i0);
  bgUni.uTime = t;
  bgUni.uMouse = [lerp(bgUni.uMouse[0], mouseUV[0], 0.04), lerp(bgUni.uMouse[1], mouseUV[1], 0.04)];
  bgUni.uScroll = y / innerHeight;
  ptUni.uTime = t;
  ptUni.uScroll = y / innerHeight * 0.12;
  ptUni.uVel = lerp(ptUni.uVel, clamp(lenis.velocity / 40, -1, 1), 0.1);

  for (const p of parallax) {
    const r = p.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const c = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    p.img.style.transform = `scale(1.18) translateY(${(c * p.k * 100).toFixed(2)}%)`;
  }


  disegnaFondo();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => {
  dimensiona();
});

/* ------------------------------------------------------------------ */
/* ingresso e uscita: velo, e musica che si dissolve                    */
/* ------------------------------------------------------------------ */
const veil = $('#veil');
storia();
addEventListener('pageshow', (e) => { if (e.persisted) lenis.start(); });
requestAnimationFrame(() => setTimeout(() => veil.classList.remove('on'), 60));
if (location.hash) {
  const target = location.hash;
  setTimeout(() => lenis.scrollTo(target, { duration: 2.2, offset: -40 }), 700);
}


/* porta segreta: tenendo premuta la scritta Locus in alto a sinistra per 4 secondi si entra nel gestionale.
   Funziona con il dito e con il mouse; se il dito scorre o si stacca prima, resta il normale ritorno all'inizio. */
const porta = { timer: 0, x: 0, y: 0, usata: false };
const logo = $('.nav .logo');
function chiudiPorta() { clearTimeout(porta.timer); porta.timer = 0; }
logo.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  porta.usata = false;
  porta.x = e.clientX; porta.y = e.clientY;
  chiudiPorta();
  porta.timer = setTimeout(() => { porta.timer = 0; porta.usata = true; lenis.stop(); apriPortaSegreta(); }, PORTA_ATTESA);
});
logo.addEventListener('pointermove', (e) => {
  if (porta.timer && Math.hypot(e.clientX - porta.x, e.clientY - porta.y) > 14) chiudiPorta();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => logo.addEventListener(ev, chiudiPorta));
// sul telefono la pressione lunga aprirebbe il menu del link: lo fermo sul logo
logo.addEventListener('contextmenu', (e) => e.preventDefault());
logo.addEventListener('dragstart', (e) => e.preventDefault());

$$('[data-dissolve]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (porta.usata && a === logo) return; // la pressione lunga non fa anche tornare all'inizio
    veil.classList.add('leave', 'on');
    lenis.stop();
    setTimeout(() => { location.href = a.href; }, 1700);
  });
});

/* ------------------------------------------------------------------ */
/* la scheda di un format: si apre dalla carta e riempie lo schermo     */
/* ------------------------------------------------------------------ */
const sheet = $('#sheet');
const sheetScroll = $('.sheet-scroll', sheet);
const sheetBody = $('.sheet-body', sheet);
let sheetOpen = false, lastCard = null;

function sheetHTML(f) {
  const steps = f.steps ? `
    <div class="sh-block" data-sr><p class="kicker">${f.stepsTitle}</p>
      <ol class="sh-steps">${f.steps.map(([h, p], i) => `<li data-sr style="--d:${0.08 * i}s"><span>${String(i + 1).padStart(2, '0')}</span><h3>${h}</h3>${p ? `<p>${p}</p>` : ''}</li>`).join('')}</ol></div>` : '';
  const nums = f.numbers ? `
    <div class="sh-block" data-sr>${f.numbersTitle ? `<p class="kicker">${f.numbersTitle}</p>` : ''}
      <div class="sh-nums${f.numbersList ? ' list' : ''}">${f.numbers.map(([n, l], i) => `<div data-sr style="--d:${0.1 * i}s"><b>${n}</b><span>${l}</span></div>`).join('')}</div></div>` : '';
  const quote = f.quote ? `<blockquote class="sh-quote" data-sr>${f.quote}</blockquote>` : '';
  const dates = f.dates ? `
    <div class="sh-block" data-sr><p class="kicker">Le date</p>
      <ol class="sh-dates">${f.dates.map(([d, h, p], i) => `<li data-sr style="--d:${0.08 * i}s"><time>${d}</time><h3>${h}</h3><p>${p}</p></li>`).join('')}</ol></div>` : '';
  const photos = f.photos ? `
    <div class="sh-photos" data-sr>${f.photos.map((src, i) => `<figure style="--k:${(i % 3) - 1}"><img src="${src}" alt="" loading="lazy" /></figure>`).join('')}</div>` : '';
  const cta = f.cta ? `<div class="sh-cta" data-sr>${f.cta.map(([l, h]) => `<a href="${h}" ${h.startsWith('http') ? 'target="_blank" rel="noopener"' : 'data-sheet-go'}>${l}</a>`).join('')}</div>` : '';
  return `
    <header class="sh-hero">
      <div class="sh-cover"><img src="${f.cover}" alt="" /></div>
      <div class="sh-head">
        <p class="when">${f.kicker}</p>
        <h2 class="display sh-title">${f.title.split(' ').map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(' ')}</h2>
        <p class="lead">${f.lead}</p>
      </div>
    </header>
    <div class="sh-content">${f.about ? `<div class="sh-block sh-about" data-sr><p class="kicker">Cos'è</p><p>${f.about}</p></div>` : ''}${steps}${nums}${quote}${dates}${photos}<p class="source">${f.source}</p>${cta}</div>`;
}

const sheetIO = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }), { root: sheetScroll, rootMargin: '0px 0px -8% 0px' });

function openSheet(card) {
  const f = FORMATI[card.dataset.format];
  if (!f || sheetOpen) return;
  lastCard = card;
  sheetBody.innerHTML = sheetHTML(f);
  sheetScroll.scrollTop = 0;
  sheet.style.setProperty('--sy', 0);
  // la scheda si apre dal rettangolo della carta
  const r = card.getBoundingClientRect();
  sheet.style.setProperty('--clip', `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 4px)`);
  sheet.classList.remove('open');
  sheet.classList.add('show');
  void sheet.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('open')));
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('sheet-on');
  sheetOpen = true;
  history.replaceState({ ...(history.state || {}), y: scrollY }, '');
  history.pushState({ sheet: card.dataset.format }, '');
  lenis.stop();
  $$('[data-sr]', sheetBody).forEach((el) => sheetIO.observe(el));
  $$('[data-sheet-go]', sheetBody).forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    closeSheet();
    setTimeout(() => lenis.scrollTo(a.getAttribute('href'), { duration: 1.8, offset: -40 }), 700);
  }));
  setTimeout(() => $('.sheet-x', sheet).focus({ preventScroll: true }), 500);
}
// la scheda aperta è un passo della cronologia: il tasto indietro la chiude invece di cambiare pagina
function closeSheet() {
  if (!sheetOpen) return;
  if (history.state && history.state.sheet) history.back();
  else chiudi();
}
addEventListener('popstate', (e) => {
  const s = e.state || {};
  if (sheetOpen && !s.sheet) { chiudi(); return; }
  if (typeof s.y === 'number') lenis.scrollTo(s.y, { duration: 1.4 });
  else if (s.sec) lenis.scrollTo(s.sec, { duration: 1.4, offset: -40 });
});
function chiudi() {
  if (!sheetOpen) return;
  sheetOpen = false;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('sheet-on');
  lenis.start();
  setTimeout(() => { if (!sheetOpen) { sheet.classList.remove('show'); sheetBody.innerHTML = ''; } }, 900);
  lastCard?.focus({ preventScroll: true });
}
$$('.card[data-format]').forEach((c) => {
  c.addEventListener('click', () => { if (railMoved < 8) openSheet(c); });
  c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(c); } });
});
$('.sheet-x', sheet).addEventListener('click', closeSheet);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
// nella scheda la copertina si allontana scorrendo
sheetScroll.addEventListener('scroll', () => {
  sheet.style.setProperty('--sy', sheetScroll.scrollTop.toFixed(1));
}, { passive: true });
// sul telefono: trascinando in giù dalla cima la scheda si chiude
let pull = null;
sheetScroll.addEventListener('touchstart', (e) => { pull = sheetScroll.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
sheetScroll.addEventListener('touchmove', (e) => {
  if (pull === null) return;
  const d = e.touches[0].clientY - pull;
  sheetBody.style.transform = d > 0 ? `translateY(${(d * 0.4).toFixed(1)}px)` : '';
  if (d > 140) { pull = null; sheetBody.style.transform = ''; closeSheet(); }
}, { passive: true });
sheetScroll.addEventListener('touchend', () => { pull = null; sheetBody.style.transform = ''; });

/* ------------------------------------------------------------------ */
/* gli ultimi post di Instagram, da scorrere                           */
/* ------------------------------------------------------------------ */
const strip = $('#strip');
const IG = 'https://www.instagram.com/locus_parma/';
const fmtData = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
fetch(`${import.meta.env.BASE_URL}instagram.json`, { cache: 'no-cache' })
  .then((r) => r.json())
  .then(({ post }) => buildStrip(post || []))
  .catch(() => buildStrip([]));

function buildStrip(post) {
  const B = import.meta.env.BASE_URL;
  strip.innerHTML = post.map((p) => `
    <a class="post" href="${esc(p.link || IG)}" target="_blank" rel="noopener">
      <span class="pimg"><img src="${B}${esc(p.img)}" alt="${esc(p.alt || '')}" loading="lazy" draggable="false" /></span>
      ${p.data || p.caption ? `<span class="pcap">${p.data ? `<time>${fmtData(p.data)}</time>` : ''}${p.caption ? `<em>${esc(p.caption)}</em>` : ''}</span>` : ''}
      ${p.video ? '<i class="pvideo"></i>' : ''}
    </a>`).join('') + `
    <a class="post end" href="${IG}" target="_blank" rel="noopener"><span>Tutto il resto è su Instagram</span><b>@locus_parma</b><i>↗</i></a>`;
  stripMotion();
}

function stripMotion() {
  // col mouse si trascina, col dito scorre normale
  let hold = null, moved = 0, v = 0;
  strip.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    hold = { x: e.clientX, s: strip.scrollLeft, last: e.clientX }; moved = 0; v = 0;
    strip.classList.add('drag');
  });
  addEventListener('pointermove', (e) => {
    if (!hold) return;
    v = e.clientX - hold.last; hold.last = e.clientX;
    moved = Math.max(moved, Math.abs(e.clientX - hold.x));
    strip.scrollLeft = hold.s - (e.clientX - hold.x);
  });
  addEventListener('pointerup', () => {
    if (!hold) return;
    hold = null;
    (function glide() { v *= 0.94; strip.scrollLeft -= v; if (Math.abs(v) > 0.4) requestAnimationFrame(glide); else strip.classList.remove('drag'); })();
  });
  strip.addEventListener('click', (e) => { if (moved > 8) { e.preventDefault(); moved = 0; } }, true);
}

/* ------------------------------------------------------------------ */
/* tesserati: la richiesta entra nel registro delle tessere, in attesa; se l'archivio non risponde
   si torna alla mail già scritta, come prima */
/* ------------------------------------------------------------------ */
const join = $('#join');
const joinMsg = $('#join-msg');
join.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!join.checkValidity()) {
    join.classList.add('tried');
    joinMsg.textContent = 'Mancano alcuni campi: sono segnati in rosso.';
    join.querySelector(':invalid')?.focus();
    return;
  }
  const d = Object.fromEntries(new FormData(join));
  const nato = new Date(d.nascita);
  const diciotto = new Date(nato.getFullYear() + 18, nato.getMonth(), nato.getDate());
  if (diciotto > new Date()) {
    joinMsg.textContent = 'Dal sito ci si tessera da maggiorenni. Se hai meno di 18 anni scrivici a locus.parma@gmail.com.';
    return;
  }
  const righe = [
    'Ciao Locus, chiedo di tesserarmi.', '',
    `Nome: ${d.nome}`, `Cognome: ${d.cognome}`,
    `Data di nascita: ${nato.toLocaleDateString('it-IT')}`, `Luogo di nascita: ${d.luogo}`,
    `Codice fiscale: ${d.cf.toUpperCase()}`, `Comune di residenza: ${d.residenza}`,
    `Email: ${d.email}`, `Telefono: ${d.telefono || ''}`, '',
    'Dichiaro di avere più di 18 anni, di aver letto lo statuto e acconsento al trattamento dei dati per il tesseramento.',
  ];
  const oggetto = `Richiesta di tesseramento: ${d.nome} ${d.cognome}`;
  const bottone = join.querySelector('button[type=submit], button:not([type])');
  if (bottone) bottone.disabled = true;
  joinMsg.textContent = 'Invio in corso…';
  try {
    await inserisci('tessere', {
      nome: d.nome.trim(), cognome: d.cognome.trim(), data_nascita: d.nascita, luogo_nascita: d.luogo.trim(),
      codice_fiscale: d.cf.toUpperCase().trim(), comune_residenza: d.residenza.trim(),
      email: d.email.trim(), telefono: (d.telefono || '').trim() || null,
      maggiorenne: true, consenso_privacy: true,
    });
    segnala('chi-siamo', 'richiesta-tessera');
    join.reset();
    join.classList.remove('tried');
    joinMsg.textContent = `Richiesta arrivata. Ti scriviamo a ${d.email.trim()} con i dati per versare la quota.`;
  } catch (err) {
    location.href = `mailto:locus.parma@gmail.com?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(righe.join(String.fromCharCode(10)))}`;
    joinMsg.textContent = "Si è aperta la tua app di posta con la richiesta già scritta: premi invia. Se non si apre nulla, scrivi a locus.parma@gmail.com.";
  } finally {
    if (bottone) bottone.disabled = false;
  }
});


