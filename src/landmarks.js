import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadedModels } from './model-loader.js';
import { state } from './state.js';

export function spawnTreasureChest(x, y, group, obstaclesArr, heightFunc, sceneType) {
  const chestGroup = new THREE.Group();
  
  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(15, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
  );
  base.position.y = 5;
  
  // Lid
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 15, 8, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
  );
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 10;
  
  // Lock
  const lock = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 2),
    new THREE.MeshLambertMaterial({ color: 0xffaa00 })
  );
  lock.position.set(0, 8, 5);
  
  chestGroup.add(base, lid, lock);
  chestGroup.position.set(x, heightFunc(x, y), y);
  chestGroup.rotation.y = Math.random() * Math.PI;
  
  group.add(chestGroup);
  obstaclesArr.push({ x, y, r: 10, h: 12 });
  
  state.interactables.push({
    type: 'chest',
    x, y,
    mesh: chestGroup,
    hp: 1,
    scene: sceneType,
    looted: false
  });
}

export function spawnExplosiveBarrel(x, y, group, obstaclesArr, heightFunc, sceneType) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 16, 8),
    new THREE.MeshLambertMaterial({ color: 0xa02020 })
  );
  
  const bandMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const band1 = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 2, 8), bandMat);
  band1.position.y = 4;
  const band2 = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 2, 8), bandMat);
  band2.position.y = -4;
  barrel.add(band1, band2);

  barrel.position.set(x, 8 + heightFunc(x, y), y);
  group.add(barrel);
  obstaclesArr.push({ x, y, r: 8, h: 16 });
  
  state.interactables.push({
    type: 'barrel',
    x, y,
    mesh: barrel,
    hp: 1,
    scene: sceneType,
    exploded: false
  });
}

export function spawnMysticRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType) {
  const ruinGroup = new THREE.Group();
  
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(15, 0),
    new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2.0, transparent: true, opacity: 0.8 })
  );
  core.position.y = 30;
  
  state.interactables.push({
    type: 'ruin_core', x: cx, y: cy, mesh: core, scene: sceneType,
    isVFX: true
  });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 25, 10, 6),
    new THREE.MeshLambertMaterial({ color: 0x555555 })
  );
  base.position.y = 5;
  ruinGroup.add(core, base);
  obstaclesArr.push({ x: cx, y: cy, r: 25, h: 10 });
  
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const dist = 60;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;
    
    const pHeight = 20 + Math.random() * 40;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, pHeight, 6),
      new THREE.MeshLambertMaterial({ color: 0x666666 })
    );
    pillar.position.set(px, pHeight / 2, pz);
    
    pillar.rotation.z = (Math.random() - 0.5) * 0.4;
    pillar.rotation.x = (Math.random() - 0.5) * 0.4;
    
    ruinGroup.add(pillar);
    obstaclesArr.push({ x: cx + px, y: cy + pz, r: 10, h: pHeight });
  }

  ruinGroup.position.set(cx, heightFunc(cx, cy), cy);
  group.add(ruinGroup);
  
  spawnTreasureChest(cx + 30, cy + 30, group, obstaclesArr, heightFunc, sceneType);
}

export function spawnArenaRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType) {
  const ruinGroup = new THREE.Group();
  
  // Center Statue
  if (loadedModels.arena_statue) {
    const statue = SkeletonUtils.clone(loadedModels.arena_statue);
    statue.scale.set(45, 45, 45); // Perbesar
    statue.position.y = 0;
    ruinGroup.add(statue);
    obstaclesArr.push({ x: cx, y: cy, r: 35, h: 60 });
  }

  // Columns around
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dist = 100;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;
    
    const isDamaged = Math.random() > 0.5;
    const key = isDamaged ? 'arena_column_damaged' : 'arena_column';
    if (loadedModels[key]) {
      const col = SkeletonUtils.clone(loadedModels[key]);
      col.scale.set(40, 40, 40); // Perbesar
      col.position.set(px, 0, pz);
      col.rotation.y = Math.random() * Math.PI;
      ruinGroup.add(col);
      obstaclesArr.push({ x: cx + px, y: cy + pz, r: 25, h: 50 });
    }
  }

  // Weapon Rack
  if (loadedModels.arena_weapon_rack) {
    const rack = SkeletonUtils.clone(loadedModels.arena_weapon_rack);
    rack.scale.set(35, 35, 35); // Perbesar
    const ang = Math.random() * Math.PI * 2;
    const px = Math.cos(ang) * 130;
    const pz = Math.sin(ang) * 130;
    rack.position.set(px, 0, pz);
    rack.rotation.y = ang + Math.PI / 2;
    ruinGroup.add(rack);
    obstaclesArr.push({ x: cx + px, y: cy + pz, r: 25, h: 30 });
    
    // Put a sword or spear near it
    const wpnKey = Math.random() > 0.5 ? 'arena_weapon_sword' : 'arena_weapon_spear';
    if (loadedModels[wpnKey]) {
      const wpn = SkeletonUtils.clone(loadedModels[wpnKey]);
      wpn.scale.set(35, 35, 35);
      wpn.position.set(px + 15, 5, pz + 15);
      wpn.rotation.x = Math.PI / 2; // lying on ground
      wpn.rotation.y = Math.random() * Math.PI;
      ruinGroup.add(wpn);
    }
  }
  
  // Stairs broken on the ground
  if (loadedModels.arena_stairs) {
    const stairs = SkeletonUtils.clone(loadedModels.arena_stairs);
    stairs.scale.set(40, 40, 40); // Perbesar
    const ang = Math.random() * Math.PI * 2;
    const px = Math.cos(ang) * 160;
    const pz = Math.sin(ang) * 160;
    stairs.position.set(px, 0, pz);
    stairs.rotation.y = Math.random() * Math.PI;
    // sunk into ground
    stairs.position.y = -10;
    stairs.rotation.x = (Math.random() - 0.5) * 0.4;
    ruinGroup.add(stairs);
  }

  ruinGroup.position.set(cx, heightFunc(cx, cy), cy);
  group.add(ruinGroup);
  
  // Treasure Chest inside the arena ruin
  spawnTreasureChest(cx + 35, cy + 35, group, obstaclesArr, heightFunc, sceneType);
}

export function scatterInteractables(mapSize, group, obstaclesArr, heightFunc, sceneType) {
  // Radius area di mana objek akan di-spawn (agar tidak terlalu menyebar di map 20000x20000)
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
  if (sceneType === 'wilds2') {
    for (let i = 0; i < 15; i++) { // Jumlah diperbanyak menjadi 15
      const cx = center + (Math.random() - 0.5) * spawnRadius;
      const cy = center + (Math.random() - 0.5) * spawnRadius;
      if (Math.hypot(cx - center, cy - center) < 1500) continue;
      if (obstaclesArr.some(o => Math.hypot(o.x - cx, o.y - cy) < o.r + 200)) continue;
      spawnArenaRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType);
    }
  }
}
