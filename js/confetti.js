// Konfetti in ~60 Zeilen statt 12 kB Library: ein Canvas, das sich nach 2 s selbst entfernt.
const COLORS = ['#3ec96a', '#ffc93c', '#ff6b6b', '#4dabf7', '#c77dff'];

export function burst(originEl) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-layer';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const rect = originEl ? originEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
  const ox = rect.left + rect.width / 2;
  const oy = rect.top + rect.height / 2;

  const parts = Array.from({ length: 70 }, () => ({
    x: ox,
    y: oy,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 13 - 3,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
    size: 6 + Math.random() * 7,
    color: COLORS[(Math.random() * COLORS.length) | 0],
  }));

  const start = performance.now();
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#22223b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (t < 2200) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
