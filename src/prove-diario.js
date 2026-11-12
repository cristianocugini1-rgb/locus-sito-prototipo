// Prova del diario da sfogliare: ogni articolo è una doppia pagina (a sinistra numero e sommario,
// a destra foto e titolo). Si sfoglia trascinando il segno del sommario, trascinando il libro,
// con la rotella o con le frecce. Due versioni della pagina che gira: rigida e che si curva.
// Il foglio j ha davanti la pagina destra dell'elemento j e dietro la pagina sinistra dell'elemento j+1.

const articoli = [
  { tit: 'Il primo sabato del mese', rub: 'Incontra', data: '8 novembre 2026', foto: 'meetup.jpg', min: 4,
    somm: 'Com\'è nato il Meet Up, chi ci viene e perché una stanza piena di sconosciuti, una volta al mese, è diventata il cuore di Locus.' },
  { tit: 'Quanto costa avere 25 anni a Parma', rub: 'Conosci', data: '1 novembre 2026', foto: 'carosello-costo.jpg', min: 7,
    somm: 'Affitto, trasporti, una cena fuori: abbiamo messo in fila le spese di un mese e le abbiamo confrontate con gli stipendi d\'ingresso.' },
  { tit: 'La notte non è un problema di ordine pubblico', rub: 'Conosci', data: '24 ottobre 2026', foto: 'carosello-movida.jpg', min: 6,
    somm: 'Le piazze piene il venerdì sera raccontano un bisogno, non solo un disturbo. Cosa chiedono i ragazzi e cosa risponde la città.' },
  { tit: 'Cosa abbiamo imparato dal primo giovedì', rub: 'Incontra', data: '17 ottobre 2026', foto: 'primo-giovedi.jpg', min: 5,
    somm: 'Una serata di prova, quaranta persone, tre domande sul tavolo. Il resoconto di come è andata e di cosa cambieremo.' },
  { tit: 'Il lavoro che non trovi negli annunci', rub: 'Conosci', data: '10 ottobre 2026', foto: 'carosello-lavoro.jpg', min: 8,
    somm: 'Gran parte delle assunzioni passa da conoscenze e passaparola. Come si entra in un giro che nessuno ti spiega.' },
  { tit: 'Una sede, mattone dopo mattone', rub: 'Costruisci', data: '3 ottobre 2026', foto: 'strada-parma.jpg', min: 5,
    somm: 'Cerchiamo uno spazio dove ritrovarci. Cosa ci serve, cosa possiamo offrire al quartiere e come potete aiutarci.' },
];

const due = (n) => String(n).padStart(2, '0');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// gli elementi del libro: copertina, articoli, ultima pagina
const elementi = [
  { tipo: 'chiuso', voce: 'Copertina' },
  { tipo: 'copertina', voce: 'Il diario' },
  ...articoli.map((a, i) => ({ tipo: 'articolo', voce: a.tit, n: i + 1, ...a })),
  { tipo: 'fine', voce: 'Il prossimo capitolo' },
];
const N = elementi.length;

function sinistra(e) {
  if (e.tipo === 'chiuso') return '';
  if (e.tipo === 'copertina') return `<div class="pg sx"></div>`; // il risguardo: carta bianca
  if (e.tipo === 'fine') return `<div class="pg sx"><span class="grande">${due(articoli.length)}</span><p class="somm">articoli in questo diario. Ne scriviamo uno nuovo ogni settimana.</p><p class="leggi">Diario di Locus · Parma</p></div>`;
  return `<div class="pg sx"><span class="grande">${due(e.n)}</span><p class="somm">${esc(e.somm)}</p><p class="leggi">Leggi l'articolo &rarr;</p><div class="piede"><span>${e.min} minuti di lettura</span><span>${esc(e.rub)}</span></div></div>`;
}
function destra(e) {
  if (e.tipo === 'chiuso') return '';
  if (e.tipo === 'copertina') return `<div class="pg dx copertina"><p class="meta" style="margin:0">Locus · Parma</p><span class="grande">Diario.</span><p class="somm">Quello che vediamo, quello che incontriamo, quello che costruiamo.</p><div class="piede"><span>dal 2026</span><span>sfoglia &rarr;</span></div></div>`;
  if (e.tipo === 'fine') return `<div class="pg dx fine"><h2>Il prossimo capitolo è in scrittura.</h2><p class="somm" style="margin-top:8%">Hai un'idea per un articolo? Scrivici a locus.parma@gmail.com.</p></div>`;
  return `<div class="pg dx"><figure><img src="/img/${e.foto}" alt="" draggable="false" /></figure><p class="meta">${esc(e.data)} · ${esc(e.rub)}</p><h2>${esc(e.tit)}</h2><div class="piede"><span>N° ${due(e.n)}</span><span class="apri">Apri l'articolo &rarr;</span></div></div>`;
}

const $ = (s) => document.querySelector(s);
const libro = $('#libro');
const palco = $('#palco');
const telefono = matchMedia('(max-width: 760px)');
const params = new URLSearchParams(location.search);
let modo = params.get('modo') === 'curva' ? 'curva' : 'rigida';
const K = 14; // strisce della pagina che si curva

/* ---------------- misure ---------------- */
let W = 300;
function misura() {
  const r = palco.getBoundingClientRect();
  const H = Math.min(r.height - 40, 900);
  // pixel interi: con misure a metà pixel il browser ricampiona e il logo si sfoca
  W = Math.round(telefono.matches ? Math.min(r.width * 0.86, (r.height - 10) * 0.72) : Math.min(H * 0.72, (r.width - 20) / 2));
  libro.style.setProperty('--W', `${W}px`);
  libro.style.setProperty('--H', `${Math.round(W / 0.72)}px`);
}

/* ---------------- costruzione ---------------- */
let fogli = [];
function costruisci() {
  libro.innerHTML = `<div class="rilegatura"></div><div class="pila sx"></div><div class="pila dx"></div><div class="base sx">${sinistra(elementi[0])}</div><div class="base dx">${destra(elementi[N - 1])}</div>`;
  fogli = [];
  for (let j = 0; j < N - 1; j++) {
    const f = document.createElement('div');
    f.className = 'foglio';
    const fronte = destra(elementi[j]);
    const retro = sinistra(elementi[j + 1]);
    if (j === 0) {
      f.classList.add('piatto-copertina');
      f.innerHTML = `<div class="faccia fronte"><div class="tavola">
<img src="/img/logo-locus-bianco.png" alt="locus" /></div><i class="ombra"></i></div>`
        + `<div class="faccia retro"><div class="risguardo">${retro}</div><i class="ombra"></i></div>`;
      f._strisce = null;
    } else if (modo === 'rigida') {
      f.innerHTML = `<div class="faccia fronte">${fronte}<i class="ombra"></i></div><div class="faccia retro">${retro}<i class="ombra"></i></div>`;
      f._strisce = null;
    } else {
      // strisce annidate: ognuna mostra una fetta della pagina e porta dentro di sé la successiva
      let html = '';
      for (let k = K - 1; k >= 0; k--) {
        html = `<div class="striscia" style="width:calc(var(--W) / ${K} + 1.5px);left:${k === 0 ? '0' : 'calc(var(--W) / ' + K + ')'}">`
          + `<div class="faccia fronte"><div class="taglio" style="left:calc(var(--W) / ${K} * ${-k})">${fronte}</div><i class="ombra"></i></div>`
          + `<div class="faccia retro"><div class="taglio" style="left:calc(var(--W) / ${K} * ${-(K - 1 - k)})">${retro}</div><i class="ombra"></i></div>`
          + html + '</div>';
      }
      // a pagina ferma si mostra il foglio intero: le strisce servono solo mentre gira (niente righe tra una e l'altra)
      f.innerHTML = `<div class="piano"><div class="faccia fronte">${fronte}</div><div class="faccia retro">${retro}</div></div>` + html;
      f._strisce = [...f.querySelectorAll('.striscia')];
    }
    f._ombre = f.querySelectorAll('.ombra');
    f._t = -1;
    libro.appendChild(f);
    fogli.push(f);
  }
  disegna(true);
}

/* ---------------- sommario ---------------- */
const voci = $('#voci');
voci.innerHTML = elementi.map((e, i) => `<li data-i="${i}"><span class="num">${e.tipo === 'articolo' ? due(e.n) : e.tipo === 'fine' ? '∞' : '·'}</span><span class="tit">${esc(e.voce)}</span></li>`).join('');
const li = [...voci.children];
const segno = $('#segno');
let centri = [];
function misuraVoci() {
  const base = $('#sommario').getBoundingClientRect();
  centri = li.map((x) => {
    const r = x.getBoundingClientRect();
    return telefono.matches ? r.left + r.width / 2 - base.left : r.top + r.height / 2 - base.top;
  });
}
// da posizione del puntatore a numero di pagina (anche a metà tra due voci)
function daPuntatore(v) {
  if (v <= centri[0]) return 0;
  for (let i = 0; i < N - 1; i++) if (v <= centri[i + 1]) return i + (v - centri[i]) / (centri[i + 1] - centri[i]);
  return N - 1;
}
function aPosizione(p) {
  const i = Math.min(Math.floor(p), N - 2);
  return centri[i] + (centri[i + 1] - centri[i]) * (p - i);
}

/* ---------------- disegno ---------------- */
let cur = 0, meta = 0, ultimo = -1;
function disegna(forza) {
  for (let j = 0; j < fogli.length; j++) {
    const f = fogli[j];
    const t = Math.max(0, Math.min(1, cur - j));
    if (!forza && t === f._t) continue;
    f._t = t;
    f.style.zIndex = t <= 0 ? 100 - j : t >= 1 ? j + 1 : 300;
    f.style.visibility = telefono.matches && t >= 1 && cur - j > 1.2 ? 'hidden' : '';
    const A = 180 * t;
    if (!f._strisce) {
      // fermo e chiuso: niente trasformazione 3D, così il foglio resta nitido
      f.style.transform = t <= 0 ? 'none' : `rotateY(${-A}deg)`;
      const o = 0.28 * Math.sin(Math.PI * t);
      f._ombre[0].style.opacity = o; f._ombre[1].style.opacity = o;
    } else {
      const piatto = t <= 0 || t >= 1;
      f.classList.toggle('piatto', piatto);
      f.style.transform = !piatto ? '' : t <= 0 ? 'none' : `rotateY(${-A}deg)`;
      if (piatto) continue;
      // la curva: il bordo libero anticipa la piega, al massimo a metà giro
      const b = 75 * Math.sin(Math.PI * t);
      let prima = 0;
      for (let k = 0; k < K; k++) {
        const u = k / (K - 1);
        const phi = Math.max(0, Math.min(180, A - b * 0.45 + b * u));
        f._strisce[k].style.transform = `rotateY(${-(phi - prima)}deg)`;
        prima = phi;
        const o = 0.32 * Math.sin((phi * Math.PI) / 180);
        f._ombre[2 * k].style.opacity = o; f._ombre[2 * k + 1].style.opacity = o;
      }
    }
  }
  // lo spessore delle pagine: cresce a sinistra e cala a destra mentre si sfoglia
  libro.style.setProperty('--psx', `${Math.max(0, cur - 1) * 2.4}px`);
  libro.style.setProperty('--pdx', `${2 + (N - 1 - Math.max(cur, 1)) * 2.4}px`);
  // chiuso, il libro sta al centro; aprendosi si sposta per far posto alla pagina di sinistra
  libro.style.setProperty('--sposta', `${Math.round(-(1 - Math.min(1, cur)) * W * 0.5)}px`);
  segno.style[telefono.matches ? 'left' : 'top'] = `${aPosizione(cur) - 7.5}px`;
  segno.style[telefono.matches ? 'top' : 'left'] = '';
  const vicino = Math.round(cur);
  if (vicino !== ultimo) {
    ultimo = vicino;
    li.forEach((x, i) => x.classList.toggle('su', i === vicino));
    const tipo = elementi[vicino].tipo;
    $('#didascalia').textContent = tipo === 'chiuso' ? 'scorri o tocca la copertina per aprire il diario' : tipo === 'articolo' ? 'tocca la pagina di destra per aprire l\'articolo' : '';
  }
}

let trascina = null; // 'sommario' | 'libro'
let gira = false;
function ciclo() {
  const k = trascina ? 0.3 : 0.11;
  cur += (meta - cur) * k;
  if (Math.abs(meta - cur) < 0.0008) cur = meta;
  disegna(false);
  if (cur !== meta || trascina) requestAnimationFrame(ciclo);
  else gira = false;
}
function vai(p) {
  meta = Math.max(0, Math.min(N - 1, p));
  if (!gira) { gira = true; requestAnimationFrame(ciclo); }
}

/* ---------------- comandi ---------------- */
const sommario = $('#sommario');
sommario.addEventListener('pointerdown', (e) => {
  trascina = 'sommario';
  sommario.classList.add('preso');
  sommario.setPointerCapture(e.pointerId);
  misuraVoci();
  const base = sommario.getBoundingClientRect();
  vai(daPuntatore(telefono.matches ? e.clientX - base.left : e.clientY - base.top));
});
sommario.addEventListener('pointermove', (e) => {
  if (trascina !== 'sommario') return;
  const base = sommario.getBoundingClientRect();
  meta = daPuntatore(telefono.matches ? e.clientX - base.left : e.clientY - base.top);
});
const lascia = () => {
  if (!trascina) return;
  sommario.classList.remove('preso'); libro.classList.remove('preso');
  trascina = null;
  vai(Math.round(meta));
};
sommario.addEventListener('pointerup', lascia);
sommario.addEventListener('pointercancel', lascia);

// trascinare il libro: verso sinistra si va avanti
let x0 = 0, p0 = 0, mosso = 0, vx = 0, ux = 0;
libro.addEventListener('pointerdown', (e) => {
  trascina = 'libro'; libro.classList.add('preso');
  libro.setPointerCapture(e.pointerId);
  x0 = ux = e.clientX; p0 = meta; mosso = 0; vx = 0;
  vai(meta);
});
libro.addEventListener('pointermove', (e) => {
  if (trascina !== 'libro') return;
  mosso = Math.max(mosso, Math.abs(e.clientX - x0));
  vx = e.clientX - ux; ux = e.clientX;
  meta = Math.max(0, Math.min(N - 1, p0 - (e.clientX - x0) / (W * 1.1)));
});
libro.addEventListener('pointerup', (e) => {
  if (trascina !== 'libro') return;
  libro.classList.remove('preso');
  trascina = null;
  if (mosso < 6) return tocco(e);
  // un colpo deciso finisce di girare la pagina anche se non è arrivata a metà
  const dove = Math.abs(vx) > 4 ? (vx < 0 ? Math.ceil(meta) : Math.floor(meta)) : Math.round(meta);
  vai(dove);
});
libro.addEventListener('pointercancel', lascia);

function tocco(e) {
  const r = libro.getBoundingClientRect();
  const aDestra = e.clientX > r.left + r.width / 2;
  const e0 = elementi[Math.round(meta)];
  const suLeggi = document.elementFromPoint(e.clientX, e.clientY)?.closest('.leggi');
  if (e0.tipo === 'articolo' && (aDestra || suLeggi)) return apri(e0);
  vai(Math.round(meta) + (aDestra ? 1 : -1));
}

let somma = 0, fermo;
addEventListener('wheel', (e) => {
  if (document.body.classList.contains('legge')) return;
  e.preventDefault();
  somma += e.deltaY;
  vai(meta + e.deltaY / 500);
  clearTimeout(fermo);
  fermo = setTimeout(() => { vai(somma > 0 ? Math.ceil(meta - 0.15) : Math.floor(meta + 0.15)); somma = 0; }, 160);
}, { passive: false });
addEventListener('keydown', (e) => {
  if (document.body.classList.contains('legge')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') vai(Math.round(meta) + 1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') vai(Math.round(meta) - 1);
});

/* ---------------- la pagina di lettura ---------------- */
const lettura = $('#lettura');
function apri(a) {
  $('#l-meta').textContent = `${a.data} · ${a.rub} · ${a.min} minuti di lettura`;
  $('#l-tit').textContent = a.tit;
  $('#l-somm').textContent = a.somm;
  $('#l-foto').src = `/img/${a.foto}`;
  $('#l-num').textContent = `N° ${due(a.n)}`;
  lettura.scrollTop = 0;
  document.body.classList.add('legge');
  lettura.setAttribute('aria-hidden', 'false');
}
function chiudi() {
  document.body.classList.remove('legge');
  lettura.setAttribute('aria-hidden', 'true');
}
document.querySelectorAll('.l-torna, .l-fine').forEach((b) => b.addEventListener('click', chiudi));
addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudi(); });
lettura.addEventListener('scroll', () => {
  const max = lettura.scrollHeight - lettura.clientHeight;
  $('#l-barra').style.transform = `scaleX(${max > 0 ? lettura.scrollTop / max : 0})`;
});

let tt;
function avvisa(testo) {
  const t = $('#toast'); t.textContent = testo; t.classList.add('su');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('su'), 2600);
}

/* ---------------- versioni ---------------- */
const bottoni = document.querySelectorAll('.modi button');
function scegli(m) {
  modo = m;
  bottoni.forEach((b) => b.classList.toggle('su', b.dataset.modo === m));
  const u = new URL(location.href); u.searchParams.set('modo', m); history.replaceState(null, '', u);
  costruisci();
}
bottoni.forEach((b) => b.addEventListener('click', () => scegli(b.dataset.modo)));

addEventListener('resize', () => { misura(); misuraVoci(); disegna(true); });
telefono.addEventListener('change', () => { misura(); misuraVoci(); disegna(true); });

// ?p=2.4 ferma il libro a quel punto (per le prove)
if (params.has('p')) cur = meta = Math.max(0, Math.min(N - 1, parseFloat(params.get('p')) || 0));
misura();
scegli(modo);
document.fonts.ready.then(() => { misuraVoci(); disegna(true); });
misuraVoci();
disegna(true);
// ?leggi=3 apre subito l'articolo 3 (per le prove)
if (params.has('leggi')) { const a = elementi[+params.get('leggi')]; if (a?.tipo === 'articolo') apri(a); }
