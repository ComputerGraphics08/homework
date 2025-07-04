import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat";

let scene, camera, renderer;
let walls = [];
let world;
let floor;
let mouseX = 0,
  mouseY = 0;
let isPointerLocked = false;
let painterMesh; // 총 대신 페인터 모델
let aim;
let fbxLoader;
let paintModelTemplate; // 미리 로드한 페인트 모델

let playerBody;
let wallBodies = [];
let mainObjectBodies = [];
let mainObjects = [];
let floorBody;
let targetDoorBody;

// 발사된 페인트 오브젝트들을 관리하는 배열
let paintProjectiles = [];

const doors = []; // 각 문에 대한 Mesh 저장
const doorBodies = []; // 각 문에 대한 RigidBody 저장
const doorMixers = []; // 각 문에 대한 AnimationMixer 저장
const doorAnimStart = []; // 각 문 애니메이션 시작시간

// 플레이어 설정
const player = {
  position: new THREE.Vector3(-30, 1.6, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  speed: 2.5,
  jumpPower: 7.5,
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
  opacity: 0.9,
  roughness: 1.0,
  metalness: 0.0,
});

async function init() {
  await RAPIER.init();
  world = new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));
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

  // 은은한 전역 환경광
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  // 태양처럼 강한 방향광
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(-10, 15, 10);
  dirLight.castShadow = true;

  // 그림자 품질 개선
  dirLight.shadow.mapSize.width = 4096;
  dirLight.shadow.mapSize.height = 4096;
  dirLight.shadow.bias = -0.0005;

  // 그림자 범위 설정 (문, 벽이 다 들어오게)
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 30;
  dirLight.shadow.camera.bottom = -30;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 100;

  scene.add(dirLight);

  fbxLoader = new FBXLoader();

  createPlayer();
  createMap();
  setupEventListeners();

  // 페인트 모델 미리 로드
  await loadPaintModel();

  loadPainter();
  createAim();
  animate();
}

function loadPaintModel() {
  return new Promise((resolve) => {
    fbxLoader.load("paint.fbx", (paintObject) => {
      paintObject.scale.setScalar(0.001);

      paintObject.traverse((child) => {
        if (child.isLight) {
          paintObject.remove(child); // light 제거
        }
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      paintModelTemplate = paintObject;
      resolve();
    });
  });
}

function createPlayer() {
  // 플레이어를 Dynamic RigidBody로 변경
  const playerDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(player.position.x, player.position.y, player.position.z)
    .lockRotations(); // 회전 잠금 (넘어지지 않게)

  playerBody = world.createRigidBody(playerDesc);

  // 플레이어 콜라이더 (캡슐 형태)
  const playerColliderDesc = RAPIER.ColliderDesc.capsule(0.8, 0.4)
    .setTranslation(0, 0, 0)
    .setFriction(0.7) // 마찰력
    .setRestitution(0.1); // 반발력 (튀지 않게)

  world.createCollider(playerColliderDesc, playerBody);
}

function createMap() {
  const floorGeometry = new THREE.PlaneGeometry(80, 20);
  const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
  floorBody = world.createRigidBody(floorBodyDesc);
  const floorColliderDesc = RAPIER.ColliderDesc.cuboid(40, 0.1, 10);
  world.createCollider(floorColliderDesc, floorBody);

  const mainObjectPositions = [
    {
      pos: [-25, 1, 0],
      rot: [0, 0, 0],
      size: [2, 2, 2],
      colliderSize: [1, 1, 1],
    },
  ];

  mainObjectPositions.forEach((mainObjectData) => {
    const mainObjectGeometry = new THREE.BoxGeometry(...mainObjectData.size);
    const mainObjectMaterial = new THREE.MeshStandardMaterial({
      color: 0x938784,
      roughness: 0.8,
      metalness: 0.2,
    });
    const mainObject = new THREE.Mesh(mainObjectGeometry, mainObjectMaterial);
    mainObject.position.set(...mainObjectData.pos);
    mainObject.rotation.set(...mainObjectData.rot);
    mainObject.castShadow = true;
    mainObject.receiveShadow = true;
    scene.add(mainObject);
    walls.push(mainObject);
    mainObjects.push({ mesh: mainObject, hitCount: 0 });

    const mainObjectBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      ...mainObjectData.pos
    );
    const mainObjectBody = world.createRigidBody(mainObjectBodyDesc);
    const mainObjectColliderDesc = RAPIER.ColliderDesc.cuboid(
      ...mainObjectData.colliderSize
    );
    world.createCollider(mainObjectColliderDesc, mainObjectBody);
    mainObjectBodies.push(mainObjectBody);
  });

  const wallPositions = [
    {
      pos: [0, 2, -10],
      rot: [0, 0, 0],
      size: [80, 4, 0.2],
      colliderSize: [40, 2, 0.1],
    },
    {
      pos: [0, 2, 10],
      rot: [0, 0, 0],
      size: [80, 4, 0.2],
      colliderSize: [40, 2, 0.1],
    },
    {
      pos: [-40, 2, 0],
      rot: [0, 0, 0],
      size: [0.2, 4, 20],
      colliderSize: [0.1, 2, 10],
    },
    {
      pos: [40, 2, 0],
      rot: [0, 0, 0],
      size: [0.2, 4, 20],
      colliderSize: [0.1, 2, 10],
    },
  ];

  wallPositions.forEach((wallData) => {
    const wallGeometry = new THREE.BoxGeometry(...wallData.size);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.2,
    });

    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(...wallData.pos);
    wall.rotation.set(...wallData.rot);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    walls.push(wall);

    const wallBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      ...wallData.pos
    );
    const wallBody = world.createRigidBody(wallBodyDesc);
    const wallColliderDesc = RAPIER.ColliderDesc.cuboid(
      ...wallData.colliderSize
    );
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

      const wallBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
        ...wallData.pos
      );
      const wallBody = world.createRigidBody(wallBodyDesc);
      const wallColliderDesc = RAPIER.ColliderDesc.cuboid(
        ...wallData.colliderSize
      );
      world.createCollider(wallColliderDesc, wallBody);
      wallBodies.push(wallBody);
    });
    world.createCollider(wallColliderDesc, wallBody);
    wallBodies.push(wallBody);
  });

  const doorPositions = [
    {
      pos: [-20, 2, 0],
      rot: [0, 0, 0],
      size: [0.2, 4, 2.5],
      colliderSize: [0.1, 2, 1.25],
    },
    {
      pos: [0, 2, 0],
      rot: [0, 0, 0],
      size: [0.2, 4, 2.5],
      colliderSize: [0.1, 2, 1.25],
    },
    {
      pos: [20, 2, 0],
      rot: [0, 0, 0],
      size: [0.2, 4, 2.5],
      colliderSize: [0.1, 2, 1.25],
    },
  ];
  doorPositions.forEach((doorData, i) => {
    const doorGeometry = new THREE.BoxGeometry(...doorData.size);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      roughness: 0.8,
      metalness: 0.2,
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(...doorData.pos);
    door.rotation.set(...doorData.rot);
    door.castShadow = true;
    door.receiveShadow = true;
    scene.add(door);
    walls.push(door);
    doors[i] = door;

    const doorBodyDesc =
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        ...doorData.pos
      );
    const doorBody = world.createRigidBody(doorBodyDesc);
    const doorColliderDesc = RAPIER.ColliderDesc.cuboid(
      ...doorData.colliderSize
    );
    world.createCollider(doorColliderDesc, doorBody);
    wallBodies.push(doorBody);
    doorBodies[i] = doorBody;

    doorMixers[i] = null;
    doorAnimStart[i] = null;
  });

  const innerWallPositions = [
    {
      pos: [-20, 2, 5.625],
      rot: [0, 0, 0],
      size: [0.2, 4, 8.75],
      colliderSize: [0.1, 2, 4.375],
    },
    {
      pos: [-20, 2, -5.625],
      rot: [0, 0, 0],
      size: [0.2, 4, 8.75],
      colliderSize: [0.1, 2, 4.375],
    },
    {
      pos: [0, 2, 5.625],
      rot: [0, 0, 0],
      size: [0.2, 4, 8.75],
      colliderSize: [0.1, 2, 4.375],
    },
    {
      pos: [0, 2, -5.625],
      rot: [0, 0, 0],
      size: [0.2, 4, 8.75],
      colliderSize: [0.1, 2, 4.375],
    },
    {
      pos: [20, 2, 5.625],
      rot: [0, 0, 0],
      size: [0.2, 4, 8.75],
      colliderSize: [0.1, 2, 4.375],
    },
    {
      pos: [20, 2, -5.625],
      rot: [0, 0, 0],
      size: [0.2, 4, 8.75],
      colliderSize: [0.1, 2, 4.375],
    },
  ];

  innerWallPositions.forEach((innerWallData) => {
    const innerWallGeometry = new THREE.BoxGeometry(...innerWallData.size);
    const innerWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.2,
    });
    const innerWall = new THREE.Mesh(innerWallGeometry, innerWallMaterial);
    innerWall.position.set(...innerWallData.pos);
    innerWall.rotation.set(...innerWallData.rot);
    innerWall.castShadow = true;
    innerWall.receiveShadow = true;
    scene.add(innerWall);
    walls.push(innerWall);

    const innerWallBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      ...innerWallData.pos
    );
    const innerWallBody = world.createRigidBody(innerWallBodyDesc);
    const innerWallColliderDesc = RAPIER.ColliderDesc.cuboid(
      ...innerWallData.colliderSize
    );
    world.createCollider(innerWallColliderDesc, innerWallBody);
    wallBodies.push(innerWallBody);
  });
}

function loadPainter() {
  fbxLoader.load("painter.fbx", (object) => {
    painterMesh = object;

    painterMesh.scale.set(0.001, 0.001, 0.001);
    painterMesh.position.set(0.5, -0.4, -1.2);
    painterMesh.rotation.set(0, Math.PI, 0);

    painterMesh.traverse((child) => {
      if (child.isLight) {
        painterMesh.remove(child); // light 제거
      }
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

  // 템플릿 모델 복사
  const paintObject = paintModelTemplate.clone();
  paintObject.position.copy(camera.position);

  const paintData = {
    object: paintObject,
    velocity: dir.clone().multiplyScalar(15), // 발사 속도
    life: 5.0,
    gravity: -9.8,
  };

  paintProjectiles.push(paintData);
  scene.add(paintObject);
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
  for (const obj of mainObjects) {
    if (hit.object === obj.mesh) {
      obj.hitCount += 1;

      if (obj.hitCount === 3) {
        obj.mesh.material.color.set(0xff0000);
        openDoor(0); // door1Open
      }

      break;
    }
  }
}

function openDoor(index) {
  const positionTimes = [0, 1, 2];
  const y0 = doors[index].position.y;
  const positionValues = [
    doors[index].position.x,
    y0,
    doors[index].position.z,
    doors[index].position.x,
    y0 + 2,
    doors[index].position.z,
    doors[index].position.x,
    y0 + 4,
    doors[index].position.z,
  ];

  const positionTrack = new THREE.VectorKeyframeTrack(
    ".position",
    positionTimes,
    positionValues
  );
  const clip = new THREE.AnimationClip("doorOpen", -1, [positionTrack]);

  const mixer = new THREE.AnimationMixer(doors[index]);
  doorMixers[index] = mixer;

  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.play();

  doorAnimStart[index] = performance.now();
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
  // 카메라 회전
  camera.rotation.order = "YXZ";
  camera.rotation.y = -mouseX;
  camera.rotation.x = -mouseY;

  // 이동 방향 계산
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

  // 현재 물리 바디의 위치와 속도 가져오기
  const currentPos = playerBody.translation();
  const currentVel = playerBody.linvel();

  // 새로운 속도 계산 (물리 바디에 적용)
  const newVel = new RAPIER.Vector3(
    moveDirection.x * speed,
    currentVel.y, // Y 속도는 중력/점프로 처리
    moveDirection.z * speed
  );

  // 점프 처리 - 바닥에 있을 때만
  if (keys.space && Math.abs(currentVel.y) < 0.1) {
    newVel.y = player.jumpPower;
  }

  // 물리 바디에 새로운 속도 적용
  playerBody.setLinvel(newVel, true);

  // 카메라 위치를 물리 바디 위치에 동기화
  const bodyPos = playerBody.translation();
  player.position.set(bodyPos.x, bodyPos.y, bodyPos.z);
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
  world.step();

  updatePlayer(deltaTime);
  updateAim();
  updatePaintProjectiles(deltaTime);

  for (let i = 0; i < 3; i++) {
    if (doorMixers[i]) {
      doorMixers[i].update(deltaTime);
      if (doorAnimStart[i] !== null) {
        const elapsed = (performance.now() - doorAnimStart[i]) / 1000;
        const y = Math.min(2 + elapsed * 2, 6);
        const doorPos = doors[i].position;
        doorBodies[i].setNextKinematicTranslation(
          new RAPIER.Vector3(doorPos.x, y, doorPos.z)
        );
      }
    }
  }

  renderer.render(scene, camera);
}

init();
