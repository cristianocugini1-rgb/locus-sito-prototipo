import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import Lenis from 'lenis';
import { Ambient } from './audio.js';

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
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const bg = new THREE.Color('#140404');
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
function makeL() {
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
    depth: 0.7, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.085, bevelSegments: 12, curveSegments: 48,
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
const lMesh = new THREE.Mesh(makeL(), lMat);
hero.add(lMesh);

// controluce: un alone caldo dietro la L, che il vetro raccoglie e accende di rosso
const glowUni = { uBg: { value: new THREE.Color('#140404') }, uTime: { value: 0 } };
const backGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(9, 9),
  new THREE.ShaderMaterial({
    uniforms: glowUni,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uBg; uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 q = vUv - 0.5;
        float r = length(q * vec2(1.0, 0.92));
        float core = 1.0 - smoothstep(0.0, 0.22, r);
        float halo = 1.0 - smoothstep(0.02, 0.5, r);
        vec3 warm = mix(vec3(0.30, 0.025, 0.012), vec3(0.95, 0.30, 0.10), core * core);
        float breathe = 0.9 + 0.1 * sin(uTime * 0.7);
        gl_FragColor = vec4(warm * breathe * halo * halo * 0.55, 1.0);
      }`,
  })
);
backGlow.position.z = -1.6;
hero.add(backGlow);

// gli angoli del mirino, come nel logo
const brackets = new THREE.Group();
const brMat = new THREE.MeshBasicMaterial({ color: COL.crema.clone().multiplyScalar(1.25) });
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

// la bolla: bordo iridescente, centro trasparente, superficie che respira
const bubbleUniforms = { uTime: { value: 0 }, uWobble: { value: 1 }, uPop: { value: 0 } };
const bubble = new THREE.Mesh(
  new THREE.SphereGeometry(2.9, 96, 96),
  new THREE.ShaderMaterial({
    uniforms: bubbleUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uWobble, uPop;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec3 p = position;
        float w = sin(p.y*2.2 + uTime*1.4) * 0.022 + sin(p.x*3.1 - uTime*1.1) * 0.018 + sin(p.z*2.7 + uTime*0.9)*0.014;
        p += normal * w * uWobble;
        p *= 1.0 + uPop * 0.35;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vP = p;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPop;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      vec3 irid(float t){ return 0.5 + 0.5*cos(6.2831*(t + vec3(0.0, 0.18, 0.38))); }
      void main(){
        float f = pow(1.0 - abs(dot(vN, vV)), 2.4);
        vec3 c = irid(f*1.3 + vP.y*0.12 + uTime*0.04);
        c = mix(c, vec3(1.0, 0.72, 0.55), 0.35);          // scaldata verso il crema
        vec3 l = normalize(vec3(0.5, 0.7, 0.6));
        float spec = pow(max(dot(reflect(-l, vN), vV), 0.0), 420.0) * 1.6 + pow(max(dot(reflect(-normalize(vec3(-0.6, 0.2, 0.7)), vN), vV), 0.0), 900.0) * 0.8;
        float a = (f * 0.75 + 0.03) * (1.0 - uPop);
        gl_FragColor = vec4(c * (0.6 + f) + spec * 1.8, a + spec*(1.0-uPop));
      }`,
  })
);
hero.add(bubble);

// goccioline che volano via quando la bolla scoppia
const DROPS = small ? 700 : 1400;
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
{
  const N = small ? 1500 : 3000;
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    p.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, 12 - Math.random() * 105], i * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.05, map: DOT, color: '#f3c9a8', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  })));
}

/* ------------------------------------------------------------------ */
/* 2. I TRE ANELLI in cui si entra scorrendo                           */
/* ------------------------------------------------------------------ */
const RINGS = [
  { z: -14, color: COL.rosso, glow: 3.2, mood: 0.35 },
  { z: -32, color: COL.arancio, glow: 1.6, mood: 0.7 },
  { z: -50, color: COL.crema, glow: 0.55, mood: 0.5 },
];
RINGS.forEach((r, i) => {
  const g = new THREE.Group();
  g.position.z = r.z;
  const main = new THREE.Mesh(
    new THREE.TorusGeometry(4.6, 0.075, 24, 280),
    new THREE.MeshStandardMaterial({ color: r.color, emissive: r.color, emissiveIntensity: r.glow, roughness: 0.3, metalness: 0.1 })
  );
  const thin = new THREE.Mesh(
    new THREE.TorusGeometry(5.05, 0.012, 8, 280),
    new THREE.MeshBasicMaterial({ color: COL.crema.clone().multiplyScalar(1.2), transparent: true, opacity: 0.7 })
  );
  // anello di grani che gira al contrario
  const N = small ? 900 : 1800;
  const pg = new THREE.BufferGeometry();
  const pp = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const a = Math.random() * Math.PI * 2;
    const rad = 4.6 + (Math.random() - 0.5) * 1.3 * Math.random();
    pp.set([Math.cos(a) * rad, Math.sin(a) * rad, (Math.random() - 0.5) * 0.6], k * 3);
  }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const grains = new THREE.Points(pg, new THREE.PointsMaterial({
    size: 0.06, map: DOT, color: r.color.clone().lerp(COL.crema, 0.5), transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  g.add(main, thin, grains);
  g.rotation.z = i * 0.7;
  scene.add(g);
  Object.assign(r, { group: g, main, thin, grains, flash: 0, passed: false });
});

/* ------------------------------------------------------------------ */
/* 3. IL NASTRO DI SETA: foto che ondeggiano con la velocità           */
/* ------------------------------------------------------------------ */
const PHOTOS = Array.from({ length: 12 }, (_, i) => `${import.meta.env.BASE_URL}foto/foto-${String(i + 1).padStart(2, '0')}.jpg`);
const galleryZ = -68;
const gallery = new THREE.Group();
gallery.position.set(0, 0, galleryZ);
scene.add(gallery);
const shared = { uTime: { value: 0 }, uVel: { value: 0 }, uOpacity: { value: 0 } };
const PW = 3.6, PH = 4.5, GAP = 4.5;

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
  };
  loader.load(src, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    u.uTex.value = t;
    u.uImgAspect.value = t.image.width / t.image.height;
  }, undefined, () => {});
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(PW, PH, 48, 48),
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
          float dx = wp.x - cameraPosition.x;
          float wave = sin(wp.x * 0.55 + wp.y * 0.3 + uTime * 1.3);
          wp.z -= dx * dx * 0.03 * k;                       // il nastro curva come un cilindro
          wp.z += wave * uVel * 1.1 * k;                    // e ondeggia come seta quando corre
          wp.y += cos(wp.x * 0.35 + uTime * 0.9) * uVel * 0.4 * k;
          vShade = wave * uVel * k;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uImgAspect, uPlaneAspect, uOpacity, uHover, uVel, uDim;
        varying vec2 vUv; varying float vShade;
        vec2 cover(vec2 uv){
          float r = uPlaneAspect / uImgAspect;
          vec2 s = r < 1.0 ? vec2(r, 1.0) : vec2(1.0, 1.0 / r);
          return (uv - 0.5) * s + 0.5;
        }
        void main(){
          vec2 uv = cover((vUv - 0.5) * (1.0 - uHover * 0.07) + 0.5);
          float sh = uVel * 0.006;
          vec3 c = vec3(texture2D(uTex, uv + vec2(sh, 0.0)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(sh, 0.0)).b);
          c *= 1.0 + vShade * 0.22;                          // riflesso della seta
          c += vec3(0.10, 0.03, 0.0) * max(vShade, 0.0);
          vec2 e = smoothstep(0.0, 0.012, vUv) * smoothstep(0.0, 0.012, 1.0 - vUv);
          c *= 1.0 - uDim * 0.75;
          gl_FragColor = vec4(c, uOpacity * e.x * e.y);
        }`,
    })
  );
  m.position.x = i * GAP;
  m.userData = { i, u, base: new THREE.Vector3(i * GAP, 0, 0), focus: 0, hover: 0 };
  gallery.add(m);
  return m;
});
let focused = null;

/* ------------------------------------------------------------------ */
/* 4. IL BATTISTERO DI GRANI                                           */
/* ------------------------------------------------------------------ */
const battZ = -76;
function battisteroPoints(N) {
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
    if (r < 0.32) { // cornici orizzontali
      y = levels[Math.floor(Math.random() * levels.length)] + (Math.random() - 0.5) * 0.06;
      v = onSide(k, Math.random(), R * 1.02);
    } else if (r < 0.6) { // colonnine delle logge
      const j = Math.floor(Math.random() * 5);
      const band = 1 + Math.floor(Math.random() * 4);
      y = lerp(levels[band], levels[band + 1], Math.random());
      v = onSide(k, (j + 0.5) / 5 + (Math.random() - 0.5) * 0.02, R * 0.97);
    } else if (r < 0.75) { // parete del basamento, con tre portali
      y = lerp(y0, levels[1], Math.random());
      const t = Math.random();
      const inArch = (k % 2 === 0) && Math.abs(t - 0.5) < 0.16 && y < -2.05;
      if (inArch) { i--; continue; }
      v = onSide(k, t, R);
    } else if (r < 0.88) { // pilastri d'angolo che salgono oltre il tetto
      y = lerp(y0, 3.25, Math.random());
      v = vtx(k, R * 1.03);
      v.x += (Math.random() - 0.5) * 0.08; v.y += (Math.random() - 0.5) * 0.08;
    } else if (r < 0.97) { // tetto ottagonale basso
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
const BN = small ? 9000 : 18000;
const bGeo = new THREE.BufferGeometry();
const bTarget = battisteroPoints(BN);
const bRand = new Float32Array(BN * 3);
const bSeed = new Float32Array(BN);
const bColor = new Float32Array(BN * 3);
for (let i = 0; i < BN; i++) {
  const v = new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 9);
  bRand.set([v.x, v.y, v.z], i * 3);
  bSeed[i] = Math.random();
  const c = Math.random() < 0.8 ? COL.crema : COL.rossoVivo;
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
};
const batt = new THREE.Points(bGeo, new THREE.ShaderMaterial({
  uniforms: bUni,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
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
      float push = smoothstep(1.7, 0.0, dist);
      wp.xy += normalize(d + 1e-4) * push * 0.9;
      wp.z  += push * 0.9;
      wp.xyz += normalize(wp.xyz - uCenter + 1e-4) * uBurst * (1.0 + aSeed * 4.0);
      vec4 mv = viewMatrix * wp;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (2.2 + aSeed * 2.2) * uPixel * (10.0 / -mv.z);
      vColor = aColor; vHeat = push; vA = 0.45 + aSeed * 0.55;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uHeat; uniform float uOpacity;
    varying vec3 vColor; varying float vHeat; varying float vA;
    void main(){
      float r = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, r);
      vec3 c = mix(vColor, uHeat * 1.6, vHeat);
      gl_FragColor = vec4(c, a * vA * uOpacity);
    }`,
}));
batt.position.z = battZ;
scene.add(batt);

/* ------------------------------------------------------------------ */
/* scroll morbido, audio, interfaccia                                  */
/* ------------------------------------------------------------------ */
const lenis = new Lenis({ lerp: 0.07, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.075 });
lenis.stop();
document.body.classList.add('locked');

const audio = new Ambient();
const $ = (id) => document.getElementById(id);
const gate = $('gate'), soundBtn = $('sound'), cursor = $('cursor'), veil = $('veil');
const layers = {
  hero: $('l-hero'), r: [$('l-r1'), $('l-r2'), $('l-r3')], gal: $('l-gal'), batt: $('l-batt'), end: $('l-end'),
};
const goLink = document.querySelector('.go');

// ?muto nell'indirizzo: il sito parte senza suono (serve per le prove)
const MUTE = new URLSearchParams(location.search).has('muto');
$('enter').addEventListener('click', () => {
  if (MUTE) audio.muted = true;
  audio.start();
  if (MUTE) { soundBtn.classList.add('off'); }
  gate.classList.add('out');
  soundBtn.classList.add('on');
  document.body.classList.remove('locked');
  lenis.start();
});
soundBtn.addEventListener('click', () => {
  const m = !audio.muted;
  audio.setMuted(m);
  soundBtn.classList.toggle('off', m);
  soundBtn.classList.toggle('on', !m);
});
document.addEventListener('visibilitychange', () => audio.duck(document.hidden));
addEventListener('blur', () => audio.duck(true));
addEventListener('focus', () => { if (!document.hidden) audio.duck(false); });

// uscita verso un'altra pagina: velo scuro e musica che si dissolve
document.querySelectorAll('[data-dissolve]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    veil.classList.add('on');
    lenis.stop();
    audio.dissolve(3.6).then(() => { location.href = a.href; });
  });
});

/* puntatore */
const mouse = new THREE.Vector2(0, 0);
const mouseS = new THREE.Vector2(0, 0);
const cur = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
let pointerSeen = false;
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  cur.tx = e.clientX; cur.ty = e.clientY;
  pointerSeen = true;
});
const ray = new THREE.Raycaster();
const battPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -battZ);
const tmpV = new THREE.Vector3();

/* stato della bolla */
let popped = false, popT = 0, wobbleHot = 0;
function pop() {
  if (popped) return;
  popped = true;
  audio.bell(0.12);
  setTimeout(() => audio.bell(0.08), 140);
}

addEventListener('click', (e) => {
  if (!gate.classList.contains('out') || e.target.closest('a,button')) return;
  ray.setFromCamera(mouse, camera);
  if (hero.visible && !popped && ray.intersectObject(bubble).length) {
    pop();
    lenis.scrollTo(innerHeight * 1.2, { duration: 3.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
    return;
  }
  if (focused) { unfocus(); return; }
  if (shared.uOpacity.value > 0.5) {
    const hit = ray.intersectObjects(cards)[0];
    if (hit) { focusCard(hit.object); return; }
  }
  if (bUni.uOpacity.value > 0.5 && bUni.uMouse.value.z < 900) {
    bUni.uBurst.value = 2.2;
    audio.whoosh();
  }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && focused) unfocus(); });

function focusCard(m) {
  focused = m;
  lenis.stop();
  audio.bell(0.1);
}
function unfocus() {
  focused = null;
  lenis.start();
}

/* ------------------------------------------------------------------ */
/* coreografia legata allo scroll                                      */
/* ------------------------------------------------------------------ */
function cameraZ(p) {
  if (p < 0.12) return lerp(9, 7, ease(seg(p, 0, 0.12)));
  if (p < 0.5) return lerp(7, -58, ease(seg(p, 0.12, 0.5)));
  if (p < 0.72) return -58;
  if (p < 0.92) return lerp(-58, -64, ease(seg(p, 0.72, 0.92)));
  return lerp(-64, -63, ease(seg(p, 0.92, 1)));
}
const BG_KEYS = [
  [0, '#140404'], [0.12, '#1d0707'], [0.26, '#2b0d0c'], [0.38, '#2a1105'], [0.48, '#15100c'],
  [0.6, '#120807'], [0.74, '#160606'], [0.9, '#0c0404'], [1, '#050202'],
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
let pr = PR_MAX, qAcc = 0, qFrames = 0, qGood = 0;
function setPR(v) {
  pr = v;
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  bUni.uPixel.value = pr;
}
const FIXED_Q = new URLSearchParams(location.search).has('fisso');
function adaptQuality(dt) {
  if (document.hidden || FIXED_Q) return;
  qAcc += dt; qFrames++;
  if (qAcc < 1) return;
  const fps = qFrames / qAcc;
  qAcc = 0; qFrames = 0;
  if (fps < 45 && pr > 0.75) { setPR(Math.max(0.75, pr - 0.25)); qGood = 0; }
  else if (fps > 57 && pr < PR_MAX && ++qGood >= 3) { setPR(Math.min(PR_MAX, pr + 0.25)); qGood = 0; }
}
let prevCamZ = 9, vel = 0, hot = false;

function frame(time) {
  if (import.meta.env.DEV) { window.__frames = (window.__frames || 0) + 1; }
  lenis.raf(time);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const p = lenis.limit > 0 ? clamp(lenis.scroll / lenis.limit) : 0;
  vel = lerp(vel, clamp(lenis.velocity / 30, -1.5, 1.5), 0.08);
  mouseS.lerp(mouse, 0.06);
  hot = false;

  /* camera */
  const cz = cameraZ(p);
  const flight = seg(p, 0.12, 0.5);
  camera.position.set(mouseS.x * 0.45, mouseS.y * 0.3, cz);
  camera.lookAt(mouseS.x * 0.15, mouseS.y * 0.1, cz - 10);
  camera.rotateZ(Math.sin(flight * Math.PI * 2) * 0.09 * Math.sin(flight * Math.PI));
  scene.fog.color.copy(bgAt(p));
  glowUni.uBg.value.copy(bg);
  glowUni.uTime.value = clock.elapsedTime;

  /* 1. bolla e L */
  hero.visible = cz > -9;
  const leave = ease(seg(p, 0.07, 0.2));
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
    bubbleUniforms.uWobble.value = 1 + wobbleHot * 1.6;
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
    const spread = 1 + wobbleHot * 0.12 + ease(popT) * 0.25;
    corners.forEach((c) => {
      c.position.set(c.userData.sx * 1.75 * spread, c.userData.sy * 1.95 * spread, 0.5);
    });
    brackets.rotation.y = lMesh.rotation.y * 0.5;
    brackets.rotation.x = lMesh.rotation.x * 0.5;
  }

  /* 2. anelli */
  let mood = 0.3;
  RINGS.forEach((r, i) => {
    r.group.rotation.z += dt * (0.05 + i * 0.02);
    r.grains.rotation.z -= dt * 0.18;
    r.thin.rotation.z += dt * 0.1;
    const d = cz - r.z;
    // passaggio dentro l'anello: lampo di luce e soffio
    if (prevCamZ > r.z && cz <= r.z) { r.flash = 1; audio.whoosh(); }
    if (prevCamZ < r.z && cz >= r.z) r.flash = 0.5;
    r.flash *= 0.94;
    r.main.material.emissiveIntensity = r.glow * (1 + r.flash * 1.6);
    const near = clamp(1 - Math.abs(d) / 14);
    r.group.scale.setScalar(1 + near * 0.06 * Math.sin(t * 2 + i));
    r.group.rotation.x = mouseS.y * 0.12 * near;
    r.group.rotation.y = mouseS.x * 0.12 * near;
    const vis = Math.min(seg(d, 14, 8), 1 - seg(d, 2, -1.5));
    showLayer(layers.r[i], vis);
    if (d < 16 && d > -2) mood = r.mood;
  });
  bloom.strength = 0.45 + RINGS.reduce((s, r) => s + r.flash, 0) * 0.35;

  /* 3. nastro di seta */
  gallery.visible = p > 0.42 && p < 0.8;
  shared.uOpacity.value = win(p, 0.45, 0.52, 0.72, 0.77);
  shared.uTime.value = t;
  shared.uVel.value = lerp(shared.uVel.value, focused ? 0 : vel, 0.1);
  if (gallery.visible) {
    const run = ease(seg(p, 0.47, 0.75));
    const span = (cards.length - 1) * GAP;
    gallery.position.x = lerp(12, -span - 12, run);
    gallery.position.y = Math.sin(t * 0.3) * 0.08;
    ray.setFromCamera(mouse, camera);
    const hit = !focused && pointerSeen && shared.uOpacity.value > 0.5 ? ray.intersectObjects(cards)[0] : null;
    cards.forEach((m) => {
      const ud = m.userData;
      ud.hover = lerp(ud.hover, hit && hit.object === m ? 1 : 0, 0.08);
      ud.focus = lerp(ud.focus, focused === m ? 1 : 0, 0.075);
      ud.u.uHover.value = ud.hover;
      ud.u.uFocus.value = ud.focus;
      ud.u.uDim.value = lerp(ud.u.uDim.value, focused && focused !== m ? 1 : 0, 0.08);
      // zoom al clic: la foto viene davanti e riempie la vista
      tmpV.set(camera.position.x, camera.position.y, cz - 6.1);
      gallery.worldToLocal(tmpV);
      m.position.lerpVectors(ud.base, tmpV, ease(ud.focus));
      m.scale.setScalar(1 + ud.hover * 0.04 + ud.focus * 0.05);
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
      bUni.uMouse.value.lerp(tmpV, 0.2);
      if (bUni.uForm.value > 0.6 && Math.abs(tmpV.x) < 3 && Math.abs(tmpV.y) < 4) hot = true;
    }
  }
  showLayer(layers.batt, win(p, 0.79, 0.83, 0.9, 0.93));

  /* apertura e chiusura */
  showLayer(layers.hero, gate.classList.contains('out') ? 1 - seg(p, 0.012, 0.05) : 0);
  const endV = seg(p, 0.94, 0.985);
  showLayer(layers.end, endV);
  goLink.style.pointerEvents = endV > 0.6 ? 'auto' : 'none';

  /* suono: il colore cambia con la sezione e si apre con la velocità */
  if (p > 0.47 && p < 0.76) mood = 0.6;
  else if (p >= 0.76) mood = 0.25 + seg(p, 0.76, 0.9) * 0.3 - seg(p, 0.93, 1) * 0.35;
  else if (p < 0.1) mood = 0.2 + (popped ? 0.2 : 0);
  if (Math.random() < 0.1) audio.setMood(mood, lenis.velocity);

  /* cursore */
  cur.x = lerp(cur.x, cur.tx, 0.22);
  cur.y = lerp(cur.y, cur.ty, 0.22);
  cursor.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
  const overLink = document.querySelector('a:hover, button:hover');
  cursor.classList.toggle('hot', hot || !!overLink);

  prevCamZ = cz;
  adaptQuality(dt);
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (import.meta.env.DEV) window.__dbg = { scene, renderer, composer, backGlow, lMesh, lMat, bubble, setPR };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
});
