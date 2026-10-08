// Day/night cycle, weather, particles, pet, villagers, teleport, consumables
import {
  Color3,
  Color4,
  Vector3,
} from '@babylonjs/core';
import { state } from './state';
import { blocked, spawnParticles } from './helpers';
import { mapSize, weaponList } from './constants';
import { initWildsNPCs, initWilds2, getTerrainHeight, getTerrainHeightWilds2 } from './scenes';
import type { SceneName } from './types';

export function updateDayNightCycle(): void {
  const s = state;
  s.dayTime += 0.0008;
  const sunAngle = s.dayTime * 0.15;
  const sunIntensity = Math.sin(sunAngle);
  const brightness = Math.max(0.2, sunIntensity);

  if (s.scene) {
    const r = 0.35 + brightness * 0.5;
    const g = 0.50 + brightness * 0.35;
    const b = 0.70 + brightness * 0.25;
    s.scene.clearColor = new Color4(r, g, b, 1);
    s.scene.fogColor = new Color3(r, g, b);
  }

  if (s.dirLight) {
    s.dirLight.intensity = 0.5 + brightness;
  }
}

export function updateWeather(): void {
  const s = state;
  const isRaining = s.currentScene === 'wilds' && Math.sin(s.dayTime * 0.01) > 0.3;

  if (s.rainParticles && (s.rainParticles as any).isEnabled !== undefined) {
    (s.rainParticles as any).isEnabled = isRaining;
    if (isRaining) (s.rainParticles as any).emitRate = 500;
  }
}

export function updateParticles(): void {
  const s = state;

  const weaponTier = weaponList[s.currentWeapon];
  void weaponTier;

  if (s.playerAuraLight && s.playerAuraLight.intensity !== undefined) {
    s.playerAuraLight.intensity = s.currentWeapon === 0 ? 0.1 : (0.3 + s.currentWeapon * 0.15);
  }

  s.particles.forEach(p => {
    p.mesh.position.x += p.dx;
    p.mesh.position.y += p.dy;
    p.mesh.position.z += p.dz;
    p.life -= p.decay;

    if (p.life <= 0) {
      p.mesh.setEnabled(false);
      (p as any).dead = true;
    }
  });

  s.particles = s.particles.filter(p => !(p as any).dead);

  if (s.auraBursts) {
    const children = s.auraBursts.getDescendants ? s.auraBursts.getDescendants() : [];
    for (const m of children) {
      const node = m as any;
      if (node._burstLife !== undefined) {
        node._burstLife -= 0.08;
        node.scaling.setAll(Math.max(0, node._burstLife * node._burstBaseScale));
        if (node.material && node.material.alpha !== undefined) {
          node.material.alpha = node._burstLife;
        }
        if (node._burstLife <= 0) {
          node.setEnabled(false);
        }
      }
    }
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function updatePet(): void {
  const s = state;
  if (!s.petActive || !s.petMesh) return;

  s.petAngle += 0.03;
  const orbitX = s.player.x + Math.cos(s.petAngle) * 25;
  const orbitZ = s.player.y + Math.sin(s.petAngle) * 25;

  if (blocked(orbitX, orbitZ, 5)) {
    s.petAngle += 0.5;
    return;
  }

  s.petMesh.position.x = orbitX;
  s.petMesh.position.z = orbitZ;
  s.petMesh.position.y = 40 + Math.sin(Date.now() / 500) * 3;
}

export function updateVillagers(): void {
  const s = state;
  const t = Date.now() * 0.001;

  s.villagers.forEach(v => {
    if (!v.mesh) return;

    if (v.talking) {
      v.talkTimer -= 1;
      if (v.talkTimer <= 0) {
        v.talking = false;
        v.currentTarget = null;
      }
    } else if (v.currentTarget) {
      const dx = v.currentTarget.x - v.mesh.position.x;
      const dz = v.currentTarget.z - v.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 25) {
        v.currentTarget = null;
        v.waitTimer = 60 + Math.floor(Math.random() * 300);
      } else {
        const angle = Math.atan2(dx, dz);
        v.mesh.rotation.y = lerpAngle(v.mesh.rotation.y, angle, 0.05);
        const speed = v.walkSpeed || 1.5;
        const nx = v.mesh.position.x + Math.sin(angle) * speed;
        const nz = v.mesh.position.z + Math.cos(angle) * speed;
        if (!blocked(nx, nz, 10) && s.obstaclesHometown.every(o => Math.hypot(o.x - nx, o.y - nz) >= o.r + 10)) {
          v.mesh.position.x = nx;
          v.mesh.position.z = nz;
        } else {
          v.currentTarget = null;
        }
      }
    }

    if (!v.talking && !v.currentTarget) {
      v.waitTimer -= 1;
      if (v.waitTimer <= 0) {
        const targets = s.villagerWalkTargets;
        if (targets && targets.length > 0) {
          v.currentTarget = targets[Math.floor(Math.random() * targets.length)];
        }
      }
    }

    if (v.legL && v.legR && v.armL && v.armR) {
      if (v.currentTarget && !v.talking) {
        const cycle = t * 5;
        v.legL.rotation.x = Math.sin(cycle) * 0.4;
        v.legR.rotation.x = Math.sin(cycle + Math.PI) * 0.4;
        v.armL.rotation.x = Math.sin(cycle + Math.PI) * 0.2;
        v.armR.rotation.x = Math.sin(cycle) * 0.2;
      } else {
        v.legL.rotation.x = 0;
        v.legR.rotation.x = 0;
        v.armL.rotation.x = 0;
        v.armR.rotation.x = 0;
      }
    }

    if (v.talking && !v.currentTarget) {
      v.bobOffset = Math.sin(t * 3) * 1.5;
    } else {
      v.bobOffset = 0;
    }
    if (v.baseY !== undefined) {
      v.mesh.position.y = v.baseY + v.bobOffset;
    }
  });

  s.villageAnimals.forEach(a => {
    if (!a.mesh) return;
    a.angle += a.speed;
    const ax = a.center.x + Math.cos(a.angle) * a.radius;
    const az = a.center.y + Math.sin(a.angle) * a.radius;
    if (blocked(ax, az, 8)) return;
    a.mesh.position.x = ax;
    a.mesh.position.z = az;
    a.mesh.rotation.y = -a.angle + (a.headingOffset || 0);
  });
}

export function teleportTo(targetScene: SceneName): void {
  const s = state;

  if (targetScene === 'wilds' && !s.wildsLoaded) {
    initWildsNPCs();
    s.wildsLoaded = true;
  }

  if (targetScene === 'wilds2' && !s.wilds2Loaded) {
    initWilds2();
    s.wilds2Loaded = true;
  }

  s.currentScene = targetScene;

  if (s.hometownGroup) s.hometownGroup.setEnabled(targetScene === 'hometown');
  if (s.wildsGroup) s.wildsGroup.setEnabled(targetScene === 'wilds');
  if (s.wilds2Group) s.wilds2Group.setEnabled(targetScene === 'wilds2');

  if (s.mainFloor) s.mainFloor.setEnabled(targetScene !== 'wilds2');

  if (targetScene === 'hometown') {
    s.player.x = 500;
    s.player.y = 500;
  } else if (targetScene === 'wilds2') {
    s.player.x = 200;
    s.player.y = mapSize - 200;
  }

  if (s.playerMesh) {
    const terrainH = targetScene === 'wilds2' ? getTerrainHeightWilds2(s.player.x, s.player.y) : getTerrainHeight(s.player.x, s.player.y);
    s.playerMesh.position.x = s.player.x;
    s.playerMesh.position.z = s.player.y;
    s.playerMesh.position.y = 15 + terrainH;
  }

  if (s.petMesh) {
    s.petMesh.setEnabled(true);
  }

  const initAngle = Math.atan2(s.player.facingX, s.player.facingY);
  if (s.camera) {
    s.camera.position.x = s.player.x - Math.sin(initAngle) * s.cameraOffsetZ;
    s.camera.position.y = s.cameraOffsetY;
    s.camera.position.z = s.player.y - Math.cos(initAngle) * s.cameraOffsetZ;
    s.camera.setTarget(new Vector3(s.player.x, s.cameraLookAtY, s.player.y));
  }

  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent =
    targetScene === 'wilds' ? '🌍 Welcome to The Wilds!' :
    targetScene === 'wilds2' ? '🏜️ Welcome to Scorched Dunes!' :
    '🏘️ Welcome to Hometown';
}

export function usePotion(): boolean {
  const s = state;
  if (!s.inventory || s.inventory['health_potion'] <= 0) return false;

  if (s.player.hp >= s.player.maxHp) return false;

  s.inventory['health_potion']--;
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + 30);
  spawnParticles(s.player.x, s.player.y, 0x44ff44, 8, 'heal');
  (s as any).msg?.('💚 Potion dipakai. HP +30');
  (s as any).flashHeal?.();
  return true;
}

export function autoUsePotions(): void {
  const s = state;
  if (s.player.hp <= (s.player.maxHp * s.autoHealThreshold) / 100) {
    usePotion();
  }
  if (s.player.stamina <= (s.player.maxStamina * s.autoSPThreshold) / 100) {
    useConsumable('stamina_potion');
  }
}

export function useConsumable(itemId: string): void {
  const s = state;
  const now = Date.now();
  if (now - s.lastCrystalUse < 800) return;

  if (!s.inventory || !s.inventory[itemId]) return;

  if (itemId === 'stamina_potion') {
    if (s.player.stamina >= s.player.maxStamina) return;
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    s.player.stamina = Math.min(s.player.maxStamina, s.player.stamina + 50);
    spawnParticles(s.player.x, s.player.y, 0x88ccff, 6, 'heal');
    (s as any).msg?.('💙 Stamina Potion dipakai. SP +50');
    (s as any).flashHeal?.();
    return;
  }

  if (itemId === 'antidote') {
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    s.player.statusEffect = null;
    spawnParticles(s.player.x, s.player.y, 0x44ff88, 6, 'heal');
    (s as any).msg?.('🌿 Antidote dipakai. Efek negatif dihapus');
    (s as any).flashHeal?.();
    return;
  }

  if (itemId === 'cooling_tea') {
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    const boost = s.upgrades.spdLevel;
    s.player.speed = 4.5 + boost * 0.4;
    spawnParticles(s.player.x, s.player.y, 0x44ccff, 6, 'heal');
    (s as any).msg?.('🍵 Cooling Tea dipakai. Kecepatan +');
    (s as any).flashHeal?.();
    return;
  }

  if (itemId === 'health_crystal') {
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    s.player.hp = s.player.maxHp;
    s.player.stamina = s.player.maxStamina;
    spawnParticles(s.player.x, s.player.y, 0xff44ff, 10, 'heal');
    (s as any).msg?.('💎 Health Crystal dipakai. HP & SP penuh');
    (s as any).flashHeal?.();
    return;
  }
}
