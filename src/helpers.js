import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';
import { mapSize, enemyTemplates } from './constants.js';
import { loadedModels, createEnemyMixer } from './model-loader.js';
import { playSound } from './audio.js';

// ─── Collision / spawner helpers ──────────────────────────────────────────────

/** Axis-aligned + obstacle circle collision check. */
export function blocked(x, y, r = state.player.r) {
  const s = state;
  const isHometown = s.currentScene === 'hometown';
  
  if (isHometown) {
    if (x - r < -100 || x + r > 1100 || y - r < -100 || y + r > 1100) return true;
  } else {
    if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }
  
  const obs = isHometown
    ? s.obstaclesHometown
    : (s.currentScene === 'wilds2')
      ? s.obstaclesWilds2
      : s.obstaclesWilds;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    // Abaikan objek kecil (setinggi lutut karakter atau lebih rendah)
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
      // Float + spin animation
      drop.mesh.rotation.y += 0.05;
      drop.mesh.position.y = 5 + Math.sin(Date.now() / 400 + drop.x) * 2;

      const pickupRadius = s.autoAttack ? 200 : 40;
      if (Math.hypot(s.player.x - drop.x, s.player.y - drop.y) < pickupRadius) {
        drop.taken = true;
        s.scene.remove(drop.mesh);
        playSound('coin');

        if (drop.type === 'potion') {
          s.potions++;
          if (!s.inventory) s.inventory = {};
          s.inventory['health_potion'] = s.potions;
          const btn = document.getElementById('btn-potion');
          if (btn) {
            btn.textContent = `🧪 Heal (C) [${s.potions}]`;
            btn.style.opacity = '1.0';
          }
          const navPotionsEl = document.getElementById('nav-potions');
          if (navPotionsEl) navPotionsEl.textContent = s.potions;
          const msgEl = document.getElementById('message');
          if (msgEl) msgEl.textContent = `🧪 Potion didapat! (${s.potions} tersisa)`;
          spawnDamageText(drop.x, 30, drop.y, '+1 Potion', '#ff4444');
          if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
        } else if (drop.type === 'gold' || drop.item?.id === 'gold') {
          const goldAmount = drop.item?.value || 10;
          s.gold = (s.gold || 0) + goldAmount;
          const msgEl = document.getElementById('message');
          if (msgEl) msgEl.textContent = `🪙 +${goldAmount} Gold didapat!`;
          spawnDamageText(drop.x, 30, drop.y, `+${goldAmount} Gold`, '#ffd700');
          const goldEl = document.getElementById('gold');
          if (goldEl) goldEl.textContent = s.gold;
          const shopGoldEl = document.getElementById('shop-gold');
          if (shopGoldEl) shopGoldEl.textContent = s.gold;
          const blacksmithGoldEl = document.getElementById('blacksmith-gold');
          if (blacksmithGoldEl) blacksmithGoldEl.textContent = s.gold;
        } else {
          if (!s.inventory) s.inventory = {};
          if (!s.inventory[drop.item.id]) s.inventory[drop.item.id] = 0;
          s.inventory[drop.item.id]++;
          const msgEl = document.getElementById('message');
          if (msgEl) msgEl.textContent = `📦 ${drop.item.name} didapat! (x${s.inventory[drop.item.id]})`;
          spawnDamageText(drop.x, 30, drop.y, `+1 ${drop.item.name}`, '#ffff00');
        }
        if (typeof window.updateUI === 'function') window.updateUI();
      }
    }
  });

  s.expOrbs.forEach(item => {
    const expPickupRadius = s.autoAttack ? 200 : s.player.r + 15;
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < expPickupRadius) {
      item.taken = true;
      item.mesh.visible = false;
      s.player.exp += 10;
      playSound('coin');
      if (typeof window.levelUp === 'function' && s.player.exp >= s.player.nextExp) {
        window.levelUp();
      }
    }
  });

  s.potionItems.forEach(item => {
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < s.player.r + 15) {
      item.taken = true;
      item.mesh.visible = false;
      s.potions++;
      if (!s.inventory) s.inventory = {};
      s.inventory['health_potion'] = s.potions;
      playSound('coin');
      const btn = document.getElementById('btn-potion');
      if (btn) {
        btn.textContent = `🧪 Heal (C) [${s.potions}]`;
        btn.style.opacity = '1.0';
      }
      const navPotionsEl = document.getElementById('nav-potions');
      if (navPotionsEl) navPotionsEl.textContent = s.potions;
      if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
    }
  });
}

// ─── Particles (optimized with shared geometry pool) ────────────────────────────

// Pre-created shared geometries to avoid per-frame allocations
const _particleGeometries = {
  small: new THREE.BoxGeometry(3, 3, 3),
  medium: new THREE.BoxGeometry(4, 4, 4),
  large: new THREE.BoxGeometry(6, 6, 6),
};

export function spawnParticles(x, y, color, count, type) {
  const s = state;
  if (!s.scene) return;
  // Cap particle count to prevent performance spikes
  const cappedCount = Math.min(count, 8);
  const sizeKey = type === 'dust' ? 'medium' : (type === 'trail' ? 'large' : 'small');
  const geo = _particleGeometries[sizeKey];
  const py = type === 'dust' ? 2 : (type === 'trail' ? 15 : 15);
  const decay = type === 'dust' ? 0.05 : (type === 'trail' ? 0.15 : 0.03);

  for (let i = 0; i < cappedCount; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + (Math.random() - 0.5) * 4, py, y + (Math.random() - 0.5) * 4);
    s.scene.add(mesh);
    s.particles.push({
      mesh,
      dx: type === 'trail' ? 0 : (Math.random() - 0.5) * 6,
      dy: type === 'trail' ? 0 : (Math.random() - 0.5) * 6,
      dz: type === 'trail' ? 0 : ((Math.random() - 0.5) * 6 + (type === 'heal' ? 3 : 0)),
      life: 1.0,
      decay,
    });
  }
}

export function spawnDamageText(x, y, z, text, color = '#ff0000') {
  const s = state;
  if (!s.camera) return;
  const pos = new THREE.Vector3(x, y, z);
  pos.project(s.camera);

  // Convert to screen coordinates
  const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'absolute';
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
  el.style.color = color;
  el.style.fontWeight = 'bold';
  el.style.fontSize = '24px';
  el.style.textShadow = '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
  el.style.pointerEvents = 'none';
  el.style.transition = 'all 1s ease-out';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.zIndex = '1000';
  document.body.appendChild(el);

  // Trigger animation
  setTimeout(() => {
    el.style.top = (sy - 100) + 'px';
    el.style.opacity = '0';
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
  playSound('boss_spawn');

  s.bossX = mapSize / 2;
  
  if (s.currentScene === 'wilds2') {
    s.bossY = (mapSize / 2) + 1200; // Spawn sangat jauh di depan piramida agar tidak tumpang tindih visual
    document.getElementById('message').textContent =
      '⚠️ ARENA CHAMPION TELAH BANGKIT! Kalahkan dia untuk menang!';
    
    if (loadedModels.arena_soldier) {
      const bModel = SkeletonUtils.clone(loadedModels.arena_soldier);
      // Bos Arena yang sangat besar
      bModel.scale.set(120, 120, 120);
      
      s.bossMesh = new THREE.Group();
      s.bossMesh.add(bModel);
      
      // Tambahkan tombak ke grup bos utama agar skalanya tidak bertabrakan
      if (loadedModels.arena_weapon_spear) {
        const spear = SkeletonUtils.clone(loadedModels.arena_weapon_spear);
        spear.scale.set(150, 150, 150); // Skala absolut
        spear.position.set(50, 50, 40); // Geser ke kanan (X) dan atas (Y)
        spear.rotation.x = Math.PI / 2; // Arahkan ke depan
        spear.rotation.y = -Math.PI / 8;
        s.bossMesh.add(spear);
      }
      
      s.bossMesh.position.set(s.bossX, -5, s.bossY);

      const anim = createEnemyMixer('arena_soldier', bModel);
      s.bossMixer = anim.mixer;
      s.bossActions = anim.actions;
      s.bossCurrentAction = anim.currentAction;
    } else {
      const bGeo = new THREE.BoxGeometry(60, 60, 60);
      const bMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
      s.bossMesh = new THREE.Mesh(bGeo, bMat);
      s.bossMesh.position.set(s.bossX, 30, s.bossY);
    }
  } else {
    s.bossY = mapSize / 2; // Default untuk Golden Golem
    document.getElementById('message').textContent =
      '⚠️ THE GOLDEN GOLEM TELAH BANGKIT! Kalahkan dia untuk menang!';
      
    if (loadedModels.blob_green_spiky) {
      const bModel = SkeletonUtils.clone(loadedModels.blob_green_spiky);
      bModel.scale.set(40, 40, 40);
      bModel.position.y = -12;
      // Beri kilau emas untuk Golden Golem
      bModel.traverse(child => {
        if (child.isMesh) {
          child.frustumCulled = false;
          if (child.material) {
            child.material = child.material.clone();
            child.material.color.setHex(0xffd700);
            if (child.material.emissive) {
              child.material.emissive.setHex(0x443300);
            }
          }
        }
      });
      s.bossMesh = new THREE.Group();
      s.bossMesh.add(bModel);
      s.bossMesh.position.set(s.bossX, 0, s.bossY);

      const anim = createEnemyMixer('blob_green_spiky', bModel);
      s.bossMixer = anim.mixer;
      s.bossActions = anim.actions;
      s.bossCurrentAction = anim.currentAction;
    } else {
      const bGeo = new THREE.BoxGeometry(60, 60, 60);
      const bMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
      s.bossMesh = new THREE.Mesh(bGeo, bMat);
      s.bossMesh.position.set(s.bossX, 30, s.bossY);
    }
  }

  s.scene.add(s.bossMesh);

  s.bossHpGroup = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 8),
    new THREE.MeshBasicMaterial({ color: 0x222222 })
  );
  s.bossHpFg = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 8),
    new THREE.MeshBasicMaterial({ color: 0x880000 })
  );
  s.bossHpFg.position.z = 0.2;
  s.bossHpGroup.add(bg, s.bossHpFg);
  s.scene.add(s.bossHpGroup);
}
