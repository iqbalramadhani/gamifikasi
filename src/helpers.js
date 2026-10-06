import * as BABYLON from "babylonjs";
import { state } from "./state.js";
import { mapSize, enemyTemplates } from "./constants.js";
import { loadedModels, createEnemyMixer, ESMTransformNode } from "./model-loader.js";
import { playSound } from "./audio.js";

// ─── Collision / spawner helpers ──────────────────────────────────────────────

/** Axis-aligned + obstacle circle collision check. */
export function blocked(x, y, r = state.player.r) {
  const s = state;
  const isHometown = s.currentScene === "hometown";

  if (isHometown) {
    if (x - r < -100 || x + r > 1100 || y - r < -100 || y + r > 1100) return true;
  } else {
    if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }

  const obs = isHometown
    ? s.obstaclesHometown
    : (s.currentScene === "wilds2")
      ? s.obstaclesWilds2
      : s.obstaclesWilds;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.h !== undefined && o.h <= 20) continue;

    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    const dx = o.x - x, dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) return true;
  }
  return false;
}

// ─── Item pickup check ────────────────────────────────────────────────────────

export function checkItems() {
  const s = state;

  s.lootDrops.forEach(drop => {
    if (!drop.taken) {
      drop.mesh.rotation.y += 0.05;
      drop.mesh.position.y = 5 + Math.sin(Date.now() / 400 + drop.x) * 2;

      const pickupRadius = s.autoAttack ? 200 : 40;
      if (Math.hypot(s.player.x - drop.x, s.player.y - drop.y) < pickupRadius) {
        drop.taken = true;
        drop.mesh.setEnabled(false);
        playSound("coin");

        if (drop.type === "potion") {
          s.potions++;
          if (!s.inventory) s.inventory = {};
          s.inventory["health_potion"] = s.potions;
          const btn = document.getElementById("btn-potion");
          if (btn) {
            btn.textContent = `🧪 Heal (C) [${s.potions}]`;
            btn.style.opacity = "1.0";
          }
          const navPotionsEl = document.getElementById("nav-potions");
          if (navPotionsEl) navPotionsEl.textContent = s.potions;
          const msgEl = document.getElementById("message");
          if (msgEl) msgEl.textContent = `🧪 Potion didapat! (${s.potions} tersisa)`;
          spawnDamageText(drop.x, 30, drop.y, "+1 Potion", "#ff4444");
          if (typeof window.updateInventoryUI === "function") window.updateInventoryUI();
        } else if (drop.type === "gold" || drop.item?.id === "gold") {
          const goldAmount = drop.item?.value || 10;
          s.gold = (s.gold || 0) + goldAmount;
          const msgEl = document.getElementById("message");
          if (msgEl) msgEl.textContent = `🪙 +${goldAmount} Gold didapat!`;
          spawnDamageText(drop.x, 30, drop.y, `+${goldAmount} Gold`, "#ffd700");
          const goldEl = document.getElementById("gold");
          if (goldEl) goldEl.textContent = s.gold;
          const shopGoldEl = document.getElementById("shop-gold");
          if (shopGoldEl) shopGoldEl.textContent = s.gold;
          const blacksmithGoldEl = document.getElementById("blacksmith-gold");
          if (blacksmithGoldEl) blacksmithGoldEl.textContent = s.gold;
        } else {
          if (!s.inventory) s.inventory = {};
          if (!s.inventory[drop.item.id]) s.inventory[drop.item.id] = 0;
          s.inventory[drop.item.id]++;
          const msgEl = document.getElementById("message");
          if (msgEl) msgEl.textContent = `📦 ${drop.item.name} didapat! (x${s.inventory[drop.item.id]})`;
          spawnDamageText(drop.x, 30, drop.y, `+1 ${drop.item.name}`, "#ffff00");
        }
        if (typeof window.updateUI === "function") window.updateUI();
      }
    }
  });

  s.expOrbs.forEach(item => {
    const expPickupRadius = s.autoAttack ? 200 : s.player.r + 15;
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < expPickupRadius) {
      item.taken = true;
      item.mesh.setEnabled(false);
      s.player.exp += 10;
      playSound("coin");
      if (typeof window.levelUp === "function" && s.player.exp >= s.player.nextExp) {
        window.levelUp();
      }
    }
  });

  s.potionItems.forEach(item => {
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < s.player.r + 15) {
      item.taken = true;
      item.mesh.setEnabled(false);
      s.potions++;
      if (!s.inventory) s.inventory = {};
      s.inventory["health_potion"] = s.potions;
      playSound("coin");
      const btn = document.getElementById("btn-potion");
      if (btn) {
        btn.textContent = `🧪 Heal (C) [${s.potions}]`;
        btn.style.opacity = "1.0";
      }
      const navPotionsEl = document.getElementById("nav-potions");
      if (navPotionsEl) navPotionsEl.textContent = s.potions;
      if (typeof window.updateInventoryUI === "function") window.updateInventoryUI();
    }
  });
}

// ─── Particles (optimized with shared geometry pool) ────────────────────────────

const _particleGeometries = {
  small: null,
  medium: null,
  large: null,
};

function getOrCreateParticleMesh(size, x, y, z, color, scene) {
  const key = size === 3 ? "small" : size === 4 ? "medium" : "large";
  if (!_particleGeometries[key]) {
    _particleGeometries[key] = BABYLON.MeshBuilder.CreateBox("ptcl_" + key, { size }, scene);
  }
  const geo = _particleGeometries[key];
  const m = geo.clone("ptcl_inst_" + Math.random(), true);
  const mat = new BABYLON.StandardMaterial("ptcl_mat_" + Math.random(), scene);
  mat.diffuseColor = BABYLON.Color3.FromHexString(color);
  mat.emissiveColor = mat.diffuseColor.clone();
  mat.alpha = 1.0;
  m.material = mat;
  m.position.set(x, y, z);
  m.parent = scene.sceneMount;
  return m;
}

export function spawnParticles(x, y, color, count, type) {
  const s = state;
  if (!s.scene || !s.sceneMount) return;
  const cappedCount = Math.min(count, 8);
  const size = type === "dust" ? 4 : (type === "trail" ? 6 : 3);
  const py = type === "dust" ? 2 : 15;
  const decay = type === "dust" ? 0.05 : (type === "trail" ? 0.15 : 0.03);

  for (let i = 0; i < cappedCount; i++) {
    const hexColor = typeof color === "number"
      ? "0x" + color.toString(16).padStart(6, "0")
      : color;
    const mesh = getOrCreateParticleMesh(size, x + (Math.random() - 0.5) * 4, py, y + (Math.random() - 0.5) * 4, hexColor, s);
    s.particles.push({
      mesh,
      dx: type === "trail" ? 0 : (Math.random() - 0.5) * 6,
      dy: type === "trail" ? 0 : (Math.random() - 0.5) * 6,
      dz: type === "trail" ? 0 : ((Math.random() - 0.5) * 6 + (type === "heal" ? 3 : 0)),
      life: 1.0,
      decay,
    });
  }
}

export function spawnDamageText(x, y, z, text, color = "#ff0000") {
  const s = state;
  if (!s.camera || !s.scene) return;
  const worldPos = new BABYLON.Vector3(x, y, z);
  const viewMatrix = s.camera.viewportMatrix || s.camera.getViewport().matrix;
  const projected = BABYLON.Vector3.Project(worldPos, BABYLON.Matrix.Identity(), viewMatrix, s.camera.getProjectionMatrix());

  const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

  const el = document.createElement("div");
  el.textContent = text;
  el.style.position = "absolute";
  el.style.left = sx + "px";
  el.style.top = sy + "px";
  el.style.color = color;
  el.style.fontWeight = "bold";
  el.style.fontSize = "24px";
  el.style.textShadow = "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
  el.style.pointerEvents = "none";
  el.style.transition = "all 1s ease-out";
  el.style.transform = "translate(-50%, -50%)";
  el.style.zIndex = "1000";
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.top = (sy - 100) + "px";
    el.style.opacity = "0";
  }, 50);

  setTimeout(() => {
    el.remove();
  }, 1050);
}

// ─── Boss ─────────────────────────────────────────────────────────────────────

export function spawnBoss() {
  const s = state;
  if (s.bossActive) return;
  s.bossActive = true;
  playSound("boss_spawn");

  s.bossX = mapSize / 2;

  if (s.currentScene === "wilds2") {
    s.bossY = (mapSize / 2) + 1200;
    document.getElementById("message").textContent =
      "⚠️ ARENA CHAMPION TELAH BANGKIT! Kalahkan dia untuk menang!";

    if (loadedModels.arena_soldier) {
      const bModel = loadedModels.arena_soldier.clone("boss_arena_soldier", true, false);
      bModel.scaling.setAll(120);

      s.bossMesh = new ESMTransformNode("boss_arena_group", s.scene);
      s.bossMesh.parent = s.sceneMount;
      bModel.parent = s.bossMesh;

      if (loadedModels.arena_weapon_spear) {
        const spear = loadedModels.arena_weapon_spear.clone("boss_arena_spear", true, false);
        spear.scaling.setAll(150);
        spear.position.set(50, 50, 40);
        spear.rotation.x = Math.PI / 2;
        spear.rotation.y = -Math.PI / 8;
        spear.parent = s.bossMesh;
      }

      s.bossMesh.position.set(s.bossX, -5, s.bossY);

      const anim = createEnemyMixer("arena_soldier", bModel);
      s.bossMixer = anim.mixer;
      s.bossActions = anim.actions;
      s.bossCurrentAction = anim.currentAction;
    } else {
      s.bossMesh = BABYLON.MeshBuilder.CreateBox("boss_fallback_wilds2", { size: 60 }, s.scene);
      s.bossMesh.material = new BABYLON.StandardMaterial("boss_fallback_mat_wilds2", s.scene);
      s.bossMesh.material.diffuseColor = BABYLON.Color3.FromHexString("#cccccc");
      s.bossMesh.position.set(s.bossX, 30, s.bossY);
      s.bossMesh.parent = s.sceneMount;
    }
  } else {
    s.bossY = mapSize / 2;
    document.getElementById("message").textContent =
      "⚠️ THE GOLDEN GOLEM TELAH BANGKIT! Kalahkan dia untuk menang!";

    if (loadedModels.blob_green_spiky) {
      const bModel = loadedModels.blob_green_spiky.clone("boss_golem", true, false);
      bModel.scaling.setAll(40);
      bModel.position.y = -12;

      s.bossMesh = new ESMTransformNode("boss_golem_group", s.scene);
      s.bossMesh.parent = s.sceneMount;
      bModel.parent = s.bossMesh;
      s.bossMesh.position.set(s.bossX, 0, s.bossY);

      const anim = createEnemyMixer("blob_green_spiky", bModel);
      s.bossMixer = anim.mixer;
      s.bossActions = anim.actions;
      s.bossCurrentAction = anim.currentAction;
    } else {
      s.bossMesh = BABYLON.MeshBuilder.CreateBox("boss_fallback_wilds", { size: 60 }, s.scene);
      s.bossMesh.material = new BABYLON.StandardMaterial("boss_fallback_mat_wilds", s.scene);
      s.bossMesh.material.diffuseColor = BABYLON.Color3.FromHexString("#ffd700");
      s.bossMesh.position.set(s.bossX, 30, s.bossY);
      s.bossMesh.parent = s.sceneMount;
    }
  }

  s.bossHpGroup = new ESMTransformNode("boss_hp_group", s.scene);
  s.bossHpGroup.parent = s.sceneMount;

  const bg = BABYLON.MeshBuilder.CreateGround("boss_hp_bg", { width: 80, depth: 8 }, s.scene);
  const bgMat = new BABYLON.StandardMaterial("boss_hp_bg_mat", s.scene);
  bgMat.diffuseColor = BABYLON.Color3.FromHexString("#222222");
  bgMat.emissiveColor = bgMat.diffuseColor.clone();
  bgMat.disableLighting = true;
  bg.material = bgMat;
  bg.parent = s.bossHpGroup;

  s.bossHpFg = BABYLON.MeshBuilder.CreateGround("boss_hp_fg", { width: 80, depth: 8 }, s.scene);
  const fgMat = new BABYLON.StandardMaterial("boss_hp_fg_mat", s.scene);
  fgMat.diffuseColor = BABYLON.Color3.FromHexString("#880000");
  fgMat.emissiveColor = fgMat.diffuseColor.clone();
  fgMat.disableLighting = true;
  s.bossHpFg.material = fgMat;
  s.bossHpFg.position.z = 0.2;
  s.bossHpFg.parent = s.bossHpGroup;
}
