// Dal 18/11/2026, gira dopo "vite build" a ogni pubblicazione (anche quella automatica ogni sei ore).
// Scrive in dist:
//   - articoli/<indirizzo>/index.html: una pagina per articolo con titolo, foto e testo già dentro, così Google
//     e le anteprime di WhatsApp, Instagram e Facebook vedono l'articolo vero (il Diario lo carica dopo, e loro
//     non lo vedono). Chi la apre viene portato subito al Diario sfogliabile, sulla pagina di quell'articolo.
//   - sitemap.xml e robots.txt, per dire a Google quali pagine esistono.
// Gli articoli di prova (indirizzo che inizia con "prova-") restano fuori. Se l'archivio non risponde la
// pubblicazione va avanti lo stesso, senza pagine degli articoli.
// L'indirizzo del sito si cambia qui sotto (o con SITO_URL) quando ci sarà il dominio vero.

import { mkdir, writeFile } from 'node:fs/promises';
import { inHtml, esc, dataItaliana } from '../src/testo.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../src/dati.js';

const SITO = (process.env.SITO_URL || 'https://cristianocugini1-rgb.github.io/locus-sito-prototipo/').replace(/\/?$/, '/');
const DIST = new URL('../dist/', import.meta.url);
const oggi = new Date().toISOString().slice(0, 10);

const copertina = (nome) => (!nome ? `${SITO}anteprima-social.jpg` : nome.startsWith('img/') ? SITO + nome
  : `${SUPABASE_URL}/storage/v1/object/public/copertine/${encodeURIComponent(nome)}`);
const piano = (t) => String(t || '').replace(/[#*>\[\]]|\(https?:[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
const breve = (t, max = 160) => (t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, '') + '…');

async function articoli() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/articoli?select=titolo,slug,sommario,testo,copertina,pubblicato_il&stato=eq.pubblicato&order=pubblicato_il.asc`,
      { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) throw new Error(`stato ${r.status}`);
    return (await r.json()).filter((a) => /^[a-z0-9-]{1,120}$/.test(a.slug) && !a.slug.startsWith('prova-'));
  } catch (e) {
    console.warn(`pagine-statiche: articoli non letti (${e.message}), si pubblica senza`);
    return [];
  }
}

function pagina(a) {
  const url = `${SITO}articoli/${a.slug}/`;
  const descr = breve(piano(a.sommario || a.testo));
  const img = copertina(a.copertina);
  const dati = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.titolo, description: descr, image: img,
    datePublished: a.pubblicato_il, inLanguage: 'it', mainEntityOfPage: url,
    publisher: { '@type': 'Organization', name: 'Locus', url: SITO, logo: `${SITO}img/logo-locus-bianco.png` },
  };
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#2b0d0c" />
  <title>${esc(a.titolo)} · Locus</title>
  <meta name="description" content="${esc(descr)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="it_IT" />
  <meta property="og:site_name" content="Locus" />
  <meta property="og:title" content="${esc(a.titolo)}" />
  <meta property="og:description" content="${esc(descr)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${esc(img)}" />
  <meta property="article:published_time" content="${esc(a.pubblicato_il || '')}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(dati).replace(/</g, '\\u003c')}</script>
  <script>location.replace('../../diario.html?a=${a.slug}');</script>
  <style>body{margin:0;background:#F5E4CB;color:#2b0d0c;font:18px/1.6 Georgia,serif}main{max-width:40rem;margin:auto;padding:3rem 1.25rem}h1{color:#800200;line-height:1.15}img{max-width:100%;height:auto}a{color:#800200}</style>
</head>
<body>
  <main>
    <p><a href="../../diario.html?a=${a.slug}">Leggi nel Diario di Locus</a></p>
    <h1>${esc(a.titolo)}</h1>
    <p><time datetime="${esc(a.pubblicato_il || '')}">${a.pubblicato_il ? dataItaliana(a.pubblicato_il) : ''}</time></p>
    <img src="${esc(img)}" alt="${esc(a.titolo)}" />
    ${a.sommario ? `<p><em>${esc(a.sommario)}</em></p>` : ''}
    ${inHtml(a.testo)}
  </main>
</body>
</html>
`;
}

const lista = await articoli();
for (const a of lista) {
  const cartella = new URL(`articoli/${a.slug}/`, DIST);
  await mkdir(cartella, { recursive: true });
  await writeFile(new URL('index.html', cartella), pagina(a));
}

const voci = [
  ['', oggi], ['chi-siamo.html', oggi], ['diario.html', oggi],
  ...lista.map((a) => [`articoli/${a.slug}/`, String(a.pubblicato_il || oggi).slice(0, 10)]),
];
await writeFile(new URL('sitemap.xml', DIST), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${voci.map(([p, d]) => `  <url><loc>${SITO}${p}</loc><lastmod>${d}</lastmod></url>`).join('\n')}
</urlset>
`);
await writeFile(new URL('robots.txt', DIST), `User-agent: *
Disallow: /gestione.html
Disallow: /test-audio.html
Sitemap: ${SITO}sitemap.xml
`);
console.log(`pagine-statiche: ${lista.length} articoli, sitemap con ${voci.length} indirizzi`);
