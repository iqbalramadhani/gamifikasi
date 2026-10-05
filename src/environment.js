import * as BABYLON from "babylonjs";
import { state } from "./state.js";
import { blocked, spawnParticles } from "./helpers.js";
import { mapSize, weaponList, armorList } from "./constants.js";
import { initWildsNPCs, initWilds2, getTerrainHeight, getTerrainHeightWilds2 } from "./scenes.js";

export function updateDayNightCycle() {
  const s = state;
  s.dayTime += 0.0008;
  const sunAngle = s.dayTime * 0.15;
  const sunIntensity = Math.sin(sunAngle);
  const brightness = Math.max(0.2, sunIntensity);

  if (s.scene) {
    const r = 0.35 + brightness * 0.5;
    const g = 0.50 + brightness * 0.35;
    const b = 0.70 + brightness * 0.25;
    s.scene.clearColor = new BABYLON.Color4(r, g, b, 1);
    s.scene.fogColor = new BABYLON.Color3(r, g, b);
  }

  if (s.dirLight) {
    s.dirLight.intensity = 0.5 + brightness;
  }
}

export function updateWeather() {
  const s = state;
  const isRaining = s.currentScene === "wilds" && Math.sin(s.dayTime * 0.01) > 0.3;

  if (s.rainParticles && s.rainParticles.isEnabled !== undefined) {
    s.rainParticles.isEnabled = isRaining;
    if (isRaining) s.rainParticles.emitRate = 500;
  }
}

export function updateParticles() {
  const s = state;

  // Weapon aura: per frame, update position + rotation to match player's weapon
  const weaponTier = weaponList[s.currentWeapon];
  const auraColor = s.currentWeapon === 0
    ? "#999999"
    : (weaponList[s.currentWeapon]?.color || "#ff0000");

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
      p.dead = true;
    }
  });

  s.particles = s.particles.filter(p => !p.dead);

  // Aura bursts (weapon slash VFX)
  if (s.auraBursts) {
    const children = s.auraBursts.getDescendants ? s.auraBursts.getDescendants() : [];
    for (const m of children) {
      if (m._burstLife !== undefined) {
        m._burstLife -= 0.08;
        m.scaling.setAll(Math.max(0, m._burstLife * m._burstBaseScale));
        if (m.material && m.material.alpha !== undefined) {
          m.material.alpha = m._burstLife;
        }
        if (m._burstLife <= 0) {
          m.setEnabled(false);
        }
      }
    }
  }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function updatePet() {
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

export function updateVillagers() {
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
        let nx = v.mesh.position.x + Math.sin(angle) * speed;
        let nz = v.mesh.position.z + Math.cos(angle) * speed;
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

export function teleportTo(targetScene) {
  const s = state;

  if (targetScene === "wilds" && !s.wildsLoaded) {
    initWildsNPCs();
    s.wildsLoaded = true;
  }

  if (targetScene === "wilds2" && !s.wilds2Loaded) {
    initWilds2();
    s.wilds2Loaded = true;
  }

  s.currentScene = targetScene;

  if (s.hometownGroup) s.hometownGroup.setEnabled(targetScene === "hometown");
  if (s.wildsGroup) s.wildsGroup.setEnabled(targetScene === "wilds");
  if (s.wilds2Group) s.wilds2Group.setEnabled(targetScene === "wilds2");

  if (s.mainFloor) s.mainFloor.setEnabled(targetScene !== "wilds2");

  if (targetScene === "hometown") {
    s.player.x = 500;
    s.player.y = 500;
  } else if (targetScene === "wilds2") {
    s.player.x = 200;
    s.player.y = mapSize - 200;
  } else {
    s.player.x = s.player.x; // keep position in wilds
  }

  if (s.playerMesh) {
    const terrainH = targetScene === "wilds2" ? getTerrainHeightWilds2(s.player.x, s.player.y) : getTerrainHeight(s.player.x, s.player.y);
    s.playerMesh.position.x = s.player.x;
    s.playerMesh.position.z = s.player.y;
    s.playerMesh.position.y = 15 + terrainH;
  }

  if (s.petMesh) {
    s.petMesh.setEnabled(true);
  }

  // Reset camera to follow player at new position
  const s2 = state;
  const initAngle = Math.atan2(s2.player.facingX, s2.player.facingY);
  if (s.camera) {
    s.camera.position.x = s2.player.x - Math.sin(initAngle) * s2.cameraOffsetZ;
    s.camera.position.y = s2.cameraOffsetY;
    s.camera.position.z = s2.player.y - Math.cos(initAngle) * s2.cameraOffsetZ;
    s.camera.setTarget(new BABYLON.Vector3(s2.player.x, s2.cameraLookAtY, s2.player.y));
  }

  document.getElementById("message").textContent =
    targetScene === "wilds" ? "🌍 Welcome to The Wilds!" :
    targetScene === "wilds2" ? "🏜️ Welcome to Scorched Dunes!" :
    "🏘️ Welcome to Hometown";

  const msgEl = document.getElementById("message");
  if (msgEl) msgEl.textContent =
    targetScene === "wilds" ? "🌍 Welcome to The Wilds!" :
    targetScene === "wilds2" ? "🏜️ Welcome to Scorched Dunes!" :
    "🏘️ Welcome to Hometown";
}

export function usePotion() {
  const s = state;
  if (!s.inventory || s.inventory["health_potion"] <= 0) return false;

  if (s.player.hp >= s.player.maxHp) return false;

  s.inventory["health_potion"]--;
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + 30);
  spawnParticles(s.player.x, s.player.y, 0x44ff44, 8, "heal");
  s.msg("💚 Potion dipakai. HP +30");
  s.flashHeal();
  return true;
}

export function autoUsePotions() {
  const s = state;
  if (s.player.hp <= (s.player.maxHp * s.autoHealThreshold) / 100) {
    usePotion();
  }
  if (s.player.stamina <= (s.player.maxStamina * s.autoSPThreshold) / 100) {
    useConsumable("stamina_potion");
  }
}

export function useConsumable(itemId) {
  const s = state;
  const now = Date.now();
  if (now - s.lastCrystalUse < 800) return;

  if (!s.inventory || !s.inventory[itemId]) return;

  if (itemId === "stamina_potion") {
    if (s.player.stamina >= s.player.maxStamina) return;
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    s.player.stamina = Math.min(s.player.maxStamina, s.player.stamina + 50);
    spawnParticles(s.player.x, s.player.y, 0x88ccff, 6, "heal");
    s.msg("💙 Stamina Potion dipakai. SP +50");
    s.flashHeal();
    return;
  }

  if (itemId === "antidote") {
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    s.player.statusEffect = null;
    spawnParticles(s.player.x, s.player.y, 0x44ff88, 6, "heal");
    s.msg("🌿 Antidote dipakai. Efek negatif dihapus");
    s.flashHeal();
    return;
  }

  if (itemId === "cooling_tea") {
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    const boost = s.upgrades.spdLevel;
    s.player.speed = 4.5 + boost * 0.4;
    spawnParticles(s.player.x, s.player.y, 0x44ccff, 6, "heal");
    s.msg("🍵 Cooling Tea dipakai. Kecepatan +");
    s.flashHeal();
    return;
  }

  if (itemId === "health_crystal") {
    s.inventory[itemId]--;
    s.lastCrystalUse = now;
    s.player.hp = s.player.maxHp;
    s.player.stamina = s.player.maxStamina;
    spawnParticles(s.player.x, s.player.y, 0xff44ff, 10, "heal");
    s.msg("💎 Health Crystal dipakai. HP & SP penuh");
    s.flashHeal();
    return;
  }
}
