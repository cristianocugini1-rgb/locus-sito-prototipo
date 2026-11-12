// La pagina Diario: tutti gli articoli pubblicati dal gestionale, dal più recente.
import { leggi, segnala, indirizzoCopertina } from './dati.js';
import { esc, dataItaliana } from './testo.js';

segnala('diario', 'arrivo');
const griglia = document.getElementById('griglia');

leggi('articoli?select=titolo,slug,sommario,copertina,pubblicato_il&stato=eq.pubblicato&order=pubblicato_il.desc')
  .then((articoli) => {
    if (!articoli.length) return (griglia.innerHTML = '<p class="attesa">Il diario è ancora vuoto: il primo articolo arriva presto.</p>');
    griglia.innerHTML = articoli.map((a) => `
      <a class="articolo" href="articolo.html?a=${encodeURIComponent(a.slug)}">
        ${a.copertina ? `<span class="cop"><img src="${indirizzoCopertina(a.copertina)}" alt="" loading="lazy" /></span>` : ''}
        <time>${dataItaliana(a.pubblicato_il)}</time>
        <h2>${esc(a.titolo)}</h2>
        ${a.sommario ? `<p>${esc(a.sommario)}</p>` : ''}
      </a>`).join('');
  })
  .catch(() => (griglia.innerHTML = '<p class="attesa">Il diario non si carica in questo momento. Riprova tra poco.</p>'));
