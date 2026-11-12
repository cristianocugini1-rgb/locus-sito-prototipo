// Collegamento leggero all'archivio di Locus su Supabase (progetto "locus", Francoforte), senza librerie:
// le pagine pubbliche leggono gli articoli, mandano le richieste di tessera e segnano i passaggi.
// La chiave è quella pubblicabile: può stare nel sito, perché le regole dell'archivio decidono chi vede cosa.
export const SUPABASE_URL = 'https://qjgqogsoehaxvdqljekc.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_TboScWJGT1DLjhExCYFHIg_LPoMvUWN';

const intestazioni = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

export async function leggi(percorso) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${percorso}`, { headers: intestazioni });
  if (!r.ok) throw new Error(`lettura non riuscita (${r.status})`);
  return r.json();
}

export async function inserisci(tabella, riga) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabella}`, {
    method: 'POST', headers: { ...intestazioni, Prefer: 'return=minimal' }, body: JSON.stringify(riga), keepalive: true,
  });
  if (!r.ok) throw new Error(`invio non riuscito (${r.status})`);
}

// statistiche senza cookie: si conta solo il passaggio (quale pagina, quale passo, telefono o computer),
// nessun identificativo, nessun indirizzo. Ogni passo si conta una volta per visita.
// Dal 12/11: "dettaglio" dice quale articolo o quale risoluzione; all'inizio di ogni visita parte anche un
// "ingresso", una volta sola per scheda (lo ricorda sessionStorage, che resta nel browser e si cancella chiudendo
// la scheda), con la provenienza: solo il nome del sito da cui si arriva, oppure il codice ?da= dei link e dei QR.
const contati = new Set();
const invia = (riga) => inserisci('visite', riga).catch(() => {});
const SITI = [[/instagram/, 'instagram'], [/facebook|fb\.com/, 'facebook'], [/google\./, 'google'], [/bing\.|duckduckgo|ecosia|yahoo/, 'altri motori'],
  [/whatsapp|wa\.me/, 'whatsapp'], [/linkedin|lnkd/, 'linkedin'], [/tiktok/, 'tiktok'], [/^t\.co$|twitter|x\.com/, 'x'], [/telegram|t\.me/, 'telegram']];
function provenienza() {
  const da = new URLSearchParams(location.search).get('da');
  if (da) return 'da:' + da.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50);
  let sito = '';
  try { sito = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch (_) { /* nessuna provenienza */ }
  if (!sito) return 'diretto';
  if (sito === location.hostname) return 'interno';
  return (SITI.find(([re]) => re.test(sito)) || [null, sito.slice(0, 60)])[1];
}
export function segnala(pagina, evento, dettaglio = null) {
  const chiave = `${pagina}|${evento}|${dettaglio || ''}`;
  if (import.meta.env.DEV || contati.has(chiave)) return; // in locale non si conta niente
  contati.add(chiave);
  const telefono = matchMedia('(hover: none)').matches;
  invia({ pagina, evento, telefono, dettaglio: dettaglio ? String(dettaglio).slice(0, 120) : null });
  if (evento !== 'arrivo') return;
  let nuova = true;
  try { nuova = !sessionStorage.getItem('locus-visita'); sessionStorage.setItem('locus-visita', '1'); } catch (_) { /* conta comunque */ }
  if (nuova) invia({ pagina, evento: 'ingresso', telefono, provenienza: provenienza() });
}

// "Cosa arriva": appuntamenti scritti nel gestionale più quelli letti dai post di Instagram (public/eventi-instagram.json,
// rifatto a ogni pubblicazione). Una riga dell'archivio con lo stesso ig_id corregge o nasconde quella letta da Instagram.
export async function appuntamenti() {
  const [db, ig] = await Promise.all([
    leggi('eventi?select=*'),
    fetch(`${import.meta.env.BASE_URL}eventi-instagram.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : { eventi: [] })).catch(() => ({ eventi: [] })),
  ]);
  const corretti = new Set(db.filter((e) => e.ig_id).map((e) => e.ig_id));
  return [...db, ...(ig.eventi || []).filter((e) => !corretti.has(e.ig_id)).map((e) => ({ ...e, origine: 'instagram', stato: 'visibile', letto: true }))];
}

// le copertine caricate dal gestionale stanno nell'archivio; quelle che iniziano con img/ sono foto del sito (articoli di prova)
export const indirizzoCopertina = (nome) => (!nome ? '' : nome.startsWith('img/') ? import.meta.env.BASE_URL + nome
  : `${SUPABASE_URL}/storage/v1/object/public/copertine/${encodeURIComponent(nome)}`);
