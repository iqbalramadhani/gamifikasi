import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';
import { mapSize, weaponList, armorList, enemyTemplates, lootTable } from './constants.js';
import { loadedModels } from './model-loader.js';
import { blocked, spawnParticles, spawnDamageText } from './helpers.js';
import { spawnAtFreePos } from './scenes.js';
import { playSound } from './audio.js';

// ─── Enemy spawner (called by initEntities + game loop) ──────────────────────

export function spawnEnemy(ex, ey) {
  const s = state;
  if (!ex || !ey) {
    const pos = spawnAtFreePos();
    ex = pos.x; ey = pos.y;
  }

  const tmpl = enemyTemplates[Math.floor(Math.random() * enemyTemplates.length)];
  let { hp, speed: baseSpeed, r: eR, typeStr } = tmpl;
  const charKey = tmpl.charKey;

  let mesh, eY;

  if (loadedModels[charKey]) {
    const gltfEnemy = SkeletonUtils.clone(loadedModels[charKey]);
    gltfEnemy.scale.set(22, 22, 22);
    gltfEnemy.position.y = -12;
    mesh = new THREE.Group();
    mesh.add(gltfEnemy);
    eY = 15;
  } else {
    const boxGeo = new THREE.BoxGeometry(20, 20, 20);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    mesh = new THREE.Mesh(boxGeo, boxMat);
    eY = 10;
  }

  const levelMulti = 1 + s.player.level * 0.1;
  hp *= levelMulti;
  mesh.position.set(ex, eY, ey);
  s.scene.add(mesh);

  const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const hpFgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
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
    hp, maxHp: hp, baseSpeed,
    mesh, hpGroup, hpFg,
    stunTimer: 0, slowTimer: 0, type: typeStr,
    attackTimer: 0, walkCycle: Math.random() * Math.PI * 2,
    limbs,
  });
}

// ─── Player movement & combat ─────────────────────────────────────────────────

export function move(dt) {
  const s = state;
  if (s.gameOver || s.isPaused || !s.isGameStarted) return;

  let dx = 0, dy = 0;
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
      s.player.isSpinning = 30;
      s.cameraShake = Math.max(s.cameraShake || 0, 8);
      playSound('spin');
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < s.player.r + e.r + 50) {
          e.hp -= s.player.attackDamage * 3;
          e.slowTimer = 90;
          e.stunTimer = 20;
          const angle = Math.atan2(e.y - s.player.y, e.x - s.player.x);
          e.dx = Math.cos(angle) * 12; e.dy = Math.sin(angle) * 12;
          spawnDamageText(e.x, e.meshY + 20, e.y, `-${s.player.attackDamage * 3}`);
          if (e.hp <= 0) killEnemy(i);
          else spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
        }
      }
      if (s.bossActive && Math.hypot(s.bossX - s.player.x, s.bossY - s.player.y) < s.player.r + 60 + 50) {
        s.bossHp -= s.player.attackDamage * 3;
        playSound('hit');
        spawnDamageText(s.bossX, 50, s.bossY, `-${s.player.attackDamage * 3}`);
      }
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
  if (s.gltfPlayerRef) {
    if (!s.playerLegL) {
      s.playerLegL = s.gltfPlayerRef.getObjectByName('leg-left');
      s.playerLegR = s.gltfPlayerRef.getObjectByName('leg-right');
      s.playerArmL = s.gltfPlayerRef.getObjectByName('arm-left');
      s.playerArmR = s.gltfPlayerRef.getObjectByName('arm-right');
    }
    const faceAngle = -Math.atan2(s.player.facingX, s.player.facingY) + Math.PI / 2;
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

// ─── Shooting ─────────────────────────────────────────────────────────────────

const projGeo = new THREE.SphereGeometry(6, 8, 8);
const projMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

export function shoot() {
  const s = state;
  if (s.player.attackCooldown > 0 || s.gameOver || s.isPaused || !s.isGameStarted) return;
  s.player.attackCooldown = 15;
  playSound('shoot');

  const mesh = new THREE.Mesh(projGeo, projMat);
  mesh.position.set(s.player.x, 15, s.player.y);
  s.scene.add(mesh);

  s.projectiles.push({
    x: s.player.x, y: s.player.y,
    dx: s.player.facingX * 10, dy: s.player.facingY * 10,
    mesh, isEnemy: false,
  });
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
          e.hp -= s.player.attackDamage;
          e.slowTimer = 90;
          e.stunTimer = 15;
          const angle = Math.atan2(e.y - p.y, e.x - p.x);
          e.dx = Math.cos(angle) * 8; e.dy = Math.sin(angle) * 8;
          hit = true;
          playSound('hit');
          spawnDamageText(e.x, e.meshY + 20, e.y, `-${s.player.attackDamage}`);
          if (e.hp <= 0) killEnemy(j);
          else spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
          break;
        }
      }
      if (!hit && s.bossActive) {
        if (Math.hypot(p.x - s.bossX, p.y - s.bossY) < 30 + 6) {
          s.bossHp -= s.player.attackDamage;
          hit = true;
          playSound('hit');
          spawnDamageText(s.bossX, 50, s.bossY, `-${s.player.attackDamage}`);
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
  if (Math.random() < 0.6) {
    const loot = lootTable[e.typeStr];
    if (loot) {
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

  // Spawner
  if (s.isGameStarted && !s.bossActive) {
    s._spawnTimer = (s._spawnTimer ?? 0) + dt;
    const spawnRate = Math.max(60, 180 - s.player.level * 10);
    const maxEnemies = Math.min(60, 20 + s.player.level * 5);
    if (s._spawnTimer > spawnRate && s.enemies.length < maxEnemies) {
      s._spawnTimer = 0;
      const edgeX = s.player.x + (Math.random() < 0.5 ? 800 : -800);
      const edgeY = s.player.y + (Math.random() < 0.5 ? 800 : -800);
      spawnEnemy(
        Math.max(50, Math.min(mapSize - 50, edgeX)),
        Math.max(50, Math.min(mapSize - 50, edgeY)),
      );
    }
  }

  for (let idx = s.enemies.length - 1; idx >= 0; idx--) {
    const e = s.enemies[idx];
    const distToPlayer = Math.hypot(s.player.x - e.x, s.player.y - e.y);

    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
    } else {
      const speed = e.slowTimer > 0 ? e.baseSpeed * 0.4 : e.baseSpeed;
      if (e.slowTimer > 0) e.slowTimer -= dt;

      if (distToPlayer < 400) {
        const angle = Math.atan2(s.player.y - e.y, s.player.x - e.x);
        if (e.type === 'archer') {
          if (distToPlayer > 180) {
            e.dx = Math.cos(angle) * speed;
            e.dy = Math.sin(angle) * speed;
          } else {
            e.dx = 0; e.dy = 0;
          }
          if (e.attackTimer === undefined) e.attackTimer = 0;
          e.attackTimer += dt;
          if (e.attackTimer > 120 && distToPlayer < 250) {
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

    if (e.type === 'ghost') {
      e.x = nx; e.y = ny;
    } else {
      if (blocked(nx, ny, e.r)) {
        if (!blocked(nx, e.y, e.r)) e.x = nx;
        else if (!blocked(e.x, ny, e.r)) e.y = ny;
        else if (distToPlayer >= 350) { e.dx *= -1; e.dy *= -1; }
      } else {
        e.x = nx; e.y = ny;
      }
    }

    // Smooth mesh follow
    e.mesh.position.x += (e.x - e.mesh.position.x) * Math.min(dt * 10, 1);
    e.mesh.position.z += (e.y - e.mesh.position.z) * Math.min(dt * 10, 1);

    const speedScalar = Math.hypot(e.dx, e.dy);
    let meshYTarget = e.meshY;
    if (speedScalar > 0.1) {
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
    e.hpGroup.position.set(e.x, e.meshY + 23, e.y);
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
      } else if (s.player.defending) {
        const angle = Math.atan2(e.y - s.player.y, e.x - s.player.x);
        e.dx = Math.cos(angle) * 5; e.dy = Math.sin(angle) * 5;
        e.stunTimer = 15;
      } else {
        s.player.hp = Math.max(0, s.player.hp - 0.3);
        s.cameraShake = Math.max(s.cameraShake || 0, 2);
        spawnDamageText(s.player.x, 30, s.player.y, `-0.3`, '#ff8888');
        if (s.player.hp <= 0) teleportToHometown('Anda pingsan! Terlempar kembali ke Kota.');
      }
    }
  }
}

function teleportToHometown(msg) {
  const s = state;
  s.player.hp = s.player.maxHp;
  s.gold = Math.max(0, Math.floor(s.gold / 2));
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

  if (dist > 80) {
    s.bossX += Math.cos(angle) * 1.5 * dt;
    s.bossY += Math.sin(angle) * 1.5 * dt;
  }

  s.bossMesh.position.x += (s.bossX - s.bossMesh.position.x) * Math.min(dt * 6, 1);
  s.bossMesh.position.z += (s.bossY - s.bossMesh.position.z) * Math.min(dt * 6, 1);
  s.bossMesh.position.y += (30 - s.bossMesh.position.y) * Math.min(dt * 6, 1);
  s.bossMesh.rotation.y += 0.02 * dt;
  s.bossMesh.rotation.x = Math.sin(Date.now() / 300) * 0.2;

  s.bossHpGroup.position.x += (s.bossX - s.bossHpGroup.position.x) * Math.min(dt * 6, 1);
  s.bossHpGroup.position.z += (s.bossY - s.bossHpGroup.position.z) * Math.min(dt * 6, 1);
  s.bossHpGroup.position.y += (80 - s.bossHpGroup.position.y) * Math.min(dt * 6, 1);
  s.bossHpGroup.lookAt(s.camera.position);

  const pct = Math.max(0, s.bossHp / s.bossMaxHp);
  s.bossHpFg.scale.x = Math.max(0.001, pct);
  s.bossHpFg.position.x = -(80 - (80 * pct)) / 2;

  // Boss AoE Slam Attack
  s.bossAttackTimer = (s.bossAttackTimer || 0) + dt;
  if (s.bossAttackTimer > 150 && dist < 120) {
     s.bossAttackTimer = 0;
     s.cameraShake = Math.max(s.cameraShake || 0, 20);
     spawnParticles(s.bossX, s.bossY, 0xffd700, 40, 'death');
     playSound('hit');
     if (dist < 100) {
        if (!s.player.defending) {
           s.player.hp -= 20;
           spawnDamageText(s.player.x, 30, s.player.y, `-20`, '#ff00ff');
           const knockAngle = Math.atan2(s.player.y - s.bossY, s.player.x - s.bossX);
           s.player.x += Math.cos(knockAngle) * 40;
           s.player.y += Math.sin(knockAngle) * 40;
           if (s.player.hp <= 0) triggerGameOver('Kamu dihancurkan hentakan The Golden Golem!');
        } else {
           const knockAngle = Math.atan2(s.player.y - s.bossY, s.player.x - s.bossX);
           s.player.x += Math.cos(knockAngle) * 20;
           s.player.y += Math.sin(knockAngle) * 20;
        }
     }
  } else if (Math.random() < 0.05) {
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

  // Contact damage
  if (dist < s.player.r + 30) {
    if (!s.player.defending) {
      s.player.hp -= 1.0;
      playSound('hit');
      if (s.player.hp <= 0) triggerGameOver('Kamu dihancurkan The Golden Golem!');
    } else {
      s.bossX -= Math.cos(angle) * 10;
      s.bossY -= Math.sin(angle) * 10;
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
    document.getElementById('message').textContent = '👑 The Golden Golem telah dikalahkan!';

    // Boss always drops a potion
    if (s.potions < 3) {
      const potGeo = new THREE.CylinderGeometry(3, 3, 8, 8);
      const potMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      const potMesh = new THREE.Mesh(potGeo, potMat);
      potMesh.position.set(s.bossX + 10, 10, s.bossY + 10);
      s.scene.add(potMesh);
      s.potionItems.push({ x: s.bossX + 10, y: s.bossY + 10, mesh: potMesh, taken: false });
    }
  }
}

function triggerGameOver(msg) {
  const s = state;
  s.gameOver = true;
  if (typeof window.saveGame === 'function') window.saveGame(true);
  document.getElementById('message').textContent = `💀 ${msg}`;
  document.getElementById('lose').style.display = 'flex';
}
