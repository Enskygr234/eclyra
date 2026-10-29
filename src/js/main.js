'use strict';
/* Eclyra — başlatma, ölçekleme ve ana döngü */
(() => {
  const cv = document.getElementById('game');
  E.canvasEl = cv;
  const ctx = cv.getContext('2d', { alpha: false });

  // Ekranı tamsayı ölçekle doldur: iç çözünürlük ~480x270
  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const scale = Math.max(1, Math.min(Math.floor(W / 400), Math.floor(H / 225)) || 1);
    const s = Math.max(1, Math.round(Math.min(W / 480, H / 270)) || scale);
    E.view.scale = s;
    E.view.w = Math.ceil(W / s);
    E.view.h = Math.ceil(H / s);
    cv.width = E.view.w; cv.height = E.view.h;
    cv.style.width = E.view.w * s + 'px';
    cv.style.height = E.view.h * s + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize);
  resize();

  E.setFullscreen = on => {
    if (window.eclyra && window.eclyra.fullscreen) window.eclyra.fullscreen(on);
    else if (on) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen && document.exitFullscreen().catch(() => {});
  };
  addEventListener('keydown', e => {
    if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) { e.preventDefault(); E.game.settings.fullscreen = !E.game.settings.fullscreen; E.game.saveSettings(); E.setFullscreen(E.game.settings.fullscreen); }
  });

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    try {
      E.input.poll();
      E.game.update(dt);
      ctx.imageSmoothingEnabled = false;
      E.game.render(ctx);
    } catch (err) {
      console.error(err);
      ctx.fillStyle = '#300'; ctx.fillRect(0, 0, 300, 20);
      E.font.draw(ctx, 'Hata: ' + String(err.message || err).slice(0, 60), 4, 6, '#fff');
    }
    E.input.endFrame();
    requestAnimationFrame(frame);
  }

  E.game.boot().then(() => {
    if (E.game.settings.fullscreen) E.setFullscreen(true);
    requestAnimationFrame(frame);
  });
})();
