import { useRef, useEffect } from 'react';
import type { FC } from 'react';

/** 粒子对象结构 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

/** 流光对象结构 */
interface Flow {
  x: number;
  y: number;
  radius: number;
  color: { r: number; g: number; b: number };
  alpha: number;
  vx: number;
  vy: number;
}

/** 配置参数接口 */
interface ConfigType {
  PARTICLE_COUNT: number;
  CONNECTION_DIST: number;
  CONNECTION_DIST_SQ: number;
  MOUSE_RADIUS: number;
  MOUSE_RADIUS_SQ: number;
  MOUSE_REPEL_FORCE: number;
  MIN_SPEED: number;
  MAX_SPEED: number;
  MIN_SIZE: number;
  MAX_SIZE: number;
  MIN_ALPHA: number;
  MAX_ALPHA: number;
  LINE_ALPHA_FACTOR: number;
  TRAIL_ALPHA: number;
  FPS_LOW_THRESHOLD: number;
  FPS_CHECK_DURATION: number;
  COLOR_R: number;
  COLOR_G: number;
  COLOR_B: number;
  FLOW_COUNT: number;
  FLOW_SPEED_MIN: number;
  FLOW_SPEED_MAX: number;
  FLOW_RADIUS_MIN: number;
  FLOW_RADIUS_MAX: number;
  FLOW_ALPHA_MIN: number;
  FLOW_ALPHA_MAX: number;
}

/** 配置参数常量 */
const CONFIG: ConfigType = {
  PARTICLE_COUNT: 80,
  CONNECTION_DIST: 150,
  CONNECTION_DIST_SQ: 150 * 150,
  MOUSE_RADIUS: 120,
  MOUSE_RADIUS_SQ: 120 * 120,
  MOUSE_REPEL_FORCE: 0.8,
  MIN_SPEED: 0.2,
  MAX_SPEED: 0.5,
  MIN_SIZE: 1,
  MAX_SIZE: 3,
  MIN_ALPHA: 0.3,
  MAX_ALPHA: 0.8,
  LINE_ALPHA_FACTOR: 0.5,
  TRAIL_ALPHA: 0.15,
  FPS_LOW_THRESHOLD: 30,
  FPS_CHECK_DURATION: 3000,
  COLOR_R: 14,
  COLOR_G: 165,
  COLOR_B: 233,
  FLOW_COUNT: 3,
  FLOW_SPEED_MIN: 0.1,
  FLOW_SPEED_MAX: 0.3,
  FLOW_RADIUS_MIN: 0.3,
  FLOW_RADIUS_MAX: 0.5,
  FLOW_ALPHA_MIN: 0.03,
  FLOW_ALPHA_MAX: 0.06,
} as const;

/** 流光颜色数组（项目品牌色系） */
const FLOW_COLORS: readonly { r: number; g: number; b: number }[] = [
  { r: 14, g: 165, b: 233 },
  { r: 99, g: 102, b: 241 },
  { r: 56, g: 189, b: 248 },
];

/**
 * 粒子网络背景组件
 * 使用 Canvas 2D 绘制粒子网络 + 流光渐变效果，支持鼠标交互排斥与 FPS 自动降级
 */
const ParticleNetworkBackground: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /** 当前粒子数量（可能因降级而减少） */
    let currentParticleCount = CONFIG.PARTICLE_COUNT;
    /** 是否已执行降级 */
    let hasDegraded = false;

    /** 鼠标位置，初始在画布外 */
    const mouse = { x: -9999, y: -9999 };

    /** 粒子数组 */
    let particles: Particle[] = [];

    /** 流光数组 */
    let flows: Flow[] = [];

    /** FPS 统计相关 */
    let fpsFrameCount = 0;
    let fpsLastTime = performance.now();
    let fpsLowStartTime = 0;
    let fpsIsLow = false;

    /** 动画帧 ID，用于卸载时取消 */
    let animFrameId = 0;

    /**
     * 设置 Canvas 像素尺寸为窗口尺寸
     */
    const resizeCanvas = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    /**
     * 创建单个粒子对象
     * @returns 包含位置、速度、大小、透明度的粒子对象
     */
    const createParticle = (): Particle => {
      const speed = CONFIG.MIN_SPEED + Math.random() * (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED);
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: CONFIG.MIN_SIZE + Math.random() * (CONFIG.MAX_SIZE - CONFIG.MIN_SIZE),
        alpha: CONFIG.MIN_ALPHA + Math.random() * (CONFIG.MAX_ALPHA - CONFIG.MIN_ALPHA),
      };
    };

    /**
     * 初始化所有粒子
     */
    const initParticles = (): void => {
      particles = [];
      for (let i = 0; i < currentParticleCount; i++) {
        particles.push(createParticle());
      }
    };

    /**
     * 初始化流光对象数组
     */
    const initFlows = (): void => {
      flows = [];
      for (let i = 0; i < CONFIG.FLOW_COUNT; i++) {
        const speed =
          CONFIG.FLOW_SPEED_MIN + Math.random() * (CONFIG.FLOW_SPEED_MAX - CONFIG.FLOW_SPEED_MIN);
        const angle = Math.random() * Math.PI * 2;
        flows.push({
          x: Math.random(),
          y: Math.random(),
          radius:
            CONFIG.FLOW_RADIUS_MIN +
            Math.random() * (CONFIG.FLOW_RADIUS_MAX - CONFIG.FLOW_RADIUS_MIN),
          color: FLOW_COLORS[i % FLOW_COLORS.length],
          alpha:
            CONFIG.FLOW_ALPHA_MIN +
            Math.random() * (CONFIG.FLOW_ALPHA_MAX - CONFIG.FLOW_ALPHA_MIN),
          vx: Math.cos(angle) * speed * 0.001,
          vy: Math.sin(angle) * speed * 0.001,
        });
      }
    };

    /**
     * 更新流光位置，到达边界时反弹
     */
    const updateFlows = (): void => {
      for (let i = 0; i < flows.length; i++) {
        const f = flows[i];
        f.x += f.vx;
        f.y += f.vy;
        if (f.x < -0.1 || f.x > 1.1) f.vx *= -1;
        if (f.y < -0.1 || f.y > 1.1) f.vy *= -1;
      }
    };

    /**
     * 绘制流光渐变效果，使用径向渐变叠加半透明色块
     */
    const drawFlowingGradients = (): void => {
      for (let i = 0; i < flows.length; i++) {
        const f = flows[i];
        const cx = f.x * canvas.width;
        const cy = f.y * canvas.height;
        const r = f.radius * Math.max(canvas.width, canvas.height);
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const a = f.alpha;
        gradient.addColorStop(
          0,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a})`
        );
        gradient.addColorStop(
          0.08,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a * 0.92})`
        );
        gradient.addColorStop(
          0.17,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a * 0.78})`
        );
        gradient.addColorStop(
          0.28,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a * 0.58})`
        );
        gradient.addColorStop(
          0.4,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a * 0.36})`
        );
        gradient.addColorStop(
          0.54,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a * 0.18})`
        );
        gradient.addColorStop(
          0.7,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a * 0.06})`
        );
        gradient.addColorStop(
          0.86,
          `rgba(${f.color.r},${f.color.g},${f.color.b},${a * 0.015})`
        );
        gradient.addColorStop(
          1,
          `rgba(${f.color.r},${f.color.g},${f.color.b},0)`
        );
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    };

    /**
     * 更新单个粒子位置，处理边界环绕
     * @param p - 粒子对象
     */
    const updateParticle = (p: Particle): void => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) {
        p.x += canvas.width;
      } else if (p.x > canvas.width) {
        p.x -= canvas.width;
      }

      if (p.y < 0) {
        p.y += canvas.height;
      } else if (p.y > canvas.height) {
        p.y -= canvas.height;
      }
    };

    /**
     * 应用鼠标排斥力，使鼠标附近粒子受到轻微推力
     * @param p - 粒子对象
     */
    const applyMouseRepel = (p: Particle): void => {
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < CONFIG.MOUSE_RADIUS_SQ && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const force = (1 - dist / CONFIG.MOUSE_RADIUS) * CONFIG.MOUSE_REPEL_FORCE;
        p.vx += (dx / dist) * force * 0.1;
        p.vy += (dy / dist) * force * 0.1;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpeed = CONFIG.MAX_SPEED * 1.5;
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }
      }
    };

    /**
     * 绘制单个粒子
     * @param p - 粒子对象
     */
    const drawParticle = (p: Particle): void => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${CONFIG.COLOR_R},${CONFIG.COLOR_G},${CONFIG.COLOR_B},${p.alpha})`;
      ctx.fill();
    };

    /**
     * 绘制粒子之间的连线
     */
    const drawConnections = (): void => {
      const len = particles.length;
      for (let i = 0; i < len; i++) {
        for (let j = i + 1; j < len; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < CONFIG.CONNECTION_DIST_SQ) {
            const alpha =
              (1 - Math.sqrt(distSq) / CONFIG.CONNECTION_DIST) * CONFIG.LINE_ALPHA_FACTOR;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${CONFIG.COLOR_R},${CONFIG.COLOR_G},${CONFIG.COLOR_B},${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
    };

    /**
     * 绘制鼠标与附近粒子之间的连线
     */
    const drawMouseConnections = (): void => {
      if (mouse.x < 0 || mouse.y < 0) return;

      const len = particles.length;
      for (let i = 0; i < len; i++) {
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < CONFIG.CONNECTION_DIST_SQ) {
          const alpha =
            (1 - Math.sqrt(distSq) / CONFIG.CONNECTION_DIST) * CONFIG.LINE_ALPHA_FACTOR;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(particles[i].x, particles[i].y);
          ctx.strokeStyle = `rgba(${CONFIG.COLOR_R},${CONFIG.COLOR_G},${CONFIG.COLOR_B},${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    };

    /**
     * 更新 FPS 计数器，检测低帧率并执行自动降级
     * 连续 3 秒低于 30fps 时将粒子数从 80 减为 40 并重新初始化
     */
    const updateFps = (): void => {
      fpsFrameCount++;
      const now = performance.now();
      const elapsed = now - fpsLastTime;

      if (elapsed >= 1000) {
        const currentFps = Math.round((fpsFrameCount * 1000) / elapsed);
        fpsFrameCount = 0;
        fpsLastTime = now;

        if (currentFps < CONFIG.FPS_LOW_THRESHOLD) {
          if (!fpsIsLow) {
            fpsIsLow = true;
            fpsLowStartTime = now;
          } else if (
            now - fpsLowStartTime >= CONFIG.FPS_CHECK_DURATION &&
            !hasDegraded
          ) {
            hasDegraded = true;
            currentParticleCount = Math.floor(CONFIG.PARTICLE_COUNT / 2);
            initParticles();
          }
        } else {
          fpsIsLow = false;
        }
      }
    };

    /**
     * 主动画循环：清屏、绘制流光、更新粒子、绘制连线与粒子、更新 FPS
     */
    const animate = (): void => {
      ctx.fillStyle = `rgba(2,6,23,${CONFIG.TRAIL_ALPHA})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      updateFlows();
      drawFlowingGradients();

      for (let i = 0; i < particles.length; i++) {
        applyMouseRepel(particles[i]);
        updateParticle(particles[i]);
      }

      drawConnections();
      drawMouseConnections();

      for (let i = 0; i < particles.length; i++) {
        drawParticle(particles[i]);
      }

      updateFps();

      animFrameId = requestAnimationFrame(animate);
    };

    /** 鼠标移动事件处理函数 */
    const handleMouseMove = (e: MouseEvent): void => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    /** 鼠标离开窗口时重置位置 */
    const handleMouseOut = (): void => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    /** 窗口尺寸变化时重新设置 Canvas 尺寸 */
    const handleResize = (): void => {
      resizeCanvas();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('resize', handleResize);

    resizeCanvas();
    initParticles();
    initFlows();
    animate();

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

export default ParticleNetworkBackground;
