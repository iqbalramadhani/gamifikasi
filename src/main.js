// ─── The Lost Kingdom 3D — main entry point ──────────────────────────────────
// Thin orchestrator that wires together the modular subsystems.
// All game logic lives in src/*.js; this file only bootstraps and exposes
// the handful of globals the HTML markup (onclick attributes) still calls.

import * as THREE from 'three';

// Subsystem modules
import { state } from './state.js';
import { loadAllModels, loadedModels } from './model-loader.js';
import { initSetup, initMap, initHometown, initEntities, initNPCs } from './scenes.js';
import { spawnBoss, spawnParticles } from './helpers.js';
import { spawnEnemy, usePotion } from './combat.js';
import {
  move, shoot, updateProjectiles, updateEnemies, updateBoss,
} from './combat.js';
import {
  updateUI, checkInteractions,
  openShop, closeShop, buyUpgrade,
  openBlacksmith, closeBlacksmith, updateBlacksmithUI, buyWeapon, buyArmor,
  levelUp,
} from './ui.js';
import { updateWeather, updateParticles, updatePet, teleportTo } from './environment.js';
window.teleportTo = teleportTo;
import { saveGame, loadGame } from './persistence.js';

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
window.spawnParticles = spawnParticles;
window.spawnBoss = spawnBoss;
window.usePotion = usePotion;
window.levelUp = levelUp;
window.openShop = openShop;
window.closeShop = closeShop;
window.buyUpgrade = buyUpgrade;
window.openBlacksmith = openBlacksmith;
window.closeBlacksmith = closeBlacksmith;
window.buyWeapon = buyWeapon;
window.buyArmor = buyArmor;
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
  initMap();
  initEntities();
  initNPCs();

  gameLoop();
};

window.togglePause = () => {
  if (!state.isGameStarted || state.gameOver) return;
  state.isPaused = !state.isPaused;
  document.getElementById('pause-menu').style.display = state.isPaused ? 'flex' : 'none';
  if (!state.isPaused) gameLoop();
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

  if (!state.isGameStarted) return;

  if (!state.gameOver) {
    if (state.isPaused) {
      if (state.composer) state.composer.render();
      else state.renderer.render(state.scene, state.camera);
      requestAnimationFrame(gameLoop);
      return;
    }

    state.player.defending = !!state.keys['shift'];
    if (state.shieldMesh) state.shieldMesh.visible = state.player.defending;

    move(dt);
    if (state.keys[' ']) shoot();

    state.player.attackCooldown = Math.max(0, state.player.attackCooldown - dt);
    state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
    state.player.spinCooldown = Math.max(0, state.player.spinCooldown - dt);

    if (state.player.isSpinning > 0) {
      state.player.isSpinning -= dt;
      state.player.spinAngle += 0.5 * dt;
    } else {
      state.player.spinAngle = 0;
    }

    updateProjectiles(dt);
    updateEnemies(dt);
    if (state.bossActive) updateBoss(dt);
    checkInteractions();
    updateWeather(dt);
    updateParticles(dt);
    updatePet(dt);
    updateUI();
  }

  // ── Smooth player mesh follow ──────────────────────────────────────────────
  const breathOffset = Math.sin(state.playerIdleBreath) * 0.8;
  const isMoving = state.player.facingX !== 0 || state.player.facingY !== 0;
  const targetPlayerY = isMoving
    ? 15 + Math.abs(Math.sin(state.player.walkCycle * 2)) * 1.5
    : 15 + breathOffset;
  state.playerMesh.position.y += (targetPlayerY - state.playerMesh.position.y) * Math.min(dt * 8, 1);
  state.playerMesh.position.x += (state.player.x - state.playerMesh.position.x) * Math.min(dt * 10, 1);
  state.playerMesh.position.z += (state.player.y - state.playerMesh.position.z) * Math.min(dt * 10, 1);
  state.playerIdleBreath += 0.03 * dt;

  // Character always faces forward, plus any accumulated spin
  state.playerMesh.rotation.y = -Math.PI / 2 + state.player.spinAngle;

  // Flip left/right using scale.z (local Z = world X after -π/2 Y rotation)
  if (state.player.facingX < 0) {
    state.playerMesh.scale.z = -1; // facing left
  } else if (state.player.facingX > 0) {
    state.playerMesh.scale.z = -1;  // facing right
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
const idealX = state.player.x;
const idealZ = state.player.y - state.cameraOffsetZ; // offset behind
const idealY = state.cameraOffsetY;
const smooth = Math.min(dt * 6, 1);
state.camera.position.x += (idealX - state.camera.position.x) * smooth;
state.camera.position.y += (idealY - state.camera.position.y) * smooth;
state.camera.position.z += (idealZ - state.camera.position.z) * smooth;
state.camera.lookAt(state.player.x, state.cameraLookAtY, state.player.y);



  // Shield spin when defending
  if (state.player.defending && state.shieldMesh) {
    state.shieldMesh.rotation.y += 0.05;
    state.shieldMesh.rotation.x += 0.02;
  }

  // Animate collectible items
  state.crystalItems.forEach(item => { if (!item.taken) item.mesh.rotation.y += 0.05 * dt; });
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
