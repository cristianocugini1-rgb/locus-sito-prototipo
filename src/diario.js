// La pagina Diario: gli articoli pubblicati dal gestionale come un libro da sfogliare.
// Il libro parte chiuso; ogni articolo è una doppia pagina (a sinistra numero e sommario, a destra foto e titolo).
// Si sfoglia trascinando il segno del sommario, trascinando il libro, con la rotella o con le frecce.
// Toccando un articolo si apre la pagina di lettura su carta; l'indirizzo diventa diario.html?a=indirizzo.
// Il foglio j ha davanti la pagina destra dell'elemento j e dietro la pagina sinistra dell'elemento j+1.
// ?modo=rigida mostra le pagine che girano senza curvarsi.
import { leggi, segnala, indirizzoCopertina } from './dati.js';
import { inHtml, esc, dataItaliana } from './testo.js';

segnala('diario', 'arrivo');

// le immagini scritte nel codice: con la base del sito, se no su GitHub Pages non si trovano
const BASE = import.meta.env.BASE_URL;
const due = (n) => String(n).padStart(2, '0');
const minuti = (testo) => Math.max(1, Math.round(String(testo || '').split(/\s+/).filter(Boolean).length / 200));

const $ = (s) => document.querySelector(s);
const libro = $('#libro');
const palco = $('#palco');
const telefono = matchMedia('(max-width: 760px)');
const params = new URLSearchParams(location.search);
const modo = params.get('modo') === 'rigida' ? 'rigida' : 'curva';
const K = 14; // strisce della pagina che si curva

let articoli = [];
let elementi = [];
let N = 0;

function sinistra(e) {
  if (e.tipo === 'chiuso') return '';
  if (e.tipo === 'copertina') return `<div class="pg sx"></div>`; // il risguardo: carta bianca
  if (e.tipo === 'fine') {
    return articoli.length
      ? `<div class="pg sx"><span class="grande">${due(articoli.length)}</span><p class="somm">${articoli.length === 1 ? 'articolo' : 'articoli'} in questo diario, per ora.</p><p class="leggi">Diario di Locus · Parma</p></div>`
      : `<div class="pg sx"></div>`;
  }
  return `<div class="pg sx"><span class="grande">${due(e.n)}</span><p class="somm">${esc(e.sommario || '')}</p><p class="leggi">Leggi l'articolo &rarr;</p><div class="piede"><span>${e.min} ${e.min === 1 ? 'minuto' : 'minuti'} di lettura</span><span>${esc(e.data)}</span></div></div>`;
}
function destra(e) {
  if (e.tipo === 'chiuso') return '';
  if (e.tipo === 'copertina') return `<div class="pg dx copertina"><p class="meta" style="margin:0">Locus · Parma</p><span class="grande">Diario.</span><p class="somm">Quello che vediamo, quello che incontriamo, quello che costruiamo.</p><div class="piede"><span>dal 2026</span><span>${articoli.length ? 'sfoglia &rarr;' : ''}</span></div></div>`;
  if (e.tipo === 'fine') return `<div class="pg dx fine"><h2>Il prossimo capitolo è in scrittura.</h2><p class="somm" style="margin-top:8%">Hai un'idea per un articolo? Scrivici a locus.parma@gmail.com.</p></div>`;
  const foto = e.copertina
    ? `<figure><img src="${indirizzoCopertina(e.copertina)}" alt="" draggable="false" /></figure>`
    : `<figure class="senza"><img src="${BASE}img/logo-L-bianco.png" alt="" draggable="false" /></figure>`;
  return `<div class="pg dx">${foto}<p class="meta">${esc(e.data)}</p><h2>${esc(e.titolo)}</h2><div class="piede"><span>N° ${due(e.n)}</span><span class="apri">Apri l'articolo &rarr;</span></div></div>`;
}

/* ---------------- misure ---------------- */
let W = 300;
function misura() {
  const r = palco.getBoundingClientRect();
  const H = Math.min(r.height - 40, 900);
  // pixel interi: con misure a metà pixel il browser ricampiona e le scritte si sfocano
  W = Math.round(telefono.matches ? Math.min(r.width * 0.86, (r.height - 10) * 0.72) : Math.min(H * 0.72, (r.width - 20) / 2));
  libro.style.setProperty('--W', `${W}px`);
  libro.style.setProperty('--H', `${Math.round(W / 0.72)}px`);
}

/* ---------------- costruzione ---------------- */
let fogli = [];
function costruisci() {
  libro.innerHTML = `<div class="rilegatura"></div><div class="pila sx"></div><div class="pila dx"></div><div class="base dx">${destra(elementi[N - 1])}</div>`;
  fogli = [];
  for (let j = 0; j < N - 1; j++) {
    const f = document.createElement('div');
    f.className = 'foglio';
    const fronte = destra(elementi[j]);
    const retro = sinistra(elementi[j + 1]);
    if (j === 0) {
      // la copertina: un piatto rigido, anche quando le pagine si curvano
      f.classList.add('piatto-copertina');
      f.innerHTML = `<div class="faccia fronte"><div class="tavola"><img src="${BASE}img/logo-locus-bianco.png" alt="locus" /></div><i class="ombra"></i></div>`
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
}

/* ---------------- sommario ---------------- */
const voci = $('#voci');
const segno = $('#segno');
let li = [];
let centri = [];
function scriviSommario() {
  voci.innerHTML = elementi.map((e, i) => `<li data-i="${i}"><span class="num">${e.tipo === 'articolo' ? due(e.n) : e.tipo === 'fine' ? '∞' : '·'}</span><span class="tit">${esc(e.voce)}</span></li>`).join('');
  li = [...voci.children];
}
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
  if (!N) return;
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
  if (centri.length) {
    segno.style[telefono.matches ? 'left' : 'top'] = `${aPosizione(cur) - 7.5}px`;
    segno.style[telefono.matches ? 'top' : 'left'] = '';
  }
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
  if (!N) return;
  meta = Math.max(0, Math.min(N - 1, p));
  if (!gira) { gira = true; requestAnimationFrame(ciclo); }
}

/* ---------------- comandi ---------------- */
const sommario = $('#sommario');
sommario.addEventListener('pointerdown', (e) => {
  if (!N) return;
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
  if (!N) return;
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
  if (e0.tipo === 'articolo' && (aDestra || suLeggi)) return apri(e0, true);
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
  if (e.key === 'Escape') return chiudi(true);
  if (document.body.classList.contains('legge')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') vai(Math.round(meta) + 1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') vai(Math.round(meta) - 1);
});

/* ---------------- la pagina di lettura ---------------- */
const lettura = $('#lettura');
function apri(a, cronologia) {
  $('#l-meta').textContent = `${a.data} · ${a.min} ${a.min === 1 ? 'minuto' : 'minuti'} di lettura`;
  $('#l-tit').textContent = a.titolo;
  $('#l-somm').textContent = a.sommario || '';
  $('#l-somm').hidden = !a.sommario;
  $('#l-cop').hidden = !a.copertina;
  if (a.copertina) $('#l-foto').src = indirizzoCopertina(a.copertina);
  $('#l-num').textContent = `N° ${due(a.n)}`;
  $('#l-corpo').innerHTML = a.testo ? inHtml(a.testo) : '';
  document.title = `${a.titolo} · Locus`;
  lettura.scrollTop = 0;
  document.body.classList.add('legge');
  lettura.setAttribute('aria-hidden', 'false');
  // l'indirizzo dell'articolo, da condividere; il tasto indietro del telefono richiude
  if (cronologia) history.pushState({ a: a.slug }, '', `?a=${encodeURIComponent(a.slug)}`);
  segnala('articolo', 'arrivo');
}
function chiudi(cronologia) {
  if (!document.body.classList.contains('legge')) return;
  document.body.classList.remove('legge');
  lettura.setAttribute('aria-hidden', 'true');
  document.title = 'Locus · Diario';
  if (cronologia) {
    if (history.state?.a) history.back();
    else history.replaceState(null, '', location.pathname);
  }
}
document.querySelectorAll('.l-torna, .l-fine').forEach((b) => b.addEventListener('click', () => chiudi(true)));
addEventListener('popstate', () => {
  const slug = new URLSearchParams(location.search).get('a');
  const a = slug && elementi.find((e) => e.slug === slug);
  if (a) apri(a, false); else chiudi(false);
});
lettura.addEventListener('scroll', () => {
  const max = lettura.scrollHeight - lettura.clientHeight;
  $('#l-barra').style.transform = `scaleX(${max > 0 ? lettura.scrollTop / max : 0})`;
});

addEventListener('resize', () => { misura(); misuraVoci(); disegna(true); });
telefono.addEventListener('change', () => { misura(); misuraVoci(); disegna(true); });

/* ---------------- avvio ---------------- */
function prepara() {
  elementi = [
    { tipo: 'chiuso', voce: 'Copertina' },
    { tipo: 'copertina', voce: 'Il diario' },
    ...articoli.map((a, i) => ({ tipo: 'articolo', voce: a.titolo, n: i + 1, data: dataItaliana(a.pubblicato_il), min: minuti(a.testo), ...a })),
    { tipo: 'fine', voce: 'Il prossimo capitolo' },
  ];
  N = elementi.length;
  scriviSommario();
  misura();
  costruisci();
  misuraVoci();
  // arrivati da un link a un articolo: libro aperto su quella pagina e articolo già aperto
  const slug = params.get('a');
  const a = slug && elementi.find((e) => e.slug === slug);
  if (a) { cur = meta = elementi.indexOf(a); apri(a, false); }
  else if (params.has('p')) cur = meta = Math.max(0, Math.min(N - 1, parseFloat(params.get('p')) || 0)); // ?p=2 per le prove
  disegna(true);
  document.fonts.ready.then(() => { misuraVoci(); disegna(true); });
}

// in ordine di uscita: il primo articolo pubblicato è il numero 01
leggi('articoli?select=titolo,slug,sommario,testo,copertina,pubblicato_il&stato=eq.pubblicato&order=pubblicato_il.asc')
  .then((righe) => { articoli = righe; prepara(); })
  .catch(() => { articoli = []; prepara(); $('#didascalia').textContent = 'Il diario non si carica in questo momento. Riprova tra poco.'; });
