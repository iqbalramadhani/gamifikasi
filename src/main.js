// ─── The Lost Kingdom 3D — main entry point ──────────────────────────────────
// Thin orchestrator that wires together the modular subsystems.
// All game logic lives in src/*.js; this file only bootstraps and exposes
// the handful of globals the HTML markup (onclick attributes) still calls.

import * as THREE from 'three';

// Subsystem modules
import { state } from './state.js';
import { loadAllModels, loadedModels } from './model-loader.js';
import { initSetup, initMap, initHometown, initEntities, initNPCs, initWildsNPCs, initWilds2, getTerrainHeight, getTerrainHeightWilds2 } from './scenes.js';
import { spawnBoss, spawnParticles, checkItems, blocked } from './helpers.js';
import { spawnEnemy, spawnEnemy2, usePotion } from './combat.js';
import {
  move, attack, updateProjectiles, updateEnemies, updateBoss,
} from './combat.js';
import {
  updateUI, checkInteractions,
  openShop, closeShop, buyPotion, buyInventoryItem, buyMysteryBox,
  openBlacksmith, closeBlacksmith, updateBlacksmithUI, buyWeapon, buyArmor, buyHelmet, buyBoots,
  levelUp, openStats, closeStats, addStat,
  openQuestBoard, acceptQuest, claimQuest, closeQuestBoard, updateQuestUI,
  openInventory, closeInventory, updateInventoryUI, sellAllLoot,
  openTutorial, closeTutorial, useConsumable,
  openFullMap, closeFullMap,
} from './ui.js';
import { updateWeather, updateParticles, updatePet, teleportTo } from './environment.js';
window.teleportTo = teleportTo;
import { saveGame, loadGame } from './persistence.js';

let autoSaveTimer = 0;
const AUTO_SAVE_INTERVAL = 1800;

// FPS counter
let _fpsFrames = 0;
let _fpsTime = 0;
window._fpsDisplay = document.getElementById('fps');

// Re-export loadedModels and THREE on window so inline handlers / fallback code
// can still reference them (backward-compat with the old monolithic file).
window.loadedModels = loadedModels;
window.THREE = THREE;
window.keys = state.keys;

// Camera preset getters/setters for the settings UI
window.cameraOffsetY = state.cameraOffsetY;
window.cameraOffsetZ = state.cameraOffsetZ;
window.cameraLookAtY = state.cameraLookAtY;

// Make a few helpers available on window for backward compat with onclicks
window.spawnEnemy = spawnEnemy;
window.spawnEnemy2 = spawnEnemy2;
window.spawnParticles = spawnParticles;
window.spawnBoss = spawnBoss;
window.usePotion = usePotion;
window.levelUp = levelUp;
window.openShop = openShop;
window.closeShop = closeShop;
window.buyPotion = buyPotion;
window.buyInventoryItem = buyInventoryItem;
window.buyMysteryBox = buyMysteryBox;
window.openBlacksmith = openBlacksmith;
window.closeBlacksmith = closeBlacksmith;
window.buyWeapon = buyWeapon;
window.buyArmor = buyArmor;
window.buyHelmet = buyHelmet;
window.buyBoots = buyBoots;
window.openStats = openStats;
window.closeStats = closeStats;
window.addStat = addStat;
window.openQuestBoard = openQuestBoard;
window.acceptQuest = acceptQuest;
window.claimQuest = claimQuest;
window.closeQuestBoard = closeQuestBoard;
window.updateQuestUI = updateQuestUI;
window.openInventory = openInventory;
window.closeInventory = closeInventory;
window.updateInventoryUI = updateInventoryUI;
window.sellAllLoot = sellAllLoot;
window.updateUI = updateUI;
window.openTutorial = openTutorial;
window.closeTutorial = closeTutorial;
window.useConsumable = useConsumable;
window.openFullMap = openFullMap;
window.closeFullMap = closeFullMap;
window.playerBodyMat = null;
window.playerBladeMat = null;


// ─── Game lifecycle ────────────────────────────────────────────────────────────

window.startGame = async () => {
  await loadAllModels();
  if (state.isGameStarted) return;
  state.isGameStarted = true;
  document.getElementById('main-menu').style.display = 'none';

  initSetup();
  initHometown();
  initEntities();
  initNPCs();

  if (state.currentScene === 'wilds') {
    if (!state.wildsLoaded) {
      initMap();
      initWildsNPCs();
      state.wildsLoaded = true;
    }
    if (state.hometownGroup) state.hometownGroup.visible = false;
    if (state.wilds2Group) state.wilds2Group.visible = false;
    if (state.wildsGroup) state.wildsGroup.visible = true;
    if (state.mainFloor) state.mainFloor.visible = true;
  } else if (state.currentScene === 'wilds2') {
    if (!state.wilds2Loaded) {
      initWilds2();
      state.wilds2Loaded = true;
    }
    if (state.hometownGroup) state.hometownGroup.visible = false;
    if (state.wildsGroup) state.wildsGroup.visible = false;
    if (state.wilds2Group) state.wilds2Group.visible = true;
    if (state.mainFloor) state.mainFloor.visible = false; // desert: hide grass floor
  } else {
    if (state.wildsGroup) state.wildsGroup.visible = false;
    if (state.wilds2Group) state.wilds2Group.visible = false;
    if (state.hometownGroup) state.hometownGroup.visible = true;
    if (state.mainFloor) state.mainFloor.visible = true;
  }

  // Setelah semua model siap, aktifkan aura senjata jika ada pending dari loadGame
  if (state._pendingEquipWeapon !== undefined && state.playerSwordMesh) {
    const idx = state._pendingEquipWeapon;
    state._pendingEquipWeapon = undefined;
    if (typeof window.equipWeapon === 'function') window.equipWeapon(idx);
  }

  // Sinkronkan UI awal (termasuk tombol heal / potion)
  const navPotionsEl = document.getElementById('nav-potions');
  if (navPotionsEl) navPotionsEl.textContent = state.potions;
  const btnPotion = document.getElementById('btn-potion');
  if (btnPotion) {
    btnPotion.textContent = `🧪 Heal (C) [${state.potions}]`;
    btnPotion.style.opacity = state.potions > 0 ? '1.0' : '0.5';
  }
  if (typeof updateUI === 'function') updateUI(true);

  gameLoop();
};

window.togglePause = () => {
  if (!state.isGameStarted || state.gameOver) return;
  state.isPaused = !state.isPaused;
  document.getElementById('pause-menu').style.display = state.isPaused ? 'flex' : 'none';
};

window.openSettings = () => { document.getElementById('settings-menu').style.display = 'flex'; };
window.closeSettings = () => { document.getElementById('settings-menu').style.display = 'none'; };
window.updateCameraSettings = () => {
  state.cameraOffsetY = parseInt(document.getElementById('cam-y').value);
  state.cameraOffsetZ = parseInt(document.getElementById('cam-z').value);
  state.cameraLookAtY = parseInt(document.getElementById('cam-look').value);
  window.cameraOffsetY = state.cameraOffsetY;
  window.cameraOffsetZ = state.cameraOffsetZ;
  window.cameraLookAtY = state.cameraLookAtY;
  document.getElementById('val-cam-y').innerText = state.cameraOffsetY;
  document.getElementById('val-cam-z').innerText = state.cameraOffsetZ;
  document.getElementById('val-cam-look').innerText = state.cameraLookAtY;
};

// Wire save/load to buttons in the HUD
window.saveGame = saveGame;
window.loadGame = loadGame;

// ─── Main loop ─────────────────────────────────────────────────────────────────

function gameLoop(timestamp) {
  const dt = state.lastTimestamp
    ? Math.min((timestamp - state.lastTimestamp) / 16.667, 3)
    : 1;
  state.lastTimestamp = timestamp;

  // FPS counter
  _fpsFrames++;
  _fpsTime += dt;
  if (_fpsTime >= 60) {
    const fps = Math.round(_fpsFrames / (_fpsTime / 60));
    if (window._fpsDisplay) window._fpsDisplay.textContent = fps;
    _fpsFrames = 0;
    _fpsTime = 0;
  }

  if (!state.isGameStarted) return;

  if (!state.gameOver) {
    if (state.isPaused) {
      if (state.composer) state.composer.render();
      else state.renderer.render(state.scene, state.camera);
      requestAnimationFrame(gameLoop);
      return;
    }

    state.player.defending = !!state.keys['shift'] && state.player.stamina > 0;
    if (state.player.defending) {
      state.player.stamina -= 0.5 * dt;
    } else {
      state.player.stamina = Math.min(state.player.maxStamina, state.player.stamina + 0.3 * dt);
    }
    if (state.shieldMesh) state.shieldMesh.visible = state.player.defending;

    if (state.keys['q']) state.cameraAngle += 0.04 * dt;
    if (state.keys['e']) state.cameraAngle -= 0.04 * dt;

    if (state.tabCooldown > 0) state.tabCooldown -= dt;
    if (state.keys['tab'] && state.tabCooldown <= 0) {
      state.tabCooldown = 30;
      if (state.lockedEnemy) {
        state.lockedEnemy = null;
      } else {
        let closest = null;
        let minDist = 1500;
        for (let e of state.enemies) {
          const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
          if (d < minDist) { minDist = d; closest = e; }
        }
        if (state.bossActive) {
          const d = Math.hypot(state.bossX - state.player.x, state.bossY - state.player.y);
          if (d < minDist) { closest = { isBoss: true, x: state.bossX, y: state.bossY }; }
        }
        state.lockedEnemy = closest;
      }
    }

    if (state.lockedEnemy) {
      if (!state.lockedEnemy.isBoss && !state.enemies.includes(state.lockedEnemy)) {
        state.lockedEnemy = null;
      } else if (state.lockedEnemy.isBoss && !state.bossActive) {
        state.lockedEnemy = null;
      } else {
        if (state.lockedEnemy.isBoss) {
          state.lockedEnemy.x = state.bossX;
          state.lockedEnemy.y = state.bossY;
        }
        state.cameraAngle = Math.atan2(state.lockedEnemy.x - state.player.x, state.lockedEnemy.y - state.player.y);
      }
    }

    if (state.keys['v'] && state.player.height === 0 && state.player.stamina >= 15) {
      state.player.stamina -= 15;
      state.player.heightVelocity = 9;
    }
    if (state.player.height > 0 || state.player.heightVelocity !== 0) {
      state.player.height += state.player.heightVelocity * dt;
      state.player.heightVelocity -= 1.2 * dt;
      if (state.player.height <= 0) {
        state.player.height = 0;
        if (state.player.heightVelocity < -5) state.cameraShake = Math.max(state.cameraShake, 6);
        state.player.heightVelocity = 0;
      }
    }
    // Anti-stuck: Jika pemain terjebak dalam obstacle (misal load dari save lama), dorong perlahan
    if (blocked(state.player.x, state.player.y, state.player.r)) {
      state.player.y += 10 * dt;
    }

    move(dt);
    if (state.keys[' ']) attack();

    state.player.attackCooldown = Math.max(0, state.player.attackCooldown - dt);
    state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
    state.player.spinCooldown = Math.max(0, state.player.spinCooldown - dt);
    state.player.tripleCooldown = Math.max(0, state.player.tripleCooldown - dt);

    if (state.player.isSpinning > 0) {
      state.player.isSpinning -= dt;
      state.player.spinAngle += 0.5 * dt;
    } else {
      state.player.spinAngle = 0;
    }

    if (state.player.isTripling > 0) {
      state.player.isTripling -= dt;
    }

    updateProjectiles(dt);
    updateEnemies(dt);
    if (state.bossActive) {
      updateBoss(dt);
    } else {
      // Auto-spawn boss jika pemain mendekati lokasinya
      if (state.currentScene === 'wilds') {
        if (Math.hypot(state.player.x - 19000, state.player.y - 19000) < 800) spawnBoss();
      } else if (state.currentScene === 'wilds2') {
        if (Math.hypot(state.player.x - 10000, state.player.y - 10000) < 1200) spawnBoss();
      }
    }

    // Player status effects
    if (state.player.statusEffect && state.player.statusEffect.duration > 0) {
      state.player.statusEffect.duration -= dt;
      state.player.statusEffect.tickTimer -= dt;
      if (state.player.statusEffect.tickTimer <= 0) {
        state.player.hp -= state.player.statusEffect.damage;
        spawnDamageText(state.player.x, 30, state.player.y, `-${state.player.statusEffect.damage}`,
          state.player.statusEffect.type === 'poison' ? '#00ff00' : '#ff4400');
        state.player.statusEffect.tickTimer = state.player.statusEffect.duration > 0 ?
          (state.player.statusEffect.type === 'poison' ? 60 : 60) : 0;
        spawnParticles(state.player.x, state.player.y,
          state.player.statusEffect.type === 'poison' ? 0x00ff00 : 0xff4400, 2, 'hit');
        if (state.player.hp <= 0) {
          teleportToHometown('Anda pingsan! Terlempar kembali ke Kota.');
        }
      }
      if (state.player.statusEffect.duration <= 0) {
        state.player.statusEffect = null;
      }
    }

    checkInteractions();
    updateWeather(dt);
    updateParticles(dt);
    updatePet(dt);
    checkItems();
    updateUI();
    autoSaveTimer += dt;
    if (autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      autoSaveTimer = 0;
      saveGame(true);
    }
  }

  if (state.playerMixer) {
    state.playerMixer.update(dt * 0.016667);
  }

  // ── Smooth player mesh follow ──────────────────────────────────────────────
  const isTripling = state.player.isTripling > 0;
  const breathOffset = state.playerMixer ? 0 : Math.sin(state.playerIdleBreath) * 0.8;
  const isMoving = !isTripling && (state.player.facingX !== 0 || state.player.facingY !== 0);
  const terrainY = state.currentScene === 'wilds2'
    ? getTerrainHeightWilds2(state.player.x, state.player.y)
    : getTerrainHeight(state.player.x, state.player.y);
  const basePlayerY = 15 + state.player.height + terrainY;
  const targetPlayerY = (isMoving && !state.playerMixer)
    ? basePlayerY + Math.abs(Math.sin(state.player.walkCycle * 2)) * 1.5
    : basePlayerY + breathOffset;
  if (!isTripling) {
    state.playerMesh.position.y += (targetPlayerY - state.playerMesh.position.y) * Math.min(dt * 12, 1);
    state.playerMesh.position.x += (state.player.x - state.playerMesh.position.x) * Math.min(dt * 10, 1);
    state.playerMesh.position.z += (state.player.y - state.playerMesh.position.z) * Math.min(dt * 10, 1);
  }
  state.playerIdleBreath += 0.03 * dt;

  // Character always faces forward, plus any accumulated spin
  state.playerMesh.rotation.y = -Math.PI / 2 + state.player.spinAngle;

  if (state.playerHpGroup) {
    state.playerHpGroup.position.set(state.playerMesh.position.x, state.playerMesh.position.y + 40, state.playerMesh.position.z);
    state.playerHpGroup.lookAt(state.camera.position);
    const hpPercent = Math.max(0, state.player.hp / state.player.maxHp);
    if (state.playerHpFg) {
      state.playerHpFg.scale.x = Math.max(0.001, hpPercent);
      state.playerHpFg.position.x = -(30 - (30 * hpPercent)) / 2;
    }
  }

  if (state.playerMixer) {
    // Model 3D sungguhan, jangan dimirror (flip scale Z), cukup rotate Y
    state.playerMesh.scale.z = 1;
  } else {
    // Legacy 2.5D untuk model balok
    if (state.player.facingX < 0) {
      state.playerMesh.scale.z = -1; // facing left
    }
    // facing right atau diam = default scale.z = 1
  }

  // Keep last facing when still
  if (state.player.facingX === 0 && state.player.facingY === 0) {
    state.player.facingX = state.lastFacingX;
    state.player.facingY = state.lastFacingY;
  } else {
    state.lastFacingX = state.player.facingX;
    state.lastFacingY = state.player.facingY;
  }

// ── Chase camera — simple follow behind player ───────────────────────
// Camera stays behind the player (negative Z direction) and looks at the player.
const idealX = state.player.x - Math.sin(state.cameraAngle) * state.cameraOffsetZ;
const idealZ = state.player.y - Math.cos(state.cameraAngle) * state.cameraOffsetZ; // offset behind
const idealY = state.cameraOffsetY;
const smooth = Math.min(dt * 6, 1);
state.camera.position.x += (idealX - state.camera.position.x) * smooth;
state.camera.position.y += (idealY - state.camera.position.y) * smooth;
state.camera.position.z += (idealZ - state.camera.position.z) * smooth;
state.camera.lookAt(state.player.x, state.cameraLookAtY, state.player.y);

if (state.cameraShake > 0) {
  state.camera.position.x += (Math.random() - 0.5) * state.cameraShake;
  state.camera.position.y += (Math.random() - 0.5) * state.cameraShake;
  state.camera.position.z += (Math.random() - 0.5) * state.cameraShake;
  state.cameraShake -= dt * 1.5;
  if (state.cameraShake < 0) state.cameraShake = 0;
}

if (state.dirLight) {
  state.dirLight.position.x = state.player.x + 300;
  state.dirLight.position.z = state.player.y - 200;
  state.dirLight.target.position.set(state.player.x, 0, state.player.y);
  state.dirLight.target.updateMatrixWorld();
}



  // Shield spin when defending
  if (state.player.defending && state.shieldMesh) {
    state.shieldMesh.rotation.y += 0.05;
    state.shieldMesh.rotation.x += 0.02;
  }

  // Animate collectible items
  state.coinItems.forEach(item => { if (!item.taken) item.mesh.rotation.z += 0.05 * dt; });
  state.expOrbs.forEach(item => { if (!item.taken) item.mesh.rotation.y += 0.05 * dt; });
  state.potionItems.forEach(item => { if (!item.taken) item.mesh.rotation.y += 0.05 * dt; });

  // Render
  if (state.composer) state.composer.render();
  else state.renderer.render(state.scene, state.camera);

  requestAnimationFrame(gameLoop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

window.onload = () => {
  document.getElementById('main-menu').style.display = 'flex';
  loadGame(); // Attempt to restore previous session
};
