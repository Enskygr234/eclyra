'use strict';
/* Eclyra — ortak yardımcılar */
const E = window.E = {};

E.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
E.lerp = (a, b, t) => a + (b - a) * t;
E.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
E.angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
E.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
E.ease = { out: t => 1 - (1 - t) * (1 - t), in: t => t * t, inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };

// Tohumlu rastgele sayı üreteci (mulberry32)
E.RNG = function (seed) {
  let s = seed >>> 0;
  const r = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.range = (a, b) => a + r() * (b - a);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  r.weighted = list => { // [[item, weight], ...]
    const tot = list.reduce((a, x) => a + x[1], 0);
    let v = r() * tot;
    for (const [it, w] of list) { if ((v -= w) <= 0) return it; }
    return list[list.length - 1][0];
  };
  return r;
};
E.rand = E.RNG((Math.random() * 1e9) | 0);

E.hash = (...n) => { let h = 2166136261; for (const x of n) { h ^= (x | 0); h = Math.imul(h, 16777619); } return h >>> 0; };

// Renk yardımcıları
E.hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
E.rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
E.shade = (h, f) => { const [r, g, b] = E.hex(h); return f >= 0 ? E.rgb(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : E.rgb(r * (1 + f), g * (1 + f), b * (1 + f)); };
E.shadeHex = (h, f) => {
  const [r, g, b] = E.hex(h);
  const m = v => Math.round(E.clamp(f >= 0 ? v + (255 - v) * f : v * (1 + f), 0, 255)).toString(16).padStart(2, '0');
  return '#' + m(r) + m(g) + m(b);
};
E.mix = (h1, h2, t) => { const a = E.hex(h1), b = E.hex(h2); return '#' + a.map((v, i) => Math.round(E.lerp(v, b[i], t)).toString(16).padStart(2, '0')).join(''); };

E.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };

E.fmt = n => {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + 'Mr';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '') + 'B';
  return String(n);
};
E.pct = v => Math.round(v * 100) + '%';
