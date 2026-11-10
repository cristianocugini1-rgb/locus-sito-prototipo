// I mondi dopo i portali (in prova dal 10/11/2026).
// Dopo Conosci: fogli di carta che volano. Dopo Incontra: fili rossi (o d'oro, ?filo=oro) che si intrecciano.
// Dopo Costruisci: cigni di origami (o porcellana che si ricompone con le crepe d'oro, ?costruisci=porcellana).
// Attraversando ogni cerchio cambia anche il cielo: un fondo sfumato intonato agli oggetti.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const Q = new URLSearchParams(location.search);
export const FILO_ORO = Q.get('filo') !== 'rosso'; // dal 10/11 d'oro; rossi con ?filo=rosso
const MODELLI = `${import.meta.env.BASE_URL}modelli/`;

// i testi stampati sulle pagine: gli stessi già pubblicati nella seconda pagina, niente frasi nuove
const PAGINE = [
  { testata: 'Il problema', titolo: 'Il vuoto.', corpo: ['Una società spezzata, una generazione sola, una collettività anestetizzata.', 'La frattura. 4 su 400 i deputati sotto i 30 anni eletti nel 2022. Una politica senza ricambio non trova le parole per i temi di chi ha meno di 35 anni.'], num: 12 },
  { testata: 'La solitudine', titolo: '20,5%', corpo: ['dei 16-34enni si è sentito solo nelle ultime quattro settimane. Nel 2018 era l’11,7%.', 'L’anestesia. 35,4% dei 18-24enni non si informa mai di politica. Fino ai 34 anni, solo uno su quattro ne parla ogni settimana.'], num: 13 },
  { testata: 'La risposta', titolo: 'Riempire il vuoto.', corpo: ['Un media. Una comunità. Una voce.', 'Conosci. Casa, lavoro, salute mentale, costo della vita, clima: la politica non ne parla. Noi li portiamo nel dibattito, con i dati su Parma.'], num: 27 },
  { testata: 'Incontra', titolo: 'I format.', corpo: ['Serate dal vivo che rompono l’isolamento: persone diverse si confrontano e restano in contatto. Si entra dal Meet Up, il primo sabato del mese.', 'Costruisci. Trasformiamo istanze e bisogni della comunità in proposte, e le portiamo fino a chi decide.'], num: 28 },
];

// grana della carta: fibre leggere su un avorio caldo
function carta(g, w, h) {
  g.fillStyle = '#f3ebdd';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 60},${100 + Math.random() * 50},${80 + Math.random() * 40},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1);
  }
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(90,60,30,.12)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}
function aCapo(g, testo, x, y, larg, riga) {
  let r = '';
  for (const p of testo.split(' ')) {
    const prova = r ? r + ' ' + p : p;
    if (g.measureText(prova).width > larg && r) { g.fillText(r, x, y); y += riga; r = p; } else r = prova;
  }
  if (r) { g.fillText(r, x, y); y += riga; }
  return y;
}
function stampaPagina(pg) {
  const W = 704, H = 960, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  carta(g, W, H);
  const m = 78, ink = '#2a1a14';
  g.fillStyle = ink;
  g.font = 'italic 400 22px "EB Garamond", Georgia, serif';
  g.textAlign = 'center';
  g.fillText(pg.testata, W / 2, 74);
  g.fillStyle = 'rgba(42,26,20,.35)';
  g.fillRect(m, 92, W - m * 2, 1);
  g.fillStyle = ink;
  g.textAlign = 'left';
  g.font = '500 56px "EB Garamond", Georgia, serif';
  let y = aCapo(g, pg.titolo, m, 190, W - m * 2, 62) + 26;
  g.font = '400 27px "EB Garamond", Georgia, serif';
  pg.corpo.forEach((par) => { y = aCapo(g, par, m, y, W - m * 2, 40) + 22; });
  // il resto della pagina: righe di testo sfumate, come un libro vero visto da lontano
  g.fillStyle = 'rgba(42,26,20,.16)';
  while (y < H - 120) {
    const l = W - m * 2 - (Math.random() < 0.15 ? Math.random() * 260 : Math.random() * 30);
    g.fillRect(m, y - 12, l, 9);
    y += 40;
  }
  g.fillStyle = ink;
  g.font = '400 22px "EB Garamond", Georgia, serif';
  g.textAlign = 'center';
  g.fillText(String(pg.num), W / 2, H - 56);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function trama() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  carta(c.getContext('2d'), 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const PORCELLANA = Q.get('costruisci') === 'porcellana';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rnd = (a, b) => a + Math.random() * (b - a);
// la trasparenza serve solo per comparire e sparire: da pieni gli oggetti sono opachi
function opaco(mat, v) {
  mat.opacity = v;
  const tr = v < 0.999;
  if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
}

// cielo, polvere e luce di ogni mondo: alto, orizzonte, basso
const AMB = [
  { top: '#2b0d0c', mid: '#2b0d0c', bot: '#2b0d0c', dust: '#f3c9a8', light: '#ffd2b0' }, // prima dei cerchi
  { top: '#3d2b20', mid: '#2a1c15', bot: '#120c09', dust: '#f5e4cb', light: '#fff1dc' }, // carta: seppia, biblioteca al tramonto
  { top: '#4c0a11', mid: '#2e0509', bot: '#120204', dust: '#ffd0c0', light: '#ffd6c8' }, // fili: velluto rosso
  PORCELLANA
    ? { top: '#3d1511', mid: '#24090a', bot: '#0f0404', dust: '#fff1e4', light: '#fff0e2' } // porcellana: studio caldo
    : { top: '#1d1626', mid: '#4a1e24', bot: '#0d0a12', dust: '#ffe6dc', light: '#ffe8e0' }, // cigni: lago al crepuscolo
].map((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, new THREE.Color(v)])));

export function creaMondi(scene, { ringZ, small }) {
  const [z1, z2, z3] = ringZ;

  /* cielo ------------------------------------------------------------ */
  const skyUni = { uTop: { value: AMB[0].top.clone() }, uMid: { value: AMB[0].mid.clone() }, uBot: { value: AMB[0].bot.clone() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), new THREE.ShaderMaterial({
    uniforms: skyUni, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uBot; varying vec3 vD;
      void main(){
        float y = vD.y;
        vec3 c = y > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.55, y)) : mix(uMid, uBot, smoothstep(0.0, 0.55, -y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const loader = new GLTFLoader();
  const geometrie = (url, fn) => loader.load(url, (gltf) => {
    const out = [];
    gltf.scene.traverse((o) => { if (o.isMesh) out.push(o.geometry); });
    fn(out);
  }, undefined, () => {});

  /* 1. pagine di libro (modellate in Blender, testo stampato) -------- */
  const fogli = new THREE.Group();
  scene.add(fogli);
  const cartaMats = [];
  const NF = small ? 20 : 34;
  const nuovaPagina = (pg) => new THREE.MeshStandardMaterial({
    map: stampaPagina(pg), roughness: 0.85, metalness: 0, side: THREE.DoubleSide,
    emissive: '#5a4a3c', emissiveIntensity: 0.35, transparent: true, opacity: 0,
  });
  // si stampa quando il carattere del libro è pronto, altrimenti uscirebbe in Georgia
  const pronto = document.fonts ? document.fonts.load('400 27px "EB Garamond"').catch(() => {}) : Promise.resolve();
  pronto.then(() => {
    PAGINE.forEach((pg) => cartaMats.push(nuovaPagina(pg)));
    geometrie(`${MODELLI}pagine.glb`, (geos) => {
      geos.forEach((g) => g.rotateX(Math.PI / 2)); // da Blender escono coricate: si raddrizzano
      for (let i = 0; i < NF; i++) {
        const m = new THREE.Mesh(geos[i % geos.length], cartaMats[i % cartaMats.length]);
        const a = rnd(0, Math.PI * 2), rad = rnd(1.9, 3.6);
        m.position.set(Math.cos(a) * rad, Math.sin(a) * rad, z1 - 1.5 - Math.random() * (z1 - z2 - 2));
        m.scale.setScalar(rnd(1.0, 1.35));
        m.userData = { ph: rnd(0, 6.28), flip: rnd(0.2, 0.5) * (Math.random() < 0.5 ? -1 : 1), y0: m.position.y };
        fogli.add(m);
      }
    });
  });

  /* 2. fili rossi o d'oro ------------------------------------------- */
  const fili = new THREE.Group();
  scene.add(fili);
  const filoMat = FILO_ORO
    ? new THREE.MeshStandardMaterial({ color: '#dcb05a', metalness: 1, roughness: 0.28, emissive: '#7a5414', transparent: true, opacity: 0 })
    : new THREE.MeshPhysicalMaterial({ color: '#b3121a', metalness: 0.05, roughness: 0.38, sheen: 1, sheenColor: new THREE.Color('#ff9a8a'), sheenRoughness: 0.35, emissive: '#3a0204', transparent: true, opacity: 0 });
  // coppie di fili: i due fili di ogni coppia arrivano da lati opposti, si cercano e si chiudono in un nodo stretto.
  // Il nodo è un trifoglio: ogni filo ne disegna metà, e ognuno finisce dove è entrato l'altro.
  // I nodi stanno attorno al percorso a profondità diverse e si stringono uno dopo l'altro, mentre ti avvicini.
  const TSEG = 520, TRAD = 6, NP = small ? 4 : 5;
  // il nodo nasce largo, così si vede come si intrecciano i fili, poi si stringe tirando: il filo resta dello stesso spessore
  const K = 0.42, STRETTO = 0.3;
  const nodo = (s) => new THREE.Vector3(Math.sin(s) + 2 * Math.sin(2 * s), Math.cos(s) - 2 * Math.cos(2 * s), -Math.sin(3 * s)).multiplyScalar(K);
  function filo(partenza, s0, s1, fase) {
    const pts = [], entra = nodo(s0);
    for (let i = 0; i <= 9; i++) {
      const q = i / 10, lontano = 1 - q;
      pts.push(partenza.clone().lerp(entra, q).add(new THREE.Vector3(
        Math.cos(q * Math.PI * 2.4 + fase) * 1.1 * lontano, Math.sin(q * Math.PI * 2.4 + fase) * 0.9 * lontano, 0)));
    }
    for (let i = 0; i <= 48; i++) pts.push(nodo(s0 + (s1 - s0) * (i / 48)));
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  }
  // il tubo sa dove passa la sua linea centrale e quale parte è nodo: così il nodo si stringe senza assottigliare il filo
  const NPUNTI = 10 + 49;
  function tuboConNodo(curve) {
    const geo = new THREE.TubeGeometry(curve, TSEG, FILO_ORO ? 0.006 : 0.009, TRAD, false);
    const L = curve.getLengths(600);
    const u0 = L[Math.round((10 / (NPUNTI - 1)) * 600)] / L[600];  // dove finisce la coda e comincia il nodo
    const n = geo.attributes.position.count, cen = new Float32Array(n * 3), w = new Float32Array(n);
    const c = new THREE.Vector3();
    for (let i = 0; i <= TSEG; i++) {
      const u = i / TSEG;
      curve.getPointAt(u, c);
      const ww = clamp((u - (u0 - 0.05)) / 0.06);
      for (let j = 0; j <= TRAD; j++) {
        const k = i * (TRAD + 1) + j;
        cen.set([c.x, c.y, c.z], k * 3);
        w[k] = ww * ww * (3 - 2 * ww);
      }
    }
    geo.setAttribute('aCen', new THREE.BufferAttribute(cen, 3));
    geo.setAttribute('aNodo', new THREE.BufferAttribute(w, 1));
    return geo;
  }
  const coppie = [], filiMats = [];
  for (let j = 0; j < NP; j++) {
    const a = j * 2.4 + 0.6;                              // angoli sparsi, così i nodi non si allineano
    const rad = rnd(1.3, 1.9);                            // vicino al centro della vista, perché il nodo si legga
    const zK = z2 - 5 - j * ((z2 - z3 - 7) / (NP - 1));   // dal primo, vicino al cerchio, all'ultimo prima di Costruisci
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * rad, Math.sin(a) * rad, zK);
    const u = new THREE.Vector3(Math.cos(a), Math.sin(a), 0), v = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
    const geos = [
      filo(v.clone().multiplyScalar(2.6).addScaledVector(u, 1.4).setZ(6.5), 0, Math.PI, j),
      filo(v.clone().multiplyScalar(-2.6).addScaledVector(u, 1.1).setZ(5.5), Math.PI, Math.PI * 2, j + Math.PI),
    ].map((c) => tuboConNodo(c));
    const mat = filoMat.clone();
    const uStretto = { value: 1 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uStretto = uStretto;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aCen; attribute float aNodo; uniform float uStretto;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = mix(transformed, aCen * uStretto + (transformed - aCen), aNodo);');
    };
    mat.customProgramCacheKey = () => 'filo-nodo';
    filiMats.push(mat);
    geos.forEach((geo) => g.add(new THREE.Mesh(geo, mat)));
    g.userData = { zK, geos, ph: rnd(0, 6.28), uStretto };
    fili.add(g);
    coppie.push(g);
  }

  /* 3a. cigni di origami --------------------------------------------- */
  const cigni = new THREE.Group();
  // carta rossa vera (dall'11/11): colore, grana e pieghe cotti in Blender e portati dentro il modello.
  // Niente riflessi dello studio e niente lucido: è quello che la faceva sembrare plastificata.
  // Un velo di peluria (sheen) sui bordi, come le fibre della carta controluce.
  const origamiMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.12, specularIntensity: 0.15,
    sheen: 0.5, sheenRoughness: 0.9, sheenColor: new THREE.Color('#ff9c8c'),
    flatShading: true, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.07, transparent: true, opacity: 0,
  });
  const NC = 7;
  loader.load(`${MODELLI}cigno.glb`, (gltf) => {
    let cg = null;
    gltf.scene.traverse((o) => {
      if (!o.isMesh || cg) return;
      cg = o.geometry;
      origamiMat.map = o.material.map;
      origamiMat.emissiveMap = o.material.map;          // la luce di riempimento ha il colore della carta, non un rosso piatto
      origamiMat.normalMap = o.material.normalMap;
      origamiMat.normalScale.set(0.8, 0.8);
      origamiMat.needsUpdate = true;
    });
    if (!cg) return;
    for (let j = 0; j < NC; j++) {
      const m = new THREE.Mesh(cg, origamiMat);
      m.scale.setScalar(rnd(0.75, 0.95));
      m.userData = { a0: (j / NC) * Math.PI * 2, rx: rnd(2.4, 3.3), ry: rnd(1.4, 2.1), z: z3 - 3 - j * 1.6, ph: rnd(0, 6.28) };
      cigni.add(m);
    }
  });

  /* 3b. porcellana con le crepe d'oro -------------------------------- */
  const vaso = new THREE.Group();
  vaso.position.set(0, -0.1, z3 - 13);
  const porcMat = new THREE.MeshPhysicalMaterial({ color: '#f6f2ec', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const oroMat = new THREE.MeshStandardMaterial({ color: '#dcb05a', metalness: 1, roughness: 0.25, emissive: '#5a3a08', side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const prof = [[0.5, -1.2], [0.72, -0.95], [0.92, -0.45], [0.95, 0.0], [0.78, 0.45], [0.5, 0.78], [0.38, 0.98], [0.44, 1.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const fasce = [prof.slice(0, 4), prof.slice(3, 6), prof.slice(5)];
  const cocci = [];
  fasce.forEach((band, b) => {
    const N = 5, off = b * 0.6;
    for (let k = 0; k < N; k++) {
      const g = new THREE.LatheGeometry(band, 10, off + (k / N) * Math.PI * 2, (Math.PI * 2) / N);
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(new THREE.Vector3());
      g.translate(-c.x, -c.y, -c.z);
      const m = new THREE.Mesh(g, porcMat);
      m.userData = {
        home: c.clone(),
        off: new THREE.Vector3().randomDirection().multiplyScalar(rnd(2.2, 3.8)),
        rot: new THREE.Euler(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2)),
      };
      m.scale.setScalar(0.955); // ogni coccio un po' più piccolo: nelle fessure si vede l'oro
      cocci.push(m);
      vaso.add(m);
    }
  });
  const anima = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), oroMat);
  anima.scale.setScalar(0.985);
  vaso.add(anima);

  scene.add(PORCELLANA ? vaso : cigni);

  /* ------------------------------------------------------------------ */
  // dall'11/11 la comparsa è più lunga (6 unità invece di 4, con la curva morbida) e in più si addolcisce nel tempo:
  // anche se lo scroll corre, ogni mondo entra in dissolvenza in poco più di un secondo, senza scatti
  const vis = (cz, a, b) => Math.min(ease(seg(cz, a + 1, a - 5)), 1 - seg(cz, b + 3, b - 1));
  const vMorb = [0, 0, 0];
  const morbido = (i, target, dt) => (vMorb[i] += (target - vMorb[i]) * (1 - Math.exp(-dt * 2.4)));

  return function update({ dt, t, cz, p, camera, bg, dustMat, ringLight }) {
    // il mondo in cui sei: quanti cerchi hai attraversato
    const k = ringZ.filter((z) => cz < z).length;
    const m = 1 - Math.exp(-dt * 1.6);
    skyUni.uTop.value.lerp(AMB[k].top, m);
    skyUni.uMid.value.lerp(AMB[k].mid, m);
    skyUni.uBot.value.lerp(AMB[k].bot, m);
    bg.copy(skyUni.uMid.value);
    dustMat.color.lerp(AMB[k].dust, m);
    ringLight.color.lerp(AMB[k].light, m);
    sky.position.copy(camera.position);

    // fogli
    const v1 = morbido(0, vis(cz, z1, z2), dt);
    fogli.visible = v1 > 0.002;
    cartaMats.forEach((mt) => opaco(mt, v1));
    if (fogli.visible) {
      fogli.rotation.z += dt * 0.12;
      fogli.children.forEach((f) => {
        const u = f.userData;
        f.rotation.x = u.ph + t * u.flip;              // si voltano piano, come sfogliati
        f.rotation.y = Math.sin(t * 0.4 + u.ph) * 0.7;
        f.position.y = u.y0 + Math.sin(t * 0.6 + u.ph) * 0.15;
      });
    }

    // fili: crescono davanti a te mentre avanzi
    const v2 = morbido(1, vis(cz, z2, z3), dt);
    fili.visible = v2 > 0.002;
    filiMats.forEach((mt) => opaco(mt, v2));
    if (fili.visible) {
      // ogni coppia cresce mentre ti avvicini e si annoda largo; negli ultimi passi il nodo si stringe; poi ondeggia appena
      coppie.forEach((g) => {
        const u = g.userData;
        const f = ease(seg(cz, u.zK + 12, u.zK + 5.5));
        u.uStretto.value = 1 - (1 - STRETTO) * ease(seg(cz, u.zK + 5.5, u.zK + 2));
        const n = Math.floor(f * TSEG) * TRAD * 6;
        u.geos.forEach((geo) => geo.setDrawRange(0, n));
        g.rotation.y = Math.sin(t * 0.3 + u.ph) * 0.3 * f;
        g.rotation.x = Math.sin(t * 0.23 + u.ph) * 0.15 * f;
      });
    }

    // dopo Costruisci, fino all'arrivo delle foto
    const v3 = morbido(2, Math.min(ease(seg(cz, z3 + 1, z3 - 5)), 1 - seg(p, 0.44, 0.48)), dt);
    if (PORCELLANA) {
      vaso.visible = v3 > 0.002;
      opaco(porcMat, v3);
      if (vaso.visible) {
        const a = ease(seg(cz, z3, z3 - 6.5));       // i cocci si avvicinano e si ricompongono
        opaco(oroMat, v3 * seg(a, 0.75, 1));
        vaso.rotation.y += dt * 0.15;
        cocci.forEach((c) => {
          const u = c.userData;
          c.position.copy(u.home).addScaledVector(u.off, 1 - a);
          c.rotation.set(u.rot.x * (1 - a), u.rot.y * (1 - a), u.rot.z * (1 - a));
        });
      }
    } else {
      cigni.visible = v3 > 0.002;
      opaco(origamiMat, v3);
      if (cigni.visible) {
        cigni.children.forEach((c) => {
          const u = c.userData;
          const a = u.a0 + t * 0.09;                   // planano in cerchio attorno a te, sempre dritti
          c.position.set(Math.cos(a) * u.rx, Math.sin(a) * u.ry + Math.sin(t * 0.7 + u.ph) * 0.12, u.z);
          const dx = -Math.sin(a), dy = Math.cos(a);
          c.rotation.set(0, dx > 0 ? 0 : Math.PI, Math.atan2(dy, Math.abs(dx)) * 0.35);
        });
      }
    }
  };
}
