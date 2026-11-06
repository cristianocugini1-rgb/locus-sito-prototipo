// Tappeto sonoro generato nel browser: niente file audio, niente diritti.
// Un pad caldo che cambia accordo lentamente, campanelle rade, un respiro di rumore.
// dissolve() lo fa svanire dentro il riverbero quando si lascia la pagina.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Re minore, tonalità calda e un po' malinconica
const CHORDS = [
  [50, 57, 60, 64, 65], // Rem9
  [46, 53, 57, 62, 65], // Sib maj7
  [45, 53, 60, 64, 67], // Fa maj7 / La
  [43, 50, 58, 62, 69], // Solm9
];
const BELLS = [74, 76, 77, 79, 81, 84, 86];

export class Ambient {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.muted = false;
    this.chordIdx = 0;
  }

  start() {
    if (this.ctx) return;
    // su iPhone fa suonare il sito anche con il tasto silenzioso attivo
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext;
    // 48 kHz fisso: alcune schede audio lavorano a 192 kHz e il riverbero diventerebbe troppo pesante
    let c0;
    try { c0 = new AC({ sampleRate: 48000, latencyHint: 'playback' }); } catch (e) { c0 = new AC(); }
    const ctx = (this.ctx = c0);
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    // compressore finale: porta il volume a un livello udibile anche dalle casse di un portatile
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.02;
    comp.release.value = 0.4;
    const makeup = ctx.createGain();
    makeup.gain.value = 2.6;
    comp.connect(makeup).connect(ctx.destination);
    this.out = makeup;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    // riverbero: risposta all'impulso generata, 6 secondi di coda
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(4.5, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.reverb.connect(this.wet).connect(this.master);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.6;
    this.dry.connect(this.master);

    // filtro che dà il colore: più chiuso è, più il suono è ovattato
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1300;
    this.filter.Q.value = 0.6;
    this.filter.connect(this.dry);
    this.filter.connect(this.reverb);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 420;
    lfo.connect(lfoAmt).connect(this.filter.frequency);
    lfo.start();

    // cinque voci, ognuna con due oscillatori leggermente stonati tra loro
    this.voices = CHORDS[0].map((note) => {
      const g = ctx.createGain();
      g.gain.value = 0.075;
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = 'triangle';
      b.type = 'sawtooth';
      a.frequency.value = mtof(note + 12);
      b.frequency.value = mtof(note + 12);
      a.detune.value = -6;
      b.detune.value = 7;
      const bg = ctx.createGain();
      bg.gain.value = 0.35;
      a.connect(g);
      b.connect(bg).connect(g);
      g.connect(this.filter);
      a.start();
      b.start();
      return { a, b, g };
    });

    // basso morbido
    this.sub = ctx.createOscillator();
    this.sub.type = 'sine';
    this.sub.frequency.value = mtof(CHORDS[0][0]);
    const subG = ctx.createGain();
    subG.gain.value = 0.1;
    this.sub.connect(subG).connect(this.dry);
    this.sub.start();

    // aria: rumore filtrato, come una stanza viva
    const noise = ctx.createBufferSource();
    noise.buffer = this._noise(4);
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 900;
    nf.Q.value = 0.4;
    this.noiseG = ctx.createGain();
    this.noiseG.gain.value = 0.012;
    noise.connect(nf).connect(this.noiseG).connect(this.reverb);
    noise.start();

    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.7, now + 5);
    this.on = true;

    this._chordTimer = setInterval(() => this._nextChord(), 9000);
    this._bellLoop();
  }

  _nextChord() {
    const ctx = this.ctx;
    this.chordIdx = (this.chordIdx + 1) % CHORDS.length;
    const ch = CHORDS[this.chordIdx];
    const t = ctx.currentTime;
    this.voices.forEach((v, i) => {
      v.a.frequency.setTargetAtTime(mtof(ch[i] + 12), t, 1.4);
      v.b.frequency.setTargetAtTime(mtof(ch[i] + 12), t, 1.6);
    });
    this.sub.frequency.setTargetAtTime(mtof(ch[0]), t, 1.8);
  }

  _bellLoop() {
    if (!this.on) return;
    this.bell();
    this._bellTimer = setTimeout(() => this._bellLoop(), 2600 + Math.random() * 4800);
  }

  bell(gain = 0.09) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const note = BELLS[Math.floor(Math.random() * BELLS.length)];
    const o = ctx.createOscillator();
    const m = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = mtof(note);
    m.frequency.value = mtof(note) * 2.01;
    mg.gain.value = mtof(note) * 0.6;
    mg.gain.setTargetAtTime(0, t, 0.4);
    m.connect(mg).connect(o.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    o.connect(g);
    g.connect(this.reverb);
    g.connect(this.dry);
    o.start(t);
    m.start(t);
    o.stop(t + 4.6);
    m.stop(t + 4.6);
  }

  // passaggio dentro un anello: un soffio che si apre e si chiude
  whoosh() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise(2.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
    f.frequency.exponentialRampToValueAtTime(400, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    src.connect(f).connect(g);
    g.connect(this.reverb);
    g.connect(this.dry);
    src.start(t);
    this.bell(0.07);
  }

  // colore del suono per sezione, e un po' di apertura con la velocità di scroll
  setMood(brightness, velocity = 0) {
    if (!this.ctx) return;
    const f = 1000 + brightness * 1800 + Math.min(Math.abs(velocity), 40) * 25;
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.8);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.6);
  }

  // per quando la scheda va in secondo piano
  // quando si passa a un'altra scheda, finestra o programma: sfuma e si ferma; al ritorno riparte piano
  duck(away) {
    if (!this.ctx || this.leaving) return;
    const g = this.master.gain;
    const t = this.ctx.currentTime;
    clearTimeout(this._suspendTimer);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (away) {
      g.setTargetAtTime(0, t, 0.3);
      this._suspendTimer = setTimeout(() => this.ctx.suspend(), 1600);
    } else {
      this.ctx.resume();
      g.setTargetAtTime(this.muted ? 0 : 0.7, t, 1.0);
    }
  }

  // dissoluzione: il suono secco sparisce per primo, resta la coda del riverbero che si spegne
  dissolve(seconds = 3.6) {
    if (!this.ctx) return Promise.resolve();
    this.leaving = true;
    const t = this.ctx.currentTime;
    this.dry.gain.cancelScheduledValues(t);
    this.dry.gain.setTargetAtTime(0, t, seconds * 0.18);
    this.wet.gain.setTargetAtTime(0.9, t, 0.3);
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setTargetAtTime(140, t, seconds * 0.3);
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + seconds);
    clearTimeout(this._bellTimer);
    clearInterval(this._chordTimer);
    return new Promise((r) => setTimeout(r, seconds * 1000));
  }

  _noise(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // rumore scuro
      d[i] = last * 3.5;
    }
    return buf;
  }

  _impulse(sec, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
}
