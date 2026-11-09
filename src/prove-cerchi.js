// Pagina di prova: il cerchio di oggi e cinque varianti, da confrontare dal vivo.
// Non fa parte del sito: serve solo a scegliere. ?m=0..5 apre direttamente un modello.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COL = new THREE.Color('#ffd9a8');   // il crema del primo cerchio
const METAL = '#c9a982';
const GLOW = 0.38;
const R = 2.9;

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2b0d0c');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.AmbientLight('#ffd9c0', 0.25));
const key = new THREE.PointLight('#ffb27a', 26, 40); key.position.set(3.5, 4, 6); scene.add(key);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.45, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));

// lo stesso fascio di luce dei cerchi del sito
const beamVS = `varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const beamFS = `uniform vec3 uColor; uniform float uTime, uPower, uGain, uSeed, uSweep;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float body = pow(facing, uPower);
    float a = atan(vP.y, vP.x);
    float flow = 0.5 + 0.5 * sin(a * 3.0 - uTime * 1.2 + uSeed) * sin(a * 7.0 + uTime * 0.55 + uSeed * 2.0);
    float spark = pow(max(sin(a * 19.0 - uTime * 2.2 + uSeed), 0.0), 16.0);
    // uSweep > 0: la luce si raccoglie in una scia che gira
    float d = mod(a - uTime * 0.9 + 6.2832, 6.2832);
    float sweep = mix(1.0, 0.15 + 2.2 * exp(-d * 1.6), uSweep);
    float i = body * uGain * (0.6 + flow * 0.7 + spark * 0.7) * sweep;
    gl_FragColor = vec4(uColor * i, 1.0);
  }`;
const beams = [];
const beamMat = (power, gain, seed, sweep = 0) => {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: COL }, uTime: { value: 0 }, uPower: { value: power }, uGain: { value: gain * GLOW }, uSeed: { value: seed }, uSweep: { value: sweep } },
    vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  beams.push(m); return m;
};
const coreMat = (k = 1) => new THREE.MeshBasicMaterial({ color: COL.clone().lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.0 * GLOW * k) });
const metalMat = (c = METAL) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 1, roughness: 0.3, anisotropy: 0.8, clearcoat: 0.25, envMapIntensity: 0.6 });

const dot = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
function grains(n = 1400, spread = 0.9) {
  const p = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, rad = R + (Math.random() - 0.5) * spread * Math.random();
    p.set([Math.cos(a) * rad, Math.sin(a) * rad, (Math.random() - 0.5) * 0.45], k * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.04, map: dot, color: COL.clone().lerp(new THREE.Color('#F5E4CB'), 0.55), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
}
function ticks(r, n = 96, mat = metalMat(), len = 0.09) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 1, 0.03), mat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, long = k % 8 === 0, l = long ? len * 2.1 : len;
    p.set(Math.cos(a) * (r + l / 2), Math.sin(a) * (r + l / 2), 0);
    q.setFromAxisAngle(z, a - Math.PI / 2);
    m.setMatrixAt(k, m4.compose(p, q, s.set(1, l, 1)));
  }
  return m;
}
const torus = (r, tube, mat, seg = 480) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 24, seg), mat);
function band(r = R + 0.39, depth = 4.5, tube = 0.038, c) { const b = torus(r, tube, metalMat(c)); b.scale.z = depth; return b; }

/* ------------------------------------------------------------------ */
/* 0. come oggi                                                         */
/* ------------------------------------------------------------------ */
function oggi() {
  const g = new THREE.Group(), spin = new THREE.Group(), gr = grains(), tk = ticks(R + 0.55);
  spin.add(band(), tk, torus(R, 0.75, beamMat(5.5, 0.2, 0.6), 240), torus(R, 0.19, beamMat(2.6, 0.85, 0)), torus(R, 0.019, coreMat()), gr);
  g.add(spin);
  return { g, name: 'Come oggi', note: 'Il cerchio che c’è adesso nel sito, per confronto.',
    update(t) { spin.rotation.z = t * 0.04; gr.rotation.z = -t * 0.18; tk.rotation.z = -t * 0.05; } };
}

/* ------------------------------------------------------------------ */
/* 1. doppio filo                                                       */
/* ------------------------------------------------------------------ */
function doppio() {
  const g = new THREE.Group(), spin = new THREE.Group(), gr = grains(900, 0.5);
  spin.add(band(R + 0.42, 3, 0.03), torus(R - 0.09, 0.012, coreMat(1.2)), torus(R + 0.09, 0.012, coreMat(1.2)),
    torus(R, 0.16, beamMat(3.2, 0.6, 0)), gr);
  g.add(spin);
  return { g, name: 'Doppio filo', note: 'Due fili di luce paralleli al posto di uno, con un alone più stretto. Più sottile e più elegante, come un gioiello.',
    update(t) { spin.rotation.z = t * 0.04; gr.rotation.z = -t * 0.14; } };
}

/* ------------------------------------------------------------------ */
/* 2. luminarie                                                         */
/* ------------------------------------------------------------------ */
function luminarie() {
  const g = new THREE.Group(), spin = new THREE.Group();
  const N = 72, bulbs = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), coreMat(1.6).clone());
    b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); bulbs.push(b); spin.add(b);
  }
  spin.add(band(), torus(R, 0.007, coreMat(0.5)), torus(R, 0.75, beamMat(5.5, 0.16, 0.6), 240));
  g.add(spin);
  const base = COL.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  return { g, name: 'Luminarie', note: 'Il filo di luce diventa una fila di lampadine, come le luminarie di una festa di piazza. Brillano piano, ognuna col suo ritmo.',
    update(t) {
      spin.rotation.z = t * 0.03;
      bulbs.forEach((b, k) => b.material.color.copy(base).multiplyScalar(2.0 * GLOW * (1.2 + 0.9 * Math.sin(t * 1.3 + k * 2.39))));
    } };
}

/* ------------------------------------------------------------------ */
/* 3. alone                                                             */
/* ------------------------------------------------------------------ */
function alone() {
  const g = new THREE.Group(), spin = new THREE.Group(), gr = grains(2200, 1.6);
  spin.add(torus(R, 1.1, beamMat(4.0, 0.32, 0.6), 240), torus(R, 0.3, beamMat(2.2, 0.7, 0)), torus(R, 0.016, coreMat(0.9)), gr);
  g.add(spin);
  return { g, name: 'Alone', note: 'Niente metallo: solo luce e polvere luminosa, morbida e larga, come un’eclissi. Il più leggero e poetico.',
    update(t) { spin.rotation.z = t * 0.04; gr.rotation.z = -t * 0.1; } };
}

/* ------------------------------------------------------------------ */
/* 4. ghiera d'ottone                                                   */
/* ------------------------------------------------------------------ */
function ghiera() {
  const g = new THREE.Group(), spin = new THREE.Group(), tk = ticks(R + 0.2, 144, metalMat('#d9bf98'), 0.07);
  const outer = band(R + 0.5, 6, 0.05, '#d4b384'), inner = band(R - 0.32, 6, 0.04, '#d4b384');
  spin.add(outer, inner, tk, torus(R + 0.09, 0.14, beamMat(2.6, 0.75, 0)), torus(R + 0.09, 0.017, coreMat()), grains(800, 0.4));
  g.add(spin);
  return { g, name: 'Ghiera d’ottone', note: 'Due anelli d’ottone più larghi racchiudono la luce, con le tacche incise in mezzo. Più materico e prezioso, come un vecchio strumento.',
    update(t) { spin.rotation.z = t * 0.03; tk.rotation.z = -t * 0.04; } };
}

/* ------------------------------------------------------------------ */
/* 5. scia                                                              */
/* ------------------------------------------------------------------ */
function scia() {
  const g = new THREE.Group(), spin = new THREE.Group(), gr = grains(), tk = ticks(R + 0.55);
  spin.add(band(), tk, torus(R, 0.75, beamMat(5.5, 0.2, 0.6, 1), 240), torus(R, 0.19, beamMat(2.6, 0.85, 0, 1)), torus(R, 0.019, coreMat(0.55)), gr);
  g.add(spin);
  return { g, name: 'Scia', note: 'Lo stesso cerchio di oggi, ma la luce si raccoglie in una scia che lo percorre piano, come un faro che gira. Il cerchio respira invece di stare sempre acceso.',
    update(t) { gr.rotation.z = -t * 0.18; tk.rotation.z = -t * 0.05; } };
}

/* ------------------------------------------------------------------ */
/* 6. onde                                                              */
/* ------------------------------------------------------------------ */
function onde() {
  const g = new THREE.Group(), spin = new THREE.Group();
  const waves = [0, 1, 2, 3].map(() => {
    const m = new THREE.MeshBasicMaterial({ color: COL.clone().lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(2.0 * GLOW), transparent: true });
    const w = torus(1, 0.006, m); spin.add(w); return w;
  });
  spin.add(band(), torus(R, 0.019, coreMat()), torus(R, 0.19, beamMat(2.6, 0.7, 0)), grains(900, 0.6));
  g.add(spin);
  return { g, name: 'Onde', note: 'Dal filo di luce partono anelli sottilissimi che si allargano piano e svaniscono, come i cerchi di un sasso nell’acqua.',
    update(t) {
      spin.rotation.z = t * 0.03;
      waves.forEach((w, k) => {
        const f = (t * 0.18 + k / 4) % 1;
        w.scale.setScalar(R - 0.5 + f * 1.4);
        w.material.opacity = Math.sin(f * Math.PI) * 0.9;
      });
    } };
}

/* ------------------------------------------------------------------ */
/* 7. treccia                                                           */
/* ------------------------------------------------------------------ */
function treccia() {
  const g = new THREE.Group(), spin = new THREE.Group();
  class Elica extends THREE.Curve {
    constructor(ph) { super(); this.ph = ph; }
    getPoint(u, v = new THREE.Vector3()) {
      const a = u * Math.PI * 2, w = a * 30 + this.ph, r = R + Math.cos(w) * 0.1;
      return v.set(Math.cos(a) * r, Math.sin(a) * r, Math.sin(w) * 0.1);
    }
  }
  [0, Math.PI].forEach((ph) => spin.add(new THREE.Mesh(new THREE.TubeGeometry(new Elica(ph), 1600, 0.011, 8, true), coreMat(1.1))));
  spin.add(band(R + 0.42, 3, 0.03), torus(R, 0.22, beamMat(2.8, 0.6, 0)), grains(800, 0.5));
  g.add(spin);
  return { g, name: 'Treccia', note: 'Due fili di luce intrecciati attorno al cerchio, come una corda o un filo d’oro ritorto. Due cose diverse che stanno insieme.',
    update(t) { spin.rotation.z = t * 0.05; } };
}

/* ------------------------------------------------------------------ */
/* 8. corona                                                            */
/* ------------------------------------------------------------------ */
function corona() {
  const g = new THREE.Group(), spin = new THREE.Group();
  const N = 260;
  const rays = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 1, 0.008), new THREE.MeshBasicMaterial({ color: COL.clone().multiplyScalar(1.1), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), N);
  const info = Array.from({ length: N }, (_, k) => ({ a: (k / N) * Math.PI * 2 + Math.random() * 0.02, l: 0.15 + Math.pow(Math.random(), 2) * 0.8, s: Math.random() * 6.28 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1);
  spin.add(rays, torus(R, 0.019, coreMat()), torus(R, 0.19, beamMat(2.6, 0.75, 0)), torus(R - 0.3, 0.025, metalMat()));
  g.add(spin);
  return { g, name: 'Corona', note: 'Dal filo di luce escono raggi sottilissimi di lunghezze diverse che pulsano piano, come la corona del sole durante un’eclissi.',
    update(t) {
      spin.rotation.z = t * 0.025;
      info.forEach((r, k) => {
        const l = r.l * (0.65 + 0.35 * Math.sin(t * 0.9 + r.s));
        p.set(Math.cos(r.a) * (R + 0.05 + l / 2), Math.sin(r.a) * (R + 0.05 + l / 2), 0);
        q.setFromAxisAngle(z, r.a - Math.PI / 2);
        rays.setMatrixAt(k, m4.compose(p, q, sc.set(1, l, 1)));
      });
      rays.instanceMatrix.needsUpdate = true;
    } };
}

/* ------------------------------------------------------------------ */
/* 9. abbraccio                                                         */
/* ------------------------------------------------------------------ */
function abbraccio() {
  const g = new THREE.Group();
  const half = () => {
    const h = new THREE.Group(), A = Math.PI * 0.94;
    const arcT = (tube, mat, seg = 240) => new THREE.Mesh(new THREE.TorusGeometry(R, tube, 24, seg, A), mat);
    h.add(arcT(0.019, coreMat()), arcT(0.19, beamMat(2.6, 0.85, 0)), arcT(0.7, beamMat(5.5, 0.18, 0.6)));
    const b = new THREE.Mesh(new THREE.TorusGeometry(R + 0.39, 0.038, 24, 240, A), metalMat()); b.scale.z = 4.5; h.add(b);
    return h;
  };
  const a = half(), b = half();
  g.add(a, b, grains(1000, 0.7));
  return { g, name: 'Abbraccio', note: 'Il cerchio è fatto di due metà che girano in versi opposti: si allontanano, si ritrovano e si chiudono. Un incontro, in forma di cerchio.',
    update(t) {
      const open = 0.5 + 0.5 * Math.sin(t * 0.5);
      a.rotation.z = 0.09 + open * 0.9;
      b.rotation.z = Math.PI + 0.09 - open * 0.9;
    } };
}

/* ------------------------------------------------------------------ */
/* 10. polvere d'oro                                                    */
/* ------------------------------------------------------------------ */
function polvere() {
  const g = new THREE.Group();
  const N = 7000, pos = new Float32Array(N * 3), sd = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const a = Math.random() * Math.PI * 2, rr = R + (Math.random() - 0.5) * 0.5 * Math.pow(Math.random(), 1.5);
    pos.set([Math.cos(a) * rr, Math.sin(a) * rr, (Math.random() - 0.5) * 0.25], k * 3); sd[k] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.BufferAttribute(sd, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uPix: { value: renderer.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT, uPix; attribute float aS; varying float vB;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vB = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uT * (0.8 + aS * 2.0) + aS * 40.0), 6.0);
        gl_PointSize = (1.0 + aS * 2.2) * uPix * (10.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * vB * (1.0 - smoothstep(0.05, 0.5, d)), 1.0); }`,
  });
  const dust = new THREE.Points(geo, mat);
  g.add(dust, torus(R, 0.01, coreMat(0.6)), torus(R, 0.5, beamMat(4.5, 0.18, 0.6), 240));
  return { g, name: 'Polvere d’oro', note: 'Il cerchio è fatto di settemila granelli dorati che scintillano a turno, con appena un filo di luce sotto. Prezioso e vivo, come polvere d’oro sospesa.',
    update(t) { mat.uniforms.uT.value = t; dust.rotation.z = t * 0.03; } };
}

const MODELS = [oggi, doppio, luminarie, alone, ghiera, scia, onde, treccia, corona, abbraccio, polvere].map((f) => f());
let cur = null;
const ui = document.getElementById('ui');
const nameB = document.querySelector('#name b'), nameS = document.querySelector('#name span');
MODELS.forEach((m, i) => {
  const b = document.createElement('button');
  b.textContent = i ? `${i}. ${m.name}` : m.name;
  b.onclick = () => show(i);
  ui.appendChild(b);
});
function show(i) {
  if (cur) scene.remove(cur.g);
  cur = MODELS[i];
  scene.add(cur.g);
  nameB.textContent = i ? `${i}. ${cur.name}` : cur.name;
  nameS.textContent = cur.note;
  [...ui.children].forEach((b, k) => b.classList.toggle('on', k === i));
}
show(Math.max(0, Math.min(MODELS.length - 1, +(new URLSearchParams(location.search).get('m') || 0))));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  beams.forEach((m) => { m.uniforms.uTime.value = t; });
  cur.g.rotation.x = Math.sin(t * 0.3) * 0.12; cur.g.rotation.y = Math.cos(t * 0.25) * 0.12;
  cur.update(t);
  composer.render();
});
