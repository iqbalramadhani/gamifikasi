// Combat logic — ported from combat.js
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  ParticleSystem,
  Engine,
  Mesh,
  TransformNode,
} from '@babylonjs/core';
import { state } from './state';
import type {
  Enemy,
  Projectile,
  CritResult,
} from './types';
import {
  mapSize,
  weaponList,
  armorList,
  enemyTemplates,
  enemyTemplates2,
  eliteTemplates,
  WILDS2_MIN_LEVEL,
  lootTable,
  consumableItems,
  statusEffects,
} from './constants';
import { loadedModels, createEnemyMixer, UMDTransformNode } from './model-loader';
import { blocked, spawnParticles, spawnDamageText } from './helpers';
import {
  spawnAtFreePos,
  spawnAtFreePosWilds2,
  getTerrainHeight,
  getTerrainHeightWilds2,
} from './scenes';
import { playSound } from './audio';

function mat(
  scene: any,
  name: string,
  hex?: string | number,
  opts: { emissive?: string; opacity?: number; disableLighting?: boolean } = {}
): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  if (hex !== undefined) {
    const h = typeof hex === 'number' ? hexStr(hex) : hex;
    m.diffuseColor = Color3.FromHexString(h as string);
  }
  if (opts.emissive !== undefined) m.emissiveColor = Color3.FromHexString(opts.emissive);
  if (opts.opacity !== undefined) m.alpha = opts.opacity;
  if (opts.disableLighting) m.disableLighting = true;
  return m;
}

function hexStr(n: number | string): string {
  return typeof n === 'number'
    ? '0x' + (n & 0xffffff).toString(16).padStart(6, '0')
    : n;
}

function makeProjectileMat(colorHex: string, scene: any): StandardMaterial {
  const m = new StandardMaterial('proj_mat_' + Math.random(), scene);
  m.diffuseColor = Color3.FromHexString(colorHex);
  m.emissiveColor = m.diffuseColor.clone();
  m.disableLighting = true;
  m.blendMode = Engine.BLENDMODEONEONE;
  m.backFaceCulling = false;
  return m;
}

// ─── Enemy animation helper ───────────────────────────────────────────────────

export function playEnemyAction(e: any, actionName: string, duration = 0.2): void {
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

/** Mencari sudut jalan memutar (detour) ketika musuh terhalang oleh objek/rintangan. */
export function findDetourAngle(e: any, targetX: number, targetY: number): number {
  const directAngle = Math.atan2(targetY - e.y, targetX - e.x);
  const offsets = [
    Math.PI * 0.25, -Math.PI * 0.25,
    Math.PI * 0.45, -Math.PI * 0.45,
    Math.PI * 0.65, -Math.PI * 0.65,
    Math.PI * 0.85, -Math.PI * 0.85,
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

// ─── Critical hit helper ───���──────────────────────────────────────────────────

export function calcCritDamage(baseDmg: number): CritResult {
  const s = state;
  if (Math.random() < s.critChance) {
    return { value: Math.ceil(baseDmg * s.critMultiplier), isCrit: true };
  }
  return { value: baseDmg, isCrit: false };
}

export function applyStatusEffect(enemy: any, type: string): void {
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

function hasAnyKey(keys: Record<string, boolean | undefined>, names: string[]): boolean {
  for (const n of names) if (keys[n]) return true;
  return false;
}

export function spawnEnemy(
  ex: number,
  ey: number,
  scaleFactor = 1.0,
  isBossChild = false,
  forceElite = false
): void {
  const s = state;
  if (!ex || !ey) {
    const pos = spawnAtFreePos();
    ex = pos.x;
    ey = pos.y;
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
  const elite = isElite ? (eliteTemplates[typeStr] as any) : null;

  if (isElite) {
    scaleFactor *= elite.scaleBonus;
    eR *= elite.scaleBonus;
    hp *= elite.hpMultiplier;
    damage = (damage || 10) * elite.damageMultiplier;
    baseSpeed *= elite.speedMultiplier;
  }

  let mesh: TransformNode;
  let eY: number;
  let animData: any = null;

  if (loadedModels[charKey]) {
    const gltfEnemy = loadedModels[charKey]!.clone(charKey + '_enm_' + Math.random(), true, false);
    gltfEnemy.scaling.setAll(7 * scaleFactor);
    gltfEnemy.position.y = -12;
    const descendants = gltfEnemy.getDescendants();
    for (const child of descendants) {
      const m = child as any;
      if (m.material && m.material.clone) {
        m.material = m.material.clone();
      }
    }
    gltfEnemy.setEnabled(true);
    mesh = new UMDTransformNode('enemy_' + charKey + '_' + Math.random().toString(36).slice(2, 8), s.scene);
    gltfEnemy.parent = mesh;
    eY = isFlying ? (isElite ? 42 : 35) : 15;
    animData = createEnemyMixer(charKey, gltfEnemy);
  } else {
    const boxMesh = MeshBuilder.CreateBox(
      'box_fallback_' + Math.random(),
      { width: 20 * scaleFactor, height: 20 * scaleFactor, depth: 20 * scaleFactor },
      s.scene
    );
    boxMesh.material = mat(s.scene, 'box_fallback_mat_' + Math.random(),
      isElite ? hexStr(elite.auraColor) : '0xff0000');
    mesh = boxMesh as unknown as TransformNode;
    eY = isFlying ? (isElite ? 38 : 30) : 10;
  }

  let auraMesh: TransformNode | null = null;
  let crownMesh: TransformNode | null = null;
  let eliteLight: any = null;

  if (isElite) {
    const aRIn = eR * 0.8, aROut = eR * 1.45;
    auraMesh = MeshBuilder.CreateTorus(
      'aura_ring_' + Math.random(),
      { diameter: 2 * aROut, thickness: 2 * (aROut - aRIn), tessellation: 32 },
      s.scene
    ) as unknown as TransformNode;
    const auraM = mat(s.scene, 'aura_mat_' + Math.random(), hexStr(elite.auraColor),
      { emissive: hexStr(elite.auraColor), opacity: 0.8, disableLighting: true });
    auraM.backFaceCulling = false;
    (auraMesh as any).material = auraM;
    (auraMesh as any).rotation.x = -Math.PI / 2;
    (auraMesh as any).position.y = isFlying ? -28 : -11;
    (auraMesh as any).parent = mesh;

    const crownR = 4.5 * (scaleFactor / elite.scaleBonus);
    crownMesh = MeshBuilder.CreateSphere(
      'crown_' + Math.random(),
      { diameter: 2 * crownR, tessellation: 2 },
      s.scene
    ) as unknown as TransformNode;
    (crownMesh as any).material = mat(s.scene, 'crown_mat_' + Math.random(), '0xffd700',
      { emissive: '0xffd700', disableLighting: true });
    (crownMesh as any).position.y = isFlying ? 42 : 32;
    (crownMesh as any).parent = mesh;
  }

  const levelMulti = 1 + s.player.level * 0.1;
  hp *= levelMulti;
  mesh.position.set(ex, eY, ey);
  mesh.parent = s.sceneMount;

  const hpBarWidth = isElite ? 38 : 24;
  const hpBarHeight = isElite ? 5.5 : 4;
  const hpGeo = MeshBuilder.CreateGround(
    'hp_bar_' + Math.random(),
    { width: hpBarWidth, depth: hpBarHeight, updatable: false },
    s.scene
  );
  const hpBgMat = mat(s.scene, 'hp_bg_mat_' + Math.random(),
    isElite ? '0x0a0a0a' : '0x222222',
    { emissive: isElite ? '0x0a0a0a' : '0x222222', disableLighting: true });
  const hpFgMat = mat(s.scene, 'hp_fg_mat_' + Math.random(),
    isElite ? '0xff0055' : '0x008800',
    { emissive: isElite ? '0xff0055' : '0x008800', disableLighting: true });
  const hpGroup = new UMDTransformNode('hp_group_' + Math.random(), s.scene);
  hpGroup.billboardMode = Mesh.BILLBOARDMODE_ALL;
  const hpBg = hpGeo.clone('hp_bg_' + Math.random(), true);
  hpBg.material = hpBgMat;
  const hpFg = hpGeo.clone('hp_fg_' + Math.random(), true);
  hpFg.material = hpFgMat;
  hpFg.position.z = 0.1;
  hpBg.parent = hpGroup;
  hpFg.parent = hpGroup;

  if (isElite) {
    const frameGeo = MeshBuilder.CreateGround(
      'hp_frame_' + Math.random(),
      { width: hpBarWidth + 2.5, depth: hpBarHeight + 2, updatable: false },
      s.scene
    );
    frameGeo.material = mat(s.scene, 'hp_frame_mat_' + Math.random(), '0xffd700',
      { emissive: '0xffd700', disableLighting: true });
    frameGeo.position.z = -0.05;
    frameGeo.parent = hpGroup;

    const starMesh = MeshBuilder.CreateSphere(
      'star_icon_' + Math.random(),
      { diameter: 5, tessellation: 2 },
      s.scene
    );
    starMesh.material = mat(s.scene, 'star_mat_' + Math.random(), '0xffd700',
      { emissive: '0xffd700', disableLighting: true });
    starMesh.position.set(-hpBarWidth / 2 - 4.5, 0, 0.2);
    starMesh.parent = hpGroup;
  }

  hpGroup.parent = s.sceneMount;

  const dx = (Math.random() - 0.5) * 2;
  const dy = (Math.random() - 0.5) * 2;
  const limbs: Record<string, any> = { 'leg-left': null, 'leg-right': null, 'arm-left': null, 'arm-right': null };
  const meshDesc = (mesh as any).getDescendants ? (mesh as any).getDescendants() : [];
  for (const c of meshDesc) {
    if (c.name && limbs.hasOwnProperty(c.name)) limbs[c.name] = c;
  }

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
  } as Enemy);
}

// ─── Tier-2 enemy spawner (Scorched Dunes, level 10+) ──────────────────────

export function spawnEnemy2(
  ex: number,
  ey: number,
  scaleFactor = 1.0,
  isBossChild = false,
  forceElite = false
): void {
  const s = state;
  if (s.player.level < WILDS2_MIN_LEVEL) return;
  if (!ex || !ey) {
    const pos = spawnAtFreePosWilds2();
    ex = pos.x;
    ey = pos.y;
  }

  const tmpl = enemyTemplates2[Math.floor(Math.random() * enemyTemplates2.length)];
  let { hp, speed: baseSpeed, r: eR, typeStr, isFlying, damage } = tmpl;
  const charKey = tmpl.charKey;

  const isElite = (forceElite || (!isBossChild && Math.random() < 0.22)) && !!eliteTemplates[typeStr];
  const elite = isElite ? (eliteTemplates[typeStr] as any) : null;

  if (isElite) {
    scaleFactor *= elite.scaleBonus;
    eR *= elite.scaleBonus;
    hp *= elite.hpMultiplier;
    damage = (damage || 10) * elite.damageMultiplier;
    baseSpeed *= elite.speedMultiplier;
  }

  let mesh: TransformNode;
  let eY: number;
  let animData: any = null;
  if (loadedModels[charKey]) {
    const gltfEnemy = loadedModels[charKey]!.clone(charKey + '_enm2_' + Math.random(), true, false);
    const sc = charKey === 'arena_soldier' ? 25 * scaleFactor : 7 * scaleFactor;
    gltfEnemy.scaling.setAll(sc);
    gltfEnemy.position.y = -12;
    const d2 = gltfEnemy.getDescendants();
    for (const child of d2) {
      const m = child as any;
      if (m.material && m.material.clone) m.material = m.material.clone();
    }
    gltfEnemy.setEnabled(true);
    mesh = new UMDTransformNode('enemy2_' + charKey + '_' + Math.random().toString(36).slice(2, 8), s.scene);
    gltfEnemy.parent = mesh;
    eY = isFlying ? (isElite ? 42 : 35) : 15;
    animData = createEnemyMixer(charKey, gltfEnemy);
  } else {
    const boxMesh = MeshBuilder.CreateBox(
      'box_fallback2_' + Math.random(),
      { width: 20 * scaleFactor, height: 20 * scaleFactor, depth: 20 * scaleFactor },
      s.scene
    );
    boxMesh.material = mat(s.scene, 'box_fallback_mat2_' + Math.random(),
      isElite ? hexStr(elite.auraColor) : '0xff8800');
    mesh = boxMesh as unknown as TransformNode;
    eY = isFlying ? (isElite ? 38 : 30) : 10;
  }

  let auraMesh: TransformNode | null = null;
  let crownMesh: TransformNode | null = null;

  if (isElite) {
    const aRIn2 = eR * 0.8, aROut2 = eR * 1.45;
    auraMesh = MeshBuilder.CreateTorus(
      'aura_ring2_' + Math.random(),
      { diameter: 2 * aROut2, thickness: 2 * (aROut2 - aRIn2), tessellation: 32 },
      s.scene
    ) as unknown as TransformNode;
    const auraM2 = mat(s.scene, 'aura_mat2_' + Math.random(), hexStr(elite.auraColor),
      { emissive: hexStr(elite.auraColor), opacity: 0.8, disableLighting: true });
    auraM2.backFaceCulling = false;
    (auraMesh as any).material = auraM2;
    (auraMesh as any).rotation.x = -Math.PI / 2;
    (auraMesh as any).position.y = isFlying ? -28 : -11;
    (auraMesh as any).parent = mesh;

    const crownR2 = 4.5 * (scaleFactor / elite.scaleBonus);
    crownMesh = MeshBuilder.CreateSphere(
      'crown2_' + Math.random(),
      { diameter: 2 * crownR2, tessellation: 2 },
      s.scene
    ) as unknown as TransformNode;
    (crownMesh as any).material = mat(s.scene, 'crown_mat2_' + Math.random(), '0xffd700',
      { emissive: '0xffd700', disableLighting: true });
    (crownMesh as any).position.y = isFlying ? 42 : 32;
    (crownMesh as any).parent = mesh;
  }

  const levelMulti = 1 + s.player.level * 0.12;
  hp *= levelMulti;
  mesh.position.set(ex, eY, ey);
  mesh.parent = s.sceneMount;

  const hpBarWidth = isElite ? 38 : 24;
  const hpBarHeight = isElite ? 5.5 : 4;
  const hpGeo2 = MeshBuilder.CreateGround(
    'hp_bar2_' + Math.random(),
    { width: hpBarWidth, depth: hpBarHeight, updatable: false },
    s.scene
  );
  const hpBgMat2 = mat(s.scene, 'hp_bg_mat2_' + Math.random(),
    isElite ? '0x0a0a0a' : '0x222222',
    { emissive: isElite ? '0x0a0a0a' : '0x222222', disableLighting: true });
  const hpFgMat2 = mat(s.scene, 'hp_fg_mat2_' + Math.random(),
    isElite ? '0xff0055' : '0xaa2200',
    { emissive: isElite ? '0xff0055' : '0xaa2200', disableLighting: true });
  const hpGroup = new UMDTransformNode('hp_group2_' + Math.random(), s.scene);
  hpGroup.billboardMode = Mesh.BILLBOARDMODE_ALL;
  const hpBg2 = hpGeo2.clone('hp_bg2_' + Math.random(), true);
  hpBg2.material = hpBgMat2;
  const hpFg2 = hpGeo2.clone('hp_fg2_' + Math.random(), true);
  hpFg2.material = hpFgMat2;
  hpFg2.position.z = 0.1;
  hpBg2.parent = hpGroup;
  hpFg2.parent = hpGroup;

  if (isElite) {
    const frameGeo2 = MeshBuilder.CreateGround(
      'hp_frame2_' + Math.random(),
      { width: hpBarWidth + 2.5, depth: hpBarHeight + 2, updatable: false },
      s.scene
    );
    frameGeo2.material = mat(s.scene, 'hp_frame_mat2_' + Math.random(), '0xffd700',
      { emissive: '0xffd700', disableLighting: true });
    frameGeo2.position.z = -0.05;
    frameGeo2.parent = hpGroup;

    const starMesh2 = MeshBuilder.CreateSphere(
      'star_icon2_' + Math.random(),
      { diameter: 5, tessellation: 2 },
      s.scene
    );
    starMesh2.material = mat(s.scene, 'star_mat2_' + Math.random(), '0xffd700',
      { emissive: '0xffd700', disableLighting: true });
    starMesh2.position.set(-hpBarWidth / 2 - 4.5, 0, 0.2);
    starMesh2.parent = hpGroup;
  }

  hpGroup.parent = s.sceneMount;

  const dx = (Math.random() - 0.5) * 2;
  const dy = (Math.random() - 0.5) * 2;
  const limbs: Record<string, any> = { 'leg-left': null, 'leg-right': null, 'arm-left': null, 'arm-right': null };
  const meshDesc2 = (mesh as any).getDescendants ? (mesh as any).getDescendants() : [];
  for (const c of meshDesc2) {
    if (c.name && limbs.hasOwnProperty(c.name)) limbs[c.name] = c;
  }
  s.enemies.push({
    x: ex, y: ey, r: eR, meshY: eY, dx, dy,
    hp, maxHp: hp, baseSpeed, damage: damage || 10,
    mesh, hpGroup, hpFg: hpFg2,
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
  } as Enemy);
}

// ─── Player movement & combat ─────────────────────────────────────────────────

export function move(dt: number): void {
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
      let adx = (targetX - s.player.x) / distToTarget;
      let ady = (targetY - s.player.y) / distToTarget;

      const LOOKAHEAD = 60;
      const SAMPLES = 12;
      const straightAngle = Math.atan2(ady, adx);

      if (!blocked(s.player.x + adx * LOOKAHEAD, s.player.y + ady * LOOKAHEAD, s.player.r)) {
        // straight path clear
      } else {
        let bestAngle = straightAngle;
        let bestScore = -Infinity;

        for (let i = 0; i < SAMPLES; i++) {
          const spread = Math.PI;
          const angle = straightAngle - spread / 2 + (spread / (SAMPLES - 1)) * i;
          const sx = Math.cos(angle), sy = Math.sin(angle);
          const px = s.player.x + sx * LOOKAHEAD;
          const py = s.player.y + sy * LOOKAHEAD;

          if (blocked(px, py, s.player.r)) continue;

          let dAngle = angle - straightAngle;
          while (dAngle > Math.PI) dAngle -= 2 * Math.PI;
          while (dAngle < -Math.PI) dAngle += 2 * Math.PI;
          const score = 1 - Math.abs(dAngle) / (Math.PI / 2);

          if (score > bestScore) { bestScore = score; bestAngle = angle; }
        }

        adx = Math.cos(bestAngle);
        ady = Math.sin(bestAngle);
      }

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

    // Triple Slash (R)
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

export function clearAutoWalkTarget(): void {
  state.autoWalkTarget = null;
  if (state.waypointMesh) {
    state.waypointMesh.dispose();
    state.waypointMesh = null;
  }
}

function animatePlayer(walking: boolean): void {
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
    let diff = faceAngle - s.gltfPlayerRef.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    s.gltfPlayerRef.rotation.y += diff * 0.15;

    s.gltfPlayerRef.position.y = -15;
  } else if (s.gltfPlayerRef) {
    if (!s.playerLegL) {
      const findNode = (parent: any, name: string) => {
        const ds = parent.getDescendants ? parent.getDescendants() : [];
        return ds.find((n: any) => n.name === name) || null;
      };
      s.playerLegL = findNode(s.gltfPlayerRef, 'leg-left') as TransformNode;
      s.playerLegR = findNode(s.gltfPlayerRef, 'leg-right') as TransformNode;
      s.playerArmL = findNode(s.gltfPlayerRef, 'arm-left') as TransformNode;
      s.playerArmR = findNode(s.gltfPlayerRef, 'arm-right') as TransformNode;
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
  } else if ((s.playerMesh as any).leftHip) {
    const swing = Math.sin(s.player.walkCycle) * 0.6;
    (s.playerMesh as any).leftHip.rotation.z = walking ? swing : 0;
    (s.playerMesh as any).rightHip.rotation.z = walking ? Math.sin(s.player.walkCycle + Math.PI) * 0.6 : 0;
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

export function attack(): void {
  const s = state;
  if (s.player.attackCooldown > 0 || s.gameOver || s.isPaused || !s.isGameStarted) return;
  s.player.attackCooldown = 90;
  s.player.attackHitDelay = [10];
  playSound('dash');

  if (s.auraBursts) {
    const burstChildren = (s.auraBursts as any).getChildren ? (s.auraBursts as any).getChildren() : [];
    for (const b of burstChildren) {
      b.setEnabled(true);
      (b as any)._burstLife = 30;
      (b as any)._burstAng = Math.random() * Math.PI * 2;
    }
  }
}

function applyEliteOnHit(e: Enemy, dmgValue: number): number {
  const s = state;
  if (!e.isElite || !e.elite) return dmgValue;
  let finalDmg = dmgValue;

  if (e.elite.ability === 'phalanx_shield') {
    const angleToPlayer = Math.atan2(s.player.y - e.y, s.player.x - e.x);
    let diff = Math.abs(angleToPlayer - e.mesh.rotation.y);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
    if (diff < 1.0) {
      finalDmg = Math.max(1, Math.floor(finalDmg * 0.6));
      spawnDamageText(e.x, e.mesh.position.y + 45, e.y, 'SHIELD BLOCKED!', '#ffffff');
      playSound('hit');
    }
  }

  if (e.elite.ability === 'thorns_reflect' && !s.player.defending) {
    const thornsDmg = 6;
    s.player.hp = Math.max(0, s.player.hp - thornsDmg);
    spawnDamageText(s.player.x, 30, s.player.y, `THORNS! -${thornsDmg}`, '#ffd600');
    spawnParticles(s.player.x, s.player.y, 0xffd600, 5, 'hit');
  }

  if (e.elite.ability === 'golden_burst') {
    s.gold += 5;
    spawnParticles(e.x, e.y, 0xffd700, 4, 'heal');
    spawnDamageText(e.x, e.mesh.position.y + 35, e.y, '+5 GOLD!', '#ffd700');
    if (typeof (window as any).updateUI === 'function') (window as any).updateUI(true);
  }

  return finalDmg;
}

function doTripleHit(finalHit = false): void {
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

  const angle = Math.atan2(s.player.facingY, s.player.facingX);
  const px = s.player.x + Math.cos(angle) * 40;
  const pz = s.player.y + Math.sin(angle) * 40;
  const slashColor = finalHit ? '0xffff44' : '0xffd700';
  const slashMesh = MeshBuilder.CreateBox(
    'slash_triple_' + Math.random(),
    { width: 10 * slashScale, height: 2 * slashScale, depth: 180 * slashScale },
    s.scene
  );
  const slashMat = mat(s.scene, 'slash_triple_mat_' + Math.random(), slashColor,
    { emissive: slashColor, opacity: finalHit ? 0.95 : 0.85, disableLighting: true });
  slashMesh.material = slashMat;
  slashMesh.position.set(px, 15, pz);
  slashMesh.rotation.y = -angle;
  slashMesh.parent = s.sceneMount;
  s.particles.push({
    mesh: slashMesh,
    dx: Math.cos(angle) * 12,
    dy: Math.sin(angle) * 12,
    dz: 0,
    life: finalHit ? 1.2 : 0.8,
    decay: finalHit ? 0.05 : 0.08,
  } as any);
  spawnParticles(px, pz, finalHit ? 0xffff44 : 0xffffff, finalHit ? 12 : 8, 'dust');
}

function doMeleeHit(): void {
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
      if (['slime', 'mage', 'necro'].includes(e.type) && !(e as any).statusEffect && Math.random() < 0.2) {
        applyStatusEffect(e, 'poison');
      } else if (['fire_enemy', 'dragon', 'archdemon'].includes(e.type) && !(e as any).statusEffect && Math.random() < 0.15) {
        applyStatusEffect(e, 'burn');
      }
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

  const angle = Math.atan2(s.player.facingY, s.player.facingX);
  const px = s.player.x + Math.cos(angle) * 40;
  const pz = s.player.y + Math.sin(angle) * 40;

  const slashMesh = MeshBuilder.CreateBox(
    'slash_melee_' + Math.random(),
    { width: 10, height: 2, depth: 180 },
    s.scene
  );
  const slashMat = mat(s.scene, 'slash_melee_mat_' + Math.random(), '0xffd700',
    { emissive: '0xffd700', opacity: 0.9, disableLighting: true });
  slashMesh.material = slashMat;
  slashMesh.position.set(px, 15, pz);
  slashMesh.rotation.y = -angle;
  slashMesh.parent = s.sceneMount;

  s.particles.push({
    mesh: slashMesh,
    dx: Math.cos(angle) * 12,
    dy: Math.sin(angle) * 12,
    dz: 0,
    life: 1.0,
    decay: 0.08,
  } as any);

  spawnParticles(px, pz, 0xffffff, 8, 'dust');
}

export function triggerInteractable(it: any, index: number): void {
  const s = state;
  it.hp -= s.player.attackDamage;
  if (it.hp > 0) return;

  if (it.type === 'chest' && !it.looted) {
    it.looted = true;
    const children = it.mesh.getChildMeshes ? it.mesh.getChildMeshes() : [];
    const lid = children.find((c: any) => c.name && c.name.includes('lid')) || children[1];
    if (lid) (lid as any).rotation.x = -Math.PI / 2.5;
    playSound('coin');
    spawnParticles(it.x, it.y, 0xffff00, 15, 'heal');
    spawnDamageText(it.x, 40, it.y, 'Harta Terbuka!', '#ffff00');

    for (let j = 0; j < 4; j++) {
      const dropMesh = MeshBuilder.CreateSphere(
        'chest_gold_' + j + '_' + Math.random(),
        { diameter: 8, tessellation: 2 },
        s.scene
      );
      dropMesh.material = mat(s.scene, 'chest_gold_mat_' + j, '0xffd700',
        { emissive: '0xffd700', disableLighting: true });
      dropMesh.position.set(it.x + (Math.random() - 0.5) * 20, 5, it.y + (Math.random() - 0.5) * 20);
      dropMesh.parent = s.sceneMount;
      s.lootDrops.push({ x: dropMesh.position.x, y: dropMesh.position.z, taken: false, type: 'gold', item: { id: 'gold', name: 'Gold', value: 10 }, mesh: dropMesh } as any);
    }
    const potMesh = MeshBuilder.CreateCylinder(
      'chest_pot_' + Math.random(),
      { diameter: 4, height: 6, tessellation: 8 },
      s.scene
    );
    potMesh.material = mat(s.scene, 'chest_pot_mat_' + Math.random(), '0xff0000',
      { emissive: '0xff0000', disableLighting: true });
    potMesh.position.set(it.x, 3, it.y + 10);
    potMesh.parent = s.sceneMount;
    s.lootDrops.push({ x: it.x, y: it.y + 10, taken: false, type: 'potion', mesh: potMesh } as any);

  } else if (it.type === 'barrel' && !it.exploded) {
    it.exploded = true;
    playSound('hit');
    spawnParticles(it.x, it.y, 0xffaa00, 30, 'death');
    s.cameraShake = Math.max(s.cameraShake || 0, 20);

    if (Math.hypot(s.player.x - it.x, s.player.y - it.y) < 80) {
      s.player.hp = Math.max(0, s.player.hp - 30);
      spawnDamageText(s.player.x, 30, s.player.y, '-30', '#ff0000');
    }
    for (const e of s.enemies) {
      if (Math.hypot(e.x - it.x, e.y - it.y) < 100) {
        e.hp -= 150;
        e.stunTimer = 60;
        spawnDamageText(e.x, e.mesh.position.y + 35, e.y, '-150', '#ff0000');
      }
    }

    it.mesh.setEnabled(false);
    s.interactables.splice(index, 1);
  }
}

// ─── Spin Attack (X key) ───────────────────────────────────────────────────────

export function triggerSpinAttack(): boolean {
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

// ─── Auto-Combat Mode ───────────────────────────────────────────────────────────

export function updateAutoCombat(dt: number): void {
  const s = state;
  if (!s.autoAttack || s.gameOver || s.isPaused || !s.isGameStarted) return;
  if (s.player.defending || s.player.isTripling > 0) return;
  if (s.currentScene === 'hometown') return;

  const range = s.autoAttackRange || 140;
  const nearbyEnemies: { entity: Enemy; dist: number; isBoss: boolean }[] = [];

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

  if (s.bossActive && s.bossHp > 0) {
    const bossDist = Math.hypot(s.bossX - s.player.x, s.bossY - s.player.y);
    if (bossDist <= range + 40) {
      nearbyEnemies.push({
        entity: { x: s.bossX, y: s.bossY, r: 40, hp: s.bossHp } as unknown as Enemy,
        dist: bossDist,
        isBoss: true,
      });
    }
  }

  if (nearbyEnemies.length === 0) {
    if (s.lootDrops && s.lootDrops.length > 0) {
      const isMovingManual = hasAnyKey(s.keys, ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);
      if (!isMovingManual) {
        const AUTO_LOOT_RANGE = 350;
        let nearestLoot: { x: number; y: number } | null = null;
        let nearestDist = Infinity;

        for (const drop of s.lootDrops) {
          if ((drop as any).taken) continue;
          const d = Math.hypot(drop.x - s.player.x, drop.y - s.player.y);
          if (d < AUTO_LOOT_RANGE && d < nearestDist) {
            nearestDist = d;
            nearestLoot = drop as any;
          }
        }

        if (nearestLoot) {
          if (nearestDist > 38) {
            s.autoWalkTarget = { x: nearestLoot.x, y: nearestLoot.y };
          } else {
            s.autoWalkTarget = null;
          }
          return;
        }
      }
    }
    if (s.autoWalkTarget) s.autoWalkTarget = null;
    return;
  }

  nearbyEnemies.sort((a, b) => a.dist - b.dist);
  const closest = nearbyEnemies[0];

  const closestEntity: any = closest.entity;
  const isRangedEnemy = !closest.isBoss && (
    closestEntity.type === 'archer' ||
    closestEntity.type === 'sc_archer' ||
    (closestEntity.isElite && ['mage', 'sc_mage', 'sc_dragon'].includes(closestEntity.type))
  );

  const toDx = closestEntity.x - s.player.x;
  const toDy = closestEntity.y - s.player.y;
  const normLen = Math.hypot(toDx, toDy) || 1;
  const normX = toDx / normLen;
  const normY = toDy / normLen;

  const isMovingManual = hasAnyKey(s.keys, ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);

  if (!isMovingManual) {
    s.player.facingX = normX;
    s.player.facingY = normY;
    s.player.lastFacingX = normX;
    s.player.lastFacingY = normY;
  }

  const meleeStrikeRange = s.player.r + (closestEntity.r || 16) + 20;

  if (isRangedEnemy && closest.dist > meleeStrikeRange && !isMovingManual) {
    const stopDist = meleeStrikeRange - 5;
    s.autoWalkTarget = {
      x: closestEntity.x - normX * stopDist,
      y: closestEntity.y - normY * stopDist,
    };
    return;
  }

  if (s.autoWalkTarget) s.autoWalkTarget = null;

  if (s.player.spinCooldown <= 0 && s.player.stamina >= 50) {
    triggerSpinAttack();
    return;
  }

  const tripleSlashReady = (s.player.tripleCooldown || 0) <= 0;
  if (tripleSlashReady && s.player.stamina >= 60 && s.player.isTripling <= 0 && closest.dist <= meleeStrikeRange) {
    s.player.stamina -= 60;
    s.player.tripleCooldown = 300;
    s.player.isTripling = 283;
    s.player.tripleHitDelay = [94, 94, 94];
    playSound('spin');
    return;
  }

  if (s.player.attackCooldown <= 0) {
    attack();
  }
}

// ─── Potions ───────────────────────────────────────────────────────────────────

export function usePotion(): void {
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
  const btn = document.getElementById('btn-potion') as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = `🧪 Heal (C) [${s.potions}]`;
    btn.style.opacity = s.potions > 0 ? '1.0' : '0.5';
  }
  const navPotionsEl = document.getElementById('nav-potions');
  if (navPotionsEl) navPotionsEl.textContent = String(s.potions);
  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent = `🧪 Health Potion digunakan! (+40 HP)`;
  if (typeof window.updateUI === 'function') window.updateUI(true);
  if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
}

export function useStaminaPotion(): void {
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
  const btn = document.getElementById('btn-sp-potion') as HTMLButtonElement | null;
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

// ─── Projectile update ─────────────────────────────────────────────────────────

export function updateProjectiles(dt: number): void {
  const s = state;
  for (let i = s.projectiles.length - 1; i >= 0; i--) {
    const p = s.projectiles[i];
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    p.mesh.position.set(p.x, 15, p.y);

    if (blocked(p.x, p.y, 6)) {
      p.mesh.dispose();
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
          hit = true;
          playSound('hit');
          const pColor = projCrit.isCrit ? '#ffff00' : '#ff4444';
          const pLabel = projCrit.isCrit ? `CRIT! -${projCrit.value}` : `-${projCrit.value}`;
          spawnDamageText(e.x, e.mesh.position.y + 35, e.y, pLabel, pColor);
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
      p.mesh.dispose();
      s.projectiles.splice(i, 1);
    }
  }
}
