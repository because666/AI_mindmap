import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * 几何体粒子云配置接口
 */
interface CloudConfig {
  name: string;
  type: number;
  size: number;
  color: [number, number, number];
  orbitR: number;
  orbitAngle: number;
  orbitSpeed: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  zOff: number;
  breathSpeed: number;
  breathAmp: number;
}

/**
 * 粒子云运行时数据
 */
interface CloudData {
  cfg: CloudConfig;
  material: THREE.ShaderMaterial;
  currentAngle: number;
  burstPhase: number;
  phase: number;
}

const VERTEX_SHADER = [
  'attribute vec3 aColor;',
  'attribute float aSize;',
  'attribute float aAlpha;',
  'attribute float aPhase;',
  'uniform float uTime;',
  'uniform float uBreath;',
  'uniform float uBurst;',
  'uniform float uPixelRatio;',
  'uniform vec3 uMouseOrigin;',
  'uniform vec3 uMouseDir;',
  'uniform float uMouseActive;',
  'varying float vAlpha;',
  'varying vec3 vColor;',
  '',
  'void main() {',
  '  vAlpha = aAlpha;',
  '  vColor = aColor;',
  '  vec3 pos = position;',
  '',
  '  float wave = sin(uTime * 0.8 + aPhase * 6.2832) * 1.5;',
  '  vec3 dir = normalize(pos + vec3(0.001));',
  '  pos += dir * wave;',
  '',
  '  pos *= (1.0 + uBreath);',
  '  pos *= (1.0 + uBurst * 0.3);',
  '',
  '  if (uMouseActive > 0.5) {',
  '    vec3 toPoint = pos - uMouseOrigin;',
  '    float projLen = dot(toPoint, uMouseDir);',
  '    vec3 closestPt = uMouseOrigin + uMouseDir * projLen;',
  '    float distToRay = length(pos - closestPt);',
  '    float repulseRadius = 130.0;',
  '    if (distToRay < repulseRadius) {',
  '      vec3 repulseDir = normalize(pos - closestPt + vec3(0.001));',
  '      float strength = 1.0 - distToRay / repulseRadius;',
  '      strength = strength * strength * 45.0;',
  '      pos += repulseDir * strength;',
  '    }',
  '  }',
  '',
  '  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);',
  '  gl_PointSize = aSize * uPixelRatio * (700.0 / -mvPosition.z);',
  '  gl_PointSize = max(1.0, gl_PointSize);',
  '  gl_Position = projectionMatrix * mvPosition;',
  '}'
].join('\n');

const FRAGMENT_SHADER = [
  'varying float vAlpha;',
  'varying vec3 vColor;',
  '',
  'void main() {',
  '  float dist = length(gl_PointCoord - vec2(0.5));',
  '  if (dist > 0.5) discard;',
  '  float glow = 1.0 - dist * 2.0;',
  '  glow = pow(glow, 1.5);',
  '  gl_FragColor = vec4(vColor, vAlpha * glow);',
  '}'
].join('\n');

/**
 * 梦幻艺术宇宙背景组件
 * 使用 Three.js 渲染 65000 粒子的几何体粒子云和背景环境粒子
 * 支持鼠标交互排斥、呼吸缩放、轨道公转、三轴自转等动画效果
 */
const DreamyUniverseBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    const pixR = Math.min(window.devicePixelRatio || 1, 1.5);
    const isMobile = W <= 768;

    const PARTICLES_PER_CLOUD = isMobile ? 5500 : 8000;
    const ENV_PARTICLE_COUNT = isMobile ? 8000 : 12000;
    const PARTICLE_SIZE = 3.0;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    const particleClouds: THREE.Object3D[] = [];
    const cloudDataList: CloudData[] = [];
    let envParticles: THREE.Points;
    let meteorParticles: THREE.Points | null = null;
    let meteorData: { positions: Float32Array; velocities: Float32Array; life: number; maxLife: number } | null = null;
    let nebulaParticles: THREE.Points | null = null;
    let animId = 0;
    let lastMeteorTime = 0;
    let nextMeteorTime = 120 + Math.random() * 180;

    const mouseNDC = new THREE.Vector2(-10, -10);
    let mouseActive = 0;
    const raycaster = new THREE.Raycaster();
    const inverseMat = new THREE.Matrix4();
    const localMouseOrigin = new THREE.Vector3();
    const localMouseDir = new THREE.Vector3();

    const baseTime = performance.now();

    const CLOUD_CONFIGS: CloudConfig[] = [
      {
        name: '核心二十面体', type: 0,
        size: isMobile ? 25 : 30,
        color: [220, 200, 255],
        orbitR: 0, orbitAngle: 0, orbitSpeed: 0,
        rotX: 0.12, rotY: 0.08, rotZ: 0.05, zOff: 0,
        breathSpeed: 0.6, breathAmp: 0.10
      },
      {
        name: '四面体', type: 3,
        size: isMobile ? 40 : 50,
        color: [160, 220, 255],
        orbitR: isMobile ? 120 : 160, orbitAngle: Math.PI * 0.25, orbitSpeed: 0.035,
        rotX: 0.15, rotY: 0.10, rotZ: 0.07, zOff: -30,
        breathSpeed: 0.45, breathAmp: 0.14
      },
      {
        name: '二十面体', type: 0,
        size: isMobile ? 50 : 65,
        color: [200, 160, 255],
        orbitR: isMobile ? 160 : 200, orbitAngle: Math.PI * 0.75, orbitSpeed: -0.028,
        rotX: 0.10, rotY: 0.14, rotZ: 0.06, zOff: 40,
        breathSpeed: 0.55, breathAmp: 0.12
      },
      {
        name: '八面体', type: 1,
        size: isMobile ? 55 : 70,
        color: [180, 160, 255],
        orbitR: isMobile ? 190 : 240, orbitAngle: Math.PI * 1.25, orbitSpeed: 0.022,
        rotX: 0.08, rotY: 0.12, rotZ: 0.09, zOff: -20,
        breathSpeed: 0.38, breathAmp: 0.16
      },
      {
        name: '十二面体', type: 2,
        size: isMobile ? 65 : 80,
        color: [140, 200, 255],
        orbitR: isMobile ? 220 : 280, orbitAngle: Math.PI * 1.75, orbitSpeed: -0.018,
        rotX: 0.06, rotY: 0.09, rotZ: 0.11, zOff: 50,
        breathSpeed: 0.50, breathAmp: 0.13
      },
      {
        name: '外层二十面体', type: 0,
        size: isMobile ? 75 : 95,
        color: [120, 180, 255],
        orbitR: isMobile ? 260 : 330, orbitAngle: Math.PI * 0.5, orbitSpeed: 0.015,
        rotX: 0.07, rotY: 0.11, rotZ: 0.08, zOff: -60,
        breathSpeed: 0.42, breathAmp: 0.15
      }
    ];

    /**
     * 根据类型创建多面体几何体（非索引化）
     */
    function getGeometry(type: number, size: number): THREE.BufferGeometry {
      let geo: THREE.BufferGeometry;
      switch (type) {
        case 0: geo = new THREE.IcosahedronGeometry(size, 1); break;
        case 1: geo = new THREE.OctahedronGeometry(size, 0); break;
        case 2: geo = new THREE.DodecahedronGeometry(size, 0); break;
        case 3: geo = new THREE.TetrahedronGeometry(size, 0); break;
        default: geo = new THREE.IcosahedronGeometry(size, 1); break;
      }
      if (geo.index) {
        geo = geo.toNonIndexed();
      }
      return geo;
    }

    /**
     * 在几何体表面均匀采样粒子位置（重心坐标插值）
     */
    function sampleGeometrySurface(geometry: THREE.BufferGeometry, count: number): number[] {
      const posAttr = geometry.getAttribute('position');
      if (!posAttr) return [];

      const faceCount = Math.floor(posAttr.count / 3);
      if (faceCount === 0) return [];

      const positions: number[] = [];
      for (let i = 0; i < count; i++) {
        const faceIdx = Math.floor(Math.random() * faceCount);
        const baseIdx = faceIdx * 3;

        const ax = posAttr.getX(baseIdx), ay = posAttr.getY(baseIdx), az = posAttr.getZ(baseIdx);
        const bx = posAttr.getX(baseIdx + 1), by = posAttr.getY(baseIdx + 1), bz = posAttr.getZ(baseIdx + 1);
        const cx = posAttr.getX(baseIdx + 2), cy = posAttr.getY(baseIdx + 2), cz = posAttr.getZ(baseIdx + 2);

        const r1 = Math.random(), r2 = Math.random();
        const sqrtR1 = Math.sqrt(r1);
        const u = 1 - sqrtR1, v = sqrtR1 * (1 - r2), w = sqrtR1 * r2;

        positions.push(
          ax * u + bx * v + cx * w,
          ay * u + by * v + cy * w,
          az * u + bz * v + cz * w
        );
      }
      return positions;
    }

    /**
     * 在几何体内部生成随机分布的粒子位置（球坐标+立方根缩放）
     */
    function generateInnerParticles(count: number, radius: number): number[] {
      const positions: number[] = [];
      for (let i = 0; i < count; i++) {
        const r = Math.pow(Math.random(), 1 / 3) * radius * 0.7;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
      }
      return positions;
    }

    /**
     * 创建单个几何体粒子云
     */
    function createParticleCloud(cfg: CloudConfig): void {
      const group = new THREE.Object3D();
      const geometry = getGeometry(cfg.type, cfg.size);

      const surfaceCount = Math.floor(PARTICLES_PER_CLOUD * 0.65);
      const innerCount = PARTICLES_PER_CLOUD - surfaceCount;

      const surfacePos = sampleGeometrySurface(geometry, surfaceCount);
      const innerPos = generateInnerParticles(innerCount, cfg.size);
      geometry.dispose();

      const allPos = surfacePos.concat(innerPos);
      const totalParticles = allPos.length / 3;

      const colors: number[] = [];
      const sizes: number[] = [];
      const alphas: number[] = [];
      const phases: number[] = [];

      const baseR = cfg.color[0] / 255;
      const baseG = cfg.color[1] / 255;
      const baseB = cfg.color[2] / 255;

      for (let i = 0; i < totalParticles; i++) {
        const isSurface = i < surfaceCount;
        const cv = (Math.random() - 0.5) * 0.08;

        if (isSurface) {
          colors.push(
            Math.max(0, Math.min(1, baseR + cv)),
            Math.max(0, Math.min(1, baseG + cv)),
            Math.max(0, Math.min(1, baseB + cv))
          );
          sizes.push(PARTICLE_SIZE * 1.2);
          alphas.push(1.2);
        } else {
          const wb = 0.3;
          colors.push(
            Math.max(0, Math.min(1, baseR + (1 - baseR) * wb + cv * 0.5)),
            Math.max(0, Math.min(1, baseG + (1 - baseG) * wb + cv * 0.5)),
            Math.max(0, Math.min(1, baseB + (1 - baseB) * wb + cv * 0.5))
          );
          sizes.push(PARTICLE_SIZE * 0.8);
          alphas.push(0.85);
        }
        phases.push(Math.random());
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
      geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
      geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
      geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));

      const shaderMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBreath: { value: 0 },
          uBurst: { value: 0 },
          uPixelRatio: { value: pixR },
          uMouseOrigin: { value: new THREE.Vector3() },
          uMouseDir: { value: new THREE.Vector3(0, 0, -1) },
          uMouseActive: { value: 0 }
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const points = new THREE.Points(geo, shaderMat);
      group.add(points);

      group.position.x = Math.cos(cfg.orbitAngle) * cfg.orbitR;
      group.position.y = Math.sin(cfg.orbitAngle) * cfg.orbitR;
      group.position.z = cfg.zOff;

      const cloudData: CloudData = {
        cfg,
        material: shaderMat,
        currentAngle: cfg.orbitAngle,
        burstPhase: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2
      };

      group.userData = cloudData;
      scene.add(group);
      particleClouds.push(group);
      cloudDataList.push(cloudData);
    }

    /**
     * 创建背景环境粒子
     */
    function createEnvParticles(): void {
      const count = ENV_PARTICLE_COUNT;
      const positions: number[] = [];
      const colors: number[] = [];

      const envColors: [number, number, number][] = [
        [200, 180, 255],
        [160, 200, 255],
        [140, 180, 255],
        [180, 160, 255],
        [220, 200, 255]
      ];

      for (let i = 0; i < count; i++) {
        positions.push(
          (Math.random() - 0.5) * 3000,
          (Math.random() - 0.5) * 2000,
          (Math.random() - 0.5) * 1500 - 500
        );
        const c = envColors[Math.floor(Math.random() * envColors.length)];
        const fade = 0.7 + Math.random() * 0.3;
        colors.push(c[0] / 255 * fade, c[1] / 255 * fade, c[2] / 255 * fade);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 2.0,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      envParticles = new THREE.Points(geo, mat);
      scene.add(envParticles);
    }

    /**
     * 创建星云雾效（远处淡蓝紫雾气）
     */
    function createNebula(): void {
      const count = 3000;
      const positions: number[] = [];
      const colors: number[] = [];

      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 800 + Math.random() * 1200;

        positions.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi) - 300
        );

        const colorChoice = Math.random();
        if (colorChoice < 0.4) {
          colors.push(0.5, 0.4, 0.9);
        } else if (colorChoice < 0.7) {
          colors.push(0.4, 0.5, 0.9);
        } else {
          colors.push(0.6, 0.4, 0.8);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 8.0,
        vertexColors: true,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      nebulaParticles = new THREE.Points(geo, mat);
      scene.add(nebulaParticles);
    }

    /**
     * 创建流星
     */
    function createMeteor(): void {
      if (meteorParticles) {
        scene.remove(meteorParticles);
        meteorParticles.geometry.dispose();
        (meteorParticles.material as THREE.PointsMaterial).dispose();
      }

      const count = 150;
      const positions = new Float32Array(count * 3);
      const colors: number[] = [];
      const velocities = new Float32Array(count * 3);

      const startX = (Math.random() - 0.5) * 1500;
      const startY = 600 + Math.random() * 400;
      const startZ = -200 + Math.random() * 200;

      const dirX = -0.3 - Math.random() * 0.4;
      const dirY = -0.6 - Math.random() * 0.3;
      const dirZ = Math.random() * 0.2;

      for (let i = 0; i < count; i++) {
        const t = i / count;
        const spread = t * 80;

        positions[i * 3] = startX + dirX * t * 400 + (Math.random() - 0.5) * spread;
        positions[i * 3 + 1] = startY + dirY * t * 400 + (Math.random() - 0.5) * spread;
        positions[i * 3 + 2] = startZ + dirZ * t * 100 + (Math.random() - 0.5) * spread * 0.5;

        velocities[i * 3] = dirX * (8 + Math.random() * 4);
        velocities[i * 3 + 1] = dirY * (8 + Math.random() * 4);
        velocities[i * 3 + 2] = dirZ * 2;

        const brightness = 1 - t * 0.5;
        colors.push(0.9 * brightness, 0.85 * brightness, 1.0 * brightness);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 3.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      meteorParticles = new THREE.Points(geo, mat);
      meteorData = {
        positions,
        velocities,
        life: 0,
        maxLife: 180
      };
      scene.add(meteorParticles);
    }

    /**
     * 更新流星位置
     */
    function updateMeteor(): void {
      if (!meteorParticles || !meteorData) return;

      meteorData.life++;

      if (meteorData.life >= meteorData.maxLife) {
        scene.remove(meteorParticles);
        meteorParticles.geometry.dispose();
        (meteorParticles.material as THREE.PointsMaterial).dispose();
        meteorParticles = null;
        meteorData = null;
        return;
      }

      const positions = meteorParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const posArray = positions.array as Float32Array;

      for (let i = 0; i < posArray.length / 3; i++) {
        posArray[i * 3] += meteorData.velocities[i * 3];
        posArray[i * 3 + 1] += meteorData.velocities[i * 3 + 1];
        posArray[i * 3 + 2] += meteorData.velocities[i * 3 + 2];
      }

      positions.needsUpdate = true;

      const fadeProgress = meteorData.life / meteorData.maxLife;
      if (fadeProgress > 0.7) {
        (meteorParticles.material as THREE.PointsMaterial).opacity = 0.9 * (1 - (fadeProgress - 0.7) / 0.3);
      }
    }

    /**
     * 更新鼠标交互 uniform（将世界空间射线转换到局部空间）
     */
    function updateMouseUniforms(i: number): void {
      const cloud = particleClouds[i];
      const d = cloudDataList[i];

      if (mouseActive > 0) {
        cloud.updateMatrixWorld(true);
        raycaster.setFromCamera(mouseNDC, camera);
        const ray = raycaster.ray;

        inverseMat.copy(cloud.matrixWorld).invert();
        localMouseOrigin.copy(ray.origin).applyMatrix4(inverseMat);
        localMouseDir.copy(ray.direction).transformDirection(inverseMat).normalize();

        d.material.uniforms.uMouseOrigin.value.copy(localMouseOrigin);
        d.material.uniforms.uMouseDir.value.copy(localMouseDir);
        d.material.uniforms.uMouseActive.value = 1.0;
      } else {
        d.material.uniforms.uMouseActive.value = 0.0;
      }
    }

    /**
     * 初始化场景
     */
    function init(): void {
      camera = new THREE.PerspectiveCamera(50, W / H, 1, 5000);
      camera.position.z = isMobile ? 600 : 500;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x030208);
      scene.fog = new THREE.FogExp2(0x030208, 0.0003);

      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setPixelRatio(pixR);
      renderer.setSize(W, H);
      if (container) {
        container.appendChild(renderer.domElement);
      }

      for (const cfg of CLOUD_CONFIGS) {
        createParticleCloud(cfg);
      }
      createEnvParticles();
      createNebula();

      render();
    }

    /**
     * 渲染循环
     */
    function render(): void {
      animId = requestAnimationFrame(render);

      const now = performance.now();
      const t = (now - baseTime) / 1000;

      for (let i = 0; i < particleClouds.length; i++) {
        const cloud = particleClouds[i];
        const d = cloudDataList[i];
        const cfg = d.cfg;

        d.currentAngle += cfg.orbitSpeed * 0.01;
        const targetX = Math.cos(d.currentAngle) * cfg.orbitR;
        const targetY = Math.sin(d.currentAngle) * cfg.orbitR;
        cloud.position.x += (targetX - cloud.position.x) * 0.03;
        cloud.position.y += (targetY - cloud.position.y) * 0.03;

        cloud.rotation.x = t * cfg.rotX + d.phase;
        cloud.rotation.y = t * cfg.rotY + d.phase * 0.7;
        cloud.rotation.z = t * cfg.rotZ + d.phase * 0.4;

        const breathVal = Math.sin(t * cfg.breathSpeed + d.burstPhase) * cfg.breathAmp;
        const burstCycle = (t * 0.3 + d.burstPhase * 1.5) % (Math.PI * 2);
        const burstVal = Math.max(0, Math.sin(burstCycle)) * 0.25;

        d.material.uniforms.uTime.value = t;
        d.material.uniforms.uBreath.value = breathVal;
        d.material.uniforms.uBurst.value = burstVal;

        updateMouseUniforms(i);
      }

      if (envParticles) {
        envParticles.rotation.y = t * 0.008;
        envParticles.rotation.x = t * 0.003;
      }

      if (nebulaParticles) {
        nebulaParticles.rotation.y = t * 0.002;
      }

      lastMeteorTime++;
      if (lastMeteorTime >= nextMeteorTime && !meteorParticles) {
        createMeteor();
        lastMeteorTime = 0;
        nextMeteorTime = 120 + Math.random() * 180;
      }
      updateMeteor();

      renderer.render(scene, camera);
    }

    /**
     * 鼠标移动事件处理
     */
    function handleMouseMove(e: MouseEvent): void {
      mouseNDC.x = (e.clientX / W) * 2 - 1;
      mouseNDC.y = -(e.clientY / H) * 2 + 1;
      mouseActive = 1;
    }

    function handleMouseLeave(): void {
      mouseNDC.set(-10, -10);
      mouseActive = 0;
    }

    function handleTouchMove(e: TouchEvent): void {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouseNDC.x = (touch.clientX / W) * 2 - 1;
        mouseNDC.y = -(touch.clientY / H) * 2 + 1;
        mouseActive = 1;
      }
    }

    function handleTouchEnd(): void {
      mouseNDC.set(-10, -10);
      mouseActive = 0;
    }

    function handleResize(): void {
      W = window.innerWidth;
      H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    }

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('resize', handleResize);

    init();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);

      for (const cloud of particleClouds) {
        const points = cloud.children[0] as THREE.Points;
        if (points) {
          points.geometry.dispose();
          (points.material as THREE.ShaderMaterial).dispose();
        }
      }
      if (envParticles) {
        envParticles.geometry.dispose();
        (envParticles.material as THREE.PointsMaterial).dispose();
      }
      if (nebulaParticles) {
        nebulaParticles.geometry.dispose();
        (nebulaParticles.material as THREE.PointsMaterial).dispose();
      }
      if (meteorParticles) {
        meteorParticles.geometry.dispose();
        (meteorParticles.material as THREE.PointsMaterial).dispose();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'auto'
      }}
    />
  );
};

export default DreamyUniverseBackground;
