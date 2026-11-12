import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import Lenis from 'lenis';
import { storia, daStoria } from './storia.js';
import { creaMondi } from './mondi.js';
import { segnala } from './dati.js';
segnala('home', 'arrivo');

/* ------------------------------------------------------------------ */
/* utilità                                                             */
/* ------------------------------------------------------------------ */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const win = (p, a, b, c, d) => Math.min(seg(p, a, b), 1 - seg(p, c, d));
const isTouch = matchMedia('(hover: none)').matches;
const small = Math.min(innerWidth, innerHeight) < 700;
// versione leggera per i dispositivi deboli: meno grani, meno risoluzione, stesso racconto.
// ?leggero la forza per le prove, ?pieno la toglie.
const Q = new URLSearchParams(location.search);
const cores = navigator.hardwareConcurrency || 8, memoria = navigator.deviceMemory || 8;
const LEGGERO = Q.has('leggero') || (!Q.has('pieno') && (isTouch ? (cores <= 6 || memoria <= 4) : (cores <= 4 && memoria <= 4)));
// chi ha chiesto al sistema meno movimento: niente rollio, niente sfocatura, movimenti più calmi
const MENO_MOTO = matchMedia('(prefers-reduced-motion: reduce)').matches || Q.has('calmo');
const smallQ = small || LEGGERO;
// versione 2 (12/11, in prova, solo in locale): ?versione=2. All'apertura c'è solo la bolla, la L compare quando
// la bolla scoppia; al posto dei tre cerchi ci sono le parentesi del logo, i quattro angoli del mirino attorno a locus
const V2 = Q.get('versione') === '2';

const COL = {
  rosso: new THREE.Color('#800200'),
  rossoVivo: new THREE.Color('#d0462e'),
  arancio: new THREE.Color('#FD7303'),
  ambra: new THREE.Color('#FEAB0D'),
  crema: new THREE.Color('#F5E4CB'),
  lime: new THREE.Color('#ECFE02'),
};

/* ------------------------------------------------------------------ */
/* renderer, scena, camera                                             */
/* ------------------------------------------------------------------ */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// tetto di pixel disegnati (12/11 sera): sugli schermi larghi (es. 2752x1152 a 125%, 5 milioni di pixel) una scheda
// video integrata non ce la fa con bagliore e antialiasing; si disegna al massimo ~2,4 milioni di pixel e si allarga.
// ?pixel=5000000 per provare altri tetti
const PIXEL_MAX = Number(Q.get('pixel')) || (LEGGERO ? 1.4e6 : 2.4e6);
const PR_TETTO = Math.sqrt(PIXEL_MAX / (innerWidth * innerHeight));
renderer.setPixelRatio(Math.min(devicePixelRatio, LEGGERO ? 1.5 : 2, Math.max(0.75, PR_TETTO)));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const bg = new THREE.Color('#2b0d0c');
scene.background = bg;
scene.fog = new THREE.Fog(bg, 10, 44);

// studio fotografico virtuale: fondo scuro e strisce di luce calda, così il vetro ha riflessi netti
const pmrem = new THREE.PMREMGenerator(renderer);
function studioEnv() {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#060101');
  const light = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  light(7, 1.1, '#ffe4c8', 4.5, [0, 5, 2.5]);   // softbox in alto
  light(0.5, 7, '#ffffff', 7, [-5, 0, 3]);      // striscia a sinistra
  light(0.5, 7, '#ffd2a8', 5, [5, 0.5, 1.5]);   // striscia a destra, più calda
  light(1.4, 1.4, '#ffffff', 10, [2.2, 2.2, 5]); // punto luce frontale
  light(4, 3, '#ff5a2a', 1.4, [0, -1, -6]);     // controluce arancio
  light(12, 12, '#3a0806', 0.7, [0, -5, 0]);    // pavimento rosso che rimbalza
  return pmrem.fromScene(s, 0).texture;
}
scene.environment = studioEnv();

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 0, 9);

scene.add(new THREE.AmbientLight('#ffd9c0', 0.25));
const keyLight = new THREE.PointLight('#ffb27a', 26, 40);
keyLight.position.set(3.5, 4, 6);
scene.add(keyLight);
const rimLight = new THREE.PointLight('#ff2a10', 40, 30);
rimLight.position.set(-4, -2, -3);
scene.add(rimLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.45, 0.9);
composer.addPass(bloom);

// effetti al passaggio dentro i cerchi, in prova: ?effetto=velo, ?effetto=onda, ?effetto=no; senza niente, tutti e due
// dal 10/11: senza niente, velo trasparente e portale; ?effetto=velo, ?effetto=portale, ?effetto=no.
// ?effetto=riempi riporta lo smalto rosso che riempie il cerchio (bocciato)
// velo e onda (prima prova, bocciata) restano raggiungibili con ?effetto=velo e ?effetto=onda
const EFFETTO = new URLSearchParams(location.search).get('effetto') || 'tutti';
const VELO = EFFETTO === 'velo' || EFFETTO === 'tutti';
const ONDA = EFFETTO === 'onda';
const RIEMPI = EFFETTO === 'riempi'; // la macchia rossa è stata bocciata il 10/11
const PORTALE = EFFETTO === 'portale' || EFFETTO === 'tutti';
// il rosso dello smalto liquido (valori lineari): uguale nel disco e nello schermo che si riapre
const LIQUIDO = new THREE.Vector3(0.26, 0.006, 0.003);

// onda nell'aria: lo schermo si increspa per un attimo, un anello che parte dal centro e si allarga
const ondaPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uK: { value: 1 }, uAmp: { value: 0 }, uAspect: { value: innerWidth / innerHeight } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uK, uAmp, uAspect; varying vec2 vUv;
    void main(){
      vec2 q = vUv - 0.5; q.x *= uAspect;
      float d = length(q);
      float front = uK * 1.3;                                  // il fronte dell'onda si allarga
      float x = d - front;
      float w = sin(x * 38.0) * exp(-x * x * 60.0) * uAmp * (1.0 - uK);
      vec2 dir = d > 0.0001 ? q / d : vec2(0.0);
      dir.x /= uAspect;
      gl_FragColor = texture2D(tDiffuse, vUv + dir * w);
    }`,
});
ondaPass.enabled = false;
composer.addPass(ondaPass);
let ondaT = 1, ondaForza = 0;

// sfocatura del passaggio: una sfocatura a raggiera dal centro, come uno scatto in avanti
const sfocaPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uS: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uS; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5;
      vec4 acc = vec4(0.0); float tot = 0.0;
      for (int i = 0; i < 14; i++) {
        float k = float(i) / 13.0, w = 1.0 - k * 0.6;
        acc += texture2D(tDiffuse, 0.5 + d * (1.0 - uS * 0.18 * k)) * w;
        tot += w;
      }
      gl_FragColor = acc / tot;
    }`,
});
sfocaPass.enabled = false;
composer.addPass(sfocaPass);

// riempi il vuoto: dopo il tuffo lo schermo è tutto smalto rosso, e si riapre dal centro con un bordo liquido
const riapriPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uOpen: { value: 1 }, uTime: { value: 0 }, uAspect: { value: innerWidth / innerHeight }, uCol: { value: LIQUIDO.clone().multiplyScalar(1.15) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uOpen, uTime, uAspect; uniform vec3 uCol; varying vec2 vUv;
    void main(){
      vec2 q = vUv - 0.5; q.x *= uAspect;
      float d = length(q), an = atan(q.y, q.x);
      float R = uOpen * 1.3 * (1.0 + 0.05 * sin(an * 5.0 + uTime * 1.3) + 0.03 * sin(an * 9.0 - uTime));
      float red = smoothstep(R - 0.012, R + 0.012, d);
      float rim = exp(-pow((d - R) * 38.0, 2.0)) * (1.0 - uOpen);
      vec3 c = uCol + vec3(0.3, 0.04, 0.02) * rim;
      gl_FragColor = vec4(mix(texture2D(tDiffuse, vUv).rgb, c, red), 1.0);
    }`,
});
riapriPass.enabled = false;
composer.addPass(riapriPass);
let riapriT = 1;
function riapri() { if (!RIEMPI) return; riapriT = 0; riapriPass.uniforms.uOpen.value = 0; riapriPass.enabled = true; }

// il portale: i mondi dopo ogni cerchio (oggetti e cielo) stanno in mondi.js
function onda(forza) { if (!ONDA) return; ondaT = 0; ondaForza = forza; ondaPass.enabled = true; }

// la bolla del cursore (idea presa da lusion.co): muovendo il mouse resta dietro una scia a forma di bolla.
// Dal 10/11 sera è una cometa: una bolla piccola in testa e una coda lunga che si assottiglia (prima i cerchi si
// sommavano e la scia lunga diventava grossa). È una catena di capsule, ognuna col suo raggio, quindi resta sottile.
// Dentro l'immagine si piega come in una lente d'acqua, sul bordo riflette la stanza di Locus come la bolla della L,
// più un filo bianco. Quando il cursore si ferma la coda si ritira. Solo con il mouse, non sul telefono; ?bolla=no la toglie.
// la stanza di Locus fotografata su un cubo: la riflettono la bolla della L e la bolla del cursore (si riempie più sotto)
const stanzaRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
// dall'11/11 tolta dal sito su richiesta di Cristiano: il mouse resta libero. Con ?bolla=si torna la cometa, per le prove.
const BOLLA_CURSORE = !isTouch && new URLSearchParams(location.search).get('bolla') === 'si';
const NB = 48;                 // punti della scia
const R_TESTA = 0.024;         // raggio della bolla in testa, in parti dell'altezza dello schermo
const R_CODA = 0.009;          // raggio della coda dove si attacca alla testa
const PASSO = 14;              // pixel tra un punto e l'altro: le capsule riempiono lo spazio in mezzo
const bollaPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uAsp: { value: innerWidth / innerHeight }, uN: { value: 0 },
    uEnv: { value: stanzaRT.texture },
    uP: { value: Array.from({ length: NB }, () => new THREE.Vector3()) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform samplerCube uEnv; uniform float uAsp; uniform int uN; uniform vec3 uP[${NB}];
    varying vec2 vUv;
    void main(){
      vec2 p = vUv * vec2(uAsp, 1.0);
      float best = 1e9; vec2 bn = vec2(0.0); float br = 1.0;
      // la coda: capsule tra i punti, dal più vecchio al penultimo; l'ultimo punto è la testa, una bolla tonda a sé
      for (int i = 0; i < ${NB}; i++) {
        if (i >= uN) break;
        vec3 a = uP[i];
        vec3 b = (i + 2 < uN) ? uP[i + 1] : a;
        vec2 pa = p - a.xy * vec2(uAsp, 1.0);
        vec2 ba = (b.xy - a.xy) * vec2(uAsp, 1.0);
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
        vec2 q = pa - ba * h;
        float r = max(mix(a.z, b.z, h), 1e-5);
        float dist = length(q);
        float sd = dist / r;                       // meno di 1: siamo dentro la bolla
        if (sd < best) { best = sd; bn = q / max(dist, 1e-6); br = r; }
      }
      vec4 c = texture2D(tDiffuse, vUv);
      if (best < 1.05) {
        float s = min(best, 1.0);
        vec3 N = vec3(bn * s, sqrt(max(1.0 - s * s, 0.0)));   // come una sfera o un tubo visto di fronte
        float F = 0.03 + 0.97 * pow(1.0 - N.z, 5.0);          // riflesso quasi niente al centro, forte sul bordo
        vec2 off = -bn * pow(s, 3.0) * br * 0.45; off.x /= uAsp; // la lente piega di più vicino al bordo
        vec4 dentro = texture2D(tDiffuse, vUv + off);
        dentro.rgb += min(textureCube(uEnv, reflect(vec3(0.0, 0.0, -1.0), N)).rgb * 0.62, vec3(1.6)) * F;
        float m = 1.0 - smoothstep(0.96, 1.02, best);
        c = mix(c, dentro, m);
      }
      float filo = exp(-pow((best - 1.0) / 0.07, 2.0));
      c.rgb += vec3(1.0, 0.97, 0.94) * filo * 0.2;
      gl_FragColor = c;
    }`,
});
bollaPass.enabled = false;
composer.addPass(bollaPass);
const scia = []; // punti della scia, dal più vecchio al più nuovo: x, y (in pixel), nascita
let sciaX = -1, sciaY = -1;
const VITA_SCIA = Number(new URLSearchParams(location.search).get('scia')) || 1.4; // ?scia=4 la tiene 4 secondi, per le prove
let sciaT = 0;
// solo in locale: disegna una scia ferma lungo una curva, per guardarne la forma anche dove la pagina gira lenta
if (import.meta.env.DEV) window.__sciaProva = (x0 = innerWidth * 0.7, y0 = innerHeight * 0.15) => {
  scia.length = 0;
  for (let i = 0; i < NB - 1; i++) {
    const a = i / (NB - 2);
    scia.push({ x: x0 + Math.sin(a * 3.0) * innerHeight * 0.25, y: y0 + a * innerHeight * 0.65, t0: sciaT - (1 - a) * VITA_SCIA * 0.97 });
  }
  const l = scia[scia.length - 1];
  cur.tx = l.x; cur.ty = l.y; sciaX = l.x; sciaY = l.y; pointerSeen = true;
};
function aggiornaBolla(t) {
  sciaT = t;
  if (!BOLLA_CURSORE) return;
  // un punto nuovo ogni pochi pixel di movimento: fermo il cursore, non nasce niente e la coda si ritira
  const salto = Math.hypot(cur.tx - sciaX, cur.ty - sciaY);
  if (pointerSeen && (sciaX < 0 || salto > PASSO)) {
    const passi = sciaX < 0 ? 1 : Math.min(8, Math.floor(salto / PASSO));
    for (let k = 1; k <= passi; k++) {
      const a = k / passi;
      scia.push({ x: sciaX < 0 ? cur.tx : lerp(sciaX, cur.tx, a), y: sciaY < 0 ? cur.ty : lerp(sciaY, cur.ty, a), t0: t });
    }
    sciaX = cur.tx; sciaY = cur.ty;
    while (scia.length > NB - 1) scia.shift();
  }
  while (scia.length && t - scia[0].t0 > VITA_SCIA) scia.shift();
  const u = bollaPass.uniforms.uP.value;
  // la testa segue il cursore esatto, così la bolla non resta indietro di un passo
  const pts = scia.length ? [...scia, { x: cur.tx, y: cur.ty, t0: scia[scia.length - 1].t0 }] : [];
  for (let i = 0; i < NB; i++) {
    const s = pts[i];
    if (!s) { u[i].z = 0; continue; }
    const vita = Math.max(1 - (t - s.t0) / VITA_SCIA, 0);
    const testa = i === pts.length - 1;
    // la testa è la bolla piccola; la coda parte sottile e si assottiglia fino a sparire
    u[i].set(s.x / innerWidth, 1 - s.y / innerHeight, testa ? R_TESTA * Math.pow(vita, 0.5) : R_CODA * Math.pow(vita, 1.1));
  }
  bollaPass.uniforms.uN.value = pts.length;
  bollaPass.uniforms.uAsp.value = innerWidth / innerHeight;
  bollaPass.enabled = pts.length > 0;
}

composer.addPass(new OutputPass());
// antialiasing alla fine della catena: senza, i bordi escono a scalini.
// (l'antialiasing multisample va in conflitto con il bagliore su alcune schede video e fa sparire la scena)
composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));

/* ------------------------------------------------------------------ */
/* texture tonda per i grani                                           */
/* ------------------------------------------------------------------ */
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
const DOT = dotTexture();

/* ------------------------------------------------------------------ */
/* 1. APERTURA: la L di vetro rosso dentro la bolla                    */
/* ------------------------------------------------------------------ */
const hero = new THREE.Group();
scene.add(hero);

// L con le grazie, disegnata a mano finché non arriva il logo originale
function makeL(seg = 12) {
  const s = new THREE.Shape();
  s.moveTo(-0.4, 0);
  s.lineTo(3.7, 0);
  s.lineTo(3.7, 1.45);
  s.lineTo(3.48, 1.45);
  s.quadraticCurveTo(3.3, 0.98, 2.8, 0.95);
  s.lineTo(1.0, 0.95);
  s.lineTo(1.0, 4.72);
  s.lineTo(1.38, 4.72);
  s.lineTo(1.38, 5.0);
  s.lineTo(-0.4, 5.0);
  s.lineTo(-0.4, 4.72);
  s.lineTo(-0.05, 4.72);
  s.lineTo(-0.05, 0.26);
  s.lineTo(-0.4, 0.26);
  s.lineTo(-0.4, 0);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.7, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.085, bevelSegments: seg, curveSegments: 48,
  });
  geo.center();
  geo.scale(0.5, 0.5, 0.5);
  return geo;
}
// smalto rosso lucido: colore pieno, riflessi netti dello studio, una velatura iridescente appena accennata
const lMat = new THREE.MeshPhysicalMaterial({
  color: '#8a0603',
  metalness: 0,
  roughness: 0.22,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  specularIntensity: 1,
  specularColor: new THREE.Color('#ffd9c8'),
  sheen: 0.4,
  sheenColor: new THREE.Color('#ff5030'),
  sheenRoughness: 0.4,
  iridescence: 0.12,
  iridescenceIOR: 1.4,
  envMapIntensity: 1.5,
});
// dall'11/11 in prova: la L di carta, la stessa carta rossa dei cigni (cotta in Blender, blender/carta-texture.py).
// Spigoli netti, come un cartoncino piegato; niente riflessi dello studio.
// Il 10/11 Cristiano ha preferito lo smalto: la carta resta solo per confronto, con ?l=carta.
const L_CARTA = new URLSearchParams(location.search).get('l') === 'carta';
function cartaTex(nome, colore) {
  const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}modelli/${nome}.jpg`);
  if (colore) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; // il foglio si specchia ai bordi, così non si vedono giunte
  t.repeat.set(0.22, 0.22);
  t.anisotropy = 8;
  return t;
}
const lCartaMat = L_CARTA ? (() => {
  const map = cartaTex('carta-colore', true);
  return new THREE.MeshPhysicalMaterial({
    map, normalMap: cartaTex('carta-rilievo', false), normalScale: new THREE.Vector2(0.8, 0.8),
    color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.15, specularIntensity: 0.15,
    sheen: 0.5, sheenRoughness: 0.9, sheenColor: new THREE.Color('#ff9c8c'),
    emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.08, flatShading: true,
  });
})() : null;
const lMesh = new THREE.Mesh(L_CARTA ? makeL(1) : makeL(), L_CARTA ? lCartaMat : lMat);
hero.add(lMesh);

// controluce: un alone caldo dietro la L, che il vetro raccoglie e accende di rosso
const glowUni = { uBg: { value: new THREE.Color('#2b0d0c') }, uTime: { value: 0 }, uFade: { value: 1 } };
const backGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(9, 9),
  new THREE.ShaderMaterial({
    uniforms: glowUni,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uBg; uniform float uTime, uFade; varying vec2 vUv;
      void main(){
        vec2 q = vUv - 0.5;
        float r = length(q * vec2(1.0, 0.92));
        float core = 1.0 - smoothstep(0.0, 0.22, r);
        float halo = 1.0 - smoothstep(0.02, 0.5, r);
        vec3 warm = mix(vec3(0.30, 0.025, 0.012), vec3(0.95, 0.30, 0.10), core * core);
        float breathe = 0.9 + 0.1 * sin(uTime * 0.7);
        gl_FragColor = vec4(warm * breathe * halo * halo * 0.55 * uFade, 1.0);
      }`,
  })
);
backGlow.position.z = -1.6;
hero.add(backGlow);

// gli angoli del mirino, come nel logo
const brackets = new THREE.Group();
const brMat = lMat; // stesso smalto rosso della L
const corners = [];
[[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.05), brMat);
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), brMat);
  h.position.set(-sx * 0.25, 0, 0);
  v.position.set(0, -sy * 0.25, 0);
  g.add(h, v);
  g.userData = { sx, sy };
  brackets.add(g);
  corners.push(g);
});
hero.add(brackets);

// la bolla di sapone: quasi invisibile, la forma che ondeggia appena, un filo bianco sul contorno.
// Dal 10/11 sera riflette la stanza di Locus fatta in Blender (blender/stanza.py, public/hdri/stanza-locus.hdr):
// come una bolla vera, il riflesso è quasi invisibile al centro e forte sul bordo, sulla faccia davanti e, capovolto,
// su quella dietro. Scelta nella pagina prove-bolle.html. Con ?riflesso=disegnato torna la bolla di prima.
const RIFLESSO_DISEGNATO = new URLSearchParams(location.search).get('riflesso') === 'disegnato';
if (!RIFLESSO_DISEGNATO) {
  const stanzaUni = { uMap: { value: null } };
  const stanza = new THREE.Scene();
  stanza.add(new THREE.Mesh(
    new THREE.SphereGeometry(40, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: stanzaUni,
      vertexShader: `varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vW;
        void main(){
          vec3 d = normalize(vW);
          vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, 0.5 - asin(clamp(d.y, -1.0, 1.0)) / 3.1415927);
          // abbassata di un terzo e con le lampade frenate: più sapone che vetro rosso, niente bagliore sul bordo
          gl_FragColor = vec4(min(texture2D(uMap, uv).rgb * 0.62, vec3(1.6)), 1.0);
        }`,
    })
  ));
  new HDRLoader().setDataType(THREE.FloatType).load(`${import.meta.env.BASE_URL}hdri/stanza-locus.hdr`, (tex) => {
    tex.flipY = false;
    tex.needsUpdate = true;
    stanzaUni.uMap.value = tex;
    new THREE.CubeCamera(0.1, 100, stanzaRT).update(renderer, stanza); // la stanza è ferma: basta fotografarla una volta
    tex.dispose();
  });
}
const bubbleUniforms = { uTime: { value: 0 }, uWobble: { value: 1 }, uPop: { value: 0 }, uEnv: { value: stanzaRT.texture } };
const FS_RIFLESSO = /* glsl */ `
      uniform float uPop; uniform samplerCube uEnv;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(vV);
        bool front = gl_FrontFacing;
        if (!front) N = -N;                                    // dietro si vede il lato interno, che fa da specchio concavo
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float F = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);           // come l'acqua: quasi niente al centro, tanto sul bordo
        vec3 c = textureCube(uEnv, reflect(-V, N)).rgb * F * (front ? 1.0 : 0.55);
        if (front) c += vec3(1.0) * smoothstep(0.82, 1.0, 1.0 - ndv) * 0.3;   // il filo bianco sul contorno
        gl_FragColor = vec4(c * (1.0 - uPop), 1.0);
      }`;
const bubble = new THREE.Mesh(
  new THREE.SphereGeometry(2.9, 128, 128),
  new THREE.ShaderMaterial({
    uniforms: bubbleUniforms,
    transparent: true,
    depthWrite: false,
    ...(RIFLESSO_DISEGNATO ? {} : { side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    vertexShader: /* glsl */ `
      uniform float uTime, uWobble, uPop;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      // la deformazione: onde larghe e lente, come una bolla vera spinta dall'aria, più increspature fini
      float disp(vec3 n){
        // metà del movimento della prima versione
        float big = sin(n.x * 2.1 + uTime * 0.55) * 0.035 + sin(n.y * 2.6 - uTime * 0.43) * 0.03 + sin(n.z * 1.9 + n.x * 1.3 + uTime * 0.48) * 0.025;
        float fine = sin(n.y * 6.4 + uTime * 1.1) * 0.004 + sin(n.x * 9.0 - uTime * 0.85) * 0.003;
        return (big + fine) * uWobble;
      }
      vec3 shape(vec3 x){ vec3 n = normalize(x); return n * (2.9 + disp(n)); }
      void main(){
        vec3 p = shape(position);
        vec3 nn = normalize(position);
        vec3 t1 = normalize(cross(nn, abs(nn.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 t2 = cross(nn, t1);
        vec3 nrm = normalize(cross(shape(position + t1 * 0.02) - p, shape(position + t2 * 0.02) - p));
        if (dot(nrm, nn) < 0.0) nrm = -nrm;
        p *= 1.0 + uPop * 0.35;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vP = p;
        vN = normalize(mat3(modelMatrix) * nrm);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: !RIFLESSO_DISEGNATO ? FS_RIFLESSO : /* glsl */ `
      uniform float uTime, uPop;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float ndv = abs(dot(vN, vV));
        float edge = 1.0 - ndv;
        // bolla trasparente: niente colori, solo luce bianca sul contorno, la finestra e i punti luce
        float filmA = pow(edge, 3.6) * 0.12;                             // appena un velo verso il bordo
        float rim = smoothstep(0.82, 1.0, edge);                         // il filo bianco sul contorno
        vec3 r = reflect(-vV, vN);
        float win = smoothstep(0.5, 0.53, r.y) * (1.0 - smoothstep(0.64, 0.67, r.y))
                  * smoothstep(-0.5, -0.47, r.x) * (1.0 - smoothstep(-0.33, -0.3, r.x)) * step(0.0, r.z);   // la finestra, piccola
        vec3 l = normalize(vec3(0.5, 0.7, 0.6));
        float spec = pow(max(dot(reflect(-l, vN), vV), 0.0), 420.0) * 1.8 + pow(max(dot(reflect(-normalize(vec3(-0.6, 0.2, 0.7)), vN), vV), 0.0), 900.0) * 0.9;
        float a = (filmA + rim * 0.35 + win * 0.75) * (1.0 - uPop);
        gl_FragColor = vec4(vec3(1.0) + spec, a + spec * (1.0 - uPop));
      }`,
  })
);
hero.add(bubble);

// goccioline che volano via quando la bolla scoppia
const DROPS = smallQ ? 600 : 1400;
const dropGeo = new THREE.BufferGeometry();
const dropDir = new Float32Array(DROPS * 3);
const dropPos = new Float32Array(DROPS * 3);
const dropSpd = new Float32Array(DROPS);
for (let i = 0; i < DROPS; i++) {
  const v = new THREE.Vector3().randomDirection();
  dropDir.set([v.x, v.y, v.z], i * 3);
  dropSpd[i] = 0.4 + Math.random();
}
dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
const dropMat = new THREE.PointsMaterial({
  size: 0.05, map: DOT, color: COL.crema, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
});
const drops = new THREE.Points(dropGeo, dropMat);
hero.add(drops);

/* ------------------------------------------------------------------ */
/* polvere di grani lungo tutto il volo: dà profondità                 */
/* ------------------------------------------------------------------ */
let dustMat;
{
  const N = LEGGERO ? 900 : small ? 1500 : 3000;
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    p.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, 12 - Math.random() * 105], i * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  dustMat = new THREE.PointsMaterial({
    size: 0.05, map: DOT, color: '#f3c9a8', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(g, dustMat));
}

/* ------------------------------------------------------------------ */
/* 2. I TRE ANELLI in cui si entra scorrendo                           */
/* ------------------------------------------------------------------ */
const RINGS = [
  // tutti e tre rossicci (#ffa898), e la luce cresce da un cerchio all'altro: 40%, 70%, 100%
  { z: -14, color: new THREE.Color('#ffa898'), metal: '#c9a982', mood: 0.35, glow: 0.4 },
  { z: -32, color: new THREE.Color('#ffa898'), metal: '#c9a982', mood: 0.7, glow: 0.7 },
  { z: -50, color: new THREE.Color('#ffa898'), metal: '#c9a982', mood: 0.5, glow: 1 },
];
// fascio di luce: pieno dove guarda la camera, sfuma sui bordi, con la luce che scorre lungo il cerchio
const beamVS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const beamFS = /* glsl */ `
  uniform vec3 uColor; uniform float uTime, uPower, uGain, uFlash, uSeed, uFade, uDir;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){
    float uT = uTime * uDir;
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float body = pow(facing, uPower);
    float a = atan(vP.y, vP.x);
    float flow = 0.5 + 0.5 * sin(a * 3.0 - uT * 1.2 + uSeed) * sin(a * 7.0 + uT * 0.55 + uSeed * 2.0);
    float spark = pow(max(sin(a * 19.0 - uT * 2.2 + uSeed), 0.0), 16.0);
    float i = body * uGain * (0.6 + flow * 0.7 + spark * 0.7) * (1.0 + uFlash * 1.4) * uFade;
    gl_FragColor = vec4(uColor * i, 1.0);
  }`;
const beamMat = (color, power, gain, seed, dir = 1) => new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: color }, uTime: { value: 0 }, uPower: { value: power }, uGain: { value: gain },
    uFlash: { value: 0 }, uSeed: { value: seed }, uFade: { value: 1 }, uDir: { value: dir },
  },
  vertexShader: beamVS, fragmentShader: beamFS,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const R_RING = 4.6;
// il velo si rompe: goccioline che partono da tutta la pellicola, verso l'esterno e nel verso del passaggio
function rompi(r, dir) {
  if (!VELO || r.rotto) return;
  r.rotto = true;
  r.dropT = 0;
  for (let k = 0; k < r.ND; k++) {
    const a = Math.random() * Math.PI * 2, rad = R_RING * Math.sqrt(Math.random()) * 0.97;
    const out = 0.8 + Math.random() * 2.6;
    r.vdPos.set([Math.cos(a) * rad, Math.sin(a) * rad, -dir * Math.random() * 1.2], k * 3);
    r.vdVel.set([Math.cos(a) * out, Math.sin(a) * out, -dir * (1 + Math.random() * 3)], k * 3);
  }
}
const TUBI = !new URLSearchParams(location.search).has('luce');
const LUCE_INTERNA = new THREE.Color('#ffc4a0');
const LUCE_PURA = new URLSearchParams(location.search).get('interna') !== 'filo';
// una luce calda che accompagna la camera: senza, i tubi lontani dalla L restano spenti
const ringLight = new THREE.PointLight('#ffd2b0', TUBI ? 60 : 0, 40);
scene.add(ringLight);
RINGS.forEach((r, i) => {
  const g = new THREE.Group();
  g.position.z = r.z;
  // dall'11/11, con i tubi, la luce dei vecchi cerchi (anima, fascio, alone) corre sul lato interno del tubo:
  // è luce pura che si somma, non un colore dello smalto. Con ?interna=filo si torna al filamento del 10/11
  const rL = TUBI && LUCE_PURA ? R_RING - 0.44 : R_RING;
  // anima incandescente
  const core = new THREE.Mesh(
    new THREE.TorusGeometry(rL, 0.03, 16, 480),
    new THREE.MeshBasicMaterial({ color: r.color.clone().lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.0 * (r.glow || 1)), transparent: true })
  );
  // fascio e alone: la luce del fascio corre in un verso, quella dell'alone nell'altro, come due braccia che si stringono
  const beam = new THREE.Mesh(new THREE.TorusGeometry(rL, 0.3, 48, 480), beamMat(r.color, 2.6, 0.85 * (r.glow || 1), i * 1.7));
  const haze = new THREE.Mesh(new THREE.TorusGeometry(rL, 1.2, 32, 240), beamMat(r.color, 5.5, 0.2 * (r.glow || 1), i * 1.7 + 0.6, -1));
  // il bordo non è più un oggetto: è un secondo filo di luce sottile, con un alone morbido che scorre al contrario
  const metalMat = new THREE.MeshBasicMaterial({ color: r.color.clone().lerp(new THREE.Color('#ffffff'), 0.25).multiplyScalar(1.3 * (r.glow || 1)), transparent: true });
  const band = new THREE.Mesh(new THREE.TorusGeometry(R_RING + 0.62, 0.012, 12, 480), metalMat);
  const edgeBeam = new THREE.Mesh(new THREE.TorusGeometry(R_RING + 0.62, 0.14, 32, 480), beamMat(r.color, 3.0, 0.32 * (r.glow || 1), i * 1.7 + 1.1, -1));
  // tacche incise, una lunga ogni otto, come il mirino
  const TN = 96;
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.028, 0.14, 0.05), metalMat, TN);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  for (let k = 0; k < TN; k++) {
    const ang = (k / TN) * Math.PI * 2;
    const long = k % 8 === 0;
    pos.set(Math.cos(ang) * (R_RING + 0.88 + (long ? 0.06 : 0)), Math.sin(ang) * (R_RING + 0.88 + (long ? 0.06 : 0)), 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang - Math.PI / 2);
    sc.set(1, long ? 2.1 : 1, 1);
    ticks.setMatrixAt(k, m4.compose(pos, q, sc));
  }
  // polvere di luce che gira al contrario
  const N = small ? 900 : 1800;
  const pg = new THREE.BufferGeometry();
  const pp = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = R_RING + (Math.random() - 0.5) * 1.4 * Math.random();
    pp.set([Math.cos(ang) * rad, Math.sin(ang) * rad, (Math.random() - 0.5) * 0.7], k * 3);
  }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const grains = new THREE.Points(pg, new THREE.PointsMaterial({
    size: 0.045, map: DOT, color: r.color.clone().lerp(COL.crema, 0.55), transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  // dal 10/11 i cerchi sono tubi a sezione tonda, nello stesso smalto rosso della L (con ?luce si torna ai cerchi di luce)
  const tubeMat = lMat.clone();
  tubeMat.transparent = true;
  // un po' di luce sul lato interno del tubo, quello che guarda il centro del cerchio, come su Igloo
  const uInner = { value: new THREE.Color() };
  tubeMat.onBeforeCompile = (sh) => {
    sh.uniforms.uInner = uInner;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; uniform vec3 uInner;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float dentro = clamp(-dot(normalize(vON.xy), normalize(vOP.xy)), 0.0, 1.0);
        totalEmissiveRadiance += uInner * pow(dentro, 3.0);`);  // la luce del filamento sullo smalto vicino
  };
  tubeMat.customProgramCacheKey = () => 'tubo-luce-interna';
  const tube = new THREE.Mesh(new THREE.TorusGeometry(R_RING, 0.43, 64, 360), tubeMat);
  const innerGlow = new THREE.Mesh(new THREE.TorusGeometry(R_RING - 0.6, 0.45, 32, 240), beamMat(LUCE_INTERNA, 3.2, 0.13, i * 1.7 + 0.3));
  // la sorgente: un filamento sottile incassato nel lato interno del tubo. È lui che fa luce (e un piccolo alone),
  // mentre lo smalto attorno si schiarisce come illuminato da vicino
  const filMat = new THREE.MeshBasicMaterial({ color: LUCE_INTERNA.clone(), transparent: true });
  const filamento = new THREE.Mesh(new THREE.TorusGeometry(R_RING - 0.405, 0.016, 12, 480), filMat);
  if (V2) {
    // le parentesi del logo: quattro angoli nello stesso smalto della L; dal 12/11 il lato lungo è in verticale
    const HW = 3.7, HH = 5.6, BR = 2.3, SP = 0.62;
    const cornice = new THREE.Group();
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
      const h = new THREE.Mesh(new RoundedBoxGeometry(BR, SP, SP, 4, 0.12), tubeMat);
      const v = new THREE.Mesh(new RoundedBoxGeometry(SP, BR, SP, 4, 0.12), tubeMat);
      h.position.set(sx * (HW - BR / 2 + SP / 2), sy * HH, 0);
      v.position.set(sx * HW, sy * (HH - BR / 2 + SP / 2), 0);
      cornice.add(h, v);
    });
    g.add(cornice);
  }
  else if (TUBI && LUCE_PURA) {
    // la luce si stende nel piano del cerchio: il tubo le sta davanti e la copre, così sullo smalto non resta nessun velo rosa
    haze.scale.z = beam.scale.z = 0.04;
    // un po' più di luce (11/11): fascio e alone +40%, anima +30%
    beam.material.uniforms.uGain.value *= 1.4;
    haze.material.uniforms.uGain.value *= 1.4;
    core.material.color.multiplyScalar(1.3);
    g.add(tube, haze, beam, core, grains);
  }
  else if (TUBI) g.add(tube, filamento, innerGlow, grains);
  else g.add(edgeBeam, band, haze, beam, core, grains); // senza tacche, come nella prova Abbraccio

  // velo di bolla: una pellicola trasparente tesa nel cerchio, che si rompe in goccioline quando la attraversi
  const veloUni = { uTime: { value: 0 }, uPop: { value: 0 }, uFade: { value: 0 } };
  const velo = new THREE.Mesh(new THREE.CircleGeometry(R_RING, 128), new THREE.ShaderMaterial({
    // la luce si somma e basta: dove il velo non riflette non c'è niente, nessuna patina grigia
    uniforms: veloUni, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uPop; varying vec2 vP; void main(){ vP = position.xy / ${R_RING.toFixed(2)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (1.0 + uPop * 0.12), 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPop, uFade; varying vec2 vP;
      void main(){
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        // come la bolla: quasi invisibile al centro, un velo bianco verso il bordo, qualche riflesso che scorre piano
        float edge = pow(r, 7.0) * 0.3;
        float sheen = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(a * 2.0 + r * 5.0 + uTime * 0.25)) * smoothstep(0.3, 0.95, r) * 0.07;
        vec2 wp = vP - vec2(-0.42, 0.48);                                    // il riflesso di finestra in alto a sinistra
        float win = (1.0 - smoothstep(0.06, 0.09, abs(wp.x))) * (1.0 - smoothstep(0.035, 0.06, abs(wp.y))) * 0.22;
        float luce = (edge * 0.55 + sheen * 0.8 + win) * (1.0 - uPop) * uFade * 0.6; // dall'11/11 più trasparente
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.94) * luce, 1.0);
      }`,
  }));
  if (VELO && !V2) g.add(velo);
  const ND = small ? 350 : 700;
  const vdPos = new Float32Array(ND * 3), vdVel = new Float32Array(ND * 3);
  const vdGeo = new THREE.BufferGeometry();
  vdGeo.setAttribute('position', new THREE.BufferAttribute(vdPos, 3));
  const vdMat = new THREE.PointsMaterial({ size: 0.06, map: DOT, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const drops = new THREE.Points(vdGeo, vdMat);
  drops.frustumCulled = false;
  if (VELO && !V2) g.add(drops);

  // riempi il vuoto: il centro del cerchio si riempie di smalto rosso liquido mentre ti avvicini
  const discoUni = { uFill: { value: 0 }, uTime: { value: 0 }, uCol: { value: LIQUIDO } };
  const disco = new THREE.Mesh(new THREE.CircleGeometry(R_RING, 160), new THREE.ShaderMaterial({
    uniforms: discoUni, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy / ${R_RING.toFixed(2)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uFill, uTime; uniform vec3 uCol; varying vec2 vP;
      void main(){
        float r = length(vP), a = atan(vP.y, vP.x);
        float R = uFill * 1.04 * (1.0 + 0.05 * sin(a * 5.0 + uTime * 1.3) + 0.03 * sin(a * 9.0 - uTime));
        if (r > R + 0.012) discard;
        float inside = 1.0 - smoothstep(R - 0.012, R + 0.012, r);
        float rim = exp(-pow((r - R) * 30.0, 2.0));                       // il bordo del liquido, più chiaro
        vec2 h = vP - vec2(-0.35, 0.4);
        float hi = exp(-dot(h, h) * 16.0) * 0.14 * uFill;                  // un riflesso morbido in alto a sinistra
        vec3 c = uCol * (0.85 + 0.3 * (1.0 - r)) + vec3(0.3, 0.04, 0.02) * rim + vec3(1.0, 0.8, 0.75) * hi;
        gl_FragColor = vec4(c, inside);
      }`,
  }));
  if (RIEMPI) g.add(disco);

  g.rotation.z = V2 ? 0 : i * 0.7;
  scene.add(g);
  Object.assign(r, { group: g, core, beam, haze, edgeBeam, ticks, grains, metalMat, tubeMat, flash: 0,
    veloUni, vdPos, vdVel, vdGeo, vdMat, ND, rotto: false, popT: 1, dropT: 1, disco, discoUni, passato: false, uInner, innerGlow, filMat });
});

const mondi = PORTALE ? creaMondi(scene, { ringZ: RINGS.map((r) => r.z), small: smallQ }) : null;

/* ------------------------------------------------------------------ */
/* 3. FOTO SOSPESE: galleggiano a profondità diverse e ci si vola in mezzo */
/* ------------------------------------------------------------------ */
const NCARDS = 15;
const PHOTOS = Array.from({ length: NCARDS }, (_, i) => `${import.meta.env.BASE_URL}foto/foto-${String(i + 1).padStart(2, '0')}.jpg`);
const galleryZ = -68;
const gallery = new THREE.Group();
gallery.position.set(0, 0, galleryZ);
scene.add(gallery);
const shared = { uTime: { value: 0 }, uVel: { value: 0 }, uOpacity: { value: 0 } };
const PW = 3.2, PH = 4.0, STEP_Z = 4.2;
const frac = (x) => x - Math.floor(x);
// a sinistra e a destra, alte e basse, ognuna un po' più lontana della precedente: il centro resta libero per passare
function spot(i) {
  const side = i % 2 ? 1 : -1;
  return {
    pos: new THREE.Vector3(side * (2.3 + frac(i * 0.618 + 0.1) * 2.4), (frac(i * 0.377 + 0.25) - 0.5) * 4.6, -i * STEP_Z),
    turn: -side * (0.18 + frac(i * 0.29) * 0.14),
  };
}

function placeholder(i) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1080, 1350);
  grd.addColorStop(0, i % 2 ? '#4b1413' : '#800200');
  grd.addColorStop(1, '#140404');
  g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = '#F5E4CB'; g.font = '128px Anton, sans-serif';
  g.fillText('FOTO ' + (i + 1) + '.', 88, 1240);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const loader = new THREE.TextureLoader();
const cards = PHOTOS.map((src, i) => {
  const u = {
    ...shared,
    uTex: { value: placeholder(i) },
    uImgAspect: { value: 0.8 },
    uPlaneAspect: { value: PW / PH },
    uHover: { value: 0 },
    uFocus: { value: 0 },
    uDim: { value: 0 },
    uFade: { value: 0 },
  };
  loader.load(src, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    u.uTex.value = t;
    u.uImgAspect.value = t.image.width / t.image.height;
  }, undefined, () => {});
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PH, 64, 80),
    new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uTime, uVel, uFocus;
        varying vec2 vUv; varying float vShade;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float k = 1.0 - uFocus;
          // un respiro leggero della carta, un po' più forte quando si corre
          float w = sin(wp.y * 0.9 + wp.x * 0.4 + uTime * 1.2) * 0.7 + sin(wp.x * 1.6 - uTime * 0.8) * 0.3;
          float amp = (0.03 + abs(uVel) * 0.18) * k;
          wp.z += w * amp;
          vShade = w * amp * 1.4;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uImgAspect, uPlaneAspect, uOpacity, uHover, uVel, uDim, uFade;
        varying vec2 vUv; varying float vShade;
        vec2 cover(vec2 uv){
          float r = uPlaneAspect / uImgAspect;
          vec2 s = r < 1.0 ? vec2(r, 1.0) : vec2(1.0, 1.0 / r);
          return (uv - 0.5) * s + 0.5;
        }
        void main(){
          vec2 uv = cover((vUv - 0.5) * (1.0 - uHover * 0.07) + 0.5);
          float sh = uVel * 0.005;
          vec3 c = vec3(texture2D(uTex, uv + vec2(0.0, sh)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(0.0, sh)).b);
          float light = clamp(vShade * 1.0, -0.28, 0.28);
          c *= 0.95 + light;                                          // pieghe in luce e in ombra
          c += vec3(0.12, 0.05, 0.02) * max(light, 0.0);             // lucido caldo della seta
          vec2 e = smoothstep(0.0, 0.012, vUv) * smoothstep(0.0, 0.012, 1.0 - vUv);
          c *= 1.0 - uDim * 0.75;
          gl_FragColor = vec4(c, uOpacity * uFade * e.x * e.y);
        }`,
    })
  );
  const { pos: base, turn } = spot(i);
  m.position.copy(base);
  m.rotation.y = turn;
  m.userData = { i, u, base, turn, focus: 0, hover: 0 };
  gallery.add(m);
  return m;
});
let focused = null;
const tmpV2 = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* 4. IL BATTISTERO DI GRANI                                           */
/* ------------------------------------------------------------------ */
const battZ = -76;
function battisteroPoints(N, dense = false) {
  // dense (pallini rossi, 12/11): più punti sulle linee e meno sparsi sulla parete, linee più spesse
  const soglie = dense ? [0.38, 0.74, 0.79, 0.93, 0.985] : [0.32, 0.6, 0.75, 0.88, 0.97];
  const sp = dense ? 2.2 : 1; // spessore delle linee (?spessore= per provarne altri)
  const spessore = Number(new URLSearchParams(location.search).get('spessore'));
  const spF = dense && spessore ? spessore : sp;
  // ottagono con le logge sovrapposte: cornici, colonnine, pilastri d'angolo, tetto basso
  const R = 2.4, y0 = -3.3, levels = [-3.3, -1.7, -0.7, 0.3, 1.3, 2.4];
  const vtx = (k, r = R) => {
    const a = k * Math.PI / 4 + Math.PI / 8;
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  };
  const onSide = (k, t, r) => vtx(k, r).lerp(vtx(k + 1, r), t);
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const k = Math.floor(Math.random() * 8);
    const r = Math.random();
    let x, y, z, v;
    if (r < soglie[0]) { // cornici orizzontali
      y = levels[Math.floor(Math.random() * levels.length)] + (Math.random() - 0.5) * 0.06 * spF;
      v = onSide(k, Math.random(), R * 1.02);
    } else if (r < soglie[1]) { // colonnine delle logge
      const j = Math.floor(Math.random() * 5);
      const band = 1 + Math.floor(Math.random() * 4);
      y = lerp(levels[band], levels[band + 1], Math.random());
      v = onSide(k, (j + 0.5) / 5 + (Math.random() - 0.5) * 0.02 * spF, R * 0.97);
    } else if (r < soglie[2]) { // parete del basamento, con tre portali
      y = lerp(y0, levels[1], Math.random());
      const t = Math.random();
      const inArch = (k % 2 === 0) && Math.abs(t - 0.5) < 0.16 && y < -2.05;
      if (inArch) { i--; continue; }
      v = onSide(k, t, R);
    } else if (r < soglie[3]) { // pilastri d'angolo che salgono oltre il tetto
      y = lerp(y0, 3.25, Math.random());
      v = vtx(k, R * 1.03);
      v.x += (Math.random() - 0.5) * 0.08 * spF; v.y += (Math.random() - 0.5) * 0.08 * spF;
    } else if (r < soglie[4]) { // tetto ottagonale basso
      const t = Math.random();
      y = lerp(2.45, 3.0, t);
      v = onSide(k, Math.random(), lerp(R, 0.7, t));
    } else { // lanterna in cima
      y = lerp(3.0, 3.45, Math.random());
      v = onSide(k, Math.random(), 0.45);
    }
    x = v.x; z = v.y;
    out.set([x, y, z], i * 3);
  }
  return out;
}
// dall'11/11, sul modello della terza scena di Igloo: grani su tutte le superfici, come palline opache illuminate,
// che arrivano da una nuvola a vortice e si compongono. ?battistero=luce torna ai grani di luce sugli spigoli.
// dall'11/11 sera di nuovo i grani di luce (le "stelline"), scelta di Cristiano in attesa del soggetto definitivo:
// le palline di marmo restano con ?battistero=solido, il mosaico in prove-battistero.html
const BATT_SOLIDO = new URLSearchParams(location.search).get('battistero') === 'solido';
function battisteroSolido(N) {
  const R = 2.4, y0 = -3.3, lv = [-3.3, -1.7, -0.7, 0.3, 1.3, 2.4];
  const ang = (k) => k * Math.PI / 4 + Math.PI / 8;                 // angolo dei vertici dell'ottagono
  const vtx = (k, r) => new THREE.Vector2(Math.cos(ang(k)) * r, Math.sin(ang(k)) * r);
  const side = (k, t, r) => vtx(k, r).lerp(vtx(k + 1, r), t);
  const nSide = (k) => new THREE.Vector3(Math.cos(ang(k) + Math.PI / 8), 0, Math.sin(ang(k) + Math.PI / 8));
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3);
  // le parti, pesate più o meno per la loro superficie
  const parti = [['base', 23], ['logge', 56], ['cornici', 16], ['pilastri', 10], ['tetto', 8], ['lanterna', 2], ['portali', 3]];
  const tot = parti.reduce((s, [, w]) => s + w, 0);
  const scegli = () => { let r = Math.random() * tot; for (const [n, w] of parti) { if ((r -= w) < 0) return n; } return 'base'; };
  const portale = (k, t, y) => k % 2 === 0 && k < 6 && Math.abs(t - 0.5) < 0.16 && y < -2.05 + 0.22 * Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.16) ** 2));
  for (let i = 0; i < N; i++) {
    const k = Math.floor(Math.random() * 8), t = Math.random();
    let v, y, n = nSide(k);
    const parte = scegli();
    if (parte === 'base') {
      y = lerp(y0, lv[1], Math.random());
      if (portale(k, t, y)) { i--; continue; }
      v = side(k, t, R);
    } else if (parte === 'portali') {                                // il fondo scuro dei portali, rientrato
      y = lerp(y0, -1.85, Math.random());
      const tt = 0.5 + (Math.random() - 0.5) * 0.3;
      if (!portale(k, tt, y)) { i--; continue; }
      v = side(k, tt, R * 0.86);
    } else if (parte === 'logge') {
      const b = 1 + Math.floor(Math.random() * 4);
      y = lerp(lv[b] + 0.08, lv[b + 1] - 0.06, Math.random());
      if (Math.random() < 0.55) {
        v = side(k, t, R * 0.88);                                      // il muro di fondo, rientrato dietro le colonnine
      } else {                                                         // le colonnine, cinque per lato
        const j = Math.floor(Math.random() * 5);
        const c = side(k, (j + 0.5) / 5, R * 0.99), a = Math.random() * Math.PI * 2;
        v = new THREE.Vector2(c.x + Math.cos(a) * 0.05, c.y + Math.sin(a) * 0.05);
        n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      }
    } else if (parte === 'cornici') {
      const l = lv[Math.floor(Math.random() * lv.length)];
      if (Math.random() < 0.6) { y = l + (Math.random() - 0.5) * 0.12; v = side(k, t, R * 1.06); }
      else { y = l + 0.06; v = side(k, t, lerp(R * 0.97, R * 1.06, Math.random())); n = new THREE.Vector3(0, 1, 0); }
    } else if (parte === 'pilastri') {
      y = lerp(y0, 3.25, Math.random());
      const c = vtx(k, R * 1.05), tg = new THREE.Vector2(-Math.sin(ang(k)), Math.cos(ang(k)));
      v = c.addScaledVector(tg, (Math.random() - 0.5) * 0.22);
      n = new THREE.Vector3(Math.cos(ang(k)), 0, Math.sin(ang(k)));
    } else if (parte === 'tetto') {
      const s = Math.random();
      y = lerp(2.45, 3.0, s);
      v = side(k, t, lerp(R * 1.02, 0.7, s));
      n = nSide(k).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.87, 0));
    } else {
      y = lerp(3.0, 3.45, Math.random());
      v = side(k, t, 0.45);
    }
    pos.set([v.x, y, v.y], i * 3);
    n.normalize();
    nor.set([n.x, n.y, n.z], i * 3);
  }
  return { pos, nor };
}
// stelle del Battistero di luce: dall'11/11 sera il doppio (prima 18.000), ?stelle=50000 per provare altri numeri
// dal 12/11 sera meno della metà: con 61.200 pallini il sito andava a scatti (?stelle=61200 per rivedere i pieni);
// poi, scelta di Cristiano, gli stessi numeri di prima del 10/11: 18.000 pallini sul computer, 9.000 sui telefoni
const STELLE_BASE = LEGGERO ? 5000 : small ? 7500 : 15000;
// dal 12/11 le stelle diventano pallini rossi di Locus (tondi netti, non aloni di luce); ?grani=luce riporta le stelle
const PALLINI_ROSSI = !BATT_SOLIDO && Q.get('grani') !== 'luce';
// con i pallini rossi il 70% di punti in più, così le linee spesse restano piene
const STELLE = Number(Q.get('stelle')) || Math.round(STELLE_BASE * (PALLINI_ROSSI ? 1.2 : 1));
// rosso spento, come mattone o smalto invecchiato (12/11; prima '#d0180c', '#a80a05', '#e8402a')
// dal 12/11 pomeriggio rosso profondo e lucido, come lacca o granato; ?rosso=prima riporta il mattone di stamattina
const ROSSO_PRIMA = Q.get('rosso') === 'prima';
const ROSSI_LOCUS = (ROSSO_PRIMA ? ['#a8473c', '#8c3a31', '#bf6457'] : ['#8a1712', '#6a0e0b', '#a3241a']).map((h) => new THREE.Color(h));
const BN = BATT_SOLIDO ? (LEGGERO ? 14000 : small ? 26000 : 60000) : STELLE;
const bGeo = new THREE.BufferGeometry();
const bSolido = BATT_SOLIDO ? battisteroSolido(BN) : null;
const bTarget = BATT_SOLIDO ? bSolido.pos : battisteroPoints(BN, PALLINI_ROSSI);
if (BATT_SOLIDO) bGeo.setAttribute('aNormal', new THREE.BufferAttribute(bSolido.nor, 3));
const bRand = new Float32Array(BN * 3);
const bSeed = new Float32Array(BN);
const bColor = new Float32Array(BN * 3);
const MARMO = ['#e8c4b2', '#d9a594', '#f3dccd'].map((h) => new THREE.Color(h));
for (let i = 0; i < BN; i++) {
  // con il Battistero solido la nuvola è raccolta attorno all'edificio, come su Igloo
  const v = new THREE.Vector3().randomDirection().multiplyScalar(BATT_SOLIDO ? 3 + Math.random() * 3.5 : 4 + Math.random() * 9);
  bRand.set([v.x, v.y, v.z], i * 3);
  bSeed[i] = Math.random();
  // con il Battistero solido: il marmo rosa di Verona, in tre toni; prima crema e qualche grano rosso
  const c = BATT_SOLIDO
    ? MARMO[Math.random() < 0.6 ? 0 : Math.random() < 0.75 ? 1 : 2]
    : PALLINI_ROSSI ? ROSSI_LOCUS[Math.random() < 0.6 ? 0 : Math.random() < 0.6 ? 1 : 2]
    : Math.random() < 0.8 ? COL.crema : COL.rossoVivo;
  bColor.set([c.r, c.g, c.b], i * 3);
}
bGeo.setAttribute('position', new THREE.BufferAttribute(bTarget, 3));
bGeo.setAttribute('aRandom', new THREE.BufferAttribute(bRand, 3));
bGeo.setAttribute('aSeed', new THREE.BufferAttribute(bSeed, 1));
bGeo.setAttribute('aColor', new THREE.BufferAttribute(bColor, 3));
const bUni = {
  uTime: { value: 0 }, uForm: { value: 0 }, uBurst: { value: 0 }, uOpacity: { value: 0 },
  uMouse: { value: new THREE.Vector3(0, 0, 999) }, uPixel: { value: renderer.getPixelRatio() },
  uHeat: { value: COL.ambra }, uCenter: { value: new THREE.Vector3(0, 0, battZ) },
  // con più stelle ognuna brilla un po' meno, così l'insieme non diventa una macchia bianca
  uLuce: { value: Math.min(1, Math.sqrt(18000 / BN) * 1.15) },
};
// grani solidi: palline opache con luce e ombra, che arrivano girando a vortice
const battSolidoMat = new THREE.ShaderMaterial({
  uniforms: bUni,
  transparent: true,
  depthWrite: true,
  vertexShader: /* glsl */ `
    attribute vec3 aRandom; attribute float aSeed; attribute vec3 aColor; attribute vec3 aNormal;
    uniform float uTime, uForm, uBurst, uPixel;
    uniform vec3 uMouse, uCenter;
    varying vec3 vColor; varying float vHeat; varying float vLuce;
    void main(){
      float f = smoothstep(0.0, 1.0, clamp(uForm * 1.5 - aSeed * 0.5, 0.0, 1.0));
      // la nuvola gira attorno all'asse dell'edificio e rallenta mentre i grani si posano
      float giro = (1.0 - f) * (3.0 + aSeed * 3.0) + uTime * 0.18 * (1.0 - f);
      float cg = cos(giro), sg = sin(giro);
      vec3 r = vec3(aRandom.x * cg - aRandom.z * sg, aRandom.y * (0.6 + 0.4 * f), aRandom.x * sg + aRandom.z * cg);
      vec3 p = mix(r, position, f);
      // anche posati, i grani tremolano appena
      p += vec3(sin(uTime*0.9 + aSeed*40.0), cos(uTime*0.8 + aSeed*31.0), sin(uTime*0.7 + aSeed*17.0)) * (0.012 + (1.0-f)*0.2);
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vec2 d = wp.xy - uMouse.xy;
      float push = 1.0 - smoothstep(0.0, 0.85, length(d));
      push *= push;
      wp.xy += normalize(d + 1e-4) * push * 0.5;
      wp.z  += push * 0.45;
      wp.xyz += normalize(wp.xyz - uCenter + 1e-4) * uBurst * (1.0 + aSeed * 4.0);
      vec4 mv = viewMatrix * wp;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (2.6 + aSeed * 1.6) * uPixel * (10.0 / -mv.z);
      // luce da sinistra in alto, davanti: la parete in ombra resta scura, da nuvola la luce è uniforme
      vec3 n = normalize(mat3(modelMatrix) * aNormal);
      float l = 0.3 + 0.7 * max(dot(n, normalize(vec3(-0.55, 0.6, 0.6))), 0.0);
      vLuce = mix(0.75, l, f);
      vColor = aColor; vHeat = push;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uHeat; uniform float uOpacity;
    varying vec3 vColor; varying float vHeat; varying float vLuce;
    void main(){
      vec2 q = gl_PointCoord * 2.0 - 1.0;
      float rr = dot(q, q);
      if (rr > 1.0) discard;
      // ogni grano è una pallina: chiara in alto a sinistra, scura sul bordo opposto
      vec3 sn = vec3(q.x, -q.y, sqrt(1.0 - rr));
      float tondo = 0.55 + 0.45 * max(dot(sn, normalize(vec3(-0.45, 0.55, 0.7))), 0.0);
      vec3 c = mix(vColor, uHeat * 1.3, vHeat * 0.6) * vLuce * tondo * 1.2;
      gl_FragColor = vec4(c, uOpacity);
    }`,
});
const batt = new THREE.Points(bGeo, BATT_SOLIDO ? battSolidoMat : new THREE.ShaderMaterial({
  uniforms: bUni,
  transparent: true,
  depthWrite: false,
  // i pallini rossi coprono il fondo come gocce di smalto; le stelle di luce si sommavano
  blending: PALLINI_ROSSI ? THREE.NormalBlending : THREE.AdditiveBlending,
  defines: PALLINI_ROSSI ? (ROSSO_PRIMA ? { PALLINI: 1, ROSSO_PRIMA: 1 } : { PALLINI: 1 }) : {},
  vertexShader: /* glsl */ `
    attribute vec3 aRandom; attribute float aSeed; attribute vec3 aColor;
    uniform float uTime, uForm, uBurst, uPixel;
    uniform vec3 uMouse, uCenter;
    varying vec3 vColor; varying float vHeat; varying float vA;
    void main(){
      float f = smoothstep(0.0, 1.0, clamp(uForm * 1.5 - aSeed * 0.5, 0.0, 1.0));
      vec3 p = mix(aRandom, position, f);
      p += vec3(sin(uTime*0.7 + aSeed*40.0), cos(uTime*0.6 + aSeed*31.0), sin(uTime*0.5 + aSeed*17.0)) * (0.025 + (1.0-f)*0.25);
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vec2 d = wp.xy - uMouse.xy;
      float dist = length(d);
      float push = 1.0 - smoothstep(0.0, 0.85, dist);
      push *= push;
      wp.xy += normalize(d + 1e-4) * push * 0.5;
      wp.z  += push * 0.45;
      wp.xyz += normalize(wp.xyz - uCenter + 1e-4) * uBurst * (1.0 + aSeed * 4.0);
      vec4 mv = viewMatrix * wp;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (2.2 + aSeed * 2.2) * uPixel * (10.0 / -mv.z);
      vColor = aColor; vHeat = push; vA = 0.45 + aSeed * 0.55;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uHeat; uniform float uOpacity, uLuce;
    varying vec3 vColor; varying float vHeat; varying float vA;
    void main(){
      float r = length(gl_PointCoord - 0.5);
    #ifdef PALLINI
      // pallino pieno con il bordo appena morbido e un punto di luce in alto a sinistra, come lo smalto della L
      float a = smoothstep(0.5, 0.42, r);
     #ifdef ROSSO_PRIMA
      float lucido = smoothstep(0.22, 0.0, length(gl_PointCoord - vec2(0.36, 0.34)));
      vec3 c = mix(vColor, uHeat, vHeat * 0.5) + vec3(1.0, 0.8, 0.72) * lucido * 0.18;
     #else
      // lacca e non plastica: il pallino ha volume (bordo più scuro), dentro tiene un riflesso rosso che sale dal basso
      // come in una pietra, e il punto di luce è piccolo, netto, caldo e diverso da un pallino all'altro
      vec2 q = (gl_PointCoord - 0.5) * 2.0;
      vec3 n = vec3(q.x, -q.y, sqrt(max(0.0, 1.0 - dot(q, q))));
      vec3 luce = normalize(vec3(-0.45, 0.55, 0.7));
      float diff = 0.55 + 0.45 * max(dot(n, luce), 0.0);
      float spec = pow(max(dot(reflect(-luce, n), vec3(0.0, 0.0, 1.0)), 0.0), 38.0);
      float dentro = smoothstep(0.1, -0.85, n.y) * (1.0 - n.z) * 0.6;
      vec3 base = mix(vColor, uHeat, vHeat * 0.5);
      vec3 c = base * diff + vColor * vec3(1.6, 0.55, 0.45) * dentro;
      c += vec3(1.0, 0.86, 0.78) * spec * (0.25 + 0.55 * vA);
     #endif
      gl_FragColor = vec4(c, a * uOpacity);
    #else
      float a = smoothstep(0.5, 0.0, r);
      vec3 c = mix(vColor, uHeat * 1.6, vHeat);
      gl_FragColor = vec4(c, a * vA * uOpacity * uLuce);
    #endif
    }`,
}));
batt.position.z = battZ;
scene.add(batt);

// scintille: quando il puntatore esce dal Battistero, una manciata di grani schizza via.
// Sono grani a parte, la struttura resta intera.
const SP = 700;
const spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spSeed = new Float32Array(SP);
for (let i = 0; i < SP; i++) spSeed[i] = Math.random();
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
spGeo.setAttribute('aLife', new THREE.BufferAttribute(spLife, 1));
spGeo.setAttribute('aSeed', new THREE.BufferAttribute(spSeed, 1));
const spUni = { uPixel: { value: renderer.getPixelRatio() } };
const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial({
  uniforms: spUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aLife; attribute float aSeed; uniform float uPixel; varying float vL; varying float vS;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = (2.0 + aSeed * 2.6) * uPixel * (10.0 / -mv.z) * (0.4 + aLife * 0.6); vL = aLife; vS = aSeed; }`,
  fragmentShader: `
    varying float vL; varying float vS;
    void main(){ if (vL <= 0.0) discard; float r = length(gl_PointCoord - 0.5); float a = 1.0 - smoothstep(0.0, 0.5, r);
      vec3 c = mix(vec3(1.0, 0.86, 0.7), vec3(1.0, 0.55, 0.12), vS); gl_FragColor = vec4(c * 1.4, a * vL); }`,
}));
sparks.frustumCulled = false;
scene.add(sparks);
let spCursor = 0, wasInside = false;
const lastInside = new THREE.Vector3(), mPrev = new THREE.Vector3(), mDir = new THREE.Vector3();
function emitSparks(at, dir, n = 140) {
  for (let k = 0; k < n; k++) {
    const i = spCursor; spCursor = (spCursor + 1) % SP;
    const r = new THREE.Vector3().randomDirection();
    const speed = 1.2 + Math.random() * 3.2;
    spPos[i * 3] = at.x + r.x * 0.15; spPos[i * 3 + 1] = at.y + r.y * 0.15; spPos[i * 3 + 2] = at.z + r.z * 0.15;
    spVel[i * 3] = (dir.x * 0.9 + r.x * 0.7) * speed;
    spVel[i * 3 + 1] = (dir.y * 0.9 + r.y * 0.7) * speed;
    spVel[i * 3 + 2] = (r.z * 0.8 + 0.4) * speed;
    spLife[i] = 0.7 + Math.random() * 0.3;
  }
}
function updateSparks(dt) {
  let alive = false;
  for (let i = 0; i < SP; i++) {
    if (spLife[i] <= 0) continue;
    alive = true;
    spLife[i] -= dt / 1.4;
    spVel[i * 3] *= 0.965; spVel[i * 3 + 1] = spVel[i * 3 + 1] * 0.965 - 1.1 * dt; spVel[i * 3 + 2] *= 0.965;
    spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
  }
  if (alive) { spGeo.attributes.position.needsUpdate = true; spGeo.attributes.aLife.needsUpdate = true; }
}

/* ------------------------------------------------------------------ */
/* schermi verticali (telefono): campo visivo più largo e scena in scala */
/* ------------------------------------------------------------------ */
const TAN_V = Math.tan(THREE.MathUtils.degToRad(22.5));
let tanV = TAN_V, focusScale = 1.05;
function fit() {
  const a = innerWidth / innerHeight;
  // in verticale si allarga il campo finché la scena non sta in larghezza
  tanV = a < 1 ? Math.max(TAN_V, 0.31 / a) : TAN_V;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV));
  camera.aspect = a;
  camera.updateProjectionMatrix();
  hero.scale.setScalar(a < 0.8 ? 0.8 : 1);
  // sul telefono le foto si stringono verso il centro, perché stiano nella vista
  const gs = clamp((2 * 10 * tanV * a * 0.96) / 13.5, 0.42, 1);
  gallery.scale.set(gs, gs, 1);
  // foto ingrandita: riempie la vista, anche in verticale
  const H = 2 * 6.1 * tanV, W = H * a;
  focusScale = Math.min((0.88 * W) / PW, (0.8 * H) / PH) / gs;
}
fit();

/* ------------------------------------------------------------------ */
/* scroll morbido e interfaccia                                        */
/* ------------------------------------------------------------------ */
// Quanto scroll serve per ogni tratto del percorso: LUNGO per i cerchi (0,12-0,5), FOTO per le foto (0,5-0,72),
// il resto com'era. Le soglie di tutta la coreografia restano le stesse: si deforma solo il passaggio dallo scroll
// al percorso. ?lungo=2.2 e ?foto=2 per provare.
const LUNGO = Number(Q.get('lungo')) || 2.3;
const FOTO = Number(Q.get('foto')) || 2.2;
const PAG = 1100;
const TRATTI = [[0, 0.12, 1], [0.12, 0.5, LUNGO], [0.5, 0.72, FOTO], [0.72, 1, 1]];
const PAG_LUNGA = TRATTI.reduce((s, [a, b, k]) => s + (b - a) * PAG * k, 0);
{ let r = 0; for (const t of TRATTI) { t.push(r, r + ((t[1] - t[0]) * PAG * t[2]) / PAG_LUNGA); r = t[4]; } }
// dallo scroll (0-1) al punto del percorso (0-1), e il contrario
const percorso = (r) => { const t = TRATTI.find((x) => r <= x[4]) || TRATTI.at(-1); return lerp(t[0], t[1], seg(r, t[3], t[4])); };
const scrollDi = (q) => { const t = TRATTI.find((x) => q <= x[1]) || TRATTI.at(-1); return lerp(t[3], t[4], seg(q, t[0], t[1])); };
document.getElementById('scroll').style.height = `${PAG_LUNGA}svh`;
const lenis = new Lenis({ lerp: 0.07, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.075 });
lenis.stop();
document.body.classList.add('locked');

const $ = (id) => document.getElementById(id);
const gate = $('gate'), cursor = $('cursor'), veil = $('veil');
const layers = {
  hero: $('l-hero'), salta: $('l-salta'), r: [$('l-r1'), $('l-r2'), $('l-r3')], gal: $('l-gal'), batt: $('l-batt'), end: $('l-end'),
};
const goLinks = [...document.querySelectorAll('.go')];
$('l-salta').addEventListener('click', () => segnala('home', 'salta'));
if (isTouch) document.querySelectorAll('[data-touch]').forEach((el) => { el.textContent = el.dataset.touch; });

$('enter').addEventListener('click', () => apri());
// ingresso: la linea sottile segue il caricamento di modelli, foto e riflessi; "entra" compare a carico finito
// (dopo 9 secondi compare comunque, così una foto lenta non blocca nessuno)
{
  const barra = $('carica'), entra = $('enter');
  let pronto = false;
  const fine = () => {
    if (pronto) return;
    pronto = true;
    barra.firstElementChild.style.transform = 'scaleX(1)';
    // dal 12/11 sera: prima di "entra" si preparano tutti i programmi di disegno e si caricano tutte le immagini
    // nella scheda video; prima lo faceva la prima volta che ogni cosa compariva, e il sito scattava
    const t0 = performance.now();
    scaldaScheda().then(() => {
      primoDisegno();
      if (MISURA) annota(`preparazione: ${Math.round(performance.now() - t0)} ms`);
      setTimeout(() => { barra.classList.add('pronta'); entra.disabled = false; }, 450);
    });
  };
  THREE.DefaultLoadingManager.onProgress = (_, fatti, totali) => { barra.firstElementChild.style.transform = `scaleX(${(fatti / totali).toFixed(3)})`; };
  THREE.DefaultLoadingManager.onLoad = fine;
  setTimeout(fine, 9000);
}
function scaldaScheda() {
  // compile guarda solo le cose visibili: per un istante si accende tutto, poi si rimette com'era
  const spenti = [];
  scene.traverse((o) => { if (!o.visible) { spenti.push(o); o.visible = true; } });
  const giri = [renderer.compileAsync(scene, camera)];
  // i materiali dei mondi passano da trasparenti a pieni a dissolvenza finita (mondi.js, opaco): per la scheda
  // video sono due programmi diversi, e il secondo si preparava a metà percorso con un blocco di un quarto di secondo
  const vetri = new Set();
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) if (m.transparent && m.isMeshStandardMaterial) vetri.add(m);
  });
  vetri.forEach((m) => { m.transparent = false; m.needsUpdate = true; });
  giri.push(renderer.compileAsync(scene, camera));
  vetri.forEach((m) => { m.transparent = true; m.needsUpdate = true; });
  const fatto = Promise.all(giri).catch(() => {});
  spenti.forEach((o) => { o.visible = false; });
  const viste = new Set();
  const carica = (v) => { if (v && v.isTexture && !viste.has(v)) { viste.add(v); renderer.initTexture(v); } };
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      for (const k in m) carica(m[k]);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) carica(u.value);
    }
  });
  return fatto;
}
// un disegno di prova di tutta la scena, fuori dallo schermo, con ogni oggetto acceso: così le forme dei mondi
// (fili, fogli, cigni) sono già copiate nella scheda video quando compaiono, invece di bloccare l'immagine in quel momento
function primoDisegno() {
  const cambiati = [];
  scene.traverse((o) => {
    cambiati.push([o, o.visible, o.frustumCulled]);
    o.visible = true; o.frustumCulled = false;
  });
  const prima = renderer.getRenderTarget();
  renderer.setRenderTarget(composer.readBuffer); // lo stesso foglio su cui disegna il sito: il fotogramma dopo lo ricopre
  renderer.render(scene, camera);
  renderer.setRenderTarget(prima);
  cambiati.forEach(([o, v, f]) => { o.visible = v; o.frustumCulled = f; });
}
function apri() {
  gate.classList.add('out');
  document.body.classList.add('entered');
  document.body.classList.remove('locked');
  lenis.start();
}

// uscita verso un'altra pagina: velo scuro
document.querySelectorAll('[data-dissolve]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    veil.classList.add('on');
    lenis.stop();
    ricorda();
    setTimeout(() => { location.href = a.href; }, 1500);
  });
});

/* puntatore */
const mouse = new THREE.Vector2(0, 0);
const mouseS = new THREE.Vector2(0, 0);
const cur = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
let pointerSeen = false;
let lastTouch = -1e9;
const onPointer = (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  cur.tx = e.clientX; cur.ty = e.clientY;
  // il mirino si sposta qui, subito, e non nel ciclo della scena: così non dipende dagli fps del 3D
  cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  pointerSeen = true;
  if (e.pointerType !== 'mouse') lastTouch = performance.now();
};
addEventListener('pointermove', onPointer);
// sopra un link o un pulsante: lo si sa dagli eventi, senza cercarlo nella pagina a ogni fotogramma
let overLink = false;
addEventListener('pointerover', (e) => { overLink = !!e.target.closest?.('a, button'); });
addEventListener('pointerdown', onPointer);

const ray = new THREE.Raycaster();
const battPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -battZ);
const tmpV = new THREE.Vector3();

/* stato della bolla */
let popped = false, popT = 0, wobbleHot = 0;
function pop() {
  if (popped) return;
  popped = true;
}

addEventListener('click', (e) => {
  if (!gate.classList.contains('out') || e.target.closest('a,button')) return;
  ray.setFromCamera(mouse, camera);
  if (hero.visible && !popped && ray.intersectObject(bubble).length) {
    pop();
    if (V2) return;
    lenis.scrollTo(innerHeight * 1.2, { duration: 3.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
    return;
  }
  if (focused) { unfocus(); return; }
  if (shared.uOpacity.value > 0.5) {
    const hit = ray.intersectObjects(cards)[0];
    if (hit) { focusCard(hit.object); return; }
  }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && focused) unfocus(); });

function focusCard(m) {
  focused = m;
  lenis.stop();
}
function unfocus() {
  focused = null;
  lenis.start();
}

/* ------------------------------------------------------------------ */
/* coreografia legata allo scroll                                      */
/* ------------------------------------------------------------------ */
// Dall'11/11 sera (scelta di Cristiano): la camera passa veloce dentro i cerchi e rallenta nei mondi tra un cerchio
// e l'altro, così il passaggio è uno slancio e il mondo si guarda con calma. CERCHI: quante volte più veloce
// sul cerchio rispetto ai tratti in mezzo (?cerchi=4 per provare). Il percorso si calcola una volta in una tabella.
const CERCHI = Number(Q.get('cerchi')) || 2;
const VOLO = (() => {
  const Z0 = 7, Z1 = -58, N = 600, zs = [], ts = [0];
  const vel = (z) => {
    let v = 1;
    for (const r of [-14, -32, -50]) v += (CERCHI - 1) * Math.exp(-(((z - r) / 3.4) ** 2));
    const dai = Math.min(Z0 - z, z - Z1); // partenza e arrivo dolci
    return Math.max(v, 0.12) * (0.18 + 0.82 * Math.min(1, dai / 6) ** 0.8);
  };
  for (let i = 0; i <= N; i++) zs.push(lerp(Z0, Z1, i / N));
  for (let i = 1; i <= N; i++) ts.push(ts[i - 1] + (Z0 - Z1) / N / vel((zs[i] + zs[i - 1]) / 2));
  const T = ts[N];
  return (f) => {
    const t = clamp(f) * T;
    let a = 0, b = N;
    while (b - a > 1) { const m = (a + b) >> 1; if (ts[m] <= t) a = m; else b = m; }
    return lerp(zs[a], zs[b], (t - ts[a]) / Math.max(ts[b] - ts[a], 1e-9));
  };
})();
function cameraZ(p) {
  if (p < 0.12) return lerp(9, 7, ease(seg(p, 0, 0.12)));
  if (p < 0.5) return VOLO(seg(p, 0.12, 0.5));
  if (p < 0.72) return -58;
  if (p < 0.92) return lerp(-58, -64, ease(seg(p, 0.72, 0.92)));
  return lerp(-64, -63, ease(seg(p, 0.92, 1)));
}
const BG_KEYS = [
  // dal 10/11 lo stesso rosso scuro lungo tutto il percorso (prima quasi nero, con il rosso solo nel tratto dei cerchi)
  [0, '#2b0d0c'], [1, '#2b0d0c'],
].map(([k, c]) => [k, new THREE.Color(c)]);
function bgAt(p) {
  for (let i = 0; i < BG_KEYS.length - 1; i++) {
    const [a, ca] = BG_KEYS[i], [b, cb] = BG_KEYS[i + 1];
    if (p <= b) return bg.copy(ca).lerp(cb, seg(p, a, b));
  }
  return bg.copy(BG_KEYS.at(-1)[1]);
}
function showLayer(el, v) {
  el.style.opacity = v.toFixed(3);
  el.style.transform = `translateY(${((1 - v) * 24).toFixed(1)}px)`;
}

/* ------------------------------------------------------------------ */
/* ciclo                                                               */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();

// qualità adattiva: se il computer fatica, si abbassa la risoluzione; se c'è margine, si rialza
const PR_MAX = renderer.getPixelRatio();
// sui telefoni sotto 1,25 l'immagine si sgrana; sui computer si può scendere fino a 0,75 (lo schermo è grande e il bagliore ammorbidisce)
const PR_MIN = Math.min(PR_MAX, isTouch ? (LEGGERO ? 1 : 1.25) : 0.75);
let pr = PR_MAX, qAcc = 0, qFrames = 0, qGood = 0;
function setPR(v) {
  if (MISURA) annota(`risoluzione ${pr.toFixed(2)} → ${v.toFixed(2)}`);
  pr = v;
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  bUni.uPixel.value = pr;
}
const FIXED_Q = new URLSearchParams(location.search).has('fisso');
// dal 12/11 sera il computer ricorda la risoluzione che regge: alla visita dopo si parte già da lì,
// senza i cali a metà percorso (ogni cambio di risoluzione blocca l'immagine per un istante). ?azzera la dimentica
const PR_CHIAVE = 'locus-risoluzione';
function adaptQuality(dt) {
  if (document.hidden || FIXED_Q || !document.hasFocus()) return;
  qAcc += dt; qFrames++;
  if (qAcc < 1) return;
  const fps = qFrames / qAcc;
  qAcc = 0; qFrames = 0;
  if (fps < 40 && pr > PR_MIN) {
    setPR(Math.max(PR_MIN, pr - 0.25)); qGood = 0;
    try { localStorage.setItem(PR_CHIAVE, String(pr)); } catch (_) { /* niente */ }
  }
  // dal 12/11 sera la risoluzione scende e non risale: l'altalena giù/su bloccava l'immagine a ogni cambio
}
let prevCamZ = 9, vel = 0, hot = false, scossa = 0;

// dal 12/11 sera: se la finestra del sito non è quella in uso (si lavora in un altro programma), si disegnano
// 10 fotogrammi al secondo invece di 60, così il sito non occupa la scheda video al posto degli altri programmi
let ultimoDisegno = 0;
// ?misura: in alto a destra fotogrammi al secondo, punto del percorso e risoluzione, per capire quale tratto pesa
const MISURA = Q.has('misura') ? Object.assign(document.body.appendChild(document.createElement('div')), {
  style: 'position:fixed;top:8px;right:8px;z-index:9999;font:12px monospace;color:#fff;background:#0009;padding:4px 8px;pointer-events:none;white-space:pre',
}) : null;
let mAcc = 0, mN = 0;
// sotto la riga dei fotogrammi, le ultime 12 annotazioni (blocchi e preparazione), senza aprire la console
const note = [];
let pOra = 0;
function annota(t) { t += ` · percorso ${pOra.toFixed(2)}`; console.log('[misura] ' + t); note.push(t); if (note.length > 12) note.shift(); }
// (qui e non sopra: setPR scrive nel riquadro di ?misura, che deve già esistere)
try {
  if (Q.has('azzera')) localStorage.removeItem(PR_CHIAVE);
  const ricordata = Number(localStorage.getItem(PR_CHIAVE));
  if (!FIXED_Q && ricordata && ricordata < pr) setPR(Math.max(PR_MIN, ricordata));
} catch (_) { /* memoria del browser non disponibile */ }
// con ?misura, nella console del browser ogni blocco sopra i 50 ms, con il punto in cui è successo
if (MISURA && 'PerformanceObserver' in window) {
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((x) => annota(`blocco ${Math.round(x.duration)} ms a ${(x.startTime / 1000).toFixed(1)} s`))).observe({ type: 'longtask', buffered: true });
  } catch (_) { /* il browser non li registra */ }
}
function frame(time) {
  if (!document.hasFocus() && time - ultimoDisegno < 95) { requestAnimationFrame(frame); return; }
  ultimoDisegno = time;
  if (import.meta.env.DEV) { window.__frames = (window.__frames || 0) + 1; }
  lenis.raf(time);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const p = lenis.limit > 0 ? percorso(clamp(lenis.scroll / lenis.limit)) : 0;
  vel = lerp(vel, clamp(lenis.velocity / 30, -1.5, 1.5), 0.08);
  mouseS.lerp(mouse, 0.06);
  hot = false;

  /* camera */
  const cz = cameraZ(p);
  const flight = seg(p, 0.12, 0.5);
  camera.position.set(mouseS.x * 0.45, mouseS.y * 0.3, cz);
  tmpV.set(mouseS.x * 0.15, mouseS.y * 0.1, cz - 10);
  camera.lookAt(tmpV);
  if (!MENO_MOTO) camera.rotateZ(Math.sin(flight * Math.PI * 2) * 0.09 * Math.sin(flight * Math.PI));
  const fovVoluto = THREE.MathUtils.radToDeg(2 * Math.atan(tanV));
  if (Math.abs(camera.fov - fovVoluto) > 0.01) { camera.fov = fovVoluto; camera.updateProjectionMatrix(); }
  // passando un cerchio l'immagine si sfoca per un istante, come su Igloo, e torna nitida in un terzo di secondo
  if (MENO_MOTO) scossa = 0;
  sfocaPass.enabled = scossa > 0.003;
  sfocaPass.uniforms.uS.value = scossa;
  scossa *= Math.exp(-dt * 6.0); // dall'11/11 più forte e un filo più lunga
  // il mondo cambia appena attraversi un cerchio, e torna com'era se torni indietro
  if (PORTALE) mondi({ dt, t, cz, p, camera, bg, dustMat, ringLight });
  else bgAt(p);
  scene.fog.color.copy(bg);
  if (riapriPass.enabled) {
    riapriT = Math.min(1, riapriT + dt / 1.2);
    riapriPass.uniforms.uOpen.value = ease(riapriT);
    riapriPass.uniforms.uTime.value = t;
    if (riapriT >= 1) riapriPass.enabled = false;
  }
  glowUni.uBg.value.copy(bg);
  glowUni.uTime.value = clock.elapsedTime;

  /* 1. bolla e L */
  hero.visible = cz > -9;
  const leave = V2 ? ease(seg(p, 0.09, 0.21)) : ease(seg(p, 0.07, 0.2));
  hero.position.set(leave * -1.5, leave * 6.5, -leave * 4);
  hero.rotation.z = leave * 0.5;
  if (hero.visible) {
    if (p > 0.025) pop();
    if (p < 0.004 && popped && popT > 0.99) popped = false; // tornando in cima la bolla si riforma
    popT = clamp(popT + (popped ? dt / 1.1 : -dt / 1.8));
    ray.setFromCamera(mouse, camera);
    const overBubble = !popped && pointerSeen && ray.intersectObject(bubble).length > 0;
    if (overBubble) hot = true;
    wobbleHot = lerp(wobbleHot, overBubble ? 1 : 0, 0.05);
    bubbleUniforms.uTime.value = t;
    bubbleUniforms.uPop.value = ease(popT);
    bubbleUniforms.uWobble.value = 1 + wobbleHot * 0.8;
    bubble.visible = popT < 0.999;

    // goccioline
    dropMat.opacity = popT > 0 && popT < 1 ? (1 - popT) * 0.9 : 0;
    if (dropMat.opacity > 0) {
      const e = ease(popT);
      for (let i = 0; i < DROPS; i++) {
        const r = 2.9 + e * 4.5 * dropSpd[i];
        dropPos[i * 3] = dropDir[i * 3] * r;
        dropPos[i * 3 + 1] = dropDir[i * 3 + 1] * r - e * e * 2.2;
        dropPos[i * 3 + 2] = dropDir[i * 3 + 2] * r;
      }
      dropGeo.attributes.position.needsUpdate = true;
    }

    // la L segue il puntatore e respira
    lMesh.rotation.y = lerp(lMesh.rotation.y, mouseS.x * 0.6 + Math.sin(t * 0.4) * 0.15, 0.08);
    lMesh.rotation.x = lerp(lMesh.rotation.x, -mouseS.y * 0.4, 0.08);
    lMesh.position.y = Math.sin(t * 0.8) * 0.08;
    if (V2) {
      // la L nasce dallo scoppio: cresce da zero con un mezzo giro, un filo oltre la misura e poi si assesta
      const k = clamp((popT - 0.15) / 0.85);
      const nasce = k <= 0 ? 0 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
      lMesh.scale.setScalar(Math.max(nasce, 0.0001));
      lMesh.rotation.z = (1 - k) * (1 - k) * Math.PI * 0.5;
      brackets.scale.setScalar(Math.max(nasce, 0.0001));
    }
    const spread = 1 + wobbleHot * 0.12 + ease(popT) * 0.25;
    corners.forEach((c) => {
      c.position.set(c.userData.sx * 1.75 * spread, c.userData.sy * 1.95 * spread, 0.5);
    });
    brackets.rotation.y = lMesh.rotation.y * 0.5;
    brackets.rotation.x = lMesh.rotation.x * 0.5;
  }

  /* 2. anelli */
  let mood = 0.3;
  // all'apertura si vedono solo la L e la bolla: gli anelli si accendono mentre la L se ne va
  const appear = ease(seg(p, 0.11, 0.2));
  if (ondaPass.enabled) {
    ondaT = Math.min(1, ondaT + dt / 1.4);
    ondaPass.uniforms.uK.value = ondaT;
    ondaPass.uniforms.uAmp.value = 0.018 * ondaForza;
    if (ondaT >= 1) ondaPass.enabled = false;
  }
  ringLight.position.set(3.5, 4, cz - 3);
  ringLight.intensity = TUBI ? 60 * appear : 0; // spenta all'apertura, così la L resta illuminata come prima
  RINGS.forEach((r, i) => {
    r.group.visible = appear > 0.002;
    r.core.material.opacity = appear;
    r.metalMat.opacity = appear;
    r.tubeMat.opacity = appear;
    // la luce interna è quasi uguale nei tre cerchi (cresce appena) e resta sotto la soglia del bagliore
    // con la luce pura lo smalto resta tutto rosso (l'11/11 Cristiano: niente parte rosa sul tubo)
    r.uInner.value.copy(LUCE_INTERNA).multiplyScalar(LUCE_PURA ? 0 : (0.3 + 0.12 * (r.glow || 1)) * appear * (1 + r.flash * 0.5));
    r.filMat.opacity = appear;
    r.filMat.color.copy(LUCE_INTERNA).multiplyScalar((1.5 + 0.5 * (r.glow || 1)) * (1 + r.flash * 0.4));
    r.grains.material.opacity = 0.75 * appear;
    if (!V2) r.group.rotation.z += dt * (0.04 + i * 0.015); // le parentesi restano dritte, come nel logo
    r.grains.rotation.z -= dt * 0.18;
    r.ticks.rotation.z -= dt * 0.05;
    const d = cz - r.z;
    if (RIEMPI) {
      // si riempie da 12 unità di distanza ed è pieno a 1,5; dopo il tuffo resta vuoto finché non torni lontano davanti
      if (prevCamZ > r.z && cz <= r.z) { r.passato = true; riapri(); }
      if (d > 12) r.passato = false;
      r.discoUni.uFill.value = !r.passato && d > 0 ? ease(seg(d, 12, 1.5)) : 0;
      r.discoUni.uTime.value = t;
      r.disco.rotation.z = -r.group.rotation.z; // il riflesso resta in alto a sinistra mentre il cerchio gira
    }
    // velo: si rompe appena prima che la camera lo tocchi, in avanti o all'indietro; si riforma quando si torna davanti
    if (prevCamZ > r.z + 0.6 && cz <= r.z + 0.6) rompi(r, 1);
    if (prevCamZ < r.z - 0.6 && cz >= r.z - 0.6) rompi(r, -1);
    if (prevCamZ > r.z && cz <= r.z) onda(1);
    if (prevCamZ < r.z && cz >= r.z) onda(0.5);
    if (r.rotto && cz > r.z + 4) r.rotto = false;
    r.popT = clamp(r.popT + (r.rotto ? dt / 0.35 : -dt / 1.5));
    r.veloUni.uTime.value = t;
    r.veloUni.uPop.value = ease(r.popT);
    r.veloUni.uFade.value = appear;
    if (r.dropT < 1) {
      r.dropT = Math.min(1, r.dropT + dt / 1.8);
      for (let k = 0; k < r.ND * 3; k++) { r.vdPos[k] += r.vdVel[k] * dt; r.vdVel[k] *= 0.985; }
      r.vdGeo.attributes.position.needsUpdate = true;
      r.vdMat.opacity = (1 - r.dropT) * 0.9;
    } else r.vdMat.opacity = 0;
    // passaggio dentro l'anello: lampo di luce e soffio
    if (prevCamZ > r.z && cz <= r.z) { r.flash = 1; scossa = 1; }
    if (prevCamZ < r.z && cz >= r.z) { r.flash = 0.5; scossa = 0.5; }
    r.flash *= 0.94;
    const fade = 1 - seg(Math.abs(d), 16, 44);
    const close = seg(Math.abs(d), 0.5, 7); // da vicino l'alone si ritira, sennò invade lo schermo
    for (const m of [r.beam, r.haze, r.edgeBeam, r.innerGlow]) {
      const u = m.material.uniforms;
      u.uTime.value = t; u.uFlash.value = r.flash;
      u.uFade.value = appear * fade * (m === r.haze ? lerp(0.08, 1, close) : lerp(0.45, 1, close));
    }
    const near = clamp(1 - Math.abs(d) / 14);
    r.group.scale.setScalar(1 + near * 0.05 * Math.sin(t * 2 + i));
    r.group.rotation.x = mouseS.y * 0.14 * near;
    r.group.rotation.y = mouseS.x * 0.14 * near;
    // con i mondi la parola arriva quando attraversi il suo cerchio e resta finché dura il suo mondo:
    // Conosci con le pagine, Incontra con i fili, Costruisci con i cigni
    const vis = PORTALE
      ? Math.min(seg(-d, 0.3, 2.5), i < RINGS.length - 1 ? 1 - seg(-d, 15, 17.5) : 1 - seg(p, 0.44, 0.48))
      : Math.min(seg(d, 14, 8), 1 - seg(d, 2, -1.5));
    showLayer(layers.r[i], vis);
    if (d < 16 && d > -2) mood = r.mood;
  });
  bloom.strength = 0.45 + RINGS.reduce((s, r) => s + r.flash, 0) * 0.35;

  /* 3. foto sospese */
  gallery.visible = p > 0.42 && p < 0.8;
  shared.uOpacity.value = win(p, 0.44, 0.5, 0.72, 0.77);
  shared.uTime.value = t;
  shared.uVel.value = lerp(shared.uVel.value, focused ? 0 : vel, 0.1);
  if (gallery.visible) {
    // la camera è ferma a -58: è il campo di foto che le viene incontro, la prima da 14 di distanza, l'ultima fin dietro le spalle
    const run = seg(p, 0.45, 0.72);
    const last = (NCARDS - 1) * STEP_Z;
    gallery.position.z = lerp(cz - 14, cz + 4 + last, run);
    gallery.position.x = Math.sin(t * 0.21) * 0.15;
    ray.setFromCamera(mouse, camera);
    const hit = !focused && pointerSeen && shared.uOpacity.value > 0.5 ? ray.intersectObjects(cards)[0] : null;
    cards.forEach((m) => {
      const ud = m.userData;
      // compare da lontano, sparisce appena ti passa accanto
      const d = cz - (gallery.position.z + ud.base.z);
      ud.u.uFade.value = focused === m ? 1 : seg(d, 0.8, 3.5) * (1 - seg(d, 22, 30));
      ud.hover = lerp(ud.hover, hit && hit.object === m ? 1 : 0, 0.08);
      ud.focus = lerp(ud.focus, focused === m ? 1 : 0, 0.075);
      ud.u.uHover.value = ud.hover;
      ud.u.uFocus.value = ud.focus;
      ud.u.uDim.value = lerp(ud.u.uDim.value, focused && focused !== m ? 1 : 0, 0.08);
      // ognuna galleggia piano per conto suo
      tmpV2.copy(ud.base);
      tmpV2.y += Math.sin(t * 0.35 + ud.i * 1.7) * 0.18;
      tmpV2.x += Math.sin(t * 0.27 + ud.i * 2.3) * 0.1;
      // zoom al clic: la foto viene davanti e riempie la vista
      tmpV.set(camera.position.x, camera.position.y, cz - 6.1);
      m.parent.worldToLocal(tmpV);
      const f = ease(ud.focus);
      m.position.lerpVectors(tmpV2, tmpV, f);
      m.rotation.y = ud.turn * (1 - f);
      m.scale.setScalar((1 + ud.hover * 0.04) * lerp(1, focusScale, f));
    });
    if (hit) hot = true;
    if (focused) hot = true;
  }
  showLayer(layers.gal, win(p, 0.5, 0.54, 0.69, 0.73) * (focused ? 0 : 1));

  /* 4. Battistero */
  batt.visible = p > 0.64;
  if (batt.visible) {
    bUni.uTime.value = t;
    bUni.uForm.value = ease(seg(p, 0.7, 0.86));
    bUni.uOpacity.value = seg(p, 0.66, 0.74) * (1 - seg(p, 0.92, 0.98) * 0.7);
    bUni.uBurst.value *= 0.93;
    batt.rotation.y += dt * 0.08;
    batt.rotation.x = mouseS.y * 0.12;
    ray.setFromCamera(mouse, camera);
    if (pointerSeen && ray.ray.intersectPlane(battPlane, tmpV)) {
      bUni.uMouse.value.lerp(tmpV, 0.25);
      mDir.subVectors(tmpV, mPrev);
      mPrev.copy(tmpV);
      const formed = bUni.uForm.value > 0.6 && bUni.uOpacity.value > 0.5;
      const inside = formed && Math.abs(tmpV.x) < 2.45 && tmpV.y > -3.4 && tmpV.y < 3.5;
      if (inside) { hot = true; lastInside.copy(tmpV); }
      // appena il puntatore esce dalla struttura, i grani schizzano via nella direzione del movimento
      if (wasInside && !inside && formed) {
        if (mDir.lengthSq() < 1e-6) mDir.set(Math.sign(tmpV.x) || 1, 0, 0);
        emitSparks(lastInside, mDir.normalize(), 150);
      }
      wasInside = inside;
    }
  }
  updateSparks(dt);
  showLayer(layers.batt, win(p, 0.79, 0.83, 0.9, 0.93));

  /* apertura e chiusura */
  showLayer(layers.hero, gate.classList.contains('out') ? 1 - seg(p, 0.012, 0.05) : 0);
  const saltaV = gate.classList.contains('out') ? 0.75 * (1 - seg(p, 0.006, 0.03)) : 0;
  layers.salta.style.opacity = saltaV.toFixed(3);
  layers.salta.style.pointerEvents = saltaV > 0.3 ? 'auto' : 'none';
  const endV = seg(p, 0.92, 0.96); // dall'11/11 un po' prima (era 0,94 a 0,985): "Chi siamo" arriva prima
  showLayer(layers.end, endV);
  if (endV > 0.6) segnala('home', 'fine-percorso');
  goLinks.forEach((l) => { l.style.pointerEvents = endV > 0.6 ? 'auto' : 'none'; });

  /* suono: il colore cambia con la sezione e si apre con la velocità */
  if (p > 0.47 && p < 0.76) mood = 0.6;
  else if (p >= 0.76) mood = 0.25 + seg(p, 0.76, 0.9) * 0.3 - seg(p, 0.93, 1) * 0.35;
  else if (p < 0.1) mood = 0.2 + (popped ? 0.2 : 0);

  /* cursore */
  cur.x = cur.tx; cur.y = cur.ty;
  cursor.classList.toggle('hot', hot || overLink);

  aggiornaBolla(t);
  prevCamZ = cz;
  adaptQuality(dt);
  if (MISURA) {
    pOra = p;
    mAcc += dt; mN++;
    if (mAcc > 0.5) { MISURA.textContent = [`${Math.round(mN / mAcc)} fps · percorso ${p.toFixed(2)} · risoluzione ${pr.toFixed(2)}`, ...note].join(String.fromCharCode(10)); mAcc = 0; mN = 0; }
  }
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
/* ------------------------------------------------------------------ */
/* tornare indietro: si riprende dal punto in cui si era, senza ripassare dall'ingresso */
/* ------------------------------------------------------------------ */
history.scrollRestoration = 'manual';
function ricorda() { try { sessionStorage.setItem('locus-home', String(lenis.scroll)); } catch (e) {} }
addEventListener('pagehide', ricorda);
storia({ prima: ricorda });
function riprendi(y) {
  if (y > 0) { popped = true; popT = 1; }
  apri();
  lenis.scrollTo(y, { immediate: true, force: true });
}
let saved = null;
try { saved = sessionStorage.getItem('locus-home'); } catch (e) {}
if (daStoria() && saved !== null) riprendi(Number(saved) || 0);
if (import.meta.env.DEV && new URLSearchParams(location.search).has('vai')) {
  const q = Number(new URLSearchParams(location.search).get('vai')) || 0;
  setTimeout(() => riprendi(scrollDi(q) * lenis.limit), 400);
}
// pagina ripresa dalla memoria del browser: tutto è com'era, basta togliere il velo e far ripartire lo scroll
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  veil.classList.remove('on');
  if (gate.classList.contains('out')) lenis.start();
});

if (import.meta.env.DEV) window.__dbg = { scene, renderer, composer, backGlow, lMesh, lMat, bubble, setPR };

addEventListener('resize', () => {
  fit();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  ondaPass.uniforms.uAspect.value = innerWidth / innerHeight;
  riapriPass.uniforms.uAspect.value = innerWidth / innerHeight;
});
