'use strict';
/* Eclyra — klavye, fare ve oyun kolu girdileri */
(() => {
  const keys = new Set(), pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, right: false, clicked: false, rclicked: false, moved: false, wheel: 0 };
  let pad = null, padPrev = {}, padUsed = false, lastMouseMove = 0;
  let typedChars = [];

  addEventListener('keydown', e => {
    if (e.repeat && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); return; }
    keys.add(e.code); pressed.add(e.code); padUsed = false;
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F1', 'Escape'].includes(e.code) || e.altKey) e.preventDefault();
    E.audio && E.audio.unlock();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.down = mouse.right = false; });
  const cv = () => E.canvasEl;
  addEventListener('mousemove', e => {
    const c = cv(); if (!c) return;
    const r = c.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * E.view.w;
    mouse.y = (e.clientY - r.top) / r.height * E.view.h;
    mouse.moved = true; padUsed = false; lastMouseMove = performance.now();
  });
  addEventListener('mousedown', e => {
    E.audio && E.audio.unlock();
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) { mouse.right = true; mouse.rclicked = true; }
    padUsed = false;
  });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });

  const I = E.input = {
    mouse, keys,
    down: c => keys.has(c),
    hit: c => pressed.has(c),
    any: (...cs) => cs.some(c => pressed.has(c)),
    get padUsed() { return padUsed; },
    get mouseRecent() { return performance.now() - lastMouseMove < 3000; },
    // her karenin başında oyun kolunu oku
    poll() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      pad = null;
      for (const p of pads) if (p && p.connected) { pad = p; break; }
      if (!pad) return;
      const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const now = {};
      for (let i = 0; i < 17; i++) now[i] = b(i);
      const ax = pad.axes;
      if (Math.hypot(ax[0] || 0, ax[1] || 0) > 0.3 || Object.values(now).some(Boolean)) padUsed = true;
      I.padPressed = i => now[i] && !padPrev[i];
      I.padDown = i => now[i];
      // menü gezinmesi için sol çubuğu ok tuşlarına çevir
      const ly = ax[1] || 0, lx = ax[0] || 0;
      const dir = ly < -0.6 ? 'ArrowUp' : ly > 0.6 ? 'ArrowDown' : lx < -0.6 ? 'ArrowLeft' : lx > 0.6 ? 'ArrowRight' : null;
      if (dir && dir !== I._padDir) pressed.add(dir);
      I._padDir = dir;
      if (I.padPressed(12)) pressed.add('ArrowUp'); if (I.padPressed(13)) pressed.add('ArrowDown');
      if (I.padPressed(14)) pressed.add('ArrowLeft'); if (I.padPressed(15)) pressed.add('ArrowRight');
      if (I.padPressed(0)) pressed.add('PadA'); if (I.padPressed(1)) pressed.add('PadB');
      if (I.padPressed(9)) pressed.add('PadStart'); if (I.padPressed(8)) pressed.add('PadSelect');
      if (I.padPressed(4)) pressed.add('PadLB'); if (I.padPressed(5)) pressed.add('PadRB');
      if (I.padPressed(2)) pressed.add('PadX'); if (I.padPressed(3)) pressed.add('PadY');
      padPrev = now;
    },
    padPressed: () => false, padDown: () => false,
    // oyun içi kontroller
    gameplay(player, cam) {
      let mx = 0, my = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
      let aim = null;
      const out = { mx, my, attack: false, dash: false, spell: [false, false, false, false], potion: false, aim };
      if (pad) {
        const ax = pad.axes;
        if (Math.hypot(ax[0], ax[1]) > 0.2) { out.mx = ax[0]; out.my = ax[1]; }
        if (Math.hypot(ax[2] || 0, ax[3] || 0) > 0.35) out.aim = Math.atan2(ax[3], ax[2]);
        else if (Math.hypot(ax[0], ax[1]) > 0.3) out.aim = Math.atan2(ax[1], ax[0]);
        out.attack = I.padDown(7) || I.padDown(0);
        out.dash = I.padPressed(1) || I.padPressed(6);
        out.spell[0] = I.padPressed(2); out.spell[1] = I.padPressed(3); out.spell[2] = I.padPressed(5); out.spell[3] = I.padPressed(4) && I.padDown(6);
        out.potion = I.padPressed(4) && !I.padDown(6);
      }
      if (!padUsed && player) {
        // fare ile nişan
        const wx = mouse.x + cam.x, wy = mouse.y + cam.y;
        out.aim = Math.atan2(wy - (player.y - 5), wx - player.x);
        if (mx || my) { if (!I.mouseRecent) out.aim = Math.atan2(my, mx); }
      }
      out.attack = out.attack || mouse.down || keys.has('KeyJ');
      out.dash = out.dash || pressed.has('Space') || pressed.has('ShiftLeft') || pressed.has('KeyK');
      out.spell[0] = out.spell[0] || pressed.has('Digit1') || pressed.has('KeyQ') || mouse.rclicked;
      out.spell[1] = out.spell[1] || pressed.has('Digit2');
      out.spell[2] = out.spell[2] || pressed.has('Digit3') || pressed.has('KeyR');
      out.spell[3] = out.spell[3] || pressed.has('Digit4') || pressed.has('KeyC');
      out.potion = out.potion || pressed.has('KeyF');
      return out;
    },
    confirm: () => pressed.has('Enter') || pressed.has('Space') || pressed.has('PadA') || pressed.has('KeyE'),
    back: () => pressed.has('Escape') || pressed.has('PadB'),
    endFrame() { pressed.clear(); mouse.clicked = false; mouse.rclicked = false; mouse.wheel = 0; mouse.moved = false; typedChars = []; }
  };
  void typedChars;
})();
