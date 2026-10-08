// Collision / item pickup / particles / damage text / boss spawn
import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  Matrix,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { state } from './state';
import { mapSize } from './constants';
import { loadedModels, createEnemyMixer, UMDTransformNode } from './model-loader';
import { playSound } from './audio';
import type { ParticleInstance } from './types';

// ─── Collision / spawner helpers ──────────────────────────────────────────────

/** Axis-aligned + obstacle circle collision check. */
export function blocked(x: number, y: number, r: number = state.player.r): boolean {
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
    if (o.h !== undefined && o.h <= 20) continue;

    if (Math.abs(o.x - x) > o.r + r || Math.abs(o.y - y) > o.r + r) continue;
    const dx = o.x - x, dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) * (o.r + r)) return true;
  }
  return false;
}

// ─── Item pickup check ────────────────────────────────────────────────────────

export function checkItems(): void {
  const s = state;

  s.lootDrops.forEach(drop => {
    if (!drop.taken) {
      drop.mesh.rotation.y += 0.05;
      drop.mesh.position.y = 5 + Math.sin(Date.now() / 400 + drop.x) * 2;

      const pickupRadius = s.autoAttack ? 200 : 40;
      if (Math.hypot(s.player.x - drop.x, s.player.y - drop.y) < pickupRadius) {
        drop.taken = true;
        drop.mesh.setEnabled(false);
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
          if (navPotionsEl) navPotionsEl.textContent = String(s.potions);
          const msgEl = document.getElementById('message');
          if (msgEl) msgEl.textContent = `🧪 Potion didapat! (${s.potions} tersisa)`;
          spawnDamageText(drop.x, 30, drop.y, '+1 Potion', '#ff4444');
          if (typeof (window as any).updateInventoryUI === 'function') (window as any).updateInventoryUI();
        } else if (drop.type === 'gold' || drop.item?.id === 'gold') {
          const goldAmount = drop.item?.value || 10;
          s.gold = (s.gold || 0) + goldAmount;
          const msgEl = document.getElementById('message');
          if (msgEl) msgEl.textContent = `🪙 +${goldAmount} Gold didapat!`;
          spawnDamageText(drop.x, 30, drop.y, `+${goldAmount} Gold`, '#ffd700');
          const goldEl = document.getElementById('gold');
          if (goldEl) goldEl.textContent = String(s.gold);
          const shopGoldEl = document.getElementById('shop-gold');
          if (shopGoldEl) shopGoldEl.textContent = String(s.gold);
          const blacksmithGoldEl = document.getElementById('blacksmith-gold');
          if (blacksmithGoldEl) blacksmithGoldEl.textContent = String(s.gold);
        } else if (drop.item) {
          if (!s.inventory) s.inventory = {};
          if (!s.inventory[drop.item.id]) s.inventory[drop.item.id] = 0;
          s.inventory[drop.item.id]++;
          const msgEl = document.getElementById('message');
          if (msgEl) msgEl.textContent = `📦 ${drop.item.name} didapat! (x${s.inventory[drop.item.id]})`;
          spawnDamageText(drop.x, 30, drop.y, `+1 ${drop.item.name}`, '#ffff00');
        }
        if (typeof (window as any).updateUI === 'function') (window as any).updateUI();
      }
    }
  });

  s.expOrbs.forEach(item => {
    const expPickupRadius = s.autoAttack ? 200 : s.player.r + 15;
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < expPickupRadius) {
      item.taken = true;
      item.mesh.setEnabled(false);
      s.player.exp += 10;
      playSound('coin');
      if (typeof (window as any).levelUp === 'function' && s.player.exp >= s.player.nextExp) {
        (window as any).levelUp();
      }
    }
  });

  s.potionItems.forEach(item => {
    if (!item.taken && Math.hypot(s.player.x - item.x, s.player.y - item.y) < s.player.r + 15) {
      item.taken = true;
      item.mesh.setEnabled(false);
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
      if (navPotionsEl) navPotionsEl.textContent = String(s.potions);
      if (typeof (window as any).updateInventoryUI === 'function') (window as any).updateInventoryUI();
    }
  });
}

// ─── Particles (optimized with shared geometry pool) ──────────────────────────

const _particleGeometries: Record<string, Mesh | null> = {
  small: null,
  medium: null,
  large: null,
};

function getOrCreateParticleMesh(
  size: number,
  x: number,
  y: number,
  z: number,
  color: string,
  scene: Scene
): Mesh {
  const key = size === 3 ? 'small' : size === 4 ? 'medium' : 'large';
  if (!_particleGeometries[key]) {
    _particleGeometries[key] = MeshBuilder.CreateBox('ptcl_' + key, { size }, scene);
  }
  const geo = _particleGeometries[key]!;
  const m = geo.clone('ptcl_inst_' + Math.random(), true);
  const mat = new StandardMaterial('ptcl_mat_' + Math.random(), scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.emissiveColor = mat.diffuseColor.clone();
  mat.alpha = 1.0;
  m.material = mat;
  m.position.set(x, y, z);
  m.parent = (state as any).sceneMount;
  return m;
}

export function spawnParticles(
  x: number,
  y: number,
  color: number | string,
  count: number,
  type?: string
): void {
  const s = state;
  if (!s.scene || !s.sceneMount) return;
  const cappedCount = Math.min(count, 8);
  const size = type === 'dust' ? 4 : (type === 'trail' ? 6 : 3);
  const py = type === 'dust' ? 2 : 15;
  const decay = type === 'dust' ? 0.05 : (type === 'trail' ? 0.15 : 0.03);

  for (let i = 0; i < cappedCount; i++) {
    const hexColor = typeof color === 'number'
      ? '#' + color.toString(16).padStart(6, '0')
      : color;
    const mesh = getOrCreateParticleMesh(
      size,
      x + (Math.random() - 0.5) * 4,
      py,
      y + (Math.random() - 0.5) * 4,
      hexColor,
      s.scene
    );
    const p: ParticleInstance & { dead?: boolean } = {
      mesh,
      dx: type === 'trail' ? 0 : (Math.random() - 0.5) * 6,
      dy: type === 'trail' ? 0 : (Math.random() - 0.5) * 6,
      dz: type === 'trail' ? 0 : ((Math.random() - 0.5) * 6 + (type === 'heal' ? 3 : 0)),
      life: 1.0,
      decay,
    };
    s.particles.push(p as ParticleInstance);
  }
}

export function spawnDamageText(
  x: number,
  y: number,
  z: number,
  text: string,
  color = '#ff0000'
): void {
  const s = state;
  if (!s.camera || !s.scene) return;
  const worldPos = new Vector3(x, y, z);
  const engine = (s.camera.getEngine() as any);
  const transform = s.camera.getTransformationMatrix();
  const projected = Vector3.Project(
    worldPos,
    Matrix.Identity(),
    transform,
    s.camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
  );

  const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

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

  setTimeout(() => {
    el.style.top = (sy - 100) + 'px';
    el.style.opacity = '0';
  }, 50);

  setTimeout(() => {
    el.remove();
  }, 1050);
}

// ─── Boss ─────────────────────────────────────────────────────────────────────

export function spawnBoss(): void {
  const s = state;
  if (s.bossActive) return;
  s.bossActive = true;
  playSound('boss_spawn');

  s.bossX = mapSize / 2;

  if (s.currentScene === 'wilds2') {
    s.bossY = (mapSize / 2) + 1200;
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent =
      '⚠️ ARENA CHAMPION TELAH BANGKIT! Kalahkan dia untuk menang!';

    if (loadedModels.arena_soldier) {
      const bModel = loadedModels.arena_soldier.clone('boss_arena_soldier', true, false);
      bModel.scaling.setAll(120);

      s.bossMesh = new UMDTransformNode('boss_arena_group', s.scene);
      s.bossMesh.parent = s.sceneMount;
      bModel.parent = s.bossMesh;

      if (loadedModels.arena_weapon_spear) {
        const spear = loadedModels.arena_weapon_spear.clone('boss_arena_spear', true, false);
        spear.scaling.setAll(150);
        spear.position.set(50, 50, 40);
        spear.rotation.x = Math.PI / 2;
        spear.rotation.y = -Math.PI / 8;
        spear.parent = s.bossMesh;
      }

      s.bossMesh.position.set(s.bossX, -5, s.bossY);

      const anim = createEnemyMixer('arena_soldier', bModel);
      s.bossMixer = anim.mixer;
      s.bossActions = anim.actions;
      s.bossCurrentAction = anim.currentAction;
    } else {
      s.bossMesh = MeshBuilder.CreateBox('boss_fallback_wilds2', { size: 60 }, s.scene);
      s.bossMesh.material = new StandardMaterial('boss_fallback_mat_wilds2', s.scene);
      (s.bossMesh.material as StandardMaterial).diffuseColor = Color3.FromHexString('#cccccc');
      s.bossMesh.position.set(s.bossX, 30, s.bossY);
      s.bossMesh.parent = s.sceneMount;
    }
  } else {
    s.bossY = mapSize / 2;
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent =
      '⚠️ THE GOLDEN GOLEM TELAH BANGKIT! Kalahkan dia untuk menang!';

    if (loadedModels.blob_green_spiky) {
      const bModel = loadedModels.blob_green_spiky.clone('boss_golem', true, false);
      bModel.scaling.setAll(40);
      bModel.position.y = -12;

      s.bossMesh = new UMDTransformNode('boss_golem_group', s.scene);
      s.bossMesh.parent = s.sceneMount;
      bModel.parent = s.bossMesh;
      s.bossMesh.position.set(s.bossX, 0, s.bossY);

      const anim = createEnemyMixer('blob_green_spiky', bModel);
      s.bossMixer = anim.mixer;
      s.bossActions = anim.actions;
      s.bossCurrentAction = anim.currentAction;
    } else {
      s.bossMesh = MeshBuilder.CreateBox('boss_fallback_wilds', { size: 60 }, s.scene);
      s.bossMesh.material = new StandardMaterial('boss_fallback_mat_wilds', s.scene);
      (s.bossMesh.material as StandardMaterial).diffuseColor = Color3.FromHexString('#ffd700');
      s.bossMesh.position.set(s.bossX, 30, s.bossY);
      s.bossMesh.parent = s.sceneMount;
    }
  }

  s.bossHpGroup = new UMDTransformNode('boss_hp_group', s.scene);
  s.bossHpGroup.parent = s.sceneMount;

  const bg = MeshBuilder.CreateGround('boss_hp_bg', { width: 80, depth: 8 }, s.scene);
  const bgMat = new StandardMaterial('boss_hp_bg_mat', s.scene);
  bgMat.diffuseColor = Color3.FromHexString('#222222');
  bgMat.emissiveColor = bgMat.diffuseColor.clone();
  bgMat.disableLighting = true;
  bg.material = bgMat;
  bg.parent = s.bossHpGroup;

  s.bossHpFg = MeshBuilder.CreateGround('boss_hp_fg', { width: 80, depth: 8 }, s.scene);
  const fgMat = new StandardMaterial('boss_hp_fg_mat', s.scene);
  fgMat.diffuseColor = Color3.FromHexString('#880000');
  fgMat.emissiveColor = fgMat.diffuseColor.clone();
  fgMat.disableLighting = true;
  s.bossHpFg.material = fgMat;
  s.bossHpFg.position.z = 0.2;
  s.bossHpFg.parent = s.bossHpGroup;
}
