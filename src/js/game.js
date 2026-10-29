'use strict';
/* Eclyra — oyun döngüsü, bölümler, kayıt, çizim */
(() => {
  const T = 16;
  E.view = { w: 480, h: 270, scale: 3 };

  // ---------------- kayıt ----------------
  const SAVE_KEY = 'eclyra-save-v1';
  E.storage = {
    async load() {
      try { if (window.eclyra && window.eclyra.load) { const s = await window.eclyra.load(); if (s) return JSON.parse(s); } } catch (e) {}
      try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
    },
    async save(data) {
      const s = JSON.stringify(data);
      try { if (window.eclyra && window.eclyra.save) { await window.eclyra.save(s); return; } } catch (e) {}
      try { localStorage.setItem(SAVE_KEY, s); } catch (e) {}
    }
  };

  E.newSave = () => ({
    version: 1, created: Date.now(), level: 1, xp: 0, gold: 40, ore: 0, souls: 0, potions: 3,
    maxFloor: 1, bosses: 0, equip: {
      silah: { id: 'start1', slot: 'silah', rarity: 0, level: 1, plus: 0, icon: 0, base: { dmg: 8 }, affixes: [], name: 'Tahta Katana' },
      zirh: { id: 'start2', slot: 'zirh', rarity: 0, level: 1, plus: 0, icon: 0, base: { hp: 18, def: 4 }, affixes: [], name: 'Öğrenci Haorisi' }
    },
    inv: [], spells: { ates: 1, buz: 0, yildirim: 0, ay: 0 }, story: -1, introSeen: false, ended: false,
    playTime: 0, kills: 0, deaths: 0, lastFloor: 1
  });
  E.INV_MAX = 32;

  // ---------------- oyun nesnesi ----------------
  const G = E.game = {
    save: null, L: null, settings: null, screen: 'title', overlay: null, time: 0, msg: [], fadeT: 0, fadeTo: null,
    hasSave: false
  };

  const DEFAULT_SETTINGS = { music: 0.55, sfx: 0.8, shake: true, numbers: true, fullscreen: false };
  function loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('eclyra-settings') || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
  }
  G.saveSettings = () => {
    try { localStorage.setItem('eclyra-settings', JSON.stringify(G.settings)); } catch (e) {}
    E.audio.setVolume('music', G.settings.music); E.audio.setVolume('sfx', G.settings.sfx);
  };

  let saveTimer = null;
  G.persist = (now) => {
    if (!G.save) return;
    clearTimeout(saveTimer);
    const run = () => E.storage.save(G.save);
    if (now) run(); else saveTimer = setTimeout(run, 400);
  };

  G.toast = (s, color = '#fff', icon = null) => { G.msg.push({ s, color, icon, t: 0, life: 3 }); if (G.msg.length > 5) G.msg.shift(); };

  // ---------------- seviye (alan) ----------------
  function makeLevel(opts) {
    const L = {
      village: !!opts.village, floor: opts.floor || 0, map: opts.map, save: G.save, settings: G.settings,
      enemies: [], eshots: [], pshots: [], pickups: [], particles: [], texts: [], rings: [], bolts: [], tele: [], hazards: [],
      boss: null, time: 0, shake: 0, hitstop: 0, hurtFlash: 0, exitOpen: false, state: 'play', cam: { x: 0, y: 0 }, weather: [],
      kills: 0, total: 0
    };
    L.player = new E.Player(L, opts.map.start.x, opts.map.start.y);
    L.cam.x = L.player.x - E.view.w / 2; L.cam.y = L.player.y - E.view.h / 2;
    L.onEnemyKilled = (e, noLoot) => onKill(L, e, noLoot);
    L.onPlayerDeath = () => onDeath(L);
    L.collect = p => collect(L, p);
    return L;
  }

  G.enterVillage = (from) => {
    const map = E.genVillage();
    E.renderVillage(map);
    G.L = makeLevel({ village: true, map });
    if (from === 'dungeon') { G.L.player.x = map.well.x; G.L.player.y = map.well.y + 26; }
    G.L.npcs = map.npcs.map(n => ({ ...n, anim: Math.random() * 6 }));
    G.L.cat = { x: 22 * T, y: 22 * T, t: 0, tx: 22 * T, ty: 22 * T };
    G.screen = 'play';
    E.music.play('village');
    G.save.lastFloor = Math.max(1, G.save.lastFloor || 1);
    G.persist(true);
  };

  G.enterFloor = (floor) => {
    floor = E.clamp(floor, 1, 100);
    const seed = (Date.now() ^ (floor * 7919)) >>> 0;
    const map = E.genDungeon(floor, seed);
    E.renderMap(map);
    const L = makeLevel({ floor, map });
    G.L = L;
    G.save.lastFloor = floor;
    populate(L, seed);
    G.screen = 'play';
    if (map.boss) E.music.play('boss'); else E.music.biome(floor);
    G.banner = { title: `${floor}. Basamak`, sub: map.biome.name + (map.boss ? ' — Mühürdar' : ''), t: 0 };
    E.sfx('portal');
    G.persist();
  };

  function populate(L, seed) {
    const m = L.map, rng = E.RNG(seed + 1), fl = L.floor, biome = m.biome;
    if (m.boss) {
      const idx = Math.floor(fl / 10) - 1;
      L.bossPending = { idx, x: m.bossSpot.x, y: m.bossSpot.y };
      L.total = 1;
      return;
    }
    const types = biome.enemies;
    const perRoom = 2 + Math.min(4, Math.floor(fl / 12));
    for (const r of m.rooms.slice(1)) {
      const n = perRoom + rng.int(0, 2) + (r.w * r.h > 110 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const p = m.randomFloor(rng, r);
        if (!p) continue;
        const type = rng.pick(types);
        const elite = rng() < 0.05 + Math.min(0.1, fl / 600);
        E.spawnEnemy(L, type, p.x, p.y, { elite });
      }
    }
    L.total = L.enemies.length;
    // kırılabilir vazolar
    L.breakables = [];
    for (const r of m.rooms.slice(1)) if (rng() < 0.5) {
      const p = m.randomFloor(rng, r);
      if (p) L.breakables.push({ x: p.x, y: p.y, r: 5, hp: 1, maxHp: 1, jar: true, size: 10, color: '#c8a070', v: rng.int(0, 2) });
    }
  }

  // ---------------- öldürme / ganimet ----------------
  function onKill(L, e, noLoot) {
    const S = G.save;
    if (e.jar) return;
    if (!e.summoned) L.kills++;
    S.kills++;
    gainXp(L, e.xp);
    const P = L.player;
    if (P.stats.perks.has('kan_emici')) P.heal(P.stats.maxHp * 0.04, true);
    if (noLoot) return;
    const gf = 1 + P.stats.goldFind;
    const coins = e.boss ? 14 : e.elite ? 5 : 1 + (E.rand() < 0.4 ? 1 : 0);
    for (let i = 0; i < coins; i++) E.drop(L, e.x, e.y, 'gold', { v: Math.max(1, Math.round(e.gold * gf / coins * E.rand.range(0.7, 1.3))) });
    const mf = P.stats.magicFind;
    if (e.boss) {
      const n = 3 + (L.floor >= 50 ? 1 : 0);
      for (let i = 0; i < n; i++) E.drop(L, e.x, e.y, 'item', { item: E.items.roll(L.floor, { minRarity: i === 0 ? 2 : 1, magicFind: mf, boost: 2 }) });
      E.drop(L, e.x, e.y, 'souls', { v: 3 + Math.floor(L.floor / 20) });
      E.drop(L, e.x, e.y, 'ore', { v: 6 + Math.floor(L.floor / 4) });
      E.drop(L, e.x, e.y, 'potion', { v: 1 });
      return;
    }
    if (e.summoned) return;
    const itemChance = e.elite ? 0.75 : L.floor <= 3 ? 0.14 : 0.1;
    if (E.rand() < itemChance * (1 + mf)) E.drop(L, e.x, e.y, 'item', { item: E.items.roll(Math.max(1, L.floor + E.rand.int(-1, 1)), { magicFind: mf, minRarity: e.elite ? 1 : 0 }) });
    if (E.rand() < (e.elite ? 0.8 : 0.12)) E.drop(L, e.x, e.y, 'ore', { v: 1 + Math.floor(L.floor / 10) });
    if (E.rand() < (e.elite ? 0.3 : 0.004)) E.drop(L, e.x, e.y, 'souls', { v: 1 });
    if (E.rand() < 0.025) E.drop(L, e.x, e.y, 'potion', { v: 1 });
  }

  function gainXp(L, v) {
    const S = G.save;
    S.xp += v;
    let up = false;
    while (S.xp >= E.items.xpNeed(S.level) && S.level < 120) { S.xp -= E.items.xpNeed(S.level); S.level++; up = true; }
    if (up) {
      L.player.refresh(false);
      L.player.hp = L.player.stats.maxHp; L.player.mana = L.player.stats.maxMana;
      E.fx.text(L, L.player.x, L.player.y - 24, 'SEVİYE ' + S.level + '!', '#ffd23b', true);
      E.fx.ring(L, L.player.x, L.player.y, 40, '#ffd23b', 0.6);
      E.sfx('levelup');
      G.toast(`Seviye atladın: ${S.level}. Can ve hasar arttı.`, '#ffd23b');
    }
  }

  function collect(L, p) {
    const S = G.save;
    if (p.kind === 'gold') { S.gold += p.v; E.sfx('coin'); E.fx.text(L, p.x, p.y - 8, '+' + E.fmt(p.v), '#ffd23b'); p.taken = true; }
    else if (p.kind === 'ore') { S.ore += p.v; E.sfx('pickup'); E.fx.text(L, p.x, p.y - 8, `+${p.v} demir`, '#c8ccd8'); p.taken = true; }
    else if (p.kind === 'souls') { S.souls += p.v; E.sfx('rare'); E.fx.text(L, p.x, p.y - 8, `+${p.v} ruh taşı`, '#c9a7ff'); p.taken = true; }
    else if (p.kind === 'potion') {
      if (S.potions >= 5) { S.gold += Math.round(E.items.potionPrice(S.maxFloor) / 2); E.sfx('coin'); p.taken = true; return; }
      S.potions += p.v; E.sfx('pickup'); E.fx.text(L, p.x, p.y - 8, '+İksir', '#ff6a8a'); p.taken = true;
    } else if (p.kind === 'item') {
      if (S.inv.length >= E.INV_MAX) { if (!p.warned || L.time - p.warned > 2) { p.warned = L.time; G.toast('Envanter dolu! Demirci\'de parçala ya da Mina\'ya sat.', '#ff8a8a'); } return; }
      S.inv.push(p.item); p.taken = true;
      const r = p.item.rarity;
      E.sfx(r >= 3 ? 'legend' : r >= 1 ? 'rare' : 'pickup');
      G.toast(`${p.item.name} (${E.RARITY[r].name})`, E.RARITY[r].color, p.item);
      G.persist();
    }
  }

  function onDeath(L) {
    const S = G.save;
    S.deaths++;
    const lost = Math.floor(S.gold * 0.1);
    S.gold -= lost;
    L.state = 'dead';
    L.deadT = 0;
    G.deathInfo = { lost, floor: L.floor };
    E.music.stop();
    G.persist(true);
  }

  // ---------------- bölüm temizlendi ----------------
  function floorCleared(L) {
    if (L.exitOpen) return;
    L.exitOpen = true;
    const S = G.save;
    const fl = L.floor;
    S.maxFloor = Math.max(S.maxFloor, Math.min(100, fl + 1));
    E.sfx('door');
    if (L.map.boss) {
      const n = fl / 10;
      const first = n > S.bosses;
      S.bosses = Math.max(S.bosses, n);
      if (first) {
        if (n >= 1 && !S.spells.buz) S.spells.buz = 1;
        if (n >= 3 && !S.spells.yildirim) S.spells.yildirim = 1;
        if (n >= 6 && !S.spells.ay) S.spells.ay = 1;
        G.queueDialog([{ who: 'Ay Parçası', text: E.STORY.bossDefeat[n - 1] }, { who: 'Ay Parçası', text: `${n}/10 Ay Parçası toplandı.${n === 1 ? ' Yeni büyü: Buz Halkası!' : n === 3 ? ' Yeni büyü: Yıldırım Zinciri!' : n === 6 ? ' Yeni büyü: Ay Kalkanı!' : ''}` }]);
        if (n === 10) { G.endingPending = true; S.ended = true; }
      }
      G.toast('Mühürdar yenildi! Portal açıldı.', '#d9c8ff');
    } else {
      G.toast(`${fl}. basamak temizlendi! Çıkış portalı açıldı.`, '#9fffa8');
    }
    G.persist(true);
  }

  // ---------------- güncelleme ----------------
  G.update = dt => {
    G.time += dt;
    for (const m of G.msg) m.t += dt;
    G.msg = G.msg.filter(m => m.t < m.life);
    if (G.banner) { G.banner.t += dt; if (G.banner.t > 3) G.banner = null; }
    if (G.fadeT > 0) { G.fadeT -= dt; if (G.fadeT <= 0.25 && G.fadeTo) { const f = G.fadeTo; G.fadeTo = null; f(); } }

    if (G.screen === 'title' || G.screen === 'intro' || G.screen === 'ending') { E.ui.update(dt); return; }
    const L = G.L;
    if (!L) return;
    if (G.overlay) { E.ui.update(dt); return; }
    if (G.save) G.save.playTime += dt;

    // duraklat
    if (E.input.back() || E.input.hit('PadStart')) { E.ui.open('pause'); E.sfx('ui'); return; }
    if (E.input.hit('KeyI') || E.input.hit('Tab') || E.input.hit('PadSelect')) { E.ui.open('inventory'); E.sfx('ui'); return; }

    if (L.state === 'dead') { L.deadT += dt; updateWorld(L, dt * 0.3, true); if (L.deadT > 1.6 && !G.overlay) E.ui.open('death'); return; }

    if (L.hitstop > 0) { L.hitstop -= dt; return; }
    updateWorld(L, dt, false);
  };

  function updateWorld(L, dt, frozen) {
    L.time += dt;
    const P = L.player;
    if (!frozen) {
      const inp = E.input.gameplay(P, L.cam);
      P.slowT = Math.max(0, (P.slowT || 0) - dt);
      P.update(dt, inp);
    }
    // boss doğuşu
    if (L.bossPending && P.y < L.map.arena.y * T + L.map.arena.h * T - 8) {
      const b = L.bossPending; L.bossPending = null;
      E.spawnBoss(L, b.idx, b.x, b.y);
      G.bossIntro = { t: 0, idx: b.idx };
      E.fx.shake(L, 5); E.sfx('roar');
    }
    for (const e of L.enemies) E.updateEnemy(L, e, dt);
    L.enemies = L.enemies.filter(e => !e.dead);
    if (L.breakables) {
      for (const b of L.breakables) if (b.hp <= 0 && !b.looted) {
        b.looted = true; b.dead = true; E.fx.burst(L, b.x, b.y - 4, '#c8a070', 10); E.sfx('die', 0.3);
        if (E.rand() < 0.7) E.drop(L, b.x, b.y, 'gold', { v: Math.max(1, Math.round(E.scale(L.floor) * 3)) });
        if (E.rand() < 0.12) E.drop(L, b.x, b.y, 'potion', { v: 1 });
      }
      L.breakables = L.breakables.filter(b => !b.dead);
    }
    E.updateShots(L, dt);
    E.updatePickups(L, dt);
    E.updateParticles(L, dt);
    if (L.boss && L.boss.dead) L.boss = null;

    // bölüm temizlendi mi
    if (!L.village && !L.exitOpen && !L.bossPending && L.enemies.filter(e => !e.summoned).length === 0 && L.state === 'play') floorCleared(L);
    // çıkış portalı
    if (L.exitOpen && !frozen) {
      const ex = L.map.exitSpot;
      if (E.dist(P.x, P.y, ex.x, ex.y) < 14) {
        if (!L.exitPrompt) { L.exitPrompt = true; if (G.endingPending) { G.endingPending = false; G.startEnding(); } else E.ui.open('exit'); }
      } else L.exitPrompt = false;
    }
    // köy etkileşimleri
    if (L.village && !frozen) villageUpdate(L, dt);

    // kamera
    const tx = P.x - E.view.w / 2, ty = P.y - 8 - E.view.h / 2;
    const k = 1 - Math.pow(0.0005, dt);
    L.cam.x += (tx - L.cam.x) * k; L.cam.y += (ty - L.cam.y) * k;
    L.cam.x = E.clamp(L.cam.x, -8, Math.max(-8, L.map.w * T - E.view.w + 8));
    L.cam.y = E.clamp(L.cam.y, -8, Math.max(-8, L.map.h * T - E.view.h + 8));
    if (L.map.w * T < E.view.w) L.cam.x = (L.map.w * T - E.view.w) / 2;
    if (L.map.h * T < E.view.h) L.cam.y = (L.map.h * T - E.view.h) / 2;
    L.shake = Math.max(0, L.shake - dt * 14);
    L.hurtFlash = Math.max(0, L.hurtFlash - dt);
    if (G.bossIntro) { G.bossIntro.t += dt; if (G.bossIntro.t > 3) G.bossIntro = null; }
    // hava efektleri
    weather(L, dt);
  }

  function villageUpdate(L, dt) {
    const P = L.player;
    L.near = null;
    for (const n of L.npcs) {
      n.anim += dt;
      const d = E.dist(P.x, P.y, n.x, n.y);
      if (d < 24) L.near = n;
    }
    if (E.dist(P.x, P.y, L.map.well.x, L.map.well.y) < 34) L.near = { id: 'kuyu', name: 'Ay Kuyusu', role: 'portal' };
    // kedi
    const c = L.cat; c.t -= dt;
    if (c.t <= 0) { c.t = E.rand.range(2, 5); const a = E.rand() * Math.PI * 2; c.tx = E.clamp(c.x + Math.cos(a) * 40, 40, L.map.w * T - 40); c.ty = E.clamp(c.y + Math.sin(a) * 30, 40, L.map.h * T - 40); }
    const d = E.dist(c.x, c.y, c.tx, c.ty);
    c.moving = d > 3;
    if (c.moving) L.map.move(Object.assign(c, { r: 3 }), (c.tx - c.x) / d * 20 * dt, (c.ty - c.y) / d * 20 * dt);
    if (L.near && (E.input.hit('KeyE') || E.input.hit('Enter') || E.input.hit('PadA'))) {
      E.sfx('ui');
      const n = L.near;
      if (n.role === 'portal') E.ui.open('portal');
      else if (n.role === 'shrine') G.talkNene();
      else if (n.role === 'smith') { G.queueDialog([{ who: n.name, text: E.rand.pick(E.NPC_LINES.tetsu) }], () => E.ui.open('smith')); }
      else if (n.role === 'shop') { G.queueDialog([{ who: n.name, text: E.rand.pick(E.NPC_LINES.mina) }], () => E.ui.open('shop')); }
      else G.queueDialog([{ who: n.name, text: E.rand.pick(n.lines) }]);
    }
  }

  G.talkNene = () => {
    const S = G.save;
    const idx = Math.min(10, S.bosses);
    const lines = E.STORY.nene[idx];
    const isNew = S.story < idx;
    S.story = Math.max(S.story, idx);
    const dlg = (isNew ? lines : [lines[lines.length - 1]]).map(t => ({ who: 'Bilge Nene', text: t }));
    G.queueDialog(dlg, () => E.ui.open('shrine'));
    G.persist();
  };

  G.queueDialog = (lines, then) => { E.ui.open('dialog', { lines, i: 0, then }); };

  G.startEnding = () => { G.screen = 'ending'; G.endT = 0; E.music.play('title'); };

  // hava (yağmur, kar, yaprak…)
  function weather(L, dt) {
    const fx = L.map.biome.fx;
    const W = E.view.w, H = E.view.h;
    const rate = { rain: 90, snow: 30, leaves: 6, petals: 8, embers: 18, spores: 10, ash: 12, bubbles: 6, sparkles: 10, wisps: 4, void: 10 }[fx] || 0;
    L.wAcc = (L.wAcc || 0) + rate * dt;
    while (L.wAcc > 1) {
      L.wAcc--;
      const p = { x: Math.random() * (W + 60) - 30, y: -10, t: 0, kind: fx, s: Math.random() };
      if (['embers', 'bubbles', 'wisps', 'spores', 'sparkles', 'void'].includes(fx)) { p.y = Math.random() * H; p.x = Math.random() * W; p.life = 2 + Math.random() * 2; }
      L.weather.push(p);
    }
    for (const p of L.weather) {
      p.t += dt;
      switch (p.kind) {
        case 'rain': p.x -= 60 * dt; p.y += 300 * dt; break;
        case 'snow': p.x += Math.sin(p.t * 2 + p.s * 6) * 12 * dt; p.y += 26 * dt; break;
        case 'leaves': case 'petals': p.x += (Math.sin(p.t * 2 + p.s * 6) * 20 + 14) * dt; p.y += 22 * dt; break;
        case 'ash': p.x += 10 * dt; p.y += 14 * dt; break;
        default: p.y -= 12 * dt; p.x += Math.sin(p.t * 3 + p.s * 9) * 8 * dt;
      }
    }
    L.weather = L.weather.filter(p => p.y < H + 10 && p.x > -40 && p.x < W + 40 && (!p.life || p.t < p.life));
    if (L.weather.length > 400) L.weather.splice(0, L.weather.length - 400);
  }

  // ======================= ÇİZİM =======================
  let lightC, lightX;
  G.render = (ctx) => {
    const W = E.view.w, H = E.view.h;
    ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H);
    if (G.screen !== 'play' || !G.L) { E.ui.draw(ctx); return; }
    const L = G.L, P = L.player;
    const sh = G.settings.shake ? L.shake : 0;
    const cx = Math.round(L.cam.x + (Math.random() - 0.5) * sh), cy = Math.round(L.cam.y + (Math.random() - 0.5) * sh);
    ctx.save();
    ctx.translate(-cx, -cy);

    // su (köy)
    if (L.map.water) {
      const f = Math.floor(G.time * 2) % 4;
      const wt = E.gfx.water(f);
      const x0 = Math.max(0, Math.floor(cx / T)), y0 = Math.max(0, Math.floor(cy / T));
      for (let ty = y0; ty <= Math.min(L.map.h - 1, y0 + Math.ceil(H / T) + 1); ty++)
        for (let tx = x0; tx <= Math.min(L.map.w - 1, x0 + Math.ceil(W / T) + 1); tx++)
          if (L.map.get(tx, ty) === 2) ctx.drawImage(wt, tx * T, ty * T);
    }
    // zemin katmanı
    const sx = E.clamp(cx, 0, L.map.layer.width), sy = E.clamp(cy, 0, L.map.layer.height);
    const sw = Math.min(W + 2, L.map.layer.width - sx), shh = Math.min(H + 2, L.map.layer.height - sy);
    if (sw > 0 && shh > 0) ctx.drawImage(L.map.layer, sx, sy, sw, shh, sx, sy, sw, shh);

    // çıkış portalı
    if (L.exitOpen) {
      const ex = L.map.exitSpot;
      ctx.drawImage(E.gfx.portal(Math.floor(G.time * 6) % 8, L.map.boss ? '#ffd98a' : '#b48bff'), ex.x - 16, ex.y - 18);
      if (Math.random() < 0.4) E.fx.particle(L, ex.x + E.rand.range(-10, 10), ex.y, { color: '#d9c8ff', up: 40, sp: 5, life: 0.8, glow: true });
    }
    // telegraflar ve tehlikeler (yerde)
    for (const t of L.tele) drawTelegraph(ctx, t);
    for (const h of L.hazards) { ctx.globalAlpha = Math.min(1, h.life) * 0.55; ctx.fillStyle = h.color; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    for (const r of L.rings) { const k = 1 - r.life / r.max; ctx.globalAlpha = r.life / r.max; ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r0 + (r.r1 - r.r0) * E.ease.out(k), (r.r0 + (r.r1 - r.r0) * E.ease.out(k)) * 0.65, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }

    // y'ye göre sıralanmış nesneler
    const list = [];
    const inView = (x, y, m = 40) => x > cx - m && x < cx + W + m && y > cy - m && y < cy + H + m * 2;
    for (const d of (L.map.tall || [])) if (inView(d.x, d.y)) list.push({ y: d.y + 14, draw: () => ctx.drawImage(E.gfx.deco(d.kind, L.map.biome, d.v), d.x - 8, d.y - 24) });
    for (const p of L.pickups) if (inView(p.x, p.y)) list.push({ y: p.y, draw: () => drawPickup(ctx, p) });
    if (L.breakables) for (const b of L.breakables) if (inView(b.x, b.y)) list.push({ y: b.y, draw: () => drawJar(ctx, b) });
    for (const e of L.enemies) if (inView(e.x, e.y, 80)) list.push({ y: e.y, draw: () => drawEnemy(ctx, e, L) });
    if (L.npcs) for (const n of L.npcs) list.push({ y: n.y, draw: () => drawNpc(ctx, n, L) });
    if (L.cat) list.push({ y: L.cat.y, draw: () => { const s = E.gfx.cat(L.cat.moving ? Math.floor(G.time * 6) % 2 : 0); ctx.drawImage(L.cat.tx < L.cat.x ? E.gfx.flipX(s) : s, L.cat.x - 7, L.cat.y - 9); } });
    list.push({ y: P.y, draw: () => drawPlayer(ctx, P, L) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.draw();

    // mermiler
    for (const s of L.pshots) drawShot(ctx, s, true);
    for (const s of L.eshots) drawShot(ctx, s, false);
    // yıldırımlar
    for (const b of L.bolts) {
      ctx.globalAlpha = b.life / b.max; ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 2;
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => { if (!i) ctx.moveTo(x, y); else { const [px, py] = b.pts[i - 1]; for (let k = 1; k <= 4; k++) ctx.lineTo(px + (x - px) * k / 4 + (k < 4 ? E.rand.range(-5, 5) : 0), py + (y - py) * k / 4 + (k < 4 ? E.rand.range(-5, 5) : 0)); } });
      ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // boss lazerleri
    if (L.boss && (L.boss.beams || L.boss.beamWarn)) drawBeams(ctx, L.boss, L);
    // parçacıklar
    for (const p of L.particles) {
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // üst katman (çatılar, ağaç tepeleri)
    if (L.map.top) ctx.drawImage(L.map.top, sx, sy, sw, shh, sx, sy, sw, shh);
    ctx.restore();

    // ışıklandırma
    drawLighting(ctx, L, cx, cy);
    // hava
    drawWeather(ctx, L);
    // hasar yazıları
    ctx.save(); ctx.translate(-cx, -cy);
    for (const t of L.texts) {
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      E.font.draw(ctx, t.s, t.x, t.y - (t.big ? 2 : 0), t.color, { align: 'center', outline: '#120a14', scale: t.big ? 1 : 1 });
    }
    ctx.globalAlpha = 1;
    // isim etiketleri / etkileşim
    if (L.village && L.near) {
      const n = L.near, nx = n.id === 'kuyu' ? L.map.well.x : n.x, ny = n.id === 'kuyu' ? L.map.well.y - 30 : n.y - 30;
      const label = `[E] ${n.name}`;
      const w = E.font.width(label) + 8;
      ctx.fillStyle = 'rgba(10,8,18,0.85)'; ctx.fillRect(Math.round(nx - w / 2), ny - 2, w, 11);
      E.font.draw(ctx, label, nx, ny, '#ffe2a8', { align: 'center' });
    }
    ctx.restore();

    if (L.hurtFlash > 0) { ctx.fillStyle = `rgba(255,40,40,${L.hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    E.ui.hud(ctx, L);
    E.ui.draw(ctx);
    E.ui.toasts(ctx);
  };

  function drawShadow(ctx, x, y, w) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }

  function drawPlayer(ctx, P, L) {
    if (P.dead) {
      ctx.globalAlpha = 0.8; ctx.drawImage(E.gfx.hero('down', 0, 'idle'), P.x - 9, P.y - 6, 18, 10); ctx.globalAlpha = 1; return;
    }
    drawShadow(ctx, P.x, P.y + 1, 6);
    const f = P.moving ? Math.floor(P.anim) % 4 : 0;
    let spr = E.gfx.hero(P.dir, f, P.moving ? 'walk' : 'idle');
    if (P.flash > 0 || (P.invul > 0 && P.dashT <= 0 && Math.floor(G.time * 20) % 2 === 0)) spr = E.gfx.white(spr);
    if (P.dashT > 0) { ctx.globalAlpha = 0.35; ctx.drawImage(spr, P.x - 9 - Math.cos(P.dashDir) * 8, P.y - 21 - Math.sin(P.dashDir) * 8); ctx.globalAlpha = 1; }
    const behind = P.dir === 'up';
    if (behind) drawSword(ctx, P, L);
    ctx.drawImage(spr, Math.round(P.x - 9), Math.round(P.y - 21));
    if (!behind) drawSword(ctx, P, L);
    if (P.shield > 0) { ctx.globalAlpha = 0.35 + Math.sin(G.time * 8) * 0.1; ctx.strokeStyle = '#d9c8ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(P.x, P.y - 9, 13, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  }

  function drawSword(ctx, P, L) {
    const w = L.save.equip.silah;
    const col = w ? E.RARITY[w.rarity].color : '#cfd8ff';
    const spr = E.gfx.sword(col);
    let a;
    if (P.swing) {
      const k = E.ease.out(Math.min(1, P.swing.t / P.swing.dur));
      const s = P.swing;
      a = s.aim - s.arc * s.dirSign + s.arc * 2 * s.dirSign * k;
      // savurma izi
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - k * 0.6);
      ctx.strokeStyle = s.n === 2 ? '#fff4c0' : '#e8eeff';
      ctx.lineWidth = s.n === 2 ? 4 : 3;
      ctx.beginPath();
      const a0 = s.aim - s.arc * s.dirSign, a1 = a;
      ctx.arc(P.x, P.y - 6, s.range - 4, Math.min(a0, a1), Math.max(a0, a1));
      ctx.stroke();
      ctx.globalAlpha = 0.25 * (1 - k); ctx.lineWidth = 8; ctx.stroke();
      ctx.restore();
    } else {
      a = P.dir === 'left' ? Math.PI * 0.75 : P.dir === 'right' ? Math.PI * 0.25 : P.dir === 'up' ? -Math.PI * 0.6 : Math.PI * 0.6;
    }
    ctx.save();
    ctx.translate(Math.round(P.x + Math.cos(a) * 4), Math.round(P.y - 8 + Math.sin(a) * 3));
    ctx.rotate(a);
    ctx.drawImage(spr, -2, -3);
    ctx.restore();
  }

  function drawEnemy(ctx, e, L) {
    if (e.hide) return;
    const lift = e.lift || 0;
    drawShadow(ctx, e.x, e.y + 1, e.size * 0.35);
    let spr;
    const f = Math.floor(e.anim) % 2;
    if (e.boss) spr = E.gfx.boss(e.kind, e.color, f);
    else spr = E.gfx.enemy(e.type, e.color, f, e.elite);
    const flip = Math.cos(e.face) < 0 && !e.boss ? true : (e.boss && Math.cos(e.face) < 0);
    if (flip) spr = E.gfx.flipX(spr);
    if (e.flash > 0) spr = E.gfx.white(spr);
    // hazırlık parlaması
    const tell = (e.state === 'wind' || e.state === 'aim' || e.state === 'cast' || e.state === 'fuse' || e.state === 'slam') && Math.floor(G.time * 16) % 2 === 0;
    if (e.elite && !e.boss) { ctx.globalAlpha = 0.4 + Math.sin(G.time * 5) * 0.15; ctx.fillStyle = '#ffd23b'; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.size * 0.55, e.size * 0.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    const w = spr.width, h = spr.height;
    ctx.drawImage(tell ? E.gfx.tint(spr, '#ff5050') : spr, Math.round(e.x - w / 2), Math.round(e.y - h + 2 - lift));
    if (e.state === 'aim' && e.type === 'charger') {
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 4); ctx.lineTo(e.x + Math.cos(e.chargeA) * 140, e.y - 4 + Math.sin(e.chargeA) * 140); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (e.boss && e.state === 'charge' && e.sub === 'aim') {
      ctx.globalAlpha = 0.3; ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = e.r * 1.2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.chargeA) * 300, e.y + Math.sin(e.chargeA) * 300); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if ((e.swingFx > 0) || (e.slashFx > 0)) {
      ctx.strokeStyle = '#ffeedd'; ctx.globalAlpha = 0.7; ctx.lineWidth = e.boss ? 5 : 3; ctx.beginPath();
      const a = e.slashA != null && e.boss ? e.slashA : e.swingA;
      ctx.arc(e.x, e.y - 6, e.boss ? 40 : 18, a - 1, a + 1); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (e.slow > 0) { ctx.fillStyle = 'rgba(140,220,255,0.35)'; ctx.fillRect(Math.round(e.x - w / 2), Math.round(e.y - h + 2), w, h); }
    if (!e.boss && e.hp < e.maxHp) {
      const bw = Math.max(12, e.size * 0.8);
      ctx.fillStyle = '#1a0a12'; ctx.fillRect(Math.round(e.x - bw / 2) - 1, Math.round(e.y - h - 3), bw + 2, 4);
      ctx.fillStyle = e.elite ? '#ffd23b' : '#ff4a5a'; ctx.fillRect(Math.round(e.x - bw / 2), Math.round(e.y - h - 2), Math.round(bw * Math.max(0, e.hp / e.maxHp)), 2);
    }
    if (e.elite && !e.boss && e.hp < e.maxHp) E.font.draw(ctx, e.name, e.x, e.y - h - 12, '#ffd23b', { align: 'center', outline: '#120a14' });
  }

  function drawNpc(ctx, n, L) {
    drawShadow(ctx, n.x, n.y + 1, 6);
    const spr = E.gfx.npc(n.id, Math.floor(n.anim * 1.5) % 2);
    const flip = L.player.x < n.x;
    ctx.drawImage(flip ? E.gfx.flipX(spr) : spr, Math.round(n.x - 9), Math.round(n.y - 22));
    if (n.role !== 'talk') {
      const icon = { shrine: '★', smith: '◆', shop: '●' }[n.role];
      const by = n.y - 32 + Math.sin(G.time * 3) * 1.5;
      E.font.draw(ctx, icon, n.x, by, n.role === 'shrine' ? '#d9c8ff' : n.role === 'smith' ? '#ffb070' : '#ffd23b', { align: 'center', outline: '#120a14' });
    }
  }

  function drawJar(ctx, b) {
    drawShadow(ctx, b.x, b.y + 1, 5);
    const P = E.gfx.painter(ctx);
    P.ell(b.x, b.y - 4, 5, 5, '#a8784a'); P.rect(b.x - 3, b.y - 11, 6, 3, '#8a5a32'); P.ell(b.x - 2, b.y - 6, 1, 2, '#d8a87a');
    P.rect(b.x - 5, b.y - 4, 10, 1, '#6a4224');
  }

  function drawPickup(ctx, p) {
    const bob = Math.sin(G.time * 4 + p.x) * 1.5;
    const y = p.y - p.z - 4 + (p.z ? 0 : bob);
    if (p.kind === 'item') {
      const col = E.RARITY[p.item.rarity].color;
      if (p.item.rarity >= 1) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(G.time * 3); ctx.fillStyle = col; ctx.fillRect(p.x - 2, y - 40, 4, 40); ctx.fillRect(p.x - 1, y - 60, 2, 20); ctx.globalAlpha = 1; }
      drawShadow(ctx, p.x, p.y + 1, 5);
      ctx.drawImage(E.gfx.outline(E.gfx.itemIcon(p.item.slot, col, p.item.icon), col), Math.round(p.x - 8), Math.round(y - 8));
      return;
    }
    const icon = { gold: 'altin', ore: 'demir', souls: 'ruh', potion: 'iksir' }[p.kind];
    const spr = E.gfx.itemIcon(icon, '#ff4a6a');
    const s = p.kind === 'gold' ? 0.6 : 0.85;
    drawShadow(ctx, p.x, p.y + 1, 3);
    ctx.drawImage(spr, Math.round(p.x - 7 * s), Math.round(y - 7 * s), Math.round(14 * s), Math.round(14 * s));
  }

  function drawShot(ctx, s, mine) {
    if (s.kind === 'arrow') {
      const a = Math.atan2(s.vy, s.vx);
      ctx.strokeStyle = '#f0e6c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x - Math.cos(a) * 7, s.y - Math.sin(a) * 7); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
      return;
    }
    if (s.kind === 'crescent') {
      ctx.strokeStyle = s.color; ctx.globalAlpha = Math.min(1, s.life * 3); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x - Math.cos(s.a) * 6, s.y - Math.sin(s.a) * 6, 9, s.a - 1.1, s.a + 1.1); ctx.stroke(); ctx.globalAlpha = 1;
      return;
    }
    const r = s.r;
    ctx.fillStyle = mine ? s.color : '#1a0a14';
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s.x - r * 0.3, s.y - r * 0.3, Math.max(1, r * 0.4), 0, Math.PI * 2); ctx.fill();
  }

  function drawTelegraph(ctx, t) {
    const k = Math.min(1, t.t / t.dur);
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.15 * Math.sin(G.time * 20) * k;
    ctx.fillStyle = t.color;
    if (t.arc != null) {
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.r, t.arc - 1.3, t.arc + 1.3); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r * k, t.r * 0.65 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = t.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.65, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBeams(ctx, e, L) {
    const n = e.beams || (e.phase === 2 ? 3 : 2);
    for (let k = 0; k < n; k++) {
      const a = e.beamA + k * Math.PI * 2 / n;
      const x0 = e.x, y0 = e.y - 10, x1 = x0 + Math.cos(a) * 260, y1 = y0 + Math.sin(a) * 260;
      ctx.save();
      if (e.beamWarn) { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(G.time * 30); ctx.strokeStyle = '#ff7bf2'; ctx.lineWidth = 2; }
      else { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ff7bf2'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; }
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
    }
  }

  function drawLighting(ctx, L, cx, cy) {
    const W = E.view.w, H = E.view.h;
    if (!lightC || lightC.width !== W || lightC.height !== H) { [lightC, lightX] = E.canvas(W, H); }
    const biome = L.map.biome;
    const dark = biome.dark;
    if (dark <= 0.01) return;
    lightX.globalCompositeOperation = 'source-over';
    lightX.clearRect(0, 0, W, H);
    lightX.fillStyle = `rgba(6,4,14,${dark})`;
    lightX.fillRect(0, 0, W, H);
    lightX.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const g = lightX.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lightX.fillStyle = g; lightX.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const P = L.player;
    hole(P.x - cx, P.y - 8 - cy, 95, 0.95);
    const glows = [];
    for (const l of L.map.lights) {
      const x = l.x - cx, y = l.y - cy;
      if (x < -l.r || y < -l.r || x > W + l.r || y > H + l.r) continue;
      const r = l.r * (1 + Math.sin(G.time * 9 + l.x) * l.flicker * 0.3 + (Math.random() - 0.5) * l.flicker * 0.15);
      hole(x, y, r, 0.9); glows.push([x, y, r, l.color]);
    }
    for (const s of L.pshots) { hole(s.x - cx, s.y - cy, 30, 0.8); glows.push([s.x - cx, s.y - cy, 24, s.color]); }
    for (const s of L.eshots) if (s.kind !== 'arrow') { hole(s.x - cx, s.y - cy, 14, 0.6); }
    if (L.exitOpen) { const ex = L.map.exitSpot; hole(ex.x - cx, ex.y - cy, 70, 1); glows.push([ex.x - cx, ex.y - cy, 50, '#b48bff']); }
    for (const p of L.pickups) if (p.kind === 'item' && p.item.rarity >= 1) hole(p.x - cx, p.y - cy, 20, 0.7);
    if (L.boss) hole(L.boss.x - cx, L.boss.y - 20 - cy, 70, 0.6);
    ctx.drawImage(lightC, 0, 0);
    // renkli parıltı
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, c] of glows) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const [rr, gg, bb] = E.hex(c);
      g.addColorStop(0, `rgba(${rr},${gg},${bb},0.22)`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (const p of L.particles) if (p.glow) { ctx.globalAlpha = Math.min(1, p.life / p.max) * 0.5; ctx.fillStyle = p.color; ctx.fillRect(p.x - cx - 1, p.y - cy - 1, 3, 3); }
    ctx.restore();
  }

  function drawWeather(ctx, L) {
    for (const p of L.weather) {
      switch (p.kind) {
        case 'rain': ctx.strokeStyle = 'rgba(200,190,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2, p.y + 7); ctx.stroke(); break;
        case 'snow': ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(p.x | 0, p.y | 0, p.s > 0.6 ? 2 : 1, p.s > 0.6 ? 2 : 1); break;
        case 'leaves': ctx.fillStyle = p.s > 0.5 ? '#8fd16a' : '#5c9a3a'; ctx.fillRect(p.x | 0, p.y | 0, 2, 1); break;
        case 'petals': ctx.fillStyle = p.s > 0.5 ? '#ffc4d8' : '#ff9abb'; ctx.fillRect(p.x | 0, p.y | 0, 2, 1); ctx.fillRect((p.x | 0) + 1, (p.y | 0) + 1, 1, 1); break;
        case 'ash': ctx.fillStyle = 'rgba(200,180,140,0.6)'; ctx.fillRect(p.x | 0, p.y | 0, 1, 1); break;
        default: {
          const col = { embers: '#ff8a2b', bubbles: '#9fe8ff', wisps: '#c6ff6e', spores: '#5effc8', sparkles: '#ff9bf5', void: '#d9c8ff' }[p.kind];
          ctx.globalAlpha = Math.sin(Math.min(1, p.t / p.life) * Math.PI) * 0.8; ctx.fillStyle = col; ctx.fillRect(p.x | 0, p.y | 0, p.kind === 'bubbles' ? 2 : 1, p.kind === 'bubbles' ? 2 : 1); ctx.globalAlpha = 1;
        }
      }
    }
  }

  // ---------------- başlatma ----------------
  G.boot = async () => {
    G.settings = loadSettings();
    E.audio.setVolume('music', G.settings.music); E.audio.setVolume('sfx', G.settings.sfx);
    const s = await E.storage.load();
    if (s && s.version === 1) { G.save = s; G.hasSave = true; }
    G.screen = 'title';
    E.ui.open('title');
  };

  G.newGame = () => {
    G.save = E.newSave();
    G.hasSave = true;
    G.persist(true);
    G.screen = 'intro'; G.introT = 0;
    E.ui.closeAll();
  };
  G.continueGame = () => { E.ui.closeAll(); G.fade(() => G.enterVillage()); };

  G.fade = (fn) => { G.fadeT = 0.5; G.fadeTo = fn; };
})();
