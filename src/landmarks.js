import * as BABYLON from "babylonjs";
import { loadedModels } from "./model-loader.js";
import { state } from "./state.js";

function mat(name, hex, opts = {}) {
  const m = new BABYLON.StandardMaterial(name, state.scene);
  if (hex !== undefined) m.diffuseColor = BABYLON.Color3.FromHexString(hex);
  if (opts.emissive !== undefined) m.emissiveColor = BABYLON.Color3.FromHexString(opts.emissive);
  if (opts.opacity !== undefined) m.alpha = opts.opacity;
  if (opts.emissiveIntensity) m.emissiveColor = BABYLON.Color3.Lerp(m.emissiveColor, BABYLON.Color3.FromHexString(opts.emissive), opts.emissiveIntensity);
  return m;
}

export function spawnTreasureChest(x, y, group, obstaclesArr, heightFunc, sceneType) {
  const s = state;
  const chestGroup = new BABYLON.TransformNode("chest_" + x + "_" + y, s.scene);

  const base = BABYLON.MeshBuilder.CreateBox("chest_base", { width: 15, height: 10, depth: 10 }, s.scene);
  base.material = mat("chest_base_mat", "#8b5a2b");
  base.position.y = 5;
  base.parent = chestGroup;

  // Lid: half-cylinder cap
  const lid = BABYLON.MeshBuilder.CreateCylinder("chest_lid", { diameter: 10, height: 15, tessellation: 8 }, s.scene);
  lid.material = mat("chest_lid_mat", "#8b5a2b");
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 10;
  lid.parent = chestGroup;

  const lock = BABYLON.MeshBuilder.CreateBox("chest_lock", { width: 2, height: 3, depth: 2 }, s.scene);
  lock.material = mat("chest_lock_mat", "#ffaa00");
  lock.position.set(0, 8, 5);
  lock.parent = chestGroup;

  chestGroup.position.set(x, heightFunc(x, y), y);
  chestGroup.rotation.y = Math.random() * Math.PI;
  chestGroup.parent = group;
  obstaclesArr.push({ x, y, r: 10, h: 12 });

  s.interactables.push({
    type: "chest",
    x, y,
    mesh: chestGroup,
    hp: 1,
    scene: sceneType,
    looted: false,
  });
}

export function spawnExplosiveBarrel(x, y, group, obstaclesArr, heightFunc, sceneType) {
  const s = state;
  const barrel = BABYLON.MeshBuilder.CreateCylinder("barrel_" + x, { diameter: 12, height: 16, tessellation: 8 }, s.scene);
  barrel.material = mat("barrel_mat_" + x, "#a02020");

  const bandMat = mat("barrel_band_mat_" + x, "#222222");
  const band1 = BABYLON.MeshBuilder.CreateCylinder("barrel_band1_" + x, { diameter: 12.4, height: 2, tessellation: 8 }, s.scene);
  band1.material = bandMat;
  band1.position.y = 4;
  band1.parent = barrel;
  const band2 = BABYLON.MeshBuilder.CreateCylinder("barrel_band2_" + x, { diameter: 12.4, height: 2, tessellation: 8 }, s.scene);
  band2.material = bandMat;
  band2.position.y = -4;
  band2.parent = barrel;

  barrel.position.set(x, 8 + heightFunc(x, y), y);
  barrel.parent = group;
  obstaclesArr.push({ x, y, r: 8, h: 16 });

  s.interactables.push({
    type: "barrel",
    x, y,
    mesh: barrel,
    hp: 1,
    scene: sceneType,
    exploded: false,
  });
}

export function spawnMysticRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType) {
  const s = state;
  const ruinGroup = new BABYLON.TransformNode("ruin_" + cx + "_" + cy, s.scene);

  const core = BABYLON.MeshBuilder.CreateIcosphere("ruin_core_" + cx, { diameter: 30 }, s.scene);
  const coreMat = mat("ruin_core_mat_" + cx, "#00ffff", { emissive: "#00ffff", opacity: 0.8, emissiveIntensity: 2.0 });
  core.material = coreMat;
  core.position.y = 30;
  core.parent = ruinGroup;

  s.interactables.push({
    type: "ruin_core", x: cx, y: cy, mesh: core, scene: sceneType,
    isVFX: true,
  });

  const base = BABYLON.MeshBuilder.CreateCylinder("ruin_base_" + cx, { diameterTop: 40, diameterBottom: 50, height: 10, tessellation: 6 }, s.scene);
  base.material = mat("ruin_base_mat_" + cx, "#555555");
  base.position.y = 5;
  base.parent = ruinGroup;
  obstaclesArr.push({ x: cx, y: cy, r: 25, h: 10 });

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const dist = 60;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const pHeight = 20 + Math.random() * 40;
    const pillar = BABYLON.MeshBuilder.CreateCylinder("ruin_pillar_" + cx + "_" + i, { diameter: 16, height: pHeight, tessellation: 6 }, s.scene);
    pillar.material = mat("ruin_pillar_mat_" + cx, "#666666");
    pillar.position.set(px, pHeight / 2, pz);
    pillar.rotation.z = (Math.random() - 0.5) * 0.4;
    pillar.rotation.x = (Math.random() - 0.5) * 0.4;
    pillar.parent = ruinGroup;
    obstaclesArr.push({ x: cx + px, y: cy + pz, r: 10, h: pHeight });
  }

  ruinGroup.position.set(cx, heightFunc(cx, cy), cy);
  ruinGroup.parent = group;

  spawnTreasureChest(cx + 30, cy + 30, group, obstaclesArr, heightFunc, sceneType);
}

export function spawnArenaRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType) {
  const s = state;
  const ruinGroup = new BABYLON.TransformNode("arena_ruin_" + cx + "_" + cy, s.scene);

  // Center Statue
  if (loadedModels.arena_statue) {
    const statue = loadedModels.arena_statue.clone("arena_statue_" + cx + "_" + cy, true, false);
    statue.scaling.setAll(45);
    statue.position.y = 0;
    statue.parent = ruinGroup;
    obstaclesArr.push({ x: cx, y: cy, r: 35, h: 60 });
  }

  // Columns around
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dist = 100;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const isDamaged = Math.random() > 0.5;
    const key = isDamaged ? "arena_column_damaged" : "arena_column";
    if (loadedModels[key]) {
      const col = loadedModels[key].clone(key + "_" + cx + "_" + i, true, false);
      col.scaling.setAll(40);
      col.position.set(px, 0, pz);
      col.rotation.y = Math.random() * Math.PI;
      col.parent = ruinGroup;
      obstaclesArr.push({ x: cx + px, y: cy + pz, r: 25, h: 50 });
    }
  }

  // Weapon Rack
  if (loadedModels.arena_weapon_rack) {
    const rack = loadedModels.arena_weapon_rack.clone("arena_rack_" + cx, true, false);
    rack.scaling.setAll(35);
    const ang = Math.random() * Math.PI * 2;
    const px = Math.cos(ang) * 130;
    const pz = Math.sin(ang) * 130;
    rack.position.set(px, 0, pz);
    rack.rotation.y = ang + Math.PI / 2;
    rack.parent = ruinGroup;
    obstaclesArr.push({ x: cx + px, y: cy + pz, r: 25, h: 30 });

    const wpnKey = Math.random() > 0.5 ? "arena_weapon_sword" : "arena_weapon_spear";
    if (loadedModels[wpnKey]) {
      const wpn = loadedModels[wpnKey].clone("arena_wpn_" + cx, true, false);
      wpn.scaling.setAll(35);
      wpn.position.set(px + 15, 5, pz + 15);
      wpn.rotation.x = Math.PI / 2;
      wpn.rotation.y = Math.random() * Math.PI;
      wpn.parent = ruinGroup;
    }
  }

  // Stairs broken on the ground
  if (loadedModels.arena_stairs) {
    const stairs = loadedModels.arena_stairs.clone("arena_stairs_" + cx, true, false);
    stairs.scaling.setAll(40);
    const ang = Math.random() * Math.PI * 2;
    const px = Math.cos(ang) * 160;
    const pz = Math.sin(ang) * 160;
    stairs.position.set(px, -10, pz);
    stairs.rotation.y = Math.random() * Math.PI;
    stairs.rotation.x = (Math.random() - 0.5) * 0.4;
    stairs.parent = ruinGroup;
  }

  ruinGroup.position.set(cx, heightFunc(cx, cy), cy);
  ruinGroup.parent = group;

  spawnTreasureChest(cx + 35, cy + 35, group, obstaclesArr, heightFunc, sceneType);
}

export function scatterInteractables(mapSize, group, obstaclesArr, heightFunc, sceneType) {
  const spawnRadius = 6000;
  const center = mapSize / 2;

  for (let i = 0; i < 30; i++) {
    const x = center + (Math.random() - 0.5) * spawnRadius;
    const y = center + (Math.random() - 0.5) * spawnRadius;
    if (Math.hypot(x - center, y - center) < 1500) continue;
    if (obstaclesArr.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 20)) continue;
    spawnTreasureChest(x, y, group, obstaclesArr, heightFunc, sceneType);
  }

  for (let i = 0; i < 20; i++) {
    const cx = center + (Math.random() - 0.5) * spawnRadius;
    const cy = center + (Math.random() - 0.5) * spawnRadius;
    if (Math.hypot(cx - center, cy - center) < 1500) continue;
    if (obstaclesArr.some(o => Math.hypot(o.x - cx, o.y - cy) < o.r + 50)) continue;

    const count = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < count; j++) {
      const bx = cx + (Math.random() - 0.5) * 40;
      const by = cy + (Math.random() - 0.5) * 40;
      spawnExplosiveBarrel(bx, by, group, obstaclesArr, heightFunc, sceneType);
    }
  }

  for (let i = 0; i < 8; i++) {
    const cx = center + (Math.random() - 0.5) * spawnRadius;
    const cy = center + (Math.random() - 0.5) * spawnRadius;
    if (Math.hypot(cx - center, cy - center) < 1500) continue;
    if (obstaclesArr.some(o => Math.hypot(o.x - cx, o.y - cy) < o.r + 100)) continue;
    spawnMysticRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType);
  }

  // Map 2 exclusive: Arena Ruins (menggunakan aset Kenney Arena)
  if (sceneType === "wilds2") {
    for (let i = 0; i < 15; i++) {
      const cx = center + (Math.random() - 0.5) * spawnRadius;
      const cy = center + (Math.random() - 0.5) * spawnRadius;
      if (Math.hypot(cx - center, cy - center) < 1500) continue;
      if (obstaclesArr.some(o => Math.hypot(o.x - cx, o.y - cy) < o.r + 200)) continue;
      spawnArenaRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType);
    }
  }
}
