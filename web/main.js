import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.159.0/examples/jsm/controls/PointerLockControls.js';

const overlay = document.getElementById('overlay');
const overlayHint = overlay.querySelector('.overlay__hint');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);
scene.fog = new THREE.FogExp2(0x05070f, 0.00075);

renderer.setClearColor(scene.background);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 6, 12);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const ambientLight = new THREE.HemisphereLight(0x82a6d9, 0x06070f, 0.55);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0x9bdcff, 0.35);
rimLight.position.set(120, 240, 60);
scene.add(rimLight);

const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 20, 20);
const groundMaterial = new THREE.MeshBasicMaterial({
  color: 0x0b141f,
  wireframe: true,
  transparent: true,
  opacity: 0.35,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const gridHelper = new THREE.GridHelper(2000, 200, 0x1b9fff, 0x0d3c7a);
gridHelper.material.opacity = 0.28;
gridHelper.material.transparent = true;
scene.add(gridHelper);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let canJump = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let running = false;

async function loadBuildings() {
  try {
    const sources = [
      './data/buildings.json',
      './public/data/buildings.json',
      '../public/data/buildings.json',
      '/data/buildings.json',
      '/public/data/buildings.json',
    ];
    let data;
    let lastError;

    for (const source of sources) {
      try {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        data = await response.json();
        break;
      } catch (error) {
        lastError = error;
        console.warn(`建物データの取得に失敗: ${source}`, error);
      }
    }

    if (!data) {
      throw lastError ?? new Error('建物データの取得に失敗しました');
    }
    overlayHint.textContent = 'ワイヤーフレームシティ準備完了! クリックで歩き始める';

    const positions = new Float32Array(data.triangles.length * 9);
    for (let i = 0; i < data.triangles.length; i += 1) {
      positions.set(data.triangles[i], i * 9);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingBox();

    const edgesGeometry = new THREE.EdgesGeometry(geometry, 1);
    const wireMaterial = new THREE.LineBasicMaterial({
      color: 0x5ad2ff,
      transparent: true,
      opacity: 0.7,
    });

    const wireframe = new THREE.LineSegments(edgesGeometry, wireMaterial);
    wireframe.frustumCulled = false;
    worldGroup.add(wireframe);

    if (data.bounds) {
      const { min, max } = data.bounds;
      const centerX = (min[0] + max[0]) / 2;
      const centerZ = (min[2] + max[2]) / 2;
      controls.getObject().position.set(centerX, 6, centerZ + (max[0] - min[0]) * 0.4);
    }
  } catch (error) {
    overlayHint.textContent = `建物データ読み込みに失敗しました: ${error.message}`;
    console.error(error);
  }
}

loadBuildings();

const onKeyDown = (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (canJump) {
        velocity.y += 350;
        canJump = false;
      }
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      running = true;
      break;
    default:
      break;
  }
};

const onKeyUp = (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      running = false;
      break;
    default:
      break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

overlay.addEventListener('click', () => {
  controls.lock();
});

controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
});

controls.addEventListener('unlock', () => {
  overlay.classList.remove('hidden');
});

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const damping = Math.pow(0.9, delta * 60);
  velocity.x *= damping;
  velocity.z *= damping;
  velocity.y -= 9.8 * 80 * delta; // gravity

  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();

  const speed = running ? 600 : 360;

  if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  controls.getObject().position.y += velocity.y * delta;

  if (controls.getObject().position.y < 2) {
    velocity.y = 0;
    controls.getObject().position.y = 2;
    canJump = true;
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.info('GionCraft ready #KGNINJA');
