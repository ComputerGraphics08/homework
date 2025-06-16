import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { applyMeshStandardMaterial } from "./util.js";

let scene, camera, renderer;
let walls = [];
let floor;
let mouseX = 0,
  mouseY = 0;
let isPointerLocked = false;
let painterMesh; // 총 대신 페인터 모델
let aim;
let fbxLoader;

// 발사된 페인트 오브젝트들을 관리하는 배열
let paintProjectiles = [];

// 플레이어 설정
const player = {
  position: new THREE.Vector3(0, 1.6, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  speed: 5,
  jumpPower: 10,
  onGround: false,
};

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  shift: false,
};

const raycaster = new THREE.Raycaster();
const paintMaterial = new THREE.MeshStandardMaterial({
  color: 0xff3c3c,
  transparent: true,
  opacity: 0.7,
  roughness: 1.0,
  metalness: 0.0,
});

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.copy(player.position);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(-1, 1, 1);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  fbxLoader = new FBXLoader();

  createMap();
  setupEventListeners();
  loadPainter();
  createAim();
  animate();
}

function createMap() {
  const floorGeometry = new THREE.PlaneGeometry(100, 100);
  const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallPositions = [
    { pos: [0, 2, -50], rot: [0, 0, 0], size: [100, 4, 0.2] },
    { pos: [0, 2, 50], rot: [0, Math.PI, 0], size: [100, 4, 0.2] },
    { pos: [-50, 2, 0], rot: [0, Math.PI / 2, 0], size: [100, 4, 0.2] },
    { pos: [50, 2, 0], rot: [0, -Math.PI / 2, 0], size: [100, 4, 0.2] },
  ];

  wallPositions.forEach((wallData) => {
    const wallGeometry = new THREE.BoxGeometry(...wallData.size);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(...wallData.pos);
    wall.rotation.set(...wallData.rot);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    walls.push(wall);
  });

  for (let i = 0; i < 75; i++) {
    const boxGeometry = new THREE.BoxGeometry(
      Math.random() * 2 + 0.5,
      Math.random() * 2 + 0.5,
      Math.random() * 2 + 0.5
    );
    const boxMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.5, 0.7),
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(
      (Math.random() - 0.5) * 75,
      boxGeometry.parameters.height / 2,
      (Math.random() - 0.5) * 75
    );
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    walls.push(box);
  }

  const platformHeight = 4;
  const platformWidth = 5;
  const outerDistance = 47;

  const platformConfigs = [
    {
      pos: [0, platformHeight, -outerDistance],
      size: [90, 0.5, platformWidth],
    },
    { pos: [0, platformHeight, outerDistance], size: [90, 0.5, platformWidth] },
    {
      pos: [-outerDistance, platformHeight, 0],
      size: [platformWidth, 0.5, 90],
    },
    { pos: [outerDistance, platformHeight, 0], size: [platformWidth, 0.5, 90] },
  ];

  platformConfigs.forEach((config) => {
    const platGeo = new THREE.BoxGeometry(...config.size);
    const platMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const plat = new THREE.Mesh(platGeo, platMat);
    plat.position.set(...config.pos);
    plat.castShadow = true;
    plat.receiveShadow = true;
    scene.add(plat);
    walls.push(plat);
  });

  const rampConfigs = [
    {
      pos: [-outerDistance + 10, platformHeight / 2, -outerDistance + 10],
      rot: [-Math.atan(platformHeight / 10), 0, 0], // x축 경사
      size: [10, 0.5, 2],
    },
    {
      pos: [outerDistance - 10, platformHeight / 2, outerDistance - 10],
      rot: [Math.atan(platformHeight / 10), 0, 0], // 반대 방향
      size: [10, 0.5, 2],
    },
  ];

  rampConfigs.forEach((rampData) => {
    const rampGeo = new THREE.BoxGeometry(...rampData.size);
    const rampMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(...rampData.pos);
    ramp.rotation.set(...rampData.rot);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    scene.add(ramp);
    walls.push(ramp);
  });
}

function loadPainter() {
  fbxLoader.load("Painter.fbx", (object) => {
    painterMesh = object;

    painterMesh.scale.set(0.001, 0.001, 0.001);
    painterMesh.position.set(0.5, -0.4, -1.2);
    painterMesh.rotation.set(0, Math.PI, 0);

    painterMesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    camera.add(painterMesh);
    scene.add(camera);
  });
}

// 조준점
function createAim() {
  const aimGeom = new THREE.SphereGeometry(0.05, 8, 8);
  const aimMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  aim = new THREE.Mesh(aimGeom, aimMaterial);
  aim.visible = false;
  scene.add(aim);
}

function shoot() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  fbxLoader.load("Paint.fbx", (paintObject) => {
    paintObject.scale.setScalar(0.001);
    paintObject.position.copy(camera.position);

    paintObject.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const paintData = {
      object: paintObject,
      velocity: dir.clone().multiplyScalar(15), // 발사 속도
      life: 5.0,
      gravity: -9.8,
    };

    paintProjectiles.push(paintData);
    scene.add(paintObject);
  });
}

function updatePaintProjectiles(deltaTime) {
  for (let i = paintProjectiles.length - 1; i >= 0; i--) {
    const paint = paintProjectiles[i];

    paint.velocity.y += paint.gravity * deltaTime;

    paint.object.position.add(paint.velocity.clone().multiplyScalar(deltaTime));

    const paintRaycaster = new THREE.Raycaster(
      paint.object.position,
      paint.velocity.clone().normalize()
    );
    const intersects = paintRaycaster.intersectObjects(walls);

    if (intersects.length > 0 && intersects[0].distance < 0.2) {
      createPaintSplash(intersects[0]);

      scene.remove(paint.object);
      paintProjectiles.splice(i, 1);
      continue;
    }

    paint.life -= deltaTime;

    if (paint.life <= 0 || paint.object.position.y < -10) {
      scene.remove(paint.object);
      paintProjectiles.splice(i, 1);
    }
  }
}

function createPaintSplash(hit) {
  const paintGeom = new THREE.CircleGeometry(0.15, 24);
  const splash = new THREE.Mesh(paintGeom, paintMaterial);

  splash.position.copy(hit.point);
  splash.position.add(hit.face.normal.clone().multiplyScalar(0.01));

  const normal = hit.face.normal.clone().normalize();
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  splash.quaternion.copy(quaternion);

  scene.add(splash);
}

function setupEventListeners() {
  document.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "KeyW":
        keys.w = true;
        break;
      case "KeyA":
        keys.a = true;
        break;
      case "KeyS":
        keys.s = true;
        break;
      case "KeyD":
        keys.d = true;
        break;
      case "Space":
        keys.space = true;
        e.preventDefault();
        break;
      case "ShiftLeft":
        keys.shift = true;
        break;
      case "Escape":
        exitPointerLock();
        break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "KeyW":
        keys.w = false;
        break;
      case "KeyA":
        keys.a = false;
        break;
      case "KeyS":
        keys.s = false;
        break;
      case "KeyD":
        keys.d = false;
        break;
      case "Space":
        keys.space = false;
        break;
      case "ShiftLeft":
        keys.shift = false;
        break;
    }
  });

  document.addEventListener("click", (e) => {
    if (!isPointerLocked) {
      requestPointerLock();
    } else {
      shoot();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (isPointerLocked) {
      mouseX += e.movementX * 0.002;
      mouseY += e.movementY * 0.002;
      mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseY));
    }
  });

  document.addEventListener("pointerlockchange", () => {
    isPointerLocked = document.pointerLockElement === document.body;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function requestPointerLock() {
  document.body.requestPointerLock();
}

function exitPointerLock() {
  document.exitPointerLock();
}

function updatePlayer(deltaTime) {
  camera.rotation.order = "YXZ";
  camera.rotation.y = -mouseX;
  camera.rotation.x = -mouseY;

  const moveDirection = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

  if (keys.w) moveDirection.add(forward);
  if (keys.s) moveDirection.sub(forward);
  if (keys.d) moveDirection.add(right);
  if (keys.a) moveDirection.sub(right);

  moveDirection.normalize();

  const speed = keys.shift ? player.speed * 2 : player.speed;
  player.velocity.x = moveDirection.x * speed;
  player.velocity.z = moveDirection.z * speed;

  if (keys.space && player.onGround) {
    player.velocity.y = player.jumpPower;
    player.onGround = false;
  }

  player.velocity.y -= 25 * deltaTime;

  player.position.add(player.velocity.clone().multiplyScalar(deltaTime));

  if (player.position.y <= 1.6) {
    player.position.y = 1.6;
    player.velocity.y = 0;
    player.onGround = true;
  }

  player.position.x = Math.max(-49, Math.min(9, player.position.x));
  player.position.z = Math.max(-49, Math.min(9, player.position.z));

  camera.position.copy(player.position);
}

function updateAim() {
  const dir2 = new THREE.Vector3();
  camera.getWorldDirection(dir2);
  raycaster.set(camera.position, dir2);

  const inters = raycaster.intersectObjects(walls);

  if (inters.length > 0) {
    const hit = inters[0];
    aim.position.copy(hit.point);
    aim.visible = true;
  } else {
    aim.visible = false;
  }
}

let lastTime = 0;
function animate(currentTime = 0) {
  requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  updatePlayer(deltaTime);
  updateAim();
  updatePaintProjectiles(deltaTime);

  renderer.render(scene, camera);
}

init();
