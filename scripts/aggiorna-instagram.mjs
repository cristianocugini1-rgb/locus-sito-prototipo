// Scarica gli ultimi post di @locus_parma e scrive public/instagram.json con le immagini in public/ig/.
// Gira prima di ogni pubblicazione (vedi .github/workflows/pages.yml), anche da sola ogni sei ore.
// Serve il token dell'API di Instagram (account professionale + app Meta), salvato come segreto IG_TOKEN.
// Senza token non fa nulla e resta la copia di riserva.
import { mkdir, writeFile, rm } from 'node:fs/promises';

const TOKEN = process.env.IG_TOKEN;
const N = 12;
if (!TOKEN) { console.log('IG_TOKEN assente: resta la copia di riserva di instagram.json'); process.exit(0); }

const api = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${N}&access_token=${TOKEN}`;
try {
  const res = await fetch(api);
  if (!res.ok) throw new Error(`Instagram ha risposto ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  await rm('public/ig', { recursive: true, force: true });
  await mkdir('public/ig', { recursive: true });
  const post = [];
  for (const m of data) {
    const src = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
    if (!src) continue;
    const r = await fetch(src);
    if (!r.ok) continue;
    const file = `ig/${m.id}.jpg`;
    await writeFile(`public/${file}`, Buffer.from(await r.arrayBuffer()));
    const caption = (m.caption || '').split('\n')[0].slice(0, 140);
    post.push({ img: file, alt: caption || 'Post di @locus_parma', caption, link: m.permalink, data: m.timestamp, video: m.media_type === 'VIDEO' });
  }
  if (!post.length) throw new Error('nessun post scaricato');
  await writeFile('public/instagram.json', JSON.stringify({ aggiornato: new Date().toISOString(), post }, null, 2));
  console.log(`instagram.json aggiornato con ${post.length} post`);
  // il token dura 60 giorni: lo si rinnova a ogni giro (va rinnovato almeno una volta ogni 60 giorni)
  await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${TOKEN}`).catch(() => {});
} catch (e) {
  // se Instagram non risponde, la pubblicazione va avanti con la copia di riserva
  console.warn('Aggiornamento Instagram non riuscito:', e.message);
}
