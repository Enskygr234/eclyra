'use strict';
/* Eclyra — eşya üretimi, oyuncu statları, fiyatlar */
(() => {
  const I = E.items = {};
  let uid = Date.now() % 100000;

  // Rastgele bir eşya üret
  I.roll = (level, opts = {}) => {
    const r = opts.rng || E.rand;
    const slot = opts.slot || r.pick(E.SLOTS);
    let rar = opts.rarity;
    if (rar == null) {
      const mf = 1 + (opts.magicFind || 0);
      const w = E.RARITY.map((x, i) => [i, i === 0 ? x.weight : x.weight * mf * (opts.boost || 1)]);
      rar = r.weighted(w);
      if (opts.minRarity) rar = Math.max(rar, opts.minRarity);
    }
    const R = E.RARITY[rar];
    const item = {
      id: 'i' + (uid++).toString(36) + r.int(0, 999),
      slot, rarity: rar, level, plus: 0,
      icon: r.int(0, 2),
      base: {}, affixes: [], perk: null
    };
    // ana statlar (hafif rastgelelik)
    for (const [k, v] of Object.entries(E.SLOT_BASE[slot])) {
      const scaled = ['crit', 'critDmg', 'move'].includes(k) ? v : v * E.itemScale(level);
      item.base[k] = scaled * R.mult * r.range(0.9, 1.1);
    }
    // ek özellikler
    const n = r.int(R.affixes[0], R.affixes[1]);
    const pool = E.AFFIXES.slice();
    for (let i = 0; i < n && pool.length; i++) {
      const a = pool.splice(r.int(0, pool.length - 1), 1)[0];
      const [key, , min, max, scaled] = a;
      let v = r.range(min, max) * (scaled ? E.itemScale(level) : 1) * (0.85 + rar * 0.12);
      item.affixes.push({ k: key, v });
    }
    if (rar === 3) item.perk = opts.perk || r.pick(Object.keys(E.PERKS));
    item.name = I.makeName(item, r);
    return item;
  };

  I.makeName = (item, r = E.rand) => {
    const base = r.pick(E.ITEM_NAMES[item.slot]);
    if (item.rarity === 0) return base;
    if (item.rarity === 3 && item.perk) return `${E.PERKS[item.perk].name}: ${base}`;
    return `${r.pick(E.PREFIX)} ${base}`;
  };

  // Yükseltme çarpanı
  I.mult = item => 1 + 0.1 * (item.plus || 0);

  // Eşyanın verdiği statlar
  I.stats = item => {
    const s = {};
    const m = I.mult(item);
    for (const [k, v] of Object.entries(item.base)) s[k] = (s[k] || 0) + (['crit', 'critDmg', 'move'].includes(k) ? v : v * m);
    for (const a of item.affixes) s[a.k] = (s[a.k] || 0) + (E.AFFIXES.find(x => x[0] === a.k)[4] ? a.v * m : a.v);
    return s;
  };

  I.fmtStat = (k, v) => {
    if (E.PCT_STATS.has(k)) return `+${(v * 100).toFixed(v < 0.1 ? 1 : 0).replace('.', ',')}% ${E.STAT_NAME[k] || k}`;
    if (k === 'manaRegen') return `+${v.toFixed(1).replace('.', ',')}/sn ${E.STAT_NAME[k]}`;
    const name = { dmg: 'Hasar', hp: 'Can', def: 'Savunma', spell: 'Büyü gücü', mana: 'Mana' }[k] || E.STAT_NAME[k] || k;
    return `+${E.fmt(v)} ${name}`;
  };

  // Eşya puanı (karşılaştırma için kaba değer)
  I.power = item => {
    const s = I.stats(item);
    return (s.dmg || 0) * 3 + (s.hp || 0) * 0.6 + (s.def || 0) * 2 + (s.spell || 0) * 2 + (s.crit || 0) * 300 + (s.critDmg || 0) * 120 +
      (s.atkSpd || 0) * 250 + (s.move || 0) * 150 + (s.mana || 0) * 0.8 + (s.lifesteal || 0) * 600 + (s.cdr || 0) * 200 + (item.perk ? 40 + item.level * 2 : 0);
  };

  // ---------------- oyuncu statları ----------------
  I.playerStats = save => {
    const lv = save.level;
    const s = {
      maxHp: 100 + (lv - 1) * 14,
      dmg: 6 + (lv - 1) * 1.6,
      def: 2 + (lv - 1) * 0.8,
      crit: 0.05, critDmg: 1.5, atkSpd: 1, move: 1,
      maxMana: 60 + (lv - 1) * 2, manaRegen: 4, lifesteal: 0, spell: 0,
      goldFind: 0, magicFind: 0, cdr: 0, perks: new Set()
    };
    for (const slot of E.SLOTS) {
      const it = save.equip[slot];
      if (!it) continue;
      const st = I.stats(it);
      for (const [k, v] of Object.entries(st)) {
        if (k === 'hp') s.maxHp += v;
        else if (k === 'mana') s.maxMana += v;
        else if (k === 'critDmg') s.critDmg += v;
        else if (k === 'atkSpd') s.atkSpd += v;
        else if (k === 'move') s.move += v;
        else s[k] = (s[k] || 0) + v;
      }
      if (it.perk) s.perks.add(it.perk);
    }
    s.crit = Math.min(0.75, s.crit);
    s.move = Math.min(1.6, s.move);
    s.atkSpd = Math.min(2, s.atkSpd);
    s.cdr = Math.min(0.4, s.cdr);
    s.lifesteal = Math.min(0.15, s.lifesteal);
    s.maxHp = Math.round(s.maxHp);
    s.maxMana = Math.round(s.maxMana);
    return s;
  };

  // ---------------- ekonomi ----------------
  I.sellPrice = item => Math.round((6 + item.level * 3) * E.itemScale(item.level) * [1, 2.5, 6, 15][item.rarity] * (1 + 0.2 * item.plus));
  I.salvage = item => ({ ore: Math.round((1 + item.level / 6) * [1, 2, 4, 8][item.rarity]), souls: item.rarity >= 2 ? item.rarity - 1 : 0 });
  I.upgradeCost = item => ({ gold: Math.round(30 * E.itemScale(item.level) * Math.pow(1.45, item.plus) * [1, 1.3, 1.7, 2.2][item.rarity]), ore: Math.round((3 + item.plus * 3) * (1 + item.level / 25)) });
  I.potionPrice = maxFloor => Math.round(18 * E.scale(Math.max(1, maxFloor)) ** 0.85);
  I.chestPrice = maxFloor => Math.round(140 * E.scale(Math.max(1, maxFloor)) ** 0.95);
  I.spellCost = lvl => ({ souls: lvl, gold: Math.round(120 * Math.pow(1.6, lvl - 1)) });

  // XP eğrisi
  I.xpNeed = lv => Math.round(70 * E.scale(lv) * (1 + lv * 0.04));

  I.rarityColor = r => E.RARITY[r].color;
})();
