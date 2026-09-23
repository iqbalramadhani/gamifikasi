window.initSetup = function() {
scene = new THREE.Scene();
scene.background = new THREE.Color(0x2d4f30);

camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);

const canvas = document.getElementById("canvas");
renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Mencegah lag di layar Retina (Mac)
renderer.setSize(window.innerWidth, window.innerHeight);

// Auto resize canvas
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Pencahayaan
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(mapSize/2, 800, mapSize/2);
scene.add(dirLight);

// Lantai
const floorGeo = new THREE.PlaneGeometry(mapSize, mapSize);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x3d8544 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(mapSize/2, 0, mapSize/2);
scene.add(floor);

// Fog setup
scene.fog = new THREE.FogExp2(0x2d4f30, 0.001);

// Rain setup (starts invisible/opacity=0)
const rainCount = 1500;
const rainGeo = new THREE.BufferGeometry();
const rainPositions = new Float32Array(rainCount * 3);
for(let i=0; i<rainCount; i++) {
  rainPositions[i*3] = (Math.random() - 0.5) * 1000;
  rainPositions[i*3+1] = Math.random() * 500;
  rainPositions[i*3+2] = (Math.random() - 0.5) * 1000;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMat = new THREE.PointsMaterial({
  color: 0xaaaaaa, size: 1.0, transparent: true, opacity: 0
});
rainParticles = new THREE.Points(rainGeo, rainMat);
scene.add(rainParticles);
};
