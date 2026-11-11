// La pagina di un articolo del diario: legge l'articolo pubblicato dal gestionale e lo impagina.
import { leggi, segnala, indirizzoCopertina } from './dati.js';
import { inHtml, esc, dataItaliana } from './testo.js';

segnala('articolo', 'arrivo');
const pezzo = document.getElementById('pezzo');
const slug = new URLSearchParams(location.search).get('a') || '';

const nonTrovato = () => {
  pezzo.innerHTML = '<p class="attesa">Questo articolo non c\'è più, oppure l\'indirizzo è sbagliato.</p><p><a class="torna" href="chi-siamo.html#diario">&larr; torna al diario</a></p>';
};

if (!/^[a-z0-9-]{1,120}$/.test(slug)) nonTrovato();
else {
  leggi(`articoli?select=titolo,sommario,testo,copertina,pubblicato_il&slug=eq.${slug}&stato=eq.pubblicato&limit=1`)
    .then(([a]) => {
      if (!a) return nonTrovato();
      document.title = `${a.titolo} · Locus`;
      if (a.sommario) document.querySelector('meta[name=description]').setAttribute('content', a.sommario);
      pezzo.innerHTML = `
        <time>${dataItaliana(a.pubblicato_il)}</time>
        <h1>${esc(a.titolo)}</h1>
        ${a.sommario ? `<p class="sommario">${esc(a.sommario)}</p>` : ''}
        ${a.copertina ? `<figure class="cop"><img src="${indirizzoCopertina(a.copertina)}" alt="" /></figure>` : ''}
        <div class="corpo">${inHtml(a.testo)}</div>`;
    })
    .catch(nonTrovato);
}
