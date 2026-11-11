// Il testo degli articoli si scrive con pochi segni semplici e diventa HTML sicuro:
//   ## titoletto        **grassetto**        *corsivo*        [parole](https://indirizzo)
//   - voce di elenco     > citazione          riga vuota = nuovo paragrafo
// Tutto il resto viene mostrato così com'è: niente HTML scritto a mano, così nessuno può inserire codice.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function inHtml(testo) {
  const blocchi = String(testo || '').replace(/\r/g, '').split(/\n{2,}/);
  return blocchi.map((b) => {
    const righe = b.split('\n').filter((r) => r.trim());
    if (!righe.length) return '';
    if (righe[0].startsWith('## ')) return `<h2>${inline(righe[0].slice(3))}</h2>` + (righe.length > 1 ? `<p>${righe.slice(1).map(inline).join('<br>')}</p>` : '');
    if (righe.every((r) => /^- /.test(r))) return `<ul>${righe.map((r) => `<li>${inline(r.slice(2))}</li>`).join('')}</ul>`;
    if (righe.every((r) => /^> ?/.test(r))) return `<blockquote>${righe.map((r) => inline(r.replace(/^> ?/, ''))).join('<br>')}</blockquote>`;
    return `<p>${righe.map(inline).join('<br>')}</p>`;
  }).join('\n');
}

export const dataItaliana = (d) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
export { esc };
