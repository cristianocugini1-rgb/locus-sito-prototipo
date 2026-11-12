// Dal 12/11/2026: legge la didascalia di un post di Instagram e, se annuncia un appuntamento, ne tira fuori
// data, ora, titolo e testo per "Cosa arriva". Vale solo una data uguale o successiva al giorno del post
// (così "grazie a chi c'era sabato 7 novembre" non diventa un appuntamento) ed entro un anno.
// Se la lettura sbaglia, si corregge o si nasconde dal gestionale, scheda Eventi: la correzione resta.

const MESI = {
  gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6,
  luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, sett: 9, set: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12,
};
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const NOMI_MESI = Object.keys(MESI).sort((a, b) => b.length - a.length).join('|');
// "7 novembre", "7, 8 e 9 maggio 2027", "dal 3 al 5 dic": vale il primo giorno
const RE_ESTESA = new RegExp(`(?<![\\d])(\\d{1,2})(?:°|º)?(?:\\s*(?:,|-|e|ed|al)\\s*\\d{1,2})*\\s+(${NOMI_MESI})\\.?(?![a-zà-ù])(?:\\s+(\\d{4}))?`, 'gi');
const RE_NUMERI = /(?<![\d.:/])(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?(?![\d:])/g;
const RE_ORA = /\b(ore|alle|dalle|h)\s*(\d{1,2})(?:[.:](\d{2}))?(?!\d)/i;
const PRIMA_ORA = /(?:ore|alle|dalle|h)\s*$/i;
const PITTOGRAMMI = /[\p{Extended_Pictographic}️‍]/gu;

const iso = (d) => d.toISOString().slice(0, 10);

function candidate(testo, base) {
  const trovate = [];
  const prova = (g, m, a, indice) => {
    if (m < 1 || m > 12 || g < 1 || g > 31) return;
    if (PRIMA_ORA.test(testo.slice(Math.max(0, indice - 8), indice))) return; // "ore 14.30" non è una data
    let anno = a ? (a < 100 ? 2000 + a : a) : base.getUTCFullYear();
    let d = new Date(Date.UTC(anno, m - 1, g));
    if (d.getUTCDate() !== g) return; // 31 novembre e simili
    // senza anno e già passata: se è passata da poco è un ricordo ("grazie a chi c'era"), non un appuntamento;
    // se è passata da molto è l'anno dopo (a dicembre, "il 9 gennaio")
    if (!a && d < base) {
      if (base - d < 90 * 864e5) return;
      d = new Date(Date.UTC(++anno, m - 1, g));
    }
    if (d < base || d - base > 365 * 864e5) return;
    trovate.push({ d, indice });
  };
  for (const x of testo.matchAll(RE_ESTESA)) prova(+x[1], MESI[x[2].toLowerCase()], x[3] && +x[3], x.index);
  for (const x of testo.matchAll(RE_NUMERI)) prova(+x[1], +x[2], x[3] && +x[3], x.index);
  return trovate.sort((x, y) => x.d - y.d);
}

const pulisci = (r) => r.replace(PITTOGRAMMI, '').replace(/#[\p{L}\d_]+/gu, '').replace(/\s+/g, ' ').trim();
function taglia(t, max) {
  if (t.length <= max) return t;
  const frase = t.slice(0, max).match(/^(.*[.!?])\s/s);
  return frase && frase[1].length > max / 2 ? frase[1] : t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

export function trovaEvento(didascalia, pubblicato) {
  if (!didascalia) return null;
  const p = new Date(pubblicato || Date.now());
  const base = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()));
  const testo = didascalia.normalize('NFC');
  const [prima] = candidate(testo, base);
  if (!prima) return null;
  const ora = testo.match(RE_ORA);
  const orario = ora ? `${ora[1].toLowerCase() === 'dalle' ? 'dalle' : 'ore'} ${ora[2]}.${ora[3] || '00'}` : '';
  const righe = testo.split('\n').map(pulisci).filter((r) => r.replace(/[^\p{L}\d]/gu, '').length > 2);
  if (!righe.length) return null;
  return {
    data: iso(prima.d),
    quando: [GIORNI[prima.d.getUTCDay()], orario].filter(Boolean).join(', '),
    titolo: taglia(righe[0].replace(/[\s:.,;!-]+$/, ''), 90),
    testo: righe.length > 1 ? taglia(righe.slice(1).join(' '), 240) : '',
  };
}
