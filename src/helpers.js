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
    }
  });

  s.coinItems.forEach(item => {
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < 25) {
      item.taken = true;
      item.mesh.visible = false;
      s.gold++;
      playSound('coin');
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

// ─── Particles ────────────────────────────────────────────────────────────────

export function spawnParticles(x, y, color, count, type) {
  const s = state;
  if (!s.scene) return;
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const size = type === 'dust' ? 4 : 3;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    const py = type === 'dust' ? 2 : 15;
    mesh.position.set(x, py, y);
    s.scene.add(mesh);
    s.particles.push({
      mesh,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
      dz: (Math.random() - 0.5) * 6 + (type === 'heal' ? 3 : 0),
      life: 1.0,
      decay: type === 'dust' ? 0.05 : 0.03,
    });
  }
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
