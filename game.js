(() => {
  'use strict';

  // Logical playfield size; the canvas is scaled to fit the window.
  const W = 400;
  const H = 600;
  const GROUND_H = 90;
  const FLOOR_Y = H - GROUND_H;

  const GRAVITY = 1500;
  const FLAP_VELOCITY = -430;
  const MAX_FALL = 700;
  const BIRD_X = 110;
  const BIRD_R = 14;

  const PIPE_W = 64;
  const PIPE_GAP = 150;
  const PIPE_SPACING = 220;
  const PIPE_SPEED = 150;
  const GAP_MARGIN = 70;

  const STEP = 1 / 120;
  const RESTART_DELAY = 0.5;
  const BEST_KEY = 'flappy-best';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let state = 'ready'; // ready | playing | over
  let bird, pipes, score, best, time, overTime, groundOffset, flash;

  function loadBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (e) {
      // Storage may be unavailable (private mode); the record just won't persist.
    }
  }

  function reset() {
    bird = { y: H * 0.42, vy: 0, angle: 0 };
    pipes = [];
    score = 0;
    time = 0;
    overTime = 0;
    groundOffset = 0;
    flash = 0;
    state = 'ready';
  }

  function spawnPipe(x) {
    const min = GAP_MARGIN + PIPE_GAP / 2;
    const max = FLOOR_Y - GAP_MARGIN - PIPE_GAP / 2;
    pipes.push({ x, gapY: min + Math.random() * (max - min), passed: false });
  }

  function flap() {
    if (state === 'ready') {
      state = 'playing';
      spawnPipe(W + 80);
      bird.vy = FLAP_VELOCITY;
    } else if (state === 'playing') {
      bird.vy = FLAP_VELOCITY;
    } else if (overTime >= RESTART_DELAY) {
      reset();
    }
  }

  function hitsPipe(p) {
    const top = p.gapY - PIPE_GAP / 2;
    const bottom = p.gapY + PIPE_GAP / 2;
    const nx = Math.max(p.x, Math.min(BIRD_X, p.x + PIPE_W));
    // Pipes extend past the top of the screen, so flying over them is not possible.
    for (const [y0, y1] of [[-1e4, top], [bottom, FLOOR_Y]]) {
      const ny = Math.max(y0, Math.min(bird.y, y1));
      const dx = BIRD_X - nx;
      const dy = bird.y - ny;
      if (dx * dx + dy * dy < BIRD_R * BIRD_R) return true;
    }
    return false;
  }

  function die() {
    state = 'over';
    overTime = 0;
    flash = 1;
    if (score > best) {
      best = score;
      saveBest();
    }
  }

  function update(dt) {
    time += dt;
    flash = Math.max(0, flash - dt * 4);

    if (state === 'ready') {
      bird.y = H * 0.42 + Math.sin(time * 5) * 8;
      groundOffset = (groundOffset + PIPE_SPEED * dt) % 24;
      return;
    }

    bird.vy = Math.min(bird.vy + GRAVITY * dt, MAX_FALL);
    bird.y += bird.vy * dt;
    if (bird.y < BIRD_R) {
      bird.y = BIRD_R;
      bird.vy = 0;
    }
    const target = Math.max(-0.45, Math.min(1.4, bird.vy / 450));
    bird.angle += (target - bird.angle) * Math.min(1, dt * 12);

    if (state === 'playing') {
      groundOffset = (groundOffset + PIPE_SPEED * dt) % 24;
      for (const p of pipes) {
        p.x -= PIPE_SPEED * dt;
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          score++;
        }
      }
      if (pipes.length && pipes[0].x + PIPE_W < -10) pipes.shift();
      const last = pipes[pipes.length - 1];
      if (last.x <= W - PIPE_SPACING) spawnPipe(last.x + PIPE_SPACING + PIPE_W);

      if (pipes.some(hitsPipe)) die();
    } else {
      overTime += dt;
    }

    if (bird.y + BIRD_R >= FLOOR_Y) {
      bird.y = FLOOR_Y - BIRD_R;
      bird.vy = 0;
      if (state === 'playing') die();
    }
  }

  // ---------- Rendering ----------

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    sky.addColorStop(0, '#4ec0ca');
    sky.addColorStop(1, '#bfeaf0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, FLOOR_Y);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const clouds = [[60, 110, 26], [210, 70, 20], [330, 150, 30], [140, 210, 18]];
    for (const [cx, cy, r] of clouds) {
      const x = ((cx - time * 8) % (W + 120) + W + 120) % (W + 120) - 60;
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.arc(x + r, cy + 6, r * 0.8, 0, Math.PI * 2);
      ctx.arc(x - r, cy + 6, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant hills
    ctx.fillStyle = '#8fd694';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    for (let x = 0; x <= W; x += 10) {
      ctx.lineTo(x, FLOOR_Y - 34 - Math.sin(x * 0.03) * 14 - Math.sin(x * 0.011 + 2) * 10);
    }
    ctx.lineTo(W, FLOOR_Y);
    ctx.fill();
  }

  function drawPipe(p) {
    const top = p.gapY - PIPE_GAP / 2;
    const bottom = p.gapY + PIPE_GAP / 2;
    const body = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
    body.addColorStop(0, '#5aa02c');
    body.addColorStop(0.35, '#9be05a');
    body.addColorStop(1, '#4a8a22');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#2f5d14';
    ctx.lineWidth = 2;

    const capH = 26;
    const capX = p.x - 4;
    const capW = PIPE_W + 8;
    for (const [y, h, capY] of [
      [-2, top - capH + 2, top - capH],
      [bottom + capH, FLOOR_Y - bottom - capH, bottom],
    ]) {
      ctx.fillRect(p.x, y, PIPE_W, h);
      ctx.strokeRect(p.x, y, PIPE_W, h);
      ctx.fillRect(capX, capY, capW, capH);
      ctx.strokeRect(capX, capY, capW, capH);
    }
  }

  function drawGround() {
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, FLOOR_Y, W, GROUND_H);
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(0, FLOOR_Y, W, 16);
    ctx.fillStyle = '#5aa51f';
    for (let x = -groundOffset - 24; x < W + 24; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR_Y + 16);
      ctx.lineTo(x + 12, FLOOR_Y);
      ctx.lineTo(x + 24, FLOOR_Y);
      ctx.lineTo(x + 12, FLOOR_Y + 16);
      ctx.fill();
    }
    ctx.fillStyle = '#543847';
    ctx.fillRect(0, FLOOR_Y - 2, W, 2);
    ctx.fillStyle = '#c9c07a';
    ctx.fillRect(0, FLOOR_Y + 16, W, 3);
  }

  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.angle);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3b2a1a';

    ctx.fillStyle = '#f8d020';
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wing flaps while alive
    const wing = state === 'over' ? 0 : Math.sin(time * 22) * 4;
    ctx.fillStyle = '#fbe98a';
    ctx.beginPath();
    ctx.ellipse(-6, 2 + wing, 8, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(9, -5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f0502a';
    ctx.beginPath();
    ctx.moveTo(10, 1);
    ctx.lineTo(24, 4);
    ctx.lineTo(10, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function text(str, x, y, size, fill = '#fff') {
    ctx.font = `bold ${size}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 7);
    ctx.strokeStyle = '#3b2a1a';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  function drawPanel() {
    const w = 250;
    const h = 150;
    const x = (W - w) / 2;
    const y = 200;
    ctx.fillStyle = '#ded895';
    ctx.strokeStyle = '#3b2a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    text('Счёт', x + 70, y + 38, 20, '#f8a020');
    text(String(score), x + 70, y + 78, 36);
    text('Рекорд', x + 180, y + 38, 20, '#f8a020');
    text(String(best), x + 180, y + 78, 36);
    if (score > 0 && score === best) text('Новый рекорд!', W / 2, y + 122, 18, '#ff5a4a');
  }

  function render() {
    drawBackground();
    for (const p of pipes) drawPipe(p);
    drawGround();
    drawBird();

    if (state === 'ready') {
      text('Flappy Bird', W / 2, 130, 44, '#f8d020');
      text('Пробел, клик или касание —', W / 2, 360, 20);
      text('взмах крыльями', W / 2, 388, 20);
      if (best > 0) text(`Рекорд: ${best}`, W / 2, 440, 18);
    } else if (state === 'playing') {
      text(String(score), W / 2, 70, 52);
    } else {
      text('Игра окончена', W / 2, 140, 38, '#ff7a5a');
      drawPanel();
      if (overTime >= RESTART_DELAY) text('Нажмите, чтобы сыграть ещё', W / 2, 395, 20);
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.8})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Loop, sizing and input ----------

  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  let lastTime = null;
  let acc = 0;
  function frame(now) {
    if (lastTime !== null) {
      // Clamp so a background tab does not fast-forward the game on return.
      acc += Math.min((now - lastTime) / 1000, 0.1);
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
    }
    lastTime = now;
    render();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    flap();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) flap();
    }
  });
  window.addEventListener('resize', resize);

  best = loadBest();
  reset();
  resize();
  requestAnimationFrame(frame);
})();
