// Pagina di prova: lo stesso anello del sito in sei colori, affiancati, per scegliere un crema più caldo.
// Non fa parte del sito. Clic su un anello: lo si vede da solo e grande; clic di nuovo: si torna alla griglia.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// tinta in gradi: oggi 34; più in basso va verso il rosa, mai verso il giallo
const VARIANTI = [
  // il bagliore dietro la L va da un rosso scuro (#4d0603) a un rosso brace (#f24d1a)
  { nome: 'Come oggi', hex: '#ffa898', nota: 'Il rossiccio ora nel sito, per confronto.' },
  { nome: '1. Brace', hex: '#f24d1a', nota: 'Tutto il cerchio del colore del bagliore dietro la L.' },
  { nome: '2. Filo chiaro, alone brace', hex: '#ffc0a0', alone: '#f24d1a', nota: 'Come la L: luce chiara al centro, brace attorno.' },
  { nome: '3. Filo rossiccio, alone brace', hex: '#ffa898', alone: '#f24d1a', nota: 'Il rossiccio di oggi dentro un alone di brace.' },
  { nome: '4. Solo bagliore', hex: '#f24d1a', morbido: true, nota: 'Niente filo netto: un anello di luce morbida, come dietro la L.' },
  { nome: '5. Brace scura', hex: '#d8381a', alone: '#a01808', nota: 'Più rossa e più cupa, verso il rosso Locus.' },
];

const R = 4.6;
const WHITE = new THREE.Color('#ffffff');
const CREMA = new THREE.Color('#F5E4CB');

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#24090a'); // il fondo del sito nel tratto degli anelli
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 14);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.45, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));

// lo stesso fascio del sito: la luce del fascio corre in un verso, quella dell'alone nell'altro
const beamVS = `varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const beamFS = `uniform vec3 uColor; uniform float uTime, uPower, uGain, uSeed, uDir;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){
    float uT = uTime * uDir;
    float body = pow(abs(dot(normalize(vN), normalize(vV))), uPower);
    float a = atan(vP.y, vP.x);
    float flow = 0.5 + 0.5 * sin(a * 3.0 - uT * 1.2 + uSeed) * sin(a * 7.0 + uT * 0.55 + uSeed * 2.0);
    float spark = pow(max(sin(a * 19.0 - uT * 2.2 + uSeed), 0.0), 16.0);
    gl_FragColor = vec4(uColor * body * uGain * (0.6 + flow * 0.7 + spark * 0.7), 1.0);
  }`;
const beams = [];
const beamMat = (color, power, gain, seed, dir = 1) => {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uTime: { value: 0 }, uPower: { value: power }, uGain: { value: gain }, uSeed: { value: seed }, uDir: { value: dir } },
    vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  beams.push(m);
  return m;
};
const DOT = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();

function anello(v, glow, i) {
  const col = new THREE.Color(v.hex), al = new THREE.Color(v.alone || v.hex);
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 16, 480),
    new THREE.MeshBasicMaterial({ color: col.clone().lerp(WHITE, 0.35).multiplyScalar(2.0 * glow) }));
  const beam = new THREE.Mesh(new THREE.TorusGeometry(R, 0.3, 48, 480), beamMat(col, 2.6, 0.85 * glow, i * 1.7));
  const haze = new THREE.Mesh(new THREE.TorusGeometry(R, 1.2, 32, 240), beamMat(al, 5.5, 0.2 * glow, i * 1.7 + 0.6, -1));
  const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.62, 0.012, 12, 480),
    new THREE.MeshBasicMaterial({ color: col.clone().lerp(WHITE, 0.25).multiplyScalar(1.3 * glow) }));
  const edge = new THREE.Mesh(new THREE.TorusGeometry(R + 0.62, 0.14, 32, 480), beamMat(al, 3.0, 0.32 * glow, i * 1.7 + 1.1, -1));
  const N = 1800, pp = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const a = Math.random() * Math.PI * 2, rad = R + (Math.random() - 0.5) * 1.4 * Math.random();
    pp.set([Math.cos(a) * rad, Math.sin(a) * rad, (Math.random() - 0.5) * 0.7], k * 3);
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const grains = new THREE.Points(pg, new THREE.PointsMaterial({
    size: 0.045, map: DOT, color: col.clone().lerp(CREMA, 0.55), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  if (v.morbido) {
    // solo luce diffusa: fascio largo e morbido, alone più forte, niente fili netti
    const soft = new THREE.Mesh(new THREE.TorusGeometry(R, 0.55, 48, 480), beamMat(col, 1.6, 0.55 * glow, i * 1.7));
    const wide = new THREE.Mesh(new THREE.TorusGeometry(R, 1.5, 32, 240), beamMat(al, 3.5, 0.35 * glow, i * 1.7 + 0.6, -1));
    g.add(wide, soft, grains);
  } else g.add(edge, band, haze, beam, core, grains);
  g.userData.grains = grains;
  return g;
}

// griglia 3 x 2
const COLS = 3, SX = 6.6, SY = 5.6, S = 0.36;
const cella = (i) => new THREE.Vector3((i % COLS - 1) * SX, i < COLS ? SY / 2 : -SY / 2, 0);
let rings = [], glow = 0.7, focus = -1;
const labels = VARIANTI.map((v) => {
  const d = document.createElement('div'); d.className = 'lab';
  d.innerHTML = `<b>${v.nome}</b><span>${v.hex}${v.alone ? ' · alone ' + v.alone : ''}</span><i>${v.nota}</i>`;
  document.body.appendChild(d); return d;
});
function build() {
  rings.forEach((g) => scene.remove(g));
  beams.length = 0;
  rings = VARIANTI.map((v, i) => { const g = anello(v, glow, i); g.rotation.z = i * 0.7; scene.add(g); return g; });
  layout();
}
function layout() {
  rings.forEach((g, i) => {
    const solo = focus === i;
    g.visible = focus < 0 || solo;
    g.position.copy(solo ? new THREE.Vector3(0, 0.4, 0) : cella(i));
    g.scale.setScalar(solo ? 0.95 : S);
  });
}

const ui = document.getElementById('ui');
[[0.4, 'luce 40%'], [0.7, 'luce 70%'], [1, 'luce 100%']].forEach(([k, t]) => {
  const b = document.createElement('button'); b.textContent = t; b.dataset.k = k;
  b.onclick = () => { glow = k; build(); sync(); };
  ui.appendChild(b);
});
const sync = () => [...ui.children].forEach((b) => b.classList.toggle('on', +b.dataset.k === glow));
build(); sync();

const ray = new THREE.Raycaster(), m2 = new THREE.Vector2();
const hitPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hp = new THREE.Vector3();
canvas.addEventListener('click', (e) => {
  if (focus >= 0) { focus = -1; layout(); return; }
  m2.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(m2, camera);
  if (!ray.ray.intersectPlane(hitPlane, hp)) return;
  let best = -1, bd = 1e9;
  rings.forEach((g, i) => { const d = g.position.distanceTo(hp); if (d < bd) { bd = d; best = i; } });
  if (bd < 2.6) { focus = best; layout(); }
});

const tmp = new THREE.Vector3();
function placeLabels() {
  labels.forEach((d, i) => {
    const solo = focus === i;
    d.style.display = focus < 0 || solo ? 'block' : 'none';
    tmp.copy(rings[i].position); tmp.y -= (solo ? 5.2 : 2.35);
    tmp.project(camera);
    d.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px';
    d.style.top = ((1 - tmp.y) / 2 * innerHeight) + 'px';
  });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime(), dt = clock.getDelta();
  beams.forEach((m) => { m.uniforms.uTime.value = t; });
  rings.forEach((g, i) => { g.rotation.z += 0.0008 * (1 + i * 0.3); g.userData.grains.rotation.z -= 0.003; });
  camera.aspect = innerWidth / innerHeight;
  placeLabels();
  composer.render();
});
