import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('canvas-container');
const status = document.getElementById('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const camera = new THREE.PerspectiveCamera(
  50,
  container.clientWidth / container.clientHeight,
  0.01,
  100
);
camera.position.set(0, 1.5, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, 0);
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 2);
dir.position.set(2, 2, 2);
scene.add(dir);

const loader = new GLTFLoader();
loader.load(
  'face_base.glb',
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(0, 0, size * 1.2));
    camera.near = size / 100;
    camera.far = size * 100;
    camera.updateProjectionMatrix();
    controls.update();

    if (status) status.textContent = 'Model loaded.';
    humanizeFace(model);
    inspectAndBuildMaterialUI(model);
  },
  (xhr) => {
    if (status && xhr.total) {
      status.textContent = `Loading model… ${Math.round((xhr.loaded / xhr.total) * 100)}%`;
    }
  },
  (error) => {
    console.error(error);
    if (status) status.textContent = 'Failed to load face_base.glb (see console).';
  }
);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// Humanize parts of the face_base.glb model. Mesh names are known (see the
// inspector log); materials shared across meshes are cloned per-mesh so each
// body part can be tinted independently. Lips are painted into the Head_Geo
// skin texture and can't be recolored separately at runtime.
const HUMAN_TINTS = {
  Head_Geo:      { color: 0xf2c9a5, roughness: 0.65, metalness: 0.0 }, // skin
  Eyebrow_Geo:   { color: 0x3a2418, roughness: 0.9 },                   // dark brown
  EyelashUp_Geo: { color: 0x140a06, roughness: 0.9 },                   // near-black
  EyeInLf_Geo:   { color: 0x6a8aa8 },                                   // iris tint (multiply)
  EyeInRt_Geo:   { color: 0x6a8aa8 },
  TeethUp_Geo:   { color: 0xf0ebe0, roughness: 0.4 },
  TeethDn_Geo:   { color: 0xf0ebe0, roughness: 0.4 },
  GumUp_Geo:     { color: 0xc97676, roughness: 0.6 },
  GumDn_Geo:     { color: 0xc97676, roughness: 0.6 },
  Tongue_Geo:    { color: 0xa84a4a, roughness: 0.55 },
};

function humanizeFace(model) {
  model.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const tint = HUMAN_TINTS[obj.name];
    if (!tint) return;

    obj.material = obj.material.clone();
    if (obj.material.color) obj.material.color.set(tint.color);
    if (tint.roughness !== undefined && 'roughness' in obj.material) {
      obj.material.roughness = tint.roughness;
    }
    if (tint.metalness !== undefined && 'metalness' in obj.material) {
      obj.material.metalness = tint.metalness;
    }
    obj.material.needsUpdate = true;
  });
}

function inspectAndBuildMaterialUI(model) {
  const seen = new Map();
  const meshLog = [];

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat, i) => {
      if (!mat) return;
      meshLog.push({ mesh: obj.name || '(unnamed mesh)', material: mat.name || '(unnamed material)', slot: i });
      const key = mat.uuid;
      if (!seen.has(key)) seen.set(key, mat);
    });
  });

  console.group('GLB inspector');
  console.table(meshLog);
  console.log('Unique materials:', [...seen.values()].map((m) => m.name || '(unnamed)'));
  console.groupEnd();

  const host = document.getElementById('materialList');
  if (!host) return;
  host.innerHTML = '';

  [...seen.values()].forEach((mat, idx) => {
    const row = document.createElement('label');
    row.className = 'mat-row';

    const name = document.createElement('span');
    name.textContent = mat.name || `material_${idx}`;

    const picker = document.createElement('input');
    picker.type = 'color';
    const baseColor = mat.color ?? new THREE.Color(0xffffff);
    picker.value = '#' + baseColor.getHexString();
    picker.addEventListener('input', () => {
      if (mat.color) mat.color.set(picker.value);
      mat.needsUpdate = true;
    });

    row.appendChild(name);
    row.appendChild(picker);
    host.appendChild(row);
  });
}

// Stub control hooks so the inline onclick/oninput handlers don't throw.
window.setViseme = (v) => console.log('viseme:', v);
window.setEmotion = (name, value) => {
  const label = document.getElementById('emotionLabel');
  if (label) label.textContent = `Current Emotion: ${name} (${(+value).toFixed(2)})`;
};
window.setGaze = (x, y) => console.log('gaze:', x, y);
