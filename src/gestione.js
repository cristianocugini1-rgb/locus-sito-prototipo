// Il gestionale di Locus: si entra con email e password, poi articoli, eventi, richieste e registro delle tessere,
// statistiche e persone. Cosa si vede dipende dal livello: redazione (solo articoli) o completo (tutto).
// Le regole vere stanno nell'archivio (Supabase): anche forzando la pagina, nessuno vede più del suo livello.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, indirizzoCopertina } from './dati.js';
import { inHtml, esc, dataItaliana } from './testo.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s, r = document) => r.querySelector(s);
const vista = $('#vista');
const oggi = () => new Date().toISOString().slice(0, 10);
const annoOra = new Date().getFullYear();
let io = null; // { id, email, nome, livello }

const mostra = (id) => ['accesso', 'nuova', 'app'].forEach((x) => { $('#' + x).hidden = x !== id; });
const scrivi = (el, testo, tipo = '') => { el.textContent = testo; el.className = 'msg ' + tipo; };
const spiegaErrore = (e) => {
  const m = String(e?.message || e || '');
  if (/Invalid login/i.test(m)) return 'Email o password non corrette.';
  if (/Email not confirmed/i.test(m)) return 'Questo account non è ancora confermato.';
  if (/duplicate key.*slug/i.test(m)) return 'Esiste già un articolo con questo indirizzo: cambialo.';
  if (/row-level security|permission/i.test(m)) return 'Il tuo livello non permette questa operazione.';
  if (/fetch|network/i.test(m)) return 'Connessione assente: riprova tra poco.';
  return 'Qualcosa non è andato: ' + m;
};

/* ------------------------------------------------------------------ */
/* accesso                                                             */
/* ------------------------------------------------------------------ */
$('#f-accesso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), msg = $('#msg-accesso');
  scrivi(msg, 'Accesso in corso…');
  const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
  if (error) scrivi(msg, spiegaErrore(error), 'no');
});
$('#dimenticata').addEventListener('click', async () => {
  const email = $('#f-accesso [name=email]').value.trim(), msg = $('#msg-accesso');
  if (!email) return scrivi(msg, 'Scrivi prima la tua email qui sopra.', 'no');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  scrivi(msg, error ? spiegaErrore(error) : 'Se l\'email è registrata, ti arriva un link per scegliere una password nuova.', error ? 'no' : 'ok');
});
$('#f-nuova').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#msg-nuova');
  const { error } = await sb.auth.updateUser({ password: new FormData(e.target).get('password') });
  if (error) return scrivi(msg, spiegaErrore(error), 'no');
  scrivi(msg, 'Password salvata.', 'ok');
  setTimeout(entra, 800);
});
$('#cambia-pw').addEventListener('click', () => mostra('nuova'));
$('#esci').addEventListener('click', async () => { await sb.auth.signOut(); });

let recupero = false;
sb.auth.onAuthStateChange((evento, sessione) => {
  if (evento === 'PASSWORD_RECOVERY') { recupero = true; mostra('nuova'); return; }
  if (recupero) return;
  // fuori dal ciclo dell'evento: chiamare l'archivio da qui dentro può bloccare la sessione
  setTimeout(() => (sessione ? entra() : mostra('accesso')), 0);
});

async function entra() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return mostra('accesso');
  const { data } = await sb.from('persone').select('id,email,nome,livello').eq('id', user.id).maybeSingle();
  io = data || { id: user.id, email: user.email, livello: 'attesa' };
  $('#chi-sono').textContent = `${io.nome || io.email} · ${io.livello}`;
  mostra('app');
  costruisciSchede();
}

/* ------------------------------------------------------------------ */
/* schede                                                              */
/* ------------------------------------------------------------------ */
const SCHEDE = [
  { id: 'articoli', nome: 'Articoli', livelli: ['redazione', 'completo'], apri: () => listaArticoli() },
  { id: 'eventi', nome: 'Eventi', livelli: ['redazione', 'completo'], apri: () => eventi() },
  { id: 'richieste', nome: 'Richieste', livelli: ['completo'], apri: () => richieste() },
  { id: 'tessere', nome: 'Tessere', livelli: ['completo'], apri: () => registro() },
  { id: 'statistiche', nome: 'Statistiche', livelli: ['completo'], apri: () => statistiche() },
  { id: 'persone', nome: 'Persone', livelli: ['completo'], apri: () => persone() },
];
function costruisciSchede() {
  const nav = $('#schede');
  nav.innerHTML = '';
  const mie = SCHEDE.filter((s) => s.livelli.includes(io.livello));
  if (!mie.length) {
    vista.innerHTML = '<h2>In attesa</h2><p>Il tuo account c\'è, ma nessuno del direttivo ti ha ancora dato un livello. Scrivi a chi gestisce il sito.</p>';
    return;
  }
  mie.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = s.nome;
    b.dataset.id = s.id;
    b.onclick = () => { nav.querySelectorAll('button').forEach((x) => x.classList.toggle('su', x === b)); location.hash = s.id; s.apri(); };
    nav.appendChild(b);
  });
  const dalLink = mie.findIndex((s) => s.id === location.hash.slice(1));
  nav.children[Math.max(0, dalLink)].click();
  aggiornaConteggio();
}

/* ------------------------------------------------------------------ */
/* articoli                                                            */
/* ------------------------------------------------------------------ */
async function listaArticoli() {
  vista.innerHTML = '<div class="testa"><h2>Articoli</h2><button class="primo" id="nuovo">Nuovo articolo</button></div><div id="elenco">Carico…</div>';
  $('#nuovo').onclick = () => editor(null);
  const { data, error } = await sb.from('articoli').select('id,titolo,slug,stato,pubblicato_il,aggiornato').order('aggiornato', { ascending: false });
  if (error) return ($('#elenco').textContent = spiegaErrore(error));
  if (!data.length) return ($('#elenco').innerHTML = '<p class="vuoto">Ancora nessun articolo. Quando ne pubblichi uno, compare nella pagina Diario del sito.</p>');
  $('#elenco').innerHTML = `<table><thead><tr><th>Titolo</th><th>Stato</th><th>Pubblicato</th><th>Ultima modifica</th></tr></thead><tbody>${data.map((a) => `
    <tr data-id="${a.id}"><td>${esc(a.titolo)}</td><td><span class="stato ${a.stato}">${a.stato}</span></td>
    <td>${a.pubblicato_il ? dataItaliana(a.pubblicato_il) : ''}</td><td>${dataItaliana(a.aggiornato)}</td></tr>`).join('')}</tbody></table>`;
  $('#elenco').querySelectorAll('tr[data-id]').forEach((tr) => { tr.onclick = () => editor(tr.dataset.id); });
}

const inSlug = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

async function editor(id) {
  let a = { titolo: '', slug: '', sommario: '', testo: '', copertina: null, stato: 'bozza' };
  if (id) {
    const { data, error } = await sb.from('articoli').select('*').eq('id', id).single();
    if (error) return alert(spiegaErrore(error));
    a = data;
  }
  let slugToccato = !!a.slug;
  vista.innerHTML = `
    <div class="testa"><button class="link" id="indietro">&larr; tutti gli articoli</button><span class="stato ${a.stato}" id="st">${a.stato}</span></div>
    <div class="editor">
      <div class="campi">
        <label>Titolo<input id="e-titolo" maxlength="200" value="${esc(a.titolo)}" /></label>
        <label>Indirizzo della pagina<input id="e-slug" maxlength="120" value="${esc(a.slug)}" /></label>
        <p class="aiuto">Solo lettere minuscole, numeri e trattini. Si compila da solo dal titolo.</p>
        <label>Sommario (due righe, compare nell'elenco)<textarea id="e-sommario" maxlength="400" style="min-height:80px">${esc(a.sommario || '')}</textarea></label>
        <label>Copertina<input id="e-cop" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <div id="cop-box">${a.copertina ? `<img class="cop-prova" src="${indirizzoCopertina(a.copertina)}" alt="" /><button class="link" id="via-cop">togli la copertina</button>` : ''}</div>
        <label>Testo</label>
        <div class="attrezzi">
          <button data-m="## " data-riga>Titoletto</button><button data-m="**">Grassetto</button><button data-m="*">Corsivo</button>
          <button data-m="- " data-riga>Elenco</button><button data-m="> " data-riga>Citazione</button><button data-link>Link</button>
        </div>
        <textarea id="e-testo">${esc(a.testo)}</textarea>
        <p class="aiuto">Riga vuota tra un paragrafo e l'altro. I pulsanti aggiungono i segni attorno al testo selezionato.</p>
        <div class="azioni">
          <button class="primo" id="salva">Salva</button>
          <button id="pubblica">${a.stato === 'pubblicato' ? 'Ritira dal sito' : 'Pubblica sul sito'}</button>
          ${id ? '<button class="rosso" id="elimina">Elimina</button>' : ''}
          ${a.stato === 'pubblicato' ? `<a href="diario.html?a=${encodeURIComponent(a.slug)}" target="_blank">vedi sul sito</a>` : ''}
        </div>
        <p class="msg" id="e-msg" aria-live="polite"></p>
      </div>
      <article class="anteprima" id="ant"></article>
    </div>`;
  const t = $('#e-titolo'), sl = $('#e-slug'), so = $('#e-sommario'), te = $('#e-testo'), msg = $('#e-msg');
  let copertina = a.copertina;
  const aggiornaAnteprima = () => {
    $('#ant').innerHTML = `<h1>${esc(t.value || 'Titolo')}</h1>${so.value ? `<p class="som">${esc(so.value)}</p>` : ''}
      ${copertina ? `<img src="${indirizzoCopertina(copertina)}" alt="" />` : ''}<div class="corpo">${inHtml(te.value)}</div>`;
  };
  t.oninput = () => { if (!slugToccato) sl.value = inSlug(t.value); aggiornaAnteprima(); };
  sl.oninput = () => { slugToccato = true; sl.value = sl.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); };
  so.oninput = te.oninput = aggiornaAnteprima;
  aggiornaAnteprima();
  $('#indietro').onclick = listaArticoli;

  // segni attorno alla selezione
  document.querySelectorAll('.attrezzi button').forEach((b) => {
    b.onclick = () => {
      const s = te.selectionStart, e = te.selectionEnd, sel = te.value.slice(s, e);
      let nuovo;
      if (b.dataset.link !== undefined) {
        const url = prompt('Indirizzo del link (https://…)');
        if (!url) return;
        nuovo = `[${sel || 'parole del link'}](${url.trim()})`;
      } else if (b.dataset.riga !== undefined) nuovo = (sel || 'testo').split('\n').map((r) => b.dataset.m + r).join('\n');
      else nuovo = b.dataset.m + (sel || 'testo') + b.dataset.m;
      te.setRangeText(nuovo, s, e, 'select');
      te.focus();
      aggiornaAnteprima();
    };
  });

  // copertina: la foto si rimpicciolisce a 1600 px prima di partire, così il sito resta leggero
  $('#e-cop').onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    scrivi(msg, 'Carico la copertina…');
    try {
      const blob = await rimpicciolisci(file, 1600);
      const nome = `${Date.now()}-${inSlug(sl.value || t.value || 'copertina') || 'copertina'}.jpg`;
      const { error } = await sb.storage.from('copertine').upload(nome, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      copertina = nome;
      $('#cop-box').innerHTML = `<img class="cop-prova" src="${indirizzoCopertina(nome)}" alt="" />`;
      aggiornaAnteprima();
      scrivi(msg, 'Copertina caricata. Ricordati di salvare.', 'ok');
    } catch (err) { scrivi(msg, spiegaErrore(err), 'no'); }
  };
  if ($('#via-cop')) $('#via-cop').onclick = () => { copertina = null; $('#cop-box').innerHTML = ''; aggiornaAnteprima(); };

  const salva = async (stato) => {
    if (!t.value.trim()) return scrivi(msg, 'Manca il titolo.', 'no');
    if (!/^[a-z0-9-]{1,120}$/.test(sl.value)) return scrivi(msg, 'L\'indirizzo può contenere solo lettere minuscole, numeri e trattini.', 'no');
    const riga = { titolo: t.value.trim(), slug: sl.value, sommario: so.value.trim() || null, testo: te.value, copertina, stato };
    if (stato === 'bozza') riga.pubblicato_il = null;
    scrivi(msg, 'Salvo…');
    const q = id ? sb.from('articoli').update(riga).eq('id', id).select('id').single() : sb.from('articoli').insert(riga).select('id').single();
    const { data, error } = await q;
    if (error) return scrivi(msg, spiegaErrore(error), 'no');
    id = data.id;
    editor(id).then(() => scrivi($('#e-msg'), stato === 'pubblicato' ? 'Pubblicato: è sul sito.' : 'Salvato.', 'ok'));
  };
  $('#salva').onclick = () => salva(a.stato);
  $('#pubblica').onclick = () => salva(a.stato === 'pubblicato' ? 'bozza' : 'pubblicato');
  if ($('#elimina')) $('#elimina').onclick = async () => {
    if (!confirm(`Eliminare per sempre "${a.titolo}"? Non si può annullare.`)) return;
    const { error } = await sb.from('articoli').delete().eq('id', id);
    if (error) return scrivi(msg, spiegaErrore(error), 'no');
    if (a.copertina) await sb.storage.from('copertine').remove([a.copertina]);
    listaArticoli();
  };
}

function rimpicciolisci(file, lato) {
  return new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lato / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? ok(b) : no(new Error('immagine non leggibile'))), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => no(new Error('immagine non leggibile'));
    img.src = URL.createObjectURL(file);
  });
}

/* ------------------------------------------------------------------ */
/* registro delle tessere                                              */
/* ------------------------------------------------------------------ */
const CAMPI_TESSERA = [
  ['nome', 'Nome'], ['cognome', 'Cognome'], ['data_nascita', 'Data di nascita', 'date'], ['luogo_nascita', 'Luogo di nascita'],
  ['codice_fiscale', 'Codice fiscale'], ['comune_residenza', 'Comune di residenza'], ['email', 'Email', 'email'], ['telefono', 'Telefono'],
];
const filtri = { anno: annoOra, stato: 'tutte', cerca: '' };

async function registro() {
  vista.innerHTML = `
    <div class="testa"><h2>Tessere</h2>
      <div class="strumenti">
        <label>Anno<select id="f-anno"></select></label>
        <label>Stato<select id="f-stato">${['tutte', 'in attesa', 'attiva', 'scaduta', 'respinta'].map((s) => `<option ${s === filtri.stato ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label>Cerca<input id="f-cerca" placeholder="nome, cognome, email" value="${esc(filtri.cerca)}" /></label>
        <button id="t-nuova">Nuova tessera</button>
        <button id="t-scarica">Scarica il registro</button>
      </div>
    </div>
    <div id="t-elenco">Carico…</div>`;
  const { data: anni } = await sb.from('tessere').select('anno');
  const elencoAnni = [...new Set([annoOra, annoOra + 1, ...(anni || []).map((x) => x.anno)])].sort((x, y) => y - x);
  $('#f-anno').innerHTML = elencoAnni.map((x) => `<option ${x === filtri.anno ? 'selected' : ''}>${x}</option>`).join('');
  $('#f-anno').onchange = (e) => { filtri.anno = Number(e.target.value); carica(); };
  $('#f-stato').onchange = (e) => { filtri.stato = e.target.value; carica(); };
  $('#f-cerca').oninput = (e) => { filtri.cerca = e.target.value; disegna(); };
  $('#t-nuova').onclick = () => tessera({ anno: filtri.anno, stato: 'in attesa', quota: 15, maggiorenne: true, consenso_privacy: true });
  $('#t-scarica').onclick = scaricaRegistro;
  let righe = [];
  async function carica() {
    let q = sb.from('tessere').select('*').eq('anno', filtri.anno).order('numero', { ascending: true, nullsFirst: true }).order('data_richiesta');
    if (filtri.stato !== 'tutte') q = q.eq('stato', filtri.stato);
    const { data, error } = await q;
    if (error) return ($('#t-elenco').textContent = spiegaErrore(error));
    righe = data;
    disegna();
  }
  function disegna() {
    const c = filtri.cerca.toLowerCase().trim();
    const vis = righe.filter((r) => !c || `${r.nome} ${r.cognome} ${r.email}`.toLowerCase().includes(c));
    const attesa = righe.filter((r) => r.stato === 'in attesa').length, attive = righe.filter((r) => r.stato === 'attiva').length;
    if (!vis.length) return ($('#t-elenco').innerHTML = `<p class="vuoto">Nessuna tessera ${filtri.stato !== 'tutte' ? `"${filtri.stato}" ` : ''}per il ${filtri.anno}.</p>`);
    $('#t-elenco').innerHTML = `<p class="aiuto">${attive} attive, ${attesa} in attesa. Clicca una riga per aprirla.</p>
      <table><thead><tr><th>N.</th><th>Cognome e nome</th><th>Stato</th><th>Richiesta</th><th>Email</th><th>Pagamento</th></tr></thead><tbody>${vis.map((r) => `
      <tr data-id="${r.id}"><td>${r.numero ?? ''}</td><td>${esc(r.cognome)} ${esc(r.nome)}</td>
      <td><span class="stato ${r.stato.replace('in ', '')}">${r.stato}</span></td><td>${dataItaliana(r.data_richiesta)}</td>
      <td>${esc(r.email)}</td><td>${r.data_pagamento ? `${dataItaliana(r.data_pagamento)}, ${r.metodo_pagamento || ''}` : ''}</td></tr>`).join('')}</tbody></table>`;
    $('#t-elenco').querySelectorAll('tr[data-id]').forEach((tr) => { tr.onclick = () => tessera(righe.find((r) => r.id === tr.dataset.id)); });
  }
  registro.ricarica = carica;
  carica();
}

function tessera(r) {
  const nuova = !r.id;
  const box = document.createElement('div');
  box.className = 'pannello';
  box.innerHTML = `<form>
    <div class="testa"><h2>${nuova ? 'Nuova tessera' : `${esc(r.cognome)} ${esc(r.nome)}`}</h2><button type="button" class="link" data-chiudi>chiudi</button></div>
    ${r.numero ? `<p>Tessera n. <b>${r.numero}</b> del ${r.anno}, ammessa il ${dataItaliana(r.data_ammissione)}</p>` : ''}
    <div class="due">${CAMPI_TESSERA.map(([k, n, tipo]) => `<label>${n}<input name="${k}" type="${tipo || 'text'}" value="${esc(r[k] ?? '')}" ${['nome', 'cognome', 'email'].includes(k) ? 'required' : ''} /></label>`).join('')}</div>
    <div class="due">
      <label>Anno<input name="anno" type="number" min="2026" max="2100" value="${r.anno}" required /></label>
      <label>Stato<select name="stato">${['in attesa', 'attiva', 'scaduta', 'respinta'].map((s) => `<option ${s === r.stato ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Pagamento<select name="metodo_pagamento"><option value="">non ancora</option>${['bonifico', 'paypal', 'contanti'].map((s) => `<option ${s === r.metodo_pagamento ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Data del pagamento<input name="data_pagamento" type="date" value="${r.data_pagamento || ''}" /></label>
      <label>Quota (euro)<input name="quota" type="number" step="0.01" min="0" value="${r.quota ?? 15}" /></label>
    </div>
    <label>Note<textarea name="note" style="min-height:90px">${esc(r.note || '')}</textarea></label>
    <div class="azioni">
      <button class="primo" type="submit">Salva</button>
      ${r.stato === 'in attesa' ? '<button type="button" data-attiva>Pagata: attiva la tessera</button>' : ''}
      ${!nuova && r.stato === 'attiva' ? `<button type="button" data-rinnova>Prepara il rinnovo ${r.anno + 1}</button>` : ''}
      ${!nuova ? '<button type="button" class="rosso" data-elimina>Elimina</button>' : ''}
    </div>
    <p class="msg" aria-live="polite"></p>
  </form>`;
  document.body.appendChild(box);
  const form = box.querySelector('form'), msg = box.querySelector('.msg');
  const chiudi = () => box.remove();
  box.addEventListener('click', (e) => { if (e.target === box || e.target.dataset.chiudi !== undefined) chiudi(); });
  const leggiForm = () => {
    const d = Object.fromEntries(new FormData(form));
    for (const k in d) if (d[k] === '') d[k] = null;
    d.anno = Number(d.anno); d.quota = d.quota === null ? 15 : Number(d.quota);
    if (d.codice_fiscale) d.codice_fiscale = d.codice_fiscale.toUpperCase();
    return d;
  };
  const salva = async (extra = {}) => {
    if (!form.reportValidity()) return;
    const d = { ...leggiForm(), ...extra };
    if (d.stato === 'attiva' && !d.metodo_pagamento) return scrivi(msg, 'Per attivare la tessera indica come ha pagato.', 'no');
    if (d.stato === 'attiva' && !d.data_pagamento) d.data_pagamento = oggi();
    const q = nuova ? sb.from('tessere').insert({ ...d, maggiorenne: true, consenso_privacy: true }) : sb.from('tessere').update(d).eq('id', r.id);
    const { error } = await q;
    if (error) return scrivi(msg, spiegaErrore(error), 'no');
    chiudi();
    registro.ricarica?.();
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); salva(); });
  box.querySelector('[data-attiva]')?.addEventListener('click', () => salva({ stato: 'attiva' }));
  box.querySelector('[data-rinnova]')?.addEventListener('click', async () => {
    const { id, numero, data_richiesta, data_ammissione, data_pagamento, metodo_pagamento, note, ...dati } = r;
    const { error } = await sb.from('tessere').insert({ ...dati, anno: r.anno + 1, stato: 'in attesa' });
    if (error) return scrivi(msg, spiegaErrore(error), 'no');
    scrivi(msg, `Rinnovo ${r.anno + 1} preparato: lo trovi nell'anno ${r.anno + 1}, in attesa del pagamento.`, 'ok');
  });
  box.querySelector('[data-elimina]')?.addEventListener('click', async () => {
    if (!confirm(`Eliminare per sempre la tessera di ${r.nome} ${r.cognome} (${r.anno})? Non si può annullare.`)) return;
    const { error } = await sb.from('tessere').delete().eq('id', r.id);
    if (error) return scrivi(msg, spiegaErrore(error), 'no');
    chiudi();
    registro.ricarica?.();
  });
}

// il registro come file per Excel: punto e virgola e accenti a posto, una riga per tessera
async function scaricaRegistro() {
  const { data, error } = await sb.from('tessere').select('*').eq('anno', filtri.anno).order('numero', { nullsFirst: false });
  if (error) return alert(spiegaErrore(error));
  const col = [['numero', 'Numero'], ['anno', 'Anno'], ['cognome', 'Cognome'], ['nome', 'Nome'], ['data_nascita', 'Data di nascita'], ['luogo_nascita', 'Luogo di nascita'],
    ['codice_fiscale', 'Codice fiscale'], ['comune_residenza', 'Comune di residenza'], ['email', 'Email'], ['telefono', 'Telefono'], ['stato', 'Stato'],
    ['data_richiesta', 'Richiesta'], ['data_ammissione', 'Ammissione'], ['quota', 'Quota'], ['metodo_pagamento', 'Pagamento'], ['data_pagamento', 'Data pagamento'], ['note', 'Note']];
  const cella = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) s = new Date(s).toLocaleDateString('it-IT');
    if (/^[=+\-@]/.test(s)) s = "'" + s; // niente formule nascoste nelle celle
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [col.map((c) => c[1]).join(';'), ...data.map((r) => col.map(([k]) => cella(r[k])).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `Locus-registro-tessere-${filtri.anno}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------------ */
/* statistiche (dal 12/11): totali calcolati dall'archivio, periodo a  */
/* scelta e confronto con il periodo prima. Niente cookie, niente dati */
/* di chi visita: solo pagina, passo, telefono o computer, provenienza */
/* ------------------------------------------------------------------ */
const statoStat = { giorni: 30 };
const NOMI_PROV = {
  diretto: 'Link diretto o app', interno: 'Da un\'altra pagina del sito', instagram: 'Instagram', facebook: 'Facebook', google: 'Google',
  'altri motori': 'Altri motori di ricerca', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', tiktok: 'TikTok', x: 'X', telegram: 'Telegram',
};
const nomeProv = (p) => (p.startsWith('da:') ? `Codice «${p.slice(3)}»` : NOMI_PROV[p] || p);
const giornoLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const GIORNI_SETT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const indirizzoSito = () => new URL(import.meta.env.BASE_URL, location.origin).href;

async function statistiche() {
  const G = statoStat.giorni;
  vista.innerHTML = `<div class="testa"><div><h2>Statistiche</h2><p class="aiuto">Si conta solo il passaggio: niente cookie, niente dati di chi visita. Le frecce confrontano con i ${G} giorni prima.</p></div>
    <div class="periodo">${[7, 30, 90].map((g) => `<button data-g="${g}" class="${g === G ? 'su' : ''}">${g} giorni</button>`).join('')}</div></div>
    <div id="s-box">Carico…</div>`;
  vista.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => { statoStat.giorni = Number(b.dataset.g); statistiche(); }; });
  const ora = new Date(), inizio = new Date();
  inizio.setHours(0, 0, 0, 0); inizio.setDate(inizio.getDate() - (G - 1));
  const prima = new Date(inizio); prima.setDate(prima.getDate() - G);
  const [cur, prec, art] = await Promise.all([
    sb.rpc('statistiche', { da: inizio.toISOString(), a: ora.toISOString() }),
    sb.rpc('statistiche', { da: prima.toISOString(), a: inizio.toISOString() }),
    sb.from('articoli').select('slug,titolo'),
  ]);
  if (cur.error) return ($('#s-box').textContent = spiegaErrore(cur.error));
  if (!cur.data) return ($('#s-box').textContent = 'Il tuo livello non permette di vedere le statistiche.');
  const S = cur.data, P = prec.data;
  const somma = (s, f) => (s?.eventi || []).filter(f).reduce((t, x) => t + x.n, 0);
  const voce = (f) => [somma(S, f), P ? somma(P, f) : null];
  const freccia = ([n, p]) => {
    if (p === null || (!p && !n)) return '';
    if (!p) return '<em class="su">nuovo</em>';
    const d = Math.round((100 * (n - p)) / p);
    return d === 0 ? '<em>come prima</em>' : `<em class="${d > 0 ? 'su' : 'giu'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}%</em>`;
  };
  const ingressi = voce((x) => x.evento === 'ingresso');
  const daTelefono = somma(S, (x) => x.evento === 'ingresso' && x.telefono);
  const numeri = [
    [ingressi, 'visite al sito'],
    [voce((x) => x.pagina === 'home' && x.evento === 'arrivo'), 'arrivi alla pagina iniziale'],
    [voce((x) => x.evento === 'salta'), 'hanno saltato l\'introduzione'],
    [voce((x) => x.evento === 'fine-percorso'), 'arrivati in fondo al viaggio'],
    [voce((x) => x.pagina === 'chi-siamo' && x.evento === 'arrivo'), 'visite a Chi siamo'],
    [voce((x) => x.pagina === 'diario' && x.evento === 'arrivo'), 'visite al Diario'],
    [voce((x) => x.pagina === 'articolo' && x.evento === 'arrivo'), 'articoli aperti'],
    [voce((x) => x.evento === 'richiesta-tessera'), 'richieste di tessera dal sito'],
  ];

  // visite giorno per giorno
  const perGiorno = Object.fromEntries((S.giorni || []).map((x) => [x.g, x.n]));
  const giorni = [];
  for (let d = new Date(inizio); d <= ora; d.setDate(d.getDate() + 1)) giorni.push([giornoLocale(d), perGiorno[giornoLocale(d)] || 0]);
  const maxG = Math.max(1, ...giorni.map((g) => g[1]));
  const etichetta = (g) => new Date(g + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

  // articoli più letti
  const titoli = Object.fromEntries((art.data || []).map((a) => [a.slug, a.titolo]));
  const perArt = {};
  (S.articoli || []).forEach((x) => {
    const r = (perArt[x.s] ||= { aperti: 0, fine: 0 });
    if (x.evento === 'arrivo') r.aperti += x.n;
    if (x.evento === 'fine') r.fine += x.n;
  });
  const classifica = Object.entries(perArt).sort((a, b) => b[1].aperti - a[1].aperti);

  // provenienze
  const prov = (S.provenienze || []).slice().sort((a, b) => b.n - a.n);
  const totProv = prov.reduce((t, x) => t + x.n, 0) || 1;

  // giorni e ore
  const mappa = Array.from({ length: 7 }, () => Array(24).fill(0));
  (S.orari || []).forEach((x) => { mappa[x.d - 1][x.h] += x.n; });
  const maxM = Math.max(1, ...mappa.flat());

  // fluidità: a che risoluzione si è assestato il sito, per telefono e computer
  const flu = (tel) => {
    const righe = (S.fluidita || []).filter((x) => x.telefono === tel);
    const tot = righe.reduce((t, x) => t + x.n, 0);
    const conta = (f) => righe.filter((x) => x.r.startsWith(f)).reduce((t, x) => t + x.n, 0);
    return { tot, piena: conta('piena'), ridotta: conta('ridotta'), minima: conta('minima'), leggera: righe.filter((x) => x.r.endsWith('-leggera')).reduce((t, x) => t + x.n, 0) };
  };
  const pc = (n, t) => (t ? Math.round((100 * n) / t) : 0);
  const rigaFlu = (nome, f) => (!f.tot ? `<div class="flu"><span>${nome}</span><p class="aiuto">Ancora nessuna misura.</p></div>` : `<div class="flu"><span>${nome} · ${f.tot} visite misurate</span>
    <div class="pila"><i class="piena" style="width:${pc(f.piena, f.tot)}%"></i><i class="ridotta" style="width:${pc(f.ridotta, f.tot)}%"></i><i class="minima" style="width:${pc(f.minima, f.tot)}%"></i></div>
    <p class="aiuto">${pc(f.piena, f.tot)}% fluido a piena risoluzione, ${pc(f.ridotta, f.tot)}% ha dovuto abbassarla, ${pc(f.minima, f.tot)}% è sceso al minimo.${f.leggera ? ` ${pc(f.leggera, f.tot)}% ha avuto la versione leggera.` : ''}</p></div>`);

  $('#s-box').innerHTML = `
    <div class="numeri">${numeri.map(([v, t]) => `<div><b>${v[0]}</b><span>${t}</span>${freccia(v)}</div>`).join('')}
      <div><b>${ingressi[0] ? Math.round((100 * daTelefono) / ingressi[0]) : 0}%</b><span>delle visite da telefono</span></div></div>

    <h3>Visite al giorno</h3>
    <div class="giorni">${giorni.map(([g, n]) => `<i style="height:${(100 * n) / maxG}%" data-t="${etichetta(g)}: ${n}"></i>`).join('')}</div>
    <div class="asse"><span>${etichetta(giorni[0][0])}</span><span>oggi</span></div>

    <div class="colonne-stat">
      <section>
        <h3>Articoli più letti</h3>
        ${classifica.length ? `<table><thead><tr><th>Articolo</th><th>Aperti</th><th>Letti fino in fondo</th></tr></thead><tbody>${classifica.map(([s, r]) => `
          <tr class="ferma"><td>${esc(titoli[s] || s)}</td><td>${r.aperti}</td><td>${r.fine} <span class="aiuto">(${pc(r.fine, r.aperti)}%)</span></td></tr>`).join('')}</tbody></table>`
          : '<p class="vuoto">Nessun articolo letto in questo periodo.</p>'}
      </section>
      <section>
        <h3>Da dove arrivano</h3>
        ${prov.length ? `<div class="barre">${prov.map((x) => `<div><span>${esc(nomeProv(x.p))}</span><i style="width:${(100 * x.n) / prov[0].n}%"></i><b>${x.n} <small>${pc(x.n, totProv)}%</small></b></div>`).join('')}</div>`
          : '<p class="vuoto">Ancora nessuna visita registrata con la provenienza.</p>'}
        <p class="aiuto">"Link diretto o app" comprende WhatsApp e molte app, che non dicono da dove arriva il link. Per saperlo con certezza, usa un codice:</p>
        <div class="codice"><input id="c-nome" placeholder="es. volantino-novembre" maxlength="50" /><input id="c-link" readonly /><button id="c-copia">Copia</button></div>
      </section>
    </div>

    <h3>Quando arrivano</h3>
    <div class="mappa-box"><table class="mappa"><thead><tr><th></th>${Array.from({ length: 24 }, (_, h) => `<th>${h % 3 === 0 ? h : ''}</th>`).join('')}</tr></thead><tbody>
      ${mappa.map((riga, d) => `<tr class="ferma"><th>${GIORNI_SETT[d]}</th>${riga.map((n, h) => `<td style="--k:${(n / maxM).toFixed(2)}" title="${GIORNI_SETT[d]} ore ${h}: ${n} visite"></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    <p class="aiuto">Più il quadretto è acceso, più visite in quell'ora (ora italiana). Utile per scegliere quando pubblicare su Instagram.</p>

    <h3>Quanto fatica il sito</h3>
    <p class="aiuto">Il sito abbassa da solo la risoluzione se il dispositivo non regge. Qui si vede dove si è assestato, alla fine di ogni visita alla pagina iniziale.</p>
    ${rigaFlu('Telefoni', flu(true))}${rigaFlu('Computer', flu(false))}`;

  const nome = $('#c-nome'), link = $('#c-link');
  const scriviLink = () => {
    const c = nome.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    link.value = c ? `${indirizzoSito()}?da=${c}` : '';
  };
  nome.oninput = scriviLink;
  $('#c-copia').onclick = async () => {
    if (!link.value) return nome.focus();
    try { await navigator.clipboard.writeText(link.value); $('#c-copia').textContent = 'Copiato'; } catch (_) { link.select(); }
  };
}

/* ------------------------------------------------------------------ */
/* eventi (dal 12/11): gli appuntamenti di "Cosa arriva" in Chi siamo. */
/* Quelli letti da Instagram arrivano da soli; qui si correggono o si  */
/* nascondono, e si aggiungono quelli che su Instagram non ci sono.    */
/* ------------------------------------------------------------------ */
async function eventi() {
  vista.innerHTML = `<div class="testa"><div><h2>Eventi</h2>
      <p class="aiuto">Compaiono in Chi siamo, sezione "Cosa arriva", dal più vicino; quelli passati spariscono da soli.</p></div>
      <button class="primo" id="ev-nuovo">Nuovo appuntamento</button></div>
    <p class="avviso" id="ev-ig"></p><div id="ev-box">Carico…</div>`;
  $('#ev-nuovo').onclick = () => evento({ origine: 'mano', stato: 'visibile' });
  const [ig, db] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}eventi-instagram.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    sb.from('eventi').select('*'),
  ]);
  if (db.error) return ($('#ev-box').textContent = spiegaErrore(db.error));
  $('#ev-ig').innerHTML = ig?.aggiornato
    ? `Instagram collegato: i post che annunciano una data diventano appuntamenti da soli, con qualche ora di ritardo (ultimo controllo ${dataItaliana(ig.aggiornato)}). Se la lettura sbaglia, apri l'appuntamento e correggilo; se non è un appuntamento, nascondilo.`
    : 'Instagram non è ancora collegato al sito (manca il token di Instagram): per ora valgono solo gli appuntamenti scritti qui.';
  const corretti = new Set(db.data.filter((e) => e.ig_id).map((e) => e.ig_id));
  const tutti = [...db.data, ...(ig?.eventi || []).filter((e) => !corretti.has(e.ig_id)).map((e) => ({ ...e, origine: 'instagram', stato: 'visibile', letto: true }))];
  const oggiL = giornoLocale(new Date());
  const inArrivo = tutti.filter((e) => e.data && e.data >= oggiL).sort((a, b) => a.data.localeCompare(b.data));
  const senzaData = tutti.filter((e) => !e.data);
  const passati = tutti.filter((e) => e.data && e.data < oggiL).sort((a, b) => b.data.localeCompare(a.data));
  const quando = (e) => (e.data ? new Date(e.data + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : esc(e.riquadro || 'senza data'));
  const origine = (e) => (e.origine === 'mano' ? 'scritto qui' : e.letto ? 'da Instagram, automatico' : 'da Instagram, corretto qui');
  const tabella = (righe) => `<table><thead><tr><th>Quando</th><th>Appuntamento</th><th>Da dove</th><th>Sul sito</th></tr></thead><tbody>${righe.map((e) => `
    <tr data-k="${tutti.indexOf(e)}" class="${e.stato === 'nascosto' ? 'spento' : ''}"><td>${quando(e)}</td><td><b>${esc(e.titolo)}</b><br><span class="aiuto">${esc(e.quando || '')}</span></td>
    <td><span class="stato ${e.origine === 'mano' ? '' : 'ig'}">${origine(e)}</span></td><td>${e.stato === 'nascosto' ? 'nascosto' : 'visibile'}</td></tr>`).join('')}</tbody></table>`;
  $('#ev-box').innerHTML = `
    <h3>In arrivo</h3>${inArrivo.length ? tabella(inArrivo) : '<p class="vuoto">Nessun appuntamento in calendario.</p>'}
    ${senzaData.length ? `<h3>Senza data (in fondo alla sezione)</h3>${tabella(senzaData)}` : ''}
    ${passati.length ? `<details><summary>Passati (${passati.length}): sul sito non si vedono più</summary>${tabella(passati)}</details>` : ''}`;
  $('#ev-box').querySelectorAll('tr[data-k]').forEach((tr) => { tr.onclick = () => evento(tutti[Number(tr.dataset.k)]); });
}

function evento(e) {
  const box = document.createElement('div');
  box.className = 'pannello';
  box.innerHTML = `<form>
    <div class="testa"><h2>${e.titolo ? esc(e.titolo) : 'Nuovo appuntamento'}</h2><button type="button" class="link" data-chiudi>chiudi</button></div>
    ${e.letto ? `<p class="avviso">Letto in automatico da <a href="${esc(e.link)}" target="_blank" rel="noopener">questo post</a>. Se salvi, la tua versione prende il posto della lettura automatica.</p>` : ''}
    ${e.id && e.ig_id ? `<p class="avviso">Corretto a mano: viene da <a href="${esc(e.link || '#')}" target="_blank" rel="noopener">questo post</a>.</p>` : ''}
    <div class="due">
      <label>Data<input name="data" type="date" value="${e.data || ''}" /></label>
      <label>Riquadro, se non c'è la data<input name="riquadro" placeholder="es. nov 2026" value="${esc(e.riquadro || '')}" /></label>
    </div>
    <label>Quando (riga sopra il titolo)<input name="quando" placeholder="es. Sabato, ore 15.00" value="${esc(e.quando || '')}" /></label>
    <label>Titolo<input name="titolo" required maxlength="140" value="${esc(e.titolo || '')}" /></label>
    <label>Testo<textarea name="testo" maxlength="500" style="min-height:110px;font:15px/1.45 'Inter',sans-serif">${esc(e.testo || '')}</textarea></label>
    <label>Link (facoltativo, es. il post su Instagram)<input name="link" type="url" value="${esc(e.link || '')}" /></label>
    <label>Sul sito<select name="stato"><option value="visibile" ${e.stato !== 'nascosto' ? 'selected' : ''}>visibile</option><option value="nascosto" ${e.stato === 'nascosto' ? 'selected' : ''}>nascosto</option></select></label>
    <div class="azioni">
      <button class="primo" type="submit">Salva</button>
      ${e.letto ? '<button type="button" data-nascondi>Non è un appuntamento: nascondi</button>' : ''}
      ${e.id && e.ig_id ? '<button type="button" data-auto>Torna alla lettura automatica</button>' : ''}
      ${e.id && !e.ig_id ? '<button type="button" class="rosso" data-elimina>Elimina</button>' : ''}
    </div>
    <p class="msg" aria-live="polite"></p>
  </form>`;
  document.body.appendChild(box);
  const form = box.querySelector('form'), msg = box.querySelector('.msg');
  const chiudi = () => box.remove();
  box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.dataset.chiudi !== undefined) chiudi(); });
  const salva = async (extra = {}) => {
    if (!extra.stato && !form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form));
    for (const k in d) d[k] = d[k].trim() || null;
    const riga = { ...d, titolo: d.titolo || e.titolo, ...extra };
    const q = e.id ? sb.from('eventi').update(riga).eq('id', e.id) : sb.from('eventi').insert({ ...riga, origine: e.origine || 'mano', ig_id: e.ig_id || null });
    const { error } = await q;
    if (error) return scrivi(msg, spiegaErrore(error), 'no');
    chiudi(); eventi();
  };
  form.addEventListener('submit', (ev) => { ev.preventDefault(); salva(); });
  box.querySelector('[data-nascondi]')?.addEventListener('click', () => salva({ stato: 'nascosto' }));
  const togli = async (domanda) => {
    if (!confirm(domanda)) return;
    const { error } = await sb.from('eventi').delete().eq('id', e.id);
    if (error) return scrivi(msg, spiegaErrore(error), 'no');
    chiudi(); eventi();
  };
  box.querySelector('[data-auto]')?.addEventListener('click', () => togli('Togliere la correzione? Torna a valere quello che il sito legge dal post.'));
  box.querySelector('[data-elimina]')?.addEventListener('click', () => togli(`Eliminare "${e.titolo}"? Non si può annullare.`));
}

/* ------------------------------------------------------------------ */
/* richieste di tessera (dal 12/11): dal modulo del sito all'attivazione,*/
/* in tre colonne. Le mail partono dal programma di posta di chi clicca */
/* ------------------------------------------------------------------ */
// DA COMPLETARE: i dati veri per versare la quota (li deve dare il tesoriere)
const DATI_PAGAMENTO = 'Bonifico: IBAN [da inserire], intestato a Locus\nPayPal: [indirizzo da inserire]';
const giorniDa = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
const eta = (d) => (d ? Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / (365.25 * 864e5)) : null);
function testoMail(r, tipo) {
  const firma = '\n\nA presto,\nLocus';
  if (tipo === 'paga') return ['La tua tessera Locus', `Ciao ${r.nome},\n\ngrazie per aver chiesto di tesserarti a Locus.\n\nLa quota associativa è di ${r.quota ?? 15} euro e vale per tutto il ${r.anno}. Puoi versarla così:\n${DATI_PAGAMENTO}\nNella causale scrivi: Tessera Locus ${r.anno}, ${r.nome} ${r.cognome}.\n\nAppena arriva il pagamento attiviamo la tessera e ti scriviamo il numero.${firma}`];
  if (tipo === 'sollecito') return ['La tua tessera Locus', `Ciao ${r.nome},\n\nti riscriviamo per la tessera che hai chiesto il ${dataItaliana(r.data_richiesta)}: non ci risulta ancora il pagamento della quota (${r.quota ?? 15} euro). Se l'hai già fatto, rispondi a questa mail e controlliamo.\n\nPer versarla:\n${DATI_PAGAMENTO}\nNella causale scrivi: Tessera Locus ${r.anno}, ${r.nome} ${r.cognome}.${firma}`];
  return ['La tua tessera Locus è attiva', `Ciao ${r.nome},\n\nla tua tessera Locus ${r.anno} è attiva: è la numero ${r.numero}. Ti diamo il benvenuto.\n\nCi vediamo al prossimo Meet Up, il primo sabato del mese. Gli appuntamenti sono sul sito, in Chi siamo, e su Instagram (@locus_parma).${firma}`];
}
const apriMail = (r, tipo) => {
  const [oggetto, corpo] = testoMail(r, tipo);
  location.href = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
};

async function richieste() {
  vista.innerHTML = `<div class="testa"><div><h2>Richieste di tessera</h2>
    <p class="aiuto">Arrivano dal modulo in Chi siamo. Si scrive con i dati per pagare, si aspetta il pagamento, si attiva: il numero di tessera lo dà l'archivio, in ordine.</p></div></div>
    ${DATI_PAGAMENTO.includes('[da inserire]') ? '<p class="avviso">Nelle mail mancano ancora IBAN e PayPal veri: finché non ci sono, controlla il testo prima di inviare.</p>' : ''}
    <div id="r-box">Carico…</div>`;
  registro.ricarica = richieste; // la scheda completa, chiusa, torna qui
  const [att, tutte] = await Promise.all([
    sb.from('tessere').select('*').eq('stato', 'in attesa').order('data_richiesta'),
    sb.from('tessere').select('*').order('data_ammissione', { ascending: false, nullsFirst: false }),
  ]);
  if (att.error || tutte.error) return ($('#r-box').textContent = spiegaErrore(att.error || tutte.error));
  aggiornaConteggio(att.data.length);
  const rinnovo = (r) => tutte.data.some((t) => t.id !== r.id && t.anno < r.anno
    && ((t.email && r.email && t.email.toLowerCase() === r.email.toLowerCase()) || (t.codice_fiscale && t.codice_fiscale === r.codice_fiscale)));
  const nuove = att.data.filter((r) => !r.contattata_il);
  const aspetto = att.data.filter((r) => r.contattata_il);
  const limite = giornoLocale(new Date(Date.now() - 30 * 864e5));
  const attivate = tutte.data.filter((t) => t.stato === 'attiva' && t.data_ammissione >= limite);
  const scheda = (r, fase) => {
    const gc = r.contattata_il ? giorniDa(r.contattata_il) : 0;
    const info = [eta(r.data_nascita) !== null ? `${eta(r.data_nascita)} anni` : '', r.comune_residenza, r.telefono].filter(Boolean).map(esc).join(' · ');
    let quando, azioni;
    if (fase === 'nuova') {
      quando = `Richiesta ${giorniDa(r.data_richiesta) === 0 ? 'oggi' : `${giorniDa(r.data_richiesta)} giorni fa`}`;
      azioni = '<button class="primo" data-a="paga">Scrivi i dati per pagare</button><button data-a="pagata">Ha pagato</button>';
    } else if (fase === 'aspetto') {
      quando = `Scritto ${gc === 0 ? 'oggi' : `${gc} giorni fa`}${gc >= 10 ? ' · <b class="tardi">da sollecitare</b>' : ''}`;
      azioni = `<button class="primo" data-a="pagata">Ha pagato</button><button data-a="sollecito" class="${gc >= 10 ? 'acceso' : ''}">Sollecita</button>`;
    } else {
      quando = `Tessera n. <b>${r.numero}</b> · ${esc(r.metodo_pagamento || '')} · attiva dal ${dataItaliana(r.data_ammissione)}`;
      azioni = '<button data-a="benvenuto">Scrivi il benvenuto</button>';
    }
    return `<div class="rich" data-id="${r.id}">
      <div class="r-testa"><b>${esc(r.cognome)} ${esc(r.nome)}</b>${rinnovo(r) ? '<span class="stato">rinnovo</span>' : ''}</div>
      <p class="r-info"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${info ? `<br>${info}` : ''}</p>
      <p class="r-quando">${quando}</p>
      <div class="azioni">${azioni}${fase !== 'fatta' ? '<button class="link" data-a="scheda">scheda</button><button class="link" data-a="respingi">respingi</button>' : ''}</div>
      <div class="r-paga" hidden><select><option value="bonifico">bonifico</option><option value="paypal">PayPal</option><option value="contanti">contanti</option></select><button class="primo" data-a="attiva">Attiva la tessera</button></div>
      <p class="msg" aria-live="polite"></p>
    </div>`;
  };
  const colonna = (titolo, spiega, righe, fase, vuoto) => `<section><h3>${titolo} <span class="quanti">${righe.length}</span></h3><p class="aiuto">${spiega}</p>
    ${righe.length ? righe.map((r) => scheda(r, fase)).join('') : `<p class="vuoto">${vuoto}</p>`}</section>`;
  $('#r-box').innerHTML = `<div class="colonne">
    ${colonna('Nuove', 'Da contattare con i dati per pagare.', nuove, 'nuova', 'Nessuna richiesta nuova.')}
    ${colonna('Aspettiamo il pagamento', 'Dopo 10 giorni senza pagamento conviene sollecitare.', aspetto, 'aspetto', 'Nessuno in attesa di pagamento.')}
    ${colonna('Attivate', 'Negli ultimi 30 giorni.', attivate, 'fatta', 'Nessuna tessera attivata di recente.')}
  </div>`;
  const tutteRighe = [...att.data, ...attivate];
  $('#r-box').querySelectorAll('.rich').forEach((el) => {
    const r = tutteRighe.find((x) => x.id === el.dataset.id), msg = el.querySelector('.msg');
    el.querySelectorAll('[data-a]').forEach((b) => {
      b.onclick = async () => {
        const a = b.dataset.a;
        if (a === 'paga' || a === 'sollecito') {
          apriMail(r, a);
          const { error } = await sb.from('tessere').update({ contattata_il: oggi() }).eq('id', r.id);
          if (error) return scrivi(msg, spiegaErrore(error), 'no');
          setTimeout(richieste, 600);
        } else if (a === 'pagata') {
          el.querySelector('.r-paga').hidden = false;
        } else if (a === 'attiva') {
          const metodo = el.querySelector('.r-paga select').value;
          const { data, error } = await sb.from('tessere').update({ stato: 'attiva', metodo_pagamento: metodo, data_pagamento: oggi() }).eq('id', r.id).select('numero').single();
          if (error) return scrivi(msg, spiegaErrore(error), 'no');
          scrivi(msg, `Attiva: tessera n. ${data.numero}.`, 'ok');
          setTimeout(richieste, 900);
        } else if (a === 'benvenuto') {
          apriMail(r, 'benvenuto');
        } else if (a === 'scheda') {
          tessera(r);
        } else if (a === 'respingi') {
          if (!confirm(`Respingere la richiesta di ${r.nome} ${r.cognome}? Resta nel registro come "respinta".`)) return;
          const { error } = await sb.from('tessere').update({ stato: 'respinta' }).eq('id', r.id);
          if (error) return scrivi(msg, spiegaErrore(error), 'no');
          richieste();
        }
      };
    });
  });
}

// il numero di richieste in attesa, accanto al nome della scheda
async function aggiornaConteggio(n) {
  const b = [...$('#schede').children].find((x) => x.dataset.id === 'richieste');
  if (!b) return;
  if (n === undefined) {
    const { count } = await sb.from('tessere').select('id', { count: 'exact', head: true }).eq('stato', 'in attesa');
    n = count || 0;
  }
  b.querySelector('.conta')?.remove();
  if (n) b.insertAdjacentHTML('beforeend', ` <span class="conta">${n}</span>`);
}

/* ------------------------------------------------------------------ */
/* persone del direttivo e livelli                                     */
/* ------------------------------------------------------------------ */
async function persone() {
  vista.innerHTML = `<div class="testa"><h2>Persone</h2></div>
    <p class="aiuto">Per aggiungere una persona: pannello di Supabase, Authentication, Users, "Add user", con email e password
    (spunta "Auto Confirm User"). Comparirà qui in attesa: scegli il suo livello.
    <a href="https://supabase.com/dashboard/project/qjgqogsoehaxvdqljekc/auth/users" target="_blank" rel="noopener">Apri il pannello</a></p>
    <div id="p-box">Carico…</div>`;
  const { data, error } = await sb.from('persone').select('*').order('creato');
  if (error) return ($('#p-box').textContent = spiegaErrore(error));
  $('#p-box').innerHTML = `<table><thead><tr><th>Email</th><th>Nome</th><th>Livello</th><th></th></tr></thead><tbody>${data.map((p) => `
    <tr data-id="${p.id}"><td>${esc(p.email)}</td><td><input data-nome value="${esc(p.nome || '')}" placeholder="nome" /></td>
    <td><select data-liv ${p.id === io.id ? 'disabled title="Il tuo livello lo cambia un\'altra persona con livello completo"' : ''}>${[['attesa', 'in attesa (nessun accesso)'], ['redazione', 'redazione (solo articoli)'], ['completo', 'completo (tutto)']]
      .map(([v, n]) => `<option value="${v}" ${v === p.livello ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
    <td><button data-salva>Salva</button> <span class="msg"></span></td></tr>`).join('')}</tbody></table>`;
  $('#p-box').querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.style.cursor = 'default';
    tr.querySelector('[data-salva]').onclick = async () => {
      const riga = { nome: tr.querySelector('[data-nome]').value.trim() || null };
      if (tr.dataset.id !== io.id) riga.livello = tr.querySelector('[data-liv]').value;
      const { error: e } = await sb.from('persone').update(riga).eq('id', tr.dataset.id);
      scrivi(tr.querySelector('.msg'), e ? spiegaErrore(e) : 'salvato', e ? 'no' : 'ok');
    };
  });
}
