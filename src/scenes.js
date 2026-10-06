import * as BABYLON from "babylonjs";
import "@babylonjs/loaders"; // registers GLTF + FBX sceneLoader plugins
import { state } from './state.js';
import { mapSize } from './constants.js';
import { loadedModels, ESMTransformNode } from './model-loader.js';
import { spawnEnemy, spawnEnemy2 } from './combat.js';
import { scatterInteractables } from './landmarks.js';
import { playSound } from './audio.js';

function mat(scene, name, hex, opts = {}) {
  const m = new BABYLON.StandardMaterial(name, scene);
  if (hex) m.diffuseColor = BABYLON.Color3.FromHexString(hex);
  if (opts.emissive) m.emissiveColor = BABYLON.Color3.FromHexString(opts.emissive);
  if (opts.opacity !== undefined) m.alpha = opts.opacity;
  if (opts.disableLighting) m.disableLighting = true;
  return m;
}

function cloneModel(key, name, scene) {
  const src = loadedModels[key];
  if (!src) return null;
  return src.clone(name, true, false);
}

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

/** Create the Babylon.js scene, camera, engine, lights, fog. */
export function initSetup() {
  const s = state;

  const canvas = document.getElementById('canvas');
  s.renderer = new BABYLON.Engine(canvas, true);
  s.scene = new BABYLON.Scene(s.renderer);
  s.scene.clearColor = new BABYLON.Color4(0.53, 0.81, 0.92, 1); // Langit biru

  // Dynamic entity mount (hot-path add/remove target)
  s.sceneMount = new ESMTransformNode("sceneMount", s.scene);

  s.camera = new BABYLON.UniversalCamera("chaseCam", new BABYLON.Vector3(0, s.cameraOffsetY, 0), s.scene);
  s.camera.minZ = 0.1;
  s.camera.maxZ = 3000;
  s.camera.fov = (50 * Math.PI) / 180;
  s.camera.setTarget(new BABYLON.Vector3(s.player.x, s.cameraLookAtY, s.player.y));
  s.camera.parent = null; // keep as free camera

  s.composer = null; // no post-processing in Phase 1

  window.addEventListener('resize', () => {
    s.renderer.resize();
  });

  // Chase-camera initial position
  s.controls = null;

  const initFacingAngle = Math.atan2(s.player.facingX, s.player.facingY);
  s.camera.position.x = s.player.x - Math.sin(initFacingAngle) * s.cameraOffsetZ;
  s.camera.position.y = s.cameraOffsetY;
  s.camera.position.z = s.player.y - Math.cos(initFacingAngle) * s.cameraOffsetZ;
  s.camera.setTarget(new BABYLON.Vector3(s.player.x, s.cameraLookAtY, s.player.y));

  // Lighting (Pencahayaan Atmosferik)
  const hemiLight = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), s.scene);
  hemiLight.intensity = 0.5;
  hemiLight.groundColor = new BABYLON.Color3(0.55, 0.55, 0.55);
  hemiLight.diffuse = BABYLON.Color3.FromHexString("#dcebf4");

  s.dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(0.4, -0.8, 0.3), s.scene);
  s.dirLight.intensity = 1.0;
  s.dirLight.diffuse = BABYLON.Color3.FromHexString("#fff5e6");
  s.dirLight.position.set(mapSize / 2 + 800, 1000, mapSize / 2 - 400);

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
  const grassTex = new BABYLON.DynamicTexture("grassTex", texCanvas, s.scene, false, true);
  grassTex.wrapMode = BABYLON.Texture.WRAPMODE_WRAP;
  grassTex.uScale = mapSize / 150;
  grassTex.vScale = mapSize / 150;

  // Floor (Terrain Bergelombang)
  const floor = BABYLON.MeshBuilder.CreateGround("mainFloor", { width: mapSize, depth: mapSize, subdivisions: 200 }, s.scene);
  const floorMat = mat(s.scene, "floorMat", null, {});
  floorMat.diffuseTexture = grassTex;
  floor.material = floorMat;

  // Displace vertices per-terrain-height (Babylon ground is already Y-up, no rotation needed)
  const floorPositions = floor.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < floorPositions.length; i += 3) {
    const vx = floorPositions[i];
    const vz = floorPositions[i + 2];
    const worldX = vx + (mapSize / 2);
    const worldY = (mapSize / 2) - vz;
    floorPositions[i + 1] = getTerrainHeight(worldX, worldY); // Y = up in Babylon
  }
  floor.updateVerticesData(BABYLON.VertexBuffer.PositionKind, floorPositions);
  floor.createNormals(true);
  floor.position.set(mapSize / 2, 0, mapSize / 2);
  s.mainFloor = floor;

  // Fog menyatu dengan langit
  s.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  s.scene.fogDensity = 0.0002;
  s.scene.fogColor = new BABYLON.Color3(0.53, 0.81, 0.92);

  // Rain (Particle system, starts disabled)
  s.rainParticles = new BABYLON.ParticleSystem("rain", 5000, s.scene);
  s.rainParticles.emitter = new BABYLON.Vector3(0, 300, 0);
  s.rainParticles.particleTexture = new BABYLON.Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAABCAYAAAA2ARhUAAAAFUlEQVR4nGNkYPjPAAAGXAD8+K8BtwAAAABJRU5ErkJggg==", s.scene);
  s.rainParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
  s.rainParticles.minSize = 0.02;
  s.rainParticles.maxSize = 0.04;
  s.rainParticles.particleMinimumLifeTime = 1.0;
  s.rainParticles.particleMaximumLifeTime = 1.5;
  s.rainParticles.emitRate = 0;
  s.rainParticles.minEmitPower = new BABYLON.Vector3(-mapSize/2, 0, -mapSize/2);
  s.rainParticles.maxEmitPower = new BABYLON.Vector3(mapSize/2, 0, mapSize/2);
  s.rainParticles.direction1 = new BABYLON.Vector3(0, -300, 0);
  s.rainParticles.direction2 = new BABYLON.Vector3(0, -500, 0);
  s.rainParticles.gravity = new BABYLON.Vector3(0, -300, 0);
  s.rainParticles.isEnabled = false;
}

// ─── Wilds map generation ──────────────────────────────────────────────────────

export function initMap() {
  const s = state;
  s.wildsGroup = new ESMTransformNode("wildsGroup", s.scene);

  const ms = mapSize;

  // Altar in the center
  const altarGroup = new ESMTransformNode("altarGroup", s.scene);
  const altarBase = BABYLON.MeshBuilder.CreateCylinder("altarBase", { diameter: 80, height: 10, tessellation: 8 }, s.scene);
  altarBase.material = mat(s.scene, "altarBaseMat", "#555555");
  altarBase.position.y = 5;
  altarBase.parent = altarGroup;
  const altarPillar = BABYLON.MeshBuilder.CreateCylinder("altarPillar", { diameterTop: 30, diameterBottom: 40, height: 30, tessellation: 8 }, s.scene);
  altarPillar.material = mat(s.scene, "altarPillarMat", "#444444");
  altarPillar.position.y = 20;
  altarPillar.parent = altarGroup;
  altarGroup.position.set(ms / 2, 0, ms / 2);
  s.wildsGroup.addChild(altarGroup);
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
      rockGroup = loadedModels.rocks_high.clone(`rock_high_${i}`, true, false);
    else if (loadedModels.rocks_low)
      rockGroup = loadedModels.rocks_low.clone(`rock_low_${i}`, true, false);
    if (rockGroup) {
      const sc = 20 + Math.random() * 15;
      rockGroup.scaling.set(sc, sc, sc);
      rockGroup.position.set(rx, getTerrainHeight(rx, ry), ry);
      rockGroup.rotation.y = Math.random() * Math.PI;
      rockGroup.parent = s.wildsGroup;
    } else {
      const rock = BABYLON.MeshBuilder.CreateSphere(`rock_${i}`, { diameter: rr * 2, tessellation: 2 }, s.scene);
      rock.material = mat(s.scene, `rockMat_${i}`, "#777777");
      rock.position.set(rx, rr + getTerrainHeight(rx, ry), ry);
      rock.rotation.y = Math.random() * Math.PI;
      rock.parent = s.wildsGroup;
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
            rockGroup = loadedModels.rocks_high.clone(`rock_high_${c}_${i}`, true, false);
          else if (rand < 0.5 && loadedModels.rocks_low)
            rockGroup = loadedModels.rocks_low.clone(`rock_low_${c}_${i}`, true, false);
          else if (loadedModels.stones)
            rockGroup = loadedModels.stones.clone(`stone_${c}_${i}`, true, false);

          if (rockGroup) {
            const sc = 30 + Math.random() * 10;
            rockGroup.scaling.set(sc, sc, sc);
            rockGroup.position.set(x, getTerrainHeight(x, y), y);
            rockGroup.rotation.y = Math.random() * Math.PI;
            rockGroup.parent = s.wildsGroup;
          } else {
            const rock = BABYLON.MeshBuilder.CreateSphere(`rock_${c}_${i}`, { diameter: r * 2, tessellation: 2 }, s.scene);
            rock.material = mat(s.scene, `rockMat_${c}_${i}`, "#777777");
            rock.position.set(x, r + getTerrainHeight(x, y), y);
            rock.rotation.y = Math.random() * Math.PI;
            rock.parent = s.wildsGroup;
          }
          s.obstaclesWilds.push({ x, y, r: r * 0.8, h: r });
        } else {
          const log = BABYLON.MeshBuilder.CreateCylinder(`log_${c}_${i}`, { diameter: 16, height: 50, tessellation: 8 }, s.scene);
          log.material = mat(s.scene, `logMat_${c}_${i}`, "#4a3219");
          log.rotation.z = Math.PI / 2;
          log.rotation.y = Math.random() * Math.PI;
          log.position.set(x, 7 + getTerrainHeight(x, y), y);
          log.parent = s.wildsGroup;
          s.obstaclesWilds.push({ x, y, r: 25, h: 16 });
        }
      } else {
        if (rand < 0.75) {
          const isHigh = Math.random() < 0.5;
          let treeGroup;
          if (isHigh && loadedModels.tree_high)
            treeGroup = loadedModels.tree_high.clone(`tree_high_${c}_${i}`, true, false);
          else if (!isHigh && loadedModels.tree)
            treeGroup = loadedModels.tree.clone(`tree_${c}_${i}`, true, false);

          if (treeGroup) {
            treeGroup.scaling.set(50, 50, 50);
          } else {
            treeGroup = new ESMTransformNode(`tree_${c}_${i}`, s.scene);
            const trunk = BABYLON.MeshBuilder.CreateCylinder(`trunk_${c}_${i}`, { diameter: 12, height: 30, tessellation: 8 }, s.scene);
            trunk.material = mat(s.scene, `trunkMat_${c}_${i}`, "#5c4033");
            trunk.position.y = 15;
            trunk.parent = treeGroup;
            const leaves = BABYLON.MeshBuilder.CreateCylinder(`leaves_${c}_${i}`, { diameterTop: 0, diameterBottom: 50, height: 55, tessellation: 8 }, s.scene);
            leaves.material = mat(s.scene, `leavesMat_${c}_${i}`, "#226b2b");
            leaves.position.y = 42;
            leaves.parent = treeGroup;
          }
          treeGroup.position.set(x, getTerrainHeight(x, y), y);
          treeGroup.parent = s.wildsGroup;
          s.obstaclesWilds.push({ x, y, r: 12, h: 60 });
        } else {
          const r = 12 + Math.random() * 12;
          let plantMesh;
          if (loadedModels.plant) {
            plantMesh = loadedModels.plant.clone(`plant_${c}_${i}`, true, false);
            plantMesh.scaling.set(20, 20, 20);
            plantMesh.position.set(x, getTerrainHeight(x, y), y);
          } else {
            plantMesh = BABYLON.MeshBuilder.CreateSphere(`plant_${c}_${i}`, { diameter: r * 2, segments: 8 }, s.scene);
            plantMesh.material = mat(s.scene, `plantMat_${c}_${i}`, "#1d5c22");
            plantMesh.position.set(x, r - 2 + getTerrainHeight(x, y), y);
          }
          plantMesh.parent = s.wildsGroup;
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
      const tent = loadedModels.tent.clone(`tent_${t}`, true, false);
      tent.scaling.set(25, 25, 25);
      tent.rotation.y = Math.random() * Math.PI * 2;
      tent.position.set(tx, getTerrainHeight(tx, ty), ty);
      tent.parent = s.wildsGroup;
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
        rockGroup = loadedModels.rocks_high.clone(`border_rock_${i}_${z}`, true, false);
        rockGroup.scaling.set(180, 250, 180); // Skala diperlebar dan ditinggikan
        rockGroup.position.set(i, -20, z);
        rockGroup.rotation.y = Math.random() * Math.PI;
        rockGroup.parent = s.wildsGroup;
      }
      s.obstaclesWilds.push({ x: i, y: z, r: 250, h: 250 }); // Obstacle diperbesar
    });
    // Left and right edges (x = 0 and x = ms)
    if (i > 0 && i < ms) {
      [0, ms].forEach(x => {
        let rockGroup;
        if (loadedModels.rocks_high) {
          rockGroup = loadedModels.rocks_high.clone(`border_rock_${i}_${x}`, true, false);
          rockGroup.scaling.set(180, 250, 180);
          rockGroup.position.set(x, -20, i);
          rockGroup.rotation.y = Math.random() * Math.PI;
          rockGroup.parent = s.wildsGroup;
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
  s.hometownGroup = new ESMTransformNode("hometownGroup", s.scene);

  const hx = 500, hy = 500;

  // Stone plaza
  if (loadedModels.patch_dirt) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (Math.hypot(dx, dz) > 3.5) continue;
        const dirt = loadedModels.patch_dirt.clone(`dirt_${dx}_${dz}`, true, false);
        dirt.scaling.set(45, 45, 45);
        const px = hx + dx * 75;
        const pz = hy + dz * 75;
        dirt.position.set(px, -2.8, pz);
        dirt.parent = s.hometownGroup;
      }
    }
  } else {
    const plazaMesh = BABYLON.MeshBuilder.CreateDisc("plazaDisc", { radius: 320, tessellation: 32 }, s.scene);
    plazaMesh.material = mat(s.scene, "plazaMat", "#6e6e6e");
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(hx, 0.5, hy);
    plazaMesh.parent = s.hometownGroup;
  }

  // Dirt paths connecting plaza to buildings
  if (loadedModels.patch_dirt) {
    function addPath(startX, startZ, endX, endZ) {
      const steps = Math.round(Math.hypot(endX - startX, endZ - startZ) / 42);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = startX + (endX - startX) * t;
        const pz = startZ + (endZ - startZ) * t;
        const dirt = loadedModels.patch_dirt.clone(`dirt_path_${Math.round(t * 100)}_${i}`, true, false);
        dirt.scaling.set(45, 45, 45);
        dirt.position.set(px, -2.8, pz);
        dirt.rotation.y = Math.atan2(endX - startX, endZ - startZ);
        dirt.parent = s.hometownGroup;
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

  // Fountain (Grand 2-Tier Central Plaza Fountain)
  const fountainMat = mat(s.scene, "fountainMat", "#aaaaaa");
  const fountain = BABYLON.MeshBuilder.CreateCylinder("fountainBase", { diameterTop: 112, diameterBottom: 128, height: 18, tessellation: 24 }, s.scene);
  fountain.material = fountainMat;
  fountain.position.set(hx, 9, hy);
  fountain.parent = s.hometownGroup;

  const waterMat = mat(s.scene, "waterMat", "#00aaff", { opacity: 0.8 });
  const water = BABYLON.MeshBuilder.CreateCylinder("fountainWater", { diameter: 104, height: 3, tessellation: 24 }, s.scene);
  water.material = waterMat;
  water.position.set(hx, 17, hy);
  water.parent = s.hometownGroup;

  const pillar = BABYLON.MeshBuilder.CreateCylinder("fountainPillar", { diameterTop: 16, diameterBottom: 20, height: 45, tessellation: 12 }, s.scene);
  pillar.material = fountainMat;
  pillar.position.set(hx, 25, hy);
  pillar.parent = s.hometownGroup;

  // Upper bowl tier
  const upperBowl = BABYLON.MeshBuilder.CreateCylinder("fountainUpperBowl", { diameterTop: 44, diameterBottom: 52, height: 8, tessellation: 16 }, s.scene);
  upperBowl.material = fountainMat;
  upperBowl.position.set(hx, 46, hy);
  upperBowl.parent = s.hometownGroup;
  const upperWater = BABYLON.MeshBuilder.CreateCylinder("fountainUpperWater", { diameter: 40, height: 2, tessellation: 16 }, s.scene);
  upperWater.material = waterMat;
  upperWater.position.set(hx, 49, hy);
  upperWater.parent = s.hometownGroup;
  const spoutTop = BABYLON.MeshBuilder.CreateCylinder("fountainSpout", { diameterTop: 8, diameterBottom: 10, height: 10, tessellation: 8 }, s.scene);
  spoutTop.material = fountainMat;
  spoutTop.position.set(hx, 53, hy);
  spoutTop.parent = s.hometownGroup;

  s.obstaclesHometown.push({ x: hx, y: hy, r: 64, h: 60 });

  // Extra decorations: stones, plants, and rocks around plaza
  function placeDecoration(x, z, r) {
    if (s.obstaclesHometown.some(o => Math.hypot(o.x - x, o.y - z) < o.r + r + 10)) return;
    const rand = Math.random();
    if (rand < 0.5 && loadedModels.stones) {
      const stone = loadedModels.stones.clone(`deco_stone_${Math.random().toString(36).slice(2, 7)}`, true, false);
      const sc = 35 + Math.random() * 15;
      stone.scaling.set(sc, sc, sc);
      stone.position.set(x, 0, z);
      stone.rotation.y = Math.random() * Math.PI;
      stone.parent = s.hometownGroup;
    } else if (rand < 0.8 && loadedModels.plant) {
      const plant = loadedModels.plant.clone(`deco_plant_${Math.random().toString(36).slice(2, 7)}`, true, false);
      plant.scaling.set(28, 28, 28);
      plant.position.set(x, 0, z);
      plant.parent = s.hometownGroup;
    } else {
      const rockR = (r || 16);
      const rock = BABYLON.MeshBuilder.CreateSphere(`deco_rock_${Math.random().toString(36).slice(2, 7)}`, { diameter: rockR * 2, tessellation: 2 }, s.scene);
      rock.material = mat(s.scene, "decoRockMat", "#888888");
      rock.position.set(x, rockR + getTerrainHeight(x, z), z);
      rock.parent = s.hometownGroup;
    }
    s.obstaclesHometown.push({ x, y: z, r: (r || 16) * 0.7, h: (r || 16) });
  }
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 220 + Math.random() * 220;
    placeDecoration(hx + Math.cos(angle) * dist, hy + Math.sin(angle) * dist, 12 + Math.random() * 12);
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
      const grp = new ESMTransformNode(`building_struct_roof_${modelKey}`, s.scene);
      const bs = loadedModels.building_struct.clone(`building_struct_${Math.random().toString(36).slice(2, 7)}`, true, false);
      const br = loadedModels.building_roof.clone(`building_roof_${Math.random().toString(36).slice(2, 7)}`, true, false);
      bs.parent = grp;
      br.parent = grp;
      grp.scaling.set(80, 80, 80);
      return grp;
    }
    // --- building platform ---
    if ((modelKey === 'building_platform' || modelKey === 'struct_roof') && loadedModels.building_platform) {
      const grp = loadedModels.building_platform.clone(`building_platform_${Math.random().toString(36).slice(2, 7)}`, true, false);
      grp.scaling.set(65, 65, 65);
      return grp;
    }
    // --- house (default & fallback) ---
    if (loadedModels.house) {
      const grp = loadedModels.house.clone(`house_${Math.random().toString(36).slice(2, 7)}`, true, false);
      grp.scaling.set(60, 60, 60);
      return grp;
    }
    // --- last resort: struct alone ---
    if (loadedModels.building_struct) {
      const grp = new ESMTransformNode(`building_struct_only`, s.scene);
      const bs = loadedModels.building_struct.clone(`building_struct_alone_${Math.random().toString(36).slice(2, 7)}`, true, false);
      if (loadedModels.building_roof) {
        const br = loadedModels.building_roof.clone(`building_roof_alone_${Math.random().toString(36).slice(2, 7)}`, true, false);
        br.parent = grp;
      }
      bs.parent = grp;
      grp.scaling.set(80, 80, 80);
      return grp;
    }
    // --- prosedural geometry jika SEMUA model gagal ---
    console.warn('[makeBuilding] Semua model gagal dimuat, pakai prosedural geometry');
    const grp = new ESMTransformNode(`building_procedural`, s.scene);
    const base = BABYLON.MeshBuilder.CreateBox(`building_base_${Math.random().toString(36).slice(2, 7)}`, { width: 110, height: 75, depth: 110 }, s.scene);
    base.material = mat(s.scene, "buildingBaseMat", "#ddd3c6");
    base.position.y = 37.5;
    base.parent = grp;
    const roof = BABYLON.MeshBuilder.CreateCylinder(`building_roof_${Math.random().toString(36).slice(2, 7)}`, { diameterTop: 0, diameterBottom: 170, height: 55, tessellation: 4 }, s.scene);
    roof.material = mat(s.scene, "buildingRoofMat", "#8b2e2e");
    roof.position.y = 100;
    roof.rotation.y = Math.PI / 4;
    roof.parent = grp;
    return grp;
  }

  housePositions.forEach((p, idx) => {
    const hGroup = makeBuilding(p.model);
    hGroup.position.set(hx + p.x, 0, hy + p.z);
    hGroup.rotation.y = p.r;
    hGroup.parent = s.hometownGroup;
    s.obstaclesHometown.push({ x: hx + p.x, y: hy + p.z, r: 70, h: 140 });
  });

  // Pagar persegi di sekeliling tiap bangunan (2 sisi saja)
  if (loadedModels.fence) {
    function addBuildingFence(cx, cz, hw) {
      const sides = [
        { x: cx, z: cz - hw, ry: 0 },
        { x: cx, z: cz + hw, ry: Math.PI },
      ];
      for (const side of sides) {
        const fence = loadedModels.fence.clone(`fence_${cx}_${cz}_${Math.random().toString(36).slice(2, 5)}`, true, false);
        fence.scaling.set(45, 45, 45);
        fence.rotation.y = side.ry;
        fence.position.set(side.x, 0, side.z);
        fence.parent = s.hometownGroup;
      }
    }
    addBuildingFence(hx - 300, hy - 300, 85);
    addBuildingFence(hx + 300, hy + 300, 85);
    addBuildingFence(hx - 300, hy + 300, 85);
    addBuildingFence(hx + 400, hy - 100, 85);
    addBuildingFence(hx - 400, hy + 100, 85);
    addBuildingFence(hx + 260, hy - 320, 85);
    addBuildingFence(hx - 200, hy - 200, 65);
    addBuildingFence(hx + 200, hy - 200, 65);
    addBuildingFence(hx - 200, hy + 200, 65);
  }

  // Target dummy
  if (loadedModels.target) {
    const target = loadedModels.target.clone("target_dummy", true, false);
    target.scaling.set(52, 52, 52);
    target.position.set(hx + 160, 0, hy - 300);
    target.rotation.y = Math.PI / 4;
    target.parent = s.hometownGroup;
    s.obstaclesHometown.push({ x: hx + 160, y: hy - 300, r: 22, h: 55 });
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
      const fence = loadedModels.fence.clone(`fence_perim_${Math.random().toString(36).slice(2, 5)}`, true, false);
      fence.scaling.set(38, 38, 38);
      fence.rotation.y = fp.ry;
      fence.position.set(fp.x, 0, fp.z);
      fence.parent = s.hometownGroup;
      s.obstaclesHometown.push({ x: fp.x, y: fp.z, r: 20, h: 30 });
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
      eGroup.parent = s.hometownGroup;
      s.obstaclesHometown.push({ x: eb.x, y: eb.z, r: 70, h: 140 });
    }
  }

  // Shop stall
  let stallGroup;
  if (loadedModels.tent) {
    stallGroup = loadedModels.tent.clone(`stall_tent`, true, false);
    stallGroup.scaling.set(60, 60, 60);
  } else {
    stallGroup = new ESMTransformNode("stallGroup", s.scene);
    const poleMat = mat(s.scene, "poleMat", "#5c4033");
    [[-32, 32.5, -32], [32, 32.5, -32], [-32, 32.5, 32], [32, 32.5, 32]].forEach(([px, py, pz], i) => {
      const p = BABYLON.MeshBuilder.CreateCylinder(`stallPole_${i}`, { diameter: 6, height: 65, tessellation: 4 }, s.scene);
      p.material = poleMat;
      p.position.set(px, py, pz);
      p.parent = stallGroup;
    });
    const awning = BABYLON.MeshBuilder.CreateGround("stallAwning", { width: 85, depth: 85, updatable: true }, s.scene);
    awning.material = mat(s.scene, "awningMat", "#ffaa00", { opacity: 1 });
    awning.material.backFaceCulling = false;
    awning.rotation.x = -Math.PI / 2 + 0.2;
    awning.position.y = 66;
    awning.parent = stallGroup;
    const table = BABYLON.MeshBuilder.CreateBox("stallTable", { width: 50, height: 22, depth: 24 }, s.scene);
    table.material = mat(s.scene, "tableMat", "#6e4a2b");
    table.position.set(0, 11, 15);
    table.parent = stallGroup;
  }
  stallGroup.position.set(hx - 200, 0, hy - 200);
  stallGroup.parent = s.hometownGroup;

  // Healer shrine
  let shrineGroup;
  if (loadedModels.building_platform) {
    shrineGroup = loadedModels.building_platform.clone(`shrine_platform`, true, false);
    shrineGroup.scaling.set(65, 65, 65);
  } else {
    shrineGroup = new ESMTransformNode("shrineGroup", s.scene);
    const sBaseMat = mat(s.scene, "shrineBaseMat", "#ffffff");
    const sBase = BABYLON.MeshBuilder.CreateCylinder("shrineBase", { diameter: 80, height: 8, tessellation: 8 }, s.scene);
    sBase.material = sBaseMat;
    sBase.position.y = 4;
    sBase.parent = shrineGroup;
    for (let i = 0; i < 4; i++) {
      const sp = BABYLON.MeshBuilder.CreateCylinder(`shrinePole_${i}`, { diameter: 6, height: 60, tessellation: 4 }, s.scene);
      sp.material = sBaseMat;
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      sp.position.set(Math.cos(ang) * 32, 30, Math.sin(ang) * 32);
      sp.parent = shrineGroup;
    }
    const sRoof = BABYLON.MeshBuilder.CreateCylinder("shrineRoof", { diameterTop: 0, diameterBottom: 96, height: 30, tessellation: 4 }, s.scene);
    sRoof.material = mat(s.scene, "shrineRoofMat", "#00aaff");
    sRoof.position.y = 75;
    sRoof.rotation.y = Math.PI / 4;
    sRoof.parent = shrineGroup;
  }
  shrineGroup.position.set(hx + 200, 0, hy - 200);
  shrineGroup.parent = s.hometownGroup;

  // Blacksmith
  let bsGroup;
  if (loadedModels.building_struct && loadedModels.building_roof) {
    bsGroup = new ESMTransformNode("blacksmithGroup", s.scene);
    const bsStruct = loadedModels.building_struct.clone(`blacksmith_struct`, true, false);
    const bsRoof = loadedModels.building_roof.clone(`blacksmith_roof`, true, false);
    bsStruct.parent = bsGroup;
    bsRoof.parent = bsGroup;
    bsGroup.scaling.set(80, 80, 80);
  } else {
    bsGroup = new ESMTransformNode("blacksmithProcedural", s.scene);
    const anvil = BABYLON.MeshBuilder.CreateBox("blacksmithAnvil", { width: 24, height: 16, depth: 16 }, s.scene);
    anvil.material = mat(s.scene, "anvilMat", "#222222");
    anvil.position.set(0, 8, 16);
    anvil.parent = bsGroup;
    const furnace = BABYLON.MeshBuilder.CreateBox("blacksmithFurnace", { width: 32, height: 48, depth: 32 }, s.scene);
    furnace.material = mat(s.scene, "furnaceMat", "#552222");
    furnace.position.set(0, 24, -20);
    furnace.parent = bsGroup;
    const fire = BABYLON.MeshBuilder.CreateSphere("blacksmithFire", { diameter: 20, segments: 8 }, s.scene);
    fire.material = mat(s.scene, "fireMat", "#ffaa00", { emissive: "#ff5500" });
    fire.position.set(0, 16, -8);
    fire.parent = bsGroup;
  }
  bsGroup.position.set(hx - 200, 0, hy + 200);
  bsGroup.parent = s.hometownGroup;

  // Quest Board
  const qbGroup = new ESMTransformNode("questBoardGroup", s.scene);
  const board = BABYLON.MeshBuilder.CreateBox("questBoard", { width: 22, height: 16, depth: 2 }, s.scene);
  board.material = mat(s.scene, "questBoardMat", "#8b5a2b");
  board.position.y = 11;
  board.parent = qbGroup;
  const postL = BABYLON.MeshBuilder.CreateCylinder("questPostL", { diameter: 2.4, height: 18, tessellation: 12 }, s.scene);
  postL.material = mat(s.scene, "questPostMat", "#5c4033");
  postL.position.set(-9, 9, 0);
  postL.parent = qbGroup;
  const postR = BABYLON.MeshBuilder.CreateCylinder("questPostR", { diameter: 2.4, height: 18, tessellation: 12 }, s.scene);
  postR.material = postL.material;
  postR.position.set(9, 9, 0);
  postR.parent = qbGroup;
  const paper = BABYLON.MeshBuilder.CreateGround("questPaper", { width: 7, depth: 9, updatable: true }, s.scene);
  paper.material = mat(s.scene, "questPaperMat", "#eeeeee");
  paper.position.set(0, 11, 1.1);
  paper.parent = qbGroup;
  qbGroup.position.set(hx, 0, hy + 100);
  qbGroup.scaling.set(3.5, 3.5, 3.5);
  qbGroup.rotation.y = Math.PI;
  qbGroup.parent = s.hometownGroup;
  s.questBoardPos = { x: hx, z: hy + 100 };
  s.obstaclesHometown.push({ x: hx, y: hy + 100, r: 24, h: 45 });

  // Flag posts around plaza
  if (loadedModels.flag) {
    const flagPositions = [
      { x: hx - 240, z: hy - 240 },
      { x: hx + 240, z: hy - 240 },
      { x: hx - 240, z: hy + 240 },
      { x: hx + 240, z: hy + 240 },
    ];
    for (const fp of flagPositions) {
      const flag = loadedModels.flag.clone(`flag_${fp.x}_${fp.z}`, true, false);
      flag.scaling.set(40, 40, 40);
      flag.position.set(fp.x, 0, fp.z);
      flag.parent = s.hometownGroup;
      s.obstaclesHometown.push({ x: fp.x, y: fp.z, r: 16, h: 60 });
    }
  }
}

// ─── Entity creation (enemies, player, items) ────────────────────────────────

export function initEntities() {
  const s = state;


  // Coins removed for inventory system

  // Player mesh
  s.playerBodyMat = mat(s.scene, "playerBodyMat", "#aaaaaa");
  s.playerBladeMat = mat(s.scene, "playerBladeMat", "#eeeeee");
  window.playerBodyMat = s.playerBodyMat;
  window.playerBladeMat = s.playerBladeMat;
  s.playerMesh = new ESMTransformNode("playerMesh", s.scene);

  if (loadedModels.player_model) {
    const fbxModel = loadedModels.player_model.clone("player_model_instance", true, false);
    fbxModel.scaling.set(0.3, 0.3, 0.3); // Scale diperkecil sedikit agar pas
    fbxModel.position.y = -15;

    // Setup Animasi — Phase 1 placeholder: Babylon skeleton-anim layer not yet wired.
    s.playerMixer = null;
    s.playerActions = {};
    s.activeAction = null;

    // Cari tulang tangan kanan (MixamoRig:RightHand) untuk menempelkan pedang
    let rightHand = null;
    const fbxDescendants = fbxModel.getDescendants();
    for (const c of fbxDescendants) {
      if (c.name && c.name.toLowerCase().includes('righthand') && !rightHand) {
        rightHand = c;
      }
    }

    if (loadedModels.sword) {
      const gltfSword = loadedModels.sword.clone("sword_instance", true, false);
      s.playerSwordMesh = gltfSword;
      // We no longer replace the material here; we'll let it use the arrow's native material.
      // ui.js will handle cloning and coloring it.

      if (rightHand) {
        gltfSword.scaling.set(100, 180, 320);
        // Simpan skala awal agar tidak tertimpa saat ganti senjata
        s.swordBaseScale = { x: 100, y: 180, z: 320 };
        gltfSword.position.set(43, 8, -20);
        gltfSword.rotation.set(Math.PI, Math.PI / 3, 0);
        gltfSword.rotationQuaternion = BABYLON.Quaternion.FromAxisAngle(BABYLON.Axis.X, Math.PI);
        rightHand.addChild(gltfSword);
      } else {
        gltfSword.scaling.set(15, 15, 15);
        gltfSword.position.set(10, 0, 15);
        gltfSword.parent = s.playerMesh;
      }
    }

    fbxModel.parent = s.playerMesh;
    s.gltfPlayerRef = fbxModel;
  } else if (loadedModels.player) {
    s.gltfPlayerRef = loadedModels.player.clone("player_instance", true, false);
    s.gltfPlayerRef.scaling.set(35, 35, 35);
    s.gltfPlayerRef.position.y = -15;

    // Phase 1: Babylon skeleton-anim layer not yet wired.
    s.playerMixer = null;
    s.playerActions = {};
    s.activeAction = null;

    // Still try to find arm-right / limb objects for sword attachment
    const playerDescendants = s.gltfPlayerRef.getDescendants();
    s.playerArmR = playerDescendants.find(c => c.name === 'arm-right') || null;
    s.playerLegL = playerDescendants.find(c => c.name === 'leg-left') || null;
    s.playerLegR = playerDescendants.find(c => c.name === 'leg-right') || null;
    s.playerArmL = playerDescendants.find(c => c.name === 'arm-left') || null;

    s.gltfPlayerRef.parent = s.playerMesh;

    if (loadedModels.sword) {
      s.playerSwordMesh = loadedModels.sword.clone("sword_instance", true, false);
      s.playerBladeMat = mat(s.scene, "playerBladeMat", "#cccccc");
      const swordDescendants = s.playerSwordMesh.getDescendants();
      for (const c of swordDescendants) {
        if (c.material) {
          c.material = s.playerBladeMat;
        }
      }
      if (s.playerArmR) {
        // Attach to character's right arm
        s.playerSwordMesh.position.set(0, -0.4, 0.2);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerArmR.addChild(s.playerSwordMesh);
      } else {
        // Fallback attachment
        s.playerSwordMesh.scaling.set(15, 15, 15);
        s.playerSwordMesh.position.set(10, 0, 15);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerSwordMesh.parent = s.playerMesh;
      }
    } else {
      // Create programmatic sword as fallback
      s.playerSwordMesh = new ESMTransformNode("playerSwordFallback", s.scene);

      const blade = BABYLON.MeshBuilder.CreateBox("swordBlade", { width: 0.1, height: 1.2, depth: 0.2 }, s.scene);
      s.playerBladeMat = mat(s.scene, "playerBladeMat", "#cccccc");
      blade.material = s.playerBladeMat;
      blade.position.y = 0.6;
      blade.parent = s.playerSwordMesh;

      const hiltMat = mat(s.scene, "swordHiltMat", "#5c4033");
      const hilt = BABYLON.MeshBuilder.CreateBox("swordHilt", { width: 0.4, height: 0.1, depth: 0.3 }, s.scene);
      hilt.material = hiltMat;
      hilt.parent = s.playerSwordMesh;

      const handle = BABYLON.MeshBuilder.CreateBox("swordHandle", { width: 0.1, height: 0.3, depth: 0.1 }, s.scene);
      handle.material = hiltMat;
      handle.position.y = -0.15;
      handle.parent = s.playerSwordMesh;

      if (s.playerArmR) {
        // Attach to character's right arm
        s.playerSwordMesh.position.set(0, -0.4, 0.2);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerArmR.addChild(s.playerSwordMesh);
      } else {
        // Fallback attachment
        s.playerSwordMesh.scaling.set(15, 15, 15);
        s.playerSwordMesh.position.set(10, 0, 15);
        s.playerSwordMesh.rotation.x = Math.PI / 2;
        s.playerSwordMesh.parent = s.playerMesh;
      }
    }
  } else {
    // Classic fallback boxes
    s.playerMesh = createFallbackPlayer();
  }

  s.playerMesh.position.set(s.player.x, 15, s.player.y);
  s.playerMesh.parent = s.sceneMount;

  // Player HP Bar
  const pHpBg = BABYLON.MeshBuilder.CreateGround("playerHpBg", { width: 30, depth: 4, updatable: true }, s.scene);
  pHpBg.material = mat(s.scene, "playerHpBgMat", "#000000", { disableLighting: true });
  s.playerHpFg = BABYLON.MeshBuilder.CreateGround("playerHpFg", { width: 30, depth: 4, updatable: true }, s.scene);
  s.playerHpFg.material = mat(s.scene, "playerHpFgMat", "#008800", { disableLighting: true });
  s.playerHpFg.position.z = 0.2;
  s.playerHpGroup = new ESMTransformNode("playerHpGroup", s.scene);
  pHpBg.parent = s.playerHpGroup;
  s.playerHpFg.parent = s.playerHpGroup;
  s.playerHpGroup.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  s.playerHpGroup.parent = s.sceneMount;


  // Shield visual
  const shieldMesh = BABYLON.MeshBuilder.CreateSphere("shieldMesh", { diameter: 48, segments: 16 }, s.scene);
  const shieldMat = mat(s.scene, "shieldMat", "#00aaff", { opacity: 0.5 });
  shieldMat.wireframe = true;
  shieldMesh.material = shieldMat;
  s.shieldMesh = shieldMesh;
  s.shieldMesh.setEnabled(false);
  s.shieldMesh.parent = s.playerMesh;

  // Companion fairy pet
  s.petMesh = BABYLON.MeshBuilder.CreateSphere("petMesh", { diameter: 6, segments: 8 }, s.scene);
  const petMat = mat(s.scene, "petMat", "#ffffaa");
  petMat.wireframe = true;
  s.petMesh.material = petMat;
  s.petMesh.parent = s.sceneMount;
}

function createFallbackPlayer() {
  const s = state;
  const g = new ESMTransformNode("fallbackPlayer", s.scene);
  const legMat = mat(s.scene, "legMat", "#555555");

  g.leftHip = new ESMTransformNode("fallbackLeftHip", s.scene);
  g.leftHip.position.set(0, -3, -3.5);
  const leftHipBox = BABYLON.MeshBuilder.CreateBox("leftHipBox", { width: 6, height: 12, depth: 6 }, s.scene);
  leftHipBox.material = legMat;
  leftHipBox.position.set(0, -6, 0);
  leftHipBox.parent = g.leftHip;
  g.leftHip.parent = g;

  g.rightHip = new ESMTransformNode("fallbackRightHip", s.scene);
  g.rightHip.position.set(0, -3, 3.5);
  const rightHipBox = BABYLON.MeshBuilder.CreateBox("rightHipBox", { width: 6, height: 12, depth: 6 }, s.scene);
  rightHipBox.material = legMat;
  rightHipBox.position.set(0, -6, 0);
  rightHipBox.parent = g.rightHip;
  g.rightHip.parent = g;

  const body = BABYLON.MeshBuilder.CreateBox("fallbackBody", { width: 14, height: 20, depth: 14 }, s.scene);
  body.material = window.playerBodyMat;
  body.position.y = 7;
  body.parent = g;

  const headMat = mat(s.scene, "headMat", "#ffccaa");
  const head = BABYLON.MeshBuilder.CreateSphere("fallbackHead", { diameter: 12, segments: 16 }, s.scene);
  head.material = headMat;
  head.position.y = 21;
  head.parent = g;

  // Helm: use a full sphere as visual fallback (no hemisphere primitive in Babylon MeshBuilder)
  const helm = BABYLON.MeshBuilder.CreateSphere("fallbackHelm", { diameter: 13, segments: 16 }, s.scene);
  helm.material = mat(s.scene, "helmMat", "#778899");
  helm.position.y = 21;
  helm.parent = g;

  const swordGroup = new ESMTransformNode("fallbackSwordGroup", s.scene);
  const hilt = BABYLON.MeshBuilder.CreateBox("fallbackHilt", { width: 2, height: 6, depth: 2 }, s.scene);
  hilt.material = mat(s.scene, "fallbackHiltMat", "#5c4033");
  hilt.parent = swordGroup;
  const blade = BABYLON.MeshBuilder.CreateBox("fallbackBlade", { width: 16, height: 2, depth: 4 }, s.scene);
  blade.material = window.playerBladeMat;
  blade.position.x = 9;
  blade.parent = swordGroup;
  swordGroup.position.set(0, 7, 9);
  swordGroup.parent = g;

  const pShield = BABYLON.MeshBuilder.CreateCylinder("fallbackShield", { diameter: 16, height: 2, tessellation: 16 }, s.scene);
  pShield.material = mat(s.scene, "pShieldMat", "#8b4513");
  pShield.rotation.x = Math.PI / 2;
  pShield.position.set(0, 7, -9);
  pShield.parent = g;

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
  // Phase 1: Babylon's getBoundingInfo isn't reliable on freshly-cloned complex nodes,
  // so use a fixed heuristic — the GLB chars in this project are ~50 units tall natively.
  const EST_NATIVE_HEIGHT = 50;
  const sc = targetHeight / EST_NATIVE_HEIGHT;
  mesh.scaling.set(sc, sc, sc);
}

function createPortal(color) {
  const s = state;
  const group = new ESMTransformNode(`portal_group_${color}`, s.scene);
  const baseOffset = -30; // Mengimbangi posisi Y=30 dari map generator agar portal menyentuh tanah

  // 1. Cincin Rune Dasar (Di Tanah)
  const ringMat = mat(s.scene, `portalRingMat_${color}`, null, { opacity: 0.9 });
  ringMat.diffuseColor = BABYLON.Color3.FromHexString("#" + color.toString(16).padStart(6, "0"));
  ringMat.emissiveColor = ringMat.diffuseColor;
  ringMat.backFaceCulling = false;
  const ring = BABYLON.MeshBuilder.CreateTorus(`portalRing_${color}`, { diameter: 40, thickness: 3, tessellation: 32 }, s.scene);
  ring.material = ringMat;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = baseOffset + 1;
  ring.parent = group;

  // 2. Inti Cahaya Bercahaya (Di Tanah)
  const discMat = mat(s.scene, `portalDiscMat_${color}`, "#ffffff", { opacity: 0.8, disableLighting: true });
  discMat.emissiveColor = BABYLON.Color3.FromHexString("#ffffff");
  discMat.backFaceCulling = false;
  discMat.blendMode = BABYLON.Engine.BLENDMODEONEONE;
  const disc = BABYLON.MeshBuilder.CreateDisc(`portalDisc_${color}`, { radius: 18, tessellation: 32 }, s.scene);
  disc.material = discMat;
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = baseOffset + 1.2;
  disc.parent = group;

  // 3. Pilar Cahaya Vertikal
  const beamMat = mat(s.scene, `portalBeamMat_${color}`, null, { opacity: 0.4, disableLighting: true });
  beamMat.diffuseColor = BABYLON.Color3.FromHexString("#" + color.toString(16).padStart(6, "0"));
  beamMat.emissiveColor = beamMat.diffuseColor;
  beamMat.backFaceCulling = false;
  beamMat.blendMode = BABYLON.Engine.BLENDMODEONEONE;
  const beam = BABYLON.MeshBuilder.CreateCylinder(`portalBeam_${color}`, { diameterTop: 32, diameterBottom: 40, height: 200, tessellation: 32 }, s.scene);
  beam.material = beamMat;
  beam.position.y = baseOffset + 100; // Tengah dari silinder tinggi 200
  beam.parent = group;

  // 4. Inti Pilar yang Terang
  const coreMat = mat(s.scene, `portalCoreMat_${color}`, "#ffffff", { opacity: 0.6, disableLighting: true });
  coreMat.emissiveColor = BABYLON.Color3.FromHexString("#ffffff");
  coreMat.backFaceCulling = false;
  coreMat.blendMode = BABYLON.Engine.BLENDMODEONEONE;
  const core = BABYLON.MeshBuilder.CreateCylinder(`portalCore_${color}`, { diameter: 12, height: 200, tessellation: 16 }, s.scene);
  core.material = coreMat;
  core.position.y = baseOffset + 100;
  core.parent = group;

  // 5. Cincin Energi Melayang
  const ribbons = [];
  for (let i = 0; i < 4; i++) {
    const ribbonMat = mat(s.scene, `portalRibbonMat_${color}_${i}`, "#ffffff", { opacity: 0.8, disableLighting: true });
    ribbonMat.emissiveColor = BABYLON.Color3.FromHexString("#ffffff");
    ribbonMat.backFaceCulling = false;
    ribbonMat.blendMode = BABYLON.Engine.BLENDMODEONEONE;
    const ribbon = BABYLON.MeshBuilder.CreateTorus(`portalRibbon_${color}_${i}`, { diameter: (22 - i * 1.5) * 2, thickness: 1.6, tessellation: 32 }, s.scene);
    ribbon.material = ribbonMat;
    ribbon.rotation.x = -Math.PI / 2;
    ribbon.portalAnimData = {
      offsetY: i * 45,
      speed: 30 + i * 10,
      scalePhase: i * Math.PI / 2,
      baseOffset
    };
    ribbon.parent = group;
    ribbons.push(ribbon);
  }

  // 6. Pencahayaan Portal
  const light = new BABYLON.PointLight(`portalLight_${color}`, new BABYLON.Vector3(0, baseOffset + 20, 0), s.scene);
  light.diffuse = BABYLON.Color3.FromHexString("#" + color.toString(16).padStart(6, "0"));
  light.intensity = 1.0;
  light.range = 300;
  light.parent = group;

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
      p.beam.material.alpha = pulse;
      p.beam.scaling.set(1 + Math.sin(t * 6) * 0.05, 1, 1 + Math.cos(t * 6) * 0.05);
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
        const heightPhase = (r.portalAnimData.offsetY + t * r.portalAnimData.speed) % 200;
        r.position.y = r.portalAnimData.baseOffset + heightPhase;

        // Spin ring
        r.rotation.z = -(t * 3.0 + i);

        // Pulse scale
        const sScale = 1 + Math.sin(t * 5 + r.portalAnimData.scalePhase) * 0.15;
        r.scaling.set(sScale, sScale, sScale);

        // Fade out as it reaches the top
        r.material.alpha = 1.0 - (heightPhase / 200);
      }
    }
  }
}

export function initNPCs() {
  const s = state;
  const hx = 500, hy = 500;
  const NPC_HEIGHT = 52; // Skala tinggi manusia dewasa proporsional dengan player (~52-54 unit)

  // Portal to Wilds
  s.hometownPortal = createPortal(0x00ffff);
  s.hometownPortal.group.position.set(hx, 30, hy + 400);
  s.hometownPortal.group.parent = s.hometownGroup;

  // Shop NPC
  if (loadedModels.char_b) {
    const shopMesh = loadedModels.char_b.clone("shopNPC_mesh", true, false);
    scaleNPCToHeight(shopMesh, NPC_HEIGHT);
    s.shopNPC = new ESMTransformNode("shopNPC", s.scene);
    shopMesh.parent = s.shopNPC;
  } else {
    s.shopNPC = BABYLON.MeshBuilder.CreateCylinder("shopNPC_fallback", { diameter: 22, height: 48, tessellation: 8 }, s.scene);
    s.shopNPC.material = mat(s.scene, "shopNPCMat", "#ffd700");
    s.shopNPC.position.y = 24;
  }
  s.shopNPC.position.set(hx - 200, 0, hy - 200);
  s.shopNPC.parent = s.hometownGroup;

  // Healer NPC
  if (loadedModels.char_c) {
    const healerMesh = loadedModels.char_c.clone("healerNPC_mesh", true, false);
    scaleNPCToHeight(healerMesh, NPC_HEIGHT);
    s.healerNPC = new ESMTransformNode("healerNPC", s.scene);
    healerMesh.parent = s.healerNPC;
  } else {
    s.healerNPC = BABYLON.MeshBuilder.CreateCylinder("healerNPC_fallback", { diameter: 22, height: 48, tessellation: 8 }, s.scene);
    s.healerNPC.material = mat(s.scene, "healerNPCMat", "#ff66cc");
    s.healerNPC.position.y = 24;
  }
  s.healerNPC.position.set(hx + 200, 0, hy - 200);
  s.healerNPC.parent = s.hometownGroup;

  // Blacksmith NPC
  if (loadedModels.char_d) {
    const bsMesh = loadedModels.char_d.clone("blacksmithNPC_mesh", true, false);
    scaleNPCToHeight(bsMesh, NPC_HEIGHT);
    s.blacksmithNPC = new ESMTransformNode("blacksmithNPC", s.scene);
    bsMesh.parent = s.blacksmithNPC;
  } else {
    s.blacksmithNPC = BABYLON.MeshBuilder.CreateCylinder("blacksmithNPC_fallback", { diameter: 24, height: 48, tessellation: 8 }, s.scene);
    s.blacksmithNPC.material = mat(s.scene, "blacksmithNPCMat", "#333333");
    s.blacksmithNPC.position.y = 24;
  }
  s.blacksmithNPC.position.set(hx - 200, 0, hy + 200);
  s.blacksmithNPC.parent = s.hometownGroup;

  // ── Village Inn / Tavern (Penginapan Desa) ──
  const innGroup = new ESMTransformNode("innGroup", s.scene);
  const counterMat = mat(s.scene, "innCounterMat", "#5c4033");
  const counter = BABYLON.MeshBuilder.CreateBox("innCounter", { width: 60, height: 20, depth: 24 }, s.scene);
  counter.material = counterMat;
  counter.position.set(0, 10, 0);
  counter.parent = innGroup;

  // Mugs & Stools
  const mugMat = mat(s.scene, "innMugMat", "#d4ac0d");
  [-14, 0, 14].forEach((mx, i) => {
    const mug = BABYLON.MeshBuilder.CreateCylinder(`innMug_${i}`, { diameter: 4, height: 4, tessellation: 6 }, s.scene);
    mug.material = mugMat;
    mug.position.set(mx, 22, 0);
    mug.parent = innGroup;
  });
  const stoolMat = mat(s.scene, "innStoolMat", "#4a3219");
  [-16, 16].forEach((sx, i) => {
    const stool = BABYLON.MeshBuilder.CreateCylinder(`innStool_${i}`, { diameter: 11, height: 11, tessellation: 8 }, s.scene);
    stool.material = stoolMat;
    stool.position.set(sx, 5.5, -20);
    stool.parent = innGroup;
  });

  // Warm Lantern Post
  const lanternPost = BABYLON.MeshBuilder.CreateCylinder("innLanternPost", { diameterTop: 2.4, diameterBottom: 3, height: 36, tessellation: 12 }, s.scene);
  lanternPost.material = counterMat;
  lanternPost.position.set(26, 18, -6);
  lanternPost.parent = innGroup;
  const lanternLight = new BABYLON.PointLight("innLanternLight", new BABYLON.Vector3(26, 36, -6), s.scene);
  lanternLight.diffuse = BABYLON.Color3.FromHexString("#ffaa44");
  lanternLight.intensity = 0.5;
  lanternLight.range = 160;
  lanternLight.parent = innGroup;

  // Signpost: Penginapan Desa
  const signGroup = new ESMTransformNode("innSignGroup", s.scene);
  const signBoard = BABYLON.MeshBuilder.CreateBox("innSignBoard", { width: 34, height: 14, depth: 3 }, s.scene);
  signBoard.material = mat(s.scene, "innSignMat", "#7f4f24");
  signBoard.position.set(0, 26, 0);
  signBoard.parent = signGroup;
  const signPostMesh = BABYLON.MeshBuilder.CreateCylinder("innSignPost", { diameter: 2.4, height: 30, tessellation: 12 }, s.scene);
  signPostMesh.material = counterMat;
  signPostMesh.position.set(0, 15, 0);
  signPostMesh.parent = signGroup;
  signGroup.position.set(-28, 0, -12);
  signGroup.parent = innGroup;

  innGroup.position.set(hx + 300, 0, hy + 260);
  innGroup.rotation.y = Math.PI;
  innGroup.parent = s.hometownGroup;
  s.innSignPos = { x: hx + 300, z: hy + 260 };
  s.obstaclesHometown.push({ x: hx + 300, y: hy + 260, r: 40, h: 50 });

  // Innkeeper NPC (Paman Bob)
  if (loadedModels.char_h || loadedModels.char_a) {
    const innSrc = loadedModels.char_h || loadedModels.char_a;
    const innMesh = innSrc.clone("innNPC_mesh", true, false);
    scaleNPCToHeight(innMesh, NPC_HEIGHT);
    s.innNPC = new ESMTransformNode("innNPC", s.scene);
    innMesh.parent = s.innNPC;
    s.innNPC.position.set(hx + 300, 0, hy + 288);
    s.innNPC.parent = s.hometownGroup;
  }

  // ── Living Wandering Villagers (Warga Desa yang Berkeliling) ──
  s.villagers = [
    {
      id: 'elder',
      name: 'Tetua Timothy',
      role: 'Tetua Desa',
      modelKey: 'char_a',
      x: hx + 40, z: hy + 40,
      mesh: null,
      patrol: [
        { x: hx + 40, z: hy + 40 },
        { x: hx + 70, z: hy - 50 },
        { x: hx - 50, z: hy - 60 },
        { x: hx - 60, z: hy + 50 },
      ],
      patrolIdx: 0,
      speed: 0.65,
      walkCycle: 0,
      speech: [
        "Dahulu kerajaan kita sangat megah dan damai sebelum sang Golem terlelap...",
        "Berhati-hatilah jika melangkah jauh ke dalam hutan berkabut!",
        "Jika tubuhmu lelah, beristirahatlah di Penginapan Paman Bob di sebelah timur.",
      ]
    },
    {
      id: 'guard_portal',
      name: 'Ksatria Donald',
      role: 'Penjaga Gerbang',
      modelKey: 'arena_soldier',
      x: hx, z: hy + 300,
      mesh: null,
      patrol: [
        { x: hx - 50, z: hy + 340 },
        { x: hx + 50, z: hy + 340 },
        { x: hx + 50, z: hy + 250 },
        { x: hx - 50, z: hy + 250 },
      ],
      patrolIdx: 0,
      speed: 0.85,
      walkCycle: 0,
      speech: [
        "Gerbang Hutan aman dalam pengawasan! Waspadalah selalu, Ksatria!",
        "Monster di luar sana bertambah kuat dan buas seiring jauhnya perjalananmu.",
        "Pedang yang tajam dan ramuan penawar racun adalah kunci bertahan hidup.",
      ]
    },
    {
      id: 'merchant_finn',
      name: 'Pengembara Finn',
      role: 'Pedagang Keliling',
      modelKey: 'char_g',
      x: hx - 120, z: hy - 120,
      mesh: null,
      patrol: [
        { x: hx - 140, z: hy - 150 },
        { x: hx - 50, z: hy - 60 },
        { x: hx - 120, z: hy - 40 },
      ],
      patrolIdx: 0,
      speed: 0.7,
      walkCycle: 0,
      speech: [
        "Aku baru kembali dari perbatasan Scorched Dunes, pasirnya menyengat luar biasa!",
        "Jangan lupa menempa perlengkapanmu di Brutus si Pandai Besi.",
        "Koin emas yang kau dapat dari monster bisa membeli banyak bekal berharga.",
      ]
    },
    {
      id: 'farmer_maya',
      name: 'Petani Maya',
      role: 'Warga Desa',
      modelKey: 'char_f',
      x: hx + 140, z: hy + 80,
      mesh: null,
      patrol: [
        { x: hx + 140, z: hy + 80 },
        { x: hx + 200, z: hy + 140 },
        { x: hx + 140, z: hy + 190 },
      ],
      patrolIdx: 0,
      speed: 0.55,
      walkCycle: 0,
      speech: [
        "Udara di desa kita selalu segar dan menenangkan hati.",
        "Ayam-ayam di pekarangan selalu riang menyambut pagi hari.",
        "Senang melihat pahlawan tangguh sepertimu melindungi desa kami!",
      ]
    },
  ];

  s.villagers.forEach((v, vIdx) => {
    const raw = loadedModels[v.modelKey] || loadedModels.char_b || loadedModels.char_a;
    if (raw) {
      const vMesh = raw.clone(`villager_${v.id}`, true, false);
      scaleNPCToHeight(vMesh, NPC_HEIGHT);
      v.mesh = new ESMTransformNode(`villager_${v.id}_group`, s.scene);
      vMesh.parent = v.mesh;
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.parent = s.hometownGroup;

      // Cache limb objects for natural human walking animation
      const vDesc = vMesh.getDescendants();
      v.legL = vDesc.find(c => c.name === 'leg-left');
      v.legR = vDesc.find(c => c.name === 'leg-right');
      v.armL = vDesc.find(c => c.name === 'arm-left');
      v.armR = vDesc.find(c => c.name === 'arm-right');
      v.head = vDesc.find(c => c.name === 'head');
    }
  });

  // ── Village Animals (Buddy si Anjing & Ayam-ayam Desa) ──
  s.villageAnimals = [];

  // Buddy the Dog
  const dogMesh = new ESMTransformNode("dogMesh", s.scene);
  const dogBodyMat = mat(s.scene, "dogBodyMat", "#8b5a2b");
  const dogDarkMat = mat(s.scene, "dogDarkMat", "#3d2714");
  const dogNoseMat = mat(s.scene, "dogNoseMat", "#111111");

  const dBody = BABYLON.MeshBuilder.CreateBox("dogBody", { width: 9, height: 7, depth: 14 }, s.scene);
  dBody.material = dogBodyMat;
  dBody.position.y = 6.5;
  dBody.parent = dogMesh;
  const dHead = BABYLON.MeshBuilder.CreateBox("dogHead", { width: 6, height: 6, depth: 6 }, s.scene);
  dHead.material = dogBodyMat;
  dHead.position.set(0, 11, 7);
  dHead.parent = dogMesh;
  const dSnout = BABYLON.MeshBuilder.CreateBox("dogSnout", { width: 4, height: 3.5, depth: 5 }, s.scene);
  dSnout.material = dogDarkMat;
  dSnout.position.set(0, 9.5, 10.5);
  dSnout.parent = dogMesh;
  const dNose = BABYLON.MeshBuilder.CreateBox("dogNose", { width: 1.8, height: 1.8, depth: 1.8 }, s.scene);
  dNose.material = dogNoseMat;
  dNose.position.set(0, 10.8, 13.2);
  dNose.parent = dogMesh;
  const dEarL = BABYLON.MeshBuilder.CreateBox("dogEarL", { width: 1.5, height: 4, depth: 2.5 }, s.scene);
  dEarL.material = dogDarkMat;
  dEarL.position.set(-3.5, 11, 6.5);
  dEarL.parent = dogMesh;
  const dEarR = BABYLON.MeshBuilder.CreateBox("dogEarR", { width: 1.5, height: 4, depth: 2.5 }, s.scene);
  dEarR.material = dogDarkMat;
  dEarR.position.set(3.5, 11, 6.5);
  dEarR.parent = dogMesh;
  const dTail = BABYLON.MeshBuilder.CreateCylinder("dogTail", { diameterTop: 1.6, diameterBottom: 2.4, height: 7, tessellation: 6 }, s.scene);
  dTail.material = dogDarkMat;
  dTail.position.set(0, 9, -7.5);
  dTail.rotation.x = -Math.PI / 4;
  dTail.parent = dogMesh;
  dogMesh.tail = dTail;

  [[-3, 3, 4], [3, 3, 4], [-3, 3, -4], [3, 3, -4]].forEach(([lx, ly, lz], i) => {
    const leg = BABYLON.MeshBuilder.CreateBox(`dogLeg_${i}`, { width: 2.5, height: 6, depth: 2.5 }, s.scene);
    leg.material = dogBodyMat;
    leg.position.set(lx, ly, lz);
    leg.parent = dogMesh;
  });
  dogMesh.scaling.set(1.6, 1.6, 1.6);
  dogMesh.position.set(hx + 40, 0, hy - 40);
  dogMesh.parent = s.hometownGroup;
  s.villageAnimals.push({
    type: 'dog',
    name: 'Buddy',
    x: hx + 40, z: hy - 40,
    mesh: dogMesh,
    barkTimer: 0,
  });

  // 3 Chickens
  const chickenPositions = [
    { x: hx + 160, z: hy + 130 },
    { x: hx + 200, z: hy + 160 },
    { x: hx - 140, z: hy + 160 },
  ];
  chickenPositions.forEach((pos, idx) => {
    const cMesh = new ESMTransformNode(`chicken_${idx}`, s.scene);
    const cMatWhite = mat(s.scene, `chickenMatWhite_${idx}`, idx === 1 ? "#f5b041" : "#ffffff");
    const cMatComb = mat(s.scene, `chickenMatComb_${idx}`, "#e74c3c");
    const cMatBeak = mat(s.scene, `chickenMatBeak_${idx}`, "#f39c12");

    const cBody = BABYLON.MeshBuilder.CreateBox(`chickenBody_${idx}`, { width: 5, height: 5, depth: 7 }, s.scene);
    cBody.material = cMatWhite;
    cBody.position.y = 4.5;
    cBody.parent = cMesh;
    const cHead = new ESMTransformNode(`chickenHead_${idx}`, s.scene);
    cHead.position.set(0, 7.5, 3.5);
    cHead.parent = cMesh;
    const headBlock = BABYLON.MeshBuilder.CreateBox(`chickenHeadBlock_${idx}`, { width: 3.5, height: 4, depth: 3.5 }, s.scene);
    headBlock.material = cMatWhite;
    headBlock.parent = cHead;
    const comb = BABYLON.MeshBuilder.CreateBox(`chickenComb_${idx}`, { width: 1.2, height: 2.5, depth: 2.5 }, s.scene);
    comb.material = cMatComb;
    comb.position.set(0, 3, 0);
    comb.parent = cHead;
    const beak = BABYLON.MeshBuilder.CreateCylinder(`chickenBeak_${idx}`, { diameterTop: 0, diameterBottom: 2, height: 2.5, tessellation: 4 }, s.scene);
    beak.material = cMatBeak;
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0, 2.5);
    beak.parent = cHead;
    cMesh.head = cHead;

    [[-1.5, 1.5, 0], [1.5, 1.5, 0]].forEach(([lx, ly, lz], i) => {
      const leg = BABYLON.MeshBuilder.CreateBox(`chickenLeg_${idx}_${i}`, { width: 1, height: 3, depth: 1 }, s.scene);
      leg.material = cMatBeak;
      leg.position.set(lx, ly, lz);
      leg.parent = cMesh;
    });

    cMesh.scaling.set(1.5, 1.5, 1.5);
    cMesh.position.set(pos.x, 0, pos.z);
    cMesh.parent = s.hometownGroup;
    s.villageAnimals.push({
      type: 'chicken',
      x: pos.x, z: pos.z,
      mesh: cMesh,
      peckTimer: Math.random() * 3,
      cluckTimer: Math.random() * 8,
    });
  });

  // Collision for NPCs & Stalls
  s.obstaclesHometown.push(
    { x: hx - 200, y: hy - 200, r: 25 },
    { x: hx + 200, y: hy - 200, r: 25 },
    { x: hx - 200, y: hy + 200, r: 25 },
    { x: hx + 300, y: hy + 260, r: 35 },
  );
}

// ─── Villagers & Town Animals Update Loop ─────────────────────────────────────

export function updateVillagers(dt) {
  const s = state;
  if (s.currentScene !== 'hometown') return;
  const time = Date.now() * 0.003;

  // 1. Update Wandering Villagers with realistic human walking gait
  if (s.villagers) {
    s.villagers.forEach(v => {
      if (!v.mesh) return;

      // Lazy find limbs if not already cached
      if (!v.legL) {
        const desc = v.mesh.getDescendants();
        v.legL = desc.find(c => c.name === 'leg-left');
        v.legR = desc.find(c => c.name === 'leg-right');
        v.armL = desc.find(c => c.name === 'arm-left');
        v.armR = desc.find(c => c.name === 'arm-right');
        v.head = desc.find(c => c.name === 'head');
      }

      const distToPlayer = Math.hypot(s.player.x - v.x, s.player.y - v.z);

      if (distToPlayer < 65) {
        // Look at player & pause
        const targetAngle = Math.atan2(s.player.x - v.x, s.player.y - v.z);
        let diff = targetAngle - v.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        v.mesh.rotation.y += diff * 0.12;

        // Smoothly return limbs to standing position
        if (v.legL) v.legL.rotation.x *= 0.8;
        if (v.legR) v.legR.rotation.x *= 0.8;
        if (v.armL) v.armL.rotation.x *= 0.8;
        if (v.armR) v.armR.rotation.x *= 0.8;

        v.mesh.position.set(v.x, 0, v.z);
        if (v.head) {
          v.head.rotation.y = Math.sin(time * 2 + v.x) * 0.08;
        }
      } else if (v.patrol && v.patrol.length) {
        // Move along patrol waypoints
        const wp = v.patrol[v.patrolIdx];
        const dx = wp.x - v.x;
        const dz = wp.z - v.z;
        const distWp = Math.hypot(dx, dz);

        if (distWp < 8) {
          v.patrolIdx = (v.patrolIdx + 1) % v.patrol.length;
        } else {
          // Walk step
          const moveDist = v.speed * dt * 0.85;
          v.x += (dx / distWp) * moveDist;
          v.z += (dz / distWp) * moveDist;

          // Face walking direction smoothly
          const targetAngle = Math.atan2(dx, dz);
          let diff = targetAngle - v.mesh.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          v.mesh.rotation.y += diff * 0.15;

          // Natural human walking cycle (legs swing alternately, arms swing in opposition)
          v.walkCycle = (v.walkCycle || 0) + v.speed * 0.18 * dt;
          const swing = Math.sin(v.walkCycle) * 0.65;

          if (v.legL) v.legL.rotation.x = swing;
          if (v.legR) v.legR.rotation.x = -swing;
          if (v.armL) v.armL.rotation.x = -swing * 0.7;
          if (v.armR) v.armR.rotation.x = swing * 0.7;

          // Keep feet on the ground! Subtle pelvic bob of max 0.2 units instead of hopping
          const subtleBob = Math.sin(v.walkCycle * 2) * 0.2;
          v.mesh.position.set(v.x, Math.max(0, subtleBob), v.z);
        }
      } else {
        // Idle
        v.mesh.position.set(v.x, 0, v.z);
        if (v.legL) v.legL.rotation.x = 0;
        if (v.legR) v.legR.rotation.x = 0;
        if (v.armL) v.armL.rotation.x = 0;
        if (v.armR) v.armR.rotation.x = 0;
      }
    });
  }

  // Also animate stationary NPCs (Shop, Healer, Blacksmith, Innkeeper)
  const stationaryNpcs = [s.shopNPC, s.healerNPC, s.blacksmithNPC, s.innNPC];
  stationaryNpcs.forEach(npc => {
    if (!npc) return;
    const dist = Math.hypot(s.player.x - npc.position.x, s.player.y - npc.position.z);
    if (dist < 75) {
      const targetAngle = Math.atan2(s.player.x - npc.position.x, s.player.y - npc.position.z);
      let diff = targetAngle - npc.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      npc.rotation.y += diff * 0.1;
    }
  });

  // 2. Update Village Animals
  if (s.villageAnimals) {
    s.villageAnimals.forEach(a => {
      if (!a.mesh) return;
      if (a.type === 'dog') {
        const distToPlayer = Math.hypot(s.player.x - a.x, s.player.y - a.z);
        if (a.mesh.tail) {
          // Rapid tail wagging when player is near
          const wagSpeed = distToPlayer < 65 ? 25 : 8;
          a.mesh.tail.rotation.y = Math.sin(time * wagSpeed) * 0.7;
        }
        if (distToPlayer < 65) {
          // Turn toward player
          a.mesh.rotation.y = Math.atan2(s.player.x - a.x, s.player.y - a.z);
          a.barkTimer = (a.barkTimer || 0) + dt;
          if (a.barkTimer > 400) {
            a.barkTimer = 0;
            playSound('bark');
          }
        }
      } else if (a.type === 'chicken') {
        // Head pecking animation
        if (a.mesh.head) {
          a.mesh.head.rotation.x = Math.abs(Math.sin(time * 3 + a.x)) * 0.55;
        }
        a.cluckTimer = (a.cluckTimer || 0) + dt;
        if (a.cluckTimer > 700) {
          a.cluckTimer = 0;
          if (Math.hypot(s.player.x - a.x, s.player.y - a.z) < 120) {
            playSound('cluck');
          }
        }
      }
    });
  }
}

export function initWildsNPCs() {
  const s = state;
  // Wilds return portal (near altar)
  s.wildsPortal = createPortal(0xff00ff);
  s.wildsPortal.group.position.set(mapSize / 2, 30, mapSize / 2 + 60);
  s.wildsPortal.group.parent = s.wildsGroup;

  // Portal to Scorched Dunes (wilds2) — placed near altar, always created;
  // level gate is enforced in ui.js
  s.desertPortalWilds = createPortal(0xff8800);
  s.desertPortalWilds.group.position.set(mapSize / 2, 30, mapSize / 2 + 400);
  s.desertPortalWilds.group.parent = s.wildsGroup;

  // BOSS (The Golden Golem)
  s.bossActive = true;
  s.bossX = mapSize - 1000;
  s.bossY = mapSize - 1000;
  s.bossSpawnX = s.bossX;
  s.bossSpawnY = s.bossY;

  if (loadedModels.enemy) {
    const gltfBoss = loadedModels.enemy.clone("bossEnemy", true, false);
    gltfBoss.scaling.set(100, 100, 100);
    gltfBoss.position.y = -30;
    // Phase 1: skip per-mesh material tinting; Babylon material clone/override is a later step.
    s.bossMesh = new ESMTransformNode("bossMesh", s.scene);
    gltfBoss.parent = s.bossMesh;
  } else {
    s.bossMesh = BABYLON.MeshBuilder.CreateBox("bossMesh_fallback", { width: 60, height: 60, depth: 60 }, s.scene);
    s.bossMesh.material = mat(s.scene, "bossMeshMat", "#ffd700");
  }

  s.bossMesh.position.set(s.bossX, 30 + getTerrainHeight(s.bossX, s.bossY), s.bossY);
  s.bossMesh.parent = s.wildsGroup;

  s.bossHpGroup = new ESMTransformNode("bossHpGroup", s.scene);
  const bg = BABYLON.MeshBuilder.CreateGround("bossHpBg", { width: 80, depth: 8, updatable: true }, s.scene);
  bg.material = mat(s.scene, "bossHpBgMat", "#222222", { disableLighting: true });
  bg.parent = s.bossHpGroup;
  s.bossHpFg = BABYLON.MeshBuilder.CreateGround("bossHpFg", { width: 80, depth: 8, updatable: true }, s.scene);
  s.bossHpFg.material = mat(s.scene, "bossHpFgMat", "#880000", { disableLighting: true });
  s.bossHpFg.position.z = 0.2;
  s.bossHpFg.parent = s.bossHpGroup;
  s.bossHpGroup.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  s.bossHpGroup.position.set(s.bossX, 80 + getTerrainHeight(s.bossX, s.bossY), s.bossY);
  s.bossHpGroup.parent = s.wildsGroup;

  // Spawn Boss Children inside arena
  setTimeout(() => {
    spawnEnemy(s.bossX + 80, s.bossY + 80, 0.5, true);
    spawnEnemy(s.bossX - 80, s.bossY + 80, 0.5, true);
    spawnEnemy(s.bossX + 80, s.bossY - 80, 0.5, true);
    spawnEnemy(s.bossX - 80, s.bossY - 80, 0.5, true);
    spawnEnemy(s.bossX + 130, s.bossY, 0.5, true);
    spawnEnemy(s.bossX - 130, s.bossY, 0.5, true);
  }, 1000);
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
  const center = mapSize / 2;
  while (!valid) {
    // Spawn musuh dalam radius 5000 dari tengah agar mudah ditemukan
    x = center + (Math.random() - 0.5) * 10000;
    y = center + (Math.random() - 0.5) * 10000;
    if (x < 50 || x > mapSize - 50 || y < 50 || y > mapSize - 50) continue;
    if (Math.hypot(x - center, y - center) < 1000) continue; // Jangan spawn di atas/terlalu dekat piramida
    if (Math.hypot(x - s.player.x, y - s.player.y) < 300) continue; // Jangan tepat di atas player
    if (s.obstaclesWilds2.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
    valid = true;
  }
  return { x, y };
}

export function initWilds2() {
  const s = state;
  s.wilds2Group = new ESMTransformNode("wilds2Group", s.scene);

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
  const sandTex = new BABYLON.DynamicTexture("sandTex", texCanvas, s.scene, false, true);
  sandTex.wrapMode = BABYLON.Texture.WRAPMODE_WRAP;
  sandTex.uScale = ms / 150;
  sandTex.vScale = ms / 150;

  // Displaced sand floor (same pattern as initSetup's mainFloor)
  const floor = BABYLON.MeshBuilder.CreateGround("wilds2Floor", { width: ms, depth: ms, subdivisions: 200 }, s.scene);
  const floorMat = mat(s.scene, "wilds2FloorMat", null, {});
  floorMat.diffuseTexture = sandTex;
  floor.material = floorMat;
  const floorPositions = floor.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < floorPositions.length; i += 3) {
    const vx = floorPositions[i];
    const vz = floorPositions[i + 2];
    const worldX = vx + (ms / 2);
    const worldY = (ms / 2) - vz;
    floorPositions[i + 1] = getTerrainHeightWilds2(worldX, worldY);
  }
  floor.updateVerticesData(BABYLON.VertexBuffer.PositionKind, floorPositions);
  floor.createNormals(true);
  floor.position.set(ms / 2, 0, ms / 2);
  floor.parent = s.wilds2Group;

  // ── Central ancient pyramid: 11 stepped tiers (step-pyramid), sandstone + gold cap ──
  const pyramidGroup = new ESMTransformNode("pyramidGroup", s.scene);
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
    const t = new BABYLON.DynamicTexture("stoneTex", c, s.scene, false, true);
    t.wrapMode = BABYLON.Texture.WRAPMODE_WRAP;
    t.uScale = 3;
    t.vScale = 3;
    return t;
  })();
  const sandstoneMat = mat(s.scene, "sandstoneMat", "#d8c08a");
  sandstoneMat.diffuseTexture = stoneTex;
  const goldMat = mat(s.scene, "goldMat", "#ffd700", { emissive: "#886600" });
  const TOWERS = 11;
  // BASE = apothem of the tier-1 base circle: a radial-4 cylinder rotated 45°
  // has its flat face at distance baseRadius * cos(45°) from the center, so
  // set baseRadius = 200 / cos(45°) ≈ 283 to make the walls sit on the sand.
  const BASE = 283;
  const STEP = 28;
  // Buried plinth: a short wide base half-sunk in the sand so the tier corners
  // never punch through the ground.
  const plinth = BABYLON.MeshBuilder.CreateCylinder("pyramidPlinth", { diameterTop: (BASE + 40) * 2, diameterBottom: (BASE + 80) * 2, height: 30, tessellation: 4 }, s.scene);
  plinth.material = sandstoneMat;
  plinth.position.y = -8; // mostly below ground, top face at y=22
  plinth.parent = pyramidGroup;

  let curY = 14; // stack tiers on top of the plinth
  for (let i = 0; i < TOWERS; i++) {
    const h = STEP + Math.max(0, (BASE - i * STEP - STEP)) * 0.06; // slight overhang at bottom
    const tier = BABYLON.MeshBuilder.CreateCylinder(`pyramidTier_${i}`, { diameterTop: Math.max(2, (BASE - (i + 1) * STEP) * 2), diameterBottom: (BASE - i * STEP) * 2, height: h, tessellation: 4 }, s.scene);
    tier.material = i === TOWERS - 1 ? goldMat : sandstoneMat;
    tier.position.y = curY + h / 2;
    tier.parent = pyramidGroup;
    curY += h;
  }
  // Central cap: small cone on top of last tier (like the original but smaller)
  const cap = BABYLON.MeshBuilder.CreateCylinder("pyramidCap", { diameterTop: 0, diameterBottom: 30, height: 22, tessellation: 4 }, s.scene);
  cap.material = goldMat;
  cap.position.y = curY + 11;
  cap.parent = pyramidGroup;
  pyramidGroup.rotation.y = Math.PI / 4; // Point a face toward map center
  pyramidGroup.position.set(ms / 2, 0, ms / 2);
  pyramidGroup.parent = s.wilds2Group;
  s.obstaclesWilds2.push({ x: ms / 2, y: ms / 2, r: 360, h: 200 }); // Collision radius diubah dari 160 ke 360 agar sesuai dengan ukuran dasar piramida



  // ── Desert rock clusters (reuse rocks models + sand-colored obsidian) ──
  const numClusters = 150;
  for (let c = 0; c < numClusters; c++) {
    const cx = 200 + Math.random() * (ms - 400);
    const cy = 200 + Math.random() * (ms - 400);
    if (Math.hypot(cx - ms / 2, cy - ms / 2) < 1500) continue; // Area piramida dibersihkan

    const isRockCluster = Math.random() < 0.4;
    const clusterSize = 10 + Math.floor(Math.random() * 20);

    for (let i = 0; i < clusterSize; i++) {
      const rAngle = Math.random() * Math.PI * 2;
      const rDist = Math.random() * 200;
      const x = cx + Math.cos(rAngle) * rDist;
      const y = cy + Math.sin(rAngle) * rDist;
      if (x < 50 || x > ms - 50 || y < 50 || y > ms - 50) continue;
      if (Math.hypot(x - ms / 2, y - ms / 2) < 1500) continue;
      if (s.obstaclesWilds2.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 15)) continue;

      if (isRockCluster) {
        // Kenney Mini Arena props: blocks, bricks, trophies
        const CLUSTER_PROPS = ['arena_block', 'arena_bricks', 'arena_trophy'];
        let placed = false;
        for (let a = 0; a < 3; a++) {
          const key = CLUSTER_PROPS[Math.floor(Math.random() * CLUSTER_PROPS.length)];
          const src = loadedModels[key];
          if (!src) continue;
          const sc = 45 + Math.random() * 20; // Diperbesar (sebelumnya 25-35)
          const m = src.clone(`${key}_c${c}_i${i}`, true, false);
          m.scaling.set(sc, sc, sc);
          m.position.set(x, getTerrainHeightWilds2(x, y), y);
          m.rotation.y = Math.random() * Math.PI;
          m.parent = s.wilds2Group;
          placed = true;
          break;
        }
        if (!placed) {
          const r = 30 + Math.random() * 30; // Diperbesar
          const rock = BABYLON.MeshBuilder.CreateSphere(`w2_rock_${c}_${i}`, { diameter: r * 2, tessellation: 2 }, s.scene);
          rock.material = mat(s.scene, `w2RockMat_${c}_${i}`, "#b89a6a");
          rock.position.set(x, r + getTerrainHeightWilds2(x, y), y);
          rock.rotation.y = Math.random() * Math.PI;
          rock.parent = s.wilds2Group;
        }
        s.obstaclesWilds2.push({ x, y, r: 25, h: 30 }); // Collision diperbesar
      } else {
        // Dead desert trees + scattered arena props (banners, trophies)
        const TREE_PROPS = ['arena_tree', 'arena_banner', 'arena_trophy'];
        let placed = false;
        for (let a = 0; a < 3; a++) {
          const key = TREE_PROPS[Math.floor(Math.random() * TREE_PROPS.length)];
          const src = loadedModels[key];
          if (!src) continue;
          const sc = key === 'arena_tree' ? 25 + Math.random() * 15 : 20 + Math.random() * 10; // Diperbesar
          const m = src.clone(`${key}_c${c}_i${i}`, true, false);
          m.scaling.set(sc, sc, sc);
          m.position.set(x, getTerrainHeightWilds2(x, y), y);
          m.rotation.y = Math.random() * Math.PI;
          m.parent = s.wilds2Group;
          placed = true;
          break;
        }
        if (!placed) {
          const trunkH = 60 + Math.random() * 40; // Diperbesar
          const trunk = BABYLON.MeshBuilder.CreateCylinder(`w2_trunk_${c}_${i}`, { diameterTop: 16, diameterBottom: 20, height: trunkH, tessellation: 6 }, s.scene);
          trunk.material = mat(s.scene, `w2TrunkMat_${c}_${i}`, "#6b5b3e");
          trunk.position.set(x, trunkH / 2 + getTerrainHeightWilds2(x, y), y);
          trunk.rotation.z = (Math.random() - 0.5) * 0.2;
          trunk.parent = s.wilds2Group;
        }
        s.obstaclesWilds2.push({ x, y, r: 20, h: 60 }); // Collision diperbesar
      }
    }
  }

  // ── Quicksand pools (dark sunken circles) ──
  const numQuicksand = 10;
  for (let q = 0; q < numQuicksand; q++) {
    const qx = 300 + Math.random() * (ms - 600);
    const qy = 300 + Math.random() * (ms - 600);
    if (Math.hypot(qx - ms / 2, qy - ms / 2) < 1500) continue;
    if (s.obstaclesWilds2.some(o => Math.hypot(o.x - qx, o.y - qy) < o.r + 80)) continue;

    const pool = BABYLON.MeshBuilder.CreateDisc(`quicksandPool_${q}`, { radius: 80, tessellation: 24 }, s.scene);
    pool.material = mat(s.scene, `quicksandMat_${q}`, "#8a7a55", { emissive: "#221a0f" });
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(qx, 1 + getTerrainHeightWilds2(qx, qy), qy);
    pool.parent = s.wilds2Group;
    // Ring of floor details + bricks along the pool edge
    const poolRing = ['arena_floor_detail', 'arena_bricks', 'arena_floor_detail', 'arena_bricks'];
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const px = qx + Math.cos(ang) * 85;
      const py = qy + Math.sin(ang) * 85;
      const key = poolRing[a % poolRing.length];
      const src = loadedModels[key];
      if (!src) continue;
      const m = src.clone(`${key}_pool${q}_a${a}`, true, false);
      const sc = key === 'arena_bricks' ? 25 : 35; // Diperbesar
      m.scaling.set(sc, sc, sc);
      m.position.set(px, getTerrainHeightWilds2(px, py), py);
      m.rotation.y = ang;
      m.parent = s.wilds2Group;
    }
    s.obstaclesWilds2.push({ x: qx, y: qy, r: 80, h: 5 });
  }

  // ── Map border (Kenney Mini Arena walls + columns) ──
  // Walls along each edge (gap in the middle for portals), corner columns,
  // and decorative border pieces between wall segments.
  const WALL_SCALE = 40; // wall model is 1 unit wide → 40 game units
  const borderIn = 150;  // inset walls from the very edge
  const edgeGap = ms / 2 - 400; // leave a gap near the center of each edge (portal zone)

  const makeWall = (x, y, rotY) => {
    const key = loadedModels.arena_wall ? 'arena_wall' : 'arena_wall_corner';
    const src = loadedModels[key];
    let m;
    if (src) {
      m = src.clone(`w2_wall_${x}_${y}`, true, false);
      m.scaling.set(WALL_SCALE, WALL_SCALE, WALL_SCALE);
      m.position.set(x, getTerrainHeightWilds2(x, y), y);
      m.rotation.y = rotY;
    } else {
      m = BABYLON.MeshBuilder.CreateBox(`w2_wall_fb_${x}_${y}`, { width: WALL_SCALE * 1.2, height: WALL_SCALE, depth: WALL_SCALE * 0.4 }, s.scene);
      m.material = mat(s.scene, `w2WallMat_${x}_${y}`, "#d8c08a");
      m.position.set(x, WALL_SCALE / 2 + getTerrainHeightWilds2(x, y), y);
      m.rotation.y = rotY;
    }
    m.parent = s.wilds2Group;
    s.obstaclesWilds2.push({ x, y, r: 40, h: WALL_SCALE });
  };

  // North / South edges (along x, offset by borderIn), central gap for portals
  const inGap = i => i > edgeGap && i < ms - edgeGap;
  for (const z of [borderIn, ms - borderIn]) {
    for (let i = 0; i <= ms; i += 150) {
      if (inGap(i)) continue;
      makeWall(i, z, 0);
    }
  }
  // East / West edges (along z, offset by borderIn)
  for (const x of [borderIn, ms - borderIn]) {
    for (let i = 0; i <= ms; i += 150) {
      if (inGap(i)) continue;
      makeWall(x, i, Math.PI / 2);
    }
  }

  // Corner columns
  const cornerCol = loadedModels.arena_column;
  for (const [cx, cy] of [[borderIn, borderIn], [ms - borderIn, borderIn], [borderIn, ms - borderIn], [ms - borderIn, ms - borderIn]]) {
    if (cornerCol) {
      const m = cornerCol.clone(`w2_cornercol_${cx}_${cy}`, true, false);
      m.scaling.set(50, 50, 50);
      m.position.set(cx, getTerrainHeightWilds2(cx, cy), cy);
      m.rotation.y = Math.random() * Math.PI;
      m.parent = s.wilds2Group;
    }
    s.obstaclesWilds2.push({ x: cx, y: cy, r: 40, h: 50 });
  }

  // Decorative border-straight pieces flanking the central gap on each edge
  const borderPiece = loadedModels.arena_border;
  if (borderPiece) {
    for (const z of [borderIn, ms - borderIn]) {
      for (const px of [edgeGap - 30, ms - edgeGap + 30]) {
        const m = borderPiece.clone(`w2_border_${px}_${z}`, true, false);
        m.scaling.set(30, 30, 30);
        m.position.set(px, getTerrainHeightWilds2(px, z), z);
        m.rotation.y = Math.PI / 2;
        m.parent = s.wilds2Group;
      }
    }
    for (const x of [borderIn, ms - borderIn]) {
      for (const pz of [edgeGap - 30, ms - edgeGap + 30]) {
        const m = borderPiece.clone(`w2_border_${x}_${pz}`, true, false);
        m.scaling.set(30, 30, 30);
        m.position.set(x, getTerrainHeightWilds2(x, pz), pz);
        m.parent = s.wilds2Group;
      }
    }
  }

  // ── Portal back to The Wilds (orange glow portal, near pyramid) ──
  s.desertPortalWilds2 = createPortal(0xff8800);
  s.desertPortalWilds2.group.position.set(ms / 2 + 600, 30, ms / 2);
  s.desertPortalWilds2.group.parent = s.wilds2Group;
  // Banner poles flanking the portal
  if (loadedModels.arena_banner) {
    for (const off of [-180, 180]) {
      const b = loadedModels.arena_banner.clone(`w2_banner_${off}`, true, false);
      b.scaling.set(25, 25, 25);
      const px = ms / 2 + 600 + off;
      b.position.set(px, getTerrainHeightWilds2(px, ms / 2), ms / 2);
      b.rotation.y = Math.PI / 2;
      b.parent = s.wilds2Group;
    }
  }

  // ── Boss: the soldier of the Mini Arena (Kenney character-soldier) ──
  // Guard of the dunes — stands between the player and the pyramid.
  // The Golem (Wilds, map 1) is created in initWilds; when initWilds2 first
  // runs, the player is on wilds2, so replace bossMesh/HpGroup with the
  // soldier. The state fields (bossX/Y, bossHp, bossPhase, bossActive) keep
  // pointing at whichever boss the player faces — combat.js's updateBoss
  // handles both spawn points via s.bossSpawnX/s.bossSpawnY.
  const bossCX = ms / 2;
  const bossCY = ms / 2 + 1200;

  if (!s.bossActive) {
    s.bossActive = true;
    s.bossX = bossCX;
    s.bossY = bossCY;
    s.bossHp = 1500;
    s.bossMaxHp = 1500;
    s.bossPhase = 1;
    s.bossSpawnX = bossCX;
    s.bossSpawnY = bossCY;
  } else {
    // Golem active (map 1) — adopt its spawn point so updateBoss returns it
    // home correctly when the player switches maps.
    s.bossSpawnX = s.bossX;
    s.bossSpawnY = s.bossY;
  }

  if (loadedModels.arena_soldier) {
    const bossClone = loadedModels.arena_soldier.clone("w2_boss_clone", true, false);
    bossClone.scaling.set(120, 120, 120);
    bossClone.position.y = 0; // feet on terrain (model bottom is at y=0)

    s.bossMesh = new ESMTransformNode("w2_boss_group_a", s.scene);
    s.bossMesh.addChild(bossClone);

    if (loadedModels.arena_weapon_spear) {
      const spear = loadedModels.arena_weapon_spear.clone("w2_spear", true, false);
      spear.scaling.set(150, 150, 150);
      spear.position.set(50, 50, 40);
      spear.rotation.x = Math.PI / 2;
      spear.rotation.y = -Math.PI / 8;
      s.bossMesh.addChild(spear);
    }
  } else {
    const bGeo = BABYLON.MeshBuilder.CreateBox("w2_boss_fb", { width: 60, height: 60, depth: 60 }, s.scene);
    bGeo.material = mat(s.scene, "w2BossMat", "#c25030");
    s.bossMesh = new ESMTransformNode("w2_boss_group_b", s.scene);
    s.bossMesh.addChild(bGeo);
  }
  s.bossMesh.position.set(bossCX, -5 + getTerrainHeightWilds2(bossCX, bossCY), bossCY);
  s.bossMesh.parent = s.wilds2Group;

  s.bossHpGroup = new ESMTransformNode("w2_boss_hp", s.scene);
  s.bossHpGroup.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  const hbg = BABYLON.MeshBuilder.CreateGround("w2_boss_hp_bg", { width: 120, depth: 10, updatable: true }, s.scene);
  hbg.material = mat(s.scene, "w2BossHpBgMat", "#222222", { disableLighting: true });
  const hfg = BABYLON.MeshBuilder.CreateGround("w2_boss_hp_fg", { width: 120, depth: 10, updatable: true }, s.scene);
  hfg.material = mat(s.scene, "w2BossHpFgMat", "#aa2222", { disableLighting: true });
  hfg.position.z = 0.2;
  s.bossHpGroup.addChild(hbg);
  s.bossHpGroup.addChild(hfg);
  s.bossHpFg = hfg;
  s.bossHpGroup.position.set(bossCX, 150 + getTerrainHeightWilds2(bossCX, bossCY), bossCY);
  s.bossHpGroup.parent = s.wilds2Group;

  // Stairs + columns framing the boss arena in front of the pyramid
  const bossArenaProps = [
    { key: 'arena_stairs', sc: 30, dx: -250, dy: 0, rot: Math.PI },
    { key: 'arena_stairs', sc: 30, dx: 250, dy: 0, rot: 0 },
    { key: 'arena_column', sc: 35, dx: -300, dy: -180, rot: 0 },
    { key: 'arena_column', sc: 35, dx: 300, dy: -180, rot: 0 },
    { key: 'arena_column_damaged', sc: 35, dx: -300, dy: 180, rot: 0 },
    { key: 'arena_column_damaged', sc: 35, dx: 300, dy: 180, rot: 0 },
    { key: 'arena_banner', sc: 22, dx: -180, dy: -120, rot: Math.PI * 0.75 },
    { key: 'arena_banner', sc: 22, dx: 180, dy: -120, rot: Math.PI * 0.25 },
  ];
  for (const p of bossArenaProps) {
    const src = loadedModels[p.key];
    if (!src) continue;
    const m = src.clone(`w2_bossprop_${p.key}_${p.dx}_${p.dy}`, true, false);
    m.scaling.set(p.sc, p.sc, p.sc);
    const px = bossCX + p.dx;
    const py = bossCY + p.dy;
    m.position.set(px, getTerrainHeightWilds2(px, py), py);
    m.rotation.y = p.rot;
    m.parent = s.wilds2Group;
  }
  // Weapon racks guarding the boss
  for (const p of [
    { key: 'arena_weapon_rack', dx: -200, dy: 220 },
    { key: 'arena_weapon_rack', dx: 200, dy: 220 },
  ]) {
    const src = loadedModels[p.key];
    if (!src) continue;
    const m = src.clone(`w2_rack_${p.dx}_${p.dy}`, true, false);
    m.scaling.set(20, 20, 20);
    const px = bossCX + p.dx;
    const py = bossCY + p.dy;
    m.position.set(px, getTerrainHeightWilds2(px, py), py);
    m.rotation.y = Math.PI / 2;
    m.parent = s.wilds2Group;
  }
  // Trophy pedestals beside the pyramid
  if (loadedModels.arena_trophy) {
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = ms / 2 + Math.cos(ang) * 500;
      const py = ms / 2 + Math.sin(ang) * 500;
      const m = loadedModels.arena_trophy.clone(`w2_trophy_${i}`, true, false);
      m.scaling.set(20, 20, 20);
      m.position.set(px, getTerrainHeightWilds2(px, py), py);
      m.rotation.y = Math.atan2(ms / 2 - px, ms / 2 - py);
      m.parent = s.wilds2Group;
    }
  }

  // Spawn boss minions around the boss (tier-2 desert enemies)
  const sBossMinions = [
    [bossCX + 150, bossCY + 150],
    [bossCX - 150, bossCY + 150],
    [bossCX + 150, bossCY - 150],
    [bossCX - 150, bossCY - 150],
    [bossCX, bossCY + 250],
    [bossCX, bossCY - 250],
  ];
  for (const [mx, my] of sBossMinions) {
    s.obstaclesWilds2.push({ x: mx, y: my, r: 15, h: 30 });
  }
  setTimeout(() => {
    for (const [mx, my] of sBossMinions) {
      spawnEnemy2(mx, my, 0.7, true);
    }
  }, 1000);

  // Scatter interactables (chests, barrels, ruins)
  scatterInteractables(mapSize, s.wilds2Group, s.obstaclesWilds2, getTerrainHeightWilds2, 'wilds2');
}
