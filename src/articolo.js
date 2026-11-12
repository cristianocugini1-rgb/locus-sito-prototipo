// Gli articoli ora si leggono dentro il Diario (diario.html?a=indirizzo).
// Questa pagina resta solo perché i link già condivisi continuino a funzionare: porta lì.
const slug = new URLSearchParams(location.search).get('a') || '';
location.replace(/^[a-z0-9-]{1,120}$/.test(slug) ? `diario.html?a=${slug}` : 'diario.html');
