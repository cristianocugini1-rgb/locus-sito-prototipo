// Il gestionale di Locus: si entra con email e password, poi articoli, registro delle tessere,
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
    b.onclick = () => { nav.querySelectorAll('button').forEach((x) => x.classList.toggle('su', x === b)); location.hash = s.id; s.apri(); };
    nav.appendChild(b);
  });
  const dalLink = mie.findIndex((s) => s.id === location.hash.slice(1));
  nav.children[Math.max(0, dalLink)].click();
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
          ${a.stato === 'pubblicato' ? `<a href="articolo.html?a=${encodeURIComponent(a.slug)}" target="_blank">vedi sul sito</a>` : ''}
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
/* statistiche: passaggi degli ultimi 30 giorni, senza cookie           */
/* ------------------------------------------------------------------ */
async function statistiche() {
  vista.innerHTML = '<div class="testa"><h2>Statistiche</h2><p class="aiuto">Ultimi 30 giorni. Si conta solo il passaggio: niente cookie, niente dati di chi visita.</p></div><div id="s-box">Carico…</div>';
  const da = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error } = await sb.from('visite').select('pagina,evento,telefono,creato').gte('creato', da).limit(20000);
  if (error) return ($('#s-box').textContent = spiegaErrore(error));
  const conta = (f) => data.filter(f).length;
  const arrivi = conta((v) => v.pagina === 'home' && v.evento === 'arrivo');
  const voci = [
    [arrivi, 'visite alla pagina iniziale'],
    [conta((v) => v.evento === 'salta'), 'hanno saltato l\'introduzione'],
    [conta((v) => v.evento === 'fine-percorso'), 'sono arrivati in fondo al viaggio'],
    [conta((v) => v.pagina === 'chi-siamo' && v.evento === 'arrivo'), 'visite a Chi siamo'],
    [conta((v) => v.pagina === 'articolo'), 'letture di articoli'],
    [conta((v) => v.evento === 'richiesta-tessera'), 'richieste di tessera dal sito'],
    [arrivi ? Math.round((100 * conta((v) => v.pagina === 'home' && v.evento === 'arrivo' && v.telefono)) / arrivi) + '%' : '0%', 'delle visite da telefono'],
  ];
  const giorni = [];
  for (let i = 29; i >= 0; i--) {
    const g = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    giorni.push([g, data.filter((v) => v.evento === 'arrivo' && v.creato.slice(0, 10) === g).length]);
  }
  const max = Math.max(1, ...giorni.map((g) => g[1]));
  $('#s-box').innerHTML = `<div class="numeri">${voci.map(([n, t]) => `<div><b>${n}</b><span>${t}</span></div>`).join('')}</div>
    <h2 style="font-size:18px;margin-bottom:12px">Visite al giorno</h2>
    <div class="giorni">${giorni.map(([g, n]) => `<i style="height:${(100 * n) / max}%" data-t="${new Date(g).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}: ${n}"></i>`).join('')}</div>`;
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
