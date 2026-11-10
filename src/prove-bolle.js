// Pagina di prova: la bolla della L in quattro versioni affiancate, per scegliere a vista.
// Non fa parte del sito. Clic su una bolla: la si vede da sola e grande; clic di nuovo: si torna alle quattro.
// Idea (10/11/2026): una bolla vera è fatta quasi solo dei riflessi di quello che ha intorno,
// più forti sul bordo e quasi invisibili al centro, e riflette due volte: la faccia davanti e quella dietro, capovolta.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const VARIANTI = [
  { nome: 'Come oggi', nota: 'Filo bianco, finestra e punti luce disegnati a mano.' },
  { nome: 'Salotto vero, virato al rosso', nota: 'La foto a 360 gradi di Poly Haven (combination_room), virata al rosso. Si vedono le finestre.' },
  { nome: 'Salotto vero, finestre spente', nota: 'La stessa foto con il filo bianco; le finestre diventano rosse come le pareti.' },
  { nome: 'Stanza di Locus', nota: 'Una stanza nostra fatta in Blender: velluto, libreria, quadri, lampadario e lampade. Niente finestre. Con il filo bianco.' },
];
// le versioni con la stanza disegnata nel codice (1, 3, 4, 5 della prima prova) sono state scartate il 10/11 sera

const BG = new THREE.Color('#2b0d0c');
const SPACING = 7.4;
const R = 2.9;
// direzione in cui deve cadere la finestra: si vede riflessa in alto a sinistra della bolla, come oggi
const WIN_DIR = new THREE.Vector3(-0.64, 0.72, 0.28).normalize();

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = BG;
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
const GRID_Z = () => Math.max(26, 30 * (16 / 9) / (innerWidth / innerHeight)) * (VARIANTI.length / 4);
camera.position.set(0, 0, GRID_Z());

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.45, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));

/* ---------- la luce della L: lo stesso studio del sito ---------- */
const pmrem = new THREE.PMREMGenerator(renderer);
function studioEnv() {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#060101');
  const light = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  light(7, 1.1, '#ffe4c8', 4.5, [0, 5, 2.5]);
  light(0.5, 7, '#ffffff', 7, [-5, 0, 3]);
  light(0.5, 7, '#ffd2a8', 5, [5, 0.5, 1.5]);
  light(1.4, 1.4, '#ffffff', 10, [2.2, 2.2, 5]);
  light(4, 3, '#ff5a2a', 1.4, [0, -1, -6]);
  light(12, 12, '#3a0806', 0.7, [0, -5, 0]);
  return pmrem.fromScene(s, 0).texture;
}
const studio = studioEnv();

function makeL() {
  const s = new THREE.Shape();
  s.moveTo(-0.4, 0); s.lineTo(3.7, 0); s.lineTo(3.7, 1.45); s.lineTo(3.48, 1.45);
  s.quadraticCurveTo(3.3, 0.98, 2.8, 0.95);
  s.lineTo(1.0, 0.95); s.lineTo(1.0, 4.72); s.lineTo(1.38, 4.72); s.lineTo(1.38, 5.0);
  s.lineTo(-0.4, 5.0); s.lineTo(-0.4, 4.72); s.lineTo(-0.05, 4.72); s.lineTo(-0.05, 0.26);
  s.lineTo(-0.4, 0.26); s.lineTo(-0.4, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.085, bevelSegments: 12, curveSegments: 48 });
  geo.center();
  geo.scale(0.5, 0.5, 0.5);
  return geo;
}
const L_GEO = makeL();
const lMat = new THREE.MeshPhysicalMaterial({
  color: '#8a0603', metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03,
  specularIntensity: 1, specularColor: new THREE.Color('#ffd9c8'), sheen: 0.4, sheenColor: new THREE.Color('#ff5030'),
  sheenRoughness: 0.4, iridescence: 0.12, iridescenceIOR: 1.4, envMap: studio, envMapIntensity: 1.5,
});
const glowMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 q = vUv - 0.5; float r = length(q * vec2(1.0, 0.92));
      float core = 1.0 - smoothstep(0.0, 0.22, r); float halo = 1.0 - smoothstep(0.02, 0.5, r);
      vec3 warm = mix(vec3(0.30, 0.025, 0.012), vec3(0.95, 0.30, 0.10), core * core);
      gl_FragColor = vec4(warm * (0.9 + 0.1 * sin(uTime * 0.7)) * halo * halo * 0.55, 1.0);
    }`,
});

/* ---------- le stelle: punti luminosi sparsi nella stanza, che brillano piano ---------- */
const STELLE = 380;
const starGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(STELLE * 3), size = new Float32Array(STELLE), ph = new Float32Array(STELLE);
  for (let i = 0; i < STELLE; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(7 + Math.random() * 6);
    pos.set([v.x, v.y, v.z], i * 3);
    const big = Math.random() < 0.08;
    size[i] = big ? 9 + Math.random() * 5 : 3.5 + Math.random() * 3.5;
    ph[i] = Math.random() * 6.283;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  starGeo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
}
const starMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aSize, aPh; uniform float uTime; varying float vA;
    void main(){ vA = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPh * 3.1) * 1.4) + aPh); gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying float vA;
    void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.88, 0.8) * 16.0 * vA * a * a, 1.0); }`,
});
// dal 10/11 sera niente stelle nei riflessi (sembrava una bolla di Natale); con ?stelle tornano, per confronto
const STELLE_ON = new URLSearchParams(location.search).has('stelle');
const stars = () => (STELLE_ON ? new THREE.Points(starGeo, starMat) : new THREE.Group());

/* ---------- ambiente 1: la stanza rossa costruita ---------- */
// finestra: true mette la finestra e la lampada; luce: quanto si schiarisce la parete dalla parte della luce
function makeRoom({ finestra = true, luce = 0.8, ampia = false } = {}) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color('#1a0605');
  // pareti, pavimento e soffitto: rosso scuro, più chiaro dalla parte della luce
  sc.add(new THREE.Mesh(
    new THREE.BoxGeometry(30, 18, 30),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uWin: { value: WIN_DIR }, uLuce: { value: luce }, uExp: { value: ampia ? 1.0 : 2.0 } },
      vertexShader: `varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uWin; uniform float uLuce, uExp; varying vec3 vW;
        void main(){
          vec3 d = normalize(vW);
          float lit = pow(max(dot(d, uWin), 0.0), uExp);
          float floorK = smoothstep(-0.3, -0.6, d.y);               // pavimento più scuro
          vec3 c = vec3(0.26, 0.06, 0.045) * (1.0 - floorK * 0.55) + vec3(0.7, 0.2, 0.12) * lit * uLuce;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  ));
  if (finestra) {
    // la finestra: quattro vetri chiari divisi da una croce scura
    const win = new THREE.Group();
    const pane = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1e4').multiplyScalar(9), side: THREE.DoubleSide });
    for (const [x, y] of [[-0.85, 1.05], [0.85, 1.05], [-0.85, -1.05], [0.85, -1.05]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.95), pane);
      p.position.set(x, y, 0);
      win.add(p);
    }
    win.position.copy(WIN_DIR).multiplyScalar(11);
    win.lookAt(0, 0, 0);
    sc.add(win);
    // una seconda luce più piccola e calda dalla parte opposta: si vede nel riflesso di dietro
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb48a').multiplyScalar(5), side: THREE.DoubleSide }));
    lamp.position.set(5, -1.5, -9);
    lamp.lookAt(0, 0, 0);
    sc.add(lamp);
  }
  sc.add(stars());
  return sc;
}
const roomScene = makeRoom();
const buioScene = makeRoom({ finestra: false, luce: 0 });                 // senza finestre: solo pareti e stelle
const morbidaScene = makeRoom({ finestra: false, luce: 1.8, ampia: true }); // senza finestre: una luce larga e senza contorni

/* ---------- ambiente 2: la foto vera di Poly Haven, virata al rosso ---------- */
// spenta: le luci forti (le finestre) non restano chiare ma diventano rosse e basse come le pareti
const photoUni = { uMap: { value: null }, uRot: { value: new THREE.Matrix3() } };
function makePhoto(spenta) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color('#1a0605');
  sc.add(new THREE.Mesh(
    new THREE.SphereGeometry(40, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { ...photoUni, uSpenta: { value: spenta ? 1 : 0 } },
      vertexShader: `varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D uMap; uniform mat3 uRot; uniform float uSpenta; varying vec3 vW;
        void main(){
          vec3 d = normalize(uRot * normalize(vW));
          vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, 0.5 - asin(clamp(d.y, -1.0, 1.0)) / 3.1415927);
          vec3 c = texture2D(uMap, uv).rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          // le zone scure diventano rosso Locus, le luci forti restano color crema
          vec3 red = vec3(1.0, 0.3, 0.24) * lum * 0.7;
          vec3 hot = vec3(1.0, 0.9, 0.82) * lum;
          vec3 acceso = mix(red, hot, smoothstep(1.0, 5.0, lum));
          // spenta: la luminosità si ferma a quella di una parete chiara, così le finestre non si leggono più
          float l2 = 0.9 * lum / (lum + 0.9);
          vec3 spento = vec3(1.0, 0.3, 0.24) * l2 * 1.1;
          gl_FragColor = vec4(mix(acceso, spento, uSpenta), 1.0);
        }`,
    })
  ));
  sc.add(stars());
  return sc;
}
const photoScene = makePhoto(false);
const spentaScene = makePhoto(true);
let photoReady = false;
new HDRLoader().setDataType(THREE.FloatType).load(`/prove-media/combination_room_1k.hdr`, (tex) => {
  tex.flipY = false;
  tex.needsUpdate = true;
  // trovo il punto più luminoso della foto (la finestra) e giro la stanza perché cada dove serve
  const { data, width: W, height: H } = tex.image;
  let best = -1, bi = 0, bj = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = (j * W + i) * 4;
    const l = data[k] * 0.2126 + data[k + 1] * 0.7152 + data[k + 2] * 0.0722;
    if (l > best) { best = l; bi = i; bj = j; }
  }
  const lon = ((bi + 0.5) / W - 0.5) * Math.PI * 2;
  const lat = (0.5 - (bj + 0.5) / H) * Math.PI;
  const bright = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  const q = new THREE.Quaternion().setFromUnitVectors(WIN_DIR, bright);
  photoUni.uRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
  photoUni.uMap.value = tex;
  photoScene.children[0].material.uniforms.uMap.value = tex;
  spentaScene.children[0].material.uniforms.uMap.value = tex;
  photoReady = true;
});

/* ---------- ambiente 3: la stanza di Locus fatta in Blender (blender/stanza.py), colori veri ---------- */
const locusUni = { uMap: { value: null } };
const locusScene = new THREE.Scene();
locusScene.background = new THREE.Color('#1a0605');
locusScene.add(new THREE.Mesh(
  new THREE.SphereGeometry(40, 64, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: locusUni,
    vertexShader: `varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying vec3 vW;
      void main(){
        vec3 d = normalize(vW);
        vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, 0.5 - asin(clamp(d.y, -1.0, 1.0)) / 3.1415927);
        // le lampade si fermano a una luce forte ma non accecante: di taglio sul bordo della bolla facevano un bagliore
        gl_FragColor = vec4(min(texture2D(uMap, uv).rgb * 0.62, vec3(1.6)), 1.0);
      }`,
  })
));
let locusReady = false;
new HDRLoader().setDataType(THREE.FloatType).load(`${import.meta.env.BASE_URL}hdri/stanza-locus.hdr`, (tex) => {
  tex.flipY = false;
  tex.needsUpdate = true;
  locusUni.uMap.value = tex;
  locusReady = true;
});

/* ---------- i riflessi: due ambienti resi in tempo reale su un cubo ---------- */
const cubeRT = () => new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const roomRT = cubeRT(), photoRT = cubeRT(), buioRT = cubeRT(), morbidaRT = cubeRT(), spentaRT = cubeRT(), locusRT = cubeRT();
const locusCam = new THREE.CubeCamera(0.1, 100, locusRT);
const roomCam = new THREE.CubeCamera(0.1, 100, roomRT);
const photoCam = new THREE.CubeCamera(0.1, 100, photoRT);
const spentaCam = new THREE.CubeCamera(0.1, 100, spentaRT);
const buioCam = new THREE.CubeCamera(0.1, 100, buioRT);
const morbidaCam = new THREE.CubeCamera(0.1, 100, morbidaRT);

/* ---------- le bolle ---------- */
const WOBBLE = /* glsl */ `
  uniform float uTime;
  varying vec3 vN; varying vec3 vV;
  float disp(vec3 n){
    float big = sin(n.x * 2.1 + uTime * 0.55) * 0.035 + sin(n.y * 2.6 - uTime * 0.43) * 0.03 + sin(n.z * 1.9 + n.x * 1.3 + uTime * 0.48) * 0.025;
    float fine = sin(n.y * 6.4 + uTime * 1.1) * 0.004 + sin(n.x * 9.0 - uTime * 0.85) * 0.003;
    return big + fine;
  }
  vec3 shape(vec3 x){ vec3 n = normalize(x); return n * (${R.toFixed(2)} + disp(n)); }
  void main(){
    vec3 p = shape(position);
    vec3 nn = normalize(position);
    vec3 t1 = normalize(cross(nn, abs(nn.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(nn, t1);
    vec3 nrm = normalize(cross(shape(position + t1 * 0.02) - p, shape(position + t2 * 0.02) - p));
    if (dot(nrm, nn) < 0.0) nrm = -nrm;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * nrm);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// la bolla di oggi, identica al sito
const oggiMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  transparent: true, depthWrite: false,
  vertexShader: WOBBLE,
  fragmentShader: `varying vec3 vN; varying vec3 vV;
    void main(){
      float ndv = abs(dot(vN, vV)); float edge = 1.0 - ndv;
      float filmA = pow(edge, 3.6) * 0.12; float rim = smoothstep(0.82, 1.0, edge);
      vec3 r = reflect(-vV, vN);
      float win = smoothstep(0.5, 0.53, r.y) * (1.0 - smoothstep(0.64, 0.67, r.y)) * smoothstep(-0.5, -0.47, r.x) * (1.0 - smoothstep(-0.33, -0.3, r.x)) * step(0.0, r.z);
      vec3 l = normalize(vec3(0.5, 0.7, 0.6));
      float spec = pow(max(dot(reflect(-l, vN), vV), 0.0), 420.0) * 1.8 + pow(max(dot(reflect(-normalize(vec3(-0.6, 0.2, 0.7)), vN), vV), 0.0), 900.0) * 0.9;
      float a = filmA + rim * 0.35 + win * 0.75;
      gl_FragColor = vec4(vec3(1.0) + spec, a + spec);
    }`,
});

// la bolla che riflette un ambiente: la luce si somma, niente patina; faccia davanti e faccia dietro
const riflessoMat = (env, filo) => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uEnv: { value: env }, uFilo: { value: filo ? 1 : 0 } },
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  vertexShader: WOBBLE,
  fragmentShader: `uniform samplerCube uEnv; uniform float uFilo; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(vV);
      bool front = gl_FrontFacing;
      if (!front) N = -N;                                    // dietro si vede il lato interno, che fa da specchio concavo
      float ndv = clamp(dot(N, V), 0.0, 1.0);
      float F = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);           // come il vetro e l'acqua: quasi niente al centro, tanto sul bordo
      vec3 env = textureCube(uEnv, reflect(-V, N)).rgb;
      vec3 c = env * F * (front ? 1.0 : 0.55);
      if (front) c += vec3(1.0) * smoothstep(0.82, 1.0, 1.0 - ndv) * 0.3 * uFilo;
      gl_FragColor = vec4(c, 1.0);
    }`,
});

const mats = [oggiMat(), riflessoMat(photoRT.texture, false), riflessoMat(spentaRT.texture, true), riflessoMat(locusRT.texture, true)];
const groups = [], hits = [], labels = [];
VARIANTI.forEach((v, i) => {
  const g = new THREE.Group();
  g.position.x = (i - (VARIANTI.length - 1) / 2) * SPACING;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), glowMat);
  glow.position.z = -1.2;
  glow.scale.setScalar(0.8);
  const L = new THREE.Mesh(L_GEO, lMat);
  L.rotation.set(0.08, -0.35, 0);
  const b = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 128), mats[i]);
  b.renderOrder = 2;
  g.add(glow, L, b);
  scene.add(g);
  groups.push(g);
  hits.push(b);
  const lab = document.createElement('div');
  lab.className = 'lab';
  lab.innerHTML = `<b>${v.nome}</b><span>${v.nota}</span>`;
  document.body.appendChild(lab);
  labels.push(lab);
});

/* ---------- clic e camera ---------- */
let focus = -1;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), mouse = new THREE.Vector2(), mouseS = new THREE.Vector2();
addEventListener('pointermove', (e) => mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
canvas.addEventListener('click', (e) => {
  if (focus >= 0) { focus = -1; return; }
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(hits)[0];
  if (h) focus = hits.indexOf(h.object);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

const target = new THREE.Vector3();
const tmp = new THREE.Vector3();
const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  mats.forEach((m) => (m.uniforms.uTime.value = t));
  glowMat.uniforms.uTime.value = t;
  starMat.uniforms.uTime.value = t;

  mouseS.lerp(mouse, 0.05);
  if (focus >= 0) target.set(groups[focus].position.x + mouseS.x * 0.45, mouseS.y * 0.3, 9);
  else target.set(mouseS.x * 0.8, mouseS.y * 0.5, GRID_Z());
  camera.position.lerp(target, 0.06);
  camera.lookAt(focus >= 0 ? groups[focus].position.x : 0, 0, 0);

  if (photoReady) { photoCam.update(renderer, photoScene); spentaCam.update(renderer, spentaScene); }
  if (locusReady) locusCam.update(renderer, locusScene);

  groups.forEach((g, i) => {
    const show = focus < 0 || focus === i;
    g.visible = show;
    const lab = labels[i];
    lab.style.display = show ? 'block' : 'none';
    tmp.set(g.position.x, -R - 0.5, 0).project(camera);
    lab.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`;
    lab.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight + 8}px`;
  });

  composer.render();
  requestAnimationFrame(frame);
}
frame();
