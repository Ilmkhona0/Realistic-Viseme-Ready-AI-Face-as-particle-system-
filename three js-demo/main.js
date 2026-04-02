// ====== Basic Three.js Setup ======
let scene, camera, renderer;
let particleSystem;
let clock = new THREE.Clock();

// Mouth / eyes regions
let mouthParticles = [];
let leftEyeParticles = [];
let rightEyeParticles = [];
let allParticles = [];

// State
let currentViseme = null; // e.g. 'AI', 'EH', 'FV', 'MM'
let emotionWeights = {
  neutral: 1,
  joy: 0,
  anger: 0,
  surprise: 0,
  sadness: 0
};

let gazeTarget = { x: 0, y: 0 }; // -1..1
let blinkRate = 2.0; // seconds between blinks
let saccadeSpeed = 0.3; // 0..1
let lastBlinkTime = 0;
let blinkProgress = 0; // 0..1
let saccadeOffset = { x: 0, y: 0 };

// Viseme timeline demo
let visemeEvents = [];
let visemePlaybackStart = null;
let visemePlaying = false;

init();
animate();

// ====== Init Scene ======
function init() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', onWindowResize);

  createParticleFace();
  createDemoVisemeEvents();
  renderVisemeTimeline();
}

// ====== Resize ======
function onWindowResize() {
  const container = document.getElementById('canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ====== Particle Face Construction ======
function createParticleFace() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  const color = new THREE.Color();

  // Simple head ellipse
  const headRadiusX = 1.2;
  const headRadiusY = 1.6;
  const headCount = 800;

  for (let i = 0; i < headCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * 0.7;
    const x = Math.cos(angle) * headRadiusX * r;
    const y = Math.sin(angle) * headRadiusY * r;
    const z = (Math.random() - 0.5) * 0.1;

    positions.push(x, y, z);

    // Base color (you can match provided palette here)
    color.setHSL(0.6 + Math.random() * 0.1, 0.7, 0.5 + Math.random() * 0.2);
    colors.push(color.r, color.g, color.b);

    const particle = { index: i, base: new THREE.Vector3(x, y, z), region: 'face' };
    allParticles.push(particle);
  }

  // Mouth region (simple arc)
  const mouthCount = 120;
  for (let i = 0; i < mouthCount; i++) {
    const t = i / (mouthCount - 1);
    const x = -0.5 + t * 1.0;
    const y = -0.4 + (Math.random() - 0.5) * 0.05;
    const z = (Math.random() - 0.5) * 0.05;

    positions.push(x, y, z);
    color.setHSL(0.05 + Math.random() * 0.02, 0.8, 0.6);
    colors.push(color.r, color.g, color.b);

    const idx = positions.length / 3 - 1;
    const particle = { index: idx, base: new THREE.Vector3(x, y, z), region: 'mouth' };
    allParticles.push(particle);
    mouthParticles.push(particle);
  }

  // Eyes (left/right clusters)
  const eyeCount = 80;
  for (let side of ['left', 'right']) {
    const centerX = side === 'left' ? -0.4 : 0.4;
    const centerY = 0.3;
    for (let i = 0; i < eyeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.05 + Math.random() * 0.08;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      const z = (Math.random() - 0.5) * 0.05;

      positions.push(x, y, z);
      color.setHSL(0.55 + Math.random() * 0.05, 0.2, 0.9);
      colors.push(color.r, color.g, color.b);

      const idx = positions.length / 3 - 1;
      const particle = { index: idx, base: new THREE.Vector3(x, y, z), region: side === 'left' ? 'eyeL' : 'eyeR' };
      allParticles.push(particle);
      if (side === 'left') leftEyeParticles.push(particle);
      else rightEyeParticles.push(particle);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.95
  });

  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
}

// ====== Animation Loop ======
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  updateBlink(dt, t);
  updateSaccades(dt);
  updateVisemePlayback();
  applyDeformations(dt);

  renderer.render(scene, camera);
}

// ====== Blink & Eye Micro-movements ======
function updateBlink(dt, t) {
  if (t - lastBlinkTime > blinkRate + Math.random() * 0.5) {
    lastBlinkTime = t;
    blinkProgress = 1.0;
  }
  if (blinkProgress > 0) {
    blinkProgress -= dt * 4.0; // blink speed
    if (blinkProgress < 0) blinkProgress = 0;
  }
}

function updateSaccades(dt) {
  // Simple noise-like movement
  saccadeOffset.x += (Math.random() - 0.5) * dt * saccadeSpeed;
  saccadeOffset.y += (Math.random() - 0.5) * dt * saccadeSpeed;
  saccadeOffset.x = THREE.MathUtils.clamp(saccadeOffset.x, -0.2, 0.2);
  saccadeOffset.y = THREE.MathUtils.clamp(saccadeOffset.y, -0.2, 0.2);
}

// ====== Apply Viseme + Emotion + Eye Deformations ======
function applyDeformations(dt) {
  const positions = particleSystem.geometry.attributes.position.array;

  // Normalize emotion weights (soft)
  const sum = Object.values(emotionWeights).reduce((a, b) => a + parseFloat(b), 0) || 1;
  const norm = {};
  for (let k in emotionWeights) norm[k] = emotionWeights[k] / sum;

  for (let p of allParticles) {
    const i3 = p.index * 3;
    let x = p.base.x;
    let y = p.base.y;
    let z = p.base.z;

    // Mouth: viseme deformation (priority over emotion)
    if (p.region === 'mouth') {
      const v = currentViseme;
      if (v === 'AI') {
        y -= 0.05;
      } else if (v === 'EH') {
        y -= 0.02;
        x *= 1.1;
      } else if (v === 'FV') {
        y += 0.02;
        x *= 0.8;
      } else if (v === 'MM') {
        y += 0.04;
      }
    }

    // Emotion: cheeks, brows, general shape
    const joy = norm.joy || 0;
    const anger = norm.anger || 0;
    const surprise = norm.surprise || 0;
    const sadness = norm.sadness || 0;

    if (p.region === 'face') {
      // Joy: lift cheeks
      y += joy * 0.05 * (p.base.y < 0 ? 1 : 0);
      // Sadness: pull down
      y -= sadness * 0.03;
      // Anger: slight inward
      x *= 1 - anger * 0.05;
      // Surprise: slight outward
      x *= 1 + surprise * 0.05;
    }

    // Eyes: gaze + blink
    if (p.region === 'eyeL' || p.region === 'eyeR') {
      const gx = gazeTarget.x * 0.05 + saccadeOffset.x;
      const gy = gazeTarget.y * 0.05 + saccadeOffset.y;
      x += gx;
      y += gy;

      // Blink: compress vertically
      const blinkFactor = 1 - blinkProgress;
      y = p.base.y + (y - p.base.y) * blinkFactor;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }

  particleSystem.geometry.attributes.position.needsUpdate = true;

  updateEmotionLabel(norm);
}

// ====== Emotion Label ======
function updateEmotionLabel(norm) {
  let maxKey = 'neutral';
  let maxVal = norm.neutral || 0;
  for (let k of ['joy', 'anger', 'surprise', 'sadness']) {
    if (norm[k] > maxVal) {
      maxVal = norm[k];
      maxKey = k;
    }
  }
  document.getElementById('currentEmotionLabel').textContent =
    'Current Emotion: ' + maxKey.charAt(0).toUpperCase() + maxKey.slice(1);
}

// ====== Public-like API ======
window.setViseme = function (id) {
  currentViseme = id; // null = neutral mouth
};

window.setEmotionWeight = function (name, value) {
  emotionWeights[name] = parseFloat(value);
};

window.setGaze = function (x, y) {
  if (x !== null) gazeTarget.x = parseFloat(x);
  if (y !== null) gazeTarget.y = parseFloat(y);
};

window.setBlinkRate = function (val) {
  blinkRate = parseFloat(val);
};

window.setSaccadeSpeed = function (val) {
  saccadeSpeed = parseFloat(val);
};

// ====== Viseme Timeline Demo ======
function createDemoVisemeEvents() {
  // Example: events over 2 seconds
  visemeEvents = [
    { id: 'AI', start: 0.0, end: 0.4 },
    { id: 'EH', start: 0.4, end: 0.8 },
    { id: 'FV', start: 0.8, end: 1.2 },
    { id: 'MM', start: 1.2, end: 1.6 }
  ];
}

window.demoPlayVisemeSequence = function () {
  visemePlaybackStart = performance.now() / 1000;
  visemePlaying = true;
};

function updateVisemePlayback() {
  if (!visemePlaying) return;
  const now = performance.now() / 1000;
  const t = now - visemePlaybackStart;

  let active = null;
  for (let ev of visemeEvents) {
    if (t >= ev.start && t < ev.end) {
      active = ev.id;
      break;
    }
  }

  if (!active && t > visemeEvents[visemeEvents.length - 1].end) {
    // End of sequence → fallback neutral
    currentViseme = null;
    visemePlaying = false;
  } else {
    currentViseme = active; // can be null → neutral
  }
}

// ====== Viseme Timeline UI (simple) ======
function renderVisemeTimeline() {
  const container = document.getElementById('visemeTimeline');
  container.innerHTML = '';
  const total = visemeEvents[visemeEvents.length - 1].end;

  visemeEvents.forEach(ev => {
    const div = document.createElement('div');
    div.textContent = ev.id;
    div.style.display = 'inline-block';
    div.style.margin = '2px';
    div.style.padding = '2px 4px';
    div.style.fontSize = '10px';
    div.style.background = '#283044';
    div.style.color = '#eee';
    div.style.width = (ev.end - ev.start) / total * 200 + 'px';
    div.style.textAlign = 'center';
    container.appendChild(div);
  });
}
