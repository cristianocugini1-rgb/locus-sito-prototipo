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
const contati = new Set();
export function segnala(pagina, evento) {
  if (import.meta.env.DEV || contati.has(pagina + evento)) return; // in locale non si conta niente
  contati.add(pagina + evento);
  inserisci('visite', { pagina, evento, telefono: matchMedia('(hover: none)').matches }).catch(() => {});
}

export const indirizzoCopertina = (nome) => (nome ? `${SUPABASE_URL}/storage/v1/object/public/copertine/${encodeURIComponent(nome)}` : '');
