// Pagina di prova (fuori dal sito pubblicato): tre soggetti al posto del Battistero, in tre materiali.
// Soggetti: una sedia vuota, un cerchio di sedie, un ponte ad arco ribassato (schizzo del Ponte di Mezzo,
// da confrontare con le foto vere). Materiali: tessere di mosaico in smalto rosso, coriandoli di carta, microbolle.
// I pezzi arrivano a vortice e si posano, come i grani del Battistero.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/* scena */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2b0d0c');
scene.fog = new THREE.Fog('#2b0d0c', 18, 40);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(3.5, 2.2, 14);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;

// lo stesso studio fotografico della pagina iniziale: strisce di luce calda su fondo scuro
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
const studioScene = studio();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(studioScene, 0).texture;
const cubo = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
new THREE.CubeCamera(0.1, 50, cubo).update(renderer, studioScene); // per il riflesso delle microbolle
scene.add(new THREE.AmbientLight('#ffd9c0', 0.35));
const key = new THREE.DirectionalLight('#ffd2b0', 2.2);
key.position.set(-4, 6, 6);
scene.add(key);
const rim = new THREE.PointLight('#ff3a1a', 30, 30);
rim.position.set(4, -1, -5);
scene.add(rim);

/* superfici da campionare: ogni parte ha un'area e una funzione che dà un punto e la sua normale */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function box(cx, cy, cz, sx, sy, sz, rotY = 0, off = V(0, 0, 0), scala = 1) {
  // sei facce di un parallelepipedo, ruotato attorno all'asse verticale e spostato
  const facce = [
    [V(1, 0, 0), sy * sz], [V(-1, 0, 0), sy * sz], [V(0, 1, 0), sx * sz], [V(0, -1, 0), sx * sz], [V(0, 0, 1), sx * sy], [V(0, 0, -1), sx * sy],
  ];
  const parti = [];
  for (const [n, a] of facce) {
    parti.push({
      area: a * scala * scala,
      punto() {
        const u = Math.random() - 0.5, v = Math.random() - 0.5;
        const p = V(cx, cy, cz);
        if (n.x) p.add(V(n.x * sx / 2, u * sy, v * sz));
        else if (n.y) p.add(V(u * sx, n.y * sy / 2, v * sz));
        else p.add(V(u * sx, v * sy, n.z * sz / 2));
        return { p: p.applyAxisAngle(V(0, 1, 0), rotY).multiplyScalar(scala).add(off), n: n.clone().applyAxisAngle(V(0, 1, 0), rotY) };
      },
    });
  }
  return parti;
}
function cilindro(cx, cz, y0, y1, r, rotY = 0, off = V(0, 0, 0), scala = 1) {
  return [{
    area: 2 * Math.PI * r * (y1 - y0) * scala * scala,
    punto() {
      const a = Math.random() * Math.PI * 2;
      const n = V(Math.cos(a), 0, Math.sin(a));
      const p = V(cx + n.x * r, lerp(y0, y1, Math.random()), cz + n.z * r);
      return { p: p.applyAxisAngle(V(0, 1, 0), rotY).multiplyScalar(scala).add(off), n: n.applyAxisAngle(V(0, 1, 0), rotY) };
    },
  }];
}
// una sedia di legno semplice: seduta, quattro gambe, schienale con due montanti e tre stecche
function sedia(rotY = 0, off = V(0, 0, 0), s = 1) {
  const W = 3, D = 2.8, h = 0.26;
  const parti = [...box(0, 0, 0, W, h, D, rotY, off, s)];
  for (const [x, z] of [[-1.3, -1.15], [1.3, -1.15], [-1.3, 1.15], [1.3, 1.15]]) parti.push(...cilindro(x, z, -3.1, -0.13, 0.13, rotY, off, s));
  for (const x of [-1.3, 1.3]) parti.push(...box(x, 1.75, -1.2, 0.24, 3.5, 0.24, rotY, off, s));
  parti.push(...box(0, 3.3, -1.2, 2.84, 0.5, 0.18, rotY, off, s));
  for (const y of [1.2, 2.2]) parti.push(...box(0, y, -1.2, 2.4, 0.2, 0.14, rotY, off, s));
  return parti;
}
// ponte ad arco ribassato: impalcato, parapetti, intradosso curvo, timpani laterali, spalle
function ponte() {
  const L = 10, Wd = 2.6, yD = 1.2, sp = 7.2, freccia = 2.3, yB = yD - 0.3;
  const parti = [...box(0, yD, 0, L, 0.32, Wd), ...box(0, yD + 0.6, Wd / 2 - 0.1, L, 0.9, 0.2), ...box(0, yD + 0.6, -Wd / 2 + 0.1, L, 0.9, 0.2)];
  const R = (sp * sp / 4 + freccia * freccia) / (2 * freccia), yc = yB - R; // cerchio che passa per l'imposta e la chiave
  const archY = (x) => yc + Math.sqrt(Math.max(R * R - x * x, 0));
  const yImp = archY(sp / 2);
  parti.push({
    area: sp * 1.1 * Wd,
    punto() {
      const x = (Math.random() - 0.5) * sp, z = (Math.random() - 0.5) * Wd;
      return { p: V(x, archY(x), z), n: V(-x, yc - archY(x), 0).normalize() };
    },
  });
  for (const lato of [1, -1]) {
    parti.push({
      area: L * (yD - yImp) * 0.75,
      punto() {
        // il timpano: la parete tra l'arco e l'impalcato, fino alle spalle
        for (;;) {
          const x = (Math.random() - 0.5) * L, y = lerp(yImp - 1.6, yD, Math.random());
          const sotto = Math.abs(x) < sp / 2 ? archY(x) : yImp - 1.6;
          if (y > sotto) return { p: V(x, y, lato * Wd / 2), n: V(0, 0, lato) };
        }
      },
    });
  }
  return parti;
}
const SOGGETTI = {
  sedia: { nome: 'sedia vuota', parti: () => sedia(0.35, V(0, -0.1, 0)), nota: 'Una sedia vuota che si riempie: chiude "Riempi il vuoto" e "trova il tuo posto" con un oggetto solo.' },
  cerchio: {
    nome: 'cerchio di sedie',
    parti: () => {
      const tutte = [], n = 7;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        tutte.push(...sedia(-a - Math.PI / 2, V(Math.cos(a) * 3.4, -1.6, Math.sin(a) * 3.4), 0.45));
      }
      return tutte;
    },
    nota: "Sette sedie rivolte al centro: l'incontro e il gruppo. Si legge meglio dall'alto.",
  },
  ponte: { nome: 'ponte', parti: ponte, nota: 'Schizzo di un ponte ad arco ribassato: per il Ponte di Mezzo vero va rifatto sulle foto (proporzioni, parapetto, piloni).' },
};

/* i tre materiali */
const MATERIALI = {
  mosaico: { nome: 'tessere di mosaico', nota: 'Tessere in smalto rosso, lo stesso della L e dei cerchi.' },
  carta: { nome: 'coriandoli di carta', nota: 'Foglietti di carta rossa opaca, come i cigni e le pagine. Arrivando girano su se stessi.' },
  bolle: { nome: 'microbolle', nota: 'Bolle trasparenti senza colori, filo bianco sul bordo, come la bolla della L.' },
};
const ROSSI_SMALTO = ['#8a0603', '#9c0c06', '#73040a', '#a8180e'].map((c) => new THREE.Color(c));
const ROSSI_CARTA = ['#b3160d', '#9a0f08', '#c8301f', '#7e0a06', '#d9a594'].map((c) => new THREE.Color(c));
const matBolla = new THREE.ShaderMaterial({
  uniforms: { uEnv: { value: cubo.texture } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main(){
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform samplerCube uEnv; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(vV);
      float ndv = clamp(dot(N, V), 0.0, 1.0);
      float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      vec3 c = textureCube(uEnv, reflect(-V, N)).rgb * F * 0.9;
      c += vec3(1.0) * smoothstep(0.75, 1.0, 1.0 - ndv) * 0.35;
      gl_FragColor = vec4(c, 1.0);
    }`,
});

/* costruzione */
let mesh = null, dati = null, soggetto = 'sedia', materiale = 'mosaico', N = 8000, form = 0;
const tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), Z = V(0, 0, 1);
function costruisci() {
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); if (mesh.material !== matBolla) mesh.material.dispose(); }
  const parti = SOGGETTI[soggetto].parti();
  const area = parti.reduce((s, x) => s + x.area, 0);
  const lato = Math.sqrt(area / N); // misura di un pezzo perché la superficie resti coperta
  let geo, mat;
  if (materiale === 'mosaico') {
    geo = new THREE.BoxGeometry(lato * 0.9, lato * 0.9, lato * 0.32);
    mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 });
  } else if (materiale === 'carta') {
    geo = new THREE.PlaneGeometry(lato * 1.15, lato * 1.15);
    mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.25 });
  } else {
    geo = new THREE.SphereGeometry(lato * 0.55, 14, 10);
    mat = matBolla;
  }
  mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // ogni pezzo: dove va, come è orientato, da dove parte nella nuvola, un seme per i ritardi
  const cum = []; let acc = 0;
  for (const x of parti) { acc += x.area; cum.push(acc); }
  dati = [];
  for (let i = 0; i < N; i++) {
    const r = Math.random() * acc;
    const parte = parti[cum.findIndex((c) => c >= r)];
    const { p, n } = parte.punto();
    const qFin = new THREE.Quaternion().setFromUnitVectors(Z, n.normalize());
    qFin.multiply(new THREE.Quaternion().setFromAxisAngle(Z, materiale === 'carta' ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * 0.12));
    dati.push({
      p, qFin, nuvola: new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 4),
      seme: Math.random(), asse: new THREE.Vector3().randomDirection(), giri: 2 + Math.random() * 4,
    });
    const pal = materiale === 'carta' ? ROSSI_CARTA : ROSSI_SMALTO;
    if (materiale !== 'bolle') mesh.setColorAt(i, pal[Math.floor(Math.random() * pal.length)]);
  }
  scene.add(mesh);
  form = 0;
}
function aggiorna(t) {
  const giroQ = new THREE.Quaternion();
  for (let i = 0; i < N; i++) {
    const d = dati[i];
    const f = smooth(clamp(form * 1.5 - d.seme * 0.5));
    // la nuvola gira attorno all'asse verticale e rallenta mentre i pezzi si posano
    const a = (1 - f) * (3 + d.seme * 3) + t * 0.2 * (1 - f);
    const c = Math.cos(a), s = Math.sin(a);
    tmpP.set(d.nuvola.x * c - d.nuvola.z * s, d.nuvola.y * (0.6 + 0.4 * f), d.nuvola.x * s + d.nuvola.z * c);
    tmpP.lerp(d.p, f);
    // posati, tremano appena; la carta continua a fremere un poco di più
    const tremo = (materiale === 'carta' ? 0.012 : 0.006) + (1 - f) * 0.15;
    tmpP.x += Math.sin(t * 0.9 + d.seme * 40) * tremo;
    tmpP.y += Math.cos(t * 0.8 + d.seme * 31) * tremo;
    // in volo ruotano su se stessi, posandosi prendono l'orientamento della superficie
    giroQ.setFromAxisAngle(d.asse, (1 - f) * d.giri * Math.PI + t * (1 - f) * 2);
    tmpQ.copy(giroQ).slerp(d.qFin, f);
    const sc = materiale === 'bolle' ? 0.5 + 0.5 * f : 1;
    tmpS.setScalar(sc);
    tmpM.compose(tmpP, tmpQ, tmpS);
    mesh.setMatrixAt(i, tmpM);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/* pannello */
const scriviNota = () => { document.getElementById('nota').textContent = `${SOGGETTI[soggetto].nota} ${MATERIALI[materiale].nota}`; };
function pulsanti(id, voci, scelta, cambia) {
  const box = document.getElementById(id);
  for (const [k, v] of Object.entries(voci)) {
    const b = document.createElement('button');
    b.textContent = v.nome;
    b.className = k === scelta ? 'su' : '';
    b.onclick = () => { box.querySelectorAll('button').forEach((x) => x.classList.remove('su')); b.classList.add('su'); cambia(k); costruisci(); scriviNota(); };
    box.appendChild(b);
  }
}
const qs = new URLSearchParams(location.search);
if (qs.get('soggetto') in SOGGETTI) soggetto = qs.get('soggetto');
if (qs.get('materiale') in MATERIALI) materiale = qs.get('materiale');
pulsanti('soggetti', SOGGETTI, soggetto, (k) => { soggetto = k; });
pulsanti('materiali', MATERIALI, materiale, (k) => { materiale = k; });
document.getElementById('ricomponi').onclick = () => { form = 0; };
document.getElementById('gira').onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.target.classList.toggle('su', controls.autoRotate); };
document.getElementById('quanti').oninput = (e) => { N = Number(e.target.value); document.getElementById('nq').textContent = N; costruisci(); };
costruisci();
scriviNota();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  form = Math.min(1, form + dt / 4.5); // in circa quattro secondi e mezzo i pezzi si posano
  aggiorna(t);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
if (import.meta.env.DEV) window.__prova = { scene, camera, renderer };
