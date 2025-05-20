import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Stats from "three/addons/libs/stats.module.js";

const scene = new THREE.Scene();

let camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.x = 120;
camera.position.y = 60;
camera.position.z = 180;
camera.lookAt(scene.position);
scene.add(camera);

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(new THREE.Color(0x000000));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const stats = new Stats();
document.body.appendChild(stats.dom);

let orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

const textureLoader = new THREE.TextureLoader();

const sunGeom = new THREE.SphereGeometry(10);
const mercuryGeom = new THREE.SphereGeometry(1.5);
const venusGeom = new THREE.SphereGeometry(3);
const earthGeom = new THREE.SphereGeometry(3.5);
const marsGeom = new THREE.SphereGeometry(2.5);

const mercuryTexture = textureLoader.load("Mercury.jpg");
const venusTexture = textureLoader.load("Venus.jpg");
const earthTexture = textureLoader.load("Earth.jpg");
const marsTexture = textureLoader.load("Mars.jpg");

const sunMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
const mercuryMaterial = new THREE.MeshStandardMaterial({
  color: 0xa6a6a6,
  map: mercuryTexture,
  roughness: 0.9,
  metalness: 0.2,
});
const venusMaterial = new THREE.MeshStandardMaterial({
  color: 0xe39e1c,
  map: venusTexture,
  roughness: 0.9,
  metalness: 0.2,
});
const earthMaterial = new THREE.MeshStandardMaterial({
  color: 0x3498db,
  map: earthTexture,
  roughness: 0.9,
  metalness: 0.2,
});
const marsMaterial = new THREE.MeshStandardMaterial({
  color: 0xc0392b,
  map: marsTexture,
  roughness: 0.9,
  metalness: 0.2,
});

const sun = new THREE.Mesh(sunGeom, sunMaterial);
const mercury = new THREE.Mesh(mercuryGeom, mercuryMaterial);
const venus = new THREE.Mesh(venusGeom, venusMaterial);
const earth = new THREE.Mesh(earthGeom, earthMaterial);
const mars = new THREE.Mesh(marsGeom, marsMaterial);

sun.position.set(0, 0, 0);
mercury.position.set(20, 0, 0);
venus.position.set(35, 0, 0);
earth.position.set(50, 0, 0);
mars.position.set(65, 0, 0);

scene.add(sun);
scene.add(mercury);
scene.add(venus);
scene.add(earth);
scene.add(mars);

const ambientLight = new THREE.AmbientLight(0x3c3c3c);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
directionalLight.position.set(10, 10, 50);
directionalLight.castShadow = true;
scene.add(directionalLight);

let stepMercury = 0;
let stepVenus = 0;
let stepEarth = 0;
let stepMars = 0;

function animate() {
  stats.update();
  orbitControls.update();

  stepMercury += controls.folder1Params.orbitSpeed;
  stepVenus += controls.folder2Params.orbitSpeed;
  stepEarth += controls.folder3Params.orbitSpeed;
  stepMars += controls.folder4Params.orbitSpeed;

  mercury.position.x = 20 * Math.sin(stepMercury);
  mercury.position.z = 20 * Math.cos(stepMercury);
  mercury.rotation.y += controls.folder1Params.rotationSpeed;

  venus.position.x = 35 * Math.sin(stepVenus);
  venus.position.z = 35 * Math.cos(stepVenus);
  venus.rotation.y += controls.folder2Params.rotationSpeed;

  earth.position.x = 50 * Math.sin(stepEarth);
  earth.position.z = 50 * Math.cos(stepEarth);
  earth.rotation.y += controls.folder3Params.rotationSpeed;

  mars.position.x = 65 * Math.sin(stepMars);
  mars.position.z = 65 * Math.cos(stepMars);
  mars.rotation.y += controls.folder4Params.rotationSpeed;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

const controls = setupControls();
animate();

function setupControls() {
  const controls = new (function () {
    this.folder0Params = {
      perspective: "Perspective",
      switchCameraType: function () {
        if (camera instanceof THREE.PerspectiveCamera) {
          scene.remove(camera);
          camera = null;
          camera = new THREE.OrthographicCamera(
            window.innerWidth / -16,
            window.innerWidth / 16,
            window.innerHeight / 16,
            window.innerHeight / -16,
            -200,
            500
          );
          camera.position.x = 120;
          camera.position.y = 60;
          camera.position.z = 180;
          camera.lookAt(scene.position);
          orbitControls.dispose();
          orbitControls = null;
          orbitControls = new OrbitControls(camera, renderer.domElement);
          orbitControls.enableDamping = true;
          controls.folder0Params.perspective = "Orthographic";
        } else {
          scene.remove(camera);
          camera = null;
          camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
          );
          camera.position.x = 120;
          camera.position.y = 60;
          camera.position.z = 180;
          camera.lookAt(scene.position);
          orbitControls.dispose();
          orbitControls = null;
          orbitControls = new OrbitControls(camera, renderer.domElement);
          orbitControls.enableDamping = true;
          controls.folder0Params.perspective = "Perspective";
        }
      },
    };
    this.folder1Params = {
      rotationSpeed: 0.02,
      orbitSpeed: 0.02,
    };

    this.folder2Params = {
      rotationSpeed: 0.015,
      orbitSpeed: 0.015,
    };

    this.folder3Params = {
      rotationSpeed: 0.01,
      orbitSpeed: 0.01,
    };

    this.folder4Params = {
      rotationSpeed: 0.008,
      orbitSpeed: 0.008,
    };
  })();

  const gui = new GUI();
  const folder0 = gui.addFolder("Camera");
  folder0
    .add(controls.folder0Params, "switchCameraType")
    .name("Switch Camera Type");
  folder0
    .add(controls.folder0Params, "perspective")
    .name("Current Camera")
    .listen();
  folder0.open();

  const folder1 = gui.addFolder("Mercury");
  folder1
    .add(controls.folder1Params, "rotationSpeed", 0, 0.1)
    .name("Rotation Speed");
  folder1.add(controls.folder1Params, "orbitSpeed", 0, 0.1).name("Orbit Speed");
  folder1.open();

  const folder2 = gui.addFolder("Venus");
  folder2
    .add(controls.folder2Params, "rotationSpeed", 0, 0.1)
    .name("Rotation Speed");
  folder2.add(controls.folder2Params, "orbitSpeed", 0, 0.1).name("Orbit Speed");
  folder2.open();

  const folder3 = gui.addFolder("Earth");
  folder3
    .add(controls.folder3Params, "rotationSpeed", 0, 0.1)
    .name("Rotation Speed");
  folder3.add(controls.folder3Params, "orbitSpeed", 0, 0.1).name("Orbit Speed");
  folder3.open();

  const folder4 = gui.addFolder("Mars");
  folder4
    .add(controls.folder4Params, "rotationSpeed", 0, 0.1)
    .name("Rotation Speed");
  folder4.add(controls.folder4Params, "orbitSpeed", 0, 0.1).name("Orbit Speed");
  folder4.open();

  return controls;
}
