'use strict';
/* Eclyra — oyuncu, düşmanlar, boss'lar, mermiler, ganimet ve efektler */
(() => {
  const sfx = (n, v) => E.sfx && E.sfx(n, v);
  const TAU = Math.PI * 2;

  // ======================= EFEKTLER =======================
  E.fx = {
    particle(L, x, y, o = {}) {
      if (L.particles.length > 900) return;
      const a = o.a != null ? o.a : E.rand() * TAU, sp = o.sp != null ? o.sp : E.rand.range(20, 70);
      L.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), life: o.life || E.rand.range(0.3, 0.7), max: 0, color: o.color || '#fff', size: o.size || 1, grav: o.grav || 0, glow: !!o.glow, drag: o.drag || 2.5 });
      L.particles[L.particles.length - 1].max = L.particles[L.particles.length - 1].life;
    },
    burst(L, x, y, color, n = 10, o = {}) { for (let i = 0; i < n; i++) E.fx.particle(L, x, y, { color, ...o, sp: E.rand.range(o.min || 30, o.max || 110) }); },
    text(L, x, y, s, color = '#fff', big = false) { L.texts.push({ x: x + E.rand.range(-4, 4), y, s: String(s), color, life: big ? 1.1 : 0.8, max: big ? 1.1 : 0.8, big }); },
    ring(L, x, y, r, color, life = 0.35) { L.rings.push({ x, y, r0: 2, r1: r, color, life, max: life }); },
    shake(L, a) { L.shake = Math.max(L.shake, a); }
  };

  // ======================= HASAR =======================
  // Düşmana hasar ver
  E.hitEnemy = (L, e, dmg, o = {}) => {
    if (e.dead || e.invul > 0) return 0;
    const P = L.player;
    let crit = false;
    if (!o.noCrit && E.rand() < (o.crit != null ? o.crit : P.stats.crit)) { crit = true; dmg *= P.stats.critDmg; }
    if (e.type === 'tank' && !e.boss) { // ön kalkan
      const facing = Math.cos(e.face - E.angle(e.x, e.y, P.x, P.y));
      if (facing > 0.5 && !o.spell) { dmg *= 0.45; E.fx.burst(L, e.x, e.y - 6, '#cfd8ff', 3); }
    }
    if (e.shieldUp) dmg *= 0.3;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.flash = 0.1;
    e.aggro = true;
    if (o.kb && !e.boss && !e.fixed) { const a = E.angle(P.x, P.y, e.x, e.y); e.kx += Math.cos(a) * o.kb; e.ky += Math.sin(a) * o.kb; }
    if (o.slow) e.slow = Math.max(e.slow, o.slow);
    if (o.burn) e.burn = Math.max(e.burn, o.burn), e.burnDmg = o.burnDmg || dmg * 0.15;
    if (L.settings.numbers) E.fx.text(L, e.x, e.y - e.size * 0.6, E.fmt(dmg), crit ? '#ffd23b' : o.color || '#fff', crit);
    E.fx.burst(L, e.x, e.y - 4, o.color || e.color, crit ? 7 : 4, { max: 80 });
    if (crit && P.stats.perks.has('ay_isigi')) P.mana = Math.min(P.stats.maxMana, P.mana + 4);
    if (P.stats.lifesteal && !o.spell) P.heal(dmg * P.stats.lifesteal, true);
    sfx(crit ? 'crit' : 'hit');
    if (e.hp <= 0) E.killEnemy(L, e);
    return dmg;
  };

  // Oyuncuya hasar
  E.hitPlayer = (L, dmg, src, o = {}) => {
    const P = L.player;
    if (P.dead || P.invul > 0 || L.state !== 'play') return false;
    const K = 20 * E.scale(L.floor || 1);
    dmg = dmg * K / (K + P.stats.def);
    if (P.shield > 0) { const ab = Math.min(P.shield, dmg); P.shield -= ab; dmg -= ab; E.fx.burst(L, P.x, P.y - 6, '#d9c8ff', 6); }
    dmg = Math.max(dmg > 0 ? 1 : 0, Math.round(dmg));
    if (dmg <= 0) { P.invul = 0.25; return true; }
    P.hp -= dmg;
    P.lastHurt = L.time;
    P.invul = 0.6;
    P.flash = 0.15;
    L.hurtFlash = 0.25;
    E.fx.shake(L, 3);
    E.fx.text(L, P.x, P.y - 14, E.fmt(dmg), '#ff5a5a');
    E.fx.burst(L, P.x, P.y - 6, '#ff4a4a', 6);
    sfx('hurt');
    if (src && P.stats.perks.has('diken') && !src.dead && src.hp) E.hitEnemy(L, src, dmg * 0.3, { noCrit: true, color: '#9aff7a' });
    if (P.stats.perks.has('buz_kalbi') && P.hp < P.stats.maxHp * 0.3 && P.buzKalbi <= 0) {
      P.buzKalbi = 20;
      E.fx.ring(L, P.x, P.y, 70, '#8fe3ff', 0.5);
      for (const e of L.enemies) if (E.dist(e.x, e.y, P.x, P.y) < 70) { e.slow = 3; e.stun = Math.max(e.stun, 1.5); }
    }
    if (o.knock) { const a = E.angle(o.knock.x, o.knock.y, P.x, P.y); P.kx += Math.cos(a) * 120; P.ky += Math.sin(a) * 120; }
    if (P.hp <= 0) { P.hp = 0; P.dead = true; L.onPlayerDeath(); }
    return true;
  };

  E.killEnemy = (L, e) => {
    if (e.dead) return;
    e.dead = true;
    sfx(e.boss ? 'bossdie' : 'die');
    E.fx.burst(L, e.x, e.y - 4, e.color, e.boss ? 60 : 16, { max: e.boss ? 180 : 100, glow: true });
    E.fx.burst(L, e.x, e.y - 4, '#ffffff', e.boss ? 20 : 4);
    L.onEnemyKilled(e);
    if (e.type === 'slime' && !e.small && !e.boss && E.rand() < 0.5) {
      for (let i = 0; i < 2; i++) { const s = E.spawnEnemy(L, 'slime', e.x + (i ? 6 : -6), e.y, { small: true }); s.aggro = true; }
    }
  };

  // ======================= OYUNCU =======================
  class Player {
    constructor(L, x, y) {
      this.L = L; this.x = x; this.y = y; this.r = 5;
      this.kx = 0; this.ky = 0;
      this.aim = Math.PI / 2; this.dir = 'down'; this.anim = 0; this.moving = false;
      this.combo = 0; this.comboT = 0; this.atkCd = 0; this.swing = null; this.swingCount = 0;
      this.dashT = 0; this.dashCd = 0; this.dashDir = 0;
      this.invul = 0; this.flash = 0;
      this.cds = [0, 0, 0, 0];
      this.shield = 0; this.shieldT = 0; this.haste = 0;
      this.buzKalbi = 0; this.fireTrail = 0;
      this.refresh(true);
    }
    refresh(full) {
      const save = this.L.save;
      const old = this.stats;
      this.stats = E.items.playerStats(save);
      if (full || !old) { this.hp = this.stats.maxHp; this.mana = this.stats.maxMana; }
      else { this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - old.maxHp)); this.mana = Math.min(this.stats.maxMana, this.mana); }
    }
    heal(v, quiet) {
      const before = this.hp;
      this.hp = Math.min(this.stats.maxHp, this.hp + v);
      if (!quiet && this.hp > before) { E.fx.text(this.L, this.x, this.y - 16, '+' + E.fmt(this.hp - before), '#6dff8a'); E.fx.burst(this.L, this.x, this.y - 6, '#6dff8a', 10, { up: 30 }); }
    }
    update(dt, input) {
      const L = this.L, st = this.stats;
      if (this.dead) return;
      this.invul = Math.max(0, this.invul - dt); this.flash = Math.max(0, this.flash - dt);
      this.atkCd -= dt; this.comboT -= dt; this.dashCd -= dt; this.buzKalbi -= dt;
      for (let i = 0; i < 4; i++) this.cds[i] = Math.max(0, this.cds[i] - dt);
      this.mana = Math.min(st.maxMana, this.mana + st.manaRegen * dt);
      // savaş dışında yavaş can yenilenmesi
      if (L.time - (this.lastHurt || -99) > 5 && this.hp < st.maxHp) this.hp = Math.min(st.maxHp, this.hp + st.maxHp * 0.015 * dt);
      if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
      this.haste = Math.max(0, this.haste - dt);
      if (this.comboT <= 0) this.combo = 0;

      // nişan
      if (input.aim != null) this.aim = input.aim;
      // hareket
      let mx = input.mx, my = input.my;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      this.moving = len > 0.1;
      const speed = 74 * st.move * (this.haste > 0 ? 1.35 : 1) * (this.swing ? 0.45 : 1) * (this.slowT > 0 ? 0.6 : 1);
      if (this.dashT > 0) {
        this.dashT -= dt;
        const ds = 330;
        L.map.move(this, Math.cos(this.dashDir) * ds * dt, Math.sin(this.dashDir) * ds * dt);
        if (E.rand() < 0.8) E.fx.particle(L, this.x, this.y - 4, { color: '#b9c6ff', sp: 10, life: 0.25, size: 2 });
        if (st.perks.has('ates_izi')) { this.fireTrail -= dt; if (this.fireTrail <= 0) { this.fireTrail = 0.04; L.hazards.push({ x: this.x, y: this.y, r: 12, life: 2.2, dmg: st.dmg * 0.35, tick: 0, color: '#ff7a2b', player: true }); } }
      } else {
        L.map.move(this, mx * speed * dt + this.kx * dt, my * speed * dt + this.ky * dt);
      }
      this.kx *= Math.pow(0.001, dt); this.ky *= Math.pow(0.001, dt);
      if (this.moving) this.anim += dt * 8; else this.anim = 0;
      // yön (sprite)
      const a = this.swing ? this.aim : this.moving ? Math.atan2(my, mx) : this.aim;
      const c = Math.cos(a), s = Math.sin(a);
      this.dir = Math.abs(c) > Math.abs(s) * 1.1 ? (c > 0 ? 'right' : 'left') : s > 0 ? 'down' : 'up';

      // atılma
      if (input.dash && this.dashCd <= 0) {
        this.dashT = 0.16; this.dashCd = 0.65 * (1 - st.cdr);
        this.dashDir = this.moving ? Math.atan2(my, mx) : this.aim;
        this.invul = Math.max(this.invul, 0.22);
        sfx('dash');
      }
      // saldırı
      if (this.swing) { this.swing.t += dt; if (this.swing.t > this.swing.dur) this.swing = null; }
      if (input.attack && this.atkCd <= 0 && this.dashT <= 0) this.attack();
      // büyüler
      for (let i = 0; i < 4; i++) if (input.spell[i]) this.cast(i);
      // iksir
      if (input.potion) this.drinkPotion();
    }
    attack() {
      const L = this.L, st = this.stats;
      const n = this.combo;
      this.combo = (this.combo + 1) % 3;
      this.comboT = 0.7;
      const spd = st.atkSpd;
      this.atkCd = (n === 2 ? 0.42 : 0.26) / spd;
      const range = n === 2 ? 30 : 25, arc = n === 2 ? 1.25 : 1.05;
      this.swing = { t: 0, dur: 0.16 / Math.min(1.5, spd) + 0.06, n, dirSign: n === 1 ? -1 : 1, range, arc, aim: this.aim };
      this.swingCount++;
      sfx(n === 2 ? 'swing2' : 'swing');
      const mult = n === 2 ? 1.6 : 1;
      let hits = 0;
      const targets = L.enemies.concat(L.breakables || []);
      for (const e of targets) {
        if (e.dead) continue;
        const d = E.dist(this.x, this.y - 4, e.x, e.y - 3);
        if (d > range + e.r + 3) continue;
        if (Math.abs(E.angDiff(this.aim, E.angle(this.x, this.y - 4, e.x, e.y - 3))) > arc && d > e.r + 6) continue;
        E.hitEnemy(L, e, st.dmg * mult * E.rand.range(0.9, 1.1), { kb: n === 2 ? 160 : 70 });
        hits++;
      }
      if (hits) { L.hitstop = n === 2 ? 0.06 : 0.03; E.fx.shake(L, n === 2 ? 2.5 : 1.2); }
      if (st.perks.has('yanki') && this.swingCount % 3 === 0) {
        E.fx.ring(L, this.x, this.y, 52, '#cfd8ff', 0.3);
        for (const e of L.enemies) if (!e.dead && E.dist(e.x, e.y, this.x, this.y) < 52 + e.r) E.hitEnemy(L, e, st.dmg * 0.7, { kb: 120, noCrit: true, color: '#cfd8ff' });
      }
      if (st.perks.has('cift_kesik')) {
        L.pshots.push({ x: this.x + Math.cos(this.aim) * 10, y: this.y - 4 + Math.sin(this.aim) * 10, vx: Math.cos(this.aim) * 200, vy: Math.sin(this.aim) * 200, r: 7, life: 0.45, dmg: st.dmg * 0.6, pierce: true, hit: new Set(), kind: 'crescent', color: '#cfe0ff', a: this.aim });
      }
      if (st.perks.has('gok_gurultusu') && hits && E.rand() < 0.15) E.chainLightning(L, this.x, this.y, st.dmg * 0.8, 3);
    }
    cast(i) {
      const L = this.L, st = this.stats, sp = E.SPELLS[i];
      const lvl = L.save.spells[sp.id] || 0;
      if (!lvl || this.cds[i] > 0 || L.village) return;
      if (this.mana < sp.mana) { if (!this._noMana || L.time - this._noMana > 1) { E.fx.text(L, this.x, this.y - 18, 'Mana yetersiz', '#8fb0ff'); this._noMana = L.time; } return; }
      this.mana -= sp.mana;
      this.cds[i] = sp.cd * (1 - st.cdr);
      const power = (st.dmg * 0.8 + st.spell * 1.6) * (1 + (lvl - 1) * 0.22);
      if (sp.id === 'ates') {
        sfx('fire');
        L.pshots.push({ x: this.x + Math.cos(this.aim) * 8, y: this.y - 5 + Math.sin(this.aim) * 8, vx: Math.cos(this.aim) * 210, vy: Math.sin(this.aim) * 210, r: 4, life: 1.1, dmg: power * 1.1, aoe: 26 + lvl * 2, kind: 'fire', color: '#ff8a2b', burn: 2 });
      } else if (sp.id === 'buz') {
        sfx('ice');
        const R = 58 + lvl * 4;
        E.fx.ring(L, this.x, this.y, R, '#8fe3ff', 0.45);
        for (let k = 0; k < 24; k++) E.fx.particle(L, this.x, this.y - 4, { a: k / 24 * TAU, sp: 160, color: '#cdf3ff', life: 0.35, size: 2 });
        for (const e of L.enemies) if (!e.dead && E.dist(e.x, e.y, this.x, this.y) < R + e.r) E.hitEnemy(L, e, power * 0.8, { slow: 2.5 + lvl * 0.15, spell: true, color: '#8fe3ff', kb: 90 });
      } else if (sp.id === 'yildirim') {
        sfx('zap');
        E.chainLightning(L, this.x, this.y - 6, power * 1.15, 3 + Math.floor(lvl / 2), true);
      } else if (sp.id === 'ay') {
        sfx('shield');
        this.shield = st.maxHp * (0.25 + lvl * 0.03); this.shieldT = 6; this.haste = 3;
        E.fx.ring(L, this.x, this.y, 30, '#d9c8ff', 0.5);
      }
    }
    drinkPotion() {
      const L = this.L;
      if (L.save.potions <= 0 || this.hp >= this.stats.maxHp || this._potCd > L.time) return;
      L.save.potions--;
      this._potCd = L.time + 0.6;
      this.heal(this.stats.maxHp * 0.45);
      sfx('potion');
    }
  }
  E.Player = Player;

  // Yıldırım zinciri
  E.chainLightning = (L, x, y, dmg, jumps, spell) => {
    let cx = x, cy = y;
    const hit = new Set();
    const pts = [[x, y]];
    for (let j = 0; j < jumps; j++) {
      let best = null, bd = j === 0 ? 150 : 90;
      for (const e of L.enemies) { if (e.dead || hit.has(e)) continue; const d = E.dist(cx, cy, e.x, e.y); if (d < bd && L.map.los(cx, cy, e.x, e.y)) { bd = d; best = e; } }
      if (!best) break;
      hit.add(best);
      pts.push([best.x, best.y - 6]);
      E.hitEnemy(L, best, dmg * (1 - j * 0.1), { spell, color: '#fff36b', slow: 0.3 });
      cx = best.x; cy = best.y;
    }
    if (pts.length > 1) L.bolts.push({ pts, life: 0.22, max: 0.22 });
  };

  // ======================= DÜŞMANLAR =======================
  E.spawnEnemy = (L, type, x, y, o = {}) => {
    const base = E.ENEMIES[type];
    const fl = L.floor;
    const sc = E.scale(fl);
    const biome = E.biomeOf(fl);
    const elite = !!o.elite;
    const small = !!o.small;
    const e = {
      type, x, y, r: base.r * (elite ? 1.4 : small ? 0.7 : 1), fly: !!base.fly, fixed: !!base.fixed,
      hp: base.hp * sc * (elite ? 3.2 : small ? 0.4 : 1) * (1 + Math.max(0, fl - 90) * 0.02),
      dmg: base.dmg * sc * (elite ? 1.35 : 1), speed: base.speed * (1 + Math.min(0.3, fl / 300)),
      size: base.size * (elite ? 1.5 : small ? 0.75 : 1),
      color: o.color || biome.colors[type] || '#aaa', name: o.name || biome.names[type] || type,
      elite, small, xp: base.xp * sc * (elite ? 4 : small ? 0.3 : 1), gold: base.gold * sc * (elite ? 4 : 1),
      kx: 0, ky: 0, slow: 0, burn: 0, stun: 0, flash: 0, invul: 0, t: E.rand() * 3, state: 'idle', timer: E.rand.range(0.5, 1.5),
      face: 0, aggro: !!o.aggro, anim: E.rand() * 10, vx: 0, vy: 0, cd: E.rand.range(0.8, 2)
    };
    e.maxHp = e.hp;
    L.enemies.push(e);
    return e;
  };

  const eShot = (L, e, a, speed, o = {}) => {
    L.eshots.push({ x: e.x + Math.cos(a) * 6, y: e.y - 6 + Math.sin(a) * 6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: o.r || 3, dmg: o.dmg || e.dmg * 0.8, life: o.life || 3, color: o.color || e.color, src: e, kind: o.kind || 'orb', home: o.home || 0, slow: o.slow || 0, accel: o.accel || 0 });
  };
  E.eShot = eShot;

  // Yerde uyarı alanı (telegraf) → süre dolunca patlar
  E.telegraph = (L, o) => { L.tele.push({ t: 0, ...o }); };

  E.updateEnemy = (L, e, dt) => {
    const P = L.player;
    if (e.dead) return;
    e.flash = Math.max(0, e.flash - dt); e.invul = Math.max(0, e.invul - dt);
    e.anim += dt * (e.type === 'bat' ? 12 : 6);
    if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.5; E.hitEnemy(L, e, e.burnDmg, { noCrit: true, color: '#ff8a2b', spell: true }); E.fx.particle(L, e.x, e.y - 6, { color: '#ff8a2b', up: 30, sp: 10 }); } if (e.dead) return; }
    const slowF = e.slow > 0 ? 0.5 : 1; e.slow = Math.max(0, e.slow - dt);
    // geri tepme
    if (Math.abs(e.kx) + Math.abs(e.ky) > 1) { L.map.move(e, e.kx * dt, e.ky * dt); e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt); }
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.boss) { E.updateBoss(L, e, dt * slowF); return; }

    const d = E.dist(e.x, e.y, P.x, P.y);
    const ang = E.angle(e.x, e.y, P.x, P.y);
    if (!e.aggro && d < 150 && L.map.los(e.x, e.y, P.x, P.y)) { e.aggro = true; e.cd = Math.max(e.cd, 0.4); }
    if (!e.aggro) { // boşta gezin
      e.timer -= dt;
      if (e.timer <= 0) { e.timer = E.rand.range(1, 2.5); e.wa = E.rand() * TAU; e.wm = E.rand() < 0.5; }
      if (e.wm && !e.fixed) L.map.move(e, Math.cos(e.wa) * e.speed * 0.3 * dt, Math.sin(e.wa) * e.speed * 0.3 * dt);
      return;
    }
    if (P.dead) return;
    e.face = ang;
    e.cd -= dt * slowF;
    const sp = e.speed * slowF;
    const touch = d < e.r + P.r + 2;
    const contact = (mult = 0.7) => { if (touch && (e.touchCd || 0) <= 0) { if (E.hitPlayer(L, e.dmg * mult, e)) e.touchCd = 0.8; } };
    e.touchCd = (e.touchCd || 0) - dt;

    switch (e.type) {
      case 'slime':
        if (e.state === 'hop') {
          e.timer -= dt; L.map.move(e, e.vx * dt, e.vy * dt); contact(0.9);
          if (e.timer <= 0) { e.state = 'idle'; e.cd = E.rand.range(0.6, 1.1); }
        } else if (e.cd <= 0) { e.state = 'hop'; e.timer = 0.38; const a = ang + E.rand.range(-0.3, 0.3); e.vx = Math.cos(a) * sp * 3.4; e.vy = Math.sin(a) * sp * 3.4; sfx('slime', 0.3); }
        break;
      case 'bat': {
        e.t += dt;
        if (e.state === 'back') { e.timer -= dt; L.map.move(e, -Math.cos(ang) * sp * dt, -Math.sin(ang) * sp * dt); if (e.timer <= 0) e.state = 'idle'; break; }
        const wob = Math.sin(e.t * 5) * 1.2;
        L.map.move(e, Math.cos(ang + wob) * sp * dt, Math.sin(ang + wob) * sp * dt);
        if (touch && (e.touchCd || 0) <= 0) { if (E.hitPlayer(L, e.dmg * 0.8, e)) e.touchCd = 0.8; e.state = 'back'; e.timer = 0.6; }
        break;
      }
      case 'chaser':
        if (e.state === 'wind') {
          e.timer -= dt;
          if (e.timer <= 0) {
            e.state = 'idle'; e.cd = E.rand.range(0.9, 1.3); e.swingFx = 0.15;
            if (d < 28 + P.r && Math.abs(E.angDiff(e.swingA, ang)) < 1.2) E.hitPlayer(L, e.dmg, e);
            sfx('eswing', 0.4);
          }
        } else {
          if (d > 18) L.map.move(e, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
          if (d < 26 && e.cd <= 0) { e.state = 'wind'; e.timer = 0.42; e.swingA = ang; }
          contact(0.4);
        }
        e.swingFx = Math.max(0, (e.swingFx || 0) - dt);
        break;
      case 'charger':
        if (e.state === 'aim') {
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 'dash'; e.timer = 0.7; e.vx = Math.cos(e.chargeA) * 230; e.vy = Math.sin(e.chargeA) * 230; sfx('charge', 0.4); }
        } else if (e.state === 'dash') {
          e.timer -= dt;
          const hit = L.map.move(e, e.vx * dt * slowF, e.vy * dt * slowF);
          if (touch && (e.touchCd || 0) <= 0) { if (E.hitPlayer(L, e.dmg, e, { knock: e })) e.touchCd = 1; }
          if (E.rand() < 0.5) E.fx.particle(L, e.x, e.y, { color: '#8a7a6a', sp: 15, life: 0.3 });
          if (hit) { e.state = 'idle'; e.stun = 0.9; e.cd = 1.4; E.fx.shake(L, 2); E.fx.burst(L, e.x, e.y, '#aaa', 6); }
          else if (e.timer <= 0) { e.state = 'idle'; e.cd = E.rand.range(1.2, 2); }
        } else {
          if (d > 60) L.map.move(e, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
          else L.map.move(e, Math.cos(ang + 1.5) * sp * 0.6 * dt, Math.sin(ang + 1.5) * sp * 0.6 * dt);
          if (e.cd <= 0 && d < 170 && L.map.los(e.x, e.y, P.x, P.y)) { e.state = 'aim'; e.timer = 0.62; e.chargeA = ang; }
          contact(0.5);
        }
        break;
      case 'archer': {
        const want = 110;
        const mv = d < want - 25 ? -1 : d > want + 30 ? 1 : 0;
        const strafe = Math.sin(e.t += dt) > 0 ? 1 : -1;
        if (e.state !== 'aim') L.map.move(e, (Math.cos(ang) * mv + Math.cos(ang + 1.57) * strafe * 0.5) * sp * dt, (Math.sin(ang) * mv + Math.sin(ang + 1.57) * strafe * 0.5) * sp * dt);
        if (e.state === 'aim') { e.timer -= dt; if (e.timer <= 0) { e.state = 'idle'; e.cd = E.rand.range(1.6, 2.4); eShot(L, e, E.angle(e.x, e.y, P.x, P.y), 165, { kind: 'arrow', r: 2, color: '#f0e6c8', dmg: e.dmg }); if (L.floor > 40) { eShot(L, e, ang - 0.25, 150, { kind: 'arrow', r: 2, color: '#f0e6c8' }); eShot(L, e, ang + 0.25, 150, { kind: 'arrow', r: 2, color: '#f0e6c8' }); } sfx('bow', 0.4); } }
        else if (e.cd <= 0 && L.map.los(e.x, e.y, P.x, P.y)) { e.state = 'aim'; e.timer = 0.45; }
        break;
      }
      case 'caster':
        e.blink = (e.blink || E.rand.range(3, 6)) - dt;
        if (e.blink <= 0) {
          e.blink = E.rand.range(4, 7);
          const p = L.map.randomFloor(E.rand, { x: Math.floor(P.x / 16) - 6, y: Math.floor(P.y / 16) - 6, w: 13, h: 13 });
          if (p && E.dist(p.x, p.y, P.x, P.y) > 50) { E.fx.burst(L, e.x, e.y - 6, e.color, 10); e.x = p.x; e.y = p.y; E.fx.burst(L, e.x, e.y - 6, e.color, 10); sfx('blink', 0.3); }
        }
        if (d > 130) L.map.move(e, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
        if (e.state === 'cast') {
          e.timer -= dt;
          if (e.timer <= 0) {
            e.state = 'idle'; e.cd = E.rand.range(1.8, 2.8);
            if (E.rand() < 0.5) for (let k = -2; k <= 2; k++) eShot(L, e, ang + k * 0.22, 85, { r: 3 });
            else { const n = 8 + Math.floor(L.floor / 20); for (let k = 0; k < n; k++) eShot(L, e, k / n * TAU + e.t, 70, { r: 3 }); }
            sfx('ecast', 0.35);
          }
        } else if (e.cd <= 0 && L.map.los(e.x, e.y, P.x, P.y) && d < 190) { e.state = 'cast'; e.timer = 0.55; }
        break;
      case 'bomber':
        if (e.state === 'fuse') {
          e.timer -= dt;
          if (e.timer <= 0) {
            e.dead = true;
            E.explode(L, e.x, e.y, 36, e.dmg, e.color);
            L.onEnemyKilled(e, true);
          }
        } else {
          L.map.move(e, Math.cos(ang) * sp * 1.15 * dt, Math.sin(ang) * sp * 1.15 * dt);
          if (d < 22) { e.state = 'fuse'; e.timer = 0.65; E.telegraph(L, { x: e.x, y: e.y, r: 36, dur: 0.65, color: '#ff5a3a' }); sfx('fuse', 0.4); }
        }
        break;
      case 'turret':
        e.t += dt;
        if (d < 200 && e.cd <= 0) {
          e.burst = (e.burst || 0) + dt;
          e.shotT = (e.shotT || 0) - dt;
          if (e.shotT <= 0) { e.shotT = 0.22; e.spin = (e.spin || 0) + 0.55; for (let k = 0; k < 3; k++) eShot(L, e, e.spin + k * TAU / 3, 62, { r: 3, life: 4 }); }
          if (e.burst > 2.2) { e.burst = 0; e.cd = E.rand.range(1.2, 2); }
        }
        break;
      case 'tank':
        if (e.state === 'slam') {
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 'idle'; e.cd = E.rand.range(2.5, 3.5); E.explode(L, e.x, e.y, 46, e.dmg * 1.1, '#cfc0a6', true); }
        } else {
          if (d > 16) L.map.move(e, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
          if (d < 50 && e.cd <= 0) { e.state = 'slam'; e.timer = 0.85; E.telegraph(L, { x: e.x, y: e.y, r: 46, dur: 0.85, color: '#ffb04a' }); }
          contact(0.6);
        }
        break;
    }
  };

  // Patlama: alan hasarı
  E.explode = (L, x, y, r, dmg, color, quiet) => {
    E.fx.ring(L, x, y, r, color, 0.3);
    E.fx.burst(L, x, y, color, 18, { max: 140, glow: true });
    E.fx.shake(L, 3);
    if (!quiet) sfx('boom', 0.5);
    else sfx('slam', 0.5);
    const P = L.player;
    if (E.dist(x, y, P.x, P.y) < r + P.r) E.hitPlayer(L, dmg, null);
  };

  // ======================= BOSS =======================
  const BOSS_PATTERNS = {
    boar: [['charge', 3], ['charge', 3], ['stomp', 2], ['summon', 1]],
    serpent: [['bubbles', 3], ['ring', 2], ['spiral', 2], ['dive', 2]],
    wolf: [['leap', 3], ['claw', 3], ['charge', 2], ['howl', 1]],
    mother: [['spiral', 3], ['meteor', 3], ['summon', 2], ['ring', 2]],
    oni: [['stomp', 3], ['meteor', 3], ['fan', 2], ['charge', 2]],
    yuki: [['teleport', 2], ['spiral', 3], ['fan', 3], ['ring', 2], ['summon', 1]],
    giant: [['stomp', 3], ['meteor', 3], ['ring', 2], ['summon', 2]],
    golem: [['laser', 4], ['ring', 2], ['fan', 2], ['meteor', 1]],
    samurai: [['slash', 4], ['fan', 2], ['teleport', 2], ['summon', 1]],
    void: [['laser', 3], ['spiral', 3], ['meteor', 2], ['slash', 2], ['summon', 1], ['ring', 2]]
  };

  E.spawnBoss = (L, idx, x, y) => {
    const B = E.BOSSES[idx];
    const sc = E.scale(L.floor);
    const e = E.spawnEnemy(L, 'chaser', x, y, { color: B.color, name: B.name });
    Object.assign(e, {
      boss: true, bossIdx: idx, kind: B.kind, r: B.r, size: B.size, fixed: !!B.fixed,
      hp: B.hp * sc * (1 + Math.max(0, L.floor - 50) * 0.01), dmg: B.dmg * sc, speed: 46, title: B.title,
      state: 'intro', timer: 1.6, phase: 1, aggro: true, xp: 220 * sc, gold: 60 * sc, patT: 0, spin: 0
    });
    e.maxHp = e.hp;
    e.invul = 1.6;
    L.boss = e;
    return e;
  };

  E.updateBoss = (L, e, dt) => {
    const P = L.player;
    if (P.dead) return;
    const ang = E.angle(e.x, e.y, P.x, P.y), d = E.dist(e.x, e.y, P.x, P.y);
    e.face = ang;
    e.anim += dt;
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
      e.phase = 2; e.state = 'roar'; e.timer = 1; e.invul = 1;
      E.fx.ring(L, e.x, e.y, 90, '#ffffff', 0.6); E.fx.shake(L, 6); sfx('roar');
      E.fx.text(L, e.x, e.y - e.size, 'ÖFKELENDİ!', '#ff5a5a', true);
    }
    const fast = e.phase === 2 ? 1.3 : 1;
    const contact = () => { if (d < e.r + P.r && (e.touchCd || 0) <= 0) { if (E.hitPlayer(L, e.dmg * 0.6, e, { knock: e })) e.touchCd = 0.9; } };
    e.touchCd = (e.touchCd || 0) - dt;

    if (e.state === 'intro' || e.state === 'roar') { e.timer -= dt; if (e.timer <= 0) { e.state = 'idle'; e.timer = 0.6; } return; }
    if (e.state === 'idle') {
      e.timer -= dt * fast;
      if (!e.fixed && d > 40) L.map.move(e, Math.cos(ang) * e.speed * 0.6 * dt, Math.sin(ang) * e.speed * 0.6 * dt);
      contact();
      if (e.timer <= 0) {
        const pats = BOSS_PATTERNS[e.kind];
        const p = E.rand.weighted(pats);
        startPattern(L, e, p, fast);
      }
      return;
    }
    // aktif desen
    e.patT += dt * fast;
    runPattern(L, e, dt, fast, ang, d);
    contact();
  };

  function endPattern(e, rest) { e.state = 'idle'; e.timer = rest != null ? rest : E.rand.range(0.7, 1.3); e.patT = 0; }

  function startPattern(L, e, p, fast) {
    const P = L.player;
    e.state = p; e.patT = 0; e.step = 0; e.count = 0;
    switch (p) {
      case 'charge': e.count = e.kind === 'boar' ? (e.phase === 2 ? 4 : 3) : 2; e.sub = 'aim'; e.subT = 0.6; e.chargeA = E.angle(e.x, e.y, P.x, P.y); break;
      case 'stomp': E.telegraph(L, { x: e.x, y: e.y, r: 70, dur: 0.9 / fast, color: '#ffb04a' }); break;
      case 'meteor': {
        const n = 5 + (e.phase === 2 ? 4 : 0);
        for (let i = 0; i < n; i++) {
          const tx = i === 0 ? P.x : P.x + E.rand.range(-90, 90), ty = i === 0 ? P.y : P.y + E.rand.range(-70, 70);
          E.telegraph(L, { x: tx, y: ty, r: 26, dur: 0.9 + i * 0.12, color: e.color === '#e8e0c8' ? '#e3dcc6' : '#ff7a2b', onEnd: () => E.explode(L, tx, ty, 26, e.dmg * 0.9, e.kind === 'giant' ? '#e3dcc6' : '#ff7a2b') });
        }
        break;
      }
      case 'leap': { const tx = P.x, ty = P.y; e.leapFrom = { x: e.x, y: e.y }; e.leapTo = { x: tx, y: ty }; E.telegraph(L, { x: tx, y: ty, r: 42, dur: 0.85 / fast, color: '#ff4a4a' }); break; }
      case 'dive': e.invul = 1.2; e.hide = true; break;
      case 'teleport': E.fx.burst(L, e.x, e.y - 10, e.color, 20); e.hide = true; break;
      case 'laser': e.beamA = E.angle(e.x, e.y, P.x, P.y) - 1.2; e.beams = e.phase === 2 ? 3 : 2; sfx('charge'); break;
      case 'slash': e.count = e.phase === 2 ? 4 : 3; e.sub = 'vanish'; e.subT = 0.35; break;
      case 'summon': case 'howl': {
        const n = e.phase === 2 ? 4 : 3;
        const types = { boar: 'charger', wolf: 'bat', mother: 'slime', yuki: 'bat', giant: 'chaser', samurai: 'charger', void: 'chaser', serpent: 'slime', oni: 'bomber', golem: 'turret' };
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU;
          const p2 = { x: e.x + Math.cos(a) * 40, y: e.y + Math.sin(a) * 30 };
          if (L.map.solidAt(p2.x, p2.y)) continue;
          const m = E.spawnEnemy(L, types[e.kind] || 'chaser', p2.x, p2.y, { aggro: true });
          m.xp *= 0.3; m.gold *= 0.3; m.summoned = true;
          E.fx.burst(L, p2.x, p2.y, e.color, 10);
        }
        sfx('roar', 0.6);
        break;
      }
    }
  }

  function runPattern(L, e, dt, fast, ang, d) {
    const P = L.player;
    switch (e.state) {
      case 'charge':
        if (e.sub === 'aim') { e.subT -= dt * fast; e.chargeA = E.lerp(e.chargeA, ang, 0.08); if (e.subT <= 0) { e.sub = 'go'; e.subT = 0.9; sfx('charge'); } }
        else {
          e.subT -= dt;
          const hit = L.map.move(e, Math.cos(e.chargeA) * 260 * fast * dt, Math.sin(e.chargeA) * 260 * fast * dt);
          if (E.rand() < 0.6) E.fx.particle(L, e.x, e.y, { color: '#9a8a7a', sp: 20, life: 0.4, size: 2 });
          if (d < e.r + P.r + 2 && (e.touchCd || 0) <= 0) { if (E.hitPlayer(L, e.dmg, e, { knock: e })) e.touchCd = 0.8; }
          if (hit || e.subT <= 0) {
            if (hit) { E.fx.shake(L, 4); sfx('slam', 0.6); for (let k = 0; k < 8; k++) eShot(L, e, k / 8 * TAU, 80, { r: 4 }); }
            e.count--;
            if (e.count > 0) { e.sub = 'aim'; e.subT = 0.45; e.chargeA = ang; } else endPattern(e, hit ? 1.4 : 0.8);
          }
        }
        break;
      case 'stomp':
        if (e.patT >= 0.9 && !e.step) {
          e.step = 1; E.explode(L, e.x, e.y, 70, e.dmg * 1.1, '#ffb04a', true);
          const n = e.phase === 2 ? 18 : 12; for (let k = 0; k < n; k++) eShot(L, e, k / n * TAU, 90, { r: 4 });
        }
        if (e.patT > 1.4) endPattern(e);
        break;
      case 'meteor': if (e.patT > 1.6) endPattern(e, 0.6); break;
      case 'leap': {
        const t = Math.min(1, e.patT / 0.85);
        e.x = E.lerp(e.leapFrom.x, e.leapTo.x, t); e.y = E.lerp(e.leapFrom.y, e.leapTo.y, t); e.lift = Math.sin(t * Math.PI) * 30;
        if (t >= 1 && !e.step) { e.step = 1; e.lift = 0; E.explode(L, e.x, e.y, 42, e.dmg * 1.2, '#ff4a4a', true); for (let k = 0; k < 10; k++) eShot(L, e, k / 10 * TAU, 100, { r: 3 }); }
        if (e.patT > 1.3) endPattern(e);
        break;
      }
      case 'claw':
        if (e.patT > 0.35 * (e.step + 1) && e.step < (e.phase === 2 ? 3 : 2)) {
          e.step++; sfx('eswing');
          for (let k = -3; k <= 3; k++) eShot(L, e, ang + k * 0.16, 150, { r: 3, kind: 'claw', color: '#ff6a6a' });
        }
        if (e.patT > 1.3) endPattern(e);
        break;
      case 'fan':
        if (e.patT > 0.4 * (e.step + 1) && e.step < 4) {
          e.step++;
          const n = e.phase === 2 ? 9 : 7;
          for (let k = 0; k < n; k++) eShot(L, e, ang + (k - (n - 1) / 2) * 0.17, 110, { r: 3, kind: e.kind === 'yuki' ? 'shard' : 'orb', slow: e.kind === 'yuki' ? 1.2 : 0 });
          sfx('ecast', 0.4);
        }
        if (e.patT > 1.9) endPattern(e);
        break;
      case 'ring':
        if (e.patT > 0.5 * (e.step + 1) && e.step < 3) {
          e.step++;
          const n = 16 + (e.phase === 2 ? 8 : 0);
          for (let k = 0; k < n; k++) eShot(L, e, k / n * TAU + e.step * 0.2, 75, { r: 4 });
          sfx('ecast', 0.4);
        }
        if (e.patT > 1.8) endPattern(e);
        break;
      case 'spiral':
        e.shotT = (e.shotT || 0) - dt;
        if (e.shotT <= 0) {
          e.shotT = 0.07; e.spin += 0.32;
          const arms = e.phase === 2 ? 4 : 3;
          for (let k = 0; k < arms; k++) eShot(L, e, e.spin + k * TAU / arms, 72, { r: 3, life: 5, kind: e.kind === 'yuki' ? 'shard' : 'orb', slow: e.kind === 'yuki' ? 0.8 : 0 });
        }
        if (e.patT > 2.8) endPattern(e, 1);
        break;
      case 'bubbles':
        if (e.patT > 0.5 * (e.step + 1) && e.step < 4) { e.step++; for (let k = -1; k <= 1; k++) eShot(L, e, ang + k * 0.5, 45, { r: 6, home: 1.2, life: 5, kind: 'bubble', color: '#8fe3ff' }); sfx('slime', 0.5); }
        if (e.patT > 2.4) endPattern(e);
        break;
      case 'dive':
        if (e.patT > 0.8 && !e.step) {
          e.step = 1; e.hide = false;
          const p = { x: P.x + E.rand.range(-60, 60), y: P.y + E.rand.range(-50, 50) };
          if (!L.map.solidAt(p.x, p.y)) { e.x = p.x; e.y = p.y; }
          E.fx.burst(L, e.x, e.y, '#8fe3ff', 30); E.fx.shake(L, 4);
          for (let k = 0; k < 14; k++) eShot(L, e, k / 14 * TAU, 85, { r: 4, color: '#8fe3ff' });
        }
        if (e.patT > 1.4) endPattern(e);
        break;
      case 'teleport':
        if (e.patT > 0.5 && !e.step) {
          e.step = 1; e.hide = false;
          for (let i = 0; i < 20; i++) { const a = E.rand() * TAU, r = E.rand.range(60, 110); const p = { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r }; if (!L.map.solidAt(p.x, p.y) && L.map.los(p.x, p.y, P.x, P.y)) { e.x = p.x; e.y = p.y; break; } }
          E.fx.burst(L, e.x, e.y - 10, e.color, 20); sfx('blink');
          for (let k = 0; k < 10; k++) eShot(L, e, k / 10 * TAU, 70, { r: 3, kind: 'shard' });
        }
        if (e.patT > 0.9) endPattern(e, 0.4);
        break;
      case 'laser': {
        const warm = 0.7;
        if (e.patT < warm) { e.beamWarn = true; break; }
        e.beamWarn = false;
        e.beamA += dt * 1.1 * (e.phase === 2 ? 1.25 : 1);
        for (let k = 0; k < e.beams; k++) {
          const a = e.beamA + k * TAU / e.beams;
          // oyuncu ışına yakın mı
          const px = P.x - e.x, py = (P.y - 4) - (e.y - 10);
          const along = px * Math.cos(a) + py * Math.sin(a);
          const perp = Math.abs(-px * Math.sin(a) + py * Math.cos(a));
          if (along > 0 && along < 260 && perp < 7) E.hitPlayer(L, e.dmg * 0.5, null);
        }
        if (e.patT > warm + 3.2) { e.beams = 0; endPattern(e, 1); }
        break;
      }
      case 'slash':
        e.subT -= dt * fast;
        if (e.sub === 'vanish') { e.hide = true; if (e.subT <= 0) { const a = E.rand() * TAU; e.x = P.x + Math.cos(a) * 34; e.y = P.y + Math.sin(a) * 26; if (L.map.solidAt(e.x, e.y)) { e.x = P.x; e.y = P.y - 30; } e.hide = false; e.sub = 'wind'; e.subT = 0.38; e.slashA = E.angle(e.x, e.y, P.x, P.y); E.telegraph(L, { x: e.x, y: e.y, r: 44, dur: 0.38 / fast, color: '#ffcf5a', arc: e.slashA }); sfx('blink'); } }
        else if (e.sub === 'wind') { if (e.subT <= 0) { e.sub = 'cut'; e.subT = 0.2; sfx('swing2'); if (E.dist(e.x, e.y, P.x, P.y) < 46 && Math.abs(E.angDiff(e.slashA, E.angle(e.x, e.y, P.x, P.y))) < 1.3) E.hitPlayer(L, e.dmg * 1.1, e); e.slashFx = 0.2; } }
        else if (e.subT <= 0) { e.count--; if (e.count > 0) { e.sub = 'vanish'; e.subT = 0.25; } else endPattern(e, 1); }
        break;
      default: endPattern(e);
    }
    e.slashFx = Math.max(0, (e.slashFx || 0) - dt);
  }

  // ======================= MERMİLER =======================
  E.updateShots = (L, dt) => {
    const P = L.player;
    for (const s of L.eshots) {
      if (s.home) { const a = E.angle(s.x, s.y, P.x, P.y - 4); const cur = Math.atan2(s.vy, s.vx); const n = cur + E.clamp(E.angDiff(cur, a), -s.home * dt, s.home * dt); const sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(n) * sp; s.vy = Math.sin(n) * sp; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (L.map.get(Math.floor(s.x / 16), Math.floor(s.y / 16)) === 1) { s.life = 0; E.fx.burst(L, s.x, s.y, s.color, 3, { max: 40 }); continue; }
      if (!P.dead && E.dist(s.x, s.y, P.x, P.y - 5) < s.r + P.r) {
        if (P.invul <= 0) { if (E.hitPlayer(L, s.dmg, s.src && !s.src.dead ? s.src : null)) { s.life = 0; if (s.slow) P.slowT = s.slow; } }
      }
    }
    L.eshots = L.eshots.filter(s => s.life > 0);

    for (const s of L.pshots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.kind === 'fire' && E.rand() < 0.7) E.fx.particle(L, s.x, s.y, { color: E.rand() < 0.5 ? '#ffd23b' : '#ff6a2a', sp: 15, life: 0.3, glow: true });
      const wall = L.map.get(Math.floor(s.x / 16), Math.floor(s.y / 16)) === 1;
      let boom = wall;
      for (const e of L.enemies) {
        if (e.dead || (s.hit && s.hit.has(e))) continue;
        if (E.dist(s.x, s.y, e.x, e.y - 4) < s.r + e.r) {
          if (s.pierce) { s.hit.add(e); E.hitEnemy(L, e, s.dmg, { color: s.color, kb: 60 }); }
          else { boom = true; if (!s.aoe) E.hitEnemy(L, e, s.dmg, { color: s.color, spell: true }); break; }
        }
      }
      if (boom || s.life <= 0) {
        s.life = 0;
        if (s.aoe) {
          E.fx.ring(L, s.x, s.y, s.aoe, s.color, 0.25);
          E.fx.burst(L, s.x, s.y, s.color, 14, { glow: true, max: 120 });
          sfx('boom', 0.35);
          for (const e of L.enemies) if (!e.dead && E.dist(s.x, s.y, e.x, e.y) < s.aoe + e.r) E.hitEnemy(L, e, s.dmg, { color: s.color, spell: true, burn: s.burn, burnDmg: s.dmg * 0.12, kb: 80 });
        }
      }
    }
    L.pshots = L.pshots.filter(s => s.life > 0);

    // yerdeki tehlikeler (ateş izi)
    for (const h of L.hazards) {
      h.life -= dt; h.tick -= dt;
      if (h.tick <= 0) { h.tick = 0.4; if (h.player) for (const e of L.enemies) if (!e.dead && E.dist(h.x, h.y, e.x, e.y) < h.r + e.r) E.hitEnemy(L, e, h.dmg, { noCrit: true, color: h.color, spell: true }); }
      if (E.rand() < 0.15) E.fx.particle(L, h.x + E.rand.range(-6, 6), h.y, { color: h.color, up: 25, sp: 6, life: 0.4, glow: true });
    }
    L.hazards = L.hazards.filter(h => h.life > 0);

    // telegraflar
    for (const t of L.tele) {
      t.t += dt;
      if (t.t >= t.dur) { t.done = true; if (t.onEnd) t.onEnd(); }
    }
    L.tele = L.tele.filter(t => !t.done);
  };

  // ======================= GANİMET =======================
  E.drop = (L, x, y, kind, o = {}) => {
    const a = E.rand() * TAU, sp = E.rand.range(30, 70);
    L.pickups.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, z: 0, vz: E.rand.range(60, 100), t: 0, ...o });
  };

  E.updatePickups = (L, dt) => {
    const P = L.player;
    for (const p of L.pickups) {
      p.t += dt;
      if (p.z > 0 || p.vz > 0) { p.vz -= 260 * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0 && p.vz < 0) p.vz = p.vz < -40 ? -p.vz * 0.35 : 0; }
      L.map.move(p, p.vx * dt, p.vy * dt); p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt);
      if (P.dead || p.t < 0.35) continue;
      const d = E.dist(p.x, p.y, P.x, P.y);
      const magnet = p.kind === 'item' ? 0 : 46;
      if (d < magnet) { const a = E.angle(p.x, p.y, P.x, P.y); const s = 200 * (1 - d / magnet) + 60; p.x += Math.cos(a) * s * dt; p.y += Math.sin(a) * s * dt; }
      if (d < 9) L.collect(p);
    }
    L.pickups = L.pickups.filter(p => !p.taken);
  };

  // ======================= PARÇACIKLAR =======================
  E.updateParticles = (L, dt) => {
    for (const p of L.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
      const f = Math.pow(0.5, dt * p.drag); p.vx *= f; p.vy *= f;
    }
    L.particles = L.particles.filter(p => p.life > 0);
    for (const t of L.texts) { t.life -= dt; t.y -= dt * (t.big ? 18 : 26); }
    L.texts = L.texts.filter(t => t.life > 0);
    for (const r of L.rings) r.life -= dt;
    L.rings = L.rings.filter(r => r.life > 0);
    for (const b of L.bolts) b.life -= dt;
    L.bolts = L.bolts.filter(b => b.life > 0);
  };
})();
