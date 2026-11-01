// Lotus jump: a small endless runner for when there is no internet. Space, the up arrow, a click or a tap to jump.
(() => {
  const cv = document.getElementById('cv');
  if (!cv) return;
  const lang = new URLSearchParams(location.search).get('lang') === 'vi' ? 'vi' : 'en';
  const T = (k, v) => LORE_I18N.t(lang, k, v);
  const ctx = cv.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const color = (n, d) => css.getPropertyValue(n).trim() || d;
  const W = cv.width, H = cv.height, GROUND = H - 34;
  // Drawn at the screen's real resolution so the lines stay sharp.
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.scale(dpr, dpr);

  let best = 0;
  try { best = Number(localStorage.getItem('lore-lotus-best')) || 0; } catch { /* storage may be off */ }

  const g = { state: 'ready', y: 0, vy: 0, speed: 5.2, dist: 0, next: 260, obstacles: [] };
  const player = { x: 70, w: 28, h: 30 };
  const hint = document.getElementById('hint');

  const say = () => {
    const left = g.state === 'ready' ? T('game.start') : g.state === 'over' ? T('game.over') : T('game.score', { n: Math.floor(g.dist / 10) });
    hint.replaceChildren(Object.assign(document.createElement('span'), { textContent: left }), Object.assign(document.createElement('span'), { textContent: T('game.best', { n: best }) }));
  };

  function reset() { Object.assign(g, { state: 'run', y: 0, vy: 0, speed: 5.2, dist: 0, next: 300, obstacles: [] }); }
  function jump() {
    if (g.state === 'ready' || g.state === 'over') { reset(); return; }
    if (g.y === 0) g.vy = 12.6;
  }

  addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); } });
  cv.addEventListener('pointerdown', () => { jump(); cv.focus(); });

  function step() {
    g.dist += g.speed;
    g.speed = Math.min(11, g.speed + 0.0016);
    g.vy -= 0.62;
    g.y = Math.max(0, g.y + g.vy);
    if (g.y === 0 && g.vy < 0) g.vy = 0;
    g.next -= g.speed;
    if (g.next <= 0) {
      const h = 22 + Math.floor(Math.random() * 26);
      g.obstacles.push({ x: W + 10, w: 12 + Math.floor(Math.random() * 8), h });
      if (Math.random() < 0.25) g.obstacles.push({ x: W + 10 + 24, w: 12, h: 18 + Math.floor(Math.random() * 18) });
      g.next = 220 + Math.random() * 260 + g.speed * 12;
    }
    for (const o of g.obstacles) o.x -= g.speed;
    g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10);
    // A little forgiveness at the edges, so a near miss is a near miss.
    for (const o of g.obstacles) {
      if (player.x + player.w - 5 > o.x + 2 && player.x + 5 < o.x + o.w - 2 && g.y < o.h - 6) {
        g.state = 'over';
        const score = Math.floor(g.dist / 10);
        if (score > best) { best = score; try { localStorage.setItem('lore-lotus-best', String(best)); } catch { /* ignore */ } }
      }
    }
  }

  function petal(x, y, r, a, fill) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-r * 0.55, -r * 0.35, -r * 0.5, -r * 0.95, 0, -r); ctx.bezierCurveTo(r * 0.5, -r * 0.95, r * 0.55, -r * 0.35, 0, 0); ctx.fill(); ctx.restore();
  }

  function draw() {
    const ink = color('--ink', '#12161C'), muted = color('--muted', '#677080'), line = color('--line', '#E7EAEF'), accent = color('--accent', '#4726B8');
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
    // dashes on the ground slide by, which is what makes it feel like running
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.35;
    for (let x = -((g.dist) % 60); x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, GROUND + 12); ctx.lineTo(x + 18, GROUND + 12); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = muted;
    for (const o of g.obstacles) { ctx.fillRect(o.x, GROUND - o.h, o.w, o.h); ctx.fillRect(o.x + o.w / 2 - 1, GROUND - o.h - 6, 2, 6); }
    // the lotus
    const cx = player.x + player.w / 2, by = GROUND - g.y;
    petal(cx, by, 24, -1.15, accent); petal(cx, by, 24, 1.15, accent); petal(cx, by, 28, -0.55, accent); petal(cx, by, 28, 0.55, accent); petal(cx, by, 32, 0, ink);
    ctx.fillStyle = muted; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(g.dist / 10)).padStart(5, '0'), W - 10, 20);
  }

  let last = 0, hintState = '';
  function frame(t) {
    const dt = Math.min(2.5, (t - last) / 16.67 || 1);
    last = t;
    if (g.state === 'run' && !document.hidden) for (let i = 0; i < Math.round(dt); i++) if (g.state === 'run') step();
    draw();
    const key = g.state + (g.state === 'run' ? Math.floor(g.dist / 10) : '') + best;
    if (key !== hintState) { hintState = key; say(); }
    requestAnimationFrame(frame);
  }
  say();
  requestAnimationFrame(frame);
})();
