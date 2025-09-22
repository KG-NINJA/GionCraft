import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.159.0/examples/jsm/controls/PointerLockControls.js';

const overlay = document.getElementById('overlay');
const overlayHint = overlay.querySelector('.overlay__hint');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131b);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 6, 12);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const ambientLight = new THREE.HemisphereLight(0xc9dff5, 0x1d1f2a, 0.65);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xf0f2ff, 0.75);
sunLight.position.set(60, 120, 20);
sunLight.castShadow = true;
scene.add(sunLight);

const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 10, 10);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x2a312b,
  metalness: 0.1,
  roughness: 0.8,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(2000, 200, 0x2d8f3e, 0x1a4523);
scene.add(gridHelper);

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
    const response = await fetch('./data/buildings.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    overlayHint.textContent = '建物データ読み込み完了! クリックで開始';

    const positions = new Float32Array(data.triangles.length * 9);
    for (let i = 0; i < data.triangles.length; i += 1) {
      positions.set(data.triangles[i], i * 9);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xb9b3a6,
      metalness: 0.05,
      roughness: 0.85,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

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
