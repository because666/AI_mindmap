/**
 * 生成 OG 封面图
 * 使用 Node.js Canvas API 生成 1200×630 的科技感封面图
 */

const fs = require('fs');
const path = require('path');

// 尝试导入 canvas 库，如果不存在则使用 SVG 方案
let Canvas;
try {
  Canvas = require('canvas');
} catch {
  Canvas = null;
}

const OUTPUT_PATH = path.resolve(__dirname, '../public/og-cover.png');
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * 生成渐变背景
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 */
function drawGradientBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(0.5, '#1e1b4b');
  gradient.addColorStop(1, '#312e81');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/**
 * 绘制发光节点
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} x - 节点 X 坐标
 * @param {number} y - 节点 Y 坐标
 * @param {number} radius - 节点半径
 * @param {string} color - 节点颜色
 */
function drawGlowingNode(ctx, x, y, radius, color) {
  // 外发光
  const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
  glowGradient.addColorStop(0, color + '80');
  glowGradient.addColorStop(0.5, color + '20');
  glowGradient.addColorStop(1, color + '00');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
  ctx.fill();

  // 节点本体
  const nodeGradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
  nodeGradient.addColorStop(0, '#ffffff');
  nodeGradient.addColorStop(0.4, color);
  nodeGradient.addColorStop(1, color + '80');
  ctx.fillStyle = nodeGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 绘制连接线
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} x1 - 起点 X
 * @param {number} y1 - 起点 Y
 * @param {number} x2 - 终点 X
 * @param {number} y2 - 终点 Y
 * @param {string} color - 线条颜色
 */
function drawConnectionLine(ctx, x1, y1, x2, y2, color) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, color + '60');
  gradient.addColorStop(0.5, color + 'CC');
  gradient.addColorStop(1, color + '60');

  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 沿线的光点效果
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const pulseGradient = ctx.createRadialGradient(midX, midY, 0, midX, midY, 6);
  pulseGradient.addColorStop(0, color + 'FF');
  pulseGradient.addColorStop(1, color + '00');
  ctx.fillStyle = pulseGradient;
  ctx.beginPath();
  ctx.arc(midX, midY, 6, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 生成节点网络图
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 */
function drawNetwork(ctx) {
  const nodes = [
    { x: 200, y: 180, r: 18, c: '#22d3ee' },
    { x: 450, y: 120, r: 14, c: '#818cf8' },
    { x: 700, y: 200, r: 20, c: '#22d3ee' },
    { x: 950, y: 150, r: 16, c: '#a78bfa' },
    { x: 350, y: 350, r: 22, c: '#22d3ee' },
    { x: 600, y: 320, r: 26, c: '#818cf8' },
    { x: 850, y: 380, r: 18, c: '#22d3ee' },
    { x: 150, y: 480, r: 15, c: '#a78bfa' },
    { x: 500, y: 520, r: 20, c: '#22d3ee' },
    { x: 800, y: 500, r: 16, c: '#818cf8' },
    { x: 1050, y: 450, r: 14, c: '#a78bfa' },
    { x: 250, y: 300, r: 12, c: '#818cf8' },
    { x: 750, y: 120, r: 13, c: '#22d3ee' },
  ];

  // 绘制连接线
  const connections = [
    [0, 1], [1, 2], [2, 3],
    [0, 4], [1, 4], [1, 5], [2, 5], [3, 6], [2, 6],
    [4, 5], [5, 6], [6, 10],
    [4, 7], [4, 8], [5, 8], [5, 9], [6, 9], [6, 10],
    [7, 8], [8, 9], [9, 10],
    [11, 0], [11, 4], [12, 2], [12, 3],
  ];

  connections.forEach(([i, j]) => {
    drawConnectionLine(ctx, nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, '#22d3ee');
  });

  // 绘制节点
  nodes.forEach((node) => {
    drawGlowingNode(ctx, node.x, node.y, node.r, node.c);
  });
}

/**
 * 绘制粒子流效果
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 */
function drawParticles(ctx) {
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT;
    const size = Math.random() * 3 + 1;
    const alpha = Math.random() * 0.5 + 0.2;

    ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 绘制装饰性光晕
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 */
function drawAmbientGlow(ctx) {
  const glow1 = ctx.createRadialGradient(WIDTH * 0.2, HEIGHT * 0.3, 0, WIDTH * 0.2, HEIGHT * 0.3, 400);
  glow1.addColorStop(0, 'rgba(34, 211, 238, 0.15)');
  glow1.addColorStop(1, 'rgba(34, 211, 238, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow2 = ctx.createRadialGradient(WIDTH * 0.8, HEIGHT * 0.7, 0, WIDTH * 0.8, HEIGHT * 0.7, 350);
  glow2.addColorStop(0, 'rgba(167, 139, 250, 0.12)');
  glow2.addColorStop(1, 'rgba(167, 139, 250, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

async function generateOGCover() {
  if (!Canvas) {
    throw new Error('需要安装 canvas 依赖才能生成图片。请运行：npm install canvas --save-dev');
  }

  const canvas = Canvas.createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  drawGradientBackground(ctx);
  drawAmbientGlow(ctx);
  drawNetwork(ctx);
  drawParticles(ctx);

  // 确保输出目录存在
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 保存为 PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(OUTPUT_PATH, buffer);

  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`OG 封面图已生成：${OUTPUT_PATH}`);
  console.log(`文件大小：${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`图片尺寸：${WIDTH}x${HEIGHT}`);
}

generateOGCover().catch((error) => {
  console.error('生成 OG 封面图失败：', error.message);
  process.exit(1);
});
