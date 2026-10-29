'use strict';
/* Eclyra — haritalar: zindan üretimi, köy, çarpışma ve önceden çizilmiş katmanlar */
(() => {
  const T = 16;
  const FLOOR = 0, WALL = 1, WATER = 2, BLOCK = 3; // BLOCK: üzerinden geçilmeyen dekor/yapı
  E.TILE = T;

  class GameMap {
    constructor(w, h, fill = WALL) {
      this.w = w; this.h = h;
      this.t = new Uint8Array(w * h).fill(fill);
      this.decos = [];       // {kind, x, y, v, solid, light}
      this.lights = [];      // {x, y, r, color, flicker}
      this.rects = [];       // ek katı dikdörtgenler (köy yapıları), piksel cinsinden
      this.layer = null;     // zemin katmanı
      this.top = null;       // varlıkların üstüne çizilen katman (çatılar, ağaç tepeleri)
      this.water = false;
    }
    idx(x, y) { return y * this.w + x; }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? WALL : this.t[y * this.w + x]; }
    set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.t[y * this.w + x] = v; }
    solidTile(x, y) { const v = this.get(x, y); return v !== FLOOR; }
    solidAt(px, py, flying) {
      const v = this.get(Math.floor(px / T), Math.floor(py / T));
      if (v === FLOOR) { for (const r of this.rects) if (px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h) return true; return false; }
      if (flying && (v === WATER || v === BLOCK)) return false;
      return true;
    }
    // Daire şeklindeki varlığı eksen eksen taşır; duvara çarptıysa true döner
    move(e, dx, dy) {
      let hit = false;
      const r = e.r || 5, fly = !!e.fly;
      const free = (x, y) => !(this.solidAt(x - r, y - r * 0.6, fly) || this.solidAt(x + r, y - r * 0.6, fly) || this.solidAt(x - r, y + r * 0.6, fly) || this.solidAt(x + r, y + r * 0.6, fly));
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
      for (let i = 0; i < steps; i++) {
        const sx = dx / steps, sy = dy / steps;
        if (free(e.x + sx, e.y)) e.x += sx; else hit = true;
        if (free(e.x, e.y + sy)) e.y += sy; else hit = true;
      }
      return hit;
    }
    // İki nokta arasında görüş var mı
    los(ax, ay, bx, by) {
      const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 6);
      for (let i = 1; i < n; i++) { const t = i / n; const v = this.get(Math.floor((ax + (bx - ax) * t) / T), Math.floor((ay + (by - ay) * t) / T)); if (v === WALL) return false; }
      return true;
    }
    randomFloor(rng, area) {
      for (let i = 0; i < 400; i++) {
        const x = area ? rng.int(area.x + 1, area.x + area.w - 2) : rng.int(1, this.w - 2);
        const y = area ? rng.int(area.y + 1, area.y + area.h - 2) : rng.int(1, this.h - 2);
        if (this.get(x, y) === FLOOR && !this.decos.some(d => d.solid && d.tx === x && d.ty === y)) return { x: x * T + 8, y: y * T + 8 };
      }
      return null;
    }
  }
  E.GameMap = GameMap;

  // ---------------- ZİNDAN ÜRETİMİ ----------------
  E.genDungeon = (floor, seed) => {
    const biome = E.biomeOf(floor);
    const rng = E.RNG(seed);
    const isBoss = floor % 10 === 0;
    const w = isBoss ? 44 : 50 + Math.min(20, Math.floor(floor / 5)), h = isBoss ? 36 : 40 + Math.min(12, Math.floor(floor / 8));
    const m = new GameMap(w, h);
    m.biome = biome; m.floor = floor; m.boss = isBoss;
    const rooms = [];
    const carve = (r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m.set(x, y, FLOOR); };

    if (isBoss) {
      // giriş odası + büyük arena
      const entry = { x: Math.floor(w / 2) - 5, y: h - 10, w: 10, h: 7 };
      const arena = { x: 5, y: 3, w: w - 10, h: h - 15 };
      carve(entry); carve(arena);
      for (let y = arena.y + arena.h; y < entry.y; y++) for (let x = Math.floor(w / 2) - 2; x <= Math.floor(w / 2) + 2; x++) m.set(x, y, FLOOR);
      // köşeleri yuvarla
      for (const [cx, cy] of [[arena.x, arena.y], [arena.x + arena.w - 1, arena.y], [arena.x, arena.y + arena.h - 1], [arena.x + arena.w - 1, arena.y + arena.h - 1]])
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) { const x = cx + dx, y = cy + dy; if (x >= arena.x && x < arena.x + arena.w && y >= arena.y && y < arena.y + arena.h && (Math.abs(x - cx) + Math.abs(y - cy) < 2)) m.set(x, y, WALL); }
      rooms.push(entry, arena);
      m.start = { x: (entry.x + entry.w / 2) * T, y: (entry.y + entry.h / 2) * T };
      m.bossSpot = { x: (arena.x + arena.w / 2) * T, y: (arena.y + arena.h / 2 - 2) * T };
      m.arena = arena;
      m.exitSpot = { x: (arena.x + arena.w / 2) * T, y: (arena.y + 3) * T };
      // sütunlar
      const pillars = [[0.22, 0.3], [0.78, 0.3], [0.22, 0.75], [0.78, 0.75]];
      for (const [px, py] of pillars) { const tx = Math.floor(arena.x + arena.w * px), ty = Math.floor(arena.y + arena.h * py); m.set(tx, ty, BLOCK); m.decos.push({ kind: 'pillar', tx, ty, x: tx * T, y: ty * T, solid: true }); m.lights.push({ x: tx * T + 8, y: ty * T - 6, r: 46, color: biome.light, flicker: 0.15 }); }
      m.lights.push({ x: m.bossSpot.x, y: m.bossSpot.y, r: 120, color: biome.accent, flicker: 0.05 });
    } else {
      const target = rng.int(8, 11) + Math.min(3, Math.floor(floor / 25));
      for (let tries = 0; tries < 500 && rooms.length < target; tries++) {
        const rw = rng.int(8, 14), rh = rng.int(7, 11);
        const r = { x: rng.int(2, w - rw - 3), y: rng.int(2, h - rh - 3), w: rw, h: rh };
        if (rooms.some(o => r.x < o.x + o.w + 3 && r.x + r.w + 3 > o.x && r.y < o.y + o.h + 3 && r.y + r.h + 3 > o.y)) continue;
        rooms.push(r);
      }
      rooms.forEach(carve);
      // bağlantılar: en yakın komşuya (MST benzeri) + birkaç fazladan
      const cen = r => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });
      const corridor = (a, b) => {
        const A = cen(a), B = cen(b);
        const horizFirst = rng() < 0.5;
        const hLine = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = -1; k <= 1; k++) m.set(x, y + k, FLOOR); };
        const vLine = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = -1; k <= 1; k++) m.set(x + k, y, FLOOR); };
        if (horizFirst) { hLine(A.x, B.x, A.y); vLine(A.y, B.y, B.x); } else { vLine(A.y, B.y, A.x); hLine(A.x, B.x, B.y); }
      };
      const connected = [0];
      const left = rooms.map((_, i) => i).slice(1);
      while (left.length) {
        let best = null;
        for (const i of connected) for (const j of left) {
          const d = E.dist(rooms[i].x, rooms[i].y, rooms[j].x, rooms[j].y);
          if (!best || d < best.d) best = { i, j, d };
        }
        corridor(rooms[best.i], rooms[best.j]);
        connected.push(best.j); left.splice(left.indexOf(best.j), 1);
      }
      for (let k = 0; k < 2; k++) corridor(rng.pick(rooms), rng.pick(rooms));
      // başlangıç: ilk oda; çıkış: en uzak oda
      const s = cen(rooms[0]);
      m.start = { x: s.x * T + 8, y: s.y * T + 8 };
      const far = rooms.slice(1).reduce((a, r) => (E.dist(cen(r).x, cen(r).y, s.x, s.y) > E.dist(cen(a).x, cen(a).y, s.x, s.y) ? r : a), rooms[1]);
      m.exitSpot = { x: cen(far).x * T + 8, y: cen(far).y * T + 8 };
      // büyük odalarda engel sütunlar
      for (const r of rooms.slice(1)) {
        if (r.w >= 12 && r.h >= 9 && rng() < 0.6) {
          for (const [fx, fy] of [[0.3, 0.35], [0.7, 0.35], [0.3, 0.7], [0.7, 0.7]]) {
            const tx = Math.floor(r.x + r.w * fx), ty = Math.floor(r.y + r.h * fy);
            m.set(tx, ty, BLOCK); m.decos.push({ kind: biome.id === 'bambu' ? 'bamboo' : biome.id === 'buz' ? 'ice' : biome.id === 'kristal' || biome.id === 'kalp' ? 'crystal' : 'pillar', tx, ty, x: tx * T, y: ty * T, solid: true, v: rng.int(0, 3) });
          }
        }
      }
    }
    m.rooms = rooms;

    // dekorlar
    const decoKinds = biome.deco.filter(k => k !== 'pillar');
    for (const r of rooms) {
      const n = Math.floor(r.w * r.h * 0.07);
      for (let i = 0; i < n; i++) {
        const tx = rng.int(r.x, r.x + r.w - 1), ty = rng.int(r.y, r.y + r.h - 1);
        if (m.get(tx, ty) !== FLOOR) continue;
        const kind = rng.pick(decoKinds);
        const solid = (['statue', 'lantern', 'brazier', 'grave', 'mushroom', 'crystal', 'ice', 'coral'].includes(kind) && rng() < 0.75) || kind === 'pinkfire';
        if (solid && (Math.abs(tx * T - m.start.x) < 40 && Math.abs(ty * T - m.start.y) < 40)) continue;
        if ((kind === 'circle' || kind === 'pinkfire') && rng() < 0.55) continue;
        if (solid) m.set(tx, ty, BLOCK);
        m.decos.push({ kind, tx, ty, x: tx * T, y: ty * T, solid, v: rng.int(0, 5) });
        if (['lantern', 'brazier', 'glow', 'crystal', 'lava', 'circle', 'mushroom', 'pinkfire'].includes(kind)) {
          const col = kind === 'lantern' || kind === 'brazier' ? '#ffcf7a' : kind === 'lava' ? '#ff6a2a' : biome.accent;
          m.lights.push({ x: tx * T + 8, y: ty * T + 6, r: kind === 'circle' ? 40 : kind === 'pinkfire' ? 52 : 34, color: col, flicker: kind === 'brazier' || kind === 'lantern' || kind === 'pinkfire' ? 0.2 : 0.05 });
        }
      }
    }
    // duvar meşaleleri
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (m.get(x, y) === WALL && m.get(x, y + 1) === FLOOR && rng() < 0.05) {
        m.decos.push({ kind: 'torch', tx: x, ty: y, x: x * T, y: y * T + 4, solid: false, wall: true });
        m.lights.push({ x: x * T + 8, y: y * T + 10, r: 44, color: '#ffb36a', flicker: 0.25 });
      }
    }
    return m;
  };

  // Zindan katmanını çiz
  E.renderMap = m => {
    const biome = m.biome;
    const [c, x] = E.canvas(m.w * T, m.h * T);
    const rng = E.RNG(m.floor * 999 + 7);
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const v = m.get(tx, ty);
      if (v === FLOOR || v === BLOCK) x.drawImage(E.gfx.tile(biome, rng.int(0, 5)), tx * T, ty * T);
      else {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const n = m.get(tx + dx, ty + dy); if (n === FLOOR || n === BLOCK) { near = true; break; } }
        if (!near) { x.fillStyle = '#07060a'; x.fillRect(tx * T, ty * T, T, T); continue; }
        const below = m.get(tx, ty + 1);
        x.drawImage(E.gfx.wall(biome, below === FLOOR || below === BLOCK, rng.int(0, 3)), tx * T, ty * T);
      }
    }
    // yumuşak gölge: duvarların hemen altındaki zemin
    x.fillStyle = 'rgba(0,0,0,0.28)';
    for (let ty = 1; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) if (m.get(tx, ty) !== WALL && m.get(tx, ty - 1) === WALL) x.fillRect(tx * T, ty * T, T, 5);
    // yerdeki (yassı) dekorlar zemine; uzun olanlar ayrı çizilir
    for (const d of m.decos) if (!d.solid && !d.wall && ['grass', 'flower', 'puddle', 'circle', 'rubble', 'bones', 'lava', 'carpet', 'snowpile', 'glow'].includes(d.kind)) x.drawImage(E.gfx.deco(d.kind, biome, d.v), d.x - 8, d.y - 24);
    m.layer = c;
    m.tall = m.decos.filter(d => !(['grass', 'flower', 'puddle', 'circle', 'rubble', 'bones', 'lava', 'carpet', 'snowpile', 'glow'].includes(d.kind)));
  };

  // ---------------- KÖY ----------------
  E.genVillage = () => {
    const W = 58, H = 42;
    const m = new GameMap(W, H, WATER);
    m.village = true; m.water = true;
    m.biome = { id: 'koy', name: 'Kiri Köyü', floor: ['#5f9a4a', '#6aa652', '#558c42'], wall: '#2a4a2a', wallTop: '#3a5a32', wallFace: '#20321c', accent: '#ffd98a', dark: 0.15, light: '#ffe2a8', fx: 'petals' };
    const land = (x0, y0, x1, y1, r = 3) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x, cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
        if (Math.hypot(x - cx, y - cy) <= r + 0.3) m.set(x, y, FLOOR);
      }
    };
    land(3, 3, 25, 36, 4);   // batı adası: tapınak, demirci
    land(32, 4, 54, 37, 4);  // doğu adası: pazar, kuyu
    for (let x = 25; x <= 32; x++) for (let y = 19; y <= 22; y++) m.set(x, y, FLOOR); // köprü
    m.bridge = { x: 25 * T, y: 19 * T, w: 8 * T, h: 4 * T };

    const S = (x, y, w, h) => m.rects.push({ x: x * T, y: y * T, w: w * T, h: h * T });
    m.structs = [];
    // tapınak (Nene)
    m.structs.push({ kind: 'shrine', x: 7 * T, y: 4 * T }); S(7, 5, 10, 5);
    // demirci (Tetsu)
    m.structs.push({ kind: 'house', x: 4 * T, y: 24 * T, roof: '#7a5a3a', label: 'DEMİRCİ' }); S(4, 25, 9, 4);
    m.structs.push({ kind: 'forge', x: 14 * T, y: 28 * T }); S(14, 28, 2, 2);
    // pazar (Mina)
    m.structs.push({ kind: 'house', x: 44 * T, y: 6 * T, roof: '#8a6a3a', label: 'PAZAR' }); S(44, 7, 9, 4);
    m.structs.push({ kind: 'stall', x: 37 * T, y: 13 * T }); S(37, 14, 5, 2);
    // ev
    m.structs.push({ kind: 'house', x: 44 * T, y: 26 * T, roof: '#6a4a2a' }); S(44, 27, 9, 4);
    // ay kuyusu
    m.structs.push({ kind: 'well', x: 41 * T, y: 20 * T }); S(41, 20, 3, 2);
    m.well = { x: 42.5 * T, y: 21.5 * T };
    // torii
    m.structs.push({ kind: 'torii', x: 34 * T, y: 17 * T });
    m.rects.push({ x: 34 * T, y: 22 * T, w: 10, h: 8 }, { x: 34 * T + 60, y: 22 * T, w: 10, h: 8 });
    // ağaçlar
    const trees = [['sakura', 19, 9], ['sakura', 8, 15], ['momiji', 50, 15], ['momiji', 21, 31], ['pine', 4, 12], ['sakura', 36, 31], ['pine', 52, 33], ['momiji', 33, 7]];
    for (const [k, tx, ty] of trees) { m.structs.push({ kind: k, x: tx * T, y: ty * T }); S(tx, ty + 1, 1, 1); }
    // fenerler
    for (const [tx, ty] of [[12, 12], [17, 12], [30, 18], [30, 23], [38, 18], [46, 19], [11, 22]]) {
      m.decos.push({ kind: 'lantern', tx, ty, x: tx * T, y: ty * T, solid: true });
      m.set(tx, ty, BLOCK);
      m.lights.push({ x: tx * T + 8, y: ty * T + 6, r: 44, color: '#ffcf7a', flicker: 0.12 });
    }
    // çiçek ve çimen
    const rng = E.RNG(42);
    for (let i = 0; i < 140; i++) {
      const tx = rng.int(3, 54), ty = rng.int(3, 37);
      if (m.get(tx, ty) !== FLOOR) continue;
      m.decos.push({ kind: rng() < 0.4 ? 'flower' : 'grass', tx, ty, x: tx * T, y: ty * T, v: rng.int(0, 5) });
    }
    // patikalar
    m.paths = [];
    const path = (x0, y0, x1, y1) => m.paths.push([x0, y0, x1, y1]);
    path(12, 10, 12, 21); path(12, 21, 25, 21); path(32, 21, 41, 21); path(41, 21, 41, 15); path(41, 15, 48, 11); path(12, 21, 9, 28); path(41, 21, 48, 30);

    // NPC'ler ve noktalar
    m.npcs = [
      { id: 'nene', name: 'Bilge Nene', x: 12 * T, y: 11 * T, role: 'shrine' },
      { id: 'tetsu', name: 'Demirci Tetsu', x: 12 * T + 8, y: 30 * T, role: 'smith' },
      { id: 'mina', name: 'Tüccar Mina', x: 39.5 * T, y: 16.5 * T, role: 'shop' },
      { id: 'koylu1', name: 'Balıkçı Haru', x: 27 * T, y: 24 * T, role: 'talk', lines: ['Kuyudan beri balıklar tutulmuyor…', 'Bir gün dev bir yengeç gördüm, inan bana!'] },
      { id: 'koylu2', name: 'Çiçekçi Aiko', x: 20 * T, y: 13 * T, role: 'talk', lines: ['Kiraz ağaçları her parçayla biraz daha canlanıyor.', 'Nene seni çok seviyor, biliyor musun?'] },
      { id: 'cocuk', name: 'Küçük Taro', x: 47 * T, y: 23 * T, role: 'talk', lines: ['Büyüyünce ben de kılıç ustası olacağım!', 'Kuyuya yaklaşma diyorlar ama sen gidiyorsun…'] }
    ];
    m.start = { x: 41 * T, y: 24.5 * T };
    m.lights.push({ x: m.well.x, y: m.well.y, r: 60, color: '#b48bff', flicker: 0.1 });
    return m;
  };

  // Köy katmanlarını çiz
  E.renderVillage = m => {
    const [c, x] = E.canvas(m.w * T, m.h * T);
    const [tc, tx2] = E.canvas(m.w * T, m.h * T);
    const P = E.gfx.painter(x), Q = E.gfx.painter(tx2);
    const D = E.shadeHex;
    const rng = E.RNG(5);
    // çimen
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      if (m.get(tx, ty) === WATER) continue;
      x.drawImage(E.gfx.tile(m.biome, rng.int(0, 5)), tx * T, ty * T);
    }
    // kıyı
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      if (m.get(tx, ty) === WATER) continue;
      if (m.get(tx, ty + 1) === WATER) { P.rect(tx * T, ty * T + 12, T, 4, '#8a6a4a'); P.rect(tx * T, ty * T + 15, T, 1, '#5a4030'); for (let i = 0; i < 3; i++) P.rect(tx * T + i * 6 + 1, ty * T + 12, 3, 2, '#a0a0a8'); }
      if (m.get(tx, ty - 1) === WATER) P.rect(tx * T, ty * T, T, 2, '#7aa060');
      if (m.get(tx - 1, ty) === WATER) P.rect(tx * T, ty * T, 2, T, '#7aa060');
      if (m.get(tx + 1, ty) === WATER) P.rect(tx * T + 14, ty * T, 2, T, '#7aa060');
    }
    // patikalar
    for (const [x0, y0, x1, y1] of m.paths) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let i = 0; i <= n; i++) {
        const px = (x0 + (x1 - x0) * i / n) * T + 4, py = (y0 + (y1 - y0) * i / n) * T + 4;
        P.ell(px + 4, py + 4, 9, 7, '#c9a878'); P.ell(px + 3, py + 3, 5, 3, '#d8bc8e');
      }
    }
    // köprü
    const b = m.bridge;
    P.rect(b.x - 4, b.y + 6, b.w + 8, b.h - 12, '#8a5a32');
    for (let i = 0; i < b.w + 8; i += 4) P.rect(b.x - 4 + i, b.y + 6, 1, b.h - 12, '#6a4224');
    P.rect(b.x - 4, b.y + 4, b.w + 8, 3, '#c4352a'); P.rect(b.x - 4, b.y + b.h - 7, b.w + 8, 3, '#c4352a');
    for (let i = 0; i <= b.w + 8; i += 16) { P.rect(b.x - 4 + i, b.y + 1, 3, 7, '#a02a22'); P.rect(b.x - 4 + i, b.y + b.h - 8, 3, 7, '#a02a22'); }
    // yerdeki dekorlar
    for (const d of m.decos) if (!d.solid) x.drawImage(E.gfx.deco(d.kind, m.biome, d.v), d.x - 8, d.y - 24);

    // yapılar
    for (const s of m.structs) {
      const X = s.x, Y = s.y;
      switch (s.kind) {
        case 'shrine': {
          P.rect(X - 4, Y + 70, 168, 12, '#9a9aa2'); P.rect(X - 4, Y + 70, 168, 2, '#b8b8c0');
          for (let i = 0; i < 4; i++) P.rect(X + 70 - i * 0, Y + 82 + i * 4, 20, 4, i % 2 ? '#8a8a92' : '#a0a0a8');
          P.rect(X + 8, Y + 30, 144, 42, '#6a3a2a'); P.rect(X + 8, Y + 30, 144, 4, '#4a2a1a');
          for (let i = 0; i < 6; i++) P.rect(X + 14 + i * 24, Y + 34, 4, 38, '#c4352a');
          P.rect(X + 60, Y + 44, 40, 28, '#3a1a12'); P.rect(X + 64, Y + 48, 32, 24, '#ffcf7a'); P.rect(X + 79, Y + 48, 2, 24, '#8a5a3a');
          Q.poly([[X - 12, Y + 34], [X + 80, Y - 6], [X + 172, Y + 34], [X + 160, Y + 40], [X, Y + 40]], '#2a2a3a');
          Q.poly([[X - 12, Y + 34], [X + 80, Y - 6], [X + 172, Y + 34]], '#3a3a52');
          Q.rect(X + 30, Y + 8, 100, 4, '#4a4a66'); Q.rect(X + 70, Y - 4, 20, 6, '#d6c27a');
          Q.poly([[X - 16, Y + 38], [X - 4, Y + 30], [X - 2, Y + 36]], '#2a2a3a'); Q.poly([[X + 176, Y + 38], [X + 164, Y + 30], [X + 162, Y + 36]], '#2a2a3a');
          break;
        }
        case 'house': {
          P.rect(X, Y + 20, 144, 46, '#e8dcc0'); P.rect(X, Y + 20, 144, 46, null);
          for (let i = 0; i <= 144; i += 24) P.rect(X + i, Y + 20, 4, 46, '#6a4a2a');
          P.rect(X, Y + 40, 144, 3, '#6a4a2a'); P.rect(X, Y + 62, 144, 4, '#4a3020');
          P.rect(X + 58, Y + 40, 28, 26, '#4a3020'); P.rect(X + 62, Y + 44, 20, 22, '#3a2418'); P.rect(X + 72, Y + 44, 1, 22, '#6a4a2a');
          P.rect(X + 14, Y + 26, 20, 12, '#ffd98a'); P.rect(X + 110, Y + 26, 20, 12, '#ffd98a'); P.rect(X + 23, Y + 26, 2, 12, '#6a4a2a'); P.rect(X + 119, Y + 26, 2, 12, '#6a4a2a');
          // saman çatı
          const roof = s.roof;
          Q.poly([[X - 14, Y + 24], [X + 20, Y - 22], [X + 124, Y - 22], [X + 158, Y + 24]], roof);
          for (let i = 0; i < 10; i++) Q.line(X - 10 + i * 17, Y + 24, X + 22 + i * 11, Y - 20, D(roof, -0.2));
          Q.rect(X - 14, Y + 20, 172, 5, D(roof, -0.35)); Q.rect(X + 20, Y - 26, 104, 6, D(roof, 0.15));
          if (s.label) { Q.rect(X + 52, Y + 2, 40, 12, '#2a1a12'); Q.rect(X + 53, Y + 3, 38, 10, '#5a3a22'); E.font.draw(tx2, s.label, X + 72, Y + 5, '#ffd98a', { align: 'center' }); }
          break;
        }
        case 'forge': P.rect(X, Y + 4, 32, 28, '#5a5a62'); P.rect(X + 6, Y + 10, 20, 14, '#2a1a12'); P.ell(X + 16, Y + 18, 7, 5, '#ff7a2b'); P.ell(X + 16, Y + 19, 4, 2, '#ffd23b');
          P.rect(X + 34, Y + 18, 14, 6, '#3a3a42'); P.rect(X + 38, Y + 24, 6, 8, '#2a2a32'); P.rect(X + 32, Y + 16, 18, 3, '#55555e');
          m.lights.push({ x: X + 16, y: Y + 18, r: 56, color: '#ff8a3a', flicker: 0.3 });
          break;
        case 'stall':
          P.rect(X, Y + 14, 80, 18, '#7a5032'); P.rect(X, Y + 14, 80, 3, '#9a6a42');
          for (let i = 0; i < 6; i++) P.circ(X + 8 + i * 12, Y + 12, 4, ['#ff6a4a', '#ffcf3a', '#7ccf5a', '#ff8fb0', '#ff9a3a', '#c27bff'][i]);
          Q.rect(X - 4, Y - 18, 88, 10, '#c4352a'); for (let i = 0; i < 88; i += 16) Q.rect(X - 4 + i, Y - 18, 8, 10, '#f2e6d0');
          Q.rect(X - 2, Y - 8, 3, 24, '#5a3a22'); Q.rect(X + 79, Y - 8, 3, 24, '#5a3a22');
          break;
        case 'well':
          P.ell(X + 24, Y + 20, 26, 14, '#5a5a66'); P.ell(X + 24, Y + 18, 22, 11, '#7a7a86'); P.ell(X + 24, Y + 18, 17, 8, '#1a1030');
          P.ell(X + 24, Y + 18, 13, 6, '#3a2a6a'); P.ell(X + 24, Y + 18, 7, 3, '#b48bff');
          Q.rect(X, Y - 20, 4, 34, '#6a4a2a'); Q.rect(X + 44, Y - 20, 4, 34, '#6a4a2a'); Q.poly([[X - 8, Y - 18], [X + 24, Y - 34], [X + 56, Y - 18], [X + 52, Y - 14], [X - 4, Y - 14]], '#3a3a52');
          break;
        case 'torii':
          P.rect(X + 2, Y + 8, 7, 76, '#c4352a'); P.rect(X + 61, Y + 8, 7, 76, '#c4352a'); P.rect(X + 2, Y + 8, 2, 76, '#e0503a'); P.rect(X + 61, Y + 8, 2, 76, '#e0503a');
          P.rect(X, Y + 78, 11, 6, '#2a2a2a'); P.rect(X + 59, Y + 78, 11, 6, '#2a2a2a');
          Q.rect(X - 10, Y, 90, 8, '#2a2a2a'); Q.rect(X - 6, Y + 8, 82, 5, '#c4352a'); Q.rect(X - 2, Y + 20, 74, 5, '#c4352a'); Q.rect(X + 31, Y + 13, 8, 7, '#2a2a2a');
          Q.poly([[X - 14, Y + 2], [X - 10, Y], [X - 10, Y + 8]], '#2a2a2a'); Q.poly([[X + 84, Y + 2], [X + 80, Y], [X + 80, Y + 8]], '#2a2a2a');
          break;
        case 'sakura': case 'momiji': case 'pine': {
          P.ell(X + 8, Y + 30, 14, 5, '#00000040');
          P.rect(X + 5, Y + 4, 6, 26, '#5a3a2a'); P.rect(X + 5, Y + 4, 2, 26, '#7a5236');
          const col = s.kind === 'sakura' ? ['#ffb7cf', '#ff9abb', '#ffd2e0'] : s.kind === 'momiji' ? ['#ff7a2b', '#e0501a', '#ffb04a'] : ['#2f6a3a', '#24552e', '#3f7f48'];
          const rr = E.RNG(X + Y);
          for (let i = 0; i < 14; i++) Q.circ(X + 8 + rr.int(-20, 20), Y - 6 + rr.int(-18, 10), rr.int(7, 11), col[i % 3]);
          for (let i = 0; i < 18; i++) Q.px(X + 8 + rr.int(-24, 24), Y - 6 + rr.int(-22, 14), col[2]);
          if (s.kind !== 'pine') for (let i = 0; i < 8; i++) P.px(X + rr.int(-14, 30), Y + 28 + rr.int(0, 8), col[0]);
          break;
        }
      }
    }
    // dik dekorlar
    for (const d of m.decos) if (d.solid) x.drawImage(E.gfx.deco(d.kind, m.biome, d.v), d.x - 8, d.y - 24);
    m.layer = c; m.top = tc; m.tall = [];
  };
})();
