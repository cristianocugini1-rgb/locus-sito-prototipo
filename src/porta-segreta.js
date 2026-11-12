// Porta segreta del gestionale: tenendo premuta la scritta Locus della seconda pagina per 4 secondi la pagina si disturba come un televisore
// senza segnale, si sfoca, scende nel nero e si apre gestione.html. Sul sito non c'è nessun segno visibile.

export const PORTA_ATTESA = 4000; // millisecondi di pressione
const DURATA = 1700;              // durata del disturbo fino al nero

let aperta = false;

export function apriPortaSegreta() {
  if (aperta) return;
  aperta = true;

  const velo = document.createElement('div');
  velo.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:all;overflow:hidden';
  const neve = document.createElement('canvas');
  neve.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;mix-blend-mode:screen';
  const nero = document.createElement('div');
  nero.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0';
  velo.append(neve, nero);
  // fuori dal body, così la sfocatura della pagina non tocca il velo
  document.documentElement.append(velo);

  // la neve si disegna a bassa risoluzione e si allarga: grana grossa come un vecchio televisore
  const W = 240, H = Math.max(120, Math.round(240 * innerHeight / innerWidth));
  neve.width = W; neve.height = H;
  const g = neve.getContext('2d');
  const img = g.createImageData(W, H);
  const px = img.data;

  const corpo = document.body;
  corpo.style.willChange = 'filter, transform';
  const t0 = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - t0) / DURATA);

    // neve: rumore con bande orizzontali che scorrono, più chiare in una fascia che sale
    const fascia = (now * 0.12) % H;
    for (let y = 0; y < H; y++) {
      const banda = Math.abs(y - (H - fascia)) < 6 ? 70 : 0;
      const riga = Math.random() < 0.04 ? 60 : 0;
      for (let x = 0; x < W; x++) {
        const v = Math.min(255, Math.random() * 200 + banda + riga);
        const i = (y * W + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = v;
        px[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);

    // la pagina sotto: sfocatura crescente, scatti orizzontali e righe che saltano
    const salto = Math.random() < 0.35 ? (Math.random() - 0.5) * 40 * t : 0;
    corpo.style.filter = `blur(${(t * 10).toFixed(1)}px) contrast(${1 + t * 0.6}) saturate(${1 - t * 0.8})`;
    corpo.style.transform = `translateX(${salto.toFixed(1)}px) scaleY(${1 - t * 0.04})`;

    neve.style.opacity = String(Math.min(0.85, t * 1.6) * (1 - Math.max(0, t - 0.75) * 2));
    nero.style.opacity = String(Math.max(0, (t - 0.35) / 0.65));

    if (t < 1) requestAnimationFrame(frame);
    else location.href = 'gestione.html';
  }
  requestAnimationFrame(frame);

  // tornando indietro col browser la pagina può riapparire dalla cache: la ripulisco
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    velo.remove();
    corpo.style.filter = corpo.style.transform = corpo.style.willChange = '';
    aperta = false;
  }, { once: true });
}
