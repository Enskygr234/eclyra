'use strict';
/* Eclyra — piksel çizim yardımcıları ve tüm karakter / nesne çizimleri (hepsi kodla, özgün) */
(() => {
  const G = E.gfx = {};
  const cache = new Map();

  // ---------------- temel boyama ----------------
  function painter(x) {
    const P = {
      x,
      px(a, b, c) { if (!c) return; x.fillStyle = c; x.fillRect(a | 0, b | 0, 1, 1); },
      rect(a, b, w, h, c) { if (!c) return; x.fillStyle = c; x.fillRect(a | 0, b | 0, w | 0, h | 0); },
      circ(cx, cy, r, c) { // dolu daire
        if (!c) return; x.fillStyle = c;
        for (let yy = -r; yy <= r; yy++) { const w = Math.floor(Math.sqrt(r * r - yy * yy + r * 0.8)); x.fillRect((cx - w) | 0, (cy + yy) | 0, w * 2 + 1, 1); }
      },
      ell(cx, cy, rx, ry, c) {
        if (!c) return; x.fillStyle = c;
        for (let yy = -ry; yy <= ry; yy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry + 0.6)))); x.fillRect((cx - w) | 0, (cy + yy) | 0, w * 2 + 1, 1); }
      },
      line(x0, y0, x1, y1, c) {
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let i = 0; i < 400; i++) { P.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      },
      poly(pts, c) { x.fillStyle = c; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); }
    };
    return P;
  }
  G.painter = painter;

  // Saydam olmayan piksellerin çevresine 1 piksel kontur ekler
  function outline(src, color = '#0b0a10') {
    const w = src.width, h = src.height;
    const [c, x] = E.canvas(w + 2, h + 2);
    const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
    const out = x.createImageData(w + 2, h + 2);
    const [r, g, b] = E.hex(color);
    const A = (i, j) => (i >= 0 && j >= 0 && i < w && j < h ? sd[(j * w + i) * 4 + 3] : 0);
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      const o = ((j + 1) * (w + 2) + (i + 1)) * 4;
      if (A(i, j) > 40) { const s = (j * w + i) * 4; out.data[o] = sd[s]; out.data[o + 1] = sd[s + 1]; out.data[o + 2] = sd[s + 2]; out.data[o + 3] = sd[s + 3]; }
      else if (A(i - 1, j) > 40 || A(i + 1, j) > 40 || A(i, j - 1) > 40 || A(i, j + 1) > 40) { out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255; }
    }
    x.putImageData(out, 0, 0);
    return c;
  }
  G.outline = outline;

  function flipX(src) { const [c, x] = E.canvas(src.width, src.height); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
  G.flipX = flipX;

  // Beyaz siluet (hasar parlaması için)
  function tint(src, color) {
    const [c, x] = E.canvas(src.width, src.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  G.tint = tint;

  G.make = (key, w, h, draw, opts = {}) => {
    if (cache.has(key)) return cache.get(key);
    const [c, x] = E.canvas(w, h);
    draw(painter(x), x);
    let out = opts.outline === false ? c : outline(c, opts.outline || '#0b0a10');
    cache.set(key, out);
    return out;
  };
  G.get = key => cache.get(key);
  G.white = spr => {
    const k = spr.__white;
    if (k) return k;
    spr.__white = tint(spr, '#ffffff');
    return spr.__white;
  };

  const D = E.shadeHex;

  // ---------------- OYUNCU (Aren) ----------------
  // 4 yön × 4 yürüyüş karesi + saldırı + atılma
  const HERO = { hair: '#eef1ff', hairS: '#b6bde0', skin: '#f2c9a0', skinS: '#d49d75', coat: '#2c3b6e', coatS: '#1d2750', coatL: '#3f55a0', scarf: '#d8323a', scarfS: '#9c1f2a', pants: '#2a2533', boot: '#4a2f22', eye: '#1a1c33' };
  function drawHero(P, dir, f, pose) {
    const c = HERO;
    const bob = pose === 'walk' ? [0, -1, 0, -1][f] : 0;
    const leg = pose === 'walk' ? [0, 1, 0, -1][f] : 0;
    const y0 = 3 + bob;
    // bacaklar
    if (dir === 'side') {
      P.rect(6 + leg, 15, 2, 3, c.pants); P.rect(8 - leg, 15, 2, 3, c.pants);
      P.rect(6 + leg, 18, 3, 1, c.boot); P.rect(8 - leg, 18, 3, 1, c.boot);
    } else {
      P.rect(5, 15, 2, 3 + (leg > 0 ? -1 : 0), c.pants); P.rect(9, 15, 2, 3 + (leg < 0 ? -1 : 0), c.pants);
      P.rect(5, 18 + (leg > 0 ? -1 : 0), 2, 1, c.boot); P.rect(9, 18 + (leg < 0 ? -1 : 0), 2, 1, c.boot);
    }
    // gövde (haori)
    P.rect(4, y0 + 7, 8, 6, c.coat);
    P.rect(4, y0 + 7, 1, 6, c.coatS); P.rect(11, y0 + 7, 1, 6, c.coatS);
    P.rect(3, y0 + 12, 10, 2, c.coat); P.rect(3, y0 + 13, 10, 1, c.coatS);
    if (dir === 'down') { P.rect(7, y0 + 8, 2, 5, c.coatL); P.rect(7, y0 + 10, 2, 1, '#d6c27a'); }
    // kollar
    if (dir === 'side') { P.rect(7, y0 + 8, 3, 4, c.coatS); P.rect(8, y0 + 12, 2, 1, c.skin); }
    else { P.rect(2, y0 + 8, 2, 4, c.coatS); P.rect(12, y0 + 8, 2, 4, c.coatS); P.rect(2, y0 + 12, 2, 1, c.skin); P.rect(12, y0 + 12, 2, 1, c.skin); }
    // atkı
    P.rect(4, y0 + 6, 8, 2, c.scarf); P.rect(4, y0 + 7, 8, 1, c.scarfS);
    if (dir === 'up') { P.rect(9, y0 + 7, 2, 4 + (f % 2), c.scarf); P.rect(10, y0 + 8, 1, 3, c.scarfS); }
    if (dir === 'side') { P.rect(2 - (f % 2), y0 + 7, 3, 2, c.scarf); P.rect(1 - (f % 2), y0 + 8, 2, 2, c.scarfS); }
    // kafa
    P.rect(4, y0, 8, 6, c.skin);
    P.rect(4, y0 + 5, 8, 1, c.skinS);
    if (dir === 'down') {
      P.rect(3, y0 - 1, 10, 3, c.hair); P.rect(3, y0 + 2, 2, 3, c.hair); P.rect(11, y0 + 2, 2, 3, c.hair);
      P.px(5, y0 + 2, c.hair); P.px(8, y0 + 2, c.hair); P.rect(3, y0 - 1, 10, 1, c.hairS);
      P.px(6, y0 + 3, c.eye); P.px(9, y0 + 3, c.eye); P.px(6, y0 + 2, '#5c6ac8'); P.px(9, y0 + 2, '#5c6ac8');
    } else if (dir === 'up') {
      P.rect(3, y0 - 1, 10, 6, c.hair); P.rect(4, y0 + 4, 8, 1, c.hairS); P.rect(6, y0 + 5, 4, 1, c.hairS);
    } else {
      P.rect(3, y0 - 1, 9, 3, c.hair); P.rect(3, y0 + 2, 4, 3, c.hair); P.rect(3, y0 - 1, 9, 1, c.hairS);
      P.rect(1, y0 + 1, 3, 2, c.hair); P.px(10, y0 + 3, c.eye); P.px(11, y0 + 4, c.skinS);
    }
  }
  G.hero = (dir, f, pose = 'walk') => {
    const key = `hero:${dir}:${f}:${pose}`;
    if (cache.has(key)) return cache.get(key);
    const base = dir === 'left' ? 'side' : dir === 'right' ? 'side' : dir;
    let spr = G.make(`heroBase:${base}:${f}:${pose}`, 16, 20, P => drawHero(P, base, f, pose));
    if (dir === 'left') spr = flipX(spr);
    cache.set(key, spr);
    return spr;
  };

  // Kılıç çizimi (dönebilen ayrı sprite)
  G.sword = (rarityColor = '#cfd8ff') => G.make('sword:' + rarityColor, 16, 5, P => {
    P.rect(0, 1, 3, 3, '#3a2a22'); P.rect(3, 0, 1, 5, '#d6c27a'); P.rect(4, 2, 1, 1, '#d6c27a');
    P.rect(4, 1, 11, 3, '#e8edf7'); P.rect(4, 3, 11, 1, '#9aa4bd'); P.px(15, 2, '#e8edf7');
    P.rect(5, 1, 9, 1, rarityColor);
  });

  // ---------------- KÖYLÜLER ----------------
  function npc(P, o) {
    const y0 = o.short ? 5 : 3;
    P.rect(4, y0 + 7, 8, 7, o.robe); P.rect(3, y0 + 12, 10, 3, o.robe); P.rect(3, y0 + 14, 10, 1, D(o.robe, -0.3));
    P.rect(4, y0 + 7, 1, 7, D(o.robe, -0.25)); P.rect(11, y0 + 7, 1, 7, D(o.robe, -0.25));
    if (o.belt) P.rect(4, y0 + 10, 8, 1, o.belt);
    if (o.apron) { P.rect(5, y0 + 9, 6, 6, o.apron); P.rect(5, y0 + 9, 6, 1, D(o.apron, -0.3)); }
    P.rect(2, y0 + 8, 2, 4, D(o.robe, -0.2)); P.rect(12, y0 + 8, 2, 4, D(o.robe, -0.2));
    P.rect(2, y0 + 12, 2, 1, o.skin); P.rect(12, y0 + 12, 2, 1, o.skin);
    P.rect(4, y0, 8, 7, o.skin); P.rect(4, y0 + 6, 8, 1, D(o.skin, -0.18));
    P.px(6, y0 + 3, '#20202a'); P.px(9, y0 + 3, '#20202a');
    if (o.hair) { P.rect(3, y0 - 1, 10, 3, o.hair); P.rect(3, y0 + 2, 1, 3, o.hair); P.rect(12, y0 + 2, 1, 3, o.hair); }
    if (o.bun) { P.rect(6, y0 - 4, 4, 3, o.hair); P.px(10, y0 - 3, '#c43a5a'); }
    if (o.bald) { P.rect(4, y0, 8, 1, D(o.skin, 0.15)); }
    if (o.beard) { P.rect(4, y0 + 4, 8, 3, o.beard); P.rect(5, y0 + 7, 6, 1, o.beard); P.rect(6, y0 + 4, 4, 1, o.skin); }
    if (o.hat) { P.rect(1, y0 - 1, 14, 2, o.hat); P.rect(4, y0 - 3, 8, 2, o.hat); P.rect(1, y0, 14, 1, D(o.hat, -0.3)); }
    if (o.cane) { P.rect(13, y0 + 6, 1, 12, '#7a5636'); P.rect(12, y0 + 5, 3, 1, '#7a5636'); }
    if (o.glasses) { P.px(6, y0 + 3, '#9fe3ff'); P.px(9, y0 + 3, '#9fe3ff'); P.rect(7, y0 + 3, 2, 1, '#555'); }
  }
  G.npc = (id, f = 0) => G.make(`npc:${id}:${f}`, 16, 21, P => {
    const S = {
      nene: { robe: '#6b4a8c', skin: '#e9c3a5', hair: '#e8e6f0', bun: true, cane: true, belt: '#d6c27a', short: true },
      tetsu: { robe: '#5a4a3e', skin: '#c98f68', bald: true, beard: '#3a2a22', apron: '#8a5a3a', belt: '#2a2020' },
      mina: { robe: '#3f8a5a', skin: '#f2cfae', hair: '#3a2420', hat: '#d9b45a', belt: '#c43a5a' },
      koylu1: { robe: '#4a6a9a', skin: '#e3b894', hair: '#2a2020', belt: '#c8b070' },
      koylu2: { robe: '#a05a4a', skin: '#f0c8a4', hair: '#6a3a2a', bun: true },
      cocuk: { robe: '#d8a040', skin: '#f2cfae', hair: '#2a2020', short: true }
    }[id];
    if (f === 1) P.x.translate(0, 1);
    npc(P, S);
  });

  // Kedi
  G.cat = f => G.make('cat:' + f, 12, 9, P => {
    const c = '#e6a35a', s = '#b8763a';
    P.rect(2, 3, 7, 4, c); P.rect(2, 6, 7, 1, s); P.rect(8, 1, 4, 4, c); P.px(8, 0, c); P.px(11, 0, c);
    P.px(9, 2, '#222'); P.px(11, 2, '#222'); P.rect(0, 1 + (f % 2), 2, 1, c); P.rect(1, 2, 1, 2, c);
    P.rect(2, 7, 1, 2, s); P.rect(7, 7, 1, 2, s); P.rect(4, 4, 1, 2, s); P.rect(6, 3, 1, 2, s);
  });

  // ---------------- DÜŞMANLAR ----------------
  // tip + renk + kare → sprite
  G.enemy = (type, color, f = 0, big = false) => {
    const key = `en:${type}:${color}:${f}:${big}`;
    if (cache.has(key)) return cache.get(key);
    const dark = D(color, -0.35), light = D(color, 0.3), eye = '#fff7d0';
    const sizes = { slime: [16, 13], bat: [18, 12], chaser: [16, 20], charger: [22, 15], archer: [16, 20], caster: [16, 20], bomber: [14, 15], turret: [18, 22], tank: [24, 24] };
    const [w, h] = sizes[type];
    const spr = G.make(key + ':raw', w, h, P => {
      switch (type) {
        case 'slime': {
          const sq = f % 2 ? 1 : 0;
          P.ell(8, 8 + sq, 7 + sq, 5 - sq, color); P.ell(8, 10 + sq, 6 + sq, 2, dark);
          P.ell(6, 6 + sq, 2, 1, light); P.rect(5, 8, 2, 2, '#16121c'); P.rect(9, 8, 2, 2, '#16121c'); P.px(5, 8, eye); P.px(9, 8, eye);
          break;
        }
        case 'bat': {
          const up = f % 2 === 0;
          P.ell(9, 6, 3, 3, color); P.px(8, 5, '#ff4040'); P.px(10, 5, '#ff4040');
          P.rect(7, 2, 1, 2, color); P.rect(11, 2, 1, 2, color);
          if (up) { P.poly([[6, 6], [0, 1], [2, 6], [0, 8]], dark); P.poly([[12, 6], [18, 1], [16, 6], [18, 8]], dark); }
          else { P.poly([[6, 6], [0, 9], [3, 8], [2, 11]], dark); P.poly([[12, 6], [18, 9], [15, 8], [16, 11]], dark); }
          break;
        }
        case 'chaser': {
          const l = f % 2;
          P.rect(5, 14, 2, 5 - l, dark); P.rect(9, 14, 2, 4 + l, dark);
          P.rect(4, 7, 8, 8, color); P.rect(4, 13, 8, 2, dark); P.rect(5, 9, 6, 1, dark);
          P.rect(4, 1, 8, 6, light); P.rect(4, 5, 8, 2, color); P.rect(5, 3, 2, 2, '#14101a'); P.rect(9, 3, 2, 2, '#14101a'); P.px(6, 3, '#ff5050'); P.px(9, 3, '#ff5050');
          P.rect(12, 6 + l, 2, 9, '#9aa0b0'); P.rect(11, 12 + l, 4, 1, '#6a5040');
          P.rect(2, 8, 2, 5, dark);
          break;
        }
        case 'charger': {
          const l = f % 2;
          P.ell(10, 8, 8, 5, color); P.ell(10, 11, 7, 2, dark); P.rect(3, 4, 12, 2, dark);
          P.rect(15, 5, 6, 6, color); P.rect(18, 9, 3, 2, light); P.px(17, 6, '#ff4040');
          P.rect(19, 11, 1, 2, '#f0e6c8'); P.rect(21, 10, 1, 2, '#f0e6c8');
          P.rect(4, 12, 2, 3 - l, dark); P.rect(8, 12, 2, 2 + l, dark); P.rect(12, 12, 2, 3 - l, dark); P.rect(15, 12, 2, 2 + l, dark);
          break;
        }
        case 'archer': {
          const l = f % 2;
          P.rect(5, 14, 2, 5 - l, dark); P.rect(9, 14, 2, 4 + l, dark);
          P.rect(4, 7, 8, 8, color); P.rect(4, 13, 8, 2, dark);
          P.rect(4, 1, 8, 7, light); P.rect(3, 0, 10, 2, dark); P.rect(5, 4, 2, 1, '#14101a'); P.rect(9, 4, 2, 1, '#14101a');
          P.line(13, 3, 15, 10, '#8a6a40'); P.line(15, 10, 13, 17, '#8a6a40'); P.line(13, 3, 13, 17, '#e0e0e0');
          break;
        }
        case 'caster': {
          const fl = f % 2;
          P.poly([[3, 19], [8, 6], [13, 19]], color); P.rect(4, 17, 8, 2, dark);
          P.ell(8, 6, 4, 4, dark); P.rect(6, 5, 1, 1, '#fff'); P.rect(9, 5, 1, 1, '#fff');
          P.ell(8, 3 - fl, 3, 2, color);
          P.ell(14, 9 - fl, 2, 2, light); P.px(14, 9 - fl, '#fff');
          break;
        }
        case 'bomber': {
          const p = f % 2;
          P.circ(7, 8, 6, color); P.ell(7, 11, 5, 2, dark); P.ell(5, 6, 2, 1, light);
          P.rect(4, 7, 2, 2, '#14101a'); P.rect(9, 7, 2, 2, '#14101a');
          P.rect(6, 0, 2, 3, '#555'); P.px(6 + p, 0, '#ffd23b');
          break;
        }
        case 'turret': {
          P.rect(3, 14, 12, 7, dark); P.rect(2, 19, 14, 3, D(color, -0.55));
          P.rect(4, 4, 10, 11, color); P.rect(4, 4, 10, 2, light); P.rect(4, 13, 10, 2, dark);
          P.circ(9, 9, 2 + (f % 2), '#fff7d0'); P.px(9, 9, '#ff4040');
          P.rect(2, 6, 2, 6, dark); P.rect(14, 6, 2, 6, dark);
          break;
        }
        case 'tank': {
          const l = f % 2;
          P.rect(6, 19, 4, 5 - l, dark); P.rect(14, 19, 4, 4 + l, dark);
          P.rect(4, 8, 16, 12, color); P.rect(4, 17, 16, 3, dark); P.rect(4, 8, 16, 2, light);
          P.rect(7, 2, 10, 7, color); P.rect(9, 5, 2, 2, '#ff5a3a'); P.rect(13, 5, 2, 2, '#ff5a3a');
          P.rect(0, 9, 5, 12, D(color, -0.45)); P.rect(1, 10, 3, 10, D(color, -0.2));
          P.rect(20, 10, 3, 8, dark);
          break;
        }
      }
    });
    let out = spr;
    if (big) { const [c, x] = E.canvas(spr.width * 1.5, spr.height * 1.5); x.drawImage(spr, 0, 0, c.width, c.height); out = c; }
    cache.set(key, out);
    return out;
  };

  // ---------------- BOSS'LAR ----------------
  G.boss = (kind, color, f = 0) => {
    const key = `boss:${kind}:${f}`;
    if (cache.has(key)) return cache.get(key);
    const dark = D(color, -0.4), light = D(color, 0.3);
    const spr = G.make(key + ':raw', 64, 60, P => {
      const b = f % 2;
      switch (kind) {
        case 'boar':
          P.ell(30, 34, 22, 15, color); P.ell(30, 42, 20, 6, dark); P.ell(26, 24, 18, 6, dark);
          for (let i = 0; i < 9; i++) P.poly([[12 + i * 4, 22], [14 + i * 4, 12 + (i % 2) * 3], [16 + i * 4, 22]], dark);
          P.rect(46, 26, 14, 14, color); P.rect(52, 34, 8, 6, light); P.rect(48, 28, 3, 3, '#ff3030');
          P.poly([[54, 40], [62, 30], [58, 42]], '#f4ead0'); P.poly([[48, 40], [54, 31], [52, 42]], '#f4ead0');
          [12, 22, 36, 44].forEach((x, i) => P.rect(x, 46, 5, 9 - ((i + b) % 2) * 2, dark));
          break;
        case 'serpent':
          for (let i = 0; i < 7; i++) { const yy = 46 - i * 5, xx = 16 + Math.sin(i * 1.1 + b * 0.5) * 9; P.circ(xx + i * 3, yy, 7 - i * 0.3, i % 2 ? color : D(color, -0.12)); P.rect(xx + i * 3 - 2, yy + 3, 4, 2, light); }
          P.ell(44, 14, 11, 8, color); P.ell(44, 18, 9, 3, light); P.rect(38, 10, 3, 3, '#ffe74a'); P.rect(48, 10, 3, 3, '#ffe74a');
          P.poly([[36, 8], [30, 0], [40, 6]], dark); P.poly([[52, 8], [58, 0], [48, 6]], dark);
          P.rect(42, 21, 2, 4, '#ff5a7a');
          break;
        case 'wolf':
          P.ell(30, 36, 18, 13, color); P.ell(28, 28, 16, 10, dark);
          for (let i = 0; i < 8; i++) P.poly([[14 + i * 4, 26], [16 + i * 4, 15 + (i % 3) * 2], [19 + i * 4, 26]], D(color, -0.2));
          P.ell(45, 24, 10, 8, color); P.rect(48, 26, 12, 6, color); P.rect(50, 30, 10, 3, '#f0e6d8');
          P.poly([[40, 18], [42, 8], [46, 17]], dark); P.poly([[46, 17], [50, 8], [52, 18]], dark);
          P.rect(46, 22, 3, 2, '#ff2020'); P.px(47, 21, '#ffb0b0');
          for (let i = 0; i < 3; i++) P.px(51 + i * 3, 33, '#fff');
          [16, 24, 36, 42].forEach((x, i) => { P.rect(x, 44, 5, 10 - ((i + b) % 2) * 2, dark); P.rect(x - 1, 53 - ((i + b) % 2) * 2, 7, 2, '#e8e0d0'); });
          P.ell(30, 38, 6, 4, '#c43a3a');
          break;
        case 'mother':
          P.ell(32, 50, 26, 8, D(color, -0.55));
          P.rect(24, 28, 16, 24, '#e8dcc8'); P.rect(24, 28, 16, 3, '#cfc0a6');
          P.ell(32, 22, 26, 14 + b, color); P.ell(32, 27, 24, 6, dark);
          [[18, 16], [30, 12], [44, 18], [24, 24], [40, 26]].forEach(([x, y]) => P.circ(x, y, 3, light));
          P.rect(27, 36, 3, 4, '#2a1030'); P.rect(34, 36, 3, 4, '#2a1030'); P.px(28, 37, '#5effc8'); P.px(35, 37, '#5effc8');
          break;
        case 'oni':
          P.rect(22, 44, 8, 12 - b, dark); P.rect(34, 44, 8, 11 + b, dark);
          P.rect(16, 22, 32, 24, color); P.rect(16, 40, 32, 6, '#3a2a22'); P.rect(28, 40, 8, 6, '#d6c27a');
          P.rect(8, 22, 8, 18, color); P.rect(48, 22, 8, 18, color); P.rect(8, 38, 8, 4, dark); P.rect(48, 38, 8, 4, dark);
          P.rect(22, 6, 20, 17, color); P.rect(22, 18, 20, 5, dark);
          P.poly([[22, 8], [16, -2], [26, 6]], '#f0e6c8'); P.poly([[42, 8], [48, -2], [38, 6]], '#f0e6c8');
          P.rect(26, 11, 4, 3, '#ffe74a'); P.rect(34, 11, 4, 3, '#ffe74a'); P.rect(27, 19, 10, 3, '#fff'); P.rect(27, 20, 10, 1, '#2a1010');
          P.rect(56, 12, 4, 34, '#5a4a3e'); P.rect(54, 10, 8, 8, '#3a3030'); P.px(55, 12, '#aaa'); P.px(60, 15, '#aaa');
          P.rect(22, 3, 20, 4, '#2a1a1a');
          break;
        case 'yuki':
          P.poly([[18, 58], [32, 18], [46, 58]], '#eaf6ff'); P.poly([[22, 58], [32, 26], [42, 58]], '#cfe9f7');
          P.rect(28, 36, 8, 2, '#7ec8ff');
          P.ell(32, 16, 6, 7, '#f6f8ff'); P.rect(26, 8, 12, 4, '#1e2440'); P.rect(25, 10, 3, 20, '#1e2440'); P.rect(36, 10, 3, 20, '#1e2440');
          P.px(30, 16, '#7ec8ff'); P.px(34, 16, '#7ec8ff'); P.rect(31, 20, 2, 1, '#b04a6a');
          P.poly([[18, 30], [8, 40 + b * 2], [20, 36]], '#eaf6ff'); P.poly([[46, 30], [56, 40 + b * 2], [44, 36]], '#eaf6ff');
          break;
        case 'giant':
          P.rect(20, 46, 7, 12, light); P.rect(37, 46, 7, 12, light);
          for (let i = 0; i < 5; i++) P.rect(18, 24 + i * 4, 28, 2, color);
          P.rect(31, 22, 3, 26, light);
          P.rect(8, 24, 10, 3, color); P.rect(6, 26, 3, 18, color); P.rect(46, 24, 10, 3, color); P.rect(55, 26, 3, 18, color);
          P.ell(32, 12, 12, 11, color); P.rect(24, 16, 16, 6, D(color, -0.1));
          P.rect(25, 9, 5, 5, '#1a1a14'); P.rect(34, 9, 5, 5, '#1a1a14'); P.px(27, 11, '#c6ff6e'); P.px(36, 11, '#c6ff6e');
          for (let i = 0; i < 5; i++) P.rect(26 + i * 3, 19, 2, 3, '#fff');
          break;
        case 'golem':
          P.poly([[14, 58], [20, 30], [44, 30], [50, 58]], dark);
          P.poly([[18, 32], [32, 14], [46, 32], [32, 44]], color); P.poly([[24, 32], [32, 20], [40, 32], [32, 40]], light);
          P.poly([[6, 26], [14, 18], [18, 34], [10, 42]], color); P.poly([[58, 26], [50, 18], [46, 34], [54, 42]], color);
          P.poly([[26, 14], [32, 2], [38, 14]], '#ff7bf2'); P.rect(30, 28, 4, 4, '#fff'); P.circ(32, 30, 1 + b, '#ff7bf2');
          break;
        case 'samurai':
          P.rect(24, 40, 6, 16, '#1a1620'); P.rect(34, 40, 6, 15 + b, '#1a1620');
          P.poly([[18, 44], [22, 22], [42, 22], [46, 44]], color); P.rect(22, 34, 20, 3, '#ffcf5a');
          P.rect(14, 22, 10, 6, D(color, 0.15)); P.rect(40, 22, 10, 6, D(color, 0.15));
          P.rect(26, 10, 12, 12, '#d8c8b8'); P.rect(26, 14, 12, 3, '#1a1620'); P.px(29, 15, '#ffcf5a'); P.px(34, 15, '#ffcf5a');
          P.poly([[24, 12], [32, 2], [40, 12]], '#1a1620'); P.poly([[22, 10], [16, 4], [26, 8]], '#ffcf5a'); P.poly([[42, 10], [48, 4], [38, 8]], '#ffcf5a');
          P.line(46, 30, 62, 8, '#e8e8f8'); P.line(47, 30, 63, 9, '#9aa0c0'); P.rect(44, 30, 4, 3, '#3a2a22');
          break;
        case 'void':
          P.ell(32, 40, 22, 18, '#0a0812'); P.ell(32, 40, 18, 14, '#17122a');
          for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + b * 0.2; P.line(32, 40, 32 + Math.cos(a) * 30, 40 + Math.sin(a) * 22, '#2a2048'); }
          P.ell(32, 20, 12, 12, '#0a0812'); P.poly([[22, 12], [26, 0], [30, 10], [32, -2], [34, 10], [38, 0], [42, 12]], '#e6d8ff');
          P.rect(26, 18, 4, 3, '#fff'); P.rect(34, 18, 4, 3, '#fff'); P.circ(32, 40, 5, color); P.circ(32, 40, 2, '#fff');
          break;
      }
    });
    cache.set(key, spr);
    return spr;
  };

  // ---------------- EŞYA SİMGELERİ ----------------
  G.itemIcon = (slot, color, variant = 0) => G.make(`icon:${slot}:${color}:${variant % 3}`, 14, 14, P => {
    const m = '#c9d1e6', md = '#7d869e', w = '#7a5636', g = '#d6c27a';
    const v = variant % 3;
    switch (slot) {
      case 'silah': P.line(2, 12, 11, 3, m); P.line(3, 12, 12, 3, md); P.line(11, 2, 12, 3, m); P.rect(2, 9, 4, 1, g); P.rect(4, 8, 1, 4, g); P.line(1, 13, 3, 11, w); P.line(4, 11 - 0, 10, 5, color); break;
      case 'migfer': P.ell(7, 8, 6, 5, md); P.ell(7, 7, 5, 4, m); P.rect(1, 10, 12, 2, color); if (v) P.poly([[3, 4], [1, 0], [5, 3]], g), P.poly([[11, 4], [13, 0], [9, 3]], g); P.rect(4, 8, 6, 1, '#2a2a3a'); break;
      case 'zirh': P.rect(3, 2, 8, 10, m); P.rect(1, 2, 3, 4, md); P.rect(10, 2, 3, 4, md); P.rect(3, 9, 8, 3, color); P.rect(6, 3, 2, 6, md); P.rect(5, 1, 4, 2, '#2a2a3a'); break;
      case 'eldiven': P.rect(3, 4, 7, 7, m); P.rect(3, 2, 2, 3, m); P.rect(5, 1, 2, 3, m); P.rect(7, 2, 2, 3, m); P.rect(10, 6, 2, 3, m); P.rect(3, 10, 7, 3, color); break;
      case 'cizme': P.rect(4, 1, 5, 9, m); P.rect(4, 9, 9, 4, m); P.rect(4, 12, 9, 1, md); P.rect(4, 3, 5, 2, color); break;
      case 'tilsim': P.line(3, 0, 7, 5, g); P.line(11, 0, 7, 5, g); P.rect(4, 5, 7, 8, color); P.rect(5, 6, 5, 6, D(color, 0.4)); P.rect(6, 7, 3, 1, '#fff'); P.rect(7, 8, 1, 3, '#fff'); break;
      case 'yuzuk': P.circ(7, 8, 5, g); P.circ(7, 8, 3, null); P.x.clearRect(5, 6, 5, 5); P.rect(5, 2, 5, 4, color); P.px(6, 3, '#fff'); break;
      case 'iksir': P.rect(5, 1, 4, 3, '#b8a080'); P.rect(4, 4, 6, 1, '#ddd'); P.ell(7, 9, 5, 4, '#e8e8f0'); P.ell(7, 10, 4, 3, color); P.px(5, 8, '#fff'); break;
      case 'altin': P.circ(7, 7, 5, '#ffcf3a'); P.circ(7, 7, 3, '#ffe68a'); P.rect(6, 5, 2, 5, '#c89a1a'); break;
      case 'demir': P.poly([[2, 9], [5, 3], [11, 3], [12, 9], [7, 12]], '#8a8f9e'); P.poly([[5, 4], [10, 4], [8, 8]], '#c8ccd8'); break;
      case 'ruh': P.poly([[7, 0], [12, 7], [7, 13], [2, 7]], '#9b7bff'); P.poly([[7, 2], [10, 7], [7, 11], [4, 7]], '#d9c8ff'); P.px(6, 5, '#fff'); break;
      case 'parca': P.poly([[3, 12], [6, 1], [11, 4], [10, 12]], '#e6d8ff'); P.poly([[5, 11], [7, 3], [9, 5], [8, 11]], '#fff'); break;
      case 'sandik': P.rect(1, 5, 12, 8, '#7a4a2a'); P.rect(1, 3, 12, 3, '#9a6a3a'); P.rect(1, 7, 12, 1, '#d6c27a'); P.rect(6, 6, 2, 3, '#ffe68a'); break;
    }
  });

  // ---------------- ZEMİN KAROLARI ----------------
  G.tile = (biome, v) => G.make(`tile:${biome.id}:${v}`, 16, 16, P => {
    const r = E.RNG(E.hash(v, biome.id.length * 31));
    const [a, b, c] = biome.floor;
    P.rect(0, 0, 16, 16, a);
    const stone = ['tapinak', 'katedral', 'golge', 'kalp', 'kristal'].includes(biome.id);
    if (stone) {
      // taş döşeme
      const off = v % 2 ? 8 : 0;
      P.rect(0, 0, 16, 1, D(a, -0.18)); P.rect(off, 0, 1, 8, D(a, -0.18)); P.rect(0, 8, 16, 1, D(a, -0.18)); P.rect((off + 8) % 16, 8, 1, 8, D(a, -0.18));
      P.rect(1, 1, 6, 1, D(a, 0.08)); P.rect(9, 9, 6, 1, D(a, 0.08));
      for (let i = 0; i < 6; i++) P.px(r.int(0, 15), r.int(0, 15), r() < 0.5 ? b : c);
      if (v === 3) { P.line(3, 3, 7, 6, D(a, -0.28)); P.line(7, 6, 6, 10, D(a, -0.28)); }
    } else {
      for (let i = 0; i < 26; i++) P.px(r.int(0, 15), r.int(0, 15), r() < 0.5 ? b : c);
      for (let i = 0; i < 3; i++) P.rect(r.int(0, 13), r.int(0, 13), 2, 1, D(a, -0.12));
      if (biome.id === 'bambu' && v % 3 === 0) for (let i = 0; i < 4; i++) { const x = r.int(1, 14), y = r.int(3, 14); P.px(x, y, '#6ea84a'); P.px(x, y - 1, '#86c25a'); }
      if (biome.id === 'kor' && v === 2) { P.line(2, 12, 7, 8, '#ff6a2a'); P.line(7, 8, 13, 10, '#ff9a3a'); }
      if (biome.id === 'buz') { P.rect(r.int(1, 10), r.int(1, 12), 4, 1, '#e6f6ff'); }
      if (biome.id === 'kemik' && v === 1) { P.rect(4, 9, 5, 1, '#e3dcc6'); P.px(3, 8, '#e3dcc6'); P.px(3, 10, '#e3dcc6'); P.px(9, 8, '#e3dcc6'); P.px(9, 10, '#e3dcc6'); }
      if (biome.id === 'mantar' && v === 2) { P.px(5, 6, '#5effc8'); P.px(11, 12, '#b36cff'); }
    }
  }, { outline: false });

  // Duvar karosu: üst yüz + (altında zemin varsa) ön yüz
  G.wall = (biome, face, v) => G.make(`wall:${biome.id}:${face}:${v}`, 16, 16, P => {
    const r = E.RNG(E.hash(v, 77));
    P.rect(0, 0, 16, 16, biome.wallTop);
    for (let i = 0; i < 8; i++) P.px(r.int(0, 15), r.int(0, face ? 6 : 15), D(biome.wallTop, r() < 0.5 ? 0.1 : -0.15));
    if (biome.id === 'bambu') {
      P.rect(0, 0, 16, 16, '#1d3a1b');
      for (let i = 0; i < 4; i++) { const x = (i * 4 + v) % 16; P.rect(x, 0, 2, 16, i % 2 ? '#3d6b2e' : '#2f5a25'); P.rect(x, 4 + i * 3 % 9, 2, 1, '#1a3015'); }
      if (face) { P.rect(0, 13, 16, 3, '#132611'); }
      return;
    }
    if (face) {
      const f = biome.wallFace;
      P.rect(0, 7, 16, 9, f);
      P.rect(0, 7, 16, 1, D(biome.wallTop, -0.3));
      for (let row = 0; row < 2; row++) {
        const y = 8 + row * 4, off = (row + v) % 2 ? 4 : 0;
        P.rect(0, y + 3, 16, 1, D(f, -0.35));
        for (let x = off; x < 16; x += 8) P.rect(x, y, 1, 3, D(f, -0.35));
        P.rect(off + 1, y, 5, 1, D(f, 0.12));
      }
      P.rect(0, 15, 16, 1, '#00000060');
    }
  }, { outline: false });

  // Su karosu (köy) — 4 karelik animasyon
  G.water = f => G.make('water:' + f, 16, 16, P => {
    P.rect(0, 0, 16, 16, '#2a8fb8');
    const r = E.RNG(91);
    for (let i = 0; i < 10; i++) P.px(r.int(0, 15), r.int(0, 15), '#3aa4cc');
    for (let i = 0; i < 3; i++) { const x = (r.int(0, 15) + f * 2) % 16, y = r.int(1, 14); P.rect(x, y, 3, 1, '#7fd2ef'); }
  }, { outline: false });

  // ---------------- DEKORLAR ----------------
  G.deco = (kind, biome, v = 0) => G.make(`deco:${kind}:${biome ? biome.id : 'x'}:${v}`, 32, 56, (P, x) => {
    const acc = biome ? biome.accent : '#fff';
    const r = E.RNG(E.hash(v, kind.length));
    x.translate(8, 24); // 16x16 karoya hizala; uzun dekorlar yukarı taşabilir
    switch (kind) {
      case 'grass': for (let i = 0; i < 5; i++) { const gx = r.int(1, 13), h = r.int(3, 6); P.line(gx, 15, gx + r.int(-1, 1), 15 - h, i % 2 ? '#5c8a3a' : '#79ad4a'); } break;
      case 'flower': for (let i = 0; i < 3; i++) { const gx = r.int(2, 12), gy = r.int(8, 13); P.line(gx, gy, gx, gy + 3, '#4a7a30'); P.px(gx, gy - 1, ['#ff8fb0', '#ffe26a', '#d9c8ff'][i]); P.px(gx - 1, gy, ['#ff8fb0', '#ffe26a', '#d9c8ff'][i]); P.px(gx + 1, gy, ['#ff8fb0', '#ffe26a', '#d9c8ff'][i]); } break;
      case 'rock': P.ell(8, 11, 6, 4, '#6b6b72'); P.ell(7, 10, 4, 2, '#8a8a94'); P.ell(8, 14, 6, 1, '#45454c'); break;
      case 'bamboo': for (let i = 0; i < 3; i++) { const bx = 3 + i * 4, h = 26 + r.int(0, 8); P.rect(bx, 16 - h, 2, h, i % 2 ? '#5f9a3e' : '#4d8532'); for (let k = 0; k < h; k += 7) P.rect(bx, 16 - h + k, 2, 1, '#2f5a25'); P.poly([[bx + 1, 16 - h + 4], [bx + 7, 16 - h + 1], [bx + 2, 16 - h + 6]], '#6ea84a'); } break;
      case 'lantern': P.rect(5, 4, 6, 12, '#7e7e86'); P.rect(3, 2, 10, 3, '#64646c'); P.rect(6, 6, 4, 4, '#ffd27a'); P.rect(4, 14, 8, 2, '#55555c'); P.rect(6, 0, 4, 2, '#64646c'); break;
      case 'puddle': P.ell(8, 11, 7, 3, '#2a5f80'); P.ell(7, 10, 4, 1, '#5fb0d8'); break;
      case 'pillar': P.rect(3, -14, 10, 30, D(biome.wallTop, 0.1)); P.rect(3, -14, 2, 30, D(biome.wallTop, 0.25)); P.rect(1, -16, 14, 3, D(biome.wallTop, -0.1)); P.rect(1, 13, 14, 3, D(biome.wallTop, -0.2)); P.rect(10, -12, 1, 24, D(biome.wallTop, -0.2)); break;
      case 'coral': P.line(5, 15, 5, 7, '#ff7a8a'); P.line(5, 10, 2, 6, '#ff7a8a'); P.line(5, 9, 9, 5, '#ff9aa8'); P.line(11, 15, 11, 9, '#ffb06a'); P.line(11, 11, 13, 8, '#ffb06a'); break;
      case 'circle': {
        const ring = (rx, ry, n, c) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; P.px(8 + Math.round(Math.cos(a) * rx), 10 + Math.round(Math.sin(a) * ry), c); } };
        ring(14, 7, 80, acc); ring(11, 5.5, 64, D(acc, -0.25));
        const pts = []; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k / 5 * Math.PI * 2; pts.push([8 + Math.cos(a) * 11, 10 + Math.sin(a) * 5.5]); }
        for (let k = 0; k < 5; k++) { const a = pts[k], b = pts[(k + 2) % 5]; P.line(a[0], a[1], b[0], b[1], D(acc, -0.1)); }
        break;
      }
      case 'pinkfire': {
        P.ell(8, 12, 9, 4, D(acc, -0.55));
        const ring = (rx, ry, n, c) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; P.px(8 + Math.round(Math.cos(a) * rx), 12 + Math.round(Math.sin(a) * ry), c); } };
        ring(9, 4, 50, acc); ring(6, 2.6, 36, D(acc, -0.2));
        P.poly([[3, 12], [8, -10 + v], [13, 12]], D(acc, -0.1)); P.poly([[5, 12], [8, -4 + v], [11, 12]], D(acc, 0.35)); P.poly([[7, 12], [8, 2], [9, 12]], '#ffffff');
        P.poly([[1, 12], [2, 2], [5, 12]], D(acc, -0.2)); P.poly([[11, 12], [14, 4], [15, 12]], D(acc, -0.2));
        break;
      }
      case 'statue': P.rect(2, 12, 12, 4, '#4a4a52'); P.poly([[3, 12], [8, -14], [13, 12]], '#6a6a74'); P.poly([[5, -2], [8, -14], [11, -2]], '#52525c'); P.ell(8, -6, 3, 4, '#2a2a30'); P.rect(4, 0, 8, 2, '#5a5a64'); P.px(5, 6, '#4a7a3a'); P.px(11, 2, '#4a7a3a'); P.px(12, 8, '#4a7a3a'); break;
      case 'rubble': P.rect(2, 11, 4, 3, '#5a5a60'); P.rect(8, 12, 5, 3, '#6a6a70'); P.rect(6, 9, 3, 2, '#7a7a80'); break;
      case 'mushroom': P.rect(6, 6, 4, 10, '#e8dcc8'); P.ell(8, 5, 7, 4, '#b36cff'); P.ell(8, 7, 6, 1, '#7a3ac0'); P.px(5, 3, '#fff'); P.px(10, 4, '#fff'); P.rect(12, 11, 2, 5, '#e8dcc8'); P.ell(13, 10, 3, 2, '#5effc8'); break;
      case 'crystal': P.poly([[4, 16], [6, 0], [9, 16]], acc); P.poly([[8, 16], [11, 5], [13, 16]], D(acc, -0.2)); P.poly([[1, 16], [2, 9], [5, 16]], D(acc, 0.2)); P.line(6, 2, 7, 12, '#fff'); break;
      case 'glow': P.circ(8, 12, 2, acc); P.px(8, 12, '#fff'); P.line(8, 14, 8, 16, '#3a6a4a'); P.circ(4, 14, 1, acc); break;
      case 'lava': P.ell(8, 11, 8, 4, '#3a1a10'); P.ell(8, 11, 6, 3, '#ff5a1a'); P.ell(7, 10, 3, 1, '#ffd23b'); break;
      case 'bones': P.rect(3, 12, 7, 1, '#e3dcc6'); P.px(2, 11, '#e3dcc6'); P.px(2, 13, '#e3dcc6'); P.px(10, 11, '#e3dcc6'); P.px(10, 13, '#e3dcc6'); P.circ(11, 9, 2, '#e3dcc6'); P.px(10, 9, '#222'); P.px(12, 9, '#222'); break;
      case 'brazier': P.rect(4, 9, 8, 7, '#3a3030'); P.rect(3, 8, 10, 2, '#5a4a40'); P.ell(8, 6, 4, 3, '#ff7a2b'); P.ell(8, 5, 2, 2, '#ffd23b'); break;
      case 'ice': P.poly([[3, 16], [6, -2], [9, 16]], '#cdeeff'); P.poly([[8, 16], [11, 4], [14, 16]], '#a8dcf5'); P.line(6, 0, 6, 12, '#ffffff'); break;
      case 'snowpile': P.ell(8, 12, 7, 4, '#eef8ff'); P.ell(6, 11, 3, 1, '#ffffff'); P.ell(9, 15, 7, 1, '#b8d8ea'); break;
      case 'grave': P.rect(4, 2, 8, 13, '#6a6e66'); P.ell(8, 2, 4, 2, '#6a6e66'); P.rect(6, 5, 4, 1, '#4a4e46'); P.rect(7, 3, 2, 5, '#4a4e46'); P.rect(2, 14, 12, 2, '#3a3e36'); break;
      case 'carpet': P.rect(-4, 2, 24, 12, '#6a1a2a'); P.rect(-4, 2, 24, 1, '#ffcf5a'); P.rect(-4, 13, 24, 1, '#ffcf5a'); P.rect(4, 6, 8, 4, '#8a2a3a'); break;
      case 'torch': P.rect(7, 4, 2, 8, '#5a3a22'); P.ell(8, 2, 2, 3, '#ff9a3a'); P.px(8, 1, '#ffe68a'); break;
    }
  }, { outline: false });

  // ---------------- AY KUYUSU / PORTAL ----------------
  G.portal = (f, color = '#b48bff') => G.make(`portal:${f}:${color}`, 32, 32, (P, x) => {
    for (let i = 0; i < 3; i++) P.ell(16, 18, 13 - i * 3, 9 - i * 2, i === 0 ? D(color, -0.4) : i === 1 ? color : D(color, 0.5));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + f * 0.4; P.px(16 + Math.cos(a) * 11, 18 + Math.sin(a) * 7, '#fff'); }
    void x;
  }, { outline: false });

  // ---------------- LOGO (başlık ekranı) ----------------
  G.moon = size => G.make('moon:' + size, size, size, (P, x) => {
    const r = size / 2 - 1;
    P.circ(size / 2, size / 2, r, '#f4ecff');
    P.circ(size / 2 + r * 0.45, size / 2 - r * 0.25, r * 0.85, null);
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(size / 2 + r * 0.42, size / 2 - r * 0.22, r * 0.82, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 6; i++) { x.fillStyle = '#d9c8ff'; x.fillRect(size * 0.2 + i * 2, size * 0.55 + (i % 3) * 3, 2, 2); }
    x.fillStyle = '#c9b2ff'; x.fillRect(0, size * 0.7, size, size * 0.3);
  }, { outline: '#2a1848' });
})();
