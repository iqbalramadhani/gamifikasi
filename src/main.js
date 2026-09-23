import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

window.loadedModels = {
  player: null,
  sword: null,
  enemy: null,
  tree: null,
  house: null
};

window.loadAllModels = async function() {
  const loader = new GLTFLoader();
  const modelsToLoad = [
    { key: 'player', url: '/models/player.glb' },
    { key: 'sword', url: '/models/sword.glb' },
    { key: 'enemy', url: '/models/enemy.glb' },
    { key: 'tree', url: '/models/tree.glb' },
    { key: 'tree_high', url: '/models/tree-high.glb' },
    { key: 'plant', url: '/models/plant.glb' },
    { key: 'house', url: '/models/house.glb' },
    { key: 'fence', url: '/models/fence.glb' },
    { key: 'building_struct', url: '/models/building-structure.glb' },
    { key: 'building_roof', url: '/models/building-roof.glb' },
    { key: 'rocks_high', url: '/models/rocks-high.glb' },
    { key: 'rocks_low', url: '/models/rocks-low.glb' },
    { key: 'stones', url: '/models/stones.glb' },
    { key: 'target', url: '/models/target.glb' },
    { key: 'patch_dirt', url: '/models/patch-dirt.glb' }
  ];

  console.log("Mencari file 3D (.glb) di folder public/models/...");

  const promises = modelsToLoad.map(item => {
    return new Promise((resolve) => {
      loader.load(item.url, (gltf) => {
        // Berhasil dimuat
        window.loadedModels[item.key] = gltf.scene;
        console.log(`✅ Model ${item.key} berhasil dimuat.`);
        resolve(true);
      }, undefined, (error) => {
        // Gagal (File tidak ada) - Tidak masalah karena kita pakai Fallback
        console.log(`⚠️ Model ${item.key} tidak ditemukan, menggunakan grafis klasik.`);
        resolve(false);
      });
    });
  });

  await Promise.all(promises);
  console.log("Semua proses pencarian model selesai.");
};

window.THREE = THREE;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'shoot') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'hit') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.2);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'coin') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1600, now + 0.05);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'dash') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'spin') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.3);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'boss_spawn') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.linearRampToValueAtTime(200, now + 2);
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 3);
    osc.start(now);
    osc.stop(now + 3);
  } else if (type === 'bgm') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, now);
    gainNode.gain.setValueAtTime(0.05, now);
    osc.start(now);
  }
}

window.addEventListener('pointerdown', () => {
  if (!window.bgmStarted) {
    playSound('bgm');
    window.bgmStarted = true;
  }
}, {once: true});
const mapSize = 4000;

// --- GAME LOGIC STATE ---
let currentScene = 'hometown'; // 'hometown' or 'wilds'
let isPaused = false;
let isGameStarted = false;
const player = { x: 10000, y: 10080, r: 16, speed: 4.5, hp: 100, maxHp: 100, attackDamage: 1, facingX: 1, facingY: 0, attackCooldown: 0, defending: false, walkCycle: 0, dashCooldown: 0, spinCooldown: 0, isDashing: 0, isSpinning: 0, level: 1, exp: 0, nextExp: 20 };
const upgrades = { hpLevel: 1, atkLevel: 1, spdLevel: 1 };
const projectiles = [];
let gold = 0;
let potions = 0;
let crystalCount = 0;
const crystalGoal = 10;
let gameOver = false;
let shopOpen = false;
let blacksmithOpen = false;
let shopCooldown = 0;

let currentWeapon = 0;
let currentArmor = 0;

const weaponList = [
    { name: "Wooden Sword", damage: 0, cost: 0, color: 0xeeeeee },
    { name: "Iron Sword", damage: 2, cost: 100, color: 0xaaaaaa },
    { name: "Golden Sword", damage: 5, cost: 300, color: 0xffd700 },
    { name: "Fire Blade", damage: 10, cost: 800, color: 0xff4400 }
];

const armorList = [
    { name: "Rusted Armor", hp: 0, cost: 0, color: 0xaaaaaa },
    { name: "Knight Armor", hp: 50, cost: 150, color: 0xdddddd },
    { name: "Paladin Armor", hp: 150, cost: 400, color: 0xffcc00 },
    { name: "Dragon Armor", hp: 300, cost: 1000, color: 0x221111 }
];

const obstacles = [];
const crystalItems = [];
const coinItems = [];
const expOrbs = [];
const potionItems = [];
const enemies = [];
const keys = {};
const particles = [];

let petActive = true;
let petMesh = null;

// --- BOSS & WEATHER STATE ---
let bossActive = false;
let bossMesh = null;
let bossHpGroup = null;
let bossHpFg = null;
let bossHp = 200;
let bossMaxHp = 200;
let bossX = 2000, bossY = 2000;
let bossPhase = 1;

let dayTime = 0; // 0 to 1 (0 = siang, 0.5 = sore/malam)
let rainParticles;

// Global Object References untuk Three.js
let scene, camera, renderer, dirLight;
let playerMesh, shieldMesh, altarCrystal;
window.initSetup = function() {
scene = new THREE.Scene();
scene.background = new THREE.Color(0x2d4f30);

camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);

const canvas = document.getElementById("canvas");
renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Mencegah lag di layar Retina (Mac)
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

window.composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
window.composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.4;
bloomPass.strength = 0.8;
bloomPass.radius = 0.3;
window.composer.addPass(bloomPass);

// Auto resize canvas
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  window.composer.setSize(window.innerWidth, window.innerHeight);
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
scene.fog = new THREE.FogExp2(0x2d4f30, 0.0002); // Fog lebih tipis

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
function blocked(x, y, r = player.r) {
  if (typeof currentScene !== 'undefined' && currentScene === 'hometown') {
      if (x - r < 9700 || x + r > 10300 || y - r < 9700 || y + r > 10300) return true;
  } else {
      if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }
  
  for (let i = 0; i < obstacles.length; i++) {
    let o = obstacles[i];
    // Fast Rejection (Kotak pembatas / AABB)
    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    
    // Exact collision (Jarak Kuadrat untuk hindari akar/hypot yang berat)
    let dx = o.x - x;
    let dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) return true;
  }
  return false;
}

function spawnAtFreePos() {
  let x, y;
  let valid = false;
  while(!valid) {
    x = 50 + Math.random() * (mapSize - 100);
    y = 50 + Math.random() * (mapSize - 100);
    if (Math.hypot(x - mapSize/2, y - mapSize/2) < 250) continue; // Jangan di sekitar altar
    if (Math.hypot(x - player.x, y - player.y) < 250) continue; // Jangan di dekat pemain saat baru mulai
    if (obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
    valid = true;
  }
  return {x, y};
}

window.initMap = function() {
// --- ALTAR UPGRADE DI TENGAH PETA ---
const altarGroup = new THREE.Group();
const altarBase = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 10, 8), new THREE.MeshLambertMaterial({color: 0x555555}));
altarBase.position.y = 5;
const altarPillar = new THREE.Mesh(new THREE.CylinderGeometry(15, 20, 30, 8), new THREE.MeshLambertMaterial({color: 0x444444}));
altarPillar.position.y = 20;
altarCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(15, 0), new THREE.MeshBasicMaterial({color: 0x00ffff, wireframe: true}));
altarCrystal.position.y = 50;
altarGroup.add(altarBase);
altarGroup.add(altarPillar);
altarGroup.add(altarCrystal);
altarGroup.position.set(mapSize / 2, 0, mapSize / 2);
scene.add(altarGroup);

obstacles.push({ x: mapSize / 2, y: mapSize / 2, r: 40 });

// Buat hutan dan pegunungan secara klaster (bergerombol)
const numClusters = 40;
for (let c = 0; c < numClusters; c++) {
    let cx = 200 + Math.random() * (mapSize - 400);
    let cy = 200 + Math.random() * (mapSize - 400);
    
    if (Math.hypot(cx - mapSize/2, cy - mapSize/2) < 250) continue;
    
    let isRockCluster = Math.random() < 0.3; // 30% kemungkinan ini adalah gunung berbatu
    let clusterSize = 15 + Math.floor(Math.random() * 25);
    
    for (let i = 0; i < clusterSize; i++) {
        let rAngle = Math.random() * Math.PI * 2;
        let rDist = Math.random() * 250; 
        let x = cx + Math.cos(rAngle) * rDist;
        let y = cy + Math.sin(rAngle) * rDist;
        
        if (x < 50 || x > mapSize - 50 || y < 50 || y > mapSize - 50) continue;
        if (Math.hypot(x - mapSize/2, y - mapSize/2) < 200) continue;
        
        let radius = 15;
        if (obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + radius + 5)) continue;
        
        let rand = Math.random();
        if (isRockCluster) {
            if (rand < 0.7) {
                let r = 15 + Math.random() * 25;
                let rockGroup;
                if (window.loadedModels) {
                    if (rand < 0.2 && window.loadedModels.rocks_high) rockGroup = SkeletonUtils.clone(window.loadedModels.rocks_high);
                    else if (rand < 0.5 && window.loadedModels.rocks_low) rockGroup = SkeletonUtils.clone(window.loadedModels.rocks_low);
                    else if (window.loadedModels.stones) rockGroup = SkeletonUtils.clone(window.loadedModels.stones);
                }
                
                if (rockGroup) {
                    rockGroup.scale.set(30 + Math.random()*10, 30 + Math.random()*10, 30 + Math.random()*10);
                    rockGroup.position.set(x, 0, y);
                    rockGroup.rotation.y = Math.random() * Math.PI;
                    scene.add(rockGroup);
                } else {
                    let rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshLambertMaterial({ color: 0x777777 }));
                    rock.position.set(x, r, y);
                    rock.rotation.y = Math.random() * Math.PI;
                    scene.add(rock);
                }
                obstacles.push({ x: x, y: y, r: r * 0.8 });
            } else {
                let log = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 50, 8), new THREE.MeshLambertMaterial({ color: 0x4a3219 }));
                log.rotation.z = Math.PI / 2;
                log.rotation.y = Math.random() * Math.PI;
                log.position.set(x, 7, y);
                scene.add(log);
                obstacles.push({ x: x, y: y, r: 25 });
            }
        } else {
            if (rand < 0.6) {
                let treeGroup;
                let isHigh = Math.random() < 0.5;
                if (window.loadedModels) {
                    if (isHigh && window.loadedModels.tree_high) treeGroup = SkeletonUtils.clone(window.loadedModels.tree_high);
                    else if (!isHigh && window.loadedModels.tree) treeGroup = SkeletonUtils.clone(window.loadedModels.tree);
                }
                
                if (treeGroup) {
                    treeGroup.scale.set(30, 30, 30); 
                } else {
                    treeGroup = new THREE.Group();
                    let trunk = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 30, 8), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
                    trunk.position.y = 15;
                    let leaves = new THREE.Mesh(new THREE.ConeGeometry(25, 55, 8), new THREE.MeshLambertMaterial({ color: 0x226b2b }));
                    leaves.position.y = 42;
                    treeGroup.add(trunk);
                    treeGroup.add(leaves);
                }
                treeGroup.position.set(x, 0, y);
                scene.add(treeGroup);
                obstacles.push({ x: x, y: y, r: 12 });
            } else {
                let r = 12 + Math.random() * 12;
                let plantMesh;
                if (window.loadedModels && window.loadedModels.plant) {
                    plantMesh = SkeletonUtils.clone(window.loadedModels.plant);
                    plantMesh.scale.set(20, 20, 20);
                    plantMesh.position.set(x, 0, y);
                } else {
                    plantMesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshLambertMaterial({ color: 0x1d5c22 }));
                    plantMesh.position.set(x, r - 2, y);
                }
                scene.add(plantMesh);
                obstacles.push({ x: x, y: y, r: r * 0.7 });
            }
        }
    }
}
};

window.initHometown = function() {
    let hx = 10000;
    let hy = 10000;
    
    // --- LALUAN BATU (PLAZA) ---
    if (window.loadedModels && window.loadedModels.patch_dirt) {
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                if (Math.hypot(dx, dz) > 3.5) continue;
                let dirt = SkeletonUtils.clone(window.loadedModels.patch_dirt);
                dirt.scale.set(30, 30, 30);
                dirt.position.set(hx + dx * 65, 0, hy + dz * 65);
                scene.add(dirt);
            }
        }
    } else {
        const plazaGeo = new THREE.CircleGeometry(250, 32);
        const plazaMat = new THREE.MeshLambertMaterial({ color: 0x6e6e6e });
        const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
        plazaMesh.rotation.x = -Math.PI / 2;
        plazaMesh.position.set(hx, 0.5, hy);
        scene.add(plazaMesh);
    }
    
    // --- TEMBOK KAYU (PALISADE) ---
    const logGeo = new THREE.CylinderGeometry(6, 6, 40, 8);
    const logMat = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
        let x = hx + Math.cos(a) * 300;
        let y = hy + Math.sin(a) * 300;
        let fence;
        if (window.loadedModels && window.loadedModels.fence) {
            fence = SkeletonUtils.clone(window.loadedModels.fence);
            fence.scale.set(25, 25, 25);
            fence.rotation.y = -a + Math.PI/2;
            fence.position.set(x, 0, y);
        } else {
            fence = new THREE.Mesh(logGeo, logMat);
            fence.position.set(x, 20, y);
            fence.scale.y = 0.8 + Math.random() * 0.4;
        }
        scene.add(fence);
        obstacles.push({ x: x, y: y, r: 15 });
    }
    
    // --- AIR MANCUR (FOUNTAIN) ---
    const fountainGeo = new THREE.CylinderGeometry(30, 35, 10, 16);
    const fountainMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const fountain = new THREE.Mesh(fountainGeo, fountainMat);
    fountain.position.set(hx, 5, hy);
    scene.add(fountain);
    
    const waterGeo = new THREE.CylinderGeometry(28, 28, 2, 16);
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x00aaff, transparent: true, opacity: 0.8 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(hx, 10, hy);
    scene.add(water);
    
    const pillarGeo = new THREE.CylinderGeometry(5, 5, 25, 8);
    const pillar = new THREE.Mesh(pillarGeo, fountainMat);
    pillar.position.set(hx, 15, hy);
    scene.add(pillar);
    
    obstacles.push({ x: hx, y: hy, r: 35 });
    
    // --- RUMAH-RUMAH PENDUDUK ---
    const houseBaseGeo = new THREE.BoxGeometry(60, 40, 60);
    const houseBaseMat = new THREE.MeshLambertMaterial({ color: 0xddd3c6 });
    const roofGeo = new THREE.ConeGeometry(45, 30, 4); 
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b2e2e }); 
    
    const positions = [
        { x: -150, z: -150, r: 0 },
        { x: 150, z: 150, r: Math.PI },
        { x: -150, z: 150, r: Math.PI / 2 },
        { x: 200, z: -50, r: -Math.PI / 2 }
    ];
    
    positions.forEach(p => {
        let hGroup;
        if (window.loadedModels && window.loadedModels.building_struct) {
            hGroup = new THREE.Group();
            let bs = SkeletonUtils.clone(window.loadedModels.building_struct);
            let br = SkeletonUtils.clone(window.loadedModels.building_roof);
            hGroup.add(bs);
            hGroup.add(br);
            hGroup.scale.set(45, 45, 45);
        } else if (window.loadedModels && window.loadedModels.house) {
            hGroup = SkeletonUtils.clone(window.loadedModels.house);
            hGroup.scale.set(20, 20, 20);
        } else {
            hGroup = new THREE.Group();
            let base = new THREE.Mesh(houseBaseGeo, houseBaseMat);
            base.position.y = 20;
            let roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.y = 55;
            roof.rotation.y = Math.PI / 4; 
            hGroup.add(base);
            hGroup.add(roof);
        }
        hGroup.position.set(hx + p.x, 0, hy + p.z);
        hGroup.rotation.y = p.r;
        scene.add(hGroup);
        obstacles.push({ x: hx + p.x, y: hy + p.z, r: 40 });
    });
    
    if (window.loadedModels && window.loadedModels.target) {
        let target = SkeletonUtils.clone(window.loadedModels.target);
        target.scale.set(30, 30, 30);
        target.position.set(hx + 80, 0, hy - 150);
        target.rotation.y = Math.PI / 4;
        scene.add(target);
        obstacles.push({ x: hx + 80, y: hy - 150, r: 15 });
    }
    
    // --- TENDA TOKO (SHOP STALL) ---
    const stallGroup = new THREE.Group();
    const stallPoleGeo = new THREE.CylinderGeometry(2, 2, 40, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    const p1 = new THREE.Mesh(stallPoleGeo, poleMat); p1.position.set(-20, 20, -20); stallGroup.add(p1);
    const p2 = new THREE.Mesh(stallPoleGeo, poleMat); p2.position.set(20, 20, -20); stallGroup.add(p2);
    const p3 = new THREE.Mesh(stallPoleGeo, poleMat); p3.position.set(-20, 20, 20); stallGroup.add(p3);
    const p4 = new THREE.Mesh(stallPoleGeo, poleMat); p4.position.set(20, 20, 20); stallGroup.add(p4);
    
    const awningGeo = new THREE.PlaneGeometry(50, 50);
    const awningMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, side: THREE.DoubleSide });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.rotation.x = -Math.PI / 2 + 0.2;
    awning.position.y = 42;
    stallGroup.add(awning);
    
    const tableGeo = new THREE.BoxGeometry(30, 15, 15);
    const tableMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2b });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, 7.5, 10);
    stallGroup.add(table);
    
    stallGroup.position.set(hx - 100, 0, hy - 100);
    scene.add(stallGroup);
    
    // --- KUIL HEALER (HEALER SHRINE) ---
    const shrineGroup = new THREE.Group();
    const sBaseGeo = new THREE.CylinderGeometry(25, 25, 5, 8);
    const sBaseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const sBase = new THREE.Mesh(sBaseGeo, sBaseMat);
    sBase.position.y = 2.5;
    shrineGroup.add(sBase);
    
    for (let i = 0; i < 4; i++) {
        let sp = new THREE.Mesh(stallPoleGeo, sBaseMat);
        let ang = (i / 4) * Math.PI * 2 + Math.PI/4;
        sp.position.set(Math.cos(ang)*20, 20, Math.sin(ang)*20);
        shrineGroup.add(sp);
    }
    const sRoof = new THREE.Mesh(new THREE.ConeGeometry(30, 20, 4), new THREE.MeshLambertMaterial({ color: 0x00aaff }));
    sRoof.position.y = 50;
    sRoof.rotation.y = Math.PI / 4;
    shrineGroup.add(sRoof);
    
    shrineGroup.position.set(hx + 100, 0, hy - 100);
    scene.add(shrineGroup);
    // --- BENGKEL PANDAI BESI (BLACKSMITH) ---
    const bsGroup = new THREE.Group();
    const anvilGeo = new THREE.BoxGeometry(15, 10, 10);
    const anvilMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const anvil = new THREE.Mesh(anvilGeo, anvilMat);
    anvil.position.set(0, 5, 10);
    bsGroup.add(anvil);
    
    const furnaceGeo = new THREE.BoxGeometry(20, 30, 20);
    const furnaceMat = new THREE.MeshLambertMaterial({ color: 0x552222 });
    const furnace = new THREE.Mesh(furnaceGeo, furnaceMat);
    furnace.position.set(0, 15, -15);
    bsGroup.add(furnace);
    
    // Fire in furnace
    const fireGeo = new THREE.SphereGeometry(6, 8, 8);
    const fireMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0xff5500 });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.set(0, 10, -5);
    bsGroup.add(fire);
    
    bsGroup.position.set(hx - 100, 0, hy + 100);
    scene.add(bsGroup);
};
window.initEntities = function() {
const crystalGeo = new THREE.OctahedronGeometry(8, 0);
const crystalMat = new THREE.MeshLambertMaterial({ color: 0x00ffff });
for(let i=0; i<crystalGoal; i++) {
  let pos = spawnAtFreePos();
  let mesh = new THREE.Mesh(crystalGeo, crystalMat);
  mesh.position.set(pos.x, 15, pos.y);
  scene.add(mesh);
  crystalItems.push({ x: pos.x, y: pos.y, taken: false, mesh: mesh });
}

const coinGeo = new THREE.CylinderGeometry(6, 6, 2, 16);
const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
for(let i=0; i<40; i++) {
  let pos = spawnAtFreePos();
  let mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.rotation.x = Math.PI/2;
  mesh.position.set(pos.x, 10, pos.y);
  scene.add(mesh);
  coinItems.push({ x: pos.x, y: pos.y, taken: false, mesh: mesh });
}

const spikeGeo = new THREE.IcosahedronGeometry(15, 0); 
const spikeMat = new THREE.MeshLambertMaterial({ color: 0x991212 });

const slimeGeo = new THREE.BoxGeometry(16, 16, 16);
const slimeMat = new THREE.MeshLambertMaterial({ color: 0x22cc44, transparent: true, opacity: 0.8 });

const golemGeo = new THREE.BoxGeometry(28, 28, 28);
const golemMat = new THREE.MeshLambertMaterial({ color: 0x666666 });

const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
const hpFgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const hpGeo = new THREE.PlaneGeometry(24, 4);

const archerGeo = new THREE.CylinderGeometry(6, 6, 20, 8);
const archerMat = new THREE.MeshLambertMaterial({ color: 0xdddddd }); 
const kamikazeGeo = new THREE.SphereGeometry(12, 16, 16);
const kamikazeMat = new THREE.MeshLambertMaterial({ color: 0xff4400 }); 
const ghostGeo = new THREE.ConeGeometry(10, 25, 16);
const ghostMat = new THREE.MeshLambertMaterial({ color: 0x8800ff, transparent: true, opacity: 0.6 });

window.spawnEnemy = function(ex, ey) {
    if (!ex || !ey) {
        let pos = spawnAtFreePos();
        ex = pos.x; ey = pos.y;
    }
    
    // Memunculkan semua 6 jenis musuh secara acak dari awal permainan
    let type = Math.floor(Math.random() * 6);
    
    let mesh, eHp, eSpeed, eR, eY, eTypeStr;
    
    if (type === 0) {
       mesh = new THREE.Mesh(spikeGeo, spikeMat);
       eHp = 3; eSpeed = 1.6; eR = 15; eY = 15; eTypeStr = 'spike';
    } else if (type === 1) {
       mesh = new THREE.Mesh(slimeGeo, slimeMat);
       eHp = 1.5; eSpeed = 3.0; eR = 12; eY = 8; eTypeStr = 'slime';
    } else if (type === 2) {
       mesh = new THREE.Mesh(golemGeo, golemMat);
       eHp = 8; eSpeed = 0.8; eR = 20; eY = 14; eTypeStr = 'golem';
    } else if (type === 3) {
       mesh = new THREE.Mesh(archerGeo, archerMat);
       eHp = 4; eSpeed = 1.2; eR = 12; eY = 10; eTypeStr = 'archer';
    } else if (type === 4) {
       mesh = new THREE.Mesh(kamikazeGeo, kamikazeMat);
       eHp = 2; eSpeed = 3.5; eR = 12; eY = 12; eTypeStr = 'kamikaze';
    } else {
       mesh = new THREE.Mesh(ghostGeo, ghostMat);
       eHp = 5; eSpeed = 1.0; eR = 10; eY = 15; eTypeStr = 'ghost';
    }
    
    let levelMulti = 1 + (player.level * 0.1);
    eHp *= levelMulti;
    if (eTypeStr !== 'kamikaze') eSpeed *= (1 + player.level * 0.02);

    mesh.position.set(ex, eY, ey);
    scene.add(mesh);
    
    let hpGroup = new THREE.Group();
    let hpBg = new THREE.Mesh(hpGeo, hpBgMat);
    let hpFg = new THREE.Mesh(hpGeo, hpFgMat);
    hpFg.position.z = 0.1;
    hpGroup.add(hpBg);
    hpGroup.add(hpFg);
    scene.add(hpGroup);

    let dx = (Math.random() - 0.5) * 2;
    let dy = (Math.random() - 0.5) * 2;
    enemies.push({ 
        x: ex, y: ey, r: eR, meshY: eY, dx: dx, dy: dy, 
        hp: eHp, maxHp: eHp, baseSpeed: eSpeed, 
        mesh: mesh, hpGroup: hpGroup, hpFg: hpFg, 
        stunTimer: 0, slowTimer: 0, type: eTypeStr,
        attackTimer: 0
    });
};

// spawnEnemy dipanggil saat masuk the Wilds

playerMesh = new THREE.Group();

window.playerBodyMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
window.playerBladeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });

if (window.loadedModels && window.loadedModels.player) {
    // Gunakan Aset GLTF dari Blender!
    window.gltfPlayerRef = SkeletonUtils.clone(window.loadedModels.player);
    window.gltfPlayerRef.scale.set(35, 35, 35); // Diperbesar
    window.gltfPlayerRef.position.y = -15; // Turunkan agar menjejak tanah
    window.gltfPlayerRef.rotation.y = Math.PI / 2; // PERBAIKAN ORIENTASI WAJAH (Hadap Depan)
    
    // Temukan tulang/anggota tubuh
    window.playerLegL = window.gltfPlayerRef.getObjectByName('leg-left');
    window.playerLegR = window.gltfPlayerRef.getObjectByName('leg-right');
    window.playerArmL = window.gltfPlayerRef.getObjectByName('arm-left');
    window.playerArmR = window.gltfPlayerRef.getObjectByName('arm-right');
    
    playerMesh.add(window.gltfPlayerRef);
    
    // Asumsikan senjata sudah menyatu, namun jika ingin modular:
    if (window.loadedModels.sword) {
       const gltfSword = SkeletonUtils.clone(window.loadedModels.sword);
       gltfSword.scale.set(15, 15, 15);
       gltfSword.position.set(10, 0, 15);
       playerMesh.add(gltfSword);
    }
} else {
    // Fallback: Kotak-kotak klasik
    player.leftHip = new THREE.Group();
    player.leftHip.position.set(0, -3, -3.5);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), new THREE.MeshLambertMaterial({ color: 0x555555 }));
    leftLeg.position.set(0, -6, 0);
    player.leftHip.add(leftLeg);
    playerMesh.add(player.leftHip);

    player.rightHip = new THREE.Group();
    player.rightHip.position.set(0, -3, 3.5);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), new THREE.MeshLambertMaterial({ color: 0x555555 }));
    rightLeg.position.set(0, -6, 0);
    player.rightHip.add(rightLeg);
    playerMesh.add(player.rightHip);

    const bodyGeo = new THREE.BoxGeometry(14, 20, 14);
    const body = new THREE.Mesh(bodyGeo, window.playerBodyMat);
    body.position.y = 7;
    playerMesh.add(body);

    const headGeo = new THREE.SphereGeometry(6, 16, 16);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 21;
    playerMesh.add(head);

    const helmGeo = new THREE.SphereGeometry(6.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const helmMat = new THREE.MeshLambertMaterial({ color: 0x778899 });
    const helm = new THREE.Mesh(helmGeo, helmMat);
    helm.position.y = 21;
    playerMesh.add(helm);

    const swordGroup = new THREE.Group();
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 4), window.playerBladeMat);
    blade.position.x = 9;
    swordGroup.add(hilt);
    swordGroup.add(blade);
    swordGroup.position.set(0, 7, 9);
    playerMesh.add(swordGroup);

    const pShield = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 2, 16), new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
    pShield.rotation.x = Math.PI / 2;
    pShield.position.set(0, 7, -9);
    playerMesh.add(pShield);
}

// Set posisi ke y=15 agar kaki pas berpijak di lantai y=0
playerMesh.position.set(player.x, 15, player.y);
scene.add(playerMesh);

const shieldGeo = new THREE.SphereGeometry(24, 16, 16);
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5, wireframe: true });
shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
shieldMesh.visible = false;
playerMesh.add(shieldMesh);

  // Companion: The Fairy
  petMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffaa, wireframe: true })
  );
  scene.add(petMesh);
};

window.spawnParticles = function(x, y, color, count, type) {
    for (let i = 0; i < count; i++) {
        let mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
        let size = type === 'dust' ? 4 : 3;
        let geo = new THREE.BoxGeometry(size, size, size);
        let mesh = new THREE.Mesh(geo, mat);
        
        let py = type === 'dust' ? 2 : 15;
        mesh.position.set(x, py, y);
        scene.add(mesh);
        
        particles.push({
            mesh: mesh,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            dz: (Math.random() - 0.5) * 6 + (type === 'heal' ? 3 : 0),
            life: 1.0,
            decay: type === 'dust' ? 0.05 : 0.03
        });
    }
};

window.spawnBoss = function() {
  if (bossActive) return;
  bossActive = true;
  playSound('boss_spawn');
  document.getElementById("message").textContent = "⚠️ THE GOLDEN GOLEM TELAH BANGKIT! Kalahkan dia untuk menang!";
  
  const bGeo = new THREE.BoxGeometry(60, 60, 60);
  const bMat = new THREE.MeshLambertMaterial({ color: 0xffd700 }); // Emas
  bossMesh = new THREE.Mesh(bGeo, bMat);
  
  bossX = mapSize / 2;
  bossY = mapSize / 2;
  bossMesh.position.set(bossX, 30, bossY);
  scene.add(bossMesh);
  
  bossHpGroup = new THREE.Group();
  let bg = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  bossHpFg = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  bossHpFg.position.z = 0.2;
  bossHpGroup.add(bg);
  bossHpGroup.add(bossHpFg);
  scene.add(bossHpGroup);
  
  // Hancurkan altar
  scene.remove(altarCrystal);
};

window.hometownPortal = null;
window.shopNPC = null;
window.healerNPC = null;
window.blacksmithNPC = null;
window.wildsPortal = null;

window.initNPCs = function() {
    let hx = 10000;
    let hy = 10000;

    const portalGeo = new THREE.OctahedronGeometry(20, 0);
    const portalMat = new THREE.MeshLambertMaterial({ color: 0x00ffff, wireframe: true });
    hometownPortal = new THREE.Mesh(portalGeo, portalMat);
    hometownPortal.position.set(hx, 30, hy + 200);
    scene.add(hometownPortal);

    const shopGeo = new THREE.CylinderGeometry(8, 8, 25, 8);
    const shopMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    shopNPC = new THREE.Mesh(shopGeo, shopMat);
    shopNPC.position.set(hx - 100, 12.5, hy - 100);
    scene.add(shopNPC);

    const healerGeo = new THREE.CylinderGeometry(8, 8, 25, 8);
    const healerMat = new THREE.MeshLambertMaterial({ color: 0xff66cc });
    healerNPC = new THREE.Mesh(healerGeo, healerMat);
    healerNPC.position.set(hx + 100, 12.5, hy - 100);
    scene.add(healerNPC);
    
    const bsGeo = new THREE.CylinderGeometry(9, 9, 25, 8);
    const bsMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    blacksmithNPC = new THREE.Mesh(bsGeo, bsMat);
    blacksmithNPC.position.set(hx - 100, 12.5, hy + 100);
    scene.add(blacksmithNPC);
    
    // NPC collision
    obstacles.push({ x: hx - 100, y: hy - 100, r: 10 });
    obstacles.push({ x: hx + 100, y: hy - 100, r: 10 });
    obstacles.push({ x: hx - 100, y: hy + 100, r: 10 });
    
    // Portal in the Wilds (at Altar position)
    wildsPortal = new THREE.Mesh(portalGeo, new THREE.MeshLambertMaterial({ color: 0xff00ff, wireframe: true }));
    wildsPortal.position.set(mapSize/2, 30, mapSize/2 + 60);
    scene.add(wildsPortal);
};
function checkItems() {
  crystalItems.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < 28) {
      item.taken = true;
      item.mesh.visible = false;
      crystalCount++;
      playSound('coin');
      document.getElementById("message").textContent = `💎 Crystal ditemukan! ${crystalCount}/${crystalGoal}`;

      if (crystalCount === crystalGoal) {
        // Trigger Boss!
        spawnBoss();
      }
    }
  });

  coinItems.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < 25) {
      item.taken = true;
      item.mesh.visible = false;
      gold++;
      playSound('coin');
    }
  });

  expOrbs.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < player.r + 15) {
      item.taken = true;
      item.mesh.visible = false;
      player.exp += 10;
      playSound('coin');
      if (player.exp >= player.nextExp && typeof levelUp === 'function') {
          levelUp();
      }
    }
  });

  potionItems.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < player.r + 15) {
      if (potions < 3) {
          item.taken = true;
          item.mesh.visible = false;
          potions++;
          playSound('coin');
          const btn = document.getElementById("btn-potion");
          if (btn) btn.textContent = `🧪 Heal (C) [${potions}]`;
      }
    }
  });
}

let uiThrottle = 0;
let lastHp = -1, lastGold = -1, lastCrystal = -1;

function updateUI() {
  checkItems(); // Logika ambil barang tetap jalan 60 fps
  
  uiThrottle++;
  if (uiThrottle % 6 !== 0) return; // Render minimap & tulisan hanya 10 FPS (60/6) agar ringan

  let curHp = Math.ceil(player.hp);
  if (lastHp !== curHp) {
      document.getElementById("hp").textContent = `${curHp}/${player.maxHp}`;
      lastHp = curHp;
  }
  
  if (lastGold !== gold) {
      document.getElementById("gold").textContent = gold;
      lastGold = gold;
  }
  
  if (lastCrystal !== crystalCount) {
      document.getElementById("crystal").textContent = `${crystalCount}/${crystalGoal}`;
      lastCrystal = crystalCount;
  }
  
  const expEl = document.getElementById("exp");
  const maxExpEl = document.getElementById("max-exp");
  const levelEl = document.getElementById("player-level");
  if (expEl) expEl.textContent = player.exp;
  if (maxExpEl) maxExpEl.textContent = player.nextExp;
  if (levelEl) levelEl.textContent = player.level;
  
  const btnDash = document.getElementById("btn-dash");
  if (btnDash) {
     if (player.dashCooldown > 0) {
        btnDash.style.opacity = 0.4;
        btnDash.textContent = `⏳ ${(player.dashCooldown / 60).toFixed(1)}s`;
     } else {
        btnDash.style.opacity = 1.0;
        btnDash.textContent = `⚡ Dash (Z)`;
     }
  }

  const btnSpin = document.getElementById("btn-spin");
  if (btnSpin) {
     if (player.spinCooldown > 0) {
        btnSpin.style.opacity = 0.4;
        btnSpin.textContent = `⏳ ${(player.spinCooldown / 60).toFixed(1)}s`;
     } else {
        btnSpin.style.opacity = 1.0;
        btnSpin.textContent = `🌀 Spin (X)`;
     }
  }
  
  drawMinimap();
}

function drawMinimap() {
  const mm = document.getElementById("minimap");
  if (!mm) return;
  const ctx = mm.getContext("2d");
  
  // Bersihkan minimap
  ctx.clearRect(0, 0, 150, 150);
  
  // Skala peta ke minimap (4000x4000 ke 150x150)
  const scale = 150 / mapSize;
  
  // Altar (Kuning)
  ctx.fillStyle = "yellow";
  ctx.fillRect((mapSize/2)*scale - 3, (mapSize/2)*scale - 3, 6, 6);
  
  // Crystal (Cyan)
  ctx.fillStyle = "cyan";
  crystalItems.forEach(c => {
    if (!c.taken) ctx.fillRect(c.x*scale - 1, c.y*scale - 1, 2, 2);
  });
  
  // Musuh (Merah)
  ctx.fillStyle = "red";
  enemies.forEach(e => {
    ctx.fillRect(e.x*scale - 1, e.y*scale - 1, 3, 3);
  });
  if (bossActive) {
    ctx.fillStyle = "purple";
    ctx.fillRect(bossX*scale - 4, bossY*scale - 4, 8, 8);
  }
  
  // Pemain (Putih)
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(player.x*scale, player.y*scale, 3, 0, Math.PI*2);
  ctx.fill();
}

function checkInteractions() {
  if (shopCooldown > 0) shopCooldown--;
  
  if (typeof hometownPortal !== 'undefined' && hometownPortal) hometownPortal.rotation.y += 0.05;
  if (typeof wildsPortal !== 'undefined' && wildsPortal) wildsPortal.rotation.y += 0.05;

  let interactText = "";
  
  if (currentScene === 'hometown') {
      let distShop = Math.hypot(player.x - shopNPC.position.x, player.y - shopNPC.position.z);
      if (distShop < 50) {
          interactText = "Tekan [F] untuk Upgrade";
          if (keys["f"] && !shopOpen && shopCooldown === 0) {
              openShop();
          }
      }
      
      let distHeal = Math.hypot(player.x - healerNPC.position.x, player.y - healerNPC.position.z);
      if (distHeal < 50) {
          interactText = "Tekan [F] memulihkan HP (10 Gold)";
          if (keys["f"] && shopCooldown === 0) {
              shopCooldown = 30; 
              if (gold >= 10 && player.hp < player.maxHp) {
                  gold -= 10;
                  player.hp = player.maxHp;
                  playSound('coin');
                  updateUI();
              }
          }
      }
      
      let distPortal = Math.hypot(player.x - hometownPortal.position.x, player.y - hometownPortal.position.z);
      if (distPortal < 50) {
          interactText = "Tekan [F] masuk ke The Wilds";
          if (keys["f"] && shopCooldown === 0) {
              shopCooldown = 60;
              if (typeof teleportTo === 'function') teleportTo('wilds');
          }
      }
      
      if (typeof blacksmithNPC !== 'undefined' && blacksmithNPC) {
          let distBS = Math.hypot(player.x - blacksmithNPC.position.x, player.y - blacksmithNPC.position.z);
          if (distBS < 50) {
              interactText = "Tekan [F] Beli Equipment";
              if (keys["f"] && !blacksmithOpen && shopCooldown === 0) {
                  openBlacksmith();
              }
          }
      }
  } else {
      if (typeof wildsPortal !== 'undefined' && wildsPortal) {
          let distPortal = Math.hypot(player.x - wildsPortal.position.x, player.y - wildsPortal.position.z);
          if (distPortal < 50) {
              interactText = "Tekan [F] pulang ke Kota";
              if (keys["f"] && shopCooldown === 0) {
                  shopCooldown = 60;
                  if (typeof teleportTo === 'function') teleportTo('hometown');
              }
          }
      }
  }
  
  const msgEl = document.getElementById("message");
  if (msgEl) {
      if (interactText !== "") {
          msgEl.textContent = interactText;
      } else if (msgEl.textContent.startsWith("Tekan [F]")) {
          msgEl.textContent = "";
      }
  }
}

window.openShop = function() {
  shopOpen = true;
  isPaused = true;
  document.getElementById('shop').style.display = 'flex';
  document.getElementById('shop-gold').textContent = gold;
};

window.closeShop = function() {
  document.getElementById('shop').style.display = 'none';
  shopOpen = false;
  isPaused = false;
  shopCooldown = 30;
};

window.openBlacksmith = function() {
  blacksmithOpen = true;
  isPaused = true;
  document.getElementById('blacksmith').style.display = 'flex';
  updateBlacksmithUI();
};

window.closeBlacksmith = function() {
  document.getElementById('blacksmith').style.display = 'none';
  blacksmithOpen = false;
  isPaused = false;
  shopCooldown = 30;
};

window.updateBlacksmithUI = function() {
  document.getElementById('blacksmith-gold').textContent = gold;
  
  let wNext = weaponList[currentWeapon + 1];
  if (wNext) {
      document.getElementById('weapon-desc').textContent = `${wNext.name} (DMG +${wNext.damage})`;
      document.getElementById('weapon-cost').textContent = wNext.cost;
      document.getElementById('btn-buy-weapon').disabled = false;
      document.getElementById('btn-buy-weapon').textContent = "Tempa Senjata";
  } else {
      document.getElementById('weapon-desc').textContent = "Max Level";
      document.getElementById('weapon-cost').textContent = "-";
      document.getElementById('btn-buy-weapon').disabled = true;
      document.getElementById('btn-buy-weapon').textContent = "Max Level";
  }
  
  let aNext = armorList[currentArmor + 1];
  if (aNext) {
      document.getElementById('armor-desc').textContent = `${aNext.name} (HP +${aNext.hp})`;
      document.getElementById('armor-cost').textContent = aNext.cost;
      document.getElementById('btn-buy-armor').disabled = false;
      document.getElementById('btn-buy-armor').textContent = "Tempa Armor";
  } else {
      document.getElementById('armor-desc').textContent = "Max Level";
      document.getElementById('armor-cost').textContent = "-";
      document.getElementById('btn-buy-armor').disabled = true;
      document.getElementById('btn-buy-armor').textContent = "Max Level";
  }
};

window.buyWeapon = function() {
  let wNext = weaponList[currentWeapon + 1];
  if (wNext && gold >= wNext.cost) {
      gold -= wNext.cost;
      currentWeapon++;
      player.attackDamage += wNext.damage - weaponList[currentWeapon - 1].damage;
      
      // Ganti warna pedang
      if (typeof playerBladeMat !== 'undefined') {
          playerBladeMat.color.setHex(wNext.color);
      }
      playSound('coin');
      updateBlacksmithUI();
      updateUI();
  }
};

window.buyArmor = function() {
  let aNext = armorList[currentArmor + 1];
  if (aNext && gold >= aNext.cost) {
      gold -= aNext.cost;
      currentArmor++;
      let hpDiff = aNext.hp - armorList[currentArmor - 1].hp;
      player.maxHp += hpDiff;
      player.hp += hpDiff; // Heal instantly by the max hp diff
      
      // Ganti warna armor badan
      if (typeof playerBodyMat !== 'undefined') {
          playerBodyMat.color.setHex(aNext.color);
      }
      playSound('coin');
      updateBlacksmithUI();
      updateUI();
  }
};

window.buyUpgrade = function(type) {
  if (type === 'hp' && gold >= 15) {
    gold -= 15;
    player.maxHp += 20;
    player.hp = player.maxHp;
    upgrades.hpLevel++;
    document.getElementById('shop-hp-level').textContent = "Lv " + upgrades.hpLevel;
  } else if (type === 'atk' && gold >= 20) {
    gold -= 20;
    player.attackDamage += 1;
    upgrades.atkLevel++;
    document.getElementById('shop-atk-level').textContent = "Lv " + upgrades.atkLevel;
  } else if (type === 'spd' && gold >= 15) {
    gold -= 15;
    player.speed += 1;
    upgrades.spdLevel++;
    document.getElementById('shop-spd-level').textContent = "Lv " + upgrades.spdLevel;
  }
  document.getElementById('shop-gold').textContent = gold;
  updateUI();
};

window.levelUp = function() {
    player.level++;
    player.exp -= player.nextExp;
    player.nextExp = Math.floor(player.nextExp * 1.5);
    player.maxHp += 20;
    player.hp = player.maxHp;
    player.attackDamage += 0.5;
    
    playSound('boss_spawn'); 
    if (typeof spawnParticles === 'function') spawnParticles(player.x, player.y, 0xffff00, 50, 'levelup');
    
    const modal = document.getElementById("level-up-modal");
    if (modal) {
        modal.querySelector("p").textContent = `Level ${player.level}! Max HP & Attack Meningkat!`;
        modal.style.display = "flex";
        setTimeout(() => modal.style.display = "none", 3000);
    }
};
window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift", "z", "x", "c"].includes(key)) {
    e.preventDefault();
  }
  if (key === "escape" && typeof togglePause === 'function') {
      togglePause();
  }
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

function move() {
  if (gameOver || isPaused || typeof isGameStarted === 'undefined' || !isGameStarted) return;

  let dx = 0, dy = 0;
  if (keys.arrowup) dy -= 1;
  if (keys.arrowdown) dy += 1;
  if (keys.arrowleft) dx -= 1;
  if (keys.arrowright) dx += 1;

  if (dx !== 0 || dy !== 0) {
    // Normalisasi arah agar serong (diagonal) tidak lebih cepat dari lurus
    let length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    
    player.facingX = dx;
    player.facingY = dy;
    
    if (keys.c) {
       keys.c = false;
       usePotion();
    }
    
    if (keys.z && player.dashCooldown <= 0) {
       player.dashCooldown = 180;
       player.isDashing = 15;
       playSound('dash');
       if (typeof spawnParticles === 'function') {
           spawnParticles(player.x, player.y, 0xaaaaaa, 5, 'dust');
       }
    }
    if (keys.x && player.spinCooldown <= 0) {
       player.spinCooldown = 300;
       player.isSpinning = 30;
       playSound('spin');
       for (let i = enemies.length - 1; i >= 0; i--) {
          let e = enemies[i];
          if (Math.hypot(e.x - player.x, e.y - player.y) < player.r + e.r + 50) {
             e.hp -= player.attackDamage * 3;
             e.slowTimer = 90;
             if (e.hp <= 0) {
                scene.remove(e.mesh);
                scene.remove(e.hpGroup);
                enemies.splice(i, 1);
                gold += 5;
                playSound('hit');
                if (typeof spawnParticles === 'function') spawnParticles(e.x, e.y, 0xff0000, 20, 'death');
                
                 let expGeo = new THREE.DodecahedronGeometry(5, 0);
                 let expMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
                 let expMesh = new THREE.Mesh(expGeo, expMat);
                 expMesh.position.set(e.x, 10, e.y);
                 scene.add(expMesh);
                 expOrbs.push({ x: e.x, y: e.y, mesh: expMesh, taken: false });
                 
                 if (Math.random() < 0.15) {
                     let potGeo = new THREE.CylinderGeometry(3, 3, 8, 8);
                     let potMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
                     let potMesh = new THREE.Mesh(potGeo, potMat);
                     potMesh.position.set(e.x + 10, 10, e.y + 10);
                     scene.add(potMesh);
                     potionItems.push({ x: e.x + 10, y: e.y + 10, mesh: potMesh, taken: false });
                 }
             } else {
                 if (typeof spawnParticles === 'function') spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
             }
          }
       }
       if (bossActive && Math.hypot(bossX - player.x, bossY - player.y) < player.r + 60 + 50) {
           bossHp -= player.attackDamage * 3;
           playSound('hit');
       }
    }

    let currentSpeed = player.defending ? player.speed * 0.4 : player.speed;
    if (player.isDashing > 0) {
       currentSpeed *= 3.5;
       player.isDashing--;
    }
    
    let nx = player.x + dx * currentSpeed;
    let ny = player.y + dy * currentSpeed;

    if (!blocked(nx, player.y)) player.x = nx;
    if (!blocked(player.x, ny)) player.y = ny;

    // Animasi Jalan
    player.walkCycle += currentSpeed * 0.08;
    if (player.leftHip && player.rightHip) {
       player.leftHip.rotation.z = Math.sin(player.walkCycle) * 0.6;
       player.rightHip.rotation.z = Math.sin(player.walkCycle + Math.PI) * 0.6;
    } else if (window.gltfPlayerRef) {
       // Lazy load bones (agar jalan saat HMR tanpa refresh)
       if (!window.playerLegL) window.playerLegL = window.gltfPlayerRef.getObjectByName('leg-left');
       if (!window.playerLegR) window.playerLegR = window.gltfPlayerRef.getObjectByName('leg-right');
       if (!window.playerArmL) window.playerArmL = window.gltfPlayerRef.getObjectByName('arm-left');
       if (!window.playerArmR) window.playerArmR = window.gltfPlayerRef.getObjectByName('arm-right');

       // Animasi lari natural untuk GLTF (Anggota tubuh berayun)
       window.gltfPlayerRef.position.y = -15 + Math.abs(Math.sin(player.walkCycle * 2)) * 1.5; // Lompatan kecil
       window.gltfPlayerRef.rotation.z = 0; // Hapus wobble
       window.gltfPlayerRef.rotation.x = 0;
       window.gltfPlayerRef.rotation.y = Math.PI / 2; // HMR Fix Orientasi Wajah
       
       let swing = Math.sin(player.walkCycle) * 0.8;
       // Karena karakter Kenney menghadap ke Z, putaran ayunan ada di sumbu X
       if (window.playerLegL) window.playerLegL.rotation.x = swing;
       if (window.playerLegR) window.playerLegR.rotation.x = -swing;
       if (window.playerArmL) window.playerArmL.rotation.x = -swing; // Tangan berlawanan arah kaki
       if (window.playerArmR) window.playerArmR.rotation.x = swing;
    }
  } else {
    // Berdiri tegak jika tidak berjalan
    player.walkCycle = 0;
    if (player.leftHip && player.rightHip) {
       player.leftHip.rotation.z = 0;
       player.rightHip.rotation.z = 0;
    } else if (window.gltfPlayerRef) {
       window.gltfPlayerRef.position.y = -15;
       window.gltfPlayerRef.rotation.z = 0;
       window.gltfPlayerRef.rotation.x = 0;
       window.gltfPlayerRef.rotation.y = Math.PI / 2; // HMR Fix Orientasi Wajah
       
       if (window.playerLegL) window.playerLegL.rotation.x = 0;
       if (window.playerLegR) window.playerLegR.rotation.x = 0;
       if (window.playerArmL) window.playerArmL.rotation.x = 0;
       if (window.playerArmR) window.playerArmR.rotation.x = 0;
    }
  }
  updateUI();
}

const projGeo = new THREE.SphereGeometry(6, 8, 8);
const projMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

function shoot() {
  if (player.attackCooldown > 0 || gameOver || isPaused || !isGameStarted) return;
  player.attackCooldown = 15; 
  playSound('shoot');
  
  const mesh = new THREE.Mesh(projGeo, projMat);
  mesh.position.set(player.x, 15, player.y);
  scene.add(mesh);
  
  projectiles.push({
    x: player.x,
    y: player.y,
    dx: player.facingX * 10,
    dy: player.facingY * 10,
    mesh: mesh
  });
}

window.usePotion = function() {
  if (potions > 0 && player.hp < player.maxHp) {
      potions--;
      player.hp = Math.min(player.maxHp, player.hp + 40);
      playSound('coin'); 
      if (typeof spawnParticles === 'function') {
          spawnParticles(player.x, player.y, 0x00ff00, 10, 'heal');
      }
      const btn = document.getElementById("btn-potion");
      if (btn) btn.textContent = `🧪 Heal (C) [${potions}]`;
  }
};
function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.mesh.position.set(p.x, 15, p.y);

    if (blocked(p.x, p.y, 6)) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }
    
    let hit = false;
    
    if (p.isEnemy) {
       if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 10) {
          hit = true;
          if (!player.defending) {
             player.hp -= 15; // Damage bos
             updateUI();
             playSound('hit');
             if (player.hp <= 0) {
                gameOver = true;
                document.getElementById("message").textContent = "💀 Tembakan Bos mengakhiri petualanganmu!";
                document.getElementById("lose").style.display = "flex";
             }
          }
       }
    } else {
       for (let j = enemies.length - 1; j >= 0; j--) {
         let e = enemies[j];
         if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 6) {
           e.hp -= player.attackDamage;
           e.slowTimer = 90;
           hit = true;
           playSound('hit');
           if (e.hp <= 0) {
             scene.remove(e.mesh);
             scene.remove(e.hpGroup);
             enemies.splice(j, 1);
             gold += 5;
             if (typeof spawnParticles === 'function') spawnParticles(e.x, e.y, 0xff0000, 20, 'death');
             
             let expGeo = new THREE.DodecahedronGeometry(5, 0);
             let expMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
             let expMesh = new THREE.Mesh(expGeo, expMat);
             expMesh.position.set(e.x, 10, e.y);
             scene.add(expMesh);
             expOrbs.push({ x: e.x, y: e.y, mesh: expMesh, taken: false });
             
             if (Math.random() < 0.15) {
                 let potGeo = new THREE.CylinderGeometry(3, 3, 8, 8);
                 let potMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
                 let potMesh = new THREE.Mesh(potGeo, potMat);
                 potMesh.position.set(e.x + 10, 10, e.y + 10);
                 scene.add(potMesh);
                 potionItems.push({ x: e.x + 10, y: e.y + 10, mesh: potMesh, taken: false });
             }
           } else {
               if (typeof spawnParticles === 'function') spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
           }
           break;
         }
       }
       
       if (!hit && bossActive) {
          if (Math.hypot(p.x - bossX, p.y - bossY) < 30 + 6) {
             bossHp -= player.attackDamage;
             hit = true;
             playSound('hit');
          }
       }
    }
    
    if (hit) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

let spawnTimer = 0;

function updateEnemies() {
  if (currentScene === 'hometown') return;
  
  if (typeof isGameStarted !== 'undefined' && isGameStarted && !bossActive) {
      spawnTimer++;
      let spawnRate = Math.max(60, 180 - (player.level * 10)); 
      let maxEnemies = Math.min(60, 20 + (player.level * 5)); 
      if (spawnTimer > spawnRate && enemies.length < maxEnemies) {
          spawnTimer = 0;
          if (typeof spawnEnemy === 'function') {
              let edgeX = player.x + (Math.random() < 0.5 ? 800 : -800);
              let edgeY = player.y + (Math.random() < 0.5 ? 800 : -800);
              edgeX = Math.max(50, Math.min(mapSize - 50, edgeX));
              edgeY = Math.max(50, Math.min(mapSize - 50, edgeY));
              spawnEnemy(edgeX, edgeY);
          }
      }
  }

  for (let index = enemies.length - 1; index >= 0; index--) {
    let enemy = enemies[index];
    let distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);

    if (enemy.stunTimer > 0) {
       enemy.stunTimer--;
    } else {
       let currentBase = enemy.baseSpeed;
       let speed = (enemy.slowTimer > 0) ? currentBase * 0.4 : currentBase; 
       if (enemy.slowTimer > 0) enemy.slowTimer--;

       if (distToPlayer < 400) {
         let angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
         
         if (enemy.type === 'archer') {
             if (distToPlayer > 180) {
                 enemy.dx = Math.cos(angle) * speed;
                 enemy.dy = Math.sin(angle) * speed;
             } else {
                 enemy.dx = 0;
                 enemy.dy = 0;
             }
             if (enemy.attackTimer === undefined) enemy.attackTimer = 0;
             enemy.attackTimer++;
             if (enemy.attackTimer > 120 && distToPlayer < 250) {
                 enemy.attackTimer = 0;
                 let projGeo = new THREE.SphereGeometry(4, 4, 4);
                 let projMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                 let m = new THREE.Mesh(projGeo, projMat);
                 m.position.set(enemy.x, 10, enemy.y);
                 scene.add(m);
                 projectiles.push({
                     x: enemy.x, y: enemy.y,
                     dx: Math.cos(angle) * 8, dy: Math.sin(angle) * 8,
                     mesh: m, isEnemy: true
                 });
                 playSound('shoot');
             }
         } else {
             enemy.dx = Math.cos(angle) * speed;
             enemy.dy = Math.sin(angle) * speed;
         }
       } else {
         let spd = Math.hypot(enemy.dx, enemy.dy);
         if (spd !== speed && spd !== 0) {
            enemy.dx = (enemy.dx / spd) * speed;
            enemy.dy = (enemy.dy / spd) * speed;
         }
       }
    }

    let nx = enemy.x + enemy.dx * 1.5;
    let ny = enemy.y + enemy.dy * 1.5;

    if (enemy.type === 'ghost') {
        enemy.x = nx;
        enemy.y = ny;
    } else {
        if (blocked(nx, ny, enemy.r)) {
          if (!blocked(nx, enemy.y, enemy.r)) {
            enemy.x = nx;
          } else if (!blocked(enemy.x, ny, enemy.r)) {
            enemy.y = ny;
          } else {
            if (distToPlayer >= 350) {
              enemy.dx *= -1;
              enemy.dy *= -1;
            }
          }
        } else {
          enemy.x = nx;
          enemy.y = ny;
        }
    }
    
    enemy.mesh.position.set(enemy.x, enemy.meshY, enemy.y);
    
    if (enemy.baseSpeed < 1.0) {
       enemy.mesh.rotation.y += 0.02;
    } else {
       enemy.mesh.rotation.x += 0.05;
       enemy.mesh.rotation.y += 0.05;
    }

    enemy.hpGroup.position.set(enemy.x, enemy.meshY + 23, enemy.y);
    enemy.hpGroup.lookAt(camera.position);
    
    let hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.hpFg.scale.x = Math.max(0.001, hpPercent); 
    enemy.hpFg.position.x = -(24 - (24 * hpPercent)) / 2;

    if (distToPlayer < player.r + enemy.r && enemy.hp > 0) {
      if (enemy.type === 'kamikaze') {
          if (typeof spawnParticles === 'function') spawnParticles(enemy.x, enemy.y, 0xff8800, 50, 'death');
          playSound('hit');
          player.hp = Math.max(0, player.hp - 20); 
          updateUI();
          enemy.hp = 0;
          scene.remove(enemy.mesh);
          scene.remove(enemy.hpGroup);
          enemies.splice(index, 1);
          if (player.hp <= 0) {
              player.hp = player.maxHp;
              gold = Math.max(0, Math.floor(gold / 2));
              if (typeof teleportTo === 'function') teleportTo('hometown');
              document.getElementById("message").textContent = "💀 Anda pingsan! Terlempar kembali ke Kota.";
          }
      } else if (player.defending) {
        let angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        enemy.dx = Math.cos(angle) * 5;
        enemy.dy = Math.sin(angle) * 5;
        enemy.stunTimer = 15;
      } else {
        let damage = 0.3; 
        player.hp = Math.max(0, player.hp - damage);
        updateUI();

        if (player.hp <= 0) {
            player.hp = player.maxHp;
            gold = Math.max(0, Math.floor(gold / 2));
            if (typeof teleportTo === 'function') teleportTo('hometown');
            document.getElementById("message").textContent = "💀 Anda pingsan! Terlempar kembali ke Kota.";
        }
      }
    }
  }
}

window.updateBoss = function() {
  if (!bossActive || !bossMesh) return;
  
  let dist = Math.hypot(player.x - bossX, player.y - bossY);
  let angle = Math.atan2(player.y - bossY, player.x - bossX);
  
  if (dist > 80) {
    bossX += Math.cos(angle) * 1.5;
    bossY += Math.sin(angle) * 1.5;
  }
  
  bossMesh.position.set(bossX, 30, bossY);
  bossMesh.rotation.y += 0.02;
  bossMesh.rotation.x = Math.sin(Date.now() / 300) * 0.2;
  
  bossHpGroup.position.set(bossX, 80, bossY);
  bossHpGroup.lookAt(camera.position);
  let pct = Math.max(0, bossHp / bossMaxHp);
  bossHpFg.scale.x = Math.max(0.001, pct);
  bossHpFg.position.x = -(80 - (80 * pct)) / 2;
  
  if (Math.random() < 0.05) { 
     let bossProjGeo = new THREE.SphereGeometry(10, 8, 8);
     let bossProjMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
     let m = new THREE.Mesh(bossProjGeo, bossProjMat);
     m.position.set(bossX, 30, bossY);
     scene.add(m);
     
     let pAngle = angle + (Math.random() - 0.5);
     projectiles.push({
        x: bossX, y: bossY,
        dx: Math.cos(pAngle) * 8,
        dy: Math.sin(pAngle) * 8,
        mesh: m,
        isEnemy: true
     });
     playSound('shoot'); 
  }
  
  if (dist < player.r + 30) {
      if (!player.defending) {
          player.hp -= 1.0;
          updateUI();
          if (player.hp <= 0) {
             gameOver = true;
             document.getElementById("message").textContent = "💀 Kamu dihancurkan The Golden Golem!";
             document.getElementById("lose").style.display = "flex";
          }
      } else {
          bossX -= Math.cos(angle) * 10;
          bossY -= Math.sin(angle) * 10;
      }
  }
  
  if (bossHp <= 0) {
      scene.remove(bossMesh);
      scene.remove(bossHpGroup);
      bossActive = false;
      gameOver = true;
      playSound('coin');
      if (typeof spawnParticles === 'function') spawnParticles(bossX, bossY, 0xffd700, 100, 'death');
      document.getElementById("win").style.display = "flex";
      document.getElementById("message").textContent = "👑 The Golden Golem telah dikalahkan!";
  }
};
function gameLoop() {
  if (!isGameStarted) return;
  requestAnimationFrame(gameLoop);

  if (!gameOver) {
    if (isPaused) {
      if(window.composer) window.composer.render(); else renderer.render(scene, camera);
      return;
    }

    player.defending = !!keys["shift"];
    shieldMesh.visible = player.defending;

    move(); // Menangani semua arah gerakan termasuk serong
    if (keys[" "]) shoot();

    if (player.attackCooldown > 0) player.attackCooldown--;
    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.spinCooldown > 0) player.spinCooldown--;

    if (player.isSpinning > 0) {
       player.isSpinning--;
       playerMesh.rotation.y += 0.5;
    }

    updateProjectiles();
    updateEnemies();
    if (bossActive) updateBoss();
    if (typeof checkInteractions === 'function') checkInteractions();
    updateWeather();
    if (typeof updateParticles === 'function') updateParticles();
    if (typeof updatePet === 'function') updatePet();
    updateUI();
  }

  // Render 3D Scene
  playerMesh.position.set(player.x, 15, player.y);
  
  // Membuat karakter menghadap ke arah jalannya (kecuali jika sedang spin)
  if (player.isSpinning === 0 && (player.facingX !== 0 || player.facingY !== 0)) {
    playerMesh.rotation.y = -Math.atan2(player.facingY, player.facingX);
  }

  // Kamera sekarang mengikuti pemain (Lebih dekat!)
  camera.position.x = player.x;
  camera.position.y = 150;
  camera.position.z = player.y + 200;
  camera.lookAt(player.x, 10, player.y);
  
  if (player.defending) {
    shieldMesh.rotation.y += 0.05;
    shieldMesh.rotation.x += 0.02;
  }

  crystalItems.forEach(item => {
    if (!item.taken) item.mesh.rotation.y += 0.05;
  });
  coinItems.forEach(item => {
    if (!item.taken) item.mesh.rotation.z += 0.05;
  });
  expOrbs.forEach(item => {
    if (!item.taken) item.mesh.rotation.y += 0.05;
  });
  potionItems.forEach(item => {
    if (!item.taken) item.mesh.rotation.y += 0.05;
  });

  if(window.composer) window.composer.render(); else renderer.render(scene, camera);
}

function updateWeather() {
  if (bossActive) {
     dayTime = 0.8; // Force storm
  } else {
     dayTime += 0.0001;
     if (dayTime > 1) dayTime = 0;
  }

  let lightIntensity = 0.8;
  let r = 45, g = 79, b = 48; // 0x2d4f30 (siang)
  
  if (dayTime > 0.4) {
     let nightFactor = Math.sin((dayTime - 0.4) * Math.PI * (1/0.6));
     if (nightFactor < 0) nightFactor = 0;
     lightIntensity = 0.8 - (nightFactor * 0.6); 
     r -= nightFactor * 35;
     g -= nightFactor * 59;
     b += nightFactor * 20;
  }
  if (bossActive) {
     r = 80; g = 10; b = 10; // Blood moon
     lightIntensity = 0.3;
  }

  dirLight.intensity = lightIntensity;
  scene.background.setRGB(r/255, g/255, b/255);
  scene.fog.color.setRGB(r/255, g/255, b/255);

  if (bossActive || (dayTime > 0.6 && dayTime < 0.9)) {
     rainParticles.material.opacity = 0.6;
     const positions = rainParticles.geometry.attributes.position.array;
     for (let i = 0; i < 1500; i++) {
        positions[i * 3 + 1] -= 15; 
        if (positions[i * 3 + 1] < 0) {
           positions[i * 3 + 1] = 500;
        }
     }
     rainParticles.geometry.attributes.position.needsUpdate = true;
     rainParticles.position.x = player.x;
     rainParticles.position.z = player.y;
  } else {
     rainParticles.material.opacity = 0;
  }
}

// Mulai Game Loop Utama dipindah ke init.js

window.updateParticles = function() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= p.decay;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
            continue;
        }
        p.mesh.position.x += p.dx;
        p.mesh.position.y += p.dz;
        p.mesh.position.z += p.dy;
        p.mesh.material.opacity = p.life;
        p.mesh.scale.setScalar(p.life);
    }
};

let petAngle = 0;
window.updatePet = function() {
    if (!petActive || !petMesh) return;
    petAngle += 0.05;
    
    let targetX = player.x + Math.cos(petAngle) * 20;
    let targetZ = player.y + Math.sin(petAngle) * 20;
    let targetY = 25 + Math.sin(petAngle * 2) * 5;
    
    petMesh.position.x += (targetX - petMesh.position.x) * 0.1;
    petMesh.position.y += (targetY - petMesh.position.y) * 0.1;
    petMesh.position.z += (targetZ - petMesh.position.z) * 0.1;
    petMesh.rotation.y += 0.1;
    
    if (Math.random() < 0.02) {
        let closest = null;
        let minDist = 200;
        enemies.forEach(e => {
            let d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d < minDist) { minDist = d; closest = e; }
        });
        if (closest) {
            let angle = Math.atan2(closest.y - petMesh.position.z, closest.x - petMesh.position.x);
            let pGeo = new THREE.SphereGeometry(3, 4, 4);
            let pMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
            let m = new THREE.Mesh(pGeo, pMat);
            m.position.copy(petMesh.position);
            scene.add(m);
            projectiles.push({
                x: m.position.x, y: m.position.z,
                dx: Math.cos(angle) * 15, dy: Math.sin(angle) * 15,
                mesh: m, isPet: true
            });
            playSound('shoot');
        }
    }
};

window.teleportTo = function(sceneName) {
    currentScene = sceneName;
    if (sceneName === 'wilds') {
        player.x = 2000;
        player.y = 2100;
        enemies.forEach(e => {
            scene.remove(e.mesh);
            scene.remove(e.hpGroup);
        });
        enemies.length = 0; 
        
        // Spawn batch awal musuh
        let initialSpawns = Math.min(30, 10 + player.level * 2);
        for(let i=0; i<initialSpawns; i++) {
            if (typeof spawnEnemy === 'function') spawnEnemy();
        }
        
        document.getElementById("message").textContent = "Merasuki The Wilds...";
    } else {
        player.x = 10000;
        player.y = 10080;
        document.getElementById("message").textContent = "Kembali ke Safe Haven.";
    }
    playSound('coin'); 
};
window.onload = () => {
    // Tampilkan Main Menu
    document.getElementById("main-menu").style.display = "flex";
};

window.startGame = async () => {
    await window.loadAllModels();
    if (isGameStarted) return;
    isGameStarted = true;
    document.getElementById("main-menu").style.display = "none";
    
    initSetup();
    initHometown();
    initMap();
    initEntities();
    initNPCs();
    
    // Play BGM
    playSound('bgm');
    window.bgmStarted = true;
    
    gameLoop();
};

window.togglePause = () => {
    if (!isGameStarted || gameOver) return;
    isPaused = !isPaused;
    document.getElementById("pause-menu").style.display = isPaused ? "flex" : "none";
    if (!isPaused) {
       // Melanjutkan putaran jika di-unpause
       gameLoop();
    }
};

// --- SISTEM SAVE / LOAD (BACKEND SQLITE) ---
window.saveGame = function() {
  const statusEl = document.getElementById('save-status');
  if(!statusEl) return;
  statusEl.textContent = "Menyimpan...";
  statusEl.style.color = "#f39c12";

  const data = {
    x: player.x,
    y: player.y,
    hp: player.hp,
    maxHp: player.maxHp,
    attackDamage: player.attackDamage,
    gold: gold,
    potions: potions,
    crystalCount: crystalCount,
    currentWeapon: currentWeapon,
    currentArmor: currentArmor,
    level: player.level,
    exp: player.exp,
    nextExp: player.nextExp
  };

  fetch('http://localhost:3001/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(resData => {
    statusEl.textContent = "Tersimpan ✅";
    statusEl.style.color = "#2ecc71";
    setTimeout(() => { statusEl.textContent = ""; }, 3000);
  })
  .catch(err => {
    statusEl.textContent = "Gagal ❌";
    statusEl.style.color = "#e74c3c";
    console.error(err);
  });
};

window.loadGame = function() {
  fetch('http://localhost:3001/api/load')
  .then(res => res.json())
  .then(res => {
    if (res.success && res.data) {
      const d = res.data;
      player.x = d.player_x;
      player.y = d.player_y;
      player.hp = d.hp;
      player.maxHp = d.maxHp;
      player.attackDamage = d.attackDamage;
      player.level = d.level;
      player.exp = d.exp;
      player.nextExp = d.nextExp;
      window.gold = d.gold;
      window.potions = d.potions;
      window.crystalCount = d.crystalCount;
      window.currentWeapon = d.currentWeapon;
      window.currentArmor = d.currentArmor;

      // Update warna equipment jika load berhasil dan mesh tersedia
      if (typeof playerBladeMat !== 'undefined' && weaponList[currentWeapon]) {
          playerBladeMat.color.setHex(weaponList[currentWeapon].color);
      }
      if (typeof playerBodyMat !== 'undefined' && armorList[currentArmor]) {
          playerBodyMat.color.setHex(armorList[currentArmor].color);
      }

      console.log("✅ Progres termuat dari Database!", d);
      updateUI();
    }
  })
  .catch(err => console.log("Belum ada save data atau Server Backend mati:", err));
};

// Panggil loadGame pada saat script pertama kali jalan
window.loadGame();
