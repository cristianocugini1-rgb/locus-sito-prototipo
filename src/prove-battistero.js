// Pagina di prova (fuori dal sito pubblicato): il Battistero fatto in Blender e coperto di tessere in file regolari.
// Le tessere arrivano a vortice e si incastrano al loro posto; il movimento lo calcola la scheda video, così
// anche 50.000 tessere restano fluide. Sotto c'è l'anima scura dell'edificio, che si vede nelle fughe.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = import.meta.env.BASE_URL;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2b0d0c');
scene.fog = new THREE.Fog('#2b0d0c', 22, 45);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(6, 1.5, 15);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// lo studio fotografico della pagina iniziale, per i riflessi dello smalto
function studio() {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#060101');
  const luce = (w, h, c, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  luce(7, 1.1, '#ffe4c8', 4.5, [0, 5, 2.5]);
  luce(0.5, 7, '#ffffff', 7, [-5, 0, 3]);
  luce(0.5, 7, '#ffd2a8', 5, [5, 0.5, 1.5]);
  luce(1.4, 1.4, '#ffffff', 10, [2.2, 2.2, 5]);
  luce(4, 3, '#ff5a2a', 1.4, [0, -1, -6]);
  luce(12, 12, '#3a0806', 0.7, [0, -5, 0]);
  return s;
}
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio(), 0).texture;
scene.environmentIntensity = 0.7;
scene.add(new THREE.AmbientLight('#ffd9c0', 0.3));
// luce radente da sinistra in alto: le logge rientrate restano in ombra e l'occhio legge i piani
const sole = new THREE.DirectionalLight('#ffd6b8', 3.2);
sole.position.set(-7, 9, 8);
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
Object.assign(sole.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
sole.shadow.bias = -0.0004;
sole.shadow.normalBias = 0.02;
scene.add(sole);
const rim = new THREE.PointLight('#ff3a1a', 40, 30);
rim.position.set(5, -1, -6);
scene.add(rim);

/* materiali delle tessere */
const MATERIALI = {
  smalto: {
    nome: 'smalto rosso',
    toni: [['#8a0603', '#9c0c06', '#7a0405', '#a8180e'], ['#b8261a', '#a81c10'], ['#5e0306', '#6a0507']],
    mat: () => new THREE.MeshPhysicalMaterial({ roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 }),
  },
  marmo: {
    nome: 'marmo rosa',
    toni: [['#e8c4b2', '#e3bba8', '#ecccbb'], ['#f3dccd', '#f0d6c6'], ['#cf9988', '#d9a594']],
    mat: () => new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.25, envMapIntensity: 0.8 }),
  },
};
let materiale = new URLSearchParams(location.search).get('tessere') === 'marmo' ? 'marmo' : 'smalto';

/* il movimento delle tessere, nella scheda video: ognuna gira su se stessa e arriva dalla nuvola */
const uni = { uForm: { value: 0 }, uTime: { value: 0 } };
function conMovimento(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aNuvola; attribute float aSeme;
        uniform float uForm, uTime;
        mat3 ruota(vec3 a, float g){ float c = cos(g), s = sin(g), t = 1.0 - c;
          return mat3(t*a.x*a.x + c, t*a.x*a.y + s*a.z, t*a.x*a.z - s*a.y,
                      t*a.x*a.y - s*a.z, t*a.y*a.y + c, t*a.y*a.z + s*a.x,
                      t*a.x*a.z + s*a.y, t*a.y*a.z - s*a.x, t*a.z*a.z + c); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float fT = smoothstep(0.0, 1.0, clamp(uForm * 1.6 - aSeme * 0.6, 0.0, 1.0));
        vec3 asse = normalize(vec3(sin(aSeme * 91.0), cos(aSeme * 47.0), sin(aSeme * 13.0) + 0.2));
        mat3 giraT = ruota(asse, (1.0 - fT) * (5.0 + aSeme * 7.0) + uTime * 1.5 * (1.0 - fT));
        objectNormal = giraT * objectNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = giraT * transformed;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
        vec3 meta = vec3(instanceMatrix[3]);
        float giro = (1.0 - fT) * (3.0 + aSeme * 3.0) + uTime * 0.2 * (1.0 - fT);
        float cg = cos(giro), sg = sin(giro);
        vec3 nuv = vec3(aNuvola.x * cg - aNuvola.z * sg, aNuvola.y, aNuvola.x * sg + aNuvola.z * cg);
        mvPosition.xyz += (nuv - meta) * (1.0 - fT);
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}

/* carica le tessere: 16 byte l'una (vedi blender/battistero.py) */
let tessere = null, anima = null, toni = null;
const dati = await fetch(`${BASE}modelli/battistero-tessere.bin`).then((r) => r.arrayBuffer());
const dv = new DataView(dati);
const N = dati.byteLength / 16;
const geo = new THREE.BoxGeometry(1, 1, 1);
geo.translate(0, 0, 0.5); // la tessera poggia sulla superficie, non ci affonda
const matrici = [], nuvola = new Float32Array(N * 3), seme = new Float32Array(N);
toni = new Uint8Array(N);
{
  const m = new THREE.Matrix4(), n = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const o = i * 16;
    p.set(dv.getInt16(o, true), dv.getInt16(o + 2, true), dv.getInt16(o + 4, true)).divideScalar(4000);
    n.set(dv.getInt8(o + 6), dv.getInt8(o + 7), dv.getInt8(o + 8)).normalize();
    u.set(dv.getInt8(o + 9), dv.getInt8(o + 10), dv.getInt8(o + 11)).normalize();
    v.crossVectors(n, u);
    const lu = dv.getUint8(o + 12) / 1000, lv = dv.getUint8(o + 13) / 1000;
    toni[i] = dv.getUint8(o + 14);
    const sp = Math.min(lu, lv) * 0.35;
    m.makeBasis(u.clone().multiplyScalar(lu), v.clone().multiplyScalar(lv), n.clone().multiplyScalar(sp)).setPosition(p);
    matrici.push(m.clone());
    const c = new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 5);
    nuvola.set([c.x, c.y * 1.3, c.z], i * 3);
    seme[i] = Math.random();
  }
}
geo.setAttribute('aNuvola', new THREE.InstancedBufferAttribute(nuvola, 3));
geo.setAttribute('aSeme', new THREE.InstancedBufferAttribute(seme, 1));

function costruisci() {
  if (tessere) { scene.remove(tessere); tessere.material.dispose(); tessere.dispose(); }
  const M = MATERIALI[materiale];
  tessere = new THREE.InstancedMesh(geo, conMovimento(M.mat()), N);
  tessere.frustumCulled = false; // si spostano nella scheda video: i limiti calcolati qui non valgono
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    tessere.setMatrixAt(i, matrici[i]);
    const pal = M.toni[toni[i]] || M.toni[0];
    tessere.setColorAt(i, col.set(pal[Math.floor(Math.random() * pal.length)]));
  }
  tessere.receiveShadow = true;
  scene.add(tessere);
}
costruisci();

new GLTFLoader().load(`${BASE}modelli/battistero-anima.glb`, (g) => {
  anima = g.scene;
  anima.traverse((o) => {
    if (!o.isMesh) return;
    o.material = new THREE.MeshStandardMaterial({ color: '#1e0807', roughness: 1, metalness: 0, transparent: true, opacity: 0 });
    o.castShadow = o.receiveShadow = true;
  });
  scene.add(anima);
});

/* pannello */
const box = document.getElementById('materiali');
for (const [k, v] of Object.entries(MATERIALI)) {
  const b = document.createElement('button');
  b.textContent = v.nome;
  b.className = k === materiale ? 'su' : '';
  b.onclick = () => { box.querySelectorAll('button').forEach((x) => x.classList.remove('su')); b.classList.add('su'); materiale = k; costruisci(); };
  box.appendChild(b);
}
const interruttore = (id, fai) => { const b = document.getElementById(id); b.onclick = () => { b.classList.toggle('su'); fai(b.classList.contains('su')); }; };
let conAnima = true, conOmbre = true;
document.getElementById('ricomponi').onclick = () => { uni.uForm.value = 0; };
interruttore('gira', (on) => { controls.autoRotate = on; });
interruttore('anima', (on) => { conAnima = on; });
interruttore('ombre', (on) => { conOmbre = on; });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  uni.uTime.value = clock.elapsedTime;
  uni.uForm.value = Math.min(1, uni.uForm.value + dt / 5); // in cinque secondi le tessere sono tutte al loro posto
  const fatto = uni.uForm.value >= 1;
  // le ombre si accendono a mosaico composto (in volo la scheda video sposta le tessere, l'ombra non lo saprebbe)
  tessere.castShadow = fatto && conOmbre;
  sole.castShadow = conOmbre;
  if (anima) {
    const a = conAnima ? THREE.MathUtils.smoothstep(uni.uForm.value, 0.55, 0.95) : 0;
    anima.visible = a > 0.001;
    anima.traverse((o) => { if (o.isMesh) { o.material.opacity = a; o.material.transparent = a < 1; o.material.depthWrite = a >= 1; } });
  }
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
