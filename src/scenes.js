import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';
import { mapSize } from './constants.js';
import { loadedModels } from './model-loader.js';

// ─── Initialization helpers ───────────────────────────────────────────────────

/** Create the Three.js scene, camera, renderer, lights, fog, rain, bloom pass. */
export function initSetup() {
  const s = state;

  s.scene = new THREE.Scene();
  s.scene.background = new THREE.Color(0x2d4f30);

  s.camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 3000
  );

  const canvas = document.getElementById('canvas');
  s.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  s.renderer.setSize(window.innerWidth, window.innerHeight);
  s.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  s.renderer.toneMappingExposure = 1.0;

  s.composer = new EffectComposer(s.renderer);
  s.composer.addPass(new RenderPass(s.scene, s.camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, 0.4, 0.85
  );
  bloomPass.threshold = 0.4;
  bloomPass.strength = 0.8;
  bloomPass.radius = 0.3;
  s.composer.addPass(bloomPass);

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

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  s.scene.add(ambientLight);

  s.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  s.dirLight.position.set(mapSize / 2, 800, mapSize / 2);
  s.scene.add(s.dirLight);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(mapSize, mapSize);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a3a1a });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(mapSize / 2, 0, mapSize / 2);
  s.scene.add(floor);

  // Fog
  s.scene.fog = new THREE.FogExp2(0x1a2a1a, 0.0008);

  // Rain (starts invisible)
  const rainCount = 1500;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3]     = (Math.random() - 0.5) * 1000;
    rainPositions[i * 3 + 1] = Math.random() * 500;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
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
  s.altarCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(15, 0),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true })
  );
  s.altarCrystal.position.y = 50;
  altarGroup.add(altarBase, altarPillar, s.altarCrystal);
  altarGroup.position.set(ms / 2, 0, ms / 2);
  s.scene.add(altarGroup);
  s.obstacles.push({ x: ms / 2, y: ms / 2, r: 40 });

  // Forest / mountain clusters
  const numClusters = 60;
  for (let c = 0; c < numClusters; c++) {
    let cx = 200 + Math.random() * (ms - 400);
    let cy = 200 + Math.random() * (ms - 400);
    if (Math.hypot(cx - ms / 2, cy - ms / 2) < 250) continue;

    const isRockCluster = Math.random() < 0.3;
    const clusterSize = 15 + Math.floor(Math.random() * 35);

    for (let i = 0; i < clusterSize; i++) {
      const rAngle = Math.random() * Math.PI * 2;
      const rDist = Math.random() * 250;
      const x = cx + Math.cos(rAngle) * rDist;
      const y = cy + Math.sin(rAngle) * rDist;
      if (x < 50 || x > ms - 50 || y < 50 || y > ms - 50) continue;
      if (Math.hypot(x - ms / 2, y - ms / 2) < 200) continue;

      const radius = 15;
      if (s.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + radius + 5)) continue;

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
            rockGroup.position.set(x, 0, y);
            rockGroup.rotation.y = Math.random() * Math.PI;
            s.scene.add(rockGroup);
          } else {
            const rock = new THREE.Mesh(
              new THREE.DodecahedronGeometry(r, 0),
              new THREE.MeshLambertMaterial({ color: 0x777777 })
            );
            rock.position.set(x, r, y);
            rock.rotation.y = Math.random() * Math.PI;
            s.scene.add(rock);
          }
          s.obstacles.push({ x, y, r: r * 0.8 });
        } else {
          const log = new THREE.Mesh(
            new THREE.CylinderGeometry(8, 8, 50, 8),
            new THREE.MeshLambertMaterial({ color: 0x4a3219 })
          );
          log.rotation.z = Math.PI / 2;
          log.rotation.y = Math.random() * Math.PI;
          log.position.set(x, 7, y);
          s.scene.add(log);
          s.obstacles.push({ x, y, r: 25 });
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
          treeGroup.position.set(x, 0, y);
          s.scene.add(treeGroup);
          s.obstacles.push({ x, y, r: 12 });
        } else {
          const r = 12 + Math.random() * 12;
          let plantMesh;
          if (loadedModels.plant) {
            plantMesh = SkeletonUtils.clone(loadedModels.plant);
            plantMesh.scale.set(20, 20, 20);
            plantMesh.position.set(x, 0, y);
          } else {
            plantMesh = new THREE.Mesh(
              new THREE.SphereGeometry(r, 8, 8),
              new THREE.MeshLambertMaterial({ color: 0x1d5c22 })
            );
            plantMesh.position.set(x, r - 2, y);
          }
          s.scene.add(plantMesh);
          s.obstacles.push({ x, y, r: r * 0.7 });
        }
      }
    }
  }

  // Random tents in Wilds
  if (loadedModels.tent) {
    const numTents = 4 + Math.floor(Math.random() * 3);
    for (let t = 0; t < numTents; t++) {
      let tx = 200 + Math.random() * (ms - 400);
      let ty = 200 + Math.random() * (ms - 400);
      if (Math.hypot(tx - ms / 2, ty - ms / 2) < 300) continue;
      if (s.obstacles.some(o => Math.hypot(o.x - tx, o.y - ty) < o.r + 30)) continue;
      const tent = SkeletonUtils.clone(loadedModels.tent);
      tent.scale.set(25, 25, 25);
      tent.rotation.y = Math.random() * Math.PI * 2;
      tent.position.set(tx, 0, ty);
      s.scene.add(tent);
      s.obstacles.push({ x: tx, y: ty, r: 25 });
    }
  }
}

// ─── Hometown generation ──────────────────────────────────────────────────────

export function initHometown() {
  const s = state;
  const hx = 10000, hy = 10000;

  // Stone plaza
  if (loadedModels.patch_dirt) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (Math.hypot(dx, dz) > 3.5) continue;
        const dirt = SkeletonUtils.clone(loadedModels.patch_dirt);
        dirt.scale.set(30, 30, 30);
        dirt.position.set(hx + dx * 65, 0, hy + dz * 65);
        s.scene.add(dirt);
      }
    }
  } else {
    const plazaMesh = new THREE.Mesh(
      new THREE.CircleGeometry(250, 32),
      new THREE.MeshLambertMaterial({ color: 0x6e6e6e })
    );
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(hx, 0.5, hy);
    s.scene.add(plazaMesh);
  }

  // Wooden palisade
  const logGeo = new THREE.CylinderGeometry(6, 6, 40, 8);
  const logMat = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const x = hx + Math.cos(a) * 300;
    const y = hy + Math.sin(a) * 300;
    let fence;
    if (loadedModels.fence) {
      fence = SkeletonUtils.clone(loadedModels.fence);
      fence.scale.set(25, 25, 25);
      fence.rotation.y = -a + Math.PI / 2;
      fence.position.set(x, 0, y);
    } else {
      fence = new THREE.Mesh(logGeo, logMat);
      fence.position.set(x, 20, y);
      fence.scale.y = 0.8 + Math.random() * 0.4;
    }
    s.scene.add(fence);
    s.obstacles.push({ x, y, r: 15 });
  }

  // Fountain
  const fountainMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(30, 35, 10, 16), fountainMat
  );
  fountain.position.set(hx, 5, hy);
  s.scene.add(fountain);

  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x00aaff, transparent: true, opacity: 0.8,
  });
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 28, 2, 16), waterMat
  );
  water.position.set(hx, 10, hy);
  s.scene.add(water);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 25, 8), fountainMat
  );
  pillar.position.set(hx, 15, hy);
  s.scene.add(pillar);
  s.obstacles.push({ x: hx, y: hy, r: 35 });

  // Houses
  const houseBaseGeo = new THREE.BoxGeometry(60, 40, 60);
  const houseBaseMat = new THREE.MeshLambertMaterial({ color: 0xddd3c6 });
  const roofGeo = new THREE.ConeGeometry(45, 30, 4);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b2e2e });

  const housePositions = [
    { x: -150, z: -150, r: 0 },
    { x: 150,  z: 150,  r: Math.PI },
    { x: -150, z: 150,  r: Math.PI / 2 },
    { x: 200,  z: -50,  r: -Math.PI / 2 },
  ];

  housePositions.forEach(p => {
    let hGroup;
    if (loadedModels.building_struct) {
      hGroup = new THREE.Group();
      const bs = SkeletonUtils.clone(loadedModels.building_struct);
      const br = SkeletonUtils.clone(loadedModels.building_roof);
      hGroup.add(bs, br);
      hGroup.scale.set(45, 45, 45);
    } else if (loadedModels.house) {
      hGroup = SkeletonUtils.clone(loadedModels.house);
      hGroup.scale.set(20, 20, 20);
    } else {
      hGroup = new THREE.Group();
      const base = new THREE.Mesh(houseBaseGeo, houseBaseMat);
      base.position.y = 20;
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 55;
      roof.rotation.y = Math.PI / 4;
      hGroup.add(base, roof);
    }
    hGroup.position.set(hx + p.x, 0, hy + p.z);
    hGroup.rotation.y = p.r;
    s.scene.add(hGroup);
    s.obstacles.push({ x: hx + p.x, y: hy + p.z, r: 40 });
  });

  // Target dummy
  if (loadedModels.target) {
    const target = SkeletonUtils.clone(loadedModels.target);
    target.scale.set(30, 30, 30);
    target.position.set(hx + 80, 0, hy - 150);
    target.rotation.y = Math.PI / 4;
    s.scene.add(target);
    s.obstacles.push({ x: hx + 80, y: hy - 150, r: 15 });
  }

  // Shop stall
  const stallGroup = new THREE.Group();
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
  stallGroup.position.set(hx - 100, 0, hy - 100);
  s.scene.add(stallGroup);

  // Healer shrine
  const shrineGroup = new THREE.Group();
  const sBaseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const sBase = new THREE.Mesh(
    new THREE.CylinderGeometry(25, 25, 5, 8), sBaseMat
  );
  sBase.position.y = 2.5;
  shrineGroup.add(sBase);
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
  shrineGroup.position.set(hx + 100, 0, hy - 100);
  s.scene.add(shrineGroup);

  // Blacksmith
  const bsGroup = new THREE.Group();
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
  bsGroup.position.set(hx - 100, 0, hy + 100);
  s.scene.add(bsGroup);
}

// ─── Entity creation (enemies, player, items) ────────────────────────────────

export function initEntities() {
  const s = state;
  const ms = mapSize;

  // Crystals
  const crystalGeo = new THREE.OctahedronGeometry(8, 0);
  const crystalMat = new THREE.MeshLambertMaterial({ color: 0x00ffff });
  for (let i = 0; i < s.crystalGoal; i++) {
    const pos = spawnAtFreePos();
    const mesh = new THREE.Mesh(crystalGeo, crystalMat);
    mesh.position.set(pos.x, 15, pos.y);
    s.scene.add(mesh);
    s.crystalItems.push({ x: pos.x, y: pos.y, taken: false, mesh });
  }

  // Coins
  const coinGeo = new THREE.CylinderGeometry(6, 6, 2, 16);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
  for (let i = 0; i < 40; i++) {
    const pos = spawnAtFreePos();
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(pos.x, 10, pos.y);
    s.scene.add(mesh);
    s.coinItems.push({ x: pos.x, y: pos.y, taken: false, mesh });
  }

  // Player mesh
  s.playerBodyMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  s.playerBladeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  s.playerMesh = new THREE.Group();

  if (loadedModels.player) {
    s.gltfPlayerRef = SkeletonUtils.clone(loadedModels.player);
    s.gltfPlayerRef.scale.set(35, 35, 35);
    s.gltfPlayerRef.position.y = -15;
    s.playerLegL = s.gltfPlayerRef.getObjectByName('leg-left');
    s.playerLegR = s.gltfPlayerRef.getObjectByName('leg-right');
    s.playerArmL = s.gltfPlayerRef.getObjectByName('arm-left');
    s.playerArmR = s.gltfPlayerRef.getObjectByName('arm-right');
    s.playerMesh.add(s.gltfPlayerRef);

    if (loadedModels.sword && s.playerArmR) {
      const gltfSword = SkeletonUtils.clone(loadedModels.sword);
      gltfSword.scale.set(0.5, 0.5, 0.5);
      gltfSword.position.set(0, -0.3, 0.1);
      gltfSword.rotation.x = Math.PI / 2;
      s.playerArmR.add(gltfSword);
    } else if (loadedModels.sword) {
      const gltfSword = SkeletonUtils.clone(loadedModels.sword);
      gltfSword.scale.set(15, 15, 15);
      gltfSword.position.set(10, 0, 15);
      s.playerMesh.add(gltfSword);
    }
  } else {
    // Classic fallback boxes
    s.playerMesh = createFallbackPlayer();
  }

  s.playerMesh.position.set(s.player.x, 15, s.player.y);
  s.scene.add(s.playerMesh);

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
    if (Math.hypot(x - mapSize / 2, y - mapSize / 2) < 250) continue;
    if (Math.hypot(x - s.player.x, y - s.player.y) < 250) continue;
    if (s.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
    valid = true;
  }
  return { x, y };
}

// ─── NPC placement ─────────────────────────────────────────────────────────────

export function initNPCs() {
  const s = state;
  const hx = 10000, hy = 10000;

  // Portal to Wilds
  const portalGeo = new THREE.OctahedronGeometry(20, 0);
  const portalMat = new THREE.MeshLambertMaterial({ color: 0x00ffff, wireframe: true });
  s.hometownPortal = new THREE.Mesh(portalGeo, portalMat);
  s.hometownPortal.position.set(hx, 30, hy + 200);
  s.scene.add(s.hometownPortal);

  // Shop NPC
  if (loadedModels.char_b) {
    s.shopNPC = new THREE.Group();
    const shopMesh = SkeletonUtils.clone(loadedModels.char_b);
    shopMesh.scale.set(30, 30, 30);
    shopMesh.position.y = -25;
    s.shopNPC.add(shopMesh);
  } else {
    s.shopNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd700 })
    );
  }
  s.shopNPC.position.set(hx - 100, 15, hy - 100);
  s.scene.add(s.shopNPC);

  // Healer NPC
  if (loadedModels.char_c) {
    s.healerNPC = new THREE.Group();
    const healerMesh = SkeletonUtils.clone(loadedModels.char_c);
    healerMesh.scale.set(30, 30, 30);
    healerMesh.position.y = -25;
    s.healerNPC.add(healerMesh);
  } else {
    s.healerNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0xff66cc })
    );
  }
  s.healerNPC.position.set(hx + 100, 15, hy - 100);
  s.scene.add(s.healerNPC);

  // Blacksmith NPC
  if (loadedModels.char_d) {
    s.blacksmithNPC = new THREE.Group();
    const bsMesh = SkeletonUtils.clone(loadedModels.char_d);
    bsMesh.scale.set(30, 30, 30);
    bsMesh.position.y = -25;
    s.blacksmithNPC.add(bsMesh);
  } else {
    s.blacksmithNPC = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 25, 8),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
  }
  s.blacksmithNPC.position.set(hx - 100, 15, hy + 100);
  s.scene.add(s.blacksmithNPC);

  // Collision for NPCs
  s.obstacles.push(
    { x: hx - 100, y: hy - 100, r: 10 },
    { x: hx + 100, y: hy - 100, r: 10 },
    { x: hx - 100, y: hy + 100, r: 10 },
  );

  // Wilds return portal (near altar)
  const wildsPortalMat = new THREE.MeshLambertMaterial({
    color: 0xff00ff, wireframe: true,
  });
  s.wildsPortal = new THREE.Mesh(portalGeo, wildsPortalMat);
  s.wildsPortal.position.set(mapSize / 2, 30, mapSize / 2 + 60);
  s.scene.add(s.wildsPortal);
}
