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
// il punto in cui la camera passa: appena dentro l'angolo retto della L (lo spigolo interno sta a -0.325, -0.775)
const L_PASS = new THREE.Vector2(-0.02, -0.47);
hero.add(lMesh);

// controluce: un alone caldo dietro la L, che il vetro raccoglie e accende di rosso
const glowUni = { uBg: { value: new THREE.Color('#140404') }, uTime: { value: 0 }, uFade: { value: 1 } };
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

// la bolla: trasparente, con un velo chiaro sul bordo e la superficie che respira
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
      // bolla trasparente: niente arcobaleno, solo un velo chiaro sul bordo, i riflessi dello studio e due punti luce
      void main(){
        float ndv = abs(dot(vN, vV));
        float f = pow(1.0 - ndv, 3.2);
        float rim = smoothstep(0.62, 1.0, 1.0 - ndv);
        vec3 r = reflect(-vV, vN);
        float window = smoothstep(0.35, 0.9, r.y) * smoothstep(-0.2, 0.5, r.z) * 0.22;   // la finestra di luce in alto
        float floorL = smoothstep(0.4, 0.95, -r.y) * 0.06;                                // il rimbalzo caldo dal basso
        vec3 c = vec3(1.0, 0.97, 0.93) * (0.55 + f * 0.6) + vec3(1.0, 0.45, 0.25) * floorL;
        vec3 l = normalize(vec3(0.5, 0.7, 0.6));
        float spec = pow(max(dot(reflect(-l, vN), vV), 0.0), 420.0) * 1.8 + pow(max(dot(reflect(-normalize(vec3(-0.6, 0.2, 0.7)), vN), vV), 0.0), 900.0) * 0.9;
        // quasi tutta la superficie è vuota: restano un filo sul bordo, il riflesso della finestra e i punti luce
        float a = (f * 0.14 + rim * 0.035 + window * f * 0.55 + floorL * 0.5) * (1.0 - uPop);
        gl_FragColor = vec4(c + spec * 2.0, a + spec * (1.0 - uPop));
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
  { z: -14, color: new THREE.Color('#ff3414'), metal: '#a8604a', mood: 0.35 },
  { z: -32, color: new THREE.Color('#ff8a24'), metal: '#c49058', mood: 0.7 },
  { z: -50, color: new THREE.Color('#ffe6c4'), metal: '#d6c6ae', mood: 0.5 },
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
  uniform vec3 uColor; uniform float uTime, uPower, uGain, uFlash, uSeed, uFade;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float body = pow(facing, uPower);
    float a = atan(vP.y, vP.x);
    float flow = 0.5 + 0.5 * sin(a * 3.0 - uTime * 1.2 + uSeed) * sin(a * 7.0 + uTime * 0.55 + uSeed * 2.0);
    float spark = pow(max(sin(a * 19.0 - uTime * 2.2 + uSeed), 0.0), 16.0);
    float i = body * uGain * (0.6 + flow * 0.7 + spark * 0.7) * (1.0 + uFlash * 1.4) * uFade;
    gl_FragColor = vec4(uColor * i, 1.0);
  }`;
const beamMat = (color, power, gain, seed) => new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: color }, uTime: { value: 0 }, uPower: { value: power }, uGain: { value: gain },
    uFlash: { value: 0 }, uSeed: { value: seed }, uFade: { value: 1 },
  },
  vertexShader: beamVS, fragmentShader: beamFS,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const R_RING = 4.6;
RINGS.forEach((r, i) => {
  const g = new THREE.Group();
  g.position.z = r.z;
  // anima incandescente
  const core = new THREE.Mesh(
    new THREE.TorusGeometry(R_RING, 0.03, 16, 480),
    new THREE.MeshBasicMaterial({ color: r.color.clone().lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.0) })
  );
  // fascio e alone
  const beam = new THREE.Mesh(new THREE.TorusGeometry(R_RING, 0.3, 48, 480), beamMat(r.color, 2.6, 0.85, i * 1.7));
  const haze = new THREE.Mesh(new THREE.TorusGeometry(R_RING, 1.2, 32, 240), beamMat(r.color, 5.5, 0.2, i * 1.7 + 0.6));
  // ghiera di metallo spazzolato, piatta come quella di un obiettivo
  const metalMat = new THREE.MeshPhysicalMaterial({
    color: r.metal, metalness: 1, roughness: 0.3, anisotropy: 0.8, clearcoat: 0.25, envMapIntensity: 1.3,
  });
  const band = new THREE.Mesh(new THREE.TorusGeometry(R_RING + 0.62, 0.06, 20, 480), metalMat);
  band.scale.z = 4.5;
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
  g.add(band, ticks, haze, beam, core, grains);
  g.rotation.z = i * 0.7;
  scene.add(g);
  Object.assign(r, { group: g, core, beam, haze, ticks, grains, flash: 0 });
});

/* ------------------------------------------------------------------ */
/* 3. IL NASTRO DI SETA: foto che ondeggiano con la velocità           */
/* ------------------------------------------------------------------ */
const NCARDS = 15;
const PHOTOS = Array.from({ length: NCARDS }, (_, i) => `${import.meta.env.BASE_URL}foto/foto-${String(i + 1).padStart(2, '0')}.jpg`);
const galleryZ = -68;
const gallery = new THREE.Group();
gallery.position.set(0, 0, galleryZ);
scene.add(gallery);
const shared = { uTime: { value: 0 }, uVel: { value: 0 }, uOpacity: { value: 0 } };
const PW = 3.2, PH = 4.0, GAP_Y = 4.7;
// tre colonne che salgono a velocità diverse
const COLS = [
  { x: -4.6, speed: 0.92, off: 1.8 },
  { x: 0, speed: 1.1, off: 0 },
  { x: 4.6, speed: 1.0, off: 3.0 },
].map((c) => { const g = new THREE.Group(); gallery.add(g); return { ...c, g }; });

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
          float dy = wp.y - cameraPosition.y;
          float dx = wp.x - cameraPosition.x;
          wp.z -= (dy * dy * 0.015 + dx * dx * 0.004) * k;          // il nastro si curva come un rullo
          // pieghe di stoffa: tre onde sovrapposte, sempre vive e più forti quando si corre
          float v = abs(uVel);
          float w1 = sin(wp.y * 0.95 + wp.x * 0.35 + uTime * 1.5);
          float w2 = sin(wp.y * 2.1 - wp.x * 0.9 - uTime * 1.1);
          float w3 = sin(wp.x * 1.5 + wp.y * 0.4 + uTime * 0.8);
          float fold = w1 * 0.65 + w2 * 0.3 + w3 * 0.25;
          float amp = (0.05 + v * 0.55) * k;
          wp.z += fold * amp;
          wp.x += cos(wp.y * 0.7 + uTime) * uVel * 0.14 * k;
          wp.y -= uVel * 0.12 * sin(wp.x * 0.5 + uTime * 0.6) * k;
          vShade = (w1 * 0.9 * 0.95 + w2 * 0.3 * 2.1) * amp;      // pendenza: fa il riflesso della seta
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
          float sh = uVel * 0.005;
          vec3 c = vec3(texture2D(uTex, uv + vec2(0.0, sh)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(0.0, sh)).b);
          float light = clamp(vShade * 1.0, -0.28, 0.28);
          c *= 0.95 + light;                                          // pieghe in luce e in ombra
          c += vec3(0.12, 0.05, 0.02) * max(light, 0.0);             // lucido caldo della seta
          vec2 e = smoothstep(0.0, 0.012, vUv) * smoothstep(0.0, 0.012, 1.0 - vUv);
          c *= 1.0 - uDim * 0.75;
          gl_FragColor = vec4(c, uOpacity * e.x * e.y);
        }`,
    })
  );
  const col = COLS[i % 3];
  const row = Math.floor(i / 3);
  const base = new THREE.Vector3(col.x, -row * GAP_Y - col.off, 0);
  m.position.copy(base);
  m.userData = { i, u, base, focus: 0, hover: 0 };
  col.g.add(m);
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
  // il nastro largo 13,5 deve stare nella vista a 10 di distanza
  const gs = clamp((2 * 10 * tanV * a * 0.96) / 13.5, 0.42, 1);
  gallery.scale.setScalar(gs);
  // foto ingrandita: riempie la vista, anche in verticale
  const H = 2 * 6.1 * tanV, W = H * a;
  focusScale = Math.min((0.88 * W) / PW, (0.8 * H) / PH) / gs;
}
fit();

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
const goLinks = [...document.querySelectorAll('.go')];
if (isTouch) document.querySelectorAll('[data-touch]').forEach((el) => { el.textContent = el.dataset.touch; });

// ?muto nell'indirizzo: il sito parte senza suono (serve per le prove)
const MUTE = new URLSearchParams(location.search).has('muto');
$('enter').addEventListener('click', () => {
  if (MUTE) audio.muted = true;
  audio.start();
  if (MUTE) { soundBtn.classList.add('off'); }
  try { localStorage.setItem('locus-suono', MUTE ? 'off' : 'on'); } catch (e) {}
  gate.classList.add('out');
  document.body.classList.add('entered');
  soundBtn.classList.add('on');
  document.body.classList.remove('locked');
  lenis.start();
});
soundBtn.addEventListener('click', () => {
  const m = !audio.muted;
  audio.setMuted(m);
  try { localStorage.setItem('locus-suono', m ? 'off' : 'on'); } catch (e) {}
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
let lastTouch = -1e9;
const onPointer = (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  cur.tx = e.clientX; cur.ty = e.clientY;
  pointerSeen = true;
  if (e.pointerType !== 'mouse') lastTouch = performance.now();
};
addEventListener('pointermove', onPointer);
addEventListener('pointerdown', onPointer);

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
  // la L resta ferma: la camera le si avvicina e passa appena dentro l'angolo tra la stanghetta lunga e quella corta,
  // poi, lasciata la L alle spalle, torna al centro del volo
  const near = ease(seg(7 - cz, 0, 6.7)) * (1 - ease(seg(-cz, 2, 10)));
  const hs = hero.scale.x;
  const offX = L_PASS.x * hs * near, offY = L_PASS.y * hs * near;
  const mk = 1 - near * 0.85; // vicino alla L il puntatore sposta poco la camera, per non sbatterci contro
  camera.position.set(offX + mouseS.x * 0.45 * mk, offY + mouseS.y * 0.3 * mk, cz);
  camera.lookAt(offX + mouseS.x * 0.15 * mk, offY + mouseS.y * 0.1 * mk, cz - 10);
  camera.rotateZ(Math.sin(flight * Math.PI * 2) * 0.09 * Math.sin(flight * Math.PI));
  scene.fog.color.copy(bgAt(p));
  glowUni.uBg.value.copy(bg);
  glowUni.uTime.value = clock.elapsedTime;

  /* 1. bolla e L */
  hero.visible = cz > -9;
  glowUni.uFade.value = seg(cz, 0.5, 4); // il controluce si spegne prima che la camera lo attraversi
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
    lMesh.rotation.y = lerp(lMesh.rotation.y, (mouseS.x * 0.6 + Math.sin(t * 0.4) * 0.15) * mk, 0.08);
    lMesh.rotation.x = lerp(lMesh.rotation.x, -mouseS.y * 0.4 * mk, 0.08);
    lMesh.position.y = Math.sin(t * 0.8) * 0.08 * mk;
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
    r.group.rotation.z += dt * (0.04 + i * 0.015);
    r.grains.rotation.z -= dt * 0.18;
    r.ticks.rotation.z -= dt * 0.05;
    const d = cz - r.z;
    // passaggio dentro l'anello: lampo di luce e soffio
    if (prevCamZ > r.z && cz <= r.z) { r.flash = 1; audio.whoosh(); }
    if (prevCamZ < r.z && cz >= r.z) r.flash = 0.5;
    r.flash *= 0.94;
    const fade = 1 - seg(Math.abs(d), 16, 44);
    const close = seg(Math.abs(d), 0.5, 7); // da vicino l'alone si ritira, sennò invade lo schermo
    for (const m of [r.beam, r.haze]) {
      const u = m.material.uniforms;
      u.uTime.value = t; u.uFlash.value = r.flash;
      u.uFade.value = fade * (m === r.haze ? lerp(0.08, 1, close) : lerp(0.45, 1, close));
    }
    const near = clamp(1 - Math.abs(d) / 14);
    r.group.scale.setScalar(1 + near * 0.05 * Math.sin(t * 2 + i));
    r.group.rotation.x = mouseS.y * 0.14 * near;
    r.group.rotation.y = mouseS.x * 0.14 * near;
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
    const run = ease(seg(p, 0.46, 0.76));
    const rows = Math.ceil(NCARDS / 3) - 1;
    COLS.forEach((c) => { c.g.position.y = -7 + run * (rows * GAP_Y + 14 + c.off) * c.speed; });
    gallery.position.x = Math.sin(t * 0.25) * 0.1;
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
      m.parent.worldToLocal(tmpV);
      m.position.lerpVectors(ud.base, tmpV, ease(ud.focus));
      m.scale.setScalar((1 + ud.hover * 0.04) * lerp(1, focusScale, ease(ud.focus)));
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
        audio.bell(0.05);
      }
      wasInside = inside;
    }
  }
  updateSparks(dt);
  showLayer(layers.batt, win(p, 0.79, 0.83, 0.9, 0.93));

  /* apertura e chiusura */
  showLayer(layers.hero, gate.classList.contains('out') ? 1 - seg(p, 0.012, 0.05) : 0);
  const endV = seg(p, 0.94, 0.985);
  showLayer(layers.end, endV);
  goLinks.forEach((l) => { l.style.pointerEvents = endV > 0.6 ? 'auto' : 'none'; });

  /* suono: il colore cambia con la sezione e si apre con la velocità */
  if (p > 0.47 && p < 0.76) mood = 0.6;
  else if (p >= 0.76) mood = 0.25 + seg(p, 0.76, 0.9) * 0.3 - seg(p, 0.93, 1) * 0.35;
  else if (p < 0.1) mood = 0.2 + (popped ? 0.2 : 0);
  if (Math.random() < 0.1) audio.setMood(mood, lenis.velocity);

  /* cursore */
  cur.x = lerp(cur.x, cur.tx, 0.42);
  cur.y = lerp(cur.y, cur.ty, 0.42);
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
  fit();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
});
