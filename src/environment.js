import * as THREE from 'three';
import { state } from './state.js';
import { playSound } from './audio.js';
import { spawnParticles } from './helpers.js';
import { mapSize } from './constants.js';
import { initMap, initWildsNPCs, initWilds2 } from './scenes.js';

// ─── Weather / day-night cycle ────────────────────────────────────────────────

export function updateWeather(dt) {
  const s = state;
  if (s.bossActive) {
    s.dayTime = 0.8; // Force storm
  } else {
    s.dayTime += 0.0003 * dt;
    if (s.dayTime > 1) s.dayTime = 0;
  }

  // Scorched Dunes: fixed hot sand atmosphere, no day-night cycle / rain
  if (s.currentScene === 'wilds2') {
    let r = 217, g = 178, b = 106; // hazy sand sky
    if (s.bossActive) { r = 150; g = 50; b = 30; }
    if (s.dirLight) s.dirLight.intensity = s.bossActive ? 0.4 : 1.0;
    if (s.scene) {
      s.scene.background.setRGB(r / 255, g / 255, b / 255);
      s.scene.fog.color.setRGB(r / 255, g / 255, b / 255);
    }
    if (s.rainParticles) s.rainParticles.material.opacity = 0;
    return;
  }

  let lightIntensity = 0.8;
  let r = 45, g = 79, b = 48; // 0x2d4f30 (siang)

  if (s.dayTime > 0.4) {
    const nightFactor = Math.sin((s.dayTime - 0.4) * Math.PI * (1 / 0.6));
    const nf = nightFactor < 0 ? 0 : nightFactor;
    lightIntensity = 0.8 - (nf * 0.6);
    r -= nf * 35;
    g -= nf * 59;
    b += nf * 20;
  }
  if (s.bossActive) {
    r = 80; g = 10; b = 10; // Blood moon
    lightIntensity = 0.3;
  }

  if (s.dirLight) s.dirLight.intensity = lightIntensity;
  if (s.scene) {
    s.scene.background.setRGB(r / 255, g / 255, b / 255);
    s.scene.fog.color.setRGB(r / 255, g / 255, b / 255);
  }

  if (s.rainParticles) {
    if (s.bossActive || (s.dayTime > 0.6 && s.dayTime < 0.9)) {
      s.rainParticles.material.opacity = 0.6;
      const positions = s.rainParticles.geometry.attributes.position.array;
      for (let i = 0; i < 1500; i++) {
        positions[i * 3 + 1] -= 15;
        if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 500;
      }
      s.rainParticles.geometry.attributes.position.needsUpdate = true;
      s.rainParticles.position.x = s.player.x;
      s.rainParticles.position.z = s.player.y;
    } else {
      s.rainParticles.material.opacity = 0;
    }
  }

  // Ambient Particles (Fireflies, Leaves, Sand)
  if (!s.ambientTimer) s.ambientTimer = 0;
  s.ambientTimer += dt;
  if (s.ambientTimer > 5) {
    s.ambientTimer = 0;
    if (s.currentScene === 'wilds') {
      if (s.dayTime > 0.4) {
        if (Math.random() < 0.5) spawnParticles(s.player.x + (Math.random()-0.5)*800, s.player.y + (Math.random()-0.5)*800, 0x88ff88, 1, 'heal'); // Firefly
      } else {
        if (Math.random() < 0.3) spawnParticles(s.player.x + (Math.random()-0.5)*800, s.player.y + (Math.random()-0.5)*800, 0x228b22, 1, 'dust'); // Leaf
      }
    } else if (s.currentScene === 'wilds2') {
      if (Math.random() < 0.5) spawnParticles(s.player.x + (Math.random()-0.5)*800, s.player.y + (Math.random()-0.5)*800, 0xd2b48c, 1, 'dust'); // Sand
    }
  }

  // Animate interactables VFX (Mystic Ruins core)
  if (s.interactables) {
    const time = Date.now() * 0.002;
    for (const it of s.interactables) {
      if (it.isVFX && it.type === 'ruin_core' && it.scene === s.currentScene) {
        it.mesh.position.y = 30 + Math.sin(time + it.x) * 5;
        it.mesh.rotation.y = time;
        it.mesh.rotation.x = time * 0.5;
      }
    }
  }
}

// ─── Particles update ─────────────────────────────────────────────────────────

export function updateParticles(dt) {
  const s = state;
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    p.life -= p.decay * dt;
    if (p.life <= 0) {
      s.scene.remove(p.mesh);
      s.particles.splice(i, 1);
      continue;
    }
    p.mesh.position.x += p.dx * dt;
    p.mesh.position.y += p.dz * dt;
    p.mesh.position.z += p.dy * dt;
    p.mesh.material.opacity = p.life;
    p.mesh.scale.setScalar(Math.max(0, p.life));
  }

  // Animasi Weapon Aura — 3 layer: core wisps (helix), sparks (billboard), burst pool
  if (s.weaponAuraGroup && s.playerSwordMesh) {
    const tGlobal = Date.now() * 0.004;
    const swordWorld = new THREE.Vector3();
    s.playerSwordMesh.getWorldPosition(swordWorld);

    const bladeDir = new THREE.Vector3(0, 0, -1);
    bladeDir.applyQuaternion(s.playerSwordMesh.getWorldQuaternion(new THREE.Quaternion()));
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(bladeDir, worldUp).normalize();
    if (right.lengthSq() < 0.01) right.set(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(bladeDir, right).normalize();

    const startOffset = -15;
    const bladeLen = 38;
    const dtN = dt * 60;

    // Attack pulse: attackCooldown 90→0 decays over ~1.5 s
    const atk  = Math.max(0, Math.min(1, s.player.attackCooldown / 90));
    const sMul = 1 + 2.5 * atk;   // flow speed boost during attack
    const rMul = 1 + 0.6 * atk;   // radius swell during attack

    const _meshUp = new THREE.Vector3(0, 1, 0);
    const _flowDir = new THREE.Vector3();

    for (const p of s.weaponAuraGroup.children) {
      const u = p.userData;
      u.t -= u.vt * dtN * sMul;
      if (u.t < -0.2) u.t = 1.1;
      const along = Math.max(u.t, 0);

      // Blade profile: parabolic — narrow at hilt & tip, widest at mid-blade
      const profile = 0.12 + 1.55 * 4 * along * (1 - along) * 0.25;
      const radius  = u.r * profile * rMul;
      // Helix: u.twist revolutions over blade length + time-driven spin
      const angle   = u.t * u.twist * Math.PI * 2
                    + tGlobal * u.angSpeed * sMul
                    + u.animOffset;
      const pos     = startOffset + along * bladeLen;

      p.position.set(
        swordWorld.x + bladeDir.x*pos + right.x*Math.cos(angle)*radius + perp.x*Math.sin(angle)*radius,
        swordWorld.y + bladeDir.y*pos + right.y*Math.cos(angle)*radius + perp.y*Math.sin(angle)*radius,
        swordWorld.z + bladeDir.z*pos + right.z*Math.cos(angle)*radius + perp.z*Math.sin(angle)*radius,
      );

      if (p.geometry.type === 'CylinderGeometry') {
        // Core wisps: align tube axis to local flow direction
        _flowDir.set(bladeDir.x, bladeDir.y, bladeDir.z)
          .addScaledVector(right, Math.cos(angle) * 0.35)
          .addScaledVector(perp,  Math.sin(angle) * 0.35)
          .normalize();
        p.quaternion.setFromUnitVectors(_meshUp, _flowDir);
        p.material.opacity = 0.4 + 0.45 * atk + 0.08 * Math.sin(tGlobal * 6);
      } else {
        // Spark planes: billboard to camera
        if (s.camera) p.quaternion.copy(s.camera.quaternion);
        p.material.opacity = u.baseOp * (1 + 1.2 * atk);
      }
    }

    // Attack burst pool
    if (s.auraBursts) {
      for (const b of s.auraBursts.children) {
        const bu = b.userData;
        if (bu.life <= 0) continue;
        bu.life -= dt;
        if (bu.life <= 0) { b.visible = false; continue; }
        const prog   = 1 - bu.life / bu.maxLife;
        const radial = bu.spd * prog * 8;
        const bPos   = startOffset + 0.9 * bladeLen;
        b.position.set(
          swordWorld.x + bladeDir.x*bPos + right.x*Math.cos(bu.ang)*radial + perp.x*Math.sin(bu.ang)*radial,
          swordWorld.y + bladeDir.y*bPos + right.y*Math.cos(bu.ang)*radial + perp.y*Math.sin(bu.ang)*radial,
          swordWorld.z + bladeDir.z*bPos + right.z*Math.cos(bu.ang)*radial + perp.z*Math.sin(bu.ang)*radial,
        );
        b.material.opacity = (bu.life / bu.maxLife) * 0.8;
        b.scale.setScalar(1.4 - 0.4 * prog);
      }
    }
  }
}

// ─── Pet (fairy companion) ────────────────────────────────────────────────────

export function updatePet(dt) {
  const s = state;
  if (!s.petActive || !s.petMesh) return;

  s.petAngle += 0.05 * dt;

  const targetX = s.player.x + Math.cos(s.petAngle) * 20;
  const targetZ = s.player.y + Math.sin(s.petAngle) * 20;
  const targetY = 25 + Math.sin(s.petAngle * 2) * 5;

  s.petMesh.position.x += (targetX - s.petMesh.position.x) * 0.1 * dt;
  s.petMesh.position.y += (targetY - s.petMesh.position.y) * 0.1 * dt;
  s.petMesh.position.z += (targetZ - s.petMesh.position.z) * 0.1 * dt;
  s.petMesh.rotation.y += 0.1 * dt;

  // Pet occasionally fires at nearby enemies
  s.petAttackTimer = (s.petAttackTimer ?? 0) + dt;
  if (s.petAttackTimer > 60) {
    s.petAttackTimer = 0;
    let closest = null;
    let minDist = 150;
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - s.petMesh.position.x, e.y - s.petMesh.position.z);
      if (d < minDist) { minDist = d; closest = e; }
    }
    if (closest) {
      const petAngle = Math.atan2(closest.y - s.petMesh.position.z, closest.x - s.petMesh.position.x);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(3, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffaa })
      );
      m.position.copy(s.petMesh.position);
      s.scene.add(m);
      s.projectiles.push({
        x: m.position.x, y: m.position.z,
        dx: Math.cos(petAngle) * 15, dy: Math.sin(petAngle) * 15,
        mesh: m, isPet: true,
      });
      playSound('shoot');
    }
  }
}

// ─── Teleport between scenes ──────────────────────────────────────────────────

export function teleportTo(sceneName) {
  console.log('Teleporting to', sceneName);
  const s = state;
  s.currentScene = sceneName;

  if (sceneName === 'wilds') {
    if (!s.wildsLoaded) {
      console.log('Lazy loading The Wilds...');
      initMap();
      initWildsNPCs();
      s.wildsLoaded = true;
    }
    
    if (s.hometownGroup) s.hometownGroup.visible = false;
    if (s.wilds2Group) s.wilds2Group.visible = false;
    if (s.wildsGroup) s.wildsGroup.visible = true;
    if (s.mainFloor) s.mainFloor.visible = true;

    s.player.x = Math.floor(mapSize / 2);
    s.player.y = Math.floor(mapSize / 2) + 100;

    // Clear existing enemies
    s.enemies.forEach(e => {
      s.scene.remove(e.mesh);
      s.scene.remove(e.hpGroup);
    });
    s.enemies.length = 0;

    // Spawn initial wave of enemies in the Wilds scattered around the map
    const initialSpawns = Math.min(30, 10 + s.player.level * 2);
    for (let i = 0; i < initialSpawns; i++) {
      if (typeof window.spawnEnemy === 'function') window.spawnEnemy();
    }

    document.getElementById('message').textContent = 'Merasuki The Wilds...';
  } else if (sceneName === 'wilds2') {
    if (!s.wilds2Loaded) {
      console.log('Lazy loading Scorched Dunes...');
      initWilds2();
      s.wilds2Loaded = true;
    }

    if (s.hometownGroup) s.hometownGroup.visible = false;
    if (s.wildsGroup) s.wildsGroup.visible = false;
    if (s.wilds2Group) s.wilds2Group.visible = true;
    if (s.mainFloor) s.mainFloor.visible = false; // desert: hide grass floor

    s.player.x = Math.floor(mapSize / 2);
    s.player.y = Math.floor(mapSize / 2) + 800; // Pindahkan jauh ke depan piramida agar tidak tersangkut

    // Clear existing enemies
    s.enemies.forEach(e => {
      s.scene.remove(e.mesh);
      s.scene.remove(e.hpGroup);
    });
    s.enemies.length = 0;

    // Spawn initial wave of tier-2 enemies in the desert
    const initialSpawns = Math.min(80, 40 + s.player.level * 3); // Lebih banyak musuh
    for (let i = 0; i < initialSpawns; i++) {
      if (typeof window.spawnEnemy2 === 'function') window.spawnEnemy2();
    }

    document.getElementById('message').textContent = 'Memasuki Scorched Dunes...';
  } else {
    if (s.wildsGroup) s.wildsGroup.visible = false;
    if (s.wilds2Group) s.wilds2Group.visible = false;
    if (s.hometownGroup) s.hometownGroup.visible = true;
    if (s.mainFloor) s.mainFloor.visible = true;

    s.player.x = 500;
    s.player.y = 800;
    document.getElementById('message').textContent = 'Kembali ke Safe Haven.';
  }

  // Update player mesh position to match new coordinates
  if (s.playerMesh) {
    s.playerMesh.position.set(s.player.x, 15, s.player.y);
  }

  // Reposition camera to follow the player after teleport
  const camX = s.player.x;
  const camZ = s.player.y - s.cameraOffsetZ;
  const camY = s.cameraOffsetY;
  if (s.camera) {
    s.camera.position.set(camX, camY, camZ);
    s.camera.lookAt(s.player.x, s.cameraLookAtY, s.player.y);
  }

  // Reset facing direction if necessary
  if (!s.player.facingX && !s.player.facingY) {
    s.player.facingX = 1;
    s.player.facingY = 0;
  }

  playSound('coin');
  if (typeof window.saveGame === 'function') window.saveGame(true);
}
