// Le schede dei format che si aprono al clic.
// Fonti: Locus_Pitch_stakeholder.pdf (ottobre 2026) e le didascalie dei post Instagram già usate nella cronologia.
// Ogni numero ha la sua fonte: se se ne aggiunge uno, va aggiunta anche quella.
const B = import.meta.env.BASE_URL;
const img = (f) => `${B}img/${f}`;

export const FORMATI = {
  meetup: {
    kicker: 'Il primo sabato del mese',
    title: 'Il Meet Up',
    lead: "La porta d'ingresso di Locus: un appuntamento al mese, aperto a tutti.",
    about: "Il Meet Up è l'appuntamento da cui si entra in Locus. Il primo sabato del mese, aperto a tutti: ci si conosce, si lavora ai tavoli insieme ai soci e chi vuole resta.",
    cover: img('meetup.jpg'),
    stepsTitle: 'Come funziona',
    steps: [
      ['Ci si conosce', 'Locus si presenta a chi arriva per la prima volta: chi siamo, cosa facciamo, come si partecipa.'],
      ['Si lavora insieme', 'Soci e nuovi arrivati si dividono in tavoli di lavoro e chiudono le attività nella stessa giornata.'],
      ['Si resta', 'Chi vuole si tessera, entra tra i volontari o propone un progetto coerente con la missione di Locus.'],
    ],
    quote: "È il passaggio tra chi ci segue e chi costruisce Locus: qui chi arriva da Instagram o da un format diventa parte della comunità.",
    dates: [
      ['7 novembre 2026', 'Meet Up: Conosci. Incontra. Costruisci.', 'Sala Civica Cittadella, via Antonio Bizzozero 15.'],
    ],
    photos: [img('meetup.jpg'), img('evento-tavoli.jpg'), img('collage-locus.jpg')],
    source: 'Fonte: Locus, presentazione agli stakeholder, ottobre 2026 · post Instagram @locus_parma',
    cta: [['Gli appuntamenti', '#futuro'], ['Tesserati', '#tesserati']],
  },

  bolla: {
    kicker: '150 persone a serata',
    title: 'La Grande Bolla',
    lead: 'Conversazioni urbane per uscire dalla propria bolla. Una serata in cinque tempi.',
    about: 'La Grande Bolla è una serata di conversazioni urbane. Persone che di solito non si incontrano si siedono allo stesso tavolo, discutono un tema, ascoltano tre ospiti sul palco e poi prendono il microfono.',
    cover: img('ospiti-bolla.jpg'),
    stepsTitle: 'Una serata in cinque tempi',
    steps: [
      ['Un tema per sera', ''],
      ['I tavoli', 'Persone che di solito non si incontrano, ognuno con un facilitatore.'],
      ['Il menù', 'Tre posizioni semplificate da cui partire.'],
      ['Il palco', 'Tre ospiti e un moderatore.'],
      ['Il microfono', 'Gira in sala.'],
    ],
    numbers: [
      ['6', "edizioni l'anno"],
      ['150', 'persone a serata'],
      ['1.500', 'presenze in dieci edizioni'],
    ],
    dates: [
      ['26 febbraio 2026', 'Il Perdono', 'Borgo Santa Brigida 5/A.'],
      ['23 aprile 2026', 'Libertà', '"Pensati libero. Poi iscriviti." Borgo Santa Brigida 5/a.'],
      ['25 giugno 2026', 'Vol. 10: La Bellezza', 'Da Avèrt, al Parco Vero Pellegrini.'],
      ['29 ottobre 2026', 'Vol. 11: Il Cibo', 'Ospiti di The Hub.'],
    ],
    photos: [img('locandina-perdono.jpg'), img('locandina-liberta.jpg'), img('locandina-bellezza.jpg'), img('locandina-cibo.jpg'), img('tavoli-cibo.jpg'), img('grazie-bolla-11.jpg'), img('evento-palco.jpg')],
    source: 'Fonte: Locus, presentazione agli stakeholder, ottobre 2026 (numeri) · post Instagram @locus_parma (date e luoghi)',
    cta: [['Gli appuntamenti', '#futuro'], ['Gli eventi passati', '#eventi']],
  },

  debate: {
    kicker: 'Da novembre 2026',
    title: 'Speed Debate',
    lead: 'Conoscersi discutendo, dopocena, a tavolini da due.',
    about: 'Lo Speed Debate è un modo di conoscersi discutendo. Dopocena, a tavolini da due: a ogni round cambi persona e prendi posizione su una domanda.',
    cover: img('evento-tavoli.jpg'),
    numbersList: true,
    numbersTitle: 'Le regole',
    numbers: [
      ['0', "telefoni in vista: all'ingresso li mascheriamo"],
      ['1', 'carta per round, con una domanda su cui prendere posizione'],
      ['2', 'ospiti con idee opposte si sfidano sul palco, alla fine'],
      ['3', 'round da 15 minuti, ognuno con una persona nuova'],
    ],
    photos: [img('evento-tavoli.jpg'), img('serata-schermo.jpg')],
    source: 'Fonte: Locus, presentazione agli stakeholder, ottobre 2026',
    cta: [['Gli appuntamenti', '#futuro']],
  },

  giovedi: {
    kicker: 'Serate aperte',
    title: 'Il Giovedì del Locus',
    lead: 'Una serata senza fretta, per conoscersi e ritrovarsi. Musica, ospiti, e tante birrette insieme.',
    about: 'Il Giovedì del Locus è la serata più informale: musica, ospiti e birre, per conoscersi e ritrovarsi senza fretta.',
    cover: img('giovedi-talk-drinks.jpg'),
    dates: [
      ['19 marzo 2026', 'Il primo Giovedì del Locus', 'La serata del lancio. Borgo Santa Brigida 5A.'],
      ['Primavera 2026', 'Al Bar AlRovescio', 'Al circolo Raquette, con The Parmigianer e il jazz dal vivo.'],
    ],
    photos: [img('primo-giovedi.jpg'), img('giovedi-talk-drinks.jpg'), img('strada-parma.jpg')],
    source: 'Fonte: post Instagram @locus_parma',
    cta: [['Gli appuntamenti', '#futuro'], ['Seguici su Instagram', 'https://www.instagram.com/locus_parma/']],
  },
};
