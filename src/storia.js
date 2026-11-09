// Tasti avanti e indietro, uguali in tutte le pagine, e ritorno pulito quando il browser
// riprende una pagina dalla sua memoria (tasto indietro): il velo scuro dell'uscita si toglie.

const css = `
#storia { position: fixed; left: 22px; bottom: calc(22px + env(safe-area-inset-bottom)); z-index: 58; display: flex; gap: 6px; }
#storia button {
  width: 40px; height: 40px; display: grid; place-items: center; padding: 0;
  background: rgba(20, 4, 4, .45); border: 1px solid rgba(245, 228, 203, .28); border-radius: 50%;
  color: #f5e4cb; font: 400 18px/1 'Cormorant Garamond', Georgia, serif;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  opacity: .75; transition: opacity .4s, background .4s, border-color .4s;
}
#storia button:hover { opacity: 1; background: rgba(128, 2, 0, .55); border-color: rgba(245, 228, 203, .6); }
#storia button:disabled { opacity: .2; pointer-events: none; }
@media (max-width: 700px) { #storia { left: 14px; bottom: calc(14px + env(safe-area-inset-bottom)); } #storia button { width: 36px; height: 36px; } }
`;

export function storia({ prima } = {}) {
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  const box = document.createElement('nav');
  box.id = 'storia';
  box.setAttribute('aria-label', 'cronologia');
  box.innerHTML = '<button type="button" data-h="-1" aria-label="indietro">‹</button><button type="button" data-h="1" aria-label="avanti">›</button>';
  document.body.appendChild(box);
  const [back, fwd] = box.querySelectorAll('button');

  // dove il browser lo dice (Chrome, Edge), il tasto si spegne se non c'è una pagina in quella direzione
  const nav = window.navigation;
  const sync = () => {
    if (!nav || !('canGoBack' in nav)) return;
    back.disabled = !nav.canGoBack;
    fwd.disabled = !nav.canGoForward;
  };
  sync();
  nav?.addEventListener?.('currententrychange', sync);

  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    prima?.();
    history.go(Number(b.dataset.h));
  });
  addEventListener('pageshow', (e) => {
    sync();
    if (!e.persisted) return;
    document.getElementById('veil')?.classList.remove('on', 'leave');
  });
}

// la pagina è stata aperta col tasto indietro o avanti del browser?
export const daStoria = () => performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
