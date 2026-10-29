'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SELFTEST = process.env.ECLYRA_SELFTEST || null;
if (!app.requestSingleInstanceLock()) app.quit();
let win = null;

function savePath() { return path.join(app.getPath('userData'), 'eclyra-save.json'); }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 800, minHeight: 450,
    backgroundColor: '#05030a', title: 'Eclyra — Ayın Kuyusu', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (SELFTEST) win.webContents.once('did-finish-load', () => selfTest(SELFTEST));
}

ipcMain.handle('save:load', () => {
  for (const p of [savePath(), savePath() + '.bak']) {
    try { const s = fs.readFileSync(p, 'utf8'); JSON.parse(s); return s; } catch (e) {}
  }
  return null;
});
ipcMain.handle('save:write', (e, data) => {
  if (typeof data !== 'string' || data.length > 20 * 1024 * 1024) return false;
  const p = savePath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak');
    fs.writeFileSync(p + '.tmp', data);
    fs.renameSync(p + '.tmp', p);
    return true;
  } catch (err) { return false; }
});
ipcMain.on('win:fullscreen', (e, on) => { if (win) win.setFullScreen(!!on); });
ipcMain.on('app:quit', () => app.quit());

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.whenReady().then(createWindow);

// CI: Windows'ta oyunu açıp birkaç ekran görüntüsü alır
async function selfTest(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shot = async name => fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG());
  const run = js => win.webContents.executeJavaScript(js).catch(e => fs.appendFileSync(path.join(dir, 'errors.txt'), String(e) + '\n'));
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2) fs.appendFileSync(path.join(dir, 'errors.txt'), msg + '\n'); });
  await wait(2500); await shot('1-title');
  await run("E.game.newGame(); E.game.save.introSeen=true; E.game.enterVillage(); E.game.screen='play'");
  await wait(1500); await shot('2-village');
  await run("E.ui.closeAll(); E.game.enterFloor(3)"); await wait(2000); await shot('3-floor');
  await run("E.ui.closeAll(); E.game.save.level=30; E.game.enterFloor(30); const L=E.game.L; L.player.y=L.map.arena.y*16+L.map.arena.h*16-30"); await wait(3500); await shot('4-boss');
  const fps = await run("new Promise(r=>{let n=0;const t=performance.now();(function f(){n++;if(performance.now()-t<3000)requestAnimationFrame(f);else r(n/3)})()})");
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ fps, version: app.getVersion(), saveFile: fs.existsSync(savePath()) }, null, 2));
  app.quit();
}
