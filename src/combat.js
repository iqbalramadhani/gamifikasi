import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';
import { mapSize, weaponList, armorList, enemyTemplates, enemyTemplates2, WILDS2_MIN_LEVEL, lootTable, consumableItems, statusEffects } from './constants.js';
import { loadedModels } from './model-loader.js';
import { blocked, spawnParticles, spawnDamageText } from './helpers.js';
import { spawnAtFreePos, spawnAtFreePosWilds2, getTerrainHeight, getTerrainHeightWilds2 } from './scenes.js';
import { playSound } from './audio.js';

// ─── Critical hit helper ──────────────────────────────────────────────────────

export function calcCritDamage(baseDmg) {
  const s = state;
  if (Math.random() < s.critChance) {
    return { value: Math.ceil(baseDmg * s.critMultiplier), isCrit: true };
  }
  return { value: baseDmg, isCrit: false };
}

export function applyStatusEffect(enemy, type) {
  const def = statusEffects[type];
  if (!def) return;
  enemy.statusEffect = {
    type,
    damage: def.damage,
    duration: def.duration,
    tickTimer: def.tickInterval,
  };
}

// ─── Enemy spawner (called by initEntities + game loop) ──────────────────────

export function spawnEnemy(ex, ey, scaleFactor = 1.0, isBossChild = false) {
  const s = state;
  if (!ex || !ey) {
    const pos = spawnAtFreePos();
    ex = pos.x; ey = pos.y;
  }

  const tmpl = enemyTemplates[Math.floor(Math.random() * enemyTemplates.length)];
  let { hp, speed: baseSpeed, r: eR, typeStr, isFlying, damage } = tmpl;

  // Dragon only spawns at level 8+
  if (typeStr === 'dragon' && s.player.level < 8) {
    const adjusted = enemyTemplates.filter(t => t.typeStr !== 'dragon');
    const altTmpl = adjusted[Math.floor(Math.random() * adjusted.length)];
    ({ hp, speed: baseSpeed, r: eR, typeStr, isFlying, damage } = altTmpl);
  }

  const charKey = tmpl.charKey;

  let mesh, eY;

    if (loadedModels[charKey]) {
      const gltfEnemy = SkeletonUtils.clone(loadedModels[charKey]);
      gltfEnemy.scale.set(7 * scaleFactor, 7 * scaleFactor, 7 * scaleFactor);
      gltfEnemy.position.y = -12;
      mesh = new THREE.Group();
      mesh.add(gltfEnemy);
      eY = isFlying ? 35 : 15;
    } else {
      const boxGeo = new THREE.BoxGeometry(20 * scaleFactor, 20 * scaleFactor, 20 * scaleFactor);
      const boxMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      mesh = new THREE.Mesh(boxGeo, boxMat);
      eY = isFlying ? 30 : 10;
    }

  const levelMulti = 1 + s.player.level * 0.1;
  hp *= levelMulti;
  mesh.position.set(ex, eY, ey);
  s.scene.add(mesh);

  const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const hpFgMat = new THREE.MeshBasicMaterial({ color: 0x008800 });
  const hpGeo = new THREE.PlaneGeometry(24, 4);
  const hpGroup = new THREE.Group();
  const hpBg = new THREE.Mesh(hpGeo, hpBgMat);
  const hpFg = new THREE.Mesh(hpGeo, hpFgMat);
  hpFg.position.z = 0.1;
  hpGroup.add(hpBg, hpFg);
  s.scene.add(hpGroup);

  const dx = (Math.random() - 0.5) * 2;
  const dy = (Math.random() - 0.5) * 2;
  // Cache limb references to avoid per-frame traverse()
  const limbs = { 'leg-left': null, 'leg-right': null, 'arm-left': null, 'arm-right': null };
  mesh.traverse(child => {
    if (child.name && limbs.hasOwnProperty(child.name)) {
      limbs[child.name] = child;
    }
  });
  s.enemies.push({
    x: ex, y: ey, r: eR, meshY: eY, dx, dy,
    hp, maxHp: hp, baseSpeed, damage: damage || 10,
    mesh, hpGroup, hpFg,
    stunTimer: 0, slowTimer: 0, type: typeStr,
    attackTimer: 0, walkCycle: Math.random() * Math.PI * 2,
    limbs,
    isBossChild,
    isFlying: !!isFlying,
    age: 0
  });
}

// ─── Tier-2 enemy spawner (Scorched Dunes, level 10+) ──────────────────────

export function spawnEnemy2(ex, ey, scaleFactor = 1.0, isBossChild = false) {
  const s = state;
  if (s.player.level < WILDS2_MIN_LEVEL) return;
  if (!ex || !ey) {
    const pos = spawnAtFreePosWilds2();
    ex = pos.x; ey = pos.y;
  }

  const tmpl = enemyTemplates2[Math.floor(Math.random() * enemyTemplates2.length)];
  let { hp, speed: baseSpeed, r: eR, typeStr, isFlying, damage } = tmpl;
  const charKey = tmpl.charKey;

  let mesh, eY;
  if (loadedModels[charKey]) {
    const gltfEnemy = SkeletonUtils.clone(loadedModels[charKey]);
    if (charKey === 'arena_soldier') {
      gltfEnemy.scale.set(25 * scaleFactor, 25 * scaleFactor, 25 * scaleFactor);
    } else {
      gltfEnemy.scale.set(7 * scaleFactor, 7 * scaleFactor, 7 * scaleFactor);
    }
    gltfEnemy.position.y = -12;
    mesh = new THREE.Group();
    mesh.add(gltfEnemy);
    eY = isFlying ? 35 : 15;
  } else {
    const boxGeo = new THREE.BoxGeometry(20 * scaleFactor, 20 * scaleFactor, 20 * scaleFactor);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xff8800 });
    mesh = new THREE.Mesh(boxGeo, boxMat);
    eY = isFlying ? 30 : 10;
  }

  // Stronger scaling than the base Wilds tier
  const levelMulti = 1 + s.player.level * 0.12;
  hp *= levelMulti;
  mesh.position.set(ex, eY, ey);
  s.scene.add(mesh);

  const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const hpFgMat = new THREE.MeshBasicMaterial({ color: 0xaa2200 });
  const hpGeo = new THREE.PlaneGeometry(24, 4);
  const hpGroup = new THREE.Group();
  const hpBg = new THREE.Mesh(hpGeo, hpBgMat);
  const hpFg = new THREE.Mesh(hpGeo, hpFgMat);
  hpFg.position.z = 0.1;
  hpGroup.add(hpBg, hpFg);
  s.scene.add(hpGroup);

  const dx = (Math.random() - 0.5) * 2;
  const dy = (Math.random() - 0.5) * 2;
  const limbs = { 'leg-left': null, 'leg-right': null, 'arm-left': null, 'arm-right': null };
  mesh.traverse(child => {
    if (child.name && limbs.hasOwnProperty(child.name)) {
      limbs[child.name] = child;
    }
  });
  s.enemies.push({
    x: ex, y: ey, r: eR, meshY: eY, dx, dy,
    hp, maxHp: hp, baseSpeed, damage: damage || 10,
    mesh, hpGroup, hpFg,
    stunTimer: 0, slowTimer: 0, type: typeStr,
    attackTimer: 0, walkCycle: Math.random() * Math.PI * 2,
    limbs,
    isBossChild,
    isFlying: !!isFlying,
    tier: 2,
    age: 0
  });
}

// ─── Player movement & combat ─────────────────────────────────────────────────

export function move(dt) {
  const s = state;
  if (s.gameOver || s.isPaused || !s.isGameStarted) return;

  let dx = 0, dy = 0;

  if (s.player.attackHitDelay.length > 0) {
    s.player.attackHitDelay[0] -= dt;
    if (s.player.attackHitDelay[0] <= 0) {
      s.player.attackHitDelay.shift();
      doMeleeHit();
    }
  }

  if (s.player.spinHitDelay === 0 && s.player.isSpinning > 0) {
    doSpinHit();
  }
  if (s.keys.arrowup) dy += 1;
  if (s.keys.arrowdown) dy -= 1;
  if (s.keys.arrowleft) dx += 1;
  if (s.keys.arrowright) dx -= 1;

  if (s.keys.c) { s.keys.c = false; usePotion(); }

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;

    const rotDx = dx * Math.cos(s.cameraAngle) + dy * Math.sin(s.cameraAngle);
    const rotDy = -dx * Math.sin(s.cameraAngle) + dy * Math.cos(s.cameraAngle);
    dx = rotDx;
    dy = rotDy;

    // Dash
    if (s.keys.z && s.player.dashCooldown <= 0 && s.player.stamina >= 30) {
      s.player.stamina -= 30;
      s.player.dashCooldown = 180;
      s.player.isDashing = 15;
      playSound('dash');
      spawnParticles(s.player.x, s.player.y, 0xaaaaaa, 5, 'dust');
    }

    // Spin attack
    if (s.keys.x && s.player.spinCooldown <= 0 && s.player.stamina >= 50) {
      s.player.stamina -= 50;
      s.player.spinCooldown = 300;
      s.player.isSpinning = 100; // durasi animasi sword_slash_3 (100 frame)
      s.player.spinHitDelay = 50; // damage mendarat di tengah animasi
      s.cameraShake = Math.max(s.cameraShake || 0, 8);
      playSound('spin');
    }

    let currentSpeed = s.player.defending ? s.player.speed * 0.4 : s.player.speed;
    if (s.player.isDashing > 0) { currentSpeed *= 3.5; s.player.isDashing -= dt; }

    s.player.facingX = dx;
    s.player.facingY = dy;

    let targetX = s.player.x + dx * currentSpeed * dt;
    let targetY = s.player.y + dy * currentSpeed * dt;
    if (!blocked(targetX, s.player.y)) s.player.x = targetX;
    if (!blocked(s.player.x, targetY)) s.player.y = targetY;

    s.player.walkCycle += currentSpeed * 0.08 * dt;
    const currentFootstep = Math.floor(s.player.walkCycle / Math.PI);
    if (s.player.lastFootstep !== currentFootstep && s.player.height === 0) {
      s.player.lastFootstep = currentFootstep;
      spawnParticles(s.player.x, s.player.y, 0xaaaaaa, 2, 'dust');
      playSound('footstep');
    }
    
    animatePlayer(true);
  } else {
    s.player.walkCycle = 0;
    animatePlayer(false);
  }
}

function animatePlayer(walking) {
  const s = state;
  const isAttacking = s.player.attackCooldown > 0 || s.player.isSpinning > 0;

  if (s.playerMixer) {
    let targetAction = s.playerActions.idle;
    if (isAttacking && s.player.isSpinning > 0 && s.playerActions.spin) {
      targetAction = s.playerActions.spin;
    } else if (isAttacking && s.playerActions.attack) {
      targetAction = s.playerActions.attack;
    } else if (walking && s.playerActions.run) {
      targetAction = s.playerActions.run;
    }
    
    if (s.activeAction !== targetAction && targetAction) {
      if (s.activeAction) s.activeAction.fadeOut(0.2);
      targetAction.reset().fadeIn(0.2).play();
      s.activeAction = targetAction;
    }
    
    const faceAngle = Math.atan2(s.player.facingX, s.player.facingY) + Math.PI / 2;
    // Gunakan Lerp untuk putaran halus
    let diff = faceAngle - s.gltfPlayerRef.rotation.y;
    while(diff < -Math.PI) diff += Math.PI * 2;
    while(diff > Math.PI) diff -= Math.PI * 2;
    s.gltfPlayerRef.rotation.y += diff * 0.15;
    
    s.gltfPlayerRef.position.y = -15; // Set base offset for physics
  } else if (s.gltfPlayerRef) {
    if (!s.playerLegL) {
      s.playerLegL = s.gltfPlayerRef.getObjectByName('leg-left');
      s.playerLegR = s.gltfPlayerRef.getObjectByName('leg-right');
      s.playerArmL = s.gltfPlayerRef.getObjectByName('arm-left');
      s.playerArmR = s.gltfPlayerRef.getObjectByName('arm-right');
    }
    const faceAngle = Math.atan2(s.player.facingX, s.player.facingY) + Math.PI / 2;
    s.gltfPlayerRef.rotation.y = faceAngle;
    s.gltfPlayerRef.position.y = walking
      ? -15 + Math.abs(Math.sin(s.player.walkCycle * 2)) * 1.5
      : -15;

    if (walking) {
      const swing = Math.sin(s.player.walkCycle) * 0.8;
      if (s.playerLegL) s.playerLegL.rotation.x = swing;
      if (s.playerLegR) s.playerLegR.rotation.x = -swing;
      if (s.playerArmL) s.playerArmL.rotation.x = -swing;
      if (s.playerArmR) {
        if (s.player.attackCooldown > 0) {
          const anim = (30 - s.player.attackCooldown) / 30;
          s.playerArmR.rotation.x = Math.PI * (1 - anim) - Math.PI / 4;
        } else {
          s.playerArmR.rotation.x = swing;
        }
      }
    } else {
      if (s.playerLegL) s.playerLegL.rotation.x = 0;
      if (s.playerLegR) s.playerLegR.rotation.x = 0;
      if (s.playerArmL) s.playerArmL.rotation.x = 0;
      if (s.playerArmR) {
        if (s.player.attackCooldown > 0) {
          const anim = (30 - s.player.attackCooldown) / 30;
          s.playerArmR.rotation.x = Math.PI * (1 - anim) - Math.PI / 4;
        } else {
          s.playerArmR.rotation.x = 0;
        }
      }
    }
  } else if (s.playerMesh.leftHip) {
    const swing = Math.sin(s.player.walkCycle) * 0.6;
    s.playerMesh.leftHip.rotation.z = walking ? swing : 0;
    s.playerMesh.rightHip.rotation.z = walking ? Math.sin(s.player.walkCycle + Math.PI) * 0.6 : 0;
  }

  if (s.player.isSpinning > 0) {
    const angle = s.player.spinAngle + Math.atan2(s.player.facingX, s.player.facingY);
    const px = s.player.x + Math.sin(angle) * 15;
    const pz = s.player.y + Math.cos(angle) * 15;
    const wColor = weaponList[s.currentWeapon]?.color || 0xffd700;
    spawnParticles(px, pz, wColor, 1, 'trail');
  } else if (s.player.isDashing > 0) {
    const wColor = armorList[s.currentArmor]?.color || 0xffffff;
    spawnParticles(s.player.x, s.player.y, wColor, 1, 'trail');
  }
}

// ─── Melee Attack ─────────────────────────────────────────────────────────────

export function attack() {
  const s = state;
  if (s.player.attackCooldown > 0 || s.gameOver || s.isPaused || !s.isGameStarted) return;
  s.player.attackCooldown = 90;
  s.player.attackHitDelay = [10];
  playSound('dash');
}

function doSpinHit() {
  const s = state;
  let hitSomething = false;
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < s.player.r + e.r + 100) {
      const spinCrit = calcCritDamage(s.player.attackDamage * 3);
      e.hp -= spinCrit.value;
      e.slowTimer = 90;
      e.stunTimer = 20;
      hitSomething = true;
      const spinColor = spinCrit.isCrit ? '#ffff00' : '#ff4444';
      const spinLabel = spinCrit.isCrit ? `CRIT! -${spinCrit.value}` : `-${spinCrit.value}`;
      spawnDamageText(e.x, e.mesh.position.y + 35, e.y, spinLabel, spinColor);
      if (e.hp <= 0) killEnemy(i);
      else {
        if (spinCrit.isCrit) spawnParticles(e.x, e.y, 0xffff00, 8, 'hit');
        else spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
      }
    }
  }

  if (s.interactables) {
    for (let i = s.interactables.length - 1; i >= 0; i--) {
      const it = s.interactables[i];
      if (it.scene !== s.currentScene || it.isVFX) continue;
      if (Math.hypot(it.x - s.player.x, it.y - s.player.y) < s.player.r + 40) {
        hitSomething = true;
        triggerInteractable(it, i);
      }
    }
  }

  if (s.bossActive && Math.hypot(s.bossX - s.player.x, s.bossY - s.player.y) < s.player.r + 150) {
    const bossSpinCrit = calcCritDamage(s.player.attackDamage * 3);
    s.bossHp -= bossSpinCrit.value;
    hitSomething = true;
    const bsColor = bossSpinCrit.isCrit ? '#ffff00' : '#ff4444';
    const bsLabel = bossSpinCrit.isCrit ? `CRIT! -${bossSpinCrit.value}` : `-${bossSpinCrit.value}`;
    spawnDamageText(s.bossX, 50, s.bossY, bsLabel, bsColor);
  }

  if (hitSomething) {
    playSound('hit');
    s.cameraShake = Math.max(s.cameraShake || 0, 12);
  }
}

function doMeleeHit() {
  const s = state;
  let hitSomething = false;

  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    const dist = Math.hypot(e.x - s.player.x, e.y - s.player.y);
    if (dist < s.player.r + e.r + 100) {
      const crit = calcCritDamage(s.player.attackDamage);
      e.hp -= crit.value;
      e.slowTimer = 30;
      e.stunTimer = 10;
      hitSomething = true;

      const dmgColor = crit.isCrit ? '#ffff00' : '#ff4444';
      const dmgLabel = crit.isCrit ? `CRIT! -${crit.value}` : `-${crit.value}`;
      spawnDamageText(e.x, e.mesh.position.y + 35, e.y, dmgLabel, dmgColor);
      // Apply status effects based on enemy type
      if (['slime', 'mage', 'necro'].includes(e.type) && !e.statusEffect && Math.random() < 0.2) {
        applyStatusEffect(e, 'poison');
      } else if (['fire_enemy', 'dragon', 'archdemon'].includes(e.type) && !e.statusEffect && Math.random() < 0.15) {
        applyStatusEffect(e, 'burn');
      }
      if (e.hp <= 0) killEnemy(i);
      else {
        if (crit.isCrit) spawnParticles(e.x, e.y, 0xffff00, 8, 'hit');
        else spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
      }
    }
  }

  // Check interactables
  if (s.interactables) {
    for (let i = s.interactables.length - 1; i >= 0; i--) {
      const it = s.interactables[i];
      if (it.scene !== s.currentScene || it.isVFX) continue;
      
      const dist = Math.hypot(it.x - s.player.x, it.y - s.player.y);
      if (dist < s.player.r + 30) {
        hitSomething = true;
        triggerInteractable(it, i);
      }
    }
  }

  if (s.bossActive) {
    const dist = Math.hypot(s.bossX - s.player.x, s.bossY - s.player.y);
    if (dist < s.player.r + 150) {
      const critBoss = calcCritDamage(s.player.attackDamage);
      s.bossHp -= critBoss.value;
      hitSomething = true;
      const bossDmgColor = critBoss.isCrit ? '#ffff00' : '#ff4444';
      const bossDmgLabel = critBoss.isCrit ? `CRIT! -${critBoss.value}` : `-${critBoss.value}`;
      spawnDamageText(s.bossX, 50, s.bossY, bossDmgLabel, bossDmgColor);
    }
  }

  if (hitSomething) {
    playSound('hit');
    s.cameraShake = Math.max(s.cameraShake || 0, 8);
  }

  // Epic Slash Effect Mesh
  const angle = Math.atan2(s.player.facingY, s.player.facingX);
  const px = s.player.x + Math.cos(angle) * 40;
  const pz = s.player.y + Math.sin(angle) * 40;

  const slashGeo = new THREE.BoxGeometry(10, 2, 180);
  const slashMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9 });
  const slashMesh = new THREE.Mesh(slashGeo, slashMat);
  
  slashMesh.position.set(px, 15, pz);
  slashMesh.rotation.y = -angle; // Align with facing direction
  
  s.scene.add(slashMesh);
  
  s.particles.push({
    mesh: slashMesh,
    dx: Math.cos(angle) * 12, // Fly forward
    dy: Math.sin(angle) * 12, // mapped to Z in updateParticles
    dz: 0,
    life: 1.0,
    decay: 0.08, // Fade out very fast
  });

  // Show dust kickup
  spawnParticles(px, pz, 0xffffff, 8, 'dust');
}

export function triggerInteractable(it, index) {
  const s = state;
  it.hp -= s.player.attackDamage;
  if (it.hp > 0) return;
  
  if (it.type === 'chest' && !it.looted) {
    it.looted = true;
    const lid = it.mesh.children[1];
    if (lid) lid.rotation.x = -Math.PI / 2.5; // Buka tutup peti
    playSound('coin');
    spawnParticles(it.x, it.y, 0xffff00, 15, 'heal');
    spawnDamageText(it.x, 40, it.y, `Harta Terbuka!`, '#ffff00');
    
    // Spawn gold
    for(let j=0; j<4; j++) {
      const dropMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(4, 0),
        new THREE.MeshLambertMaterial({ color: 0xffd700 })
      );
      dropMesh.position.set(it.x + (Math.random()-0.5)*20, 5, it.y + (Math.random()-0.5)*20);
      s.scene.add(dropMesh);
      s.lootDrops.push({ x: dropMesh.position.x, y: dropMesh.position.z, taken: false, type: 'loot', item: {id: 'gold', name: 'Gold', value: 10}, mesh: dropMesh });
    }
    // Spawn potion
    const potMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 6, 8),
      new THREE.MeshLambertMaterial({ color: 0xff0000 })
    );
    potMesh.position.set(it.x, 3, it.y + 10);
    s.scene.add(potMesh);
    s.lootDrops.push({ x: it.x, y: it.y + 10, taken: false, type: 'potion', mesh: potMesh });
    
  } else if (it.type === 'barrel' && !it.exploded) {
    it.exploded = true;
    playSound('hit');
    spawnParticles(it.x, it.y, 0xffaa00, 30, 'death'); // Ledakan api
    s.cameraShake = Math.max(s.cameraShake || 0, 20);
    
    // Damage player
    if (Math.hypot(s.player.x - it.x, s.player.y - it.y) < 80) {
      s.player.hp = Math.max(0, s.player.hp - 30);
      spawnDamageText(s.player.x, 30, s.player.y, `-30`, '#ff0000');
    }
    // Damage enemies
    for (let e of s.enemies) {
      if (Math.hypot(e.x - it.x, e.y - it.y) < 100) {
        e.hp -= 150;
        e.stunTimer = 60;
        spawnDamageText(e.x, e.mesh.position.y + 35, e.y, `-150`, '#ff0000');
      }
    }
    
    s.scene.remove(it.mesh);
    s.interactables.splice(index, 1);
  }
}

// ─── Potion ───────────────────────────────────────────────────────────────────

export function usePotion() {
  const s = state;
  if (s.potions > 0 && s.player.hp < s.player.maxHp) {
    s.potions--;
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + 40);
    playSound('coin');
    spawnParticles(s.player.x, s.player.y, 0x00ff00, 10, 'heal');
    const btn = document.getElementById('btn-potion');
    if (btn) btn.textContent = `🧪 Heal (C) [${s.potions}]`;
  }
}

// ─── Projectile update ────────────────────────────────────────────────────────

export function updateProjectiles(dt) {
  const s = state;
  for (let i = s.projectiles.length - 1; i >= 0; i--) {
    const p = s.projectiles[i];
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    p.mesh.position.set(p.x, 15, p.y);

    if (blocked(p.x, p.y, 6)) {
      s.scene.remove(p.mesh);
      s.projectiles.splice(i, 1);
      continue;
    }

    let hit = false;
    if (p.isEnemy) {
      if (Math.hypot(p.x - s.player.x, p.y - s.player.y) < s.player.r + 10) {
        hit = true;
        if (!s.player.defending) {
          s.player.hp -= 15;
          s.cameraShake = Math.max(s.cameraShake || 0, 15);
          playSound('hit');
          spawnDamageText(s.player.x, 30, s.player.y, `-15`, '#ff00ff');
          if (s.player.hp <= 0) triggerGameOver('Tembakan Bos mengakhiri petualanganmu!');
        }
      }
    } else {
      for (let j = s.enemies.length - 1; j >= 0; j--) {
        const e = s.enemies[j];
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 6) {
          let baseDmg = p.isPet ? s.player.attackDamage * 0.1 : s.player.attackDamage;
          const projCrit = calcCritDamage(baseDmg);
          e.hp -= projCrit.value;
          e.slowTimer = 90;
          e.stunTimer = 15;
          // knockback removed
          hit = true;
          playSound('hit');
          const pColor = projCrit.isCrit ? '#ffff00' : '#ff4444';
          const pLabel = projCrit.isCrit ? `CRIT! -${projCrit.value}` : `-${projCrit.value}`;
          spawnDamageText(e.x, e.mesh.position.y + 35, e.y, pLabel, pColor);
          // Apply status effects
          if (!e.statusEffect && Math.random() < 0.15) {
            if (['slime', 'mage', 'necro'].includes(e.type)) applyStatusEffect(e, 'poison');
            else if (['dragon', 'archdemon'].includes(e.type)) applyStatusEffect(e, 'burn');
          }
          if (e.hp <= 0) killEnemy(j);
          else spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
          break;
        }
      }
      if (!hit && s.bossActive) {
        if (Math.hypot(p.x - s.bossX, p.y - s.bossY) < 30 + 6) {
          let baseDmg = p.isPet ? s.player.attackDamage * 0.1 : s.player.attackDamage;
          const bossProjCrit = calcCritDamage(baseDmg);
          s.bossHp -= bossProjCrit.value;
          hit = true;
          playSound('hit');
          const bpColor = bossProjCrit.isCrit ? '#ffff00' : '#ff4444';
          const bpLabel = bossProjCrit.isCrit ? `CRIT! -${bossProjCrit.value}` : `-${bossProjCrit.value}`;
          spawnDamageText(s.bossX, 50, s.bossY, bpLabel, bpColor);
        }
      }
    }

    if (hit) {
      s.scene.remove(p.mesh);
      s.projectiles.splice(i, 1);
    }
  }
}

function killEnemy(index) {
  const s = state;
  const e = s.enemies[index];
  s.scene.remove(e.mesh);
  s.scene.remove(e.hpGroup);
  s.enemies.splice(index, 1);
  
  if (s.bountyQuest && s.bountyQuestProgress < s.bountyQuest.count) {
    s.bountyQuestProgress++;
    if (typeof window.updateQuestUI === 'function') window.updateQuestUI();
  }
  playSound('hit');
  spawnParticles(e.x, e.y, 0xff0000, 20, 'death');

  // Spawn Loot
  const loot = lootTable[e.type];
  if (loot) {
    // Drop chance is inversely proportional to item value (more expensive = rarer)
    const dropChance = 1.0 / Math.sqrt(loot.value);
    if (Math.random() < dropChance) {
      const dropMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(4, 0),
        new THREE.MeshLambertMaterial({ color: loot.color })
      );
      dropMesh.position.set(e.x, 5, e.y);
      dropMesh.castShadow = true;
      s.scene.add(dropMesh);
      s.lootDrops.push({ x: e.x, y: e.y, taken: false, type: 'loot', item: loot, mesh: dropMesh });
    }
  }
  if (Math.random() < 0.15) {
    const dropMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 6, 8),
      new THREE.MeshLambertMaterial({ color: 0xff0000 })
    );
    dropMesh.position.set(e.x + 5, 3, e.y + 5);
    s.scene.add(dropMesh);
    s.lootDrops.push({ x: e.x + 5, y: e.y + 5, taken: false, type: 'potion', mesh: dropMesh });
  }

  if (Math.random() < 0.05) {
    const portalMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1, 3),
      new THREE.MeshLambertMaterial({ color: 0x00ffff })
    );
    portalMesh.position.set(e.x - 5, 3, e.y + 5);
    s.scene.add(portalMesh);
    s.lootDrops.push({ x: e.x - 5, y: e.y + 5, taken: false, type: 'consumable', item: { id: 'hometown_portal', name: 'Portal Scroll' }, mesh: portalMesh });
  }

  // EXP orb
  const expGeo = new THREE.DodecahedronGeometry(5, 0);
  const expMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
  const expMesh = new THREE.Mesh(expGeo, expMat);
  expMesh.position.set(e.x, 10, e.y);
  s.scene.add(expMesh);
  s.expOrbs.push({ x: e.x, y: e.y, mesh: expMesh, taken: false });

}


// ─── Enemy AI update ──────────────────────────────────────────────────────────

export function updateEnemies(dt) {
  const s = state;
  if (s.currentScene === 'hometown') return;

  // Spawner — tier-2 enemies (slightly tighter) in Scorched Dunes
  if (s.isGameStarted) {
    s._spawnTimer = (s._spawnTimer ?? 0) + dt;
    const isWilds2 = s.currentScene === 'wilds2';
    const spawnRate = isWilds2 ? Math.max(120, 280 - s.player.level * 10)
                                : Math.max(90, 240 - s.player.level * 10);
    const maxEnemies = isWilds2 ? Math.min(60, 20 + s.player.level * 3)
                                 : Math.min(80, 30 + s.player.level * 5);
    if (s._spawnTimer > spawnRate && s.enemies.length < maxEnemies) {
      s._spawnTimer = 0;
      const ang = Math.random() * Math.PI * 2;
      const dist = 1200 + Math.random() * 400;
      const edgeX = s.player.x + Math.cos(ang) * dist;
      const edgeY = s.player.y + Math.sin(ang) * dist;
      const ex = Math.max(50, Math.min(mapSize - 50, edgeX));
      const ey = Math.max(50, Math.min(mapSize - 50, edgeY));
      if (isWilds2) spawnEnemy2(ex, ey);
      else spawnEnemy(ex, ey);
    }
  }

  for (let idx = s.enemies.length - 1; idx >= 0; idx--) {
    const e = s.enemies[idx];
    const distToPlayer = Math.hypot(s.player.x - e.x, s.player.y - e.y);

    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
    }

    // Status effects
    if (e.statusEffect && e.statusEffect.duration > 0) {
      e.statusEffect.duration -= dt;
      e.statusEffect.tickTimer -= dt;
      if (e.statusEffect.tickTimer <= 0) {
        e.hp -= e.statusEffect.damage;
        spawnDamageText(e.x, e.mesh.position.y + 35, e.y, `-${e.statusEffect.damage}`,
          e.statusEffect.type === 'poison' ? '#00ff00' : '#ff4400');
        e.statusEffect.tickTimer = e.statusEffect.duration > 0 ?
          statusEffects[e.statusEffect.type].tickInterval : 0;
        spawnParticles(e.x, e.y, e.statusEffect.type === 'poison' ? 0x00ff00 : 0xff4400, 2, 'hit');
        if (e.hp <= 0) { killEnemy(idx); continue; }
      }
      if (e.statusEffect.duration <= 0) {
        e.statusEffect = null;
      }
    }

    if (e.slowTimer > 0) e.slowTimer -= dt;

    if (e.stunTimer <= 0 && e.actionState === 'attack') {
      e.attackAnimTimer -= dt;
      e.dx = 0;
      e.dy = 0;

      if (e.attackAnimTimer <= 15 && !e.hasDealtDamage) {
        e.hasDealtDamage = true;
        if (distToPlayer < s.player.r + e.r + 20) {
          if (s.player.defending) {
            const angle = Math.atan2(e.y - s.player.y, e.x - s.player.x);
            e.dx = Math.cos(angle) * 5; e.dy = Math.sin(angle) * 5;
            e.stunTimer = 15;
            playSound('hit');
          } else {
            const eDmg = e.damage || 10;
            s.player.hp = Math.max(0, s.player.hp - eDmg);
            s.cameraShake = Math.max(s.cameraShake || 0, 5);
            playSound('hit');
            spawnDamageText(s.player.x, 30, s.player.y, `-${eDmg}`, '#ff8888');
            // Poison/burn chance when hit by elemental enemies
            if (!s.player.statusEffect) {
              if (['slime', 'mage', 'necro'].includes(e.type) && Math.random() < 0.3) {
                s.player.statusEffect = { type: 'poison', ...statusEffects.poison };
                document.getElementById('message').textContent = '☠️ Anda teracuni! Gunakan Antidote!';
              } else if (['dragon', 'archdemon'].includes(e.type) && Math.random() < 0.25) {
                s.player.statusEffect = { type: 'burn', ...statusEffects.burn };
                document.getElementById('message').textContent = '🔥 Anda terbakar! Gunakan Cooling Tea!';
              }
            }
            if (s.player.hp <= 0) teleportToHometown('Anda pingsan! Terlempar kembali ke Kota.');
          }
        }
      }

      if (e.attackAnimTimer <= 0) {
        e.actionState = 'chase';
      }
    } else {
      if (e.attackCooldown > 0) e.attackCooldown -= dt;

      const speed = e.slowTimer > 0 ? e.baseSpeed * 0.4 : e.baseSpeed;

      if (distToPlayer < 800) {
        const angle = Math.atan2(s.player.y - e.y, s.player.x - e.x);
        
        if (distToPlayer < s.player.r + e.r + 15 && e.hp > 0 && e.type !== 'kamikaze' && e.type !== 'archer' && (!e.attackCooldown || e.attackCooldown <= 0)) {
          e.actionState = 'attack';
          e.attackAnimTimer = 30;
          e.attackCooldown = 90;
          e.hasDealtDamage = false;
          e.dx = 0;
          e.dy = 0;
          e.mesh.rotation.y = angle;
        } else if (e.type === 'archer') {
          if (distToPlayer > 300) {
            e.dx = Math.cos(angle) * speed;
            e.dy = Math.sin(angle) * speed;
          } else {
            e.dx = 0; e.dy = 0;
          }
          if (e.attackTimer === undefined) e.attackTimer = 0;
          e.attackTimer += dt;
          if (e.attackTimer > 120 && distToPlayer < 400) {
            e.attackTimer = 0;
            const m = new THREE.Mesh(
              new THREE.SphereGeometry(4, 4, 4),
              new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            m.position.set(e.x, 10, e.y);
            s.scene.add(m);
            s.projectiles.push({
              x: e.x, y: e.y,
              dx: Math.cos(angle) * 8, dy: Math.sin(angle) * 8,
              mesh: m, isEnemy: true,
            });
            playSound('shoot');
          }
        } else {
          e.dx = Math.cos(angle) * speed;
          e.dy = Math.sin(angle) * speed;
        }
      } else {
        const spd = Math.hypot(e.dx, e.dy);
        if (spd !== speed && spd !== 0) {
          e.dx = (e.dx / spd) * speed;
          e.dy = (e.dy / spd) * speed;
        }
      }
    }

    let nx = e.x + e.dx * 1.5 * dt;
    let ny = e.y + e.dy * 1.5 * dt;

    if (e.isBossChild && s.bossActive) {
      const distToBoss = Math.hypot(e.x - s.bossX, e.y - s.bossY);
      
      if (distToBoss > 230) {
        // Force child to run towards the boss to catch up
        const angleToBoss = Math.atan2(s.bossY - e.y, s.bossX - e.x);
        e.dx = Math.cos(angleToBoss) * e.baseSpeed * 2;
        e.dy = Math.sin(angleToBoss) * e.baseSpeed * 2;
        nx = e.x + e.dx * 1.5 * dt;
        ny = e.y + e.dy * 1.5 * dt;
        e.actionState = 'chase'; 
      } else if (Math.hypot(nx - s.bossX, ny - s.bossY) > 230) {
        // Slide along the perimeter if trying to step out of bounds
        const angleToBoss = Math.atan2(ny - s.bossY, nx - s.bossX);
        nx = s.bossX + Math.cos(angleToBoss) * 230;
        ny = s.bossY + Math.sin(angleToBoss) * 230;
      }
    }

    if (e.type === 'ghost') {
      e.x = nx; e.y = ny;
    } else {
      if (blocked(nx, ny, e.r)) {
        if (!blocked(nx, e.y, e.r)) e.x = nx;
        else if (!blocked(e.x, ny, e.r)) e.y = ny;
        else {
          // Kalau tersangkut total, beri sedikit geseran acak agar bisa lepas dari sudut mati tembok
          e.x += (Math.random() - 0.5) * 10;
          e.y += (Math.random() - 0.5) * 10;
        }
      } else {
        e.x = nx; e.y = ny;
      }
    }

    // Smooth mesh follow
    let lungeOffsetX = 0;
    let lungeOffsetY = 0;
    if (e.actionState === 'attack') {
      const attackProgress = (30 - e.attackAnimTimer) / 30; // 0 to 1
      const lunge = Math.sin(attackProgress * Math.PI) * 10;
      const angle = e.mesh.rotation.y;
      lungeOffsetX = Math.cos(angle) * lunge;
      lungeOffsetY = Math.sin(angle) * lunge;
    }
    
    e.mesh.position.x += (e.x + lungeOffsetX - e.mesh.position.x) * Math.min(dt * 10, 1);
    e.mesh.position.z += (e.y + lungeOffsetY - e.mesh.position.z) * Math.min(dt * 10, 1);

    const speedScalar = Math.hypot(e.dx, e.dy);
    let hoverBob = e.isFlying ? Math.sin(Date.now() / 300 + e.x) * 5 : 0;
    let meshYTarget = e.meshY + hoverBob + (s.currentScene === 'wilds2'
      ? getTerrainHeightWilds2(e.x, e.y) : getTerrainHeight(e.x, e.y));
    
    if (e.actionState === 'attack') {
      const attackProgress = (30 - e.attackAnimTimer) / 30;
      const swing = Math.sin(attackProgress * Math.PI) * 1.5;
      const l = e.limbs;
      if (l['arm-left']) l['arm-left'].rotation.x = -swing;
      if (l['arm-right']) l['arm-right'].rotation.x = -swing;
      if (l['leg-left']) l['leg-left'].rotation.x = 0;
      if (l['leg-right']) l['leg-right'].rotation.x = 0;
    } else if (speedScalar > 0.1) {
      e.mesh.rotation.y = Math.atan2(e.dx, e.dy);
      if (e.walkCycle === undefined) e.walkCycle = Math.random() * Math.PI * 2;
      e.walkCycle += speedScalar * 0.08 * dt;
      meshYTarget += Math.abs(Math.sin(e.walkCycle * 2)) * 1.5;
      const l = e.limbs;
      if (l['leg-left']) l['leg-left'].rotation.x = Math.sin(e.walkCycle) * 0.8;
      if (l['leg-right']) l['leg-right'].rotation.x = Math.sin(e.walkCycle + Math.PI) * 0.8;
      if (l['arm-left']) l['arm-left'].rotation.x = Math.sin(e.walkCycle + Math.PI) * 0.8;
      if (l['arm-right']) l['arm-right'].rotation.x = Math.sin(e.walkCycle) * 0.8;
    } else {
      const l = e.limbs;
      if (l['leg-left']) l['leg-left'].rotation.x = 0;
      if (l['leg-right']) l['leg-right'].rotation.x = 0;
      if (l['arm-left']) l['arm-left'].rotation.x = 0;
      if (l['arm-right']) l['arm-right'].rotation.x = 0;
    }
    e.mesh.position.y += (meshYTarget - e.mesh.position.y) * Math.min(dt * 8, 1);
    e.hpGroup.position.set(e.x, e.mesh.position.y + 90, e.y);
    e.hpGroup.lookAt(s.camera.position);

    const hpPercent = Math.max(0, e.hp / e.maxHp);
    e.hpFg.scale.x = Math.max(0.001, hpPercent);
    e.hpFg.position.x = -(24 - (24 * hpPercent)) / 2;

    // Collision with player
    if (distToPlayer < s.player.r + e.r && e.hp > 0) {
      if (e.type === 'kamikaze') {
        spawnParticles(e.x, e.y, 0xff8800, 50, 'death');
        playSound('hit');
        s.player.hp = Math.max(0, s.player.hp - 20);
        e.hp = 0;
        s.scene.remove(e.mesh); s.scene.remove(e.hpGroup);
        s.enemies.splice(idx, 1);
        if (s.player.hp <= 0) teleportToHometown('Anda pingsan! Terlempar kembali ke Kota.');
      }
    }

    // Despawn enemies too far away (after 3s grace period so freshly-spawned
    // enemies are not removed before the player ever sees them)
    e.age += dt;
    if (!e.isBossChild && e.age > 180 && Math.hypot(e.x - s.player.x, e.y - s.player.y) > 2000 && e.stunTimer <= 0) {
      s.scene.remove(e.mesh);
      s.scene.remove(e.hpGroup);
      s.enemies.splice(idx, 1);
    }
  }
}

function teleportToHometown(msg) {
  const s = state;
  s.player.hp = s.player.maxHp;
  s.player.exp = Math.max(0, Math.floor(s.player.exp / 2)); // Kurangi EXP menjadi setengah, gold tidak dikurangi
  if (typeof window.teleportTo === 'function') window.teleportTo('hometown');
  if (typeof window.saveGame === 'function') window.saveGame(true);
  if (msg) document.getElementById('message').textContent = `💀 ${msg}`;
}

// ─── Boss AI ──────────────────────────────────────────────────────────────────

export function updateBoss(dt) {
  const s = state;
  if (!s.bossActive || !s.bossMesh) return;

  const dist = Math.hypot(s.player.x - s.bossX, s.player.y - s.bossY);
  const angle = Math.atan2(s.player.y - s.bossY, s.player.x - s.bossX);

  // Golem (Wilds) spawns in the far corner; the soldier (wilds2) in front of
  // the pyramid. Scenes set bossSpawnX/Y per boss; fall back to the old corner.
  const spawnX = s.bossSpawnX ?? (mapSize - 1000);
  const spawnY = s.bossSpawnY ?? (mapSize - 1000);
  const distToSpawn = Math.hypot(s.bossX - spawnX, s.bossY - spawnY);

  if (distToSpawn > 350) {
    s.bossReturning = true;
  }

  // Phase 2: HP < 50%
  if (s.bossPhase === 1 && s.bossHp <= s.bossMaxHp * 0.5) {
    s.bossPhase = 2;
    if (s.bossMesh.material) {
      s.bossMesh.material.color.setHex(0x880000);
    }
    // Spawn 2 extra minions
    for (let i = 0; i < 2; i++) {
      const mx = s.bossX + (Math.random() - 0.5) * 160;
      const my = s.bossY + (Math.random() - 0.5) * 160;
      spawnEnemy(mx, my, 0.7, true);
    }
  }

  const isAggro = dist < 300 || s.bossHp < s.bossMaxHp;

  if (s.bossReturning) {
    if (distToSpawn < 10) {
      s.bossReturning = false;
      s.bossHp = s.bossMaxHp; // Reset health to drop aggro
    } else {
      const returnAngle = Math.atan2(spawnY - s.bossY, spawnX - s.bossX);
      const nx = s.bossX + Math.cos(returnAngle) * 3 * dt;
      const ny = s.bossY + Math.sin(returnAngle) * 3 * dt;
      const bossRadius = 80;
      if (!blocked(nx, ny, bossRadius)) {
        s.bossX = nx; s.bossY = ny;
      } else {
        if (!blocked(nx, s.bossY, bossRadius)) s.bossX = nx;
        else if (!blocked(s.bossX, ny, bossRadius)) s.bossY = ny;
      }
      s.bossMesh.rotation.y = -returnAngle + Math.PI / 2;
    }
  } else if (isAggro) {
    const isArenaBoss = s.currentScene === 'wilds2';
    const moveSpeed = isArenaBoss ? 2.8 : 1.5;
    
    if (dist > 80) {
      const nx = s.bossX + Math.cos(angle) * moveSpeed * dt;
      const ny = s.bossY + Math.sin(angle) * moveSpeed * dt;
      const bossRadius = 80;
      if (!blocked(nx, ny, bossRadius)) {
        s.bossX = nx; s.bossY = ny;
      } else {
        if (!blocked(nx, s.bossY, bossRadius)) s.bossX = nx;
        else if (!blocked(s.bossX, ny, bossRadius)) s.bossY = ny;
      }
      s.bossMesh.rotation.y = -angle + Math.PI / 2;
    }

    const attackCooldown = s.bossPhase === 2 ? 80 : 120;
    s.bossAttackTimer = (s.bossAttackTimer || 0) + dt;

    if (isArenaBoss) {
      // Arena Champion: Melee Spear Attack
      if (s.bossAttackTimer > attackCooldown && dist < 160) {
        s.bossAttackTimer = 0;
        s.cameraShake = Math.max(s.cameraShake || 0, s.bossPhase === 2 ? 25 : 15);
        playSound('hit');
        
        // Animasi serangan tusukan (simulasi dengan rotasi sesaat)
        s.bossMesh.rotation.x = Math.PI / 8;
        setTimeout(() => { if (s.bossMesh) s.bossMesh.rotation.x = 0; }, 200);

        if (dist < 120) {
          if (!s.player.defending) {
            const spearDmg = s.bossPhase === 2 ? 35 : 25;
            s.player.hp -= spearDmg;
            spawnDamageText(s.player.x, 30, s.player.y, `-${spearDmg}`, '#ff00ff');
            const knockAngle = Math.atan2(s.player.y - s.bossY, s.player.x - s.bossX);
            s.player.x += Math.cos(knockAngle) * 50;
            s.player.y += Math.sin(knockAngle) * 50;
            if (s.player.hp <= 0) triggerGameOver(`Kamu tertusuk tombak Arena Champion!`);
          } else {
            const knockAngle = Math.atan2(s.player.y - s.bossY, s.player.x - s.bossX);
            s.player.x += Math.cos(knockAngle) * 20;
            s.player.y += Math.sin(knockAngle) * 20;
          }
        }
      }
    } else {
      // Golden Golem: Ground Pound & Projectiles
      const projectileChance = s.bossPhase === 2 ? 0.10 : 0.05;
      const groundPoundDmg = s.bossPhase === 2 ? 25 : 20;
      
      if (s.bossAttackTimer > attackCooldown && dist < 120) {
         s.bossAttackTimer = 0;
         s.cameraShake = Math.max(s.cameraShake || 0, s.bossPhase === 2 ? 25 : 20);
         spawnParticles(s.bossX, s.bossY, 0xffd700, 40, 'death');
         playSound('hit');
         if (dist < 100) {
            if (!s.player.defending) {
               s.player.hp -= groundPoundDmg;
               spawnDamageText(s.player.x, 30, s.player.y, `-${groundPoundDmg}`, '#ff00ff');
               const knockAngle = Math.atan2(s.player.y - s.bossY, s.player.x - s.bossX);
               s.player.x += Math.cos(knockAngle) * 40;
               s.player.y += Math.sin(knockAngle) * 40;
               if (s.player.hp <= 0) triggerGameOver(`Kamu dihancurkan hentakan The Golden Golem!`);
            } else {
               const knockAngle = Math.atan2(s.player.y - s.bossY, s.player.x - s.bossX);
               s.player.x += Math.cos(knockAngle) * 20;
               s.player.y += Math.sin(knockAngle) * 20;
            }
         }
      } else if (Math.random() < projectileChance) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(10, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        m.position.set(s.bossX, 30, s.bossY);
        s.scene.add(m);
        const pAngle = angle + (Math.random() - 0.5);
        s.projectiles.push({
          x: s.bossX, y: s.bossY,
          dx: Math.cos(pAngle) * 8, dy: Math.sin(pAngle) * 8,
          mesh: m, isEnemy: true,
        });
        playSound('shoot');
      }
    }
  }

  // Smooth position interpolation after logic
  s.bossMesh.position.x += (s.bossX - s.bossMesh.position.x) * Math.min(dt * 6, 1);
  s.bossMesh.position.z += (s.bossY - s.bossMesh.position.z) * Math.min(dt * 6, 1);
  const bossTerrainY = s.currentScene === 'wilds2'
    ? getTerrainHeightWilds2(s.bossX, s.bossY)
    : getTerrainHeight(s.bossX, s.bossY);
  
  const bossBaseY = s.currentScene === 'wilds2' ? -5 : 30; // -5 agar kaki menapak tanah

  // Animasi langkah yang lebih hidup (Bobbing & Wobbling)
  let walkBob = 0;
  let walkWobble = 0;
  if (isAggro && dist > 80) {
    // Arena Champion bergerak lebih cepat jadi animasinya lebih cepat dan melompat tinggi
    const walkSpeed = s.currentScene === 'wilds2' ? 120 : 250; 
    const time = Date.now() / walkSpeed;
    walkBob = Math.abs(Math.sin(time)) * (s.currentScene === 'wilds2' ? 15 : 6);
    walkWobble = Math.sin(time) * 0.15;
  }

  s.bossMesh.position.y += (bossBaseY + bossTerrainY + walkBob - s.bossMesh.position.y) * Math.min(dt * 6, 1);
  s.bossMesh.rotation.z = walkWobble;
  s.bossMesh.rotation.x = Math.sin(Date.now() / 300) * 0.05;

  s.bossHpGroup.position.x += (s.bossX - s.bossHpGroup.position.x) * Math.min(dt * 6, 1);
  s.bossHpGroup.position.z += (s.bossY - s.bossHpGroup.position.z) * Math.min(dt * 6, 1);
  s.bossHpGroup.position.y += (120 - s.bossHpGroup.position.y) * Math.min(dt * 6, 1);
  s.bossHpGroup.lookAt(s.camera.position);

  const pct = Math.max(0, s.bossHp / s.bossMaxHp);
  s.bossHpFg.scale.x = Math.max(0.001, pct);
  s.bossHpFg.position.x = -(80 - (80 * pct)) / 2;

  // Contact damage
  if (dist < s.player.r + 30) {
    if (!s.player.defending) {
      s.player.hp -= 1.0;
      playSound('hit');
      if (s.player.hp <= 0) {
        const cause = s.currentScene === 'wilds2' ? 'Arena Champion!' : 'The Golden Golem!';
        triggerGameOver(`Kamu dihancurkan ${cause}`);
      }
      // Boss does not move
    }
  }

  if (s.bossHp <= 0) {
    s.scene.remove(s.bossMesh);
    s.scene.remove(s.bossHpGroup);
    s.bossActive = false;
    s.gameOver = true;
    if (typeof window.saveGame === 'function') window.saveGame(true);
    playSound('coin');
    spawnParticles(s.bossX, s.bossY, 0xffd700, 100, 'death');
    const name = s.currentScene === 'wilds2' ? 'Arena Champion' : 'The Golden Golem';
    document.getElementById('message').textContent = `👑 ${name} telah dikalahkan! Kamu mendapatkan senjata legendaris Excalibur!`;

    if (!s.ownedWeapons.includes(4)) {
      s.ownedWeapons.push(4);
    }

    // Boss always drops a potion
    const potGeo = new THREE.CylinderGeometry(3, 3, 8, 8);
    const potMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const potMesh = new THREE.Mesh(potGeo, potMat);
    potMesh.position.set(s.bossX + 10, 10, s.bossY + 10);
    s.scene.add(potMesh);
    s.potionItems.push({ x: s.bossX + 10, y: s.bossY + 10, mesh: potMesh, taken: false });

    // Show win screen
    setTimeout(() => {
      document.getElementById('win').style.display = 'flex';
    }, 1000);
  }
}

function triggerGameOver(msg) {
  const s = state;
  s.gameOver = true;
  
  // Sembuhkan pemain dan kembalikan ke Hometown sebelum di-save
  s.player.hp = s.player.maxHp;
  s.player.exp = Math.max(0, Math.floor(s.player.exp / 2));
  s.currentScene = 'hometown';
  s.player.x = 500;
  s.player.y = 500;
  
  if (typeof window.saveGame === 'function') window.saveGame(true);
  document.getElementById('message').textContent = `💀 ${msg}`;
  document.getElementById('lose').style.display = 'flex';
}
