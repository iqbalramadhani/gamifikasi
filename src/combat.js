import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';
import { mapSize, weaponList, armorList, enemyTemplates, enemyTemplates2, eliteTemplates, WILDS2_MIN_LEVEL, lootTable, consumableItems, statusEffects } from './constants.js';
import { loadedModels, createEnemyMixer } from './model-loader.js';
import { blocked, spawnParticles, spawnDamageText } from './helpers.js';
import { spawnAtFreePos, spawnAtFreePosWilds2, getTerrainHeight, getTerrainHeightWilds2 } from './scenes.js';
import { playSound } from './audio.js';

// ─── Enemy animation helper ───────────────────────────────────────────────────

export function playEnemyAction(e, actionName, duration = 0.2) {
  if (!e || !e.mixer || !e.actions) return;
  const target = e.actions[actionName];
  if (!target) return;

  if (e.currentAction === target) {
    if (!target.isRunning()) {
      target.reset();
      target.play();
    }
    return;
  }

  const prev = e.currentAction;
  e.currentAction = target;
  e.currentActionName = actionName;

  target.reset();
  target.fadeIn(duration);
  target.play();

  if (prev && prev !== target) {
    prev.fadeOut(duration);
  }
}

/**
 * Mencari sudut jalan memutar (detour) ketika musuh terhalang oleh objek/rintangan.
 * Menguji berbagai sudut ke kiri dan ke kanan untuk menemukan jalur yang bebas obstacle.
 */
export function findDetourAngle(e, targetX, targetY) {
  const directAngle = Math.atan2(targetY - e.y, targetX - e.x);
  const offsets = [
    Math.PI * 0.25, -Math.PI * 0.25,
    Math.PI * 0.45, -Math.PI * 0.45,
    Math.PI * 0.65, -Math.PI * 0.65,
    Math.PI * 0.85, -Math.PI * 0.85
  ];
  if (Math.random() < 0.5) offsets.reverse();

  const checkDist = (e.r || 16) + 35;
  for (const offset of offsets) {
    const testAng = directAngle + offset;
    const testX = e.x + Math.cos(testAng) * checkDist;
    const testY = e.y + Math.sin(testAng) * checkDist;
    if (!blocked(testX, testY, e.r)) {
      const halfX = e.x + Math.cos(testAng) * (checkDist * 0.5);
      const halfY = e.y + Math.sin(testAng) * (checkDist * 0.5);
      if (!blocked(halfX, halfY, e.r)) {
        return testAng;
      }
    }
  }
  return directAngle + (Math.random() < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5);
}

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

function hasAnyKey(keys, names) {
  for (const n of names) if (keys[n]) return true;
  return false;
}

export function spawnEnemy(ex, ey, scaleFactor = 1.0, isBossChild = false, forceElite = false) {
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
  const isElite = (forceElite || (!isBossChild && Math.random() < 0.22)) && !!eliteTemplates[typeStr];
  const elite = isElite ? eliteTemplates[typeStr] : null;

  if (isElite) {
    scaleFactor *= elite.scaleBonus;
    eR *= elite.scaleBonus;
    hp *= elite.hpMultiplier;
    damage = (damage || 10) * elite.damageMultiplier;
    baseSpeed *= elite.speedMultiplier;
  }

  let mesh, eY;
  let animData = null;

  if (loadedModels[charKey]) {
    const gltfEnemy = SkeletonUtils.clone(loadedModels[charKey]);
    gltfEnemy.scale.set(7 * scaleFactor, 7 * scaleFactor, 7 * scaleFactor);
    gltfEnemy.position.y = -12;
    gltfEnemy.traverse(child => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(m => m.clone());
          } else {
            child.material = child.material.clone();
          }
        }
      }
    });
    mesh = new THREE.Group();
    mesh.add(gltfEnemy);
    eY = isFlying ? (isElite ? 42 : 35) : 15;
    animData = createEnemyMixer(charKey, gltfEnemy);
  } else {
    const boxGeo = new THREE.BoxGeometry(20 * scaleFactor, 20 * scaleFactor, 20 * scaleFactor);
    const boxMat = new THREE.MeshLambertMaterial({ color: isElite ? elite.auraColor : 0xff0000 });
    mesh = new THREE.Mesh(boxGeo, boxMat);
    eY = isFlying ? (isElite ? 38 : 30) : 10;
  }

  let auraMesh = null;
  let crownMesh = null;
  let eliteLight = null;

  if (isElite) {
    // Glowing ground aura ring
    const auraGeo = new THREE.RingGeometry(eR * 0.8, eR * 1.45, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: elite.auraColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.position.y = isFlying ? -28 : -11;
    mesh.add(auraMesh);

    // Floating Golden Crown / Emblem
    const crownGeo = new THREE.OctahedronGeometry(4.5 * (scaleFactor / elite.scaleBonus), 0);
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    crownMesh = new THREE.Mesh(crownGeo, crownMat);
    crownMesh.position.y = isFlying ? 42 : 32;
    mesh.add(crownMesh);

    // Subtle colored point light
    eliteLight = new THREE.PointLight(elite.auraColor, 1.8, 80);
    eliteLight.position.y = 12;
    mesh.add(eliteLight);
  }

  const levelMulti = 1 + s.player.level * 0.1;
  hp *= levelMulti;
  mesh.position.set(ex, eY, ey);
  s.scene.add(mesh);

  const hpBarWidth = isElite ? 38 : 24;
  const hpBarHeight = isElite ? 5.5 : 4;
  const hpGeo = new THREE.PlaneGeometry(hpBarWidth, hpBarHeight);
  const hpBgMat = new THREE.MeshBasicMaterial({ color: isElite ? 0x0a0a0a : 0x222222 });
  const hpFgMat = new THREE.MeshBasicMaterial({ color: isElite ? 0xff0055 : 0x008800 });
  const hpGroup = new THREE.Group();
  const hpBg = new THREE.Mesh(hpGeo, hpBgMat);
  const hpFg = new THREE.Mesh(hpGeo, hpFgMat);
  hpFg.position.z = 0.1;
  hpGroup.add(hpBg, hpFg);

  if (isElite) {
    // Golden border frame for Elite HP
    const frameGeo = new THREE.PlaneGeometry(hpBarWidth + 2.5, hpBarHeight + 2);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.05;
    hpGroup.add(frameMesh);

    // Star icon marker on left of HP bar
    const starGeo = new THREE.OctahedronGeometry(2.5, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.set(-hpBarWidth / 2 - 4.5, 0, 0.2);
    hpGroup.add(starMesh);
  }

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
    mixer: animData?.mixer || null,
    actions: animData?.actions || null,
    currentAction: animData?.currentAction || null,
    currentActionName: animData?.currentAction ? 'idle' : null,
    stunTimer: 0, slowTimer: 0, type: typeStr,
    attackTimer: 0, walkCycle: Math.random() * Math.PI * 2,
    limbs,
    isBossChild,
    isFlying: !!isFlying,
    age: 0,
    isElite,
    elite,
    auraMesh,
    crownMesh,
    hpBarWidth,
    _announced: false,
    hazardTimer: 0,
    pauseTimer: 0,
    detourTimer: 0,
    detourAngle: 0,
    stuckCounter: 0,
    lastX: ex,
    lastY: ey,
  });
}

// ─── Tier-2 enemy spawner (Scorched Dunes, level 10+) ──────────────────────

export function spawnEnemy2(ex, ey, scaleFactor = 1.0, isBossChild = false, forceElite = false) {
  const s = state;
  if (s.player.level < WILDS2_MIN_LEVEL) return;
  if (!ex || !ey) {
    const pos = spawnAtFreePosWilds2();
    ex = pos.x; ey = pos.y;
  }

  const tmpl = enemyTemplates2[Math.floor(Math.random() * enemyTemplates2.length)];
  let { hp, speed: baseSpeed, r: eR, typeStr, isFlying, damage } = tmpl;
  const charKey = tmpl.charKey;

  const isElite = (forceElite || (!isBossChild && Math.random() < 0.22)) && !!eliteTemplates[typeStr];
  const elite = isElite ? eliteTemplates[typeStr] : null;

  if (isElite) {
    scaleFactor *= elite.scaleBonus;
    eR *= elite.scaleBonus;
    hp *= elite.hpMultiplier;
    damage = (damage || 10) * elite.damageMultiplier;
    baseSpeed *= elite.speedMultiplier;
  }

  let mesh, eY;
  let animData = null;
  if (loadedModels[charKey]) {
    const gltfEnemy = SkeletonUtils.clone(loadedModels[charKey]);
    if (charKey === 'arena_soldier') {
      gltfEnemy.scale.set(25 * scaleFactor, 25 * scaleFactor, 25 * scaleFactor);
    } else {
      gltfEnemy.scale.set(7 * scaleFactor, 7 * scaleFactor, 7 * scaleFactor);
    }
    gltfEnemy.position.y = -12;
    gltfEnemy.traverse(child => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(m => m.clone());
          } else {
            child.material = child.material.clone();
          }
        }
      }
    });
    mesh = new THREE.Group();
    mesh.add(gltfEnemy);
    eY = isFlying ? (isElite ? 42 : 35) : 15;
    animData = createEnemyMixer(charKey, gltfEnemy);
  } else {
    const boxGeo = new THREE.BoxGeometry(20 * scaleFactor, 20 * scaleFactor, 20 * scaleFactor);
    const boxMat = new THREE.MeshLambertMaterial({ color: isElite ? elite.auraColor : 0xff8800 });
    mesh = new THREE.Mesh(boxGeo, boxMat);
    eY = isFlying ? (isElite ? 38 : 30) : 10;
  }

  let auraMesh = null;
  let crownMesh = null;
  let eliteLight = null;

  if (isElite) {
    // Glowing ground aura ring
    const auraGeo = new THREE.RingGeometry(eR * 0.8, eR * 1.45, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: elite.auraColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.position.y = isFlying ? -28 : -11;
    mesh.add(auraMesh);

    // Floating Golden Crown / Emblem
    const crownGeo = new THREE.OctahedronGeometry(4.5 * (scaleFactor / elite.scaleBonus), 0);
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    crownMesh = new THREE.Mesh(crownGeo, crownMat);
    crownMesh.position.y = isFlying ? 42 : 32;
    mesh.add(crownMesh);

    // Subtle colored point light
    eliteLight = new THREE.PointLight(elite.auraColor, 1.8, 80);
    eliteLight.position.y = 12;
    mesh.add(eliteLight);
  }

  // Stronger scaling than the base Wilds tier
  const levelMulti = 1 + s.player.level * 0.12;
  hp *= levelMulti;
  mesh.position.set(ex, eY, ey);
  s.scene.add(mesh);

  const hpBarWidth = isElite ? 38 : 24;
  const hpBarHeight = isElite ? 5.5 : 4;
  const hpGeo = new THREE.PlaneGeometry(hpBarWidth, hpBarHeight);
  const hpBgMat = new THREE.MeshBasicMaterial({ color: isElite ? 0x0a0a0a : 0x222222 });
  const hpFgMat = new THREE.MeshBasicMaterial({ color: isElite ? 0xff0055 : 0xaa2200 });
  const hpGroup = new THREE.Group();
  const hpBg = new THREE.Mesh(hpGeo, hpBgMat);
  const hpFg = new THREE.Mesh(hpGeo, hpFgMat);
  hpFg.position.z = 0.1;
  hpGroup.add(hpBg, hpFg);

  if (isElite) {
    // Golden border frame for Elite HP
    const frameGeo = new THREE.PlaneGeometry(hpBarWidth + 2.5, hpBarHeight + 2);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = -0.05;
    hpGroup.add(frameMesh);

    // Star icon marker on left of HP bar
    const starGeo = new THREE.OctahedronGeometry(2.5, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.set(-hpBarWidth / 2 - 4.5, 0, 0.2);
    hpGroup.add(starMesh);
  }

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
    mixer: animData?.mixer || null,
    actions: animData?.actions || null,
    currentAction: animData?.currentAction || null,
    currentActionName: animData?.currentAction ? 'idle' : null,
    stunTimer: 0, slowTimer: 0, type: typeStr,
    attackTimer: 0, walkCycle: Math.random() * Math.PI * 2,
    limbs,
    isBossChild,
    isFlying: !!isFlying,
    tier: 2,
    age: 0,
    isElite,
    elite,
    auraMesh,
    crownMesh,
    hpBarWidth,
    _announced: false,
    hazardTimer: 0,
    pauseTimer: 0,
    detourTimer: 0,
    detourAngle: 0,
    stuckCounter: 0,
    lastX: ex,
    lastY: ey,
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

  if (s.player.tripleHitDelay.length > 0) {
    s.player.tripleHitDelay[0] -= dt;
    if (s.player.tripleHitDelay[0] <= 0) {
      s.player.tripleHitDelay.shift();
      doTripleHit(s.player.tripleHitDelay.length === 0);
    }
  }
  if (s.keys.arrowup) dy += 1;
  if (s.keys.arrowdown) dy -= 1;
  if (s.keys.arrowleft) dx += 1;
  if (s.keys.arrowright) dx -= 1;

  if (s.keys.c) { s.keys.c = false; usePotion(); }
  if (s.keys.b) { s.keys.b = false; useStaminaPotion(); }
  if (s.keys.x) { triggerSpinAttack(); }

  if (hasAnyKey(s.keys, ['arrowup', 'arrowdown', 'arrowleft', 'arrowright']) && s.autoWalkTarget) {
    clearAutoWalkTarget();
  }

  if (dx === 0 && dy === 0 && s.autoWalkTarget) {
    const targetX = s.autoWalkTarget.x;
    const targetY = s.autoWalkTarget.y;
    const distToTarget = Math.hypot(targetX - s.player.x, targetY - s.player.y);

    if (distToTarget <= 12) {
      clearAutoWalkTarget();
    } else {
      // Base direction toward target
      let adx = (targetX - s.player.x) / distToTarget;
      let ady = (targetY - s.player.y) / distToTarget;

      // Look-ahead sampling: cast several candidate directions ahead of the
      // player and pick the free one that best points toward the target.
      // This routes around obstacles well before contact, not after.
      const LOOKAHEAD = 60;   // how far ahead to sample
      const SAMPLES = 12;     // how many directions to try
      const straightAngle = Math.atan2(ady, adx);

      // First check: is the straight path clear?
      if (!blocked(s.player.x + adx * LOOKAHEAD, s.player.y + ady * LOOKAHEAD, s.player.r)) {
        // Straight path is clear — go directly to target
      } else {
        // Straight path is blocked — sample ±90° around it and pick the
        // free candidate with the best alignment to the target direction.
        let bestAngle = straightAngle;
        let bestScore = -Infinity;

        for (let i = 0; i < SAMPLES; i++) {
          const spread = Math.PI; // ±90°
          const angle = straightAngle - spread / 2 + (spread / (SAMPLES - 1)) * i;
          const sx = Math.cos(angle), sy = Math.sin(angle);
          const px = s.player.x + sx * LOOKAHEAD;
          const py = s.player.y + sy * LOOKAHEAD;

          if (blocked(px, py, s.player.r)) continue;

          let dAngle = angle - straightAngle;
          while (dAngle >  Math.PI) dAngle -= 2 * Math.PI;
          while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
          // Prefer candidates closer to straight; break ties by favouring the
          // side that also reduces distance to target.
          const score = 1 - Math.abs(dAngle) / (Math.PI / 2);

          if (score > bestScore) { bestScore = score; bestAngle = angle; }
        }

        adx = Math.cos(bestAngle);
        ady = Math.sin(bestAngle);
      }

      // Re-normalise to avoid drift
      const bl = Math.hypot(adx, ady) || 1;
      adx /= bl; ady /= bl;

      dx = adx;
      dy = ady;
    }
  }

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;

    const rotDx = dx * Math.cos(s.cameraAngle) + dy * Math.sin(s.cameraAngle);
    const rotDy = -dx * Math.sin(s.cameraAngle) + dy * Math.cos(s.cameraAngle);
    dx = rotDx;
    dy = rotDy;

    // Dash
    if (s.keys.z && s.player.dashCooldown <= 0) {
      if (s.player.stamina >= 30) {
        s.player.stamina -= 30;
        s.player.dashCooldown = 180;
        s.player.isDashing = 15;
        playSound('dash');
        spawnParticles(s.player.x, s.player.y, 0xaaaaaa, 5, 'dust');
      } else {
        const msgEl = document.getElementById('message');
        if (msgEl) msgEl.textContent = '❌ SP tidak cukup untuk Dash (Butuh 30 SP)! Minum SP Potion [B]';
      }
    }

    // Spin attack
    if (s.keys.x) {
      if (s.player.spinCooldown <= 0 && s.player.stamina < 50) {
        s.keys.x = false;
        const msgEl = document.getElementById('message');
        if (msgEl) msgEl.textContent = '❌ SP tidak cukup untuk Spin Attack (Butuh 50 SP)! Minum SP Potion [B]';
      } else {
        triggerSpinAttack();
      }
    }

    // Triple Slash (R) — skill baru, animasi sword_slash_3, 3 hit
    if (s.keys.r && s.player.tripleCooldown <= 0) {
      s.keys.r = false;
      if (s.player.stamina >= 60) {
        s.player.stamina -= 60;
        s.player.tripleCooldown = 300;
        s.player.isTripling = 283;
        s.player.tripleHitDelay = [94, 94, 94];
        playSound('spin');
      } else {
        const msgEl = document.getElementById('message');
        if (msgEl) msgEl.textContent = '❌ SP tidak cukup untuk Triple Slash (Butuh 60 SP)! Minum SP Potion [B]';
      }
    }

    let currentSpeed = s.player.defending ? s.player.speed * 0.4 : s.player.speed;
    if (s.player.isDashing > 0) { currentSpeed *= 3.5; s.player.isDashing -= dt; }
    // Lock position during triple slash animation
    if (s.player.isTripling > 0) currentSpeed = 0;

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

export function clearAutoWalkTarget() {
  state.autoWalkTarget = null;
  if (state.waypointMesh) {
    state.scene?.remove(state.waypointMesh);
    state.waypointMesh.geometry?.dispose?.();
    state.waypointMesh.material?.dispose?.();
    state.waypointMesh = null;
  }
}

function animatePlayer(walking) {
  const s = state;
  const isAttacking = s.player.attackCooldown > 0 || s.player.isSpinning > 0 || s.player.isTripling > 0;

  if (s.playerMixer) {
    let targetAction = s.playerActions.idle;
    if (s.player.isTripling > 0 && s.playerActions.triple) {
      targetAction = s.playerActions.triple;
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

  // Trigger aura burst
  if (s.auraBursts) {
    for (const b of s.auraBursts.children) {
      b.visible = true;
      b.userData.life = 30;
      b.userData.ang  = Math.random() * Math.PI * 2;
    }
  }
}

function applyEliteOnHit(e, dmgValue) {
  const s = state;
  if (!e.isElite || !e.elite) return dmgValue;
  let finalDmg = dmgValue;

  // Centurion Phalanx Shield (blocks 40% from front)
  if (e.elite.ability === 'phalanx_shield') {
    const angleToPlayer = Math.atan2(s.player.y - e.y, s.player.x - e.x);
    let diff = Math.abs(angleToPlayer - e.mesh.rotation.y);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
    if (diff < 1.0) {
      finalDmg = Math.max(1, Math.floor(finalDmg * 0.6));
      spawnDamageText(e.x, e.mesh.position.y + 45, e.y, `SHIELD BLOCKED!`, '#ffffff');
      playSound('hit');
    }
  }

  // Thorn Emperor Cactoro retaliation
  if (e.elite.ability === 'thorns_reflect' && !s.player.defending) {
    const thornsDmg = 6;
    s.player.hp = Math.max(0, s.player.hp - thornsDmg);
    spawnDamageText(s.player.x, 30, s.player.y, `THORNS! -${thornsDmg}`, '#ffd600');
    spawnParticles(s.player.x, s.player.y, 0xffd600, 5, 'hit');
  }

  // Golden Midas Slime drops coin on hit
  if (e.elite.ability === 'golden_burst') {
    s.gold += 5;
    spawnParticles(e.x, e.y, 0xffd700, 4, 'heal');
    spawnDamageText(e.x, e.mesh.position.y + 35, e.y, `+5 GOLD!`, '#ffd700');
    if (typeof window.updateUI === 'function') window.updateUI(true);
  }

  return finalDmg;
}

function doTripleHit(finalHit = false) {
  const s = state;
  let hitSomething = false;
  const slashScale = finalHit ? 1.6 : 1.0;
  const dmgMult = finalHit ? 2.5 : 2.0;

  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < s.player.r + e.r + 100) {
      const crit = calcCritDamage(s.player.attackDamage * dmgMult);
      const dealtDmg = applyEliteOnHit(e, crit.value);
      e.hp -= dealtDmg;
      e.slowTimer = finalHit ? 45 : 30;
      e.stunTimer = finalHit ? 15 : 10;
      hitSomething = true;
      const color = crit.isCrit ? '#ffff00' : '#ff4444';
      const label = crit.isCrit ? `CRIT! -${dealtDmg}` : `-${dealtDmg}`;
      spawnDamageText(e.x, e.mesh.position.y + 35, e.y, label, color);
      if (e.hp <= 0) killEnemy(i);
      else {
        if (crit.isCrit) spawnParticles(e.x, e.y, 0xffff00, 8, 'hit');
        else spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
      }
    }
  }

  if (s.interactables) {
    for (let i = s.interactables.length - 1; i >= 0; i--) {
      const it = s.interactables[i];
      if (it.scene !== s.currentScene || it.isVFX) continue;
      if (Math.hypot(it.x - s.player.x, it.y - s.player.y) < s.player.r + 30) {
        hitSomething = true;
        triggerInteractable(it, i);
      }
    }
  }

  if (s.bossActive && Math.hypot(s.bossX - s.player.x, s.bossY - s.player.y) < s.player.r + 150) {
    const bossCrit = calcCritDamage(s.player.attackDamage * dmgMult);
    s.bossHp -= bossCrit.value;
    hitSomething = true;
    const bsColor = bossCrit.isCrit ? '#ffff00' : '#ff4444';
    const bsLabel = bossCrit.isCrit ? `CRIT! -${bossCrit.value}` : `-${bossCrit.value}`;
    spawnDamageText(s.bossX, 50, s.bossY, bsLabel, bsColor);
  }

  if (hitSomething) {
    playSound('hit');
    s.cameraShake = Math.max(s.cameraShake || 0, finalHit ? 14 : 8);
  }

  // Slash VFX — final hit lebih besar
  const angle = Math.atan2(s.player.facingY, s.player.facingX);
  const px = s.player.x + Math.cos(angle) * 40;
  const pz = s.player.y + Math.sin(angle) * 40;
  const slashGeo = new THREE.BoxGeometry(10 * slashScale, 2 * slashScale, 180 * slashScale);
  const slashMat = new THREE.MeshBasicMaterial({
    color: finalHit ? 0xffff44 : 0xffd700, transparent: true,
    opacity: finalHit ? 0.95 : 0.85
  });
  const slashMesh = new THREE.Mesh(slashGeo, slashMat);
  slashMesh.position.set(px, 15, pz);
  slashMesh.rotation.y = -angle;
  s.scene.add(slashMesh);
  s.particles.push({
    mesh: slashMesh,
    dx: Math.cos(angle) * 12,
    dy: Math.sin(angle) * 12,
    dz: 0,
    life: finalHit ? 1.2 : 0.8,
    decay: finalHit ? 0.05 : 0.08,
  });
  spawnParticles(px, pz, finalHit ? 0xffff44 : 0xffffff, finalHit ? 12 : 8, 'dust');
}

function doMeleeHit() {
  const s = state;
  let hitSomething = false;

  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    const dist = Math.hypot(e.x - s.player.x, e.y - s.player.y);
    if (dist < s.player.r + e.r + 100) {
      const crit = calcCritDamage(s.player.attackDamage);
      const dealtDmg = applyEliteOnHit(e, crit.value);
      e.hp -= dealtDmg;
      e.slowTimer = 30;
      e.stunTimer = 10;
      hitSomething = true;

      const dmgColor = crit.isCrit ? '#ffff00' : '#ff4444';
      const dmgLabel = crit.isCrit ? `CRIT! -${dealtDmg}` : `-${dealtDmg}`;
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
      s.lootDrops.push({ x: dropMesh.position.x, y: dropMesh.position.z, taken: false, type: 'gold', item: {id: 'gold', name: 'Gold', value: 10}, mesh: dropMesh });
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

// ─── Spin Attack Skill ────────────────────────────────────────────────────────

export function triggerSpinAttack() {
  const s = state;
  if (s.player.spinCooldown > 0 || s.player.stamina < 50 || s.gameOver || s.isPaused || !s.isGameStarted) return false;
  s.player.stamina -= 50;
  s.player.spinCooldown = 300;
  s.player.isSpinning = 30;
  s.cameraShake = Math.max(s.cameraShake || 0, 8);
  playSound('spin');

  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < s.player.r + e.r + 100) {
      const spinCrit = calcCritDamage(s.player.attackDamage * 3);
      const dealtDmg = applyEliteOnHit(e, spinCrit.value);
      e.hp -= dealtDmg;
      e.slowTimer = 90;
      e.stunTimer = 20;
      const spinColor = spinCrit.isCrit ? '#ffff00' : '#ff4444';
      const spinLabel = spinCrit.isCrit ? `CRIT! -${dealtDmg}` : `-${dealtDmg}`;
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
         triggerInteractable(it, i);
      }
    }
  }
  if (s.bossActive && Math.hypot(s.bossX - s.player.x, s.bossY - s.player.y) < s.player.r + 150) {
    const bossSpinCrit = calcCritDamage(s.player.attackDamage * 3);
    s.bossHp -= bossSpinCrit.value;
    playSound('hit');
    const bsColor = bossSpinCrit.isCrit ? '#ffff00' : '#ff4444';
    const bsLabel = bossSpinCrit.isCrit ? `CRIT! -${bossSpinCrit.value}` : `-${bossSpinCrit.value}`;
    spawnDamageText(s.bossX, 50, s.bossY, bsLabel, bsColor);
  }
  return true;
}

// ─── Auto-Combat Mode ─────────────────────────────────────────────────────────

export function updateAutoCombat(dt) {
  const s = state;
  if (!s.autoAttack || s.gameOver || s.isPaused || !s.isGameStarted) return;
  if (s.player.defending || s.player.isTripling > 0) return;
  if (s.currentScene === 'hometown') return; // Safe zone, no enemies to attack

  const range = s.autoAttackRange || 140;
  const nearbyEnemies = [];

  // Pindai musuh standar yang masih hidup dalam jangkauan
  // Musuh ranged di-scan dengan radius lebih besar agar bisa di-chase dari jarak jauh
  const RANGED_CHASE_RANGE = 400;
  const RANGED_TYPES = new Set(['archer', 'sc_archer']);
  const RANGED_ELITE_ABILITIES = ['mage', 'sc_mage', 'sc_dragon'];
  if (s.enemies && s.enemies.length > 0) {
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      if (!e || e.hp <= 0) continue;
      const dist = Math.hypot(e.x - s.player.x, e.y - s.player.y);
      const isRanged = RANGED_TYPES.has(e.type) ||
        (e.isElite && RANGED_ELITE_ABILITIES.includes(e.type));
      const scanRadius = isRanged ? RANGED_CHASE_RANGE : range + (e.r || 16);
      if (dist <= scanRadius) {
        nearbyEnemies.push({ entity: e, dist, isBoss: false });
      }
    }
  }

  // Pindai boss jika aktif dalam jangkauan
  if (s.bossActive && s.bossHp > 0) {
    const bossDist = Math.hypot(s.bossX - s.player.x, s.bossY - s.player.y);
    if (bossDist <= range + 40) {
      nearbyEnemies.push({
        entity: { x: s.bossX, y: s.bossY, r: 40, hp: s.bossHp },
        dist: bossDist,
        isBoss: true
      });
    }
  }

  if (nearbyEnemies.length === 0) {
    // ── Auto-Loot: Jalan ke drop loot terdekat saat tidak ada musuh ──────────
    if (s.lootDrops && s.lootDrops.length > 0) {
      const isMovingManual = hasAnyKey(s.keys, ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);
      if (!isMovingManual) {
        const AUTO_LOOT_RANGE = 350; // radius scan loot
        let nearestLoot = null;
        let nearestDist = Infinity;

        for (const drop of s.lootDrops) {
          if (drop.taken) continue;
          const d = Math.hypot(drop.x - s.player.x, drop.y - s.player.y);
          if (d < AUTO_LOOT_RANGE && d < nearestDist) {
            nearestDist = d;
            nearestLoot = drop;
          }
        }

        if (nearestLoot) {
          // Sudah dalam jangkauan pickup checkItems() — tidak perlu jalan lebih
          if (nearestDist > 38) {
            s.autoWalkTarget = { x: nearestLoot.x, y: nearestLoot.y };
          } else {
            s.autoWalkTarget = null;
          }
          return;
        }
      }
    }
    // Tidak ada musuh maupun loot — bersihkan auto-walk dan diam
    if (s.autoWalkTarget) s.autoWalkTarget = null;
    return;
  }

  // Urutkan musuh dari yang paling dekat dengan pemain
  nearbyEnemies.sort((a, b) => a.dist - b.dist);
  const closest = nearbyEnemies[0];

  // Cek apakah musuh terdekat adalah tipe jarak jauh (ranged)
  const closestEntity = closest.entity;
  const isRangedEnemy = !closest.isBoss && (
    closestEntity.type === 'archer' ||
    closestEntity.type === 'sc_archer' ||
    (closestEntity.isElite && ['mage', 'sc_mage', 'sc_dragon'].includes(closestEntity.type))
  );

  // Hitung vektor arah menuju musuh terdekat
  const toDx = closestEntity.x - s.player.x;
  const toDy = closestEntity.y - s.player.y;
  const normLen = Math.hypot(toDx, toDy) || 1;
  const normX = toDx / normLen;
  const normY = toDy / normLen;

  const isMovingManual = hasAnyKey(s.keys, ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);

  // Auto-Face ke musuh terdekat jika pemain tidak menginput tombol arah pergerakan
  if (!isMovingManual) {
    s.player.facingX = normX;
    s.player.facingY = normY;
    s.lastFacingX = normX;
    s.lastFacingY = normY;
  }

  const meleeStrikeRange = s.player.r + (closestEntity.r || 16) + 20;



  // gunakan sistem autoWalkTarget agar animasi jalan, footstep, & obstacle avoidance
  // diproses oleh updatePlayer() seperti gerakan normal.
  if (isRangedEnemy && closest.dist > meleeStrikeRange && !isMovingManual) {
    // Tetapkan target tepat di tepi radius melee (bukan di posisi musuh itu sendiri)
    // agar karakter berhenti begitu sudah cukup dekat untuk menyerang.
    const stopDist = meleeStrikeRange - 5;
    s.autoWalkTarget = {
      x: closestEntity.x - normX * stopDist,
      y: closestEntity.y - normY * stopDist,
    };
    // Tunda serangan sampai sudah masuk jangkauan
    return;
  }

  // Sudah dalam jangkauan — batalkan auto-walk jika masih aktif
  if (s.autoWalkTarget) s.autoWalkTarget = null;

  // ─── Prioritas Skill ───────────────────────────────────────────────────────
  // Skill dipakai selama tersedia (cooldown siap + stamina cukup),
  // tidak perlu syarat jumlah musuh.

  // 1. Spin Attack — pakai jika tersedia
  if (s.player.spinCooldown <= 0 && s.player.stamina >= 50) {
    triggerSpinAttack();
    return;
  }

  // 2. Triple Slash — pakai jika tersedia dan musuh dalam jangkauan melee
  const tripleSlashReady = (s.player.tripleCooldown || 0) <= 0;
  if (tripleSlashReady && s.player.stamina >= 60 && s.player.isTripling <= 0 && closest.dist <= meleeStrikeRange) {
    s.player.stamina -= 60;
    s.player.tripleCooldown = 300;
    s.player.isTripling = 283;
    s.player.tripleHitDelay = [94, 94, 94];
    playSound('spin');
    return;
  }

  // 3. Normal attack — fallback
  if (s.player.attackCooldown <= 0) {
    attack();
  }
}

// ─── Potion ───────────────────────────────────────────────────────────────────

export function usePotion() {
  const s = state;
  if (s.potions <= 0) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '❌ Tidak ada Health Potion!';
    return;
  }
  if (s.player.hp >= s.player.maxHp) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = 'HP sudah penuh!';
    return;
  }
  s.potions--;
  if (!s.inventory) s.inventory = {};
  if (s.potions > 0) {
    s.inventory['health_potion'] = s.potions;
  } else {
    delete s.inventory['health_potion'];
  }
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + 40);
  playSound('coin');
  spawnParticles(s.player.x, s.player.y, 0x00ff00, 10, 'heal');
  const btn = document.getElementById('btn-potion');
  if (btn) {
    btn.textContent = `🧪 Heal (C) [${s.potions}]`;
    btn.style.opacity = s.potions > 0 ? '1.0' : '0.5';
  }
  const navPotionsEl = document.getElementById('nav-potions');
  if (navPotionsEl) navPotionsEl.textContent = s.potions;
  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent = `🧪 Health Potion digunakan! (+40 HP)`;
  if (typeof window.updateUI === 'function') window.updateUI(true);
  if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
}

export function useStaminaPotion() {
  const s = state;
  const count = s.inventory?.['stamina_potion'] || 0;
  if (count <= 0) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '❌ Tidak ada Stamina Potion! Beli di Altar Shop.';
    return;
  }
  if (s.player.stamina >= s.player.maxStamina) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '⚡ SP sudah penuh!';
    return;
  }
  s.inventory['stamina_potion']--;
  if (s.inventory['stamina_potion'] <= 0) {
    delete s.inventory['stamina_potion'];
  }
  s.player.stamina = s.player.maxStamina;
  playSound('coin');
  spawnParticles(s.player.x, s.player.y, 0x00ffff, 10, 'heal');
  const btn = document.getElementById('btn-sp-potion');
  const rem = s.inventory?.['stamina_potion'] || 0;
  if (btn) {
    btn.textContent = `⚡ SP (B) [${rem}]`;
    btn.style.opacity = rem > 0 ? '1.0' : '0.5';
  }
  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent = `⚡ Stamina Potion digunakan! (SP Pulih Penuh)`;
  if (typeof window.updateUI === 'function') window.updateUI(true);
  if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
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
  if (!e) return;

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

  // Elite Monster defeat rewards & fanfare
  if (e.isElite && e.elite) {
    s.cameraShake = Math.max(s.cameraShake || 0, 18);
    playSound('coin');
    playSound('hit');

    const msgEl = document.getElementById('message');
    if (msgEl) {
      msgEl.innerHTML = `<span style="color:#ffd700;font-weight:bold;">🏆 ELITE DIKALAHKAN:</span> ${e.elite.icon} <span style="color:#fff;font-weight:bold;">${e.elite.name}</span>! <span style="color:#2ecc71;font-weight:bold;">(+${e.elite.bonusGold} Gold, +${e.elite.bonusExp} EXP)</span>`;
    }

    s.gold += e.elite.bonusGold;
    s.player.exp += e.elite.bonusExp;

    // Burst of Gold coins
    for (let g = 0; g < 6; g++) {
      const dropMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(4, 0),
        new THREE.MeshLambertMaterial({ color: 0xffd700 })
      );
      dropMesh.position.set(e.x + (Math.random() - 0.5) * 45, 5, e.y + (Math.random() - 0.5) * 45);
      dropMesh.castShadow = true;
      s.scene.add(dropMesh);
      s.lootDrops.push({ x: dropMesh.position.x, y: dropMesh.position.z, taken: false, type: 'gold', item: { id: 'gold', name: 'Gold', value: 15 }, mesh: dropMesh });
    }

    // Guaranteed 2 Potion drops
    for (let p = 0; p < 2; p++) {
      const dropMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.5, 7, 8),
        new THREE.MeshLambertMaterial({ color: 0xff0000 })
      );
      dropMesh.position.set(e.x + (p === 0 ? 14 : -14), 4, e.y + (Math.random() - 0.5) * 20);
      s.scene.add(dropMesh);
      s.lootDrops.push({ x: dropMesh.position.x, y: dropMesh.position.z, taken: false, type: 'potion', mesh: dropMesh });
    }

    // Guaranteed 1 Stamina Potion
    const spMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 6, 8),
      new THREE.MeshLambertMaterial({ color: 0xf1c40f })
    );
    spMesh.position.set(e.x, 3, e.y - 14);
    s.scene.add(spMesh);
    s.lootDrops.push({ x: e.x, y: e.y - 14, taken: false, type: 'consumable', item: { id: 'stamina_potion', name: 'Stamina Potion' }, mesh: spMesh });

    spawnParticles(e.x, e.y, e.elite.auraColor, 40, 'death');
    spawnDamageText(e.x, e.mesh.position.y + 45, e.y, `★ ${e.elite.name} DEFEATED! ★`, '#ffd700');

    if (typeof window.updateUI === 'function') window.updateUI(true);
  }

  // Remove HP bar and elite meshes immediately
  if (e.hpGroup) {
    s.scene.remove(e.hpGroup);
    e.hpGroup = null;
  }
  if (e.auraMesh) {
    e.mesh.remove(e.auraMesh);
    e.auraMesh = null;
  }
  if (e.crownMesh) {
    e.mesh.remove(e.crownMesh);
    e.crownMesh = null;
  }

  // Play death animation if available!
  if (e.actions?.death && e.mixer) {
    e.isDying = true;
    e.dx = 0;
    e.dy = 0;
    playEnemyAction(e, 'death', 0.08);
    const dur = e.actions.death.getClip().duration || 1.0;
    e.deathTimer = Math.max(50, Math.floor(dur * 60) + 15);
    s.dyingEnemies = s.dyingEnemies || [];
    s.dyingEnemies.push(e);
  } else {
    if (e.mixer) {
      e.mixer.stopAllAction();
      e.mixer.uncacheRoot(e.mesh);
    }
    s.scene.remove(e.mesh);
  }
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

    if (e.mixer && distToPlayer < 1200) {
      e.mixer.update(dt * 0.016667);
    }

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
    let speed = e.slowTimer > 0 ? e.baseSpeed * 0.4 : e.baseSpeed;

    if (e.stunTimer <= 0 && e.actionState === 'attack') {
      e.attackAnimTimer -= dt;
      e.dx = 0;
      e.dy = 0;
      e.mesh.rotation.y = Math.atan2(s.player.x - e.x, s.player.y - e.y);
      playEnemyAction(e, 'attack', 0.1);

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

            // Earth slam knockback & camera shake
            if (e.isElite && e.elite.ability === 'earth_slam') {
              s.cameraShake = Math.max(s.cameraShake || 0, 16);
              s.player.stamina = Math.max(0, s.player.stamina - 20);
              spawnParticles(e.x, e.y, 0xaa00ff, 15, 'dust');
            }

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

      speed = e.slowTimer > 0 ? e.baseSpeed * 0.4 : e.baseSpeed;

      // Berserk Frenzy for Warlord Yeti Frostbane
      if (e.isElite && e.elite.ability === 'berserk_frenzy' && e.hp < e.maxHp * 0.5) {
        speed *= 1.45;
        if (e.auraMesh && !e._berserkApplied) {
          e.auraMesh.material.color.setHex(0xff0000);
          e._berserkApplied = true;
          spawnDamageText(e.x, e.mesh.position.y + 35, e.y, `BERSERK!`, '#ff0000');
        }
      }

      // Proximity alert for elite
      if (e.isElite && distToPlayer < 500 && !e._announced) {
        e._announced = true;
        const msgEl = document.getElementById('message');
        if (msgEl) {
          msgEl.innerHTML = `<span style="color:#ff3333;font-weight:bold;">⚠️ MONSTER ELIT MUNCUL:</span> ${e.elite.icon} <span style="color:#ffd700;font-weight:bold;">${e.elite.name}</span> (${e.elite.title})!`;
        }
        playSound('hit');
      }

      // Acid pool hazard for King Slime Vorax
      if (e.isElite && e.elite.ability === 'acid_pool') {
        e.hazardTimer = (e.hazardTimer || 0) + dt;
        if (e.hazardTimer > 50) {
          e.hazardTimer = 0;
          spawnParticles(e.x, e.y, 0x00ff66, 3, 'dust');
          if (distToPlayer < 40) {
            s.player.hp = Math.max(0, s.player.hp - 3);
            spawnDamageText(s.player.x, 30, s.player.y, `ACID! -3`, '#00ff66');
            playSound('hit');
          }
        }
      }

      // Phase shift teleport for Phantom Wraith Mushnub
      if (e.isElite && e.elite.ability === 'phase_shift') {
        e.hazardTimer = (e.hazardTimer || 0) + dt;
        if (e.hazardTimer > 180 && distToPlayer > 80 && distToPlayer < 450) {
          e.hazardTimer = 0;
          spawnParticles(e.x, e.y, 0x7c4dff, 15, 'death');
          const pAngle = Math.atan2(s.player.y - e.y, s.player.x - e.x);
          e.x += Math.cos(pAngle) * 65;
          e.y += Math.sin(pAngle) * 65;
          spawnParticles(e.x, e.y, 0x7c4dff, 15, 'heal');
          playSound('dash');
        }
      }

      // Sand vortex pull for Leviathan Dune Stalker
      if (e.isElite && e.elite.ability === 'sand_vortex' && distToPlayer < 250 && distToPlayer > 40) {
        const pullAngle = Math.atan2(e.y - s.player.y, e.x - s.player.x);
        s.player.x += Math.cos(pullAngle) * 1.0 * dt;
        s.player.y += Math.sin(pullAngle) * 1.0 * dt;
        if (Math.random() < 0.1) spawnParticles(e.x, e.y, 0x651fff, 2, 'dust');
      }

      if (e.pauseTimer > 0) {
        // AI sedang diam sejenak ketika mentok di objek ("diem dulu")
        e.pauseTimer -= dt;
        e.dx = 0;
        e.dy = 0;
        playEnemyAction(e, 'idle', 0.2);
      } else if (e.detourTimer > 0) {
        // AI sedang berjalan memutar mencari rute alternatif ("mencari jalan lain")
        e.detourTimer -= dt;
        e.dx = Math.cos(e.detourAngle) * speed;
        e.dy = Math.sin(e.detourAngle) * speed;
        e.mesh.rotation.y = Math.atan2(e.dx, e.dy);
        playEnemyAction(e, 'walk', 0.2);

        // Jika rute langsung ke pemain sudah bebas dan dekat, batalkan detour
        const directAng = Math.atan2(s.player.y - e.y, s.player.x - e.x);
        const checkX = e.x + Math.cos(directAng) * 45;
        const checkY = e.y + Math.sin(directAng) * 45;
        if (!blocked(checkX, checkY, e.r) && distToPlayer < 220) {
          e.detourTimer = 0;
        }
      } else if (distToPlayer < 800) {
        const angle = Math.atan2(s.player.y - e.y, s.player.x - e.x);
        const isRanged = e.type === 'archer' || e.type === 'sc_archer' || (e.isElite && ['mage', 'sc_mage', 'sc_dragon'].includes(e.type));
        
        if (distToPlayer < s.player.r + e.r + 15 && e.hp > 0 && e.type !== 'kamikaze' && !isRanged && (!e.attackCooldown || e.attackCooldown <= 0)) {
          e.actionState = 'attack';
          e.attackAnimTimer = 30;
          e.attackCooldown = 90;
          e.hasDealtDamage = false;
          e.dx = 0;
          e.dy = 0;
          e.mesh.rotation.y = Math.atan2(s.player.x - e.x, s.player.y - e.y);
          playEnemyAction(e, 'attack', 0.1);
        } else if (isRanged) {
          const keepDist = (e.type.includes('mage') || e.type.includes('dragon')) ? 220 : 300;
          if (distToPlayer > keepDist) {
            e.dx = Math.cos(angle) * speed;
            e.dy = Math.sin(angle) * speed;
          } else {
            e.dx = 0; e.dy = 0;
          }
          if (e.attackTimer === undefined) e.attackTimer = 0;
          e.attackTimer += dt;
          const shootInterval = e.isElite ? 85 : 120;
          if (e.attackTimer > shootInterval && distToPlayer < 450) {
            e.attackTimer = 0;
            e.mesh.rotation.y = Math.atan2(s.player.x - e.x, s.player.y - e.y);
            playEnemyAction(e, 'attack', 0.08);
            e.rangedAttackResetTimer = 22;

            if (e.isElite && e.elite.ability === 'triple_shot') {
              for (let aOffset of [-0.25, 0, 0.25]) {
                const spreadAngle = angle + aOffset;
                const m = new THREE.Mesh(new THREE.SphereGeometry(4, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
                m.position.set(e.x, 12, e.y);
                s.scene.add(m);
                s.projectiles.push({ x: e.x, y: e.y, dx: Math.cos(spreadAngle) * 9, dy: Math.sin(spreadAngle) * 9, mesh: m, isEnemy: true, damage: 18, colorHex: '#00e5ff' });
              }
              playSound('shoot');
            } else if (e.isElite && e.elite.ability === 'blinding_volley') {
              for (let aOffset of [-0.3, 0, 0.3]) {
                const spreadAngle = angle + aOffset;
                const m = new THREE.Mesh(new THREE.SphereGeometry(4.5, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffab00 }));
                m.position.set(e.x, 12, e.y);
                s.scene.add(m);
                s.projectiles.push({ x: e.x, y: e.y, dx: Math.cos(spreadAngle) * 8.5, dy: Math.sin(spreadAngle) * 8.5, mesh: m, isEnemy: true, damage: 20, colorHex: '#ffab00' });
              }
              playSound('shoot');
            } else if (e.isElite && e.elite.ability === 'meteor_burst') {
              const m = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff007f }));
              m.position.set(e.x, 15, e.y);
              s.scene.add(m);
              s.projectiles.push({ x: e.x, y: e.y, dx: Math.cos(angle) * 7, dy: Math.sin(angle) * 7, mesh: m, isEnemy: true, damage: 26, radius: 14, colorHex: '#ff007f' });
              playSound('shoot');
            } else if (e.isElite && e.elite.ability === 'solar_flare') {
              const m = new THREE.Mesh(new THREE.SphereGeometry(7.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffea00 }));
              m.position.set(e.x, 15, e.y);
              s.scene.add(m);
              s.projectiles.push({ x: e.x, y: e.y, dx: Math.cos(angle) * 7.5, dy: Math.sin(angle) * 7.5, mesh: m, isEnemy: true, damage: 28, radius: 15, colorHex: '#ffea00' });
              playSound('shoot');
            } else if (e.isElite && e.elite.ability === 'dragon_breath') {
              for (let aOffset of [-0.15, 0.15]) {
                const spreadAngle = angle + aOffset;
                const m = new THREE.Mesh(new THREE.SphereGeometry(5.5, 6, 6), new THREE.MeshBasicMaterial({ color: 0xd50000 }));
                m.position.set(e.x, 20, e.y);
                s.scene.add(m);
                s.projectiles.push({ x: e.x, y: e.y, dx: Math.cos(spreadAngle) * 8, dy: Math.sin(spreadAngle) * 8, mesh: m, isEnemy: true, damage: 24, colorHex: '#d50000' });
              }
              playSound('shoot');
            } else {
              const m = new THREE.Mesh(new THREE.SphereGeometry(4, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
              m.position.set(e.x, 10, e.y);
              s.scene.add(m);
              s.projectiles.push({ x: e.x, y: e.y, dx: Math.cos(angle) * 8, dy: Math.sin(angle) * 8, mesh: m, isEnemy: true, damage: 12 });
              playSound('shoot');
            }
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

    const prevX = e.x;
    const prevY = e.y;

    if (e.type === 'ghost') {
      e.x = nx; e.y = ny;
    } else {
      if (blocked(nx, ny, e.r)) {
        if (!blocked(nx, e.y, e.r)) e.x = nx;
        else if (!blocked(e.x, ny, e.r)) e.y = ny;
      } else {
        e.x = nx; e.y = ny;
      }
    }

    // Deteksi jika musuh tersangkut di objek aset
    const attemptedSpd = Math.hypot(e.dx, e.dy);
    const actualMoved = Math.hypot(e.x - prevX, e.y - prevY);
    if (attemptedSpd > 0.1 && e.actionState !== 'attack' && distToPlayer > s.player.r + e.r + 20) {
      if (actualMoved < speed * 0.25 * dt) {
        e.stuckCounter = (e.stuckCounter || 0) + 1;
        if (e.stuckCounter >= 6) {
          e.stuckCounter = 0;
          // 1. "Diem dulu": berhenti sejenak (~0.35s - 0.65s)
          e.pauseTimer = 20 + Math.random() * 18;
          e.dx = 0; e.dy = 0;
          playEnemyAction(e, 'idle', 0.2);
          // 2. "Mencari jalan lain": tentukan sudut rute memutar yang tidak terhalang objek
          e.detourAngle = findDetourAngle(e, s.player.x, s.player.y);
          e.detourTimer = 45 + Math.random() * 35;
        }
      } else {
        e.stuckCounter = Math.max(0, (e.stuckCounter || 0) - 1);
      }
    }

    if (e.rangedAttackResetTimer > 0) {
      e.rangedAttackResetTimer -= dt;
      if (e.rangedAttackResetTimer <= 0) {
        if (Math.hypot(e.dx, e.dy) > 0.1) {
          playEnemyAction(e, 'walk', 0.2);
        } else {
          playEnemyAction(e, 'idle', 0.2);
        }
      }
    }

    // Smooth mesh follow
    let lungeOffsetX = 0;
    let lungeOffsetY = 0;
    if (e.actionState === 'attack') {
      const attackProgress = (30 - e.attackAnimTimer) / 30; // 0 to 1
      const lunge = Math.sin(attackProgress * Math.PI) * 12;
      const angleToPlayer = Math.atan2(s.player.y - e.y, s.player.x - e.x);
      lungeOffsetX = Math.cos(angleToPlayer) * lunge;
      lungeOffsetY = Math.sin(angleToPlayer) * lunge;
    }
    
    e.mesh.position.x += (e.x + lungeOffsetX - e.mesh.position.x) * Math.min(dt * 10, 1);
    e.mesh.position.z += (e.y + lungeOffsetY - e.mesh.position.z) * Math.min(dt * 10, 1);

    const speedScalar = Math.hypot(e.dx, e.dy);
    let hoverBob = e.isFlying ? Math.sin(Date.now() / 300 + e.x) * 5 : 0;
    let meshYTarget = e.meshY + hoverBob + (s.currentScene === 'wilds2'
      ? getTerrainHeightWilds2(e.x, e.y) : getTerrainHeight(e.x, e.y));
    
    if (e.mixer) {
      if (e.actionState === 'attack' || (e.rangedAttackResetTimer && e.rangedAttackResetTimer > 0)) {
        e.mesh.rotation.y = Math.atan2(s.player.x - e.x, s.player.y - e.y);
      } else if (speedScalar > 0.1) {
        e.mesh.rotation.y = Math.atan2(e.dx, e.dy);
        if (e.actions?.walk) {
          const speedRatio = speed / (e.baseSpeed || 1.5);
          e.actions.walk.timeScale = Math.min(2.5, Math.max(0.6, speedRatio * 1.2));
        }
        playEnemyAction(e, 'walk', 0.2);
      } else {
        if (distToPlayer < 600) {
          e.mesh.rotation.y = Math.atan2(s.player.x - e.x, s.player.y - e.y);
        }
        playEnemyAction(e, 'idle', 0.25);
      }
    } else {
      if (e.actionState === 'attack') {
        e.mesh.rotation.y = Math.atan2(s.player.x - e.x, s.player.y - e.y);
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
    }
    e.mesh.position.y += (meshYTarget - e.mesh.position.y) * Math.min(dt * 8, 1);
    e.hpGroup.position.set(e.x, e.mesh.position.y + (e.isElite ? 105 : 90), e.y);
    e.hpGroup.lookAt(s.camera.position);

    const barW = e.hpBarWidth || 24;
    const hpPercent = Math.max(0, e.hp / e.maxHp);
    e.hpFg.scale.x = Math.max(0.001, hpPercent);
    e.hpFg.position.x = -(barW - (barW * hpPercent)) / 2;

    if (e.isElite) {
      if (e.auraMesh) e.auraMesh.rotation.z += 0.04 * dt;
      if (e.crownMesh) {
        e.crownMesh.rotation.y += 0.06 * dt;
        e.crownMesh.rotation.x += 0.03 * dt;
        e.crownMesh.position.y = (e.isFlying ? 42 : 32) + Math.sin(Date.now() / 250) * 2;
      }
    }

    // Collision with player
    if (distToPlayer < s.player.r + e.r && e.hp > 0) {
      if (e.type === 'kamikaze') {
        const isElite = e.isElite;
        const blastDmg = isElite ? 45 : 20;
        spawnParticles(e.x, e.y, isElite ? 0xff3d00 : 0xff8800, isElite ? 80 : 50, 'death');
        playSound('hit');
        if (isElite) s.cameraShake = Math.max(s.cameraShake || 0, 22);
        s.player.hp = Math.max(0, s.player.hp - blastDmg);
        spawnDamageText(s.player.x, 30, s.player.y, `-${blastDmg}`, '#ff0000');
        e.hp = 0;
        if (e.mixer) {
          e.mixer.stopAllAction();
          e.mixer.uncacheRoot(e.mesh);
        }
        s.scene.remove(e.mesh); s.scene.remove(e.hpGroup);
        s.enemies.splice(idx, 1);
        if (s.player.hp <= 0) teleportToHometown('Ledakan musuh mengakhiri petualanganmu!');
      }
    }

    // Despawn enemies too far away (after 3s grace period so freshly-spawned
    // enemies are not removed before the player ever sees them)
    e.age += dt;
    if (!e.isBossChild && e.age > 180 && Math.hypot(e.x - s.player.x, e.y - s.player.y) > 2000 && e.stunTimer <= 0) {
      if (e.mixer) {
        e.mixer.stopAllAction();
        e.mixer.uncacheRoot(e.mesh);
      }
      s.scene.remove(e.mesh);
      s.scene.remove(e.hpGroup);
      s.enemies.splice(idx, 1);
    }
  }

  // Update dying enemies (memutar animasi mati, kemudian perlahan tenggelam & dissolve ke tanah)
  if (s.dyingEnemies && s.dyingEnemies.length > 0) {
    for (let i = s.dyingEnemies.length - 1; i >= 0; i--) {
      const de = s.dyingEnemies[i];
      de.deathTimer -= dt;
      if (de.mixer) {
        de.mixer.update(dt * 0.016667);
      }
      if (de.deathTimer < 25) {
        de.mesh.position.y -= 0.35 * dt;
        de.mesh.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = Math.max(0, de.deathTimer / 25);
          }
        });
      }
      if (de.deathTimer <= 0) {
        if (de.mixer) {
          de.mixer.stopAllAction();
          de.mixer.uncacheRoot(de.mesh);
        }
        s.scene.remove(de.mesh);
        s.dyingEnemies.splice(i, 1);
      }
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

  // Handle boss dying animation and dissolving
  if (s.bossDyingMesh && s.bossDeathTimer > 0) {
    s.bossDeathTimer -= dt;
    if (s.bossDyingMixer) s.bossDyingMixer.update(dt * 0.016667);
    if (s.bossDeathTimer < 35) {
      s.bossDyingMesh.position.y -= 0.4 * dt;
      s.bossDyingMesh.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = Math.max(0, s.bossDeathTimer / 35);
        }
      });
    }
    if (s.bossDeathTimer <= 0) {
      if (s.bossDyingMixer) {
        s.bossDyingMixer.stopAllAction();
        s.bossDyingMixer.uncacheRoot(s.bossDyingMesh);
      }
      s.scene.remove(s.bossDyingMesh);
      s.bossDyingMesh = null;
      s.bossDyingMixer = null;
    }
  }

  if (!s.bossActive || s.bossDefeated || !s.bossMesh) return;

  if (s.bossMixer) {
    s.bossMixer.update(dt * 0.016667);
  }

  const playBossAction = (actionName, duration = 0.2) => {
    if (!s.bossMixer || !s.bossActions) return;
    const target = s.bossActions[actionName];
    if (!target) return;
    if (s.bossCurrentAction === target) {
      if (actionName === 'attack') {
        target.reset();
        target.play();
      } else if (!target.isRunning()) {
        target.reset();
        target.play();
      }
      return;
    }
    const prev = s.bossCurrentAction;
    s.bossCurrentAction = target;
    target.reset();
    target.fadeIn(duration);
    target.play();
    if (prev && prev !== target) {
      prev.fadeOut(duration);
    }
  };

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
        playBossAction('attack', 0.1);
        s.bossAttackAnimTimer = 25;
        s.cameraShake = Math.max(s.cameraShake || 0, s.bossPhase === 2 ? 25 : 15);
        playSound('hit');
        
        // Animasi serangan tusukan (simulasi dengan rotasi sesaat jika tanpa mixer)
        if (!s.bossMixer) {
          s.bossMesh.rotation.x = Math.PI / 8;
          setTimeout(() => { if (s.bossMesh) s.bossMesh.rotation.x = 0; }, 200);
        }

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
         playBossAction('attack', 0.1);
         s.bossAttackAnimTimer = 25;
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
        playBossAction('attack', 0.08);
        s.bossAttackAnimTimer = 18;
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

  // Action state resolution for boss (walk / idle)
  if (s.bossAttackAnimTimer > 0) {
    s.bossAttackAnimTimer -= dt;
  } else if (s.bossReturning || (isAggro && dist > 80)) {
    playBossAction('walk', 0.2);
  } else {
    playBossAction('idle', 0.25);
  }

  // Smooth position interpolation after logic
  s.bossMesh.position.x += (s.bossX - s.bossMesh.position.x) * Math.min(dt * 6, 1);
  s.bossMesh.position.z += (s.bossY - s.bossMesh.position.z) * Math.min(dt * 6, 1);
  const bossTerrainY = s.currentScene === 'wilds2'
    ? getTerrainHeightWilds2(s.bossX, s.bossY)
    : getTerrainHeight(s.bossX, s.bossY);
  
  const bossBaseY = s.currentScene === 'wilds2' ? -5 : 0; // Menapak tanah

  // Animasi langkah yang lebih hidup (Bobbing & Wobbling)
  let walkBob = 0;
  let walkWobble = 0;
  if (!s.bossMixer && isAggro && dist > 80) {
    const walkSpeed = s.currentScene === 'wilds2' ? 120 : 250; 
    const time = Date.now() / walkSpeed;
    walkBob = Math.abs(Math.sin(time)) * (s.currentScene === 'wilds2' ? 15 : 6);
    walkWobble = Math.sin(time) * 0.15;
  }

  s.bossMesh.position.y += (bossBaseY + bossTerrainY + walkBob - s.bossMesh.position.y) * Math.min(dt * 6, 1);
  if (!s.bossMixer) {
    s.bossMesh.rotation.z = walkWobble;
    s.bossMesh.rotation.x = Math.sin(Date.now() / 300) * 0.05;
  } else {
    s.bossMesh.rotation.z = 0;
  }

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

  if (s.bossHp <= 0 && !s.bossDefeated) {
    s.bossDefeated = true;
    s.bossActive = false;
    if (s.bossHpGroup) {
      s.scene.remove(s.bossHpGroup);
      s.bossHpGroup = null;
    }

    if (s.bossActions?.death && s.bossMixer) {
      playBossAction('death', 0.08);
      const dur = s.bossActions.death.getClip().duration || 1.8;
      s.bossDeathTimer = Math.max(70, Math.floor(dur * 60) + 30);
      s.bossDyingMesh = s.bossMesh;
      s.bossDyingMixer = s.bossMixer;
      s.bossMesh = null;
      s.bossMixer = null;
      s.bossActions = null;
      s.bossCurrentAction = null;
    } else {
      if (s.bossMixer) {
        s.bossMixer.stopAllAction();
        s.bossMixer = null;
        s.bossActions = null;
        s.bossCurrentAction = null;
      }
      if (s.bossMesh) {
        s.scene.remove(s.bossMesh);
        s.bossMesh = null;
      }
    }

    const isWilds2 = s.currentScene === 'wilds2';
    const name = isWilds2 ? 'Arena Champion' : 'The Golden Golem';
    playSound('coin');
    spawnParticles(s.bossX, s.bossY, 0xffd700, 150, 'death');

    if (!s.inventory) s.inventory = {};

    // ── Reward: Senjata legendaris Excalibur ──────────────────────────────────
    if (!s.ownedWeapons.includes(4)) s.ownedWeapons.push(4);

    // ── Reward: Gold ──────────────────────────────────────────────────────────
    const goldReward = isWilds2 ? 800 : 500;
    s.gold = (s.gold || 0) + goldReward;
    const goldEl = document.getElementById('gold');
    if (goldEl) goldEl.textContent = s.gold;
    spawnDamageText(s.bossX, 40, s.bossY, `+${goldReward} Gold`, '#ffd700');

    // ── Reward: EXP ───────────────────────────────────────────────────────────
    const expReward = isWilds2 ? 800 : 500;
    s.player.exp = (s.player.exp || 0) + expReward;
    spawnDamageText(s.bossX, 65, s.bossY, `+${expReward} EXP`, '#00e5ff');
    if (typeof window.levelUp === 'function' && s.player.exp >= s.player.nextExp) window.levelUp();

    // ── Reward: Potion ────────────────────────────────────────────────────────
    const potionCount = isWilds2 ? 5 : 3;
    s.potions = (s.potions || 0) + potionCount;
    s.inventory['health_potion'] = s.potions;
    spawnDamageText(s.bossX, 90, s.bossY, `+${potionCount} Potion`, '#ff4444');
    const btnPotion = document.getElementById('btn-potion');
    if (btnPotion) { btnPotion.textContent = `🧪 Heal (C) [${s.potions}]`; btnPotion.style.opacity = '1.0'; }
    const navPotions = document.getElementById('nav-potions');
    if (navPotions) navPotions.textContent = s.potions;

    // ── Reward: Item langka yang dijamin drop ─────────────────────────────────
    // Golem: demon_horn + hell_fire + holy_gem + golem_core
    // Champion: + sc_dragon_claw + sc_mage_orb + stamina_potion + health_crystal
    const guaranteedLoot = isWilds2
      ? ['demon_horn', 'hell_fire', 'holy_gem', 'golem_core', 'sc_dragon_claw', 'sc_mage_orb', 'stamina_potion', 'health_crystal']
      : ['demon_horn', 'hell_fire', 'holy_gem', 'golem_core'];

    const lootNames = { demon_horn: '👿 Demon Horn', hell_fire: '🔥 Hell Fire', holy_gem: '🌟 Holy Gem',
      golem_core: '🪨 Golem Core', sc_dragon_claw: '🐲 Dragon Claw', sc_mage_orb: '🔮 Mage Orb',
      stamina_potion: '⚡ Stamina Potion', health_crystal: '💎 Health Crystal' };

    const droppedNames = [];
    guaranteedLoot.forEach((itemId, i) => {
      s.inventory[itemId] = (s.inventory[itemId] || 0) + 1;
      const label = lootNames[itemId] || itemId;
      spawnDamageText(s.bossX + (i % 3 - 1) * 40, 115 + Math.floor(i / 3) * 25, s.bossY + (i % 2 - 0.5) * 30, `+1 ${label}`, '#ffee44');
      droppedNames.push(label);
    });

    // ── Reward: 3 item acak dari lootTable (nilai tinggi) ─────────────────────
    const rareLoot = Object.values(lootTable).filter(l => l.value >= 10);
    for (let i = 0; i < 3; i++) {
      const picked = rareLoot[Math.floor(Math.random() * rareLoot.length)];
      s.inventory[picked.id] = (s.inventory[picked.id] || 0) + 1;
      spawnDamageText(s.bossX + (i - 1) * 50, 165, s.bossY, `+1 ${picked.icon} ${picked.name}`, '#ffcc00');
      droppedNames.push(`${picked.icon} ${picked.name}`);
    }

    // ── Notifikasi ────────────────────────────────────────────────────────────
    const msgEl = document.getElementById('message');
    if (msgEl) {
      msgEl.textContent = `👑 ${name} dikalahkan! +${goldReward}🪙 +${expReward}✨ +${potionCount}🧪 ⚔️Excalibur | Loot: ${droppedNames.slice(0, 4).join(', ')}...`;
    }

    // ── Quest boss ────────────────────────────────────────────────────────────
    if (s.quests) {
      const bossQuest = s.quests.find(q => q.id === 3 && !q.completed);
      if (bossQuest) {
        bossQuest.progress = (bossQuest.progress || 0) + 1;
        if (typeof window.checkQuestCompletion === 'function') window.checkQuestCompletion();
      }
    }

    if (typeof window.saveGame === 'function') window.saveGame(true);
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
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
