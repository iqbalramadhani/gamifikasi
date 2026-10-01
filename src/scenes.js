import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';
import { mapSize } from './constants.js';
import { loadedModels } from './model-loader.js';
import { spawnEnemy } from './combat.js';
import { scatterInteractables } from './landmarks.js';

export function getTerrainHeight(x, y) {
  // Area kota (Hometown) harus sepenuhnya datar
  if (x < 2000 && y < 2000) return 0;

  const distFromCenter = Math.hypot(x - mapSize / 2, y - mapSize / 2);
  if (distFromCenter <= 300) return 0; // Area altar datar
  const distanceFactor = Math.min(1, (distFromCenter - 300) / 200);
  const wave = Math.sin(x * 0.003) * Math.cos(y * 0.003) * 30;
  const noise = Math.sin(x * 0.005) * Math.sin(y * 0.005) * 15;
  return (wave + noise) * distanceFactor;
}

// ─── Initialization helpers ───────────────────────────────────────────────────

/** Create the Three.js scene, camera, renderer, lights, fog, rain, bloom pass. */
export function initSetup() {
  const s = state;

  s.scene = new THREE.Scene();
  s.scene.background = new THREE.Color(0x87CEEB); // Langit biru

  s.camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 3000
  );

  const canvas = document.getElementById('canvas');
  s.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  s.renderer.setSize(window.innerWidth, window.innerHeight);
  s.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  s.renderer.toneMappingExposure = 1.0;
  s.renderer.shadowMap.enabled = true;
  s.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Memperhalus bayangan

  s.composer = new EffectComposer(s.renderer);
  s.composer.addPass(new RenderPass(s.scene, s.camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, 0.4, 0.85
  );
  bloomPass.threshold = 0.4;
  bloomPass.strength = 0.8;
  bloomPass.radius = 0.3;
  // s.composer.addPass(bloomPass); // Dinonaktifkan sesuai permintaan pengguna

  window.addEventListener('resize', () => {
    s.camera.aspect = window.innerWidth / window.innerHeight;
    s.camera.updateProjectionMatrix();
    s.renderer.setSize(window.innerWidth, window.innerHeight);
    s.composer.setSize(window.innerWidth, window.innerHeight);
  });

  // Chase-camera defaults (no OrbitControls)
  s.controls = null;

  const initFacingAngle = Math.atan2(s.player.facingX, s.player.facingY);
  s.camera.position.set(
    s.player.x - Math.sin(initFacingAngle) * s.cameraOffsetZ,
    s.cameraOffsetY,
    s.player.y - Math.cos(initFacingAngle) * s.cameraOffsetZ
  );
  s.camera.lookAt(s.player.x, s.cameraLookAtY, s.player.y);

  // Lighting (Pencahayaan Atmosferik)
  const ambientLight = new THREE.AmbientLight(0xdcebf4, 0.5); // Cahaya ambien biru pucat
  s.scene.add(ambientLight);

  s.dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2); // Matahari sedikit hangat
  s.dirLight.position.set(mapSize / 2 + 800, 1000, mapSize / 2 - 400);
  s.dirLight.castShadow = true;
  s.dirLight.shadow.mapSize.width = 2048; // Resolusi bayangan HD
  s.dirLight.shadow.mapSize.height = 2048;
  s.dirLight.shadow.camera.near = 50;
  s.dirLight.shadow.camera.far = 2500;
  s.dirLight.shadow.camera.left = -3000;
  s.dirLight.shadow.camera.right = 3000;
  s.dirLight.shadow.camera.top = 3000;
  s.dirLight.shadow.camera.bottom = -3000;
  s.dirLight.shadow.bias = -0.001; // Mencegah shadow acne
  s.scene.add(s.dirLight);

  // Generate Procedural Grass Texture
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 512;
  texCanvas.height = 512;
  const ctx = texCanvas.getContext('2d');
  ctx.fillStyle = '#2d4f30'; // Warna dasar hijau gelap
  ctx.fillRect(0, 0, 512, 512);
  for(let i=0; i<15000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#3a663e' : '#1e3820'; // Titik rumput terang & gelap
    ctx.globalAlpha = Math.random() * 0.8 + 0.2;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random()*2, 8 + Math.random()*8);
  }
  const grassTex = new THREE.CanvasTexture(texCanvas);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(mapSize / 150, mapSize / 150);

  // Floor (Terrain Bergelombang)
  const floorGeo = new THREE.PlaneGeometry(mapSize, mapSize, 200, 200);
  const posAttribute = floorGeo.attributes.position;
  
  for (let i = 0; i < posAttribute.count; i++) {
    const vx = posAttribute.getX(i);
    const vy = posAttribute.getY(i);
    const worldX = vx + (mapSize / 2); 
    const worldY = (mapSize / 2) - vy;
    posAttribute.setZ(i, getTerrainHeight(worldX, worldY));
  }
  floorGeo.computeVertexNormals(); // Wajib agar pencahayaan benar setelah vertex diubah

  // Material PBR (Physically Based Rendering)
  const floorMat = new THREE.MeshStandardMaterial({ 
    map: grassTex,
    roughness: 0.9,
    metalness: 0.05
  });
  
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(mapSize / 2, 0, mapSize / 2);
  floor.receiveShadow = true;
  s.scene.add(floor);
  s.mainFloor = floor;

  // Fog menyatu dengan langit
  s.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0002);

  // Rain (starts invisible)
  const rainCount = 5000;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3]     = (Math.random() - 0.5) * mapSize;
    rainPositions[i * 3 + 1] = Math.random() * 500;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * mapSize;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xaaaaaa, size: 1.0, transparent: true, opacity: 0,
  });
  s.rainParticles = new THREE.Points(rainGeo, rainMat);
  s.scene.add(s.rainParticles);
}

// ─── Wilds map generation ──────────────────────────────────────────────────────

export function initMap() {
  const s = state;
  s.wildsGroup = new THREE.Group();
  s.scene.add(s.wildsGroup);

  const ms = mapSize;

  // Altar in the center
  const altarGroup = new THREE.Group();
  const altarBase = new THREE.Mesh(
    new THREE.CylinderGeometry(40, 40, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x555555 })
  );
  altarBase.position.y = 5;
  const altarPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 20, 30, 8),
    new THREE.MeshLambertMaterial({ color: 0x444444 })
  );
  altarPillar.position.y = 20;
  altarGroup.add(altarBase, altarPillar);
  altarGroup.position.set(ms / 2, 0, ms / 2);
  s.wildsGroup.add(altarGroup);
  s.obstaclesWilds.push({ x: ms / 2, y: ms / 2, r: 40, h: 40 });

  // Extra rocks scattered around altar area
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 250 + Math.random() * 400;
    const rx = ms / 2 + Math.cos(angle) * dist;
    const ry = ms / 2 + Math.sin(angle) * dist;
    if (rx < 50 || rx > ms - 50 || ry < 50 || ry > ms - 50) continue;
    if (rx > 200 && rx < 800 && ry > 200 && ry < 800) continue;
    const rr = 10 + Math.random() * 15;
    let rockGroup;
    if (Math.random() < 0.5 && loadedModels.rocks_high)
      rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
    else if (loadedModels.rocks_low)
      rockGroup = SkeletonUtils.clone(loadedModels.rocks_low);
    if (rockGroup) {
      const sc = 20 + Math.random() * 15;
      rockGroup.scale.set(sc, sc, sc);
      rockGroup.position.set(rx, getTerrainHeight(rx, ry), ry);
      rockGroup.rotation.y = Math.random() * Math.PI;
      s.wildsGroup.add(rockGroup);
    } else {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rr, 0),
        new THREE.MeshLambertMaterial({ color: 0x777777 })
      );
      rock.position.set(rx, rr + getTerrainHeight(rx, ry), ry);
      rock.rotation.y = Math.random() * Math.PI;
      s.wildsGroup.add(rock);
    }
    s.obstaclesWilds.push({ x: rx, y: ry, r: rr * 0.8, h: rr });
  }

  // Forest / mountain clusters
  const numClusters = 200;
  for (let c = 0; c < numClusters; c++) {
    let cx = 200 + Math.random() * (ms - 400);
    let cy = 200 + Math.random() * (ms - 400);
    if (Math.hypot(cx - ms / 2, cy - ms / 2) < 500) continue;

    const isRockCluster = Math.random() < 0.3;
    const clusterSize = 15 + Math.floor(Math.random() * 35);

    for (let i = 0; i < clusterSize; i++) {
      const rAngle = Math.random() * Math.PI * 2;
      const rDist = Math.random() * 250;
      const x = cx + Math.cos(rAngle) * rDist;
      const y = cy + Math.sin(rAngle) * rDist;
      if (x < 50 || x > ms - 50 || y < 50 || y > ms - 50) continue;
      if (Math.hypot(x - ms / 2, y - ms / 2) < 450) continue;
      if (x > 200 && x < 800 && y > 200 && y < 800) continue;

      const radius = 15;
      if (s.obstaclesWilds.some(o => Math.hypot(o.x - x, o.y - y) < o.r + radius + 5)) continue;

      const rand = Math.random();
      if (isRockCluster) {
        if (rand < 0.7) {
          const r = 15 + Math.random() * 25;
          let rockGroup;
          if (rand < 0.2 && loadedModels.rocks_high)
            rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
          else if (rand < 0.5 && loadedModels.rocks_low)
            rockGroup = SkeletonUtils.clone(loadedModels.rocks_low);
          else if (loadedModels.stones)
            rockGroup = SkeletonUtils.clone(loadedModels.stones);

          if (rockGroup) {
            const sc = 30 + Math.random() * 10;
            rockGroup.scale.set(sc, sc, sc);
            rockGroup.position.set(x, getTerrainHeight(x, y), y);
            rockGroup.rotation.y = Math.random() * Math.PI;
            s.wildsGroup.add(rockGroup);
          } else {
            const rock = new THREE.Mesh(
              new THREE.DodecahedronGeometry(r, 0),
              new THREE.MeshLambertMaterial({ color: 0x777777 })
            );
            rock.position.set(x, r + getTerrainHeight(x, y), y);
            rock.rotation.y = Math.random() * Math.PI;
            s.wildsGroup.add(rock);
          }
          s.obstaclesWilds.push({ x, y, r: r * 0.8, h: r });
        } else {
          const log = new THREE.Mesh(
            new THREE.CylinderGeometry(8, 8, 50, 8),
            new THREE.MeshLambertMaterial({ color: 0x4a3219 })
          );
          log.rotation.z = Math.PI / 2;
          log.rotation.y = Math.random() * Math.PI;
          log.position.set(x, 7 + getTerrainHeight(x, y), y);
          s.wildsGroup.add(log);
          s.obstaclesWilds.push({ x, y, r: 25, h: 16 });
        }
      } else {
        if (rand < 0.75) {
          const isHigh = Math.random() < 0.5;
          let treeGroup;
          if (isHigh && loadedModels.tree_high)
            treeGroup = SkeletonUtils.clone(loadedModels.tree_high);
          else if (!isHigh && loadedModels.tree)
            treeGroup = SkeletonUtils.clone(loadedModels.tree);

          if (treeGroup) {
            treeGroup.scale.set(50, 50, 50);
          } else {
            treeGroup = new THREE.Group();
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(6, 6, 30, 8),
              new THREE.MeshLambertMaterial({ color: 0x5c4033 })
            );
            trunk.position.y = 15;
            const leaves = new THREE.Mesh(
              new THREE.ConeGeometry(25, 55, 8),
              new THREE.MeshLambertMaterial({ color: 0x226b2b })
            );
            leaves.position.y = 42;
            treeGroup.add(trunk, leaves);
          }
          treeGroup.position.set(x, getTerrainHeight(x, y), y);
          s.wildsGroup.add(treeGroup);
          s.obstaclesWilds.push({ x, y, r: 12, h: 60 });
        } else {
          const r = 12 + Math.random() * 12;
          let plantMesh;
          if (loadedModels.plant) {
            plantMesh = SkeletonUtils.clone(loadedModels.plant);
            plantMesh.scale.set(20, 20, 20);
            plantMesh.position.set(x, getTerrainHeight(x, y), y);
          } else {
            plantMesh = new THREE.Mesh(
              new THREE.SphereGeometry(r, 8, 8),
              new THREE.MeshLambertMaterial({ color: 0x1d5c22 })
            );
            plantMesh.position.set(x, r - 2 + getTerrainHeight(x, y), y);
          }
          s.wildsGroup.add(plantMesh);
          s.obstaclesWilds.push({ x, y, r: r * 0.7, h: r });
        }
      }
    }
  }

  // Random tents in Wilds
  if (loadedModels.tent) {
    const numTents = 15 + Math.floor(Math.random() * 10);
    for (let t = 0; t < numTents; t++) {
      let tx = 200 + Math.random() * (ms - 400);
      let ty = 200 + Math.random() * (ms - 400);
      if (Math.hypot(tx - ms / 2, ty - ms / 2) < 500) continue;
      if (tx > 200 && tx < 800 && ty > 200 && ty < 800) continue;
      if (s.obstaclesWilds.some(o => Math.hypot(o.x - tx, o.y - ty) < o.r + 30)) continue;
      const tent = SkeletonUtils.clone(loadedModels.tent);
      tent.scale.set(25, 25, 25);
      tent.rotation.y = Math.random() * Math.PI * 2;
      tent.position.set(tx, getTerrainHeight(tx, ty), ty);
      s.wildsGroup.add(tent);
      s.obstaclesWilds.push({ x: tx, y: ty, r: 25, h: 30 });
    }
  }

  // Map border cliffs (tebing tinggi di ujung map)
  const borderSpacing = 150; // Jarak diperkecil agar lebih rapat
  for (let i = 0; i <= ms; i += borderSpacing) {
    // Top and bottom edges (z = 0 and z = ms)
    [0, ms].forEach(z => {
      let rockGroup;
      if (loadedModels.rocks_high) {
        rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
        rockGroup.scale.set(180, 250, 180); // Skala diperlebar dan ditinggikan
        rockGroup.position.set(i, -20, z);
        rockGroup.rotation.y = Math.random() * Math.PI;
        s.wildsGroup.add(rockGroup);
      }
      s.obstaclesWilds.push({ x: i, y: z, r: 250, h: 250 }); // Obstacle diperbesar
    });
    // Left and right edges (x = 0 and x = ms)
    if (i > 0 && i < ms) {
      [0, ms].forEach(x => {
        let rockGroup;
        if (loadedModels.rocks_high) {
          rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
          rockGroup.scale.set(180, 250, 180);
          rockGroup.position.set(x, -20, i);
          rockGroup.rotation.y = Math.random() * Math.PI;
          s.wildsGroup.add(rockGroup);
        }
        s.obstaclesWilds.push({ x: x, y: i, r: 250, h: 250 });
      });
    }
  }

  // Scatter interactables (chests, barrels, ruins)
  scatterInteractables(mapSize, s.wildsGroup, s.obstaclesWilds, getTerrainHeight, 'wilds');
}

// ─── Hometown generation ──────────────────────────────────────────────────────

export function initHometown() {
  const s = state;
  s.hometownGroup = new THREE.Group();
  s.scene.add(s.hometownGroup);

  const hx = 500, hy = 500;

  // Stone plaza
  if (loadedModels.patch_dirt) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (Math.hypot(dx, dz) > 3.5) continue;
        const dirt = SkeletonUtils.clone(loadedModels.patch_dirt);
        dirt.scale.set(30, 30, 30);
        const px = hx + dx * 65;
        const pz = hy + dz * 65;
        dirt.position.set(px, -2.8, pz);
        s.hometownGroup.add(dirt);
      }
    }
  } else {
    const plazaMesh = new THREE.Mesh(
      new THREE.CircleGeometry(250, 32),
      new THREE.MeshLambertMaterial({ color: 0x6e6e6e })
    );
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(hx, 0.5, hy);
    s.hometownGroup.add(plazaMesh);
  }

  // Dirt paths connecting plaza to buildings
  if (loadedModels.patch_dirt) {
    function addPath(startX, startZ, endX, endZ) {
      const steps = Math.round(Math.hypot(endX - startX, endZ - startZ) / 30);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = startX + (endX - startX) * t;
        const pz = startZ + (endZ - startZ) * t;
        const dirt = SkeletonUtils.clone(loadedModels.patch_dirt);
        dirt.scale.set(30, 30, 30);
        dirt.position.set(px, -2.8, pz);
        dirt.rotation.y = Math.atan2(endX - startX, endZ - startZ);
        s.hometownGroup.add(dirt);
      }
    }
  // From fountain to each building
    addPath(hx, hy, hx - 300, hy - 300); // to house
    addPath(hx, hy, hx + 300, hy + 300); // to platform
    addPath(hx, hy, hx - 300, hy + 300); // to struct_roof
    addPath(hx, hy, hx + 400, hy - 100);  // to house2
    addPath(hx, hy, hx - 400, hy + 100);  // to platform2
    addPath(hx, hy, hx + 260, hy - 320); // to struct_roof2
    // To NPCs
    addPath(hx, hy, hx - 200, hy - 200); // to shop
    addPath(hx, hy, hx + 200, hy - 200); // to healer
    addPath(hx, hy, hx - 200, hy + 200); // to blacksmith
    // To target dummy
    addPath(hx, hy, hx + 160, hy - 300);
    addPath(hx, hy, hx - 160, hy + 360);
    addPath(hx, hy, hx + 360, hy - 240);
    addPath(hx, hy, hx - 440, hy - 60);
    addPath(hx, hy, hx + 440, hy + 160);
    addPath(hx, hy, hx, hy - 400);
  }

  // Fountain
  const fountainMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(30, 35, 10, 16), fountainMat
  );
  fountain.position.set(hx, 5, hy);
  s.hometownGroup.add(fountain);

  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x00aaff, transparent: true, opacity: 0.8,
  });
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 28, 2, 16), waterMat
  );
  water.position.set(hx, 10, hy);
  s.hometownGroup.add(water);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 25, 8), fountainMat
  );
  pillar.position.set(hx, 15, hy);
  s.hometownGroup.add(pillar);
  s.obstaclesHometown.push({ x: hx, y: hy, r: 35, h: 30 });

  // Extra decorations: stones, plants, and fence segments around plaza
  function placeDecoration(x, z, r) {
    if (s.obstaclesHometown.some(o => Math.hypot(o.x - x, o.y - z) < o.r + r + 10)) return;
    const rand = Math.random();
    if (rand < 0.5 && loadedModels.stones) {
      const stone = SkeletonUtils.clone(loadedModels.stones);
      const sc = 20 + Math.random() * 10;
      stone.scale.set(sc, sc, sc);
      stone.position.set(x, 0, z);
      stone.rotation.y = Math.random() * Math.PI;
      s.hometownGroup.add(stone);
    } else if (rand < 0.8 && loadedModels.plant) {
      const plant = SkeletonUtils.clone(loadedModels.plant);
      plant.scale.set(15, 15, 15);
      plant.position.set(x, 0, z);
      s.hometownGroup.add(plant);
    } else {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r || 10, 0),
        new THREE.MeshLambertMaterial({ color: 0x888888 })
      );
      rock.position.set(x, (r || 10) + getTerrainHeight(x, z), z);
      s.hometownGroup.add(rock);
    }
    s.obstaclesHometown.push({ x, y: z, r: (r || 10) * 0.7, h: (r || 10) });
  }
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 180 + Math.random() * 200;
    placeDecoration(hx + Math.cos(angle) * dist, hy + Math.sin(angle) * dist, 8 + Math.random() * 10);
  }

  // Debug: log model loading status
  console.log('[Hometown] Model status:', {
    house: !!loadedModels.house,
    building_platform: !!loadedModels.building_platform,
    building_struct: !!loadedModels.building_struct,
    building_roof: !!loadedModels.building_roof,
  });

  // Daftar bangunan — tiap posisi menggunakan model spesifik dari public/models
  const housePositions = [
    { x: -300, z: -300, r: 0,            model: 'house' },
    { x: 300,  z: 300,  r: Math.PI,      model: 'building_platform' },
    { x: -300, z: 300,  r: Math.PI / 2,  model: 'struct_roof' },
    { x: 400,  z: -100, r: -Math.PI / 2, model: 'house' },
    { x: -400, z: 100,  r: Math.PI / 3,  model: 'building_platform' },
    { x: 260,  z: -320, r: -Math.PI / 4, model: 'struct_roof' },
    { x: -160, z: 360,  r: Math.PI / 4,  model: 'house' },
    { x: 360,  z: -240, r: -Math.PI / 3, model: 'house' },
    { x: -240, z: -360, r: Math.PI * 0.7,model: 'building_platform' },
    { x: 120,  z: 240,  r: 0,            model: 'struct_roof' },
    { x: -440, z: -60,  r: Math.PI / 2,  model: 'house' },
    { x: 440,  z: 160,  r: Math.PI,      model: 'building_platform' },
    { x: 0,    z: -400, r: -Math.PI / 6, model: 'struct_roof' },
  ];

  /**
   * Buat satu bangunan dari GLB model.
   * Scale tetap per tipe — nilai ini sudah disesuaikan dengan ukuran
   * native GLB Kenney agar bangunan terlihat proporsional di dunia game.
   */
  function makeBuilding(modelKey) {
    // --- struct + roof ---
    if (modelKey === 'struct_roof' && loadedModels.building_struct && loadedModels.building_roof) {
      const grp = new THREE.Group();
      const bs = SkeletonUtils.clone(loadedModels.building_struct);
      const br = SkeletonUtils.clone(loadedModels.building_roof);
      grp.add(bs, br);
      grp.scale.set(45, 45, 45);
      return grp;
    }
    // --- building platform ---
    if ((modelKey === 'building_platform' || modelKey === 'struct_roof') && loadedModels.building_platform) {
      const grp = SkeletonUtils.clone(loadedModels.building_platform);
      grp.scale.set(30, 30, 30);
      return grp;
    }
    // --- house (default & fallback) ---
    if (loadedModels.house) {
      const grp = SkeletonUtils.clone(loadedModels.house);
      grp.scale.set(25, 25, 25);
      return grp;
    }
    // --- last resort: struct alone ---
    if (loadedModels.building_struct) {
      const grp = new THREE.Group();
      const bs = SkeletonUtils.clone(loadedModels.building_struct);
      if (loadedModels.building_roof) grp.add(SkeletonUtils.clone(loadedModels.building_roof));
      grp.add(bs);
      grp.scale.set(45, 45, 45);
      return grp;
    }
    // --- prosedural geometry jika SEMUA model gagal ---
    console.warn('[makeBuilding] Semua model gagal dimuat, pakai prosedural geometry');
    const grp = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(60, 40, 60),
      new THREE.MeshLambertMaterial({ color: 0xddd3c6 })
    );
    base.position.y = 20;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(45, 30, 4),
      new THREE.MeshLambertMaterial({ color: 0x8b2e2e })
    );
    roof.position.y = 55;
    roof.rotation.y = Math.PI / 4;
    grp.add(base, roof);
    return grp;
  }

  housePositions.forEach(p => {
    const hGroup = makeBuilding(p.model);
    hGroup.position.set(hx + p.x, 0, hy + p.z);
    hGroup.rotation.y = p.r;
    s.hometownGroup.add(hGroup);
    s.obstaclesHometown.push({ x: hx + p.x, y: hy + p.z, r: 45, h: 100 });
  });

  // Pagar persegi di sekeliling tiap bangunan (2 sisi saja)
  if (loadedModels.fence) {
    function addBuildingFence(cx, cz, hw) {
      const sides = [
        { x: cx, z: cz - hw, ry: 0 },
        { x: cx, z: cz + hw, ry: Math.PI },
      ];
      for (const side of sides) {
        const fence = SkeletonUtils.clone(loadedModels.fence);
        fence.scale.set(25, 25, 25);
        fence.rotation.y = side.ry;
        fence.position.set(side.x, 0, side.z);
        s.hometownGroup.add(fence);
      }
    }
    addBuildingFence(hx - 300, hy - 300, 60);
    addBuildingFence(hx + 300, hy + 300, 60);
    addBuildingFence(hx - 300, hy + 300, 60);
    addBuildingFence(hx + 400, hy - 100, 60);
    addBuildingFence(hx - 400, hy + 100, 60);
    addBuildingFence(hx + 260, hy - 320, 60);
    addBuildingFence(hx - 200, hy - 200, 45);
    addBuildingFence(hx + 200, hy - 200, 45);
    addBuildingFence(hx - 200, hy + 200, 45);
  }

  // Target dummy
  if (loadedModels.target) {
    const target = SkeletonUtils.clone(loadedModels.target);
    target.scale.set(30, 30, 30);
    target.position.set(hx + 160, 0, hy - 300);
    target.rotation.y = Math.PI / 4;
    s.hometownGroup.add(target);
    s.obstaclesHometown.push({ x: hx + 160, y: hy - 300, r: 15, h: 30 });
  }

  // Extra fence segments along plaza perimeter
  if (loadedModels.fence) {
    const fencePositions = [
      { x: hx - 100, z: hy + 120, ry: 0 },
      { x: hx + 100, z: hy + 120, ry: Math.PI },
      { x: hx + 120, z: hy - 100, ry: Math.PI / 2 },
      { x: hx - 120, z: hy - 100, ry: -Math.PI / 2 },
      { x: hx + 160, z: hy + 160, ry: Math.PI * 0.75 },
      { x: hx - 160, z: hy - 160, ry: -Math.PI * 0.75 },
    ];
    for (const fp of fencePositions) {
      const fence = SkeletonUtils.clone(loadedModels.fence);
      fence.scale.set(20, 20, 20);
      fence.rotation.y = fp.ry;
      fence.position.set(fp.x, 0, fp.z);
      s.hometownGroup.add(fence);
      s.obstaclesHometown.push({ x: fp.x, y: fp.z, r: 15, h: 20 });
    }
  }

  // Extra buildings near edges using random model types
  const extraBuildings = [
    { x: hx + 500, z: hy + 400, model: 'house' },
    { x: hx - 500, z: hy + 300, model: 'building_platform' },
    { x: hx + 200, z: hy - 440, model: 'struct_roof' },
    { x: hx - 360, z: hy - 400, model: 'house' },
  ];
  for (const eb of extraBuildings) {
    if (loadedModels.house || loadedModels.building_platform || loadedModels.building_struct) {
      const eGroup = makeBuilding(eb.model);
      eGroup.position.set(eb.x, 0, eb.z);
      eGroup.rotation.y = Math.random() * Math.PI * 2;
      s.hometownGroup.add(eGroup);
      s.obstaclesHometown.push({ x: eb.x, y: eb.z, r: 40, h: 100 });
    }
  }

  // Shop stall
  let stallGroup;
  if (loadedModels.tent) {
    stallGroup = SkeletonUtils.clone(loadedModels.tent);
    stallGroup.scale.set(30, 30, 30);
  } else {
    stallGroup = new THREE.Group();
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    const stallPoleGeo = new THREE.CylinderGeometry(2, 2, 40, 4);
    [[-20, 20, -20], [20, 20, -20], [-20, 20, 20], [20, 20, 20]].forEach(([px, py, pz]) => {
      const p = new THREE.Mesh(stallPoleGeo, poleMat);
      p.position.set(px, py, pz);
      stallGroup.add(p);
    });
    const awning = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshLambertMaterial({ color: 0xffaa00, side: THREE.DoubleSide })
    );
    awning.rotation.x = -Math.PI / 2 + 0.2;
    awning.position.y = 42;
    stallGroup.add(awning);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(30, 15, 15),
      new THREE.MeshLambertMaterial({ color: 0x6e4a2b })
    );
    table.position.set(0, 7.5, 10);
    stallGroup.add(table);
  }
  stallGroup.position.set(hx - 200, 0, hy - 200);
  s.hometownGroup.add(stallGroup);

  // Healer shrine
  let shrineGroup;
  if (loadedModels.building_platform) {
    shrineGroup = SkeletonUtils.clone(loadedModels.building_platform);
    shrineGroup.scale.set(35, 35, 35);
  } else {
    shrineGroup = new THREE.Group();
    const sBaseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const sBase = new THREE.Mesh(
      new THREE.CylinderGeometry(25, 25, 5, 8), sBaseMat
    );
    sBase.position.y = 2.5;
    shrineGroup.add(sBase);
    const stallPoleGeo = new THREE.CylinderGeometry(2, 2, 40, 4);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(stallPoleGeo, sBaseMat);
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      sp.position.set(Math.cos(ang) * 20, 20, Math.sin(ang) * 20);
      shrineGroup.add(sp);
    }
    const sRoof = new THREE.Mesh(
      new THREE.ConeGeometry(30, 20, 4),
      new THREE.MeshLambertMaterial({ color: 0x00aaff })
    );
    sRoof.position.y = 50;
    sRoof.rotation.y = Math.PI / 4;
    shrineGroup.add(sRoof);
  }
  shrineGroup.position.set(hx + 200, 0, hy - 200);
  s.hometownGroup.add(shrineGroup);

  // Blacksmith
  let bsGroup;
  if (loadedModels.building_struct && loadedModels.building_roof) {
    bsGroup = new THREE.Group();
    bsGroup.add(SkeletonUtils.clone(loadedModels.building_struct));
    bsGroup.add(SkeletonUtils.clone(loadedModels.building_roof));
    bsGroup.scale.set(45, 45, 45);
  } else {
    bsGroup = new THREE.Group();
    const anvil = new THREE.Mesh(
      new THREE.BoxGeometry(15, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    anvil.position.set(0, 5, 10);
    bsGroup.add(anvil);
    const furnace = new THREE.Mesh(
      new THREE.BoxGeometry(20, 30, 20),
      new THREE.MeshLambertMaterial({ color: 0x552222 })
    );
    furnace.position.set(0, 15, -15);
    bsGroup.add(furnace);
    const fire = new THREE.Mesh(
      new THREE.SphereGeometry(6, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0xff5500 })
    );
    fire.position.set(0, 10, -5);
    bsGroup.add(fire);
  }
  bsGroup.position.set(hx - 200, 0, hy + 200);
  s.hometownGroup.add(bsGroup);

  // Quest Board
  const qbGroup = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(20, 15, 2),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
  );
  board.position.y = 10;
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 15), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
  postL.position.set(-8, 7.5, 0);
  const postR = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 15), new THREE.MeshLambertMaterial({ color: 0x5c4033 }));
  postR.position.set(8, 7.5, 0);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
  paper.position.set(0, 10, 1.1);
  qbGroup.add(board, postL, postR, paper);
  qbGroup.position.set(hx, 0, hy + 100);
  qbGroup.scale.set(2, 2, 2);
  qbGroup.rotation.y = Math.PI;
  s.hometownGroup.add(qbGroup);
  s.questBoardPos = { x: hx, z: hy + 100 };
  s.obstaclesHometown.push({ x: hx, y: hy + 100, r: 15, h: 30 });

  // Flag posts around plaza
  if (loadedModels.flag) {
    const flagPositions = [
      { x: hx - 240, z: hy - 240 },
      { x: hx + 240, z: hy - 240 },
      { x: hx - 240, z: hy + 240 },
      { x: hx + 240, z: hy + 240 },
    ];
    for (const fp of flagPositions) {
      const flag = SkeletonUtils.clone(loadedModels.flag);
      flag.scale.set(20, 20, 20);
      flag.position.set(fp.x, 0, fp.z);
      s.hometownGroup.add(flag);
      s.obstaclesHometown.push({ x: fp.x, y: fp.z, r: 8, h: 30 });
    }
  }
}

// ─── Entity creation (enemies, player, items) ────────────────────────────────

export function initEntities() {
  const s = state;


  // Coins removed for inventory system

  // Player mesh
  s.playerBodyMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  s.playerBladeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  window.playerBodyMat = s.playerBodyMat;
  window.playerBladeMat = s.playerBladeMat;
  s.playerMesh = new THREE.Group();

  if (loadedModels.player_model) {
    const fbxModel = SkeletonUtils.clone(loadedModels.player_model);
    fbxModel.scale.set(0.3, 0.3, 0.3); // Scale diperkecil sedikit agar pas
    fbxModel.position.y = -15; 
    
    // Setup Animasi
    s.playerMixer = new THREE.AnimationMixer(fbxModel);
    s.playerActions = {};
    
    if (loadedModels.sword_idle && loadedModels.sword_idle.animations && loadedModels.sword_idle.animations.length > 0) {
      s.playerActions.idle = s.playerMixer.clipAction(loadedModels.sword_idle.animations[0]);
    } else if (loadedModels.idle_anim && loadedModels.idle_anim.animations.length > 0) {
      s.playerActions.idle = s.playerMixer.clipAction(loadedModels.idle_anim.animations[0]);
    } else if (fbxModel.animations.length > 0) {
      s.playerActions.idle = s.playerMixer.clipAction(fbxModel.animations[0]);
    }
    
    if (loadedModels.sword_run && loadedModels.sword_run.animations && loadedModels.sword_run.animations.length > 0) {
      s.playerActions.run = s.playerMixer.clipAction(loadedModels.sword_run.animations[0]);
    } else if (loadedModels.run_anim && loadedModels.run_anim.animations.length > 0) {
      s.playerActions.run = s.playerMixer.clipAction(loadedModels.run_anim.animations[0]);
    }
    if (loadedModels.sword_slash && loadedModels.sword_slash.animations && loadedModels.sword_slash.animations.length > 0) {
      console.log("Successfully loaded sword_slash animation:", loadedModels.sword_slash.animations[0]);
      s.playerActions.attack = s.playerMixer.clipAction(loadedModels.sword_slash.animations[0]);
      s.playerActions.attack.setLoop(THREE.LoopOnce);
      s.playerActions.attack.clampWhenFinished = true;
    } else {
      console.error("Failed to load sword_slash animations! loadedModels.sword_slash is:", loadedModels.sword_slash);
      // Fallback
      if (loadedModels.attack_anim && loadedModels.attack_anim.animations.length > 0) {
        s.playerActions.attack = s.playerMixer.clipAction(loadedModels.attack_anim.animations[0]);
        s.playerActions.attack.setLoop(THREE.LoopOnce);
        s.playerActions.attack.clampWhenFinished = true;
      }
    }
    
    if (s.playerActions.idle) {
      s.playerActions.idle.play();
      s.activeAction = s.playerActions.idle;
    }
    
    // Cari tulang tangan kanan (MixamoRig:RightHand) untuk menempelkan pedang
    let rightHand = null;
    fbxModel.traverse(child => {
      if (child.name.toLowerCase().includes('righthand') && !rightHand) {
        rightHand = child;
      }
    });
    
    if (loadedModels.sword) {
      const gltfSword = SkeletonUtils.clone(loadedModels.sword);
      s.playerSwordMesh = gltfSword;
      // We no longer replace the material here; we'll let it use the arrow's native material.
      // ui.js will handle cloning and coloring it.

      if (rightHand) {
        gltfSword.scale.set(250, 250, 250);
        gltfSword.position.set(43, 8, -20);
        gltfSword.rotation.set(Math.PI, Math.PI / 3, 0); 
        gltfSword.rotateX(Math.PI); // Ini rumus pasti untuk memutar objek 180 derajat persis di tempatnya
        rightHand.add(gltfSword);
      } else {
        gltfSword.scale.set(15, 15, 15);
        gltfSword.position.set(10, 0, 15);
        s.playerMesh.add(gltfSword);
      }
    }
    
    s.playerMesh.add(fbxModel);
    s.gltfPlayerRef = fbxModel;
  } else if (loadedModels.player) {
    s.gltfPlayerRef = SkeletonUtils.clone(loadedModels.player);
    s.gltfPlayerRef.scale.set(35, 35, 35);
    s.gltfPlayerRef.position.y = -15;
    
    if (loadedModels.player.animations && loadedModels.player.animations.length > 0) {
      s.playerMixer = new THREE.AnimationMixer(s.gltfPlayerRef);
      s.playerActions = {};
      
      loadedModels.player.animations.forEach((clip) => {
        const name = clip.name.toLowerCase();
        if (name.includes('idle')) s.playerActions.idle = s.playerMixer.clipAction(clip);
        else if (name.includes('run') || name.includes('walk')) s.playerActions.run = s.playerMixer.clipAction(clip);
        else if (name.includes('attack')) {
          s.playerActions.attack = s.playerMixer.clipAction(clip);
          s.playerActions.attack.setLoop(THREE.LoopOnce);
          s.playerActions.attack.clampWhenFinished = true;
        }
      });
      if (!s.playerActions.idle && loadedModels.player.animations[0]) s.playerActions.idle = s.playerMixer.clipAction(loadedModels.player.animations[0]);
      if (!s.playerActions.run && loadedModels.player.animations[1]) s.playerActions.run = s.playerMixer.clipAction(loadedModels.player.animations[1]);
      
      if (s.playerActions.idle) {
        s.playerActions.idle.play();
        s.activeAction = s.playerActions.idle;
      }
      
      // Still try to find arm-right for sword attachment
      s.playerArmR = s.gltfPlayerRef.getObjectByName('arm-right') || null;
    } else {
      s.playerLegL = s.gltfPlayerRef.getObjectByName('leg-left');
      s.playerLegR = s.gltfPlayerRef.getObjectByName('leg-right');
      s.playerArmL = s.gltfPlayerRef.getObjectByName('arm-left');
      s.playerArmR = s.gltfPlayerRef.getObjectByName('arm-right');
    }
    
    s.playerMesh.add(s.gltfPlayerRef);

    if (loadedModels.sword) {
      s.playerSwordMesh = SkeletonUtils.clone(loadedModels.sword);
      s.playerBladeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
      s.playerSwordMesh.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = s.playerBladeMat;
        }
      });
      if (s.playerArmR) {
        // Attach to character's right arm
        s.playerSwordMesh.position.set(0, -0.4, 0.2);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerArmR.add(s.playerSwordMesh);
      } else {
        // Fallback attachment
        s.playerSwordMesh.scale.set(15, 15, 15);
        s.playerSwordMesh.position.set(10, 0, 15);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerMesh.add(s.playerSwordMesh);
      }
    } else {
      // Create programmatic sword as fallback
      s.playerSwordMesh = new THREE.Group();
      
      const bladeGeo = new THREE.BoxGeometry(0.1, 1.2, 0.2);
      s.playerBladeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
      const blade = new THREE.Mesh(bladeGeo, s.playerBladeMat);
      blade.position.y = 0.6;
      
      const hiltGeo = new THREE.BoxGeometry(0.4, 0.1, 0.3);
      const hiltMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
      const hilt = new THREE.Mesh(hiltGeo, hiltMat);
      
      const handleGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
      const handle = new THREE.Mesh(handleGeo, hiltMat);
      handle.position.y = -0.15;
  
      s.playerSwordMesh.add(blade, hilt, handle);
  
      if (s.playerArmR) {
        // Attach to character's right arm
        s.playerSwordMesh.position.set(0, -0.4, 0.2);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerArmR.add(s.playerSwordMesh);
      } else {
        // Fallback attachment
        s.playerSwordMesh.scale.set(15, 15, 15);
        s.playerSwordMesh.position.set(10, 0, 15);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerMesh.add(s.playerSwordMesh);
      }
    }
  } else {
    // Classic fallback boxes
    s.playerMesh = createFallbackPlayer();
  }

  s.playerMesh.position.set(s.player.x, 15, s.player.y);
  s.scene.add(s.playerMesh);
  
  // Player HP Bar
  const pHpBg = new THREE.Mesh(new THREE.PlaneGeometry(30, 4), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  s.playerHpFg = new THREE.Mesh(new THREE.PlaneGeometry(30, 4), new THREE.MeshBasicMaterial({ color: 0x008800 }));
  s.playerHpFg.position.z = 0.2;
  s.playerHpGroup = new THREE.Group();
  s.playerHpGroup.add(pHpBg, s.playerHpFg);
  s.scene.add(s.playerHpGroup);


  // Shield visual
  const shieldGeo = new THREE.SphereGeometry(24, 16, 16);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x00aaff, transparent: true, opacity: 0.5, wireframe: true,
  });
  s.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  s.shieldMesh.visible = false;
  s.playerMesh.add(s.shieldMesh);

  // Companion fairy pet
  s.petMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffaa, wireframe: true })
  );
  s.scene.add(s.petMesh);
}

function createFallbackPlayer() {
  const g = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  g.leftHip = new THREE.Group();
  g.leftHip.position.set(0, -3, -3.5);
  g.leftHip.add(new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), legMat));
  g.leftHip.children[0].position.set(0, -6, 0);
  g.add(g.leftHip);

  g.rightHip = new THREE.Group();
  g.rightHip.position.set(0, -3, 3.5);
  g.rightHip.add(new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), legMat));
  g.rightHip.children[0].position.set(0, -6, 0);
  g.add(g.rightHip);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(14, 20, 14),
    window.playerBodyMat
  );
  body.position.y = 7;
  g.add(body);

  const headMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
  const head = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), headMat);
  head.position.y = 21;
  g.add(head);

  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(6.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x778899 })
  );
  helm.position.y = 21;
  g.add(helm);

  const swordGroup = new THREE.Group();
  const hilt = new THREE.Mesh(
    new THREE.BoxGeometry(2, 6, 2),
    new THREE.MeshLambertMaterial({ color: 0x5c4033 })
  );
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(16, 2, 4),
    window.playerBladeMat
  );
  blade.position.x = 9;
  swordGroup.add(hilt, blade);
  swordGroup.position.set(0, 7, 9);
  g.add(swordGroup);

  const pShield = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 2, 16),
    new THREE.MeshLambertMaterial({ color: 0x8b4513 })
  );
  pShield.rotation.x = Math.PI / 2;
  pShield.position.set(0, 7, -9);
  g.add(pShield);

  return g;
}

/** Find a position far enough from obstacles, the altar, and the player. */
export function spawnAtFreePos() {
  let x, y, valid = false;
  while (!valid) {
    x = 50 + Math.random() * (mapSize - 100);
    y = 50 + Math.random() * (mapSize - 100);
    const s = state;
    if (Math.hypot(x - mapSize / 2, y - mapSize / 2) < 500) continue;
    if (Math.hypot(x - s.player.x, y - s.player.y) < 500) continue;
    if (s.obstaclesWilds.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
    valid = true;
  }
  return { x, y };
}

// ─── NPC placement ─────────────────────────────────────────────────────────────

/**
 * Auto-scale a cloned GLB mesh so its world-space height = targetHeight,
 * then shift it down so its bottom sits exactly at y=0.
 */
function scaleNPCToHeight(mesh, targetHeight) {
  const box = new THREE.Box3().setFromObject(mesh);
  const nativeHeight = box.max.y - box.min.y;
  if (nativeHeight <= 0) return;
  const sc = targetHeight / nativeHeight;
  mesh.scale.set(sc, sc, sc);
  // After scaling, re-measure and align feet to y=0
  const box2 = new THREE.Box3().setFromObject(mesh);
  mesh.position.y -= box2.min.y;
}

function createPortal(color) {
  const group = new THREE.Group();
  const baseOffset = -30; // Mengimbangi posisi Y=30 dari map generator agar portal menyentuh tanah

  // 1. Cincin Rune Dasar (Di Tanah)
  const ringMat = new THREE.MeshStandardMaterial({
    color: color, emissive: color, emissiveIntensity: 2.0,
    metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide,
    transparent: true, opacity: 0.9
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(20, 1.5, 8, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = baseOffset + 1; 
  group.add(ring);

  // 2. Inti Cahaya Bercahaya (Di Tanah)
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(18, 32), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = baseOffset + 1.2;
  group.add(disc);

  // 3. Pilar Cahaya Vertikal
  const beamMat = new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0.4,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 200, 32, 1, true), beamMat);
  beam.position.y = baseOffset + 100; // Tengah dari silinder tinggi 200
  group.add(beam);
  
  // 4. Inti Pilar yang Terang
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.6,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 200, 16, 1, true), coreMat);
  core.position.y = baseOffset + 100;
  group.add(core);

  // 5. Cincin Energi Melayang
  const ribbons = [];
  for (let i = 0; i < 4; i++) {
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(22 - i * 1.5, 0.8, 8, 32), ribbonMat);
    ribbon.rotation.x = -Math.PI / 2;
    ribbon.userData = { 
      offsetY: i * 45, 
      speed: 30 + i * 10,
      scalePhase: i * Math.PI / 2,
      baseOffset
    };
    group.add(ribbon);
    ribbons.push(ribbon);
  }

  // 6. Pencahayaan Portal
  const light = new THREE.PointLight(color, 4.0, 300, 1.5);
  light.position.y = baseOffset + 20;
  group.add(light);

  const portal = {
    group,
    ring,
    disc,
    beam,
    ribbons,
    color,
    get position() { return group.position; },
  };
  return portal;
}

// Update all portal animations each frame
export function updatePortalAnimations() {
  const s = state;
  const t = performance.now() * 0.001;

  const portals = [s.hometownPortal, s.wildsPortal, s.desertPortalWilds, s.desertPortalWilds2];
  for (const p of portals) {
    if (!p) continue;

    // Pulse beam opacity & scale
    if (p.beam) {
      const pulse = 0.3 + Math.sin(t * 4) * 0.1;
      p.beam.material.opacity = pulse;
      p.beam.scale.set(1 + Math.sin(t * 6) * 0.05, 1, 1 + Math.cos(t * 6) * 0.05);
    }
    
    // Rotate base ring
    if (p.ring) {
      p.ring.rotation.z = t * 1.5;
    }
    
    // Animate the floating energy rings (ribbons)
    if (p.ribbons) {
      for (let i = 0; i < p.ribbons.length; i++) {
        const r = p.ribbons[i];
        // Move upward from baseOffset to baseOffset + 200 and loop
        const heightPhase = (r.userData.offsetY + t * r.userData.speed) % 200;
        r.position.y = r.userData.baseOffset + heightPhase;
        
        // Spin ring
        r.rotation.z = -(t * 3.0 + i);
        
        // Pulse scale
        const sScale = 1 + Math.sin(t * 5 + r.userData.scalePhase) * 0.15;
        r.scale.set(sScale, sScale, sScale);
        
        // Fade out as it reaches the top
        r.material.opacity = 1.0 - (heightPhase / 200);
      }
    }
  }
}

export function initNPCs() {
  const s = state;
  const hx = 500, hy = 500;
  const NPC_HEIGHT = 30;

  // Portal to Wilds
  s.hometownPortal = createPortal(0x00ffff);
  s.hometownPortal.group.position.set(hx, 30, hy + 400);
  s.hometownGroup.add(s.hometownPortal.group);

  // Shop NPC
  if (loadedModels.char_b) {
    const shopMesh = SkeletonUtils.clone(loadedModels.char_b);
    scaleNPCToHeight(shopMesh, NPC_HEIGHT);
    s.shopNPC = new THREE.Group();
    s.shopNPC.add(shopMesh);
  } else {
    s.shopNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd700 })
    );
  }
  s.shopNPC.position.set(hx - 200, 0, hy - 200);
  s.hometownGroup.add(s.shopNPC);

  // Healer NPC
  if (loadedModels.char_c) {
    const healerMesh = SkeletonUtils.clone(loadedModels.char_c);
    scaleNPCToHeight(healerMesh, NPC_HEIGHT);
    s.healerNPC = new THREE.Group();
    s.healerNPC.add(healerMesh);
  } else {
    s.healerNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0xff66cc })
    );
  }
  s.healerNPC.position.set(hx + 200, 0, hy - 200);
  s.hometownGroup.add(s.healerNPC);

  // Blacksmith NPC
  if (loadedModels.char_d) {
    const bsMesh = SkeletonUtils.clone(loadedModels.char_d);
    scaleNPCToHeight(bsMesh, NPC_HEIGHT);
    s.blacksmithNPC = new THREE.Group();
    s.blacksmithNPC.add(bsMesh);
  } else {
    s.blacksmithNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
  }
  s.blacksmithNPC.position.set(hx - 200, 0, hy + 200);
  s.hometownGroup.add(s.blacksmithNPC);

  // Extra NPCs
  if (loadedModels.char_e) {
    const guardMesh = SkeletonUtils.clone(loadedModels.char_e);
    scaleNPCToHeight(guardMesh, NPC_HEIGHT);
    const guardGroup = new THREE.Group();
    guardGroup.add(guardMesh);
    guardGroup.position.set(hx + 120, 0, hy + 120);
    guardGroup.rotation.y = Math.PI;
    s.hometownGroup.add(guardGroup);
  }
  if (loadedModels.char_f) {
    const villagerMesh = SkeletonUtils.clone(loadedModels.char_f);
    scaleNPCToHeight(villagerMesh, NPC_HEIGHT);
    const villagerGroup = new THREE.Group();
    villagerGroup.add(villagerMesh);
    villagerGroup.position.set(hx - 120, 0, hy + 120);
    villagerGroup.rotation.y = 0;
    s.hometownGroup.add(villagerGroup);
  }
  if (loadedModels.char_g) {
    const guard2Mesh = SkeletonUtils.clone(loadedModels.char_g);
    scaleNPCToHeight(guard2Mesh, NPC_HEIGHT);
    const guard2Group = new THREE.Group();
    guard2Group.add(guard2Mesh);
    guard2Group.position.set(hx + 120, 0, hy - 120);
    guard2Group.rotation.y = Math.PI * 0.5;
    s.hometownGroup.add(guard2Group);
  }

  // Collision for NPCs
  s.obstaclesHometown.push(
    { x: hx - 200, y: hy - 200, r: 10 },
    { x: hx + 200, y: hy - 200, r: 10 },
    { x: hx - 200, y: hy + 200, r: 10 },
    { x: hx + 120, y: hy + 120, r: 10 },
    { x: hx - 120, y: hy + 120, r: 10 },
    { x: hx + 120, y: hy - 120, r: 10 },
  );
}

export function initWildsNPCs() {
  const s = state;
  // Wilds return portal (near altar)
  s.wildsPortal = createPortal(0xff00ff);
  s.wildsPortal.group.position.set(mapSize / 2, 30, mapSize / 2 + 60);
  s.wildsGroup.add(s.wildsPortal.group);

  // Portal to Scorched Dunes (wilds2) — placed near altar, always created;
  // level gate is enforced in ui.js
  s.desertPortalWilds = createPortal(0xff8800);
  s.desertPortalWilds.group.position.set(mapSize / 2, 30, mapSize / 2 + 400);
  s.wildsGroup.add(s.desertPortalWilds.group);

  // BOSS (The Golden Golem)
  s.bossActive = true;
  s.bossX = mapSize - 1000;
  s.bossY = mapSize - 1000;
  
  if (loadedModels.enemy) {
    const gltfBoss = SkeletonUtils.clone(loadedModels.enemy);
    gltfBoss.scale.set(100, 100, 100);
    gltfBoss.position.y = -30;
    gltfBoss.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.color.setHex(0xffd700);
      }
    });
    s.bossMesh = new THREE.Group();
    s.bossMesh.add(gltfBoss);
  } else {
    const bGeo = new THREE.BoxGeometry(60, 60, 60);
    const bMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    s.bossMesh = new THREE.Mesh(bGeo, bMat);
  }
  
  s.bossMesh.position.set(s.bossX, 30 + getTerrainHeight(s.bossX, s.bossY), s.bossY);
  s.wildsGroup.add(s.bossMesh);

  s.bossHpGroup = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  s.bossHpFg = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshBasicMaterial({ color: 0x880000 }));
  s.bossHpFg.position.z = 0.2;
  s.bossHpGroup.add(bg, s.bossHpFg);
  s.bossHpGroup.position.set(s.bossX, 80 + getTerrainHeight(s.bossX, s.bossY), s.bossY);
  s.wildsGroup.add(s.bossHpGroup);

  // FENCES (Circular Arena)
  const arenaRadius = 250;
  const numFences = 36; 
  
  for (let i = 0; i < numFences; i++) {
    const angle = (i / numFences) * Math.PI * 2;
    
    // Create an entrance gap pointing towards the center of the map
    // The angle towards the center (-1, -1 vector) is -3*PI/4, which is 225 degrees (around i = 22 or 23).
    if (i >= 20 && i <= 25) continue;

    const fx = s.bossX + Math.cos(angle) * arenaRadius;
    const fy = s.bossY + Math.sin(angle) * arenaRadius;

    let mesh;
    if (loadedModels.fence) {
      mesh = SkeletonUtils.clone(loadedModels.fence);
      mesh.scale.set(15, 15, 15); 
    } else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(45, 40, 10),
        new THREE.MeshLambertMaterial({ color: 0x5c4033 })
      );
    }
    
    mesh.position.set(fx, getTerrainHeight(fx, fy), fy);
    mesh.rotation.y = -angle; // Face outward/tangent
    s.wildsGroup.add(mesh);
    s.obstaclesWilds.push({ x: fx, y: fy, r: 25 });
  }

  // Spawn Boss Children inside fence
  setTimeout(() => {
    spawnEnemy(s.bossX + 80, s.bossY + 80, 0.5, true);
    spawnEnemy(s.bossX - 80, s.bossY + 80, 0.5, true);
    spawnEnemy(s.bossX + 80, s.bossY - 80, 0.5, true);
    spawnEnemy(s.bossX - 80, s.bossY - 80, 0.5, true);
    spawnEnemy(s.bossX + 130, s.bossY, 0.5, true);
    spawnEnemy(s.bossX - 130, s.bossY, 0.5, true);
  }, 1000); // Slight delay to ensure combat.js is fully initialized
}

// ─── Scorched Dunes (wilds2) — desert map, level 10+ ─────────────────────────

/**
 * Terrain height for wilds2: gentle rolling dunes + central pyramid bump.
 * Used only when currentScene === 'wilds2' (player mesh / wilds2 entities).
 */
export function getTerrainHeightWilds2(x, y) {
  const cx = mapSize / 2, cz = mapSize / 2;
  const distFromCenter = Math.hypot(x - cx, y - cz);
  // Pyramid flat zone: ground stays flat at y=0 so the pyramid base touches it
  if (distFromCenter <= 350) return 0;
  const distanceFactor = Math.min(1, (distFromCenter - 350) / 300);
  // Smooth dunes (different frequency from the Wilds so it looks distinct)
  const wave = Math.sin(x * 0.0018) * Math.cos(y * 0.0025) * 22;
  const noise = Math.sin(x * 0.0042 + 1.3) * Math.sin(y * 0.0037) * 12;
  // Rolling dunes fade out toward the pyramid base (smooth blend)
  return (wave + noise) * distanceFactor;
}

/** Wilds2 spawn finder (same pattern as spawnAtFreePos but uses obstaclesWilds2). */
export function spawnAtFreePosWilds2() {
  const s = state;
  let x, y, valid = false;
  while (!valid) {
    x = 50 + Math.random() * (mapSize - 100);
    y = 50 + Math.random() * (mapSize - 100);
    if (Math.hypot(x - mapSize / 2, y - mapSize / 2) < 500) continue;
    if (Math.hypot(x - s.player.x, y - s.player.y) < 500) continue;
    if (s.obstaclesWilds2.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
    valid = true;
  }
  return { x, y };
}

export function initWilds2() {
  const s = state;
  s.wilds2Group = new THREE.Group();
  s.scene.add(s.wilds2Group);

  const ms = mapSize;

  // ── Sand floor (separate plane so it only renders when wilds2 is visible) ──
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 512;
  texCanvas.height = 512;
  const ctx = texCanvas.getContext('2d');
  ctx.fillStyle = '#d9b26a'; // Base sand color
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 15000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#e8c987' : '#c2a36b'; // Light & dark sand grains
    ctx.globalAlpha = Math.random() * 0.8 + 0.2;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 2, 2 + Math.random() * 4);
  }
  const sandTex = new THREE.CanvasTexture(texCanvas);
  sandTex.wrapS = THREE.RepeatWrapping;
  sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(ms / 150, ms / 150);

  const floorGeo = new THREE.PlaneGeometry(ms, ms, 200, 200);
  const posAttr = floorGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const worldX = vx + (ms / 2);
    const worldY = (ms / 2) - vy;
    posAttr.setZ(i, getTerrainHeightWilds2(worldX, worldY));
  }
  floorGeo.computeVertexNormals();
  const floorMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    roughness: 0.95,
    metalness: 0.02,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ms / 2, 0, ms / 2);
  floor.receiveShadow = true;
  s.wilds2Group.add(floor);

  // ── Central ancient pyramid: 11 stepped tiers (step-pyramid), sandstone + gold cap ──
  const pyramidGroup = new THREE.Group();
  // Procedural sandstone texture so each block reads as cut stone, not a flat color
  const stoneTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#c2a36b';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3500; i++) {
      g.fillStyle = Math.random() > 0.5 ? '#d4b57a' : '#a58a5c';
      g.globalAlpha = Math.random() * 0.5 + 0.2;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    // subtle block seams
    g.globalAlpha = 0.25; g.strokeStyle = '#8a7150';
    for (let yy = 0; yy < 256; yy += 16) { g.beginPath(); g.moveTo(0, yy); g.lineTo(256, yy); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  })();
  const sandstoneMat = new THREE.MeshLambertMaterial({ color: 0xd8c08a, map: stoneTex, flatShading: true });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x886600, emissiveIntensity: 0.6 });
  const TOWERS = 11;
  const BASE = 380;
  const STEP = 28;
  for (let i = 0; i < TOWERS; i++) {
    const h = STEP + Math.max(0, (BASE - i * STEP - STEP)) * 0.06; // slight overhang at bottom
    const geo = new THREE.CylinderGeometry(Math.max(1, BASE - (i + 1) * STEP), BASE - i * STEP, h, 4, 1, false);
    const tier = new THREE.Mesh(geo, i === TOWERS - 1 ? goldMat : sandstoneMat);
    tier.position.y = 14 + i * STEP + h / 2;
    tier.castShadow = tier.receiveShadow = true;
    pyramidGroup.add(tier);
  }
  // Central cap: small cone on top of last tier (like the original but smaller)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(15, 22, 4), goldMat);
  cap.position.y = 14 + TOWERS * STEP + 11;
  cap.castShadow = cap.receiveShadow = true;
  pyramidGroup.add(cap);
  pyramidGroup.rotation.y = Math.PI / 4; // Point a face toward map center
  pyramidGroup.position.set(ms / 2, 0, ms / 2);
  s.wilds2Group.add(pyramidGroup);
  s.obstaclesWilds2.push({ x: ms / 2, y: ms / 2, r: 160, h: 150 });

  // ── Scattered rocks / sand boulders around the pyramid ──
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 250 + Math.random() * 400;
    const rx = ms / 2 + Math.cos(angle) * dist;
    const ry = ms / 2 + Math.sin(angle) * dist;
    if (rx < 50 || rx > ms - 50 || ry < 50 || ry > ms - 50) continue;
    const rr = 10 + Math.random() * 15;
    let rockGroup;
    if (Math.random() < 0.5 && loadedModels.rocks_high)
      rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
    else if (loadedModels.rocks_low)
      rockGroup = SkeletonUtils.clone(loadedModels.rocks_low);
    if (rockGroup) {
      const sc = 20 + Math.random() * 15;
      rockGroup.scale.set(sc, sc, sc);
      rockGroup.position.set(rx, getTerrainHeightWilds2(rx, ry), ry);
      rockGroup.rotation.y = Math.random() * Math.PI;
      s.wilds2Group.add(rockGroup);
    } else {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rr, 0),
        new THREE.MeshLambertMaterial({ color: 0xb89a6a })
      );
      rock.position.set(rx, rr + getTerrainHeightWilds2(rx, ry), ry);
      rock.rotation.y = Math.random() * Math.PI;
      s.wilds2Group.add(rock);
    }
    s.obstaclesWilds2.push({ x: rx, y: ry, r: rr * 0.8, h: rr });
  }

  // ── Desert rock clusters (reuse rocks models + sand-colored obsidian) ──
  const numClusters = 150;
  for (let c = 0; c < numClusters; c++) {
    const cx = 200 + Math.random() * (ms - 400);
    const cy = 200 + Math.random() * (ms - 400);
    if (Math.hypot(cx - ms / 2, cy - ms / 2) < 500) continue;

    const isRockCluster = Math.random() < 0.4;
    const clusterSize = 10 + Math.floor(Math.random() * 20);

    for (let i = 0; i < clusterSize; i++) {
      const rAngle = Math.random() * Math.PI * 2;
      const rDist = Math.random() * 200;
      const x = cx + Math.cos(rAngle) * rDist;
      const y = cy + Math.sin(rAngle) * rDist;
      if (x < 50 || x > ms - 50 || y < 50 || y > ms - 50) continue;
      if (Math.hypot(x - ms / 2, y - ms / 2) < 450) continue;
      if (s.obstaclesWilds2.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 15)) continue;

      if (isRockCluster) {
        const r = 15 + Math.random() * 25;
        let rockGroup;
        if (Math.random() < 0.5 && loadedModels.rocks_high)
          rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
        else if (loadedModels.rocks_low)
          rockGroup = SkeletonUtils.clone(loadedModels.rocks_low);
        else if (loadedModels.stones)
          rockGroup = SkeletonUtils.clone(loadedModels.stones);

        if (rockGroup) {
          const sc = 30 + Math.random() * 10;
          rockGroup.scale.set(sc, sc, sc);
          rockGroup.position.set(x, getTerrainHeightWilds2(x, y), y);
          rockGroup.rotation.y = Math.random() * Math.PI;
          s.wilds2Group.add(rockGroup);
        } else {
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(r, 0),
            new THREE.MeshLambertMaterial({ color: 0xb89a6a })
          );
          rock.position.set(x, r + getTerrainHeightWilds2(x, y), y);
          rock.rotation.y = Math.random() * Math.PI;
          s.wilds2Group.add(rock);
        }
        s.obstaclesWilds2.push({ x, y, r: r * 0.8, h: r });
      } else {
        // Cactus-style / dead tree silhouettes (thin trunks)
        const trunkH = 30 + Math.random() * 30;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(4, 5, trunkH, 6),
          new THREE.MeshLambertMaterial({ color: 0x6b5b3e })
        );
        trunk.position.set(x, trunkH / 2 + getTerrainHeightWilds2(x, y), y);
        trunk.rotation.z = (Math.random() - 0.5) * 0.2;
        s.wilds2Group.add(trunk);
        s.obstaclesWilds2.push({ x, y, r: 10, h: 50 });
      }
    }
  }

  // ── Quicksand pools (dark sunken circles) ──
  const numQuicksand = 10;
  for (let q = 0; q < numQuicksand; q++) {
    const qx = 300 + Math.random() * (ms - 600);
    const qy = 300 + Math.random() * (ms - 600);
    if (Math.hypot(qx - ms / 2, qy - ms / 2) < 500) continue;
    if (s.obstaclesWilds2.some(o => Math.hypot(o.x - qx, o.y - qy) < o.r + 80)) continue;

    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(80, 24),
      new THREE.MeshLambertMaterial({ color: 0x8a7a55, emissive: 0x221a0f, emissiveIntensity: 0.3 })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(qx, 1 + getTerrainHeightWilds2(qx, qy), qy);
    s.wilds2Group.add(pool);
    s.obstaclesWilds2.push({ x: qx, y: qy, r: 80, h: 5 });
  }

  // ── Border cliffs (same pattern as Wilds) ──
  const borderSpacing = 150;
  for (let i = 0; i <= ms; i += borderSpacing) {
    [0, ms].forEach(z => {
      if (loadedModels.rocks_high) {
        const rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
        rockGroup.scale.set(180, 250, 180);
        rockGroup.position.set(i, -20, z);
        rockGroup.rotation.y = Math.random() * Math.PI;
        s.wilds2Group.add(rockGroup);
      }
      s.obstaclesWilds2.push({ x: i, y: z, r: 250, h: 250 });
    });
    if (i > 0 && i < ms) {
      [0, ms].forEach(x => {
        if (loadedModels.rocks_high) {
          const rockGroup = SkeletonUtils.clone(loadedModels.rocks_high);
          rockGroup.scale.set(180, 250, 180);
          rockGroup.position.set(x, -20, i);
          rockGroup.rotation.y = Math.random() * Math.PI;
          s.wilds2Group.add(rockGroup);
        }
        s.obstaclesWilds2.push({ x: x, y: i, r: 250, h: 250 });
      });
    }
  }

  // ── Portal back to The Wilds (orange glow portal, near pyramid) ──
  s.desertPortalWilds2 = createPortal(0xff8800);
  s.desertPortalWilds2.group.position.set(ms / 2 + 600, 30, ms / 2);
  s.wilds2Group.add(s.desertPortalWilds2.group);

  // Scatter interactables (chests, barrels, ruins)
  scatterInteractables(mapSize, s.wilds2Group, s.obstaclesWilds2, getTerrainHeightWilds2, 'wilds2');
}
