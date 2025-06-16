import * as THREE from "three";
import { applyMeshStandardMaterial } from "./util.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let scene, camera, renderer;
let walls = [];
let floor;
let mouseX = 0,
  mouseY = 0;
let isPointerLocked = false;
let gunMesh;
let aim;

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

const raycaster = new THREE.Raycaster(); //ray를 쏘아 물체와의 충돌 여부 판별
const paintMaterial = new THREE.MeshStandardMaterial({
  color: 0xff3c3c,
  transparent: true,
  opacity: 0.8,
  roughness: 1.0,
  metalness: 0.0,
});

async function init() {
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

  createMap();

  setupEventListeners();

  await addGun();

  createAim();

  setupGUIControls();

  animate();
}

function createMap() {
  const floorGeometry = new THREE.PlaneGeometry(20, 20);
  const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 벽들
  const wallPositions = [
    { pos: [0, 2, -10], rot: [0, 0, 0], size: [20, 4, 0.2] },
    { pos: [0, 2, 10], rot: [0, Math.PI, 0], size: [20, 4, 0.2] },
    { pos: [-10, 2, 0], rot: [0, Math.PI / 2, 0], size: [20, 4, 0.2] },
    { pos: [10, 2, 0], rot: [0, -Math.PI / 2, 0], size: [20, 4, 0.2] },
  ];

  wallPositions.forEach((wallData) => {
    const wallGeometry = new THREE.BoxGeometry(...wallData.size);
    const wallMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffffff,
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(...wallData.pos);
    wall.rotation.set(...wallData.rot);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    walls.push(wall);
  });

  for (let i = 0; i < 5; i++) {
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
      (Math.random() - 0.5) * 15,
      boxGeometry.parameters.height / 2,
      (Math.random() - 0.5) * 15
    );
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    walls.push(box);
  }
}

const loader = new FBXLoader();

function loadFBX(filename) {
  return new Promise((resolve, reject) => {
      loader.load(filename, 
          (object) => resolve(object),  // 성공 시
          undefined,                    // 진행 상황
          (error) => reject(error)      // 실패 시
      );
  });
}

//페인트건
async function addGun(){  
  try{
    gunMesh = await loadFBX('painter.fbx');
  
    gunMesh.scale.set(0.0005, 0.0005, 0.0005);
    gunMesh.position.set(0.1, -0.2, -0.5); 
    gunMesh.rotation.y = Math.PI;
    
    camera.add(gunMesh);
    scene.add(camera);
  } catch (error){
    console.error('Error loading FBX:', error);
  }
}

//조준점
function createAim(){
  const aimGeom = new THREE.SphereGeometry(0.05, 8, 8);
  const aimMaterial = new THREE.MeshBasicMaterial({color:0x00ff00});
  aim = new THREE.Mesh(aimGeom, aimMaterial);
  aim.visible = false;
  scene.add(aim);
}

//물감 발사
function shoot(){
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(camera.position, dir);  //시작점 -> 선 방향에 따라 뻗어가며 물체 확인

  const inters = raycaster.intersectObjects(walls); 

  if (inters.length > 0){
    const hit = inters[0]; //가장 가까운 충돌 지점 반환

    const paintGeom = new THREE.CircleGeometry(0.05, 24);
    const paintMat = new THREE.MeshStandardMaterial({
      color: paintMaterial.color.clone(),
      transparent: true,
      opacity: paintMaterial.opacity,
      roughness: 1.0,
      metalness: 0.0,
    });

    const paint = new THREE.Mesh(paintGeom, paintMat);

    paint.position.copy(hit.point);
    paint.position.add(hit.face.normal.clone().multiplyScalar(0.01)); //표면 위로 살짝 띄움

    const normal = hit.face.normal.clone().normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); // Z축 평면을 법선 방향으로 회전
    paint.quaternion.copy(quaternion); // 회전 적용

    scene.add(paint);
  }
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
    } else{
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

  player.position.x = Math.max(-9, Math.min(9, player.position.x));
  player.position.z = Math.max(-9, Math.min(9, player.position.z));

  camera.position.copy(player.position);
}

function updateAim(){
  const dir2 = new THREE.Vector3();
  camera.getWorldDirection(dir2);
  raycaster.set(camera.position, dir2);

  const inters = raycaster.intersectObjects(walls);

  if (inters.length > 0){
    const hit = inters[0];
    aim.position.copy(hit.point);
    aim.visible = true;
  } else {
    aim.visible = false;
  }
}

function setupGUIControls() {
  const controls = new function () {
    this.opacity = paintMaterial.opacity;
    this.paintColor = paintMaterial.color.getStyle();
  };

  const gui = new GUI();
  gui.add(controls, 'opacity', 0, 1, 0.01).onChange(function (e) {
    paintMaterial.color = new THREE.Color(controls.paintColor);
    paintMaterial.opacity = controls.opacity;
  });
  gui.addColor(controls, 'paintColor').onChange(function (e) { //그냥 add아님!
    paintMaterial.color = new THREE.Color(controls.paintColor);
    paintMaterial.opacity = controls.opacity;
  });

  return controls;
}

let lastTime = 0;
function animate(currentTime = 0) {
  requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  updatePlayer(deltaTime);

  updateAim();

  renderer.render(scene, camera);
}

init();
