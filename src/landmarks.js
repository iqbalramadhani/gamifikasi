import * as THREE from 'three';
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

export function scatterInteractables(mapSize, group, obstaclesArr, heightFunc, sceneType) {
  for (let i = 0; i < 20; i++) {
    const x = 200 + Math.random() * (mapSize - 400);
    const y = 200 + Math.random() * (mapSize - 400);
    if (obstaclesArr.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 20)) continue;
    spawnTreasureChest(x, y, group, obstaclesArr, heightFunc, sceneType);
  }
  
  for (let i = 0; i < 15; i++) {
    const cx = 200 + Math.random() * (mapSize - 400);
    const cy = 200 + Math.random() * (mapSize - 400);
    if (obstaclesArr.some(o => Math.hypot(o.x - cx, o.y - cy) < o.r + 50)) continue;
    
    const count = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < count; j++) {
      const bx = cx + (Math.random() - 0.5) * 40;
      const by = cy + (Math.random() - 0.5) * 40;
      spawnExplosiveBarrel(bx, by, group, obstaclesArr, heightFunc, sceneType);
    }
  }

  for (let i = 0; i < 5; i++) {
    const cx = 300 + Math.random() * (mapSize - 600);
    const cy = 300 + Math.random() * (mapSize - 600);
    if (obstaclesArr.some(o => Math.hypot(o.x - cx, o.y - cy) < o.r + 100)) continue;
    spawnMysticRuin(cx, cy, group, obstaclesArr, heightFunc, sceneType);
  }
}
