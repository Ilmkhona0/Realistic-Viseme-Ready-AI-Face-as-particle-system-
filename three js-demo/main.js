let scene, camera, renderer;
let particleSystem;
let clock = new THREE.Clock();

let particlesMeta = []; // {index, base: Vector3, region: 'face'|'mouth'|'eyeL'|'eyeR'}
let currentViseme = null;
let emotionWeights = {
  neutral: 1,
  joy: 0,
  anger: 0,
  surprise: 0,
  sadness: 0
};
let gazeTarget = { x: 0, y: 0 };
let blinkProgress = 0;
let lastBlinkTime = 0;
let blinkInterval = 2.0;

init();

function init() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.z = 3;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', onResize);

  loadFaceTextureAndCreateParticles('face.jpeg'); // your human face image
}

function onResize() {
  const container = document.getElementById('canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function loadFaceTextureAndCreateParticles(url) {
  const loader = new THREE.TextureLoader();
  loader.load(url, texture => {
    const img = texture.image;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = 200;
    const h = 200;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h).data;

    const positions = [];
    const colors = [];
    const color = new THREE.Color();

    particlesMeta = [];

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 50) continue; // skip transparent

        const brightness = (r + g + b) / 3;
        if (brightness < 20) continue; // skip very dark

        const nx = (x / w) * 2 - 1;   // -1..1
        const ny = (y / h) * 2 - 1;   // -1..1
        const px = nx * 1.0;
        const py = -ny * 1.4;         // flip Y, stretch a bit
        const pz = 0;

        positions.push(px, py, pz);

        color.setRGB(r / 255, g / 255, b / 255);
        colors.push(color.r, color.g, color.b);

        const idx = positions.length / 3 - 1;
        const meta = {
          index: idx,
          base: new THREE.Vector3(px, py, pz),
          region: classifyRegion(nx, ny) // mouth / eyes / face
        };
        particlesMeta.push(meta);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    animate();
  });
}

// Rough region classification based on normalized coords
function classifyRegion(nx, ny) {
  // mouth: lower center
  if (ny > 0.1 && ny < 0.5 && Math.abs(nx) < 0.35) return 'mouth';
  // eyes: upper center
  if (ny < -0.1 && ny > -0.6 && nx < -0.15 && nx > -0.6) return 'eyeL';
  if (ny < -0.1 && ny > -0.6 && nx > 0.15 && nx < 0.6) return 'eyeR';
  return 'face';
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  updateBlink(dt, t);
  applyDeformations();

  renderer.render(scene, camera);
}

// Blink logic
function updateBlink(dt, t) {
  if (t - lastBlinkTime > blinkInterval + Math.random() * 0.5) {
    lastBlinkTime = t;
    blinkProgress = 1.0;
  }
  if (blinkProgress > 0) {
    blinkProgress -= dt * 4.0;
    if (blinkProgress < 0) blinkProgress = 0;
  }
}

function applyDeformations() {
  if (!particleSystem) return;
  const positions = particleSystem.geometry.attributes.position.array;

  const sum = Object.values(emotionWeights).reduce((a, b) => a + parseFloat(b), 0) || 1;
  const norm = {};
  for (let k in emotionWeights) norm[k] = emotionWeights[k] / sum;

  const joy = norm.joy || 0;
  const anger = norm.anger || 0;
  const surprise = norm.surprise || 0;
  const sadness = norm.sadness || 0;

  for (let p of particlesMeta) {
    const i3 = p.index * 3;
    let x = p.base.x;
    let y = p.base.y;
    let z = p.base.z;

    // Viseme deformation (mouth only)
    if (p.region === 'mouth') {
      if (currentViseme === 'AI') {
        y -= 0.05;
      } else if (currentViseme === 'EH') {
        y -= 0.02;
        x *= 1.05;
      } else if (currentViseme === 'FV') {
        y += 0.02;
        x *= 0.9;
      } else if (currentViseme === 'MM') {
        y += 0.04;
      }
    }

    // Emotion deformation (face)
    if (p.region === 'face') {
      // Joy: lift cheeks
      if (p.base.y > 0.1) {
        y -= joy * 0.02;
      } else {
        y += joy * 0.03;
      }
      // Sadness: pull down
      y += sadness * 0.02;
      // Anger: slight inward
      x *= 1 - anger * 0.03;
      // Surprise: slight outward
      x *= 1 + surprise * 0.03;
    }

    // Eyes: gaze + blink
    if (p.region === 'eyeL' || p.region === 'eyeR') {
      x += gazeTarget.x * 0.03;
      y += gazeTarget.y * 0.03;

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

// UI API
window.setViseme = function (id) {
  currentViseme = id;
};

window.setEmotion = function (name, value) {
  emotionWeights[name] = parseFloat(value);
};

window.setGaze = function (x, y) {
  if (x !== null) gazeTarget.x = parseFloat(x);
  if (y !== null) gazeTarget.y = parseFloat(y);
};

function updateEmotionLabel(norm) {
  let maxKey = 'neutral';
  let maxVal = norm.neutral || 0;
  for (let k of ['joy', 'anger', 'surprise', 'sadness']) {
    if (norm[k] > maxVal) {
      maxVal = norm[k];
      maxKey = k;
    }
  }
  document.getElementById('emotionLabel').textContent =
    'Current Emotion: ' + maxKey.charAt(0).toUpperCase() + maxKey.slice(1);
}
