import * as THREE from 'three';
import { state } from './state.js';
import { playSound } from './audio.js';
import { spawnParticles } from './helpers.js';

// ─── Weather / day-night cycle ────────────────────────────────────────────────

export function updateWeather(dt) {
  const s = state;
  if (s.bossActive) {
    s.dayTime = 0.8; // Force storm
  } else {
    s.dayTime += 0.0003 * dt;
    if (s.dayTime > 1) s.dayTime = 0;
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
  if (Math.random() < 0.02) {
    let closest = null;
    let minDist = 200;
    s.enemies.forEach(e => {
      const d = Math.hypot(e.x - s.player.x, e.y - s.player.y);
      if (d < minDist) { minDist = d; closest = e; }
    });
    if (closest) {
      const angle = Math.atan2(closest.y - s.petMesh.position.z, closest.x - s.petMesh.position.x);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(3, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffaa })
      );
      m.position.copy(s.petMesh.position);
      s.scene.add(m);
      s.projectiles.push({
        x: m.position.x, y: m.position.z,
        dx: Math.cos(angle) * 15, dy: Math.sin(angle) * 15,
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
    s.player.x = 2000;
    s.player.y = 2100;

    // Clear existing enemies
    s.enemies.forEach(e => {
      s.scene.remove(e.mesh);
      s.scene.remove(e.hpGroup);
    });
    s.enemies.length = 0;

    // Spawn initial wave of enemies in the Wilds
    const initialSpawns = Math.min(30, 10 + s.player.level * 2);
    for (let i = 0; i < initialSpawns; i++) {
      if (typeof window.spawnEnemy === 'function') window.spawnEnemy();
    }

    document.getElementById('message').textContent = 'Merasuki The Wilds...';
  } else {
    s.player.x = 10000;
    s.player.y = 10080;
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
