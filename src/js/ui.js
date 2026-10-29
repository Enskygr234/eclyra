'use strict';
/* Eclyra — arayüz: HUD, menüler, envanter, dükkânlar, diyaloglar (hepsi piksel tuvalde) */
(() => {
  const F = () => E.font;
  const I = () => E.input;
  const G = () => E.game;
  const U = E.ui = { stack: [] };
  const C = {
    panel: 'rgba(14,11,24,0.94)', panel2: 'rgba(28,22,44,0.96)', edge: '#4a3a6e', edgeHi: '#8a74c0', text: '#ece6ff', dim: '#9a90b8', gold: '#ffd23b',
    hp: '#ff4a5a', mana: '#5aa9ff', sel: '#ffcf5a', good: '#7dff8a', bad: '#ff6a6a'
  };
  U.C = C;

  // ---------------- yığın ----------------
  U.open = (name, data = {}) => { U.stack.push({ name, sel: 0, t: 0, ...data }); G().overlay = U.top(); };
  U.close = () => { U.stack.pop(); G().overlay = U.top(); };
  U.closeAll = () => { U.stack = []; G().overlay = null; };
  U.top = () => U.stack[U.stack.length - 1] || null;
  U.update = dt => { for (const s of U.stack) s.t += dt; };

  // ---------------- çizim yardımcıları ----------------
  const mouse = () => I().mouse;
  const inRect = (x, y, w, h) => { const m = mouse(); return m.x >= x && m.y >= y && m.x < x + w && m.y < y + h; };
  U.inRect = inRect;

  function panel(ctx, x, y, w, h, title, o = {}) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = o.bg || C.panel; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = o.edge || C.edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = o.hi || C.edgeHi; ctx.fillRect(x + 1, y + 1, w - 2, 1);
    // köşe süsleri
    ctx.fillStyle = C.sel; for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) ctx.fillRect(cx, cy, 2, 2);
    if (title) {
      ctx.fillStyle = 'rgba(80,60,130,0.5)'; ctx.fillRect(x + 1, y + 2, w - 2, 12);
      F().draw(ctx, title, x + w / 2, y + 5, C.sel, { align: 'center', shadow: '#000' });
    }
  }
  U.panel = panel;

  function bar(ctx, x, y, w, h, v, max, col, bg = '#1a1020') {
    ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    const f = Math.max(0, Math.min(1, v / max));
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * f), h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, Math.round(w * f), 1);
  }

  // Düğme: üzerine gelme/seçili/tıklama
  function button(ctx, x, y, w, h, label, o = {}) {
    const hover = inRect(x, y, w, h);
    const sel = o.sel || hover;
    const dis = !!o.disabled;
    ctx.fillStyle = dis ? 'rgba(40,36,50,0.9)' : sel ? 'rgba(90,70,150,0.95)' : 'rgba(40,30,66,0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = sel && !dis ? C.sel : C.edge;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    F().draw(ctx, label, x + w / 2, y + Math.floor((h - 7) / 2), dis ? '#6a6480' : o.color || (sel ? '#fff' : C.text), { align: 'center' });
    if (sel && !dis && o.arrow !== false) F().draw(ctx, '>', x + 4, y + Math.floor((h - 7) / 2), C.sel);
    return { hover, clicked: hover && mouse().clicked && !dis };
  }
  U.button = button;

  // Dikey liste gezinmesi
  function navList(s, n) {
    if (n <= 0) return;
    if (I().hit('ArrowDown') || I().hit('KeyS')) { s.sel = (s.sel + 1) % n; E.sfx('ui'); }
    if (I().hit('ArrowUp') || I().hit('KeyW')) { s.sel = (s.sel - 1 + n) % n; E.sfx('ui'); }
    s.sel = E.clamp(s.sel, 0, n - 1);
  }
  const confirm = () => I().hit('Enter') || I().hit('Space') || I().hit('PadA') || I().hit('KeyE');
  const back = () => I().hit('Escape') || I().hit('PadB');

  // Menü düğme listesi çiz → seçilen indeks ya da -1
  function menu(ctx, s, items, x, y, w, h = 15, gap = 4) {
    navList(s, items.length);
    let act = -1;
    items.forEach((it, i) => {
      const r = button(ctx, x, y + i * (h + gap), w, h, it.label, { sel: s.sel === i, disabled: it.disabled, color: it.color });
      if (r.hover && mouse().moved) s.sel = i;
      if (r.clicked) act = i;
    });
    if (confirm() && !items[s.sel].disabled) act = s.sel;
    if (act >= 0) E.sfx('uiok');
    return act;
  }

  // ---------------- eşya ipucu ----------------
  function itemLines(it, cmp) {
    const lines = [];
    const R = E.RARITY[it.rarity];
    lines.push([it.name + (it.plus ? ` +${it.plus}` : ''), R.color]);
    lines.push([`${R.name} ${E.SLOT_NAME[it.slot]} · Sv ${it.level}`, C.dim]);
    const st = E.items.stats(it);
    const baseKeys = Object.keys(it.base);
    for (const k of baseKeys) lines.push([E.items.fmtStat(k, st[k]), '#ffffff']);
    for (const a of it.affixes) if (!baseKeys.includes(a.k)) lines.push([E.items.fmtStat(a.k, st[a.k]), '#9fd4ff']);
    for (const a of it.affixes) if (baseKeys.includes(a.k)) lines.push(['(ek) ' + E.items.fmtStat(a.k, (E.AFFIXES.find(x => x[0] === a.k)[4] ? a.v * E.items.mult(it) : a.v)), '#9fd4ff']);
    if (it.perk) { lines.push(['★ ' + E.PERKS[it.perk].name, '#ffa53b']); lines.push([E.PERKS[it.perk].desc, '#ffcf8a', true]); }
    if (cmp !== undefined) {
      if (!cmp) lines.push(['Boş yuva — kuşanırsan güçlenirsin', C.good]);
      else if (cmp.id !== it.id) {
        const d = E.items.power(it) - E.items.power(cmp);
        lines.push([d >= 0 ? `▲ Kuşanılandan güçlü (+${Math.round(d)})` : `▼ Kuşanılandan zayıf (${Math.round(d)})`, d >= 0 ? C.good : C.bad]);
      }
    }
    lines.push([`Satış: ${E.fmt(E.items.sellPrice(it))} altın`, C.gold]);
    return lines;
  }
  function tooltip(ctx, it, x, y, cmp) {
    const lines = itemLines(it, cmp);
    const maxW = 150;
    const rows = [];
    for (const [s, c, wrap] of lines) { if (wrap) F().wrap(s, maxW).forEach(l => rows.push([l, c])); else rows.push([s, c]); }
    const w = Math.min(maxW + 12, Math.max(...rows.map(r => F().width(r[0]))) + 12);
    const h = rows.length * 10 + 8;
    const V = E.view;
    x = E.clamp(x, 2, V.w - w - 2); y = E.clamp(y, 2, V.h - h - 2);
    panel(ctx, x, y, w, h, null, { edge: E.RARITY[it.rarity].color, hi: E.shadeHex(E.RARITY[it.rarity].color, -0.3) });
    rows.forEach(([s, c], i) => F().draw(ctx, s, x + 6, y + 5 + i * 10, c));
  }
  U.tooltip = tooltip;

  function itemSlot(ctx, x, y, it, o = {}) {
    const sz = 20;
    const col = it ? E.RARITY[it.rarity].color : '#3a3050';
    ctx.fillStyle = o.sel ? 'rgba(110,90,170,0.9)' : 'rgba(30,24,48,0.95)'; ctx.fillRect(x, y, sz, sz);
    ctx.fillStyle = o.sel ? C.sel : col; ctx.fillRect(x, y, sz, 1); ctx.fillRect(x, y + sz - 1, sz, 1); ctx.fillRect(x, y, 1, sz); ctx.fillRect(x + sz - 1, y, 1, sz);
    if (it) {
      if (it.rarity >= 2) { ctx.fillStyle = E.shadeHex(col, -0.6); ctx.fillRect(x + 1, y + 1, sz - 2, sz - 2); }
      ctx.drawImage(E.gfx.itemIcon(it.slot, col, it.icon), x + 3, y + 3);
      if (it.plus) F().draw(ctx, '+' + it.plus, x + sz - 2, y + sz - 8, '#fff', { align: 'right', outline: '#000' });
    } else if (o.ghost) {
      ctx.globalAlpha = 0.25; ctx.drawImage(E.gfx.itemIcon(o.ghost, '#777', 0), x + 3, y + 3); ctx.globalAlpha = 1;
    }
    return inRect(x, y, sz, sz);
  }

  // ======================= HUD =======================
  U.hud = (ctx, L) => {
    const V = E.view, S = G().save, P = L.player;
    // can/mana
    const x = 6, y = 6;
    panel(ctx, x - 2, y - 2, 128, 34, null, { bg: 'rgba(10,8,20,0.75)' });
    F().draw(ctx, `Sv ${S.level}`, x + 2, y + 1, C.sel);
    bar(ctx, x + 28, y + 1, 94, 7, P.hp, P.stats.maxHp, C.hp);
    if (P.shield > 0) { ctx.fillStyle = 'rgba(217,200,255,0.75)'; ctx.fillRect(x + 28, y + 1, Math.round(94 * Math.min(1, P.shield / P.stats.maxHp)), 2); }
    F().draw(ctx, `${E.fmt(Math.ceil(P.hp))}/${E.fmt(P.stats.maxHp)}`, x + 75, y + 1, '#fff', { align: 'center', outline: '#300' });
    bar(ctx, x + 28, y + 11, 94, 5, P.mana, P.stats.maxMana, C.mana);
    // xp
    bar(ctx, x + 2, y + 21, 120, 2, S.xp, E.items.xpNeed(S.level), '#c9a7ff');
    F().draw(ctx, `${E.fmt(S.gold)}`, x + 12, y + 25 + 0, C.gold);
    ctx.drawImage(E.gfx.itemIcon('altin', '#fff'), x, y + 23, 10, 10);
    ctx.drawImage(E.gfx.itemIcon('demir', '#fff'), x + 52, y + 23, 10, 10); F().draw(ctx, E.fmt(S.ore), x + 64, y + 25, '#c8ccd8');
    ctx.drawImage(E.gfx.itemIcon('ruh', '#fff'), x + 92, y + 23, 10, 10); F().draw(ctx, E.fmt(S.souls), x + 104, y + 25, '#c9a7ff');

    // yetenek çubuğu (alt orta)
    const slots = [{ k: 'F', icon: 'iksir', n: S.potions, cd: 0 }];
    E.SPELLS.forEach((sp, i) => slots.push({ k: sp.key, spell: sp, lvl: S.spells[sp.id], cd: P.cds[i] / (sp.cd * (1 - P.stats.cdr)), mana: sp.mana }));
    slots.push({ k: '␣', dash: true, cd: Math.max(0, P.dashCd) / 0.65 });
    const bw = 22, bx = Math.round(V.w / 2 - (slots.length * (bw + 3)) / 2), by = V.h - bw - 6;
    slots.forEach((s, i) => {
      const sx = bx + i * (bw + 3);
      ctx.fillStyle = 'rgba(10,8,20,0.8)'; ctx.fillRect(sx, by, bw, bw);
      ctx.fillStyle = C.edge; ctx.fillRect(sx, by, bw, 1); ctx.fillRect(sx, by + bw - 1, bw, 1); ctx.fillRect(sx, by, 1, bw); ctx.fillRect(sx + bw - 1, by, 1, bw);
      if (s.icon) { ctx.drawImage(E.gfx.itemIcon('iksir', '#ff4a6a'), sx + 4, by + 4); F().draw(ctx, String(s.n), sx + bw - 3, by + bw - 9, s.n ? '#fff' : '#f66', { align: 'right', outline: '#000' }); }
      else if (s.spell) {
        if (!s.lvl) { F().draw(ctx, '?', sx + bw / 2, by + 7, '#4a4060', { align: 'center' }); }
        else {
          spellIcon(ctx, s.spell.id, sx + 3, by + 3, P.mana < s.mana);
          if (s.cd > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(sx + 1, by + 1, bw - 2, Math.round((bw - 2) * s.cd)); }
        }
      } else if (s.dash) {
        F().draw(ctx, '»', sx + bw / 2, by + 7, '#b9c6ff', { align: 'center' });
        if (s.cd > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(sx + 1, by + 1, bw - 2, Math.round((bw - 2) * Math.min(1, s.cd))); }
      }
      F().draw(ctx, s.k, sx + 2, by + 2, '#ffe2a8', { outline: '#000' });
    });

    // sağ üst: bölüm bilgisi + mini harita
    if (L.village) {
      const label = 'Kiri Köyü';
      F().draw(ctx, label, V.w - 6, 6, '#ffe2a8', { align: 'right', outline: '#120a14' });
      const obj = S.story < 0 ? 'Görev: Tapınaktaki Bilge Nene ile konuş' : S.bosses >= 10 ? 'Derinlik seni bekliyor' : `Görev: Ay Kuyusu → ${Math.min(100, (S.bosses + 1) * 10)}. basamaktaki Mühürdar`;
      F().draw(ctx, obj, V.w - 6, 16, C.dim, { align: 'right', outline: '#120a14' });
    } else {
      F().draw(ctx, `${L.floor}. Basamak`, V.w - 6, 6, '#ffe2a8', { align: 'right', outline: '#120a14' });
      F().draw(ctx, L.map.biome.name, V.w - 6, 15, C.dim, { align: 'right', outline: '#120a14' });
      const left = L.enemies.filter(e => !e.summoned).length;
      if (!L.map.boss) F().draw(ctx, L.exitOpen ? 'Portal açık!' : `Düşman: ${left}`, V.w - 6, 24, L.exitOpen ? C.good : '#ffb0b0', { align: 'right', outline: '#120a14' });
      minimap(ctx, L, V.w - 6 - L.map.w, 34);
    }

    // boss can çubuğu
    if (L.boss && !L.boss.dead && L.boss.state !== 'intro') {
      const b = L.boss, w = Math.min(260, V.w - 140);
      const x0 = Math.round(V.w / 2 - w / 2), y0 = 14;
      F().draw(ctx, `${b.name} — ${b.title}`, V.w / 2, y0 - 9, '#ffd98a', { align: 'center', outline: '#120a14' });
      bar(ctx, x0, y0, w, 6, b.hp, b.maxHp, b.phase === 2 ? '#ff3a5a' : '#c43aff');
    }

    // bölüm başlığı
    const bn = G().banner;
    if (bn) {
      const a = Math.min(1, bn.t * 2, (3 - bn.t) * 2);
      ctx.globalAlpha = Math.max(0, a);
      F().draw(ctx, bn.title, V.w / 2, V.h * 0.28, '#fff', { align: 'center', scale: 2, outline: '#120a14' });
      F().draw(ctx, bn.sub, V.w / 2, V.h * 0.28 + 20, '#d9c8ff', { align: 'center', outline: '#120a14' });
      ctx.globalAlpha = 1;
    }
    // boss tanıtımı
    const bi = G().bossIntro;
    if (bi) {
      const B = E.BOSSES[bi.idx];
      const a = Math.min(1, bi.t * 2, (3 - bi.t) * 2);
      ctx.globalAlpha = Math.max(0, a) * 0.75; ctx.fillStyle = '#000'; ctx.fillRect(0, V.h * 0.32, V.w, 50); ctx.globalAlpha = Math.max(0, a);
      F().draw(ctx, B.name.toUpperCase(), V.w / 2, V.h * 0.32 + 8, '#ffd98a', { align: 'center', scale: 2, outline: '#3a1a0a' });
      F().draw(ctx, B.title, V.w / 2, V.h * 0.32 + 26, '#fff', { align: 'center' });
      F().draw(ctx, B.intro, V.w / 2, V.h * 0.32 + 38, C.dim, { align: 'center' });
      ctx.globalAlpha = 1;
    }
    // kontrol ipucu (ilk dakikalar)
    if (S.playTime < 90 && !L.village) {
      const hint = I().padUsed ? 'Sol çubuk: yürü · RT/A: kılıç · B: atıl · X Y RB: büyü · LB: iksir' : 'WASD: yürü · Sol tık: kılıç · Boşluk: atıl · Sağ tık/1-4: büyü · F: iksir · I: envanter';
      F().draw(ctx, hint, V.w / 2, V.h - 40, 'rgba(255,255,255,0.6)', { align: 'center', outline: '#000' });
    }
    if (G().fadeT > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, 1 - Math.abs(G().fadeT - 0.25) * 4)})`; ctx.fillRect(0, 0, V.w, V.h); }
  };

  U.toasts = ctx => {
    const V = E.view;
    G().msg.forEach((m, i) => {
      const a = Math.min(1, (m.life - m.t) * 2) * Math.min(1, m.t * 6);
      ctx.globalAlpha = a;
      const yy = V.h - 50 - (G().msg.length - 1 - i) * 11;
      const w = F().width(m.s) + 10 + (m.icon ? 12 : 0);
      ctx.fillStyle = 'rgba(10,8,20,0.8)'; ctx.fillRect(6, yy - 2, w, 11);
      if (m.icon) ctx.drawImage(E.gfx.itemIcon(m.icon.slot, E.RARITY[m.icon.rarity].color, m.icon.icon), 8, yy - 3, 10, 10);
      F().draw(ctx, m.s, 10 + (m.icon ? 12 : 0), yy, m.color);
      ctx.globalAlpha = 1;
    });

  };

  function spellIcon(ctx, id, x, y, dim) {
    const P = E.gfx.painter(ctx);
    ctx.globalAlpha = dim ? 0.45 : 1;
    if (id === 'ates') { P.circ(x + 8, y + 9, 5, '#ff6a2a'); P.circ(x + 8, y + 9, 3, '#ffd23b'); P.poly([[x + 4, y + 7], [x + 8, y], [x + 12, y + 7]], '#ff6a2a'); }
    if (id === 'buz') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.line(x + 8, y + 8, x + 8 + Math.cos(a) * 6, y + 8 + Math.sin(a) * 6, '#bfefff'); } P.circ(x + 8, y + 8, 2, '#fff'); }
    if (id === 'yildirim') { P.poly([[x + 9, y], [x + 3, y + 9], [x + 8, y + 9], [x + 6, y + 16], [x + 13, y + 6], [x + 8, y + 6]], '#fff36b'); }
    if (id === 'ay') { P.circ(x + 8, y + 8, 6, '#e6d8ff'); ctx.fillStyle = 'rgba(10,8,20,1)'; ctx.beginPath(); ctx.arc(x + 11, y + 6, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  U.spellIcon = spellIcon;

  function minimap(ctx, L, x, y) {
    const m = L.map;
    if (!m._mini) {
      const [c, cx] = E.canvas(m.w, m.h);
      const img = cx.createImageData(m.w, m.h);
      for (let i = 0; i < m.w * m.h; i++) {
        const v = m.t[i];
        const col = v === 0 || v === 3 ? [120, 110, 150, 200] : [0, 0, 0, 0];
        img.data.set(col, i * 4);
      }
      cx.putImageData(img, 0, 0);
      m._mini = c;
    }
    ctx.fillStyle = 'rgba(8,6,16,0.6)'; ctx.fillRect(x - 2, y - 2, m.w + 4, m.h + 4);
    ctx.drawImage(m._mini, x, y);
    const T = E.TILE;
    if (L.exitOpen) { ctx.fillStyle = Math.floor(G().time * 4) % 2 ? '#d9c8ff' : '#fff'; ctx.fillRect(x + Math.floor(m.exitSpot.x / T) - 1, y + Math.floor(m.exitSpot.y / T) - 1, 3, 3); }
    ctx.fillStyle = '#ff5a5a';
    for (const e of L.enemies) if (e.aggro || e.boss) ctx.fillRect(x + Math.floor(e.x / T), y + Math.floor(e.y / T), 1, 1);
    ctx.fillStyle = '#7dff8a'; ctx.fillRect(x + Math.floor(L.player.x / T) - 1, y + Math.floor(L.player.y / T) - 1, 2, 2);
  }

  // ======================= EKRANLAR =======================
  const SCREENS = {};
  U.draw = ctx => {
    const g = G();
    if (g.screen === 'intro') return drawIntro(ctx);
    if (g.screen === 'ending') return drawEnding(ctx);
    for (let i = 0; i < U.stack.length; i++) {
      const s = U.stack[i];
      const isTop = i === U.stack.length - 1;
      const fn = SCREENS[s.name];
      if (!fn) continue;
      if (!isTop) { fn(ctx, s, false); continue; }
      fn(ctx, s, true);
    }
  };

  // ---------------- BAŞLIK ----------------
  const titleStars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.7, s: Math.random() }));
  SCREENS.title = (ctx, s, active) => {
    const V = E.view, g = G();
    E.music.play('title');
    // gökyüzü
    const grd = ctx.createLinearGradient(0, 0, 0, V.h);
    grd.addColorStop(0, '#0a0718'); grd.addColorStop(0.6, '#2a1848'); grd.addColorStop(1, '#5a2a5a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, V.w, V.h);
    for (const st of titleStars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(g.time * (0.5 + st.s) + st.s * 10)); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(st.x * V.w), Math.round(st.y * V.h), 1, 1); }
    ctx.globalAlpha = 1;
    // ay
    const moon = E.gfx.moon(64);
    const glow = ctx.createRadialGradient(V.w * 0.72, V.h * 0.3, 5, V.w * 0.72, V.h * 0.3, 80);
    glow.addColorStop(0, 'rgba(217,200,255,0.35)'); glow.addColorStop(1, 'rgba(217,200,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, V.w, V.h);
    ctx.drawImage(moon, Math.round(V.w * 0.72 - 32), Math.round(V.h * 0.3 - 32));
    // dağlar ve torii silueti
    ctx.fillStyle = '#1a0f2a';
    ctx.beginPath(); ctx.moveTo(0, V.h);
    for (let x = 0; x <= V.w; x += 8) ctx.lineTo(x, V.h * 0.72 - Math.sin(x * 0.02) * 18 - Math.sin(x * 0.051) * 9);
    ctx.lineTo(V.w, V.h); ctx.fill();
    ctx.fillStyle = '#0d0818';
    ctx.fillRect(0, V.h * 0.86, V.w, V.h);
    const tx = V.w * 0.18, ty = V.h * 0.86;
    ctx.fillRect(tx, ty - 46, 4, 46); ctx.fillRect(tx + 36, ty - 46, 4, 46); ctx.fillRect(tx - 6, ty - 50, 52, 5); ctx.fillRect(tx - 2, ty - 40, 44, 3);
    // yapraklar
    for (let i = 0; i < 24; i++) { const px = (i * 53 + g.time * 18) % (V.w + 20) - 10, py = (i * 37 + g.time * (12 + i % 5 * 3)) % V.h; ctx.fillStyle = i % 2 ? '#ffb7cf' : '#ff9abb'; ctx.fillRect(Math.round(px + Math.sin(g.time + i) * 6), Math.round(py), 2, 1); }
    // logo
    const ly = Math.round(V.h * 0.2);
    const pulse = Math.sin(g.time * 1.5) * 0.5 + 0.5;
    F().draw(ctx, 'ECLYRA', V.w * 0.36, ly, '#2a1050', { align: 'center', scale: 5 });
    F().draw(ctx, 'ECLYRA', V.w * 0.36 - 2, ly - 2, E.mix('#c9a7ff', '#ffffff', pulse * 0.4), { align: 'center', scale: 5, outline: '#3a1a6a' });
    F().draw(ctx, 'AYIN KUYUSU', V.w * 0.36, ly + 40, '#ffd98a', { align: 'center', scale: 1, outline: '#2a1050' });
    // menü
    if (!active) return;
    const items = [];
    if (g.hasSave) items.push({ label: 'Devam Et', a: 'cont' });
    items.push({ label: 'Yeni Oyun', a: 'new' }, { label: 'Ayarlar', a: 'set' }, { label: 'Çıkış', a: 'quit' });
    const mw = 110, mx = Math.round(V.w * 0.36 - mw / 2), my = Math.round(V.h * 0.5);
    const act = menu(ctx, s, items, mx, my, mw);
    if (g.hasSave && g.save) F().draw(ctx, `Sv ${g.save.level} · ${g.save.maxFloor}. basamak · ${g.save.bosses}/10 Ay Parçası`, V.w * 0.36, my - 12, C.dim, { align: 'center' });
    F().draw(ctx, 'v1.0 · Enskygr234', V.w - 4, V.h - 10, '#6a5a8a', { align: 'right' });
    if (act >= 0) {
      const a = items[act].a;
      if (a === 'cont') { E.ui.close(); g.continueGame(); }
      if (a === 'new') { if (g.hasSave) U.open('confirm', { text: 'Kayıtlı oyunun silinecek. Emin misin?', yes: () => { U.closeAll(); g.newGame(); } }); else { U.closeAll(); g.newGame(); } }
      if (a === 'set') U.open('settings');
      if (a === 'quit') { if (window.eclyra && window.eclyra.quit) window.eclyra.quit(); else window.close(); }
    }
  };

  // ---------------- GİRİŞ HİKÂYESİ ----------------
  function drawIntro(ctx) {
    const g = G(), V = E.view;
    g.introT = (g.introT || 0);
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, V.w, V.h);
    const lines = E.STORY.intro;
    const per = 2.6;
    const shown = Math.min(lines.length, Math.floor(g.introT / per) + 1);
    const moon = E.gfx.moon(64);
    ctx.globalAlpha = Math.min(1, g.introT / 2) * 0.8; ctx.drawImage(moon, V.w / 2 - 32, 20); ctx.globalAlpha = 1;
    for (let i = 0; i < shown; i++) {
      const a = Math.min(1, (g.introT - i * per) / 1);
      ctx.globalAlpha = a;
      F().draw(ctx, lines[i], V.w / 2, 100 + i * 16, i === lines.length - 1 ? '#ffd98a' : '#e6dcff', { align: 'center' });
    }
    ctx.globalAlpha = 1;
    F().draw(ctx, 'Enter: geç', V.w - 6, V.h - 12, '#6a5a8a', { align: 'right' });
    g.introT += 1 / 60;
    if (confirm() || mouse().clicked || I().hit('Escape') || g.introT > lines.length * per + 2.5) {
      if (g.introT < lines.length * per && !I().hit('Escape')) { g.introT = Math.ceil(g.introT / per) * per; return; }
      g.save.introSeen = true;
      g.fade(() => { g.enterVillage(); g.toast('Tapınaktaki Bilge Nene ile konuş (E).', '#ffd98a'); });
      g.screen = 'fading';
    }
  }

  // ---------------- SON ----------------
  function drawEnding(ctx) {
    const g = G(), V = E.view;
    g.endT = (g.endT || 0) + 1 / 60;
    const grd = ctx.createLinearGradient(0, 0, 0, V.h);
    grd.addColorStop(0, '#120a28'); grd.addColorStop(1, '#4a2a5a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, V.w, V.h);
    const moon = E.gfx.moon(64);
    ctx.drawImage(moon, V.w / 2 - 32, 16 + Math.sin(g.endT) * 2);
    const lines = E.STORY.ending;
    lines.forEach((l, i) => { ctx.globalAlpha = E.clamp((g.endT - i * 2.5) / 1.5, 0, 1); F().draw(ctx, l, V.w / 2, 100 + i * 16, i === lines.length - 1 ? '#ffd98a' : '#fff', { align: 'center' }); });
    ctx.globalAlpha = 1;
    const S = g.save;
    if (g.endT > lines.length * 2.5) {
      F().draw(ctx, `Oyun süresi: ${Math.floor(S.playTime / 3600)} sa ${Math.floor(S.playTime % 3600 / 60)} dk · Seviye ${S.level} · ${S.kills} düşman`, V.w / 2, V.h - 40, C.dim, { align: 'center' });
      F().draw(ctx, 'Enter: köye dön', V.w / 2, V.h - 24, C.sel, { align: 'center' });
      if (confirm() || mouse().clicked) { g.fade(() => g.enterVillage('dungeon')); g.screen = 'fading'; }
    }
  }

  // ---------------- DİYALOG ----------------
  SCREENS.dialog = (ctx, s, active) => {
    const V = E.view;
    const ln = s.lines[s.i];
    const w = Math.min(380, V.w - 20), h = 56, x = Math.round(V.w / 2 - w / 2), y = V.h - h - 34;
    panel(ctx, x, y, w, h);
    const npcId = { 'Bilge Nene': 'nene', 'Demirci Tetsu': 'tetsu', 'Tüccar Mina': 'mina', 'Balıkçı Haru': 'koylu1', 'Çiçekçi Aiko': 'koylu2', 'Küçük Taro': 'cocuk' }[ln.who];
    let tx = x + 8;
    if (npcId) { ctx.fillStyle = 'rgba(60,46,100,0.7)'; ctx.fillRect(x + 6, y + 6, 40, 44); ctx.drawImage(E.gfx.npc(npcId, 0), x + 8, y + 6, 36, 47); tx = x + 52; }
    else if (ln.who === 'Ay Parçası') { ctx.drawImage(E.gfx.itemIcon('parca', '#fff'), x + 10, y + 14, 28, 28); tx = x + 52; }
    F().draw(ctx, ln.who, tx, y + 6, C.sel);
    const full = ln.text;
    const n = Math.min(full.length, Math.floor(s.t * 60));
    const rows = F().wrap(full.slice(0, n), w - (tx - x) - 10);
    rows.slice(0, 3).forEach((r, i) => F().draw(ctx, r, tx, y + 18 + i * 10, C.text));
    if (n >= full.length) F().draw(ctx, s.i < s.lines.length - 1 ? '▼' : '✓', x + w - 10, y + h - 11 + Math.round(Math.sin(G().time * 6)), C.sel);
    if (!active) return;
    if (confirm() || mouse().clicked || back()) {
      if (n < full.length && !back()) { s.t = 999; return; }
      s.i++; s.t = 0; E.sfx('ui');
      if (s.i >= s.lines.length || back()) { U.close(); if (s.then) s.then(); }
    }
  };

  // ---------------- ONAY ----------------
  SCREENS.confirm = (ctx, s, active) => {
    const V = E.view;
    const w = 220, h = 62, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, V.w, V.h);
    panel(ctx, x, y, w, h, 'Emin misin?');
    F().wrap(s.text, w - 16).forEach((l, i) => F().draw(ctx, l, V.w / 2, y + 19 + i * 9, C.text, { align: 'center' }));
    if (!active) return;
    if (I().hit('ArrowLeft') || I().hit('ArrowRight') || I().hit('KeyA') || I().hit('KeyD')) s.sel = 1 - s.sel;
    const a = button(ctx, x + 16, y + h - 20, 84, 14, 'Evet', { sel: s.sel === 0 });
    const b = button(ctx, x + w - 100, y + h - 20, 84, 14, 'Hayır', { sel: s.sel === 1 });
    if (a.hover && mouse().moved) s.sel = 0; if (b.hover && mouse().moved) s.sel = 1;
    if (a.clicked || (confirm() && s.sel === 0)) { E.sfx('uiok'); U.close(); s.yes(); }
    else if (b.clicked || (confirm() && s.sel === 1) || back()) { E.sfx('ui'); U.close(); }
  };

  // ---------------- DURAKLAT ----------------
  SCREENS.pause = (ctx, s, active) => {
    const V = E.view, g = G(), L = g.L;
    ctx.fillStyle = 'rgba(5,3,12,0.6)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = 150, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - 66);
    panel(ctx, x, y, w, 132, 'DURAKLATILDI');
    if (!active) return;
    const items = [{ label: 'Devam Et', a: 'res' }, { label: 'Envanter', a: 'inv' }, { label: 'Ayarlar', a: 'set' }];
    if (L && !L.village) items.push({ label: 'Köye Dön', a: 'home' });
    items.push({ label: 'Ana Menü', a: 'menu' });
    const act = menu(ctx, s, items, x + 15, y + 22, w - 30);
    if (back() && s.t > 0.1) { U.close(); return; }
    if (act >= 0) {
      const a = items[act].a;
      if (a === 'res') U.close();
      if (a === 'inv') { U.close(); U.open('inventory'); }
      if (a === 'set') U.open('settings');
      if (a === 'home') U.open('confirm', { text: 'Bu basamaktaki ilerleme kaybolur, topladıkların kalır.', yes: () => { U.closeAll(); g.fade(() => g.enterVillage('dungeon')); } });
      if (a === 'menu') { g.persist(true); U.closeAll(); g.screen = 'title'; g.L = null; U.open('title'); }
    }
  };

  // ---------------- AYARLAR ----------------
  SCREENS.settings = (ctx, s, active) => {
    const V = E.view, g = G(), st = g.settings;
    ctx.fillStyle = 'rgba(5,3,12,0.6)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = 240, h = 176, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    panel(ctx, x, y, w, h, 'AYARLAR');
    const rows = [
      { label: 'Müzik', k: 'music', type: 'vol' },
      { label: 'Efektler', k: 'sfx', type: 'vol' },
      { label: 'Tam ekran', k: 'fullscreen', type: 'bool' },
      { label: 'Ekran sarsıntısı', k: 'shake', type: 'bool' },
      { label: 'Hasar sayıları', k: 'numbers', type: 'bool' },
      { label: 'Geri', type: 'back' }
    ];
    if (active) navList(s, rows.length);
    rows.forEach((r, i) => {
      const yy = y + 22 + i * 18;
      const sel = s.sel === i;
      if (active && inRect(x + 8, yy - 3, w - 16, 15) && mouse().moved) s.sel = i;
      ctx.fillStyle = sel ? 'rgba(90,70,150,0.6)' : 'rgba(0,0,0,0)'; ctx.fillRect(x + 8, yy - 3, w - 16, 15);
      F().draw(ctx, r.label, x + 16, yy + 1, sel ? '#fff' : C.text);
      if (r.type === 'vol') {
        bar(ctx, x + 120, yy + 2, 90, 5, st[r.k], 1, C.sel);
        F().draw(ctx, Math.round(st[r.k] * 100) + '%', x + w - 12, yy + 1, C.dim, { align: 'right' });
        if (active && sel) {
          let d = 0;
          if (I().hit('ArrowLeft') || I().hit('KeyA')) d = -0.1; if (I().hit('ArrowRight') || I().hit('KeyD')) d = 0.1;
          if (mouse().down && inRect(x + 118, yy - 2, 94, 12)) { st[r.k] = E.clamp((mouse().x - x - 120) / 90, 0, 1); g.saveSettings(); }
          if (d) { st[r.k] = Math.round(E.clamp(st[r.k] + d, 0, 1) * 10) / 10; g.saveSettings(); E.sfx('ui'); }
        }
      } else if (r.type === 'bool') {
        F().draw(ctx, st[r.k] ? 'AÇIK' : 'KAPALI', x + w - 12, yy + 1, st[r.k] ? C.good : C.bad, { align: 'right' });
        if (active && sel && (confirm() || I().hit('ArrowLeft') || I().hit('ArrowRight') || (mouse().clicked && inRect(x + 8, yy - 3, w - 16, 15)))) {
          st[r.k] = !st[r.k]; g.saveSettings(); E.sfx('ui');
          if (r.k === 'fullscreen') E.setFullscreen(st.fullscreen);
        }
      } else if (active && sel && (confirm() || (mouse().clicked && inRect(x + 8, yy - 3, w - 16, 15)))) { U.close(); E.sfx('ui'); return; }
    });
    const kb = I().padUsed ? 'Kol: A seç · B geri' : 'F11: tam ekran · Esc: geri';
    F().draw(ctx, kb, V.w / 2, y + h - 12, C.dim, { align: 'center' });
    if (active && back()) U.close();
  };

  // ---------------- ENVANTER ----------------
  SCREENS.inventory = (ctx, s, active) => {
    const V = E.view, g = G(), S = g.save, L = g.L;
    ctx.fillStyle = 'rgba(5,3,12,0.65)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = 372, h = 226, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    panel(ctx, x, y, w, h, 'ENVANTER');
    // sol: kuşanılanlar + statlar
    const ex = x + 10, ey = y + 22;
    F().draw(ctx, 'Kuşanılanlar', ex, ey - 3, C.dim);
    const eqPos = E.SLOTS.map((sl, i) => [ex + (i % 4) * 24, ey + 8 + Math.floor(i / 4) * 24]);
    const st = L ? L.player.stats : E.items.playerStats(S);
    const lines = [
      ['Can', E.fmt(st.maxHp)], ['Hasar', E.fmt(st.dmg)], ['Savunma', E.fmt(st.def)], ['Kritik', E.pct(st.crit) + ' ×' + st.critDmg.toFixed(2).replace('.', ',')],
      ['Saldırı hızı', E.pct(st.atkSpd)], ['Hareket', E.pct(st.move)], ['Mana', E.fmt(st.maxMana)], ['Büyü gücü', E.fmt(st.spell)],
      ['Can çalma', E.pct(st.lifesteal)], ['Bekleme azaltma', E.pct(st.cdr)], ['Altın bulma', E.pct(st.goldFind)], ['Eşya bulma', E.pct(st.magicFind)]
    ];
    lines.forEach(([k, v], i) => { F().draw(ctx, k, ex, ey + 60 + i * 10, C.dim); F().draw(ctx, v, ex + 120, ey + 60 + i * 10, C.text, { align: 'right' }); });
    if (st.perks.size) F().draw(ctx, '★ ' + [...st.perks].map(p => E.PERKS[p].name).join(', '), ex, ey + 60 + lines.length * 10 + 2, '#ffa53b');
    // sağ: çanta (8x4)
    const gx = x + 150, gy = y + 30, cols = 8;
    F().draw(ctx, `Çanta ${S.inv.length}/${E.INV_MAX}`, gx, gy - 11, C.dim);
    F().draw(ctx, `İksir: ${S.potions}/5`, gx + 8 * 26 - 4, gy - 11, '#ff8aa0', { align: 'right' });
    // seçim: 0-6 kuşanılan, 7.. çanta
    const total = 7 + E.INV_MAX;
    if (active) {
      const k = s.sel;
      const move = (dx, dy) => {
        if (k < 7) { let c = k % 4, r = Math.floor(k / 4); c += dx; r += dy; if (c > 3) { s.sel = 7; return; } c = E.clamp(c, 0, 3); r = E.clamp(r, 0, 1); s.sel = Math.min(6, r * 4 + c); }
        else { const i = k - 7; let c = i % cols, r = Math.floor(i / cols); c += dx; r += dy; if (c < 0) { s.sel = Math.min(6, Math.min(r, 1) * 4 + 3); return; } c = E.clamp(c, 0, cols - 1); r = E.clamp(r, 0, 3); s.sel = 7 + r * cols + c; }
      };
      if (I().hit('ArrowLeft') || I().hit('KeyA')) move(-1, 0);
      if (I().hit('ArrowRight') || I().hit('KeyD')) move(1, 0);
      if (I().hit('ArrowUp') || I().hit('KeyW')) move(0, -1);
      if (I().hit('ArrowDown') || I().hit('KeyS')) move(0, 1);
      s.sel = E.clamp(s.sel, 0, total - 1);
    }
    let hoverItem = null, hoverPos = null;
    E.SLOTS.forEach((sl, i) => {
      const [sx, sy] = eqPos[i];
      const it = S.equip[sl];
      const h2 = itemSlot(ctx, sx, sy, it, { sel: s.sel === i, ghost: sl });
      if (h2 && mouse().moved) s.sel = i;
      if (s.sel === i) { hoverItem = it; hoverPos = [sx + 24, sy]; }
      if (h2 && mouse().clicked && it && active) { unequip(sl); }
    });
    for (let i = 0; i < E.INV_MAX; i++) {
      const sx = gx + (i % cols) * 26, sy = gy + Math.floor(i / cols) * 26;
      const it = S.inv[i];
      const h2 = itemSlot(ctx, sx, sy, it, { sel: s.sel === 7 + i });
      if (h2 && mouse().moved) s.sel = 7 + i;
      if (s.sel === 7 + i) { hoverItem = it; hoverPos = [sx + 24, sy]; }
      if (h2 && active && it) {
        if (mouse().clicked) equip(i);
        if (mouse().rclicked) salvageAsk(i);
      }
    }
    // alt bilgi
    const help = I().padUsed ? 'A: kuşan/çıkar · X: parçala · B: kapat' : 'Tık/Enter: kuşan · Sağ tık/X: parçala · Esc: kapat';
    F().draw(ctx, help, x + w / 2, y + h - 12, C.dim, { align: 'center' });
    if (active) {
      if (confirm()) {
        if (s.sel < 7) { if (S.equip[E.SLOTS[s.sel]]) unequip(E.SLOTS[s.sel]); }
        else if (S.inv[s.sel - 7]) equip(s.sel - 7);
      }
      if ((I().hit('KeyX') || I().hit('PadX') || I().hit('Delete')) && s.sel >= 7 && S.inv[s.sel - 7]) salvageAsk(s.sel - 7);
      if ((back() || I().hit('KeyI') || I().hit('Tab') || I().hit('PadSelect')) && s.t > 0.1) { U.close(); E.sfx('ui'); }
    }
    if (hoverItem && active) tooltip(ctx, hoverItem, hoverPos[0], hoverPos[1], s.sel >= 7 ? (S.equip[hoverItem.slot] || null) : undefined);
  };

  function refreshPlayer() { const L = G().L; if (L) L.player.refresh(false); G().persist(); }
  function equip(i) {
    const S = G().save;
    const it = S.inv[i];
    const old = S.equip[it.slot];
    S.equip[it.slot] = it;
    if (old) S.inv[i] = old; else S.inv.splice(i, 1);
    E.sfx('uiok'); refreshPlayer();
  }
  function unequip(slot) {
    const S = G().save;
    if (S.inv.length >= E.INV_MAX) { G().toast('Çanta dolu!', C.bad); E.sfx('uino'); return; }
    S.inv.push(S.equip[slot]); delete S.equip[slot];
    E.sfx('ui'); refreshPlayer();
  }
  function salvage(i) {
    const S = G().save, it = S.inv[i];
    const v = E.items.salvage(it);
    S.ore += v.ore; S.souls += v.souls;
    S.inv.splice(i, 1);
    G().toast(`${it.name} parçalandı: +${v.ore} demir${v.souls ? `, +${v.souls} ruh taşı` : ''}`, '#c8ccd8');
    E.sfx('anvil'); G().persist();
  }
  function salvageAsk(i) {
    const it = G().save.inv[i];
    if (it.rarity >= 2) U.open('confirm', { text: `${it.name} (${E.RARITY[it.rarity].name}) parçalansın mı?`, yes: () => salvage(i) });
    else salvage(i);
  }

  // ---------------- DÜKKÂN (Mina) ----------------
  SCREENS.shop = (ctx, s, active) => {
    const V = E.view, g = G(), S = g.save;
    ctx.fillStyle = 'rgba(5,3,12,0.65)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = 372, h = 220, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    panel(ctx, x, y, w, h, 'TÜCCAR MİNA');
    s.tab = s.tab || 0;
    const tabs = ['Satın Al', 'Sat'];
    tabs.forEach((t, i) => { const b = button(ctx, x + 10 + i * 64, y + 18, 60, 13, t, { sel: s.tab === i, arrow: false }); if (b.clicked) { s.tab = i; s.sel = 0; } });
    if (active && (I().hit('KeyQ') || I().hit('KeyE') && false || I().hit('PadLB') || I().hit('PadRB') || I().hit('Tab'))) { s.tab = 1 - s.tab; s.sel = 0; E.sfx('ui'); }
    F().draw(ctx, `${E.fmt(S.gold)} altın`, x + w - 10, y + 21, C.gold, { align: 'right' });
    const pp = E.items.potionPrice(S.maxFloor), cp = E.items.chestPrice(S.maxFloor);
    if (s.tab === 0) {
      const lvl = Math.max(1, S.maxFloor);
      const offers = [
        { name: 'İksir', desc: 'Canın %45\'ini doldurur. En fazla 5 taşınır.', price: pp, icon: 'iksir', ok: S.potions < 5, buy: () => { S.potions++; } },
        { name: 'İksirleri doldur', desc: `İksir sayını 5'e tamamlar.`, price: pp * Math.max(0, 5 - S.potions), icon: 'iksir', ok: S.potions < 5, buy: () => { S.potions = 5; } },
        { name: 'Gizemli Sandık', desc: `${lvl}. basamak seviyesinde rastgele bir eşya.`, price: cp, icon: 'sandik', ok: S.inv.length < E.INV_MAX, buy: () => giveItem(E.items.roll(lvl)) },
        { name: 'Altın Sandık', desc: 'En az Nadir, Destansı şansı yüksek bir eşya.', price: cp * 4, icon: 'sandik', ok: S.inv.length < E.INV_MAX, buy: () => giveItem(E.items.roll(lvl, { minRarity: 1, boost: 3 })) },
        { name: 'Demir (10)', desc: 'Demirci yükseltmeleri için.', price: Math.round(cp * 0.6), icon: 'demir', ok: true, buy: () => { S.ore += 10; } }
      ];
      if (active) navList(s, offers.length);
      offers.forEach((o, i) => {
        const yy = y + 38 + i * 30;
        const sel = s.sel === i, can = o.ok && S.gold >= o.price;
        if (active && inRect(x + 10, yy, w - 20, 27) && mouse().moved) s.sel = i;
        ctx.fillStyle = sel ? 'rgba(90,70,150,0.7)' : 'rgba(30,24,48,0.8)'; ctx.fillRect(x + 10, yy, w - 20, 27);
        ctx.drawImage(E.gfx.itemIcon(o.icon, o.icon === 'sandik' && i === 3 ? '#ffd23b' : '#ff4a6a'), x + 16, yy + 6);
        F().draw(ctx, o.name, x + 36, yy + 5, sel ? '#fff' : C.text);
        F().draw(ctx, o.desc, x + 36, yy + 15, C.dim);
        F().draw(ctx, E.fmt(o.price) + ' altın', x + w - 16, yy + 10, can ? C.gold : '#8a6a6a', { align: 'right' });
        if (active && sel && (confirm() || (mouse().clicked && inRect(x + 10, yy, w - 20, 27)))) {
          if (!can) { E.sfx('uino'); g.toast(!o.ok ? (o.icon === 'iksir' ? 'İksir taşıma sınırındasın.' : 'Çanta dolu!') : 'Yeterli altının yok.', C.bad); }
          else { S.gold -= o.price; o.buy(); E.sfx('coin'); g.persist(); }
        }
      });
    } else {
      const inv = S.inv;
      const n = inv.length + 1;
      if (active) navList(s, n);
      const lh = 12, top = y + 38, maxRows = 13;
      const start = E.clamp(s.sel - maxRows + 2, 0, Math.max(0, n - maxRows));
      // toplu satış
      const commons = inv.filter(i => i.rarity === 0);
      const bulkPrice = commons.reduce((a, i) => a + E.items.sellPrice(i), 0);
      for (let r = 0; r < Math.min(maxRows, n - start); r++) {
        const i = start + r;
        const yy = top + r * lh;
        const sel = s.sel === i;
        if (active && inRect(x + 10, yy - 2, 210, lh) && mouse().moved) s.sel = i;
        ctx.fillStyle = sel ? 'rgba(90,70,150,0.7)' : 'rgba(0,0,0,0)'; ctx.fillRect(x + 10, yy - 2, 210, lh);
        if (i === 0) {
          F().draw(ctx, `Tüm Sıradanları sat (${commons.length})`, x + 14, yy, commons.length ? '#ddd' : '#666');
          F().draw(ctx, E.fmt(bulkPrice), x + 216, yy, C.gold, { align: 'right' });
          if (active && sel && commons.length && (confirm() || (mouse().clicked && inRect(x + 10, yy - 2, 210, lh)))) { S.gold += bulkPrice; S.inv = inv.filter(it => it.rarity !== 0); E.sfx('coin'); g.persist(); s.sel = 0; }
        } else {
          const it = inv[i - 1];
          F().draw(ctx, it.name + (it.plus ? ` +${it.plus}` : ''), x + 14, yy, E.RARITY[it.rarity].color);
          F().draw(ctx, E.fmt(E.items.sellPrice(it)), x + 216, yy, C.gold, { align: 'right' });
          if (active && sel && (confirm() || (mouse().clicked && inRect(x + 10, yy - 2, 210, lh)))) {
            const sell = () => { S.gold += E.items.sellPrice(it); S.inv.splice(S.inv.indexOf(it), 1); E.sfx('coin'); g.persist(); s.sel = Math.min(s.sel, S.inv.length); };
            if (it.rarity >= 2) U.open('confirm', { text: `${it.name} satılsın mı?`, yes: sell }); else sell();
          }
        }
      }
      if (!inv.length) F().draw(ctx, 'Satılacak eşya yok.', x + 14, top + 14, C.dim);
      const it = s.sel > 0 ? inv[s.sel - 1] : null;
      if (it) tooltip(ctx, it, x + 228, y + 38, S.equip[it.slot] || null);
    }
    F().draw(ctx, 'Q/Tab: sekme · Esc: kapat', x + w / 2, y + h - 12, C.dim, { align: 'center' });
    if (active && back()) U.close();
  };
  function giveItem(it) {
    const g = G();
    g.save.inv.push(it);
    E.sfx(it.rarity >= 3 ? 'legend' : it.rarity >= 1 ? 'rare' : 'pickup');
    g.toast(`${it.name} (${E.RARITY[it.rarity].name})`, E.RARITY[it.rarity].color, it);
  }

  // ---------------- DEMİRCİ (Tetsu) ----------------
  SCREENS.smith = (ctx, s, active) => {
    const V = E.view, g = G(), S = g.save;
    ctx.fillStyle = 'rgba(5,3,12,0.65)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = 372, h = 220, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    panel(ctx, x, y, w, h, 'DEMİRCİ TETSU');
    s.tab = s.tab || 0;
    ['Yükselt', 'Parçala'].forEach((t, i) => { const b = button(ctx, x + 10 + i * 64, y + 18, 60, 13, t, { sel: s.tab === i, arrow: false }); if (b.clicked) { s.tab = i; s.sel = 0; } });
    if (active && (I().hit('KeyQ') || I().hit('PadLB') || I().hit('PadRB') || I().hit('Tab'))) { s.tab = 1 - s.tab; s.sel = 0; E.sfx('ui'); }
    F().draw(ctx, `${E.fmt(S.gold)} altın · ${E.fmt(S.ore)} demir · ${S.souls} ruh`, x + w - 10, y + 21, C.gold, { align: 'right' });
    if (s.tab === 0) {
      const slots = E.SLOTS;
      if (active) navList(s, slots.length);
      slots.forEach((sl, i) => {
        const it = S.equip[sl];
        const yy = y + 38 + i * 24;
        const sel = s.sel === i;
        if (active && inRect(x + 10, yy, 220, 21) && mouse().moved) s.sel = i;
        ctx.fillStyle = sel ? 'rgba(90,70,150,0.7)' : 'rgba(30,24,48,0.8)'; ctx.fillRect(x + 10, yy, 220, 21);
        if (!it) { F().draw(ctx, `${E.SLOT_NAME[sl]}: boş`, x + 16, yy + 7, '#666'); return; }
        ctx.drawImage(E.gfx.itemIcon(sl, E.RARITY[it.rarity].color, it.icon), x + 14, yy + 3);
        F().draw(ctx, it.name + (it.plus ? ` +${it.plus}` : ''), x + 32, yy + 3, E.RARITY[it.rarity].color);
        if (it.plus >= 10) { F().draw(ctx, 'En yüksek seviye', x + 32, yy + 12, C.good); return; }
        const c = E.items.upgradeCost(it);
        const can = S.gold >= c.gold && S.ore >= c.ore;
        F().draw(ctx, `+${it.plus + 1}: ${E.fmt(c.gold)} altın, ${c.ore} demir`, x + 32, yy + 12, can ? C.dim : '#a06a6a');
        if (active && sel && (confirm() || (mouse().clicked && inRect(x + 10, yy, 220, 21)))) {
          if (!can) { E.sfx('uino'); g.toast('Yeterli altın ya da demir yok.', C.bad); }
          else { S.gold -= c.gold; S.ore -= c.ore; it.plus++; E.sfx('anvil'); g.toast(`${it.name} +${it.plus} oldu!`, C.sel); refreshPlayer(); }
        }
      });
      const it = S.equip[slots[s.sel]];
      if (it) tooltip(ctx, it, x + 238, y + 38);
      F().draw(ctx, 'Her +1, eşyanın değerlerini %10 artırır.', x + w / 2, y + h - 22, C.dim, { align: 'center' });
    } else {
      const inv = S.inv;
      const n = inv.length + 1;
      if (active) navList(s, n);
      const lh = 12, top = y + 38, maxRows = 13;
      const start = E.clamp(s.sel - maxRows + 2, 0, Math.max(0, n - maxRows));
      const commons = inv.filter(i => i.rarity === 0);
      for (let r = 0; r < Math.min(maxRows, n - start); r++) {
        const i = start + r, yy = top + r * lh, sel = s.sel === i;
        if (active && inRect(x + 10, yy - 2, 210, lh) && mouse().moved) s.sel = i;
        ctx.fillStyle = sel ? 'rgba(90,70,150,0.7)' : 'rgba(0,0,0,0)'; ctx.fillRect(x + 10, yy - 2, 210, lh);
        if (i === 0) {
          const ore = commons.reduce((a, it) => a + E.items.salvage(it).ore, 0);
          F().draw(ctx, `Tüm Sıradanları parçala (${commons.length})`, x + 14, yy, commons.length ? '#ddd' : '#666');
          F().draw(ctx, `+${ore} demir`, x + 216, yy, '#c8ccd8', { align: 'right' });
          if (active && sel && commons.length && (confirm() || (mouse().clicked && inRect(x + 10, yy - 2, 210, lh)))) { S.ore += ore; S.inv = inv.filter(it => it.rarity !== 0); E.sfx('anvil'); g.persist(); }
        } else {
          const it = inv[i - 1], v = E.items.salvage(it);
          F().draw(ctx, it.name + (it.plus ? ` +${it.plus}` : ''), x + 14, yy, E.RARITY[it.rarity].color);
          F().draw(ctx, `+${v.ore}${v.souls ? ` +${v.souls}r` : ''}`, x + 216, yy, '#c8ccd8', { align: 'right' });
          if (active && sel && (confirm() || (mouse().clicked && inRect(x + 10, yy - 2, 210, lh)))) { salvageAsk(S.inv.indexOf(it)); s.sel = Math.min(s.sel, S.inv.length); }
        }
      }
      const it = s.sel > 0 ? inv[s.sel - 1] : null;
      if (it) tooltip(ctx, it, x + 228, y + 38, S.equip[it.slot] || null);
    }
    F().draw(ctx, 'Q/Tab: sekme · Esc: kapat', x + w / 2, y + h - 12, C.dim, { align: 'center' });
    if (active && back()) U.close();
  };

  // ---------------- TAPINAK (Nene) ----------------
  SCREENS.shrine = (ctx, s, active) => {
    const V = E.view, g = G(), S = g.save;
    ctx.fillStyle = 'rgba(5,3,12,0.65)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = 330, h = 200, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    panel(ctx, x, y, w, h, 'AY TAPINAĞI');
    F().draw(ctx, `Ay Parçaları: ${S.bosses}/10`, x + 10, y + 20, '#e6d8ff');
    F().draw(ctx, `${S.souls} ruh taşı · ${E.fmt(S.gold)} altın`, x + w - 10, y + 20, '#c9a7ff', { align: 'right' });
    const items = E.SPELLS;
    if (active) navList(s, items.length + 1);
    items.forEach((sp, i) => {
      const lvl = S.spells[sp.id] || 0;
      const yy = y + 34 + i * 34, sel = s.sel === i;
      if (active && inRect(x + 10, yy, w - 20, 30) && mouse().moved) s.sel = i;
      ctx.fillStyle = sel ? 'rgba(90,70,150,0.7)' : 'rgba(30,24,48,0.8)'; ctx.fillRect(x + 10, yy, w - 20, 30);
      spellIcon(ctx, sp.id, x + 16, yy + 7, !lvl);
      F().draw(ctx, `${sp.name}${lvl ? ` (Sv ${lvl})` : ''}  [${sp.key}]`, x + 38, yy + 4, lvl ? '#fff' : '#777');
      F().draw(ctx, lvl ? sp.desc : `${[0, 1, 3, 6][i]}. Mühürdar'ı yenince açılır.`, x + 38, yy + 14, C.dim);
      F().draw(ctx, `${sp.mana} mana · ${sp.cd} sn`, x + 38, yy + 22, '#7a8ab0');
      if (lvl && lvl < 10) {
        const c = E.items.spellCost(lvl);
        const can = S.souls >= c.souls && S.gold >= c.gold;
        F().draw(ctx, `Yükselt: ${c.souls} ruh, ${E.fmt(c.gold)} altın`, x + w - 16, yy + 10, can ? '#c9a7ff' : '#7a6a8a', { align: 'right' });
        if (active && sel && (confirm() || (mouse().clicked && inRect(x + 10, yy, w - 20, 30)))) {
          if (!can) { E.sfx('uino'); g.toast('Yeterli ruh taşı ya da altın yok. Ruh taşları güçlü düşmanlardan düşer.', C.bad); }
          else { S.souls -= c.souls; S.gold -= c.gold; S.spells[sp.id]++; E.sfx('levelup'); g.toast(`${sp.name} ${S.spells[sp.id]}. seviyeye çıktı!`, '#d9c8ff'); g.persist(); }
        }
      } else if (lvl >= 10) F().draw(ctx, 'Ustalaştın', x + w - 16, yy + 10, C.good, { align: 'right' });
    });
    const by = y + h - 24;
    const r = button(ctx, x + w / 2 - 60, by, 120, 14, 'Hikâyeyi dinle', { sel: s.sel === items.length });
    if (r.hover && mouse().moved) s.sel = items.length;
    if (active && (r.clicked || (confirm() && s.sel === items.length))) {
      const idx = Math.min(10, S.bosses);
      U.close(); g.queueDialog(E.STORY.nene[idx].map(t => ({ who: 'Bilge Nene', text: t })), () => U.open('shrine'));
      return;
    }
    if (active && back()) U.close();
  };

  // ---------------- AY KUYUSU (bölüm seçimi) ----------------
  SCREENS.portal = (ctx, s, active) => {
    const V = E.view, g = G(), S = g.save;
    ctx.fillStyle = 'rgba(5,3,12,0.7)'; ctx.fillRect(0, 0, V.w, V.h);
    const w = 330, h = 210, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    panel(ctx, x, y, w, h, 'AY KUYUSU — DERİNLİK');
    if (s.init !== true) { s.init = true; s.sel = S.maxFloor - 1; s.page = Math.floor((S.maxFloor - 1) / 10); }
    const max = S.maxFloor;
    if (active) {
      if (I().hit('ArrowRight') || I().hit('KeyD')) s.sel = Math.min(max - 1, s.sel + 1);
      if (I().hit('ArrowLeft') || I().hit('KeyA')) s.sel = Math.max(0, s.sel - 1);
      if (I().hit('ArrowDown') || I().hit('KeyS')) s.sel = Math.min(max - 1, s.sel + 5);
      if (I().hit('ArrowUp') || I().hit('KeyW')) s.sel = Math.max(0, s.sel - 5);
      if (I().hit('KeyQ') || I().hit('PadLB')) s.sel = Math.max(0, s.sel - 10);
      if (I().hit('KeyE') && false) void 0;
      if (I().hit('PadRB') || I().hit('Tab')) s.sel = Math.min(max - 1, s.sel + 10);
      s.page = Math.floor(s.sel / 10);
    }
    // bölge sekmeleri
    for (let b = 0; b < 10; b++) {
      const bx = x + 10 + b * 31, open = b * 10 < max;
      const r = button(ctx, bx, y + 18, 29, 12, String(b + 1), { sel: s.page === b, disabled: !open, arrow: false });
      if (r.clicked && open) { s.page = b; s.sel = Math.min(max - 1, b * 10 + (s.sel % 10)); }
    }
    const biome = E.BIOMES[s.page];
    F().draw(ctx, biome.name, x + w / 2, y + 36, biome.accent, { align: 'center', outline: '#000' });
    for (let i = 0; i < 10; i++) {
      const fl = s.page * 10 + i + 1;
      const cx = x + 22 + (i % 5) * 58, cy = y + 50 + Math.floor(i / 5) * 40;
      const open = fl <= max, sel = s.sel === fl - 1, boss = fl % 10 === 0;
      if (active && open && inRect(cx, cy, 52, 34) && mouse().moved) s.sel = fl - 1;
      ctx.fillStyle = !open ? 'rgba(20,16,30,0.9)' : sel ? 'rgba(110,90,170,0.95)' : 'rgba(40,30,66,0.95)';
      ctx.fillRect(cx, cy, 52, 34);
      ctx.fillStyle = sel ? C.sel : boss ? '#ff7a4a' : C.edge;
      ctx.fillRect(cx, cy, 52, 1); ctx.fillRect(cx, cy + 33, 52, 1); ctx.fillRect(cx, cy, 1, 34); ctx.fillRect(cx + 51, cy, 1, 34);
      F().draw(ctx, String(fl), cx + 26, cy + 8, open ? '#fff' : '#555', { align: 'center', scale: 1 });
      F().draw(ctx, boss ? (fl / 10 <= S.bosses ? '✓ Mühürdar' : 'MÜHÜRDAR') : open ? (fl < max ? '✓' : 'yeni') : '—', cx + 26, cy + 20, boss ? '#ff9a6a' : open ? (fl < max ? C.good : C.sel) : '#444', { align: 'center' });
      if (active && open && mouse().clicked && inRect(cx, cy, 52, 34)) { go(fl); return; }
    }
    const fl = s.sel + 1;
    const rec = Math.max(1, Math.round(fl * 0.8));
    F().draw(ctx, `Seçili: ${fl}. basamak · Önerilen seviye ${rec}${S.level < rec - 4 ? ' (zorlanabilirsin!)' : ''}`, x + w / 2, y + h - 34, S.level < rec - 4 ? '#ff9a6a' : C.text, { align: 'center' });
    const r = button(ctx, x + w / 2 - 50, y + h - 22, 100, 14, 'Aşağı in', { sel: true });
    if (active && (r.clicked || confirm())) { go(fl); return; }
    F().draw(ctx, 'Oklar: seç · Q/Tab: bölge · Esc: kapat', x + w / 2, y + h + 4, C.dim, { align: 'center' });
    if (active && back()) U.close();
    function go(f) { E.sfx('portal'); U.closeAll(); g.fade(() => g.enterFloor(f)); }
  };

  // ---------------- ÇIKIŞ PORTALI ----------------
  SCREENS.exit = (ctx, s, active) => {
    const V = E.view, g = G(), L = g.L;
    const w = 180, h = 84, x = Math.round(V.w / 2 - w / 2), y = Math.round(V.h / 2 - h / 2);
    panel(ctx, x, y, w, h, 'PORTAL');
    if (!active) return;
    const items = [];
    if (L.floor < 100) items.push({ label: `${L.floor + 1}. basamağa in`, a: 'next' });
    items.push({ label: 'Köye dön', a: 'home' }, { label: 'Burada kal', a: 'stay' });
    const act = menu(ctx, s, items, x + 14, y + 20, w - 28);
    if (back()) { U.close(); return; }
    if (act >= 0) {
      const a = items[act].a;
      U.closeAll();
      if (a === 'next') g.fade(() => g.enterFloor(L.floor + 1));
      if (a === 'home') g.fade(() => g.enterVillage('dungeon'));
    }
  };

  // ---------------- ÖLÜM ----------------
  SCREENS.death = (ctx, s, active) => {
    const V = E.view, g = G(), info = g.deathInfo || {};
    ctx.fillStyle = `rgba(30,0,8,${Math.min(0.7, s.t)})`; ctx.fillRect(0, 0, V.w, V.h);
    F().draw(ctx, 'YENİLDİN', V.w / 2, V.h * 0.3, '#ff4a5a', { align: 'center', scale: 3, outline: '#1a0008' });
    F().draw(ctx, `${info.floor}. basamakta düştün. ${info.lost ? E.fmt(info.lost) + ' altın kaybettin.' : ''}`, V.w / 2, V.h * 0.3 + 30, C.text, { align: 'center' });
    F().draw(ctx, 'Eşyaların ve seviyen duruyor. Demirci\'de güçlenip tekrar dene!', V.w / 2, V.h * 0.3 + 42, C.dim, { align: 'center' });
    if (!active || s.t < 0.8) return;
    const items = [{ label: 'Tekrar dene', a: 'retry' }, { label: 'Köye dön', a: 'home' }];
    const act = menu(ctx, s, items, V.w / 2 - 60, V.h * 0.6, 120);
    if (act >= 0) {
      U.closeAll();
      if (items[act].a === 'retry') g.fade(() => g.enterFloor(info.floor));
      else g.fade(() => g.enterVillage('dungeon'));
    }
  };
})();
