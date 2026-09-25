import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { state } from './state.js';
import { mapSize, enemyTemplates } from './constants.js';
import { loadedModels } from './model-loader.js';
import { playSound } from './audio.js';

// ─── Collision / spawner helpers ──────────────────────────────────────────────

/** Axis-aligned + obstacle circle collision check. */
export function blocked(x, y, r = state.player.r) {
  const s = state;
  if (s.currentScene === 'hometown') {
    if (x - r < 9700 || x + r > 10300 || y - r < 9700 || y + r > 10300) return true;
  } else {
    if (x - r < 0 || x + r > mapSize || y - r < 0 || y + r > mapSize) return true;
  }
  for (let i = 0; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    const dx = o.x - x, dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) return true;
  }
  return false;
}

// ─── Item pickup check ────────────────────────────────────────────────────────

export function checkItems() {
  const s = state;

  s.crystalItems.forEach(item => {
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < 28) {
      item.taken = true;
      item.mesh.visible = false;
      s.crystalCount++;
      playSound('coin');
      document.getElementById('message').textContent =
        `💎 Crystal ditemukan! ${s.crystalCount}/${s.crystalGoal}`;
      if (s.crystalCount === s.crystalGoal) spawnBoss();
      if (typeof window.saveGame === 'function') window.saveGame(true);
    }
  });

  s.lootDrops.forEach(drop => {
    if (!drop.taken) {
      // Float + spin animation
      drop.mesh.rotation.y += 0.05;
      drop.mesh.position.y = 5 + Math.sin(Date.now() / 400 + drop.x) * 2;

      if (Math.hypot(s.player.x - drop.x, s.player.y - drop.y) < 40) {
        drop.taken = true;
        s.scene.remove(drop.mesh);
        playSound('coin');

        if (drop.type === 'potion') {
          s.potions++;
          const btn = document.getElementById('btn-potion');
          if (btn) btn.textContent = `🧪 Heal (C) [${s.potions}]`;
          const msgEl = document.getElementById('message');
          if (msgEl) msgEl.textContent = `🧪 Potion didapat! (${s.potions} tersisa)`;
          spawnDamageText(drop.x, 30, drop.y, '+1 Potion', '#ff4444');
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
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < s.player.r + 15) {
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
      if (s.potions < 3) {
        item.taken = true;
        item.mesh.visible = false;
        s.potions++;
        playSound('coin');
        const btn = document.getElementById('btn-potion');
        if (btn) btn.textContent = `🧪 Heal (C) [${s.potions}]`;
      }
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
  document.getElementById('message').textContent =
    '⚠️ THE GOLDEN GOLEM TELAH BANGKIT! Kalahkan dia untuk menang!';

  const bGeo = new THREE.BoxGeometry(60, 60, 60);
  const bMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
  s.bossMesh = new THREE.Mesh(bGeo, bMat);

  s.bossX = mapSize / 2;
  s.bossY = mapSize / 2;
  s.bossMesh.position.set(s.bossX, 30, s.bossY);
  s.scene.add(s.bossMesh);

  s.bossHpGroup = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 8),
    new THREE.MeshBasicMaterial({ color: 0x222222 })
  );
  s.bossHpFg = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 8),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  s.bossHpFg.position.z = 0.2;
  s.bossHpGroup.add(bg, s.bossHpFg);
  s.scene.add(s.bossHpGroup);

  // Destroy the altar crystal
  if (s.altarCrystal) s.scene.remove(s.altarCrystal);
}
