'use strict';
/* Eclyra — WebAudio ile üretilen ses efektleri ve müzik (dosya yok, hepsi sentez) */
(() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  const vol = { master: 0.8, music: 0.55, sfx: 0.8 };

  function init() {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    // gürültü tamponu
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
  }
  function applyVol() { if (!ctx) return; master.gain.value = vol.master; sfxBus.gain.value = vol.sfx; musicBus.gain.value = vol.music * 0.5; }

  E.audio = {
    init, unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setVolume(k, v) { vol[k] = v; applyVol(); },
    get vol() { return vol; }
  };

  // ---------------- temel sesler ----------------
  function tone(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.dur || 0.1));
    const v = (o.v || 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.1));
    let node = osc;
    if (o.filter) { const f = ctx.createBiquadFilter(); f.type = o.filterType || 'lowpass'; f.frequency.value = o.filter; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + (o.dur || 0.1) + 0.05);
  }
  function noise(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.v || 0.3, t + (o.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
  }

  const last = {};
  const SFX = {
    swing: () => noise({ f: 2400, f2: 900, dur: 0.09, v: 0.22, q: 1.5 }),
    swing2: () => { noise({ f: 2000, f2: 500, dur: 0.14, v: 0.3, q: 1.2 }); tone({ f: 180, f2: 90, dur: 0.12, v: 0.08, type: 'triangle' }); },
    hit: () => { noise({ f: 900, dur: 0.06, v: 0.25, q: 0.8 }); tone({ f: 160, f2: 70, dur: 0.07, v: 0.15, type: 'square', filter: 900 }); },
    crit: () => { noise({ f: 1400, dur: 0.08, v: 0.3 }); tone({ f: 880, f2: 1320, dur: 0.08, v: 0.08, type: 'square' }); },
    hurt: () => { tone({ f: 220, f2: 90, dur: 0.18, v: 0.22, type: 'sawtooth', filter: 1200 }); noise({ f: 500, dur: 0.12, v: 0.2 }); },
    die: () => { noise({ f: 700, f2: 150, dur: 0.25, v: 0.25 }); tone({ f: 300, f2: 60, dur: 0.22, v: 0.1, type: 'square', filter: 800 }); },
    bossdie: () => { for (let i = 0; i < 5; i++) noise({ f: 400 - i * 50, dur: 0.5, v: 0.3, delay: i * 0.12 }); tone({ f: 120, f2: 30, dur: 1.2, v: 0.3, type: 'sawtooth', filter: 500 }); },
    dash: () => noise({ f: 1500, f2: 3000, dur: 0.12, v: 0.15, ft: 'highpass' }),
    fire: () => { noise({ f: 600, f2: 1800, dur: 0.2, v: 0.2 }); tone({ f: 200, f2: 400, dur: 0.15, v: 0.06, type: 'sawtooth' }); },
    ice: () => { for (let i = 0; i < 4; i++) tone({ f: 1800 + i * 300, dur: 0.15, v: 0.05, type: 'sine', delay: i * 0.03 }); noise({ f: 4000, dur: 0.3, v: 0.15, ft: 'highpass' }); },
    zap: () => { noise({ f: 3000, dur: 0.18, v: 0.25, q: 0.5 }); tone({ f: 90, dur: 0.15, v: 0.12, type: 'square' }); },
    shield: () => { tone({ f: 440, f2: 880, dur: 0.3, v: 0.1, type: 'sine' }); tone({ f: 660, f2: 1320, dur: 0.3, v: 0.06, type: 'sine', delay: 0.05 }); },
    boom: () => { noise({ f: 300, f2: 60, dur: 0.4, v: 0.4, ft: 'lowpass' }); tone({ f: 90, f2: 30, dur: 0.3, v: 0.2, type: 'sine' }); },
    slam: () => { noise({ f: 200, f2: 50, dur: 0.35, v: 0.45, ft: 'lowpass' }); tone({ f: 70, f2: 30, dur: 0.3, v: 0.3, type: 'sine' }); },
    coin: () => { tone({ f: 1320, dur: 0.06, v: 0.07, type: 'square' }); tone({ f: 1760, dur: 0.1, v: 0.07, type: 'square', delay: 0.05 }); },
    pickup: () => { tone({ f: 660, dur: 0.07, v: 0.1, type: 'triangle' }); tone({ f: 990, dur: 0.12, v: 0.1, type: 'triangle', delay: 0.06 }); },
    rare: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.18, v: 0.09, type: 'triangle', delay: i * 0.07 })); },
    legend: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ f, dur: 0.3, v: 0.1, type: 'square', filter: 3000, delay: i * 0.08 })); },
    potion: () => { tone({ f: 300, f2: 900, dur: 0.25, v: 0.12, type: 'sine' }); noise({ f: 800, dur: 0.2, v: 0.08 }); },
    levelup: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.25, v: 0.12, type: 'square', filter: 2500, delay: i * 0.09 })); },
    ui: () => tone({ f: 880, dur: 0.04, v: 0.06, type: 'square', filter: 2000 }),
    uiok: () => { tone({ f: 660, dur: 0.06, v: 0.08, type: 'square', filter: 2000 }); tone({ f: 990, dur: 0.08, v: 0.08, type: 'square', filter: 2000, delay: 0.05 }); },
    uino: () => tone({ f: 180, dur: 0.12, v: 0.1, type: 'square', filter: 900 }),
    anvil: () => { tone({ f: 1200, dur: 0.4, v: 0.12, type: 'triangle' }); tone({ f: 1790, dur: 0.3, v: 0.06, type: 'sine' }); noise({ f: 3000, dur: 0.05, v: 0.2 }); },
    portal: () => { tone({ f: 200, f2: 800, dur: 0.6, v: 0.12, type: 'sine' }); tone({ f: 300, f2: 1200, dur: 0.6, v: 0.06, type: 'triangle', delay: 0.1 }); },
    roar: () => { noise({ f: 300, f2: 120, dur: 0.8, v: 0.35, q: 2 }); tone({ f: 110, f2: 60, dur: 0.8, v: 0.25, type: 'sawtooth', filter: 600 }); },
    eswing: () => noise({ f: 1200, f2: 400, dur: 0.12, v: 0.18 }),
    charge: () => tone({ f: 120, f2: 260, dur: 0.4, v: 0.12, type: 'sawtooth', filter: 900 }),
    bow: () => { tone({ f: 500, f2: 200, dur: 0.08, v: 0.08, type: 'triangle' }); noise({ f: 3000, dur: 0.06, v: 0.08 }); },
    ecast: () => tone({ f: 520, f2: 260, dur: 0.18, v: 0.08, type: 'triangle' }),
    blink: () => tone({ f: 1200, f2: 300, dur: 0.15, v: 0.08, type: 'sine' }),
    fuse: () => { for (let i = 0; i < 4; i++) tone({ f: 1000, dur: 0.05, v: 0.06, type: 'square', delay: i * 0.15 }); },
    slime: () => tone({ f: 180, f2: 320, dur: 0.12, v: 0.08, type: 'sine' }),
    step: () => noise({ f: 400, dur: 0.04, v: 0.04, ft: 'lowpass' }),
    door: () => { tone({ f: 330, dur: 0.3, v: 0.1, type: 'triangle' }); tone({ f: 494, dur: 0.4, v: 0.1, type: 'triangle', delay: 0.12 }); }
  };
  E.sfx = (name, v) => {
    if (!ctx || !SFX[name]) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.03) return; // aynı anda üst üste binmesin
    last[name] = now;
    SFX[name](v);
  };

  // ---------------- MÜZİK ----------------
  // Pentatonik, prosedürel: her bölge için farklı mod ve tempo
  const SONGS = [
    { name: 'Köy', bpm: 84, root: 62, scale: [0, 2, 4, 7, 9], lead: 'triangle', pad: true, drums: 0.3 },
    { name: 'Orman', bpm: 96, root: 57, scale: [0, 2, 3, 7, 9], lead: 'square', pad: true, drums: 0.6 },
    { name: 'Derin', bpm: 88, root: 55, scale: [0, 1, 5, 7, 8], lead: 'triangle', pad: true, drums: 0.5 },
    { name: 'Kızıl', bpm: 104, root: 52, scale: [0, 1, 5, 7, 10], lead: 'square', pad: true, drums: 0.8 },
    { name: 'Buz', bpm: 80, root: 64, scale: [0, 2, 5, 7, 9], lead: 'sine', pad: true, drums: 0.3 },
    { name: 'Hiçlik', bpm: 72, root: 50, scale: [0, 1, 3, 6, 8], lead: 'sawtooth', pad: true, drums: 0.4 },
    { name: 'Boss', bpm: 138, root: 50, scale: [0, 1, 3, 5, 7, 8], lead: 'square', pad: false, drums: 1 },
    { name: 'Başlık', bpm: 70, root: 60, scale: [0, 2, 4, 7, 9], lead: 'sine', pad: true, drums: 0 }
  ];
  const BIOME_SONG = [1, 2, 3, 2, 3, 4, 3, 4, 3, 5];
  let cur = null, nextT = 0, step = 0, seqRng = null, timer = null, phrase = [];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function schedule() {
    if (!ctx || cur == null) return;
    const S = SONGS[cur];
    const spb = 60 / S.bpm / 2; // sekizlik
    while (nextT < ctx.currentTime + 0.25) {
      const s = step % 32;
      if (s === 0) { // yeni cümle
        phrase = [];
        let deg = seqRng.int(0, S.scale.length - 1);
        for (let i = 0; i < 16; i++) { deg = E.clamp(deg + seqRng.pick([-2, -1, -1, 0, 1, 1, 2]), 0, S.scale.length * 2 - 1); phrase.push(seqRng() < (cur === 6 ? 0.85 : 0.55) ? deg : -1); }
      }
      const t = nextT;
      const deg = phrase[s % 16];
      if (deg >= 0 && s % 2 === 0) {
        const m = S.root + 12 + S.scale[deg % S.scale.length] + 12 * Math.floor(deg / S.scale.length);
        toneAt(t, mtof(m), spb * (cur === 6 ? 1.6 : 2.6), S.lead, cur === 6 ? 0.05 : 0.045);
      }
      if (s % 8 === 0) { // bas
        const chord = [0, 0, 3, 4][Math.floor(s / 8)] ;
        const m = S.root - 12 + S.scale[chord % S.scale.length];
        toneAt(t, mtof(m), spb * 7, 'triangle', 0.08);
        if (S.pad) { toneAt(t, mtof(m + 12), spb * 8, 'sine', 0.025); toneAt(t, mtof(m + 19), spb * 8, 'sine', 0.018); }
      }
      if (S.drums) {
        if (s % 8 === 0 || (cur === 6 && s % 4 === 0)) kickAt(t, 0.2 * S.drums);
        if (s % 8 === 4) noiseAt(t, 0.08 * S.drums, 1800);
        if (s % 2 === 1 && cur === 6) noiseAt(t, 0.03, 7000);
      }
      nextT += spb; step++;
    }
  }
  function toneAt(t, f, dur, type, v) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function kickAt(t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25); }
  function noiseAt(t, v, f) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); s.connect(fl); fl.connect(g); g.connect(musicBus); s.start(t, Math.random() * 0.5); s.stop(t + 0.1); }

  E.music = {
    play(which) {
      init();
      if (!ctx) return;
      let id = which;
      if (typeof which === 'string') id = { village: 0, boss: 6, title: 7 }[which];
      if (id === cur) return;
      cur = id; step = 0; nextT = ctx.currentTime + 0.1; seqRng = E.RNG(1234 + id * 77);
      if (!timer) timer = setInterval(schedule, 100);
    },
    biome(fl) { E.music.play(BIOME_SONG[Math.min(9, Math.floor((fl - 1) / 10))]); },
    stop() { cur = null; }
  };
})();
