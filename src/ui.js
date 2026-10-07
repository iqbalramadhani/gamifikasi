import * as BABYLON from "babylonjs";
import { state } from './state.js';
import { mapSize, weaponList, armorList, helmetList, bootList, lootTable, consumableItems, WILDS2_MIN_LEVEL } from './constants.js';
import { playSound } from './audio.js';
import { blocked, spawnParticles, checkItems } from './helpers.js';
import { updatePortalAnimations, getTerrainHeight, getTerrainHeightWilds2 } from './scenes.js';
import { UMDMesh, UMDTransformNode } from './model-loader.js';


// ─── UI throttled update ──────────────────────────────────────────────────────

let uiThrottle = 0;
let lastHp = -1, lastGold = -1, lastPotions = -1, lastSpPotions = -1;

export function updateUI(force = false) {
  checkItems();
  updateQuestUI();

  uiThrottle++;
  if (!force && uiThrottle % 6 !== 0) return; // Throttle to ~10 fps for DOM writes

  const s = state;
  const curHp = Math.ceil(s.player.hp);
  if (force || lastHp !== curHp) {
    const hpEl = document.getElementById('hp');
    if (hpEl) hpEl.textContent = `${curHp}/${s.player.maxHp}`;
    lastHp = curHp;
  }
  
  const atkEl = document.getElementById('atk');
  if (atkEl) atkEl.textContent = s.player.attackDamage;
  const critEl = document.getElementById('crit-chance');
  if (critEl) critEl.textContent = `${(s.critChance * 100).toFixed(1)}%`;
  
  const curStamina = Math.floor(s.player.stamina);
  const staminaTextEl = document.getElementById('stamina-text');
  const staminaBarEl = document.getElementById('stamina-bar');
  if (staminaTextEl) staminaTextEl.textContent = `${curStamina}/${s.player.maxStamina}`;
  if (staminaBarEl) staminaBarEl.style.width = `${Math.max(0, (curStamina / s.player.maxStamina) * 100)}%`;

  if (force || lastGold !== s.gold) {
    const goldEl = document.getElementById('gold');
    if (goldEl) goldEl.textContent = s.gold;
    lastGold = s.gold;
  }

  const navPotionsEl = document.getElementById('nav-potions');
  if (navPotionsEl && (force || lastPotions !== s.potions)) {
    navPotionsEl.textContent = s.potions;
  }

  const btnPotion = document.getElementById('btn-potion');
  if (btnPotion && (force || lastPotions !== s.potions)) {
    btnPotion.textContent = `🧪 Heal (C) [${s.potions}]`;
    btnPotion.style.opacity = s.potions > 0 ? '1.0' : '0.5';
    lastPotions = s.potions;
  }

  const spPotionsCount = s.inventory?.['stamina_potion'] || 0;
  const btnSpPotion = document.getElementById('btn-sp-potion');
  if (btnSpPotion && (force || lastSpPotions !== spPotionsCount)) {
    btnSpPotion.textContent = `⚡ SP (B) [${spPotionsCount}]`;
    btnSpPotion.style.opacity = spPotionsCount > 0 ? '1.0' : '0.5';
    lastSpPotions = spPotionsCount;
  }

  const expEl = document.getElementById('exp');
  const maxExpEl = document.getElementById('max-exp');
  const levelEl = document.getElementById('player-level');
  if (expEl) expEl.textContent = s.player.exp;
  if (maxExpEl) maxExpEl.textContent = s.player.nextExp;
  if (levelEl) levelEl.textContent = s.player.level;

  const btnDash = document.getElementById('btn-dash');
  if (btnDash) {
    if (s.player.dashCooldown > 0) {
      btnDash.style.opacity = '0.4';
      btnDash.textContent = `⏳ ${(s.player.dashCooldown / 60).toFixed(1)}s`;
    } else {
      btnDash.style.opacity = s.player.stamina >= 30 ? '1.0' : '0.5';
      btnDash.textContent = `⚡ Dash (Z)`;
    }
  }

  const btnSpin = document.getElementById('btn-spin');
  if (btnSpin) {
    if (s.player.spinCooldown > 0) {
      btnSpin.style.opacity = '0.4';
      btnSpin.textContent = `⏳ ${(s.player.spinCooldown / 60).toFixed(1)}s`;
    } else {
      btnSpin.style.opacity = s.player.stamina >= 50 ? '1.0' : '0.5';
      btnSpin.textContent = `🌀 Spin (X)`;
    }
  }

  const btnTriple = document.getElementById('btn-triple');
  if (btnTriple) {
    if (s.player.tripleCooldown > 0) {
      btnTriple.style.opacity = '0.4';
      btnTriple.textContent = `⏳ ${(s.player.tripleCooldown / 60).toFixed(1)}s`;
    } else {
      btnTriple.style.opacity = s.player.stamina >= 60 ? '1.0' : '0.5';
      btnTriple.textContent = `⚔️ Triple (R)`;
    }
  }

  const btnAuto = document.getElementById('btn-auto-attack');
  if (btnAuto) {
    btnAuto.textContent = s.autoAttack ? '⚔️ Auto (T): ON' : '⚔️ Auto (T): OFF';
    btnAuto.classList.toggle('active', !!s.autoAttack);
  }
  const badgeAuto = document.getElementById('auto-attack-badge');
  const statusAuto = document.getElementById('auto-attack-status');
  if (badgeAuto && statusAuto) {
    statusAuto.textContent = s.autoAttack ? 'ON' : 'OFF';
    badgeAuto.classList.toggle('active', !!s.autoAttack);
  }

  drawMinimap();
}

// ─── Minimap ───────────────────────────────────────────────────────────────────

let minimapZoomIndex = 1; // 0: Dekat (700), 1: Normal (1400), 2: Jauh (2600)
const MINIMAP_ZOOMS = [700, 1400, 2600];

export function zoomMinimapIn() {
  if (minimapZoomIndex > 0) {
    minimapZoomIndex--;
    drawMinimap();
  }
}

export function zoomMinimapOut() {
  if (minimapZoomIndex < MINIMAP_ZOOMS.length - 1) {
    minimapZoomIndex++;
    drawMinimap();
  }
}

window.zoomMinimapIn = zoomMinimapIn;
window.zoomMinimapOut = zoomMinimapOut;

export function drawMinimap() {
  const mm = document.getElementById('minimap');
  if (!mm) return;
  const ctx = mm.getContext('2d');
  const mw = mm.width || 160;
  const mh = mm.height || 160;
  ctx.clearRect(0, 0, mw, mh);

  const s = state;
  const cx = mw / 2, cy = mh / 2; // player center
  const range = MINIMAP_ZOOMS[minimapZoomIndex];
  const scale = mw / (range * 2);

  const mx = x => cx + (x - s.player.x) * scale;
  const mz = z => cy + (z - s.player.y) * scale;

  // Update header and footer text elements if present
  const locEl = document.getElementById('minimap-location');
  if (locEl) {
    if (s.currentScene === 'hometown') locEl.textContent = '🏰 Hometown';
    else if (s.currentScene === 'wilds2') locEl.textContent = '🏜️ Scorched Dunes';
    else locEl.textContent = '🌲 The Wilds';
  }
  const coordsEl = document.getElementById('minimap-coords');
  if (coordsEl) {
    coordsEl.textContent = `X: ${Math.round(s.player.x)}, Y: ${Math.round(s.player.y)}`;
  }

  // 1. Background terrain tint
  if (s.currentScene === 'hometown') {
    ctx.fillStyle = '#1c3620';
  } else if (s.currentScene === 'wilds2') {
    ctx.fillStyle = '#947238';
  } else {
    ctx.fillStyle = '#122515';
  }
  ctx.fillRect(0, 0, mw, mh);

  // 2. Biome specific landmarks
  if (s.currentScene === 'hometown') {
    // Hometown central stone plaza (radius 250)
    const plazaR = Math.max(8, 250 * scale);
    ctx.fillStyle = '#2d3b2f';
    ctx.beginPath();
    ctx.arc(mx(500), mz(500), plazaR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d4d3f';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Central fountain
    ctx.fillStyle = '#2980b9';
    ctx.beginPath();
    ctx.arc(mx(500), mz(500), Math.max(2, 28 * scale), 0, Math.PI * 2);
    ctx.fill();

    // Paths connecting to buildings and portals
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.22)';
    ctx.lineWidth = Math.max(2, 24 * scale);
    ctx.beginPath();
    ctx.moveTo(mx(500), mz(500)); ctx.lineTo(mx(500), mz(900)); // to portal
    ctx.moveTo(mx(500), mz(500)); ctx.lineTo(mx(300), mz(300)); // to shop
    ctx.moveTo(mx(500), mz(500)); ctx.lineTo(mx(700), mz(300)); // to healer
    ctx.moveTo(mx(500), mz(500)); ctx.lineTo(mx(300), mz(700)); // to blacksmith
    ctx.stroke();
  } else if (s.currentScene === 'wilds') {
    // Altar in Wilds center (10000, 10000)
    const ax = mx(mapSize / 2), az = mz(mapSize / 2);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(ax - 4, az - 4, 8, 8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax - 5, az - 5, 10, 10);
  } else if (s.currentScene === 'wilds2') {
    // Stepped pyramid in Wilds2 center (10000, 10000)
    const px = mx(mapSize / 2), pz = mz(mapSize / 2);
    ctx.fillStyle = '#b38600';
    ctx.fillRect(px - 9, pz - 9, 18, 18);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(px - 5, pz - 5, 10, 10);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(px - 2, pz - 2, 4, 4);
  }

  // 3. Radar Range Rings & Crosshairs
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, mw * 0.25, 0, Math.PI * 2);
  ctx.arc(cx, cy, mw * 0.44, 0, Math.PI * 2);
  ctx.moveTo(cx, 4); ctx.lineTo(cx, mh - 4);
  ctx.moveTo(4, cy); ctx.lineTo(mw - 4, cy);
  ctx.stroke();

  // 4. Portals
  if (s.currentScene === 'hometown' && s.hometownPortal) {
    const hpx = mx(s.hometownPortal.position.x);
    const hpz = mz(s.hometownPortal.position.z);
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(hpx, hpz, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (s.currentScene === 'wilds') {
    if (s.wildsPortal) {
      const wpx = mx(s.wildsPortal.position.x);
      const wpz = mz(s.wildsPortal.position.z);
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(wpx, wpz, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.desertPortalWilds) {
      const dpx = mx(s.desertPortalWilds.position.x);
      const dpz = mz(s.desertPortalWilds.position.z);
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(dpx, dpz, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (s.currentScene === 'wilds2' && s.desertPortalWilds2) {
    const dpx = mx(s.desertPortalWilds2.position.x);
    const dpz = mz(s.desertPortalWilds2.position.z);
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(dpx, dpz, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. NPCs (Hometown only)
  if (s.currentScene === 'hometown') {
    const npcs = [s.shopNPC, s.healerNPC, s.blacksmithNPC];
    npcs.forEach(npc => {
      if (npc && npc.position) {
        const nx = mx(npc.position.x), nz = mz(npc.position.z);
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(nx, nz, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#332200';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  // 6. Unlooted Treasure Chests (within range)
  if (s.interactables && s.interactables.length) {
    s.interactables.forEach(it => {
      if (it.type === 'chest' && !it.looted && it.scene === s.currentScene) {
        if (Math.hypot(it.x - s.player.x, it.y - s.player.y) <= range) {
          const ix = mx(it.x), iz = mz(it.y);
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(ix - 3, iz - 2.5, 6, 5);
          ctx.strokeStyle = '#4a3200';
          ctx.lineWidth = 1;
          ctx.strokeRect(ix - 3, iz - 2.5, 6, 5);
        }
      }
    });
  }

  // 7. Enemies (Regular & Elite)
  if (s.enemies && s.enemies.length) {
    const nearbyEnemies = s.enemies
      .filter(e => Math.hypot(e.x - s.player.x, e.y - s.player.y) <= range)
      .slice(0, 25);

    nearbyEnemies.forEach(e => {
      const ex = mx(e.x), ez = mz(e.y);
      if (e.isElite) {
        // Glowing Golden Elite Star / Diamond
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(ex, ez, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Inner star highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex - 1, ez - 1, 2, 2);
      } else {
        // Regular enemy red dot
        ctx.fillStyle = '#ff3344';
        ctx.beginPath();
        ctx.arc(ex, ez, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#550000';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });
  }

  // 8. Boss
  if (s.bossActive && s.currentScene !== 'hometown') {
    const bx = mx(s.bossX), bz = mz(s.bossY);
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(bx - 5, bz - 5, 10, 10);
    ctx.strokeStyle = '#ffea00';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 6, bz - 6, 12, 12);
  }

  // 9. Auto-Walk Waypoint & Path
  if (s.autoWalkTarget) {
    const wx = mx(s.autoWalkTarget.x);
    const wz = mz(s.autoWalkTarget.y);

    // Dashed tracking line
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(wx, wz);
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint icon
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(wx, wz, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 10. Player (Centered at cx, cy)
  const norm = Math.hypot(s.player.facingX, s.player.facingY) || 1;
  const fX = s.player.facingX / norm;
  const fY = s.player.facingY / norm;
  const faceAngle = Math.atan2(fY, fX);

  // Vision flashlight cone
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, 26, faceAngle - 0.42, faceAngle + 0.42);
  ctx.closePath();
  ctx.fill();

  // Player arrow pointer
  ctx.fillStyle = '#2980b9';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + fX * 9, cy + fY * 9);
  ctx.lineTo(cx - fX * 5 - fY * 5, cy - fY * 5 + fX * 5);
  ctx.lineTo(cx - fX * 2.5, cy - fY * 2.5);
  ctx.lineTo(cx - fX * 5 + fY * 5, cy - fY * 5 - fX * 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Outer border
  ctx.strokeStyle = '#3a4a58';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, mw, mh);
}

// ─── Interaction check ────────────────────────────────────────────────────────

let currentDialogue = null;
let isTyping = false;
let typeInterval = null;
let dialogueCallback = null;

export function startDialogue(speaker, text, onComplete) {
  const ui = document.getElementById('dialogue-ui');
  const nameEl = document.getElementById('dialogue-name');
  const textEl = document.getElementById('dialogue-text');
  if (!ui) return;
  ui.style.display = 'block';
  nameEl.textContent = speaker;
  textEl.textContent = '';
  currentDialogue = text;
  dialogueCallback = onComplete;
  isTyping = true;
  let index = 0;
  if (typeInterval) clearInterval(typeInterval);
  typeInterval = setInterval(() => {
    textEl.textContent += text.charAt(index);
    index++;
    if (index >= text.length) {
      clearInterval(typeInterval);
      isTyping = false;
    }
  }, 30);
}

export function advanceDialogue() {
  if (!currentDialogue) return false;
  const textEl = document.getElementById('dialogue-text');
  if (isTyping) {
    clearInterval(typeInterval);
    textEl.textContent = currentDialogue;
    isTyping = false;
  } else {
    document.getElementById('dialogue-ui').style.display = 'none';
    currentDialogue = null;
    if (dialogueCallback) dialogueCallback();
    dialogueCallback = null;
  }
  return true;
}

export function checkInteractions() {
  const s = state;
  if (s.shopCooldown > 0) s.shopCooldown--;

  if (s.keys.f && currentDialogue) {
    s.keys.f = false;
    if (s.shopCooldown === 0) {
      s.shopCooldown = 15;
      advanceDialogue();
    }
    return;
  }

  updatePortalAnimations();

  let interactText = '';

  if (s.currentScene === 'hometown') {
    const distShop = Math.hypot(s.player.x - s.shopNPC.position.x, s.player.y - s.shopNPC.position.z);
    if (distShop < 65) {
      interactText = 'Tekan [F] untuk Bicara';
      if (s.keys.f && !s.shopOpen && s.shopCooldown === 0) {
        s.shopCooldown = 30;
        s.keys.f = false;
        startDialogue('Altar Shop', 'Halo pahlawan! Aku dapat memberikanmu berkah kekuatan untuk membantumu mengalahkan monster di Wilds.', openShop);
      }
    }

    const distHeal = Math.hypot(s.player.x - s.healerNPC.position.x, s.player.y - s.healerNPC.position.z);
    if (distHeal < 65) {
      interactText = 'Tekan [F] untuk Bicara';
      if (s.keys.f && s.shopCooldown === 0) {
        s.shopCooldown = 30;
        s.keys.f = false;
        startDialogue('Anna The Healer', 'Kamu terlihat sangat kelelahan... Biarkan aku menyembuhkan semua lukamu seharga 10 Gold.', () => {
          if (s.gold >= 10 && s.player.hp < s.player.maxHp) {
            s.gold -= 10;
            s.player.hp = s.player.maxHp;
            playSound('coin');
            updateUI();
          } else if (s.gold < 10) {
            const msgEl = document.getElementById('message');
            if (msgEl) msgEl.textContent = 'Gold tidak cukup!';
          }
        });
      }
    }

    const distPortal = Math.hypot(s.player.x - s.hometownPortal.position.x, s.player.y - s.hometownPortal.position.z);
    if (distPortal < 60) {
      interactText = 'Tekan [F] masuk ke The Wilds';
      if (s.keys.f) {
        // Directly teleport without shop cooldown gating
        if (typeof window.teleportTo === 'function') window.teleportTo('wilds');
        // Prevent immediate re‑trigger while the player stays on the portal
        s.shopCooldown = 30;
        s.keys.f = false;
      }
    }

    if (s.blacksmithNPC) {
      const distBS = Math.hypot(s.player.x - s.blacksmithNPC.position.x, s.player.y - s.blacksmithNPC.position.z);
      if (distBS < 65) {
        interactText = 'Tekan [F] untuk Bicara';
        if (s.keys.f && !s.blacksmithOpen && s.shopCooldown === 0) {
          s.shopCooldown = 30;
          s.keys.f = false;
          startDialogue('Brutus The Blacksmith', 'Hahaha! Perlengkapanmu sudah kusam! Bawa koin emasmu, dan aku akan tempa peralatan terbaik untukmu!', openBlacksmith);
        }
      }
    }

    if (s.questBoardPos) {
      const distQB = Math.hypot(s.player.x - s.questBoardPos.x, s.player.y - s.questBoardPos.z);
      if (distQB < 65) {
        interactText = 'Tekan [F] Papan Misi';
        if (s.keys.f && s.shopCooldown === 0) {
          s.shopCooldown = 30;
          s.keys.f = false;
          openQuestBoard();
        }
      }
    }

    // Village Inn / Tavern
    if (s.innSignPos) {
      const distInn = Math.hypot(s.player.x - s.innSignPos.x, s.player.y - s.innSignPos.z);
      if (distInn < 70) {
        interactText = 'Tekan [F] Istirahat di Penginapan (Pulihkan HP & SP)';
        if (s.keys.f && s.shopCooldown === 0) {
          s.shopCooldown = 40;
          s.keys.f = false;
          restAtInn();
        }
      }
    }

    // Wandering Villagers
    if (s.villagers && s.villagers.length) {
      for (const v of s.villagers) {
        const distV = Math.hypot(s.player.x - v.x, s.player.y - v.z);
        if (distV < 60) {
          interactText = `Tekan [F] Bicara dengan ${v.name}`;
          if (s.keys.f && s.shopCooldown === 0) {
            s.shopCooldown = 30;
            s.keys.f = false;
            const quote = v.speech[Math.floor(Math.random() * v.speech.length)];
            startDialogue(`${v.name} (${v.role})`, quote, () => {});
            break;
          }
        }
      }
    }
  } else if (s.currentScene === 'wilds') {
    if (s.wildsPortal) {
      const distPortal = Math.hypot(s.player.x - s.wildsPortal.position.x, s.player.y - s.wildsPortal.position.z);
      if (distPortal < 50) {
        interactText = 'Tekan [F] pulang ke Kota';
        if (s.keys.f && s.shopCooldown === 0) {
          s.shopCooldown = 60;
          if (typeof window.teleportTo === 'function') window.teleportTo('hometown');
          s.keys.f = false;
        }
      }
    }

    // Portal to Scorched Dunes (level-gated)
    if (s.desertPortalWilds) {
      const distPortal = Math.hypot(s.player.x - s.desertPortalWilds.position.x, s.player.y - s.desertPortalWilds.position.z);
      if (distPortal < 50) {
        if (s.player.level >= WILDS2_MIN_LEVEL) {
          interactText = `Tekan [F] masuk ke Scorched Dunes (Level ${WILDS2_MIN_LEVEL}+)`;
          if (s.keys.f && s.shopCooldown === 0) {
            s.shopCooldown = 60;
            if (typeof window.teleportTo === 'function') window.teleportTo('wilds2');
            s.keys.f = false;
          }
        } else {
          interactText = `🔒 Butuh Level ${WILDS2_MIN_LEVEL} untuk masuk!`;
        }
      }
    }
  } else if (s.currentScene === 'wilds2') {
    // Portal back to The Wilds
    if (s.desertPortalWilds2) {
      const distPortal = Math.hypot(s.player.x - s.desertPortalWilds2.position.x, s.player.y - s.desertPortalWilds2.position.z);
      if (distPortal < 50) {
        interactText = 'Tekan [F] kembali ke The Wilds';
        if (s.keys.f && s.shopCooldown === 0) {
          s.shopCooldown = 60;
          if (typeof window.teleportTo === 'function') window.teleportTo('wilds');
          s.keys.f = false;
        }
      }
    }
  }

  const msgEl = document.getElementById('message');
  if (msgEl) {
    if (interactText !== '') msgEl.textContent = interactText;
    else if (msgEl.textContent.startsWith('Tekan [F]')) msgEl.textContent = '';
  }

  updateSpeechBubbles();
}

let currentBubbleNpc = null;
export function updateSpeechBubbles() {
  const s = state;
  const bubbleContainer = document.getElementById('speech-bubbles-layer');
  if (!bubbleContainer) return;

  if (s.currentScene !== 'hometown' || !s.camera) {
    bubbleContainer.innerHTML = '';
    currentBubbleNpc = null;
    return;
  }

  // Find nearest villager or NPC within 85 units
  let nearest = null;
  let minDist = 85;

  if (s.villagers) {
    for (const v of s.villagers) {
      const d = Math.hypot(s.player.x - v.x, s.player.y - v.z);
      if (d < minDist) {
        minDist = d;
        nearest = v;
      }
    }
  }

  if (nearest) {
    const worldPos = new BABYLON.Vector3(nearest.x, 60, nearest.z);
    const viewMatrix = s.camera.viewportMatrix || s.camera.getViewport().matrix;
    const projected = BABYLON.Vector3.Project(worldPos, BABYLON.Matrix.Identity(), viewMatrix, s.camera.getProjectionMatrix());
    const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

    if (projected.z < 1) { // in front of camera (Babylon's Project returns z in [0,1] viewport NDC after matrix; z<1 keeps it in-viewport)
      if (currentBubbleNpc !== nearest.id) {
        currentBubbleNpc = nearest.id;
        const quote = nearest.speech[0];
        bubbleContainer.innerHTML = `
          <div class="npc-speech-bubble" style="left:${sx}px; top:${sy}px;">
            <div class="bubble-speaker">💬 ${nearest.name}</div>
            <div class="bubble-text">"${quote}"</div>
          </div>
        `;
      } else {
        const bubble = bubbleContainer.querySelector('.npc-speech-bubble');
        if (bubble) {
          bubble.style.left = `${sx}px`;
          bubble.style.top = `${sy}px`;
        }
      }
      return;
    }
  }

  currentBubbleNpc = null;
  bubbleContainer.innerHTML = '';
}

export function restAtInn() {
  const s = state;
  const overlay = document.getElementById('rest-screen-overlay');
  if (overlay) {
    overlay.style.opacity = '1';
  }
  playSound('rest');

  setTimeout(() => {
    s.player.hp = s.player.maxHp;
    s.player.stamina = s.player.maxStamina;
    if (s.player.statusEffect) s.player.statusEffect = null;
    updateUI();

    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '🛏️ Kamu bangun dengan tubuh segar bugar di Penginapan!';
    spawnDamageText(s.player.x, 35, s.player.y, '💚 HP & STAMINA PULIH PENUH! 💤', '#2ecc71');

    setTimeout(() => {
      if (overlay) overlay.style.opacity = '0';
    }, 500);
  }, 700);
}
window.restAtInn = restAtInn;

// ─── Shop ──────────────────────────────────────────────────────────────────────

export function openShop() {
  const s = state;
  s.shopOpen = true;
  s.isPaused = true;
  document.getElementById('shop').style.display = 'flex';
  document.getElementById('shop-gold').textContent = s.gold;
}

export function closeShop() {
  const s = state;
  document.getElementById('shop').style.display = 'none';
  s.shopOpen = false;
  s.isPaused = false;
  s.shopCooldown = 30;
}

export function buyPotion() {
  const s = state;
  if (s.gold >= 15) {
    s.gold -= 15;
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
    document.getElementById('shop-gold').textContent = s.gold;
    
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '✅ Berhasil membeli Health Potion!';
    
    updateUI(true);
    updateInventoryUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = 'Gold tidak cukup!';
  }
}

export function buyStaminaPotion() {
  const s = state;
  const cost = 20;
  if (s.gold >= cost) {
    s.gold -= cost;
    if (!s.inventory) s.inventory = {};
    s.inventory['stamina_potion'] = (s.inventory['stamina_potion'] || 0) + 1;
    playSound('coin');
    const btn = document.getElementById('btn-sp-potion');
    if (btn) {
      btn.textContent = `⚡ SP (B) [${s.inventory['stamina_potion']}]`;
      btn.style.opacity = '1.0';
    }
    const shopGoldEl = document.getElementById('shop-gold');
    if (shopGoldEl) shopGoldEl.textContent = s.gold;
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '✅ Berhasil membeli Stamina Potion!';
    updateUI(true);
    updateInventoryUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = 'Gold tidak cukup!';
  }
}

export function buyInventoryItem(id, cost) {
  const s = state;
  if (s.gold >= cost) {
    s.gold -= cost;
    if (!s.inventory) s.inventory = {};
    if (!s.inventory[id]) s.inventory[id] = 0;
    s.inventory[id]++;
    playSound('coin');
    document.getElementById('shop-gold').textContent = s.gold;
    const msgEl = document.getElementById('message');
    const name = consumableItems[id]?.name || id;
    if (msgEl) msgEl.textContent = `✅ Berhasil membeli ${name}!`;
    updateUI(true);
    updateInventoryUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = 'Gold tidak cukup!';
  }
}

export function buyMysteryBox(cost) {
  const s = state;
  if (s.gold >= cost) {
    s.gold -= cost;
    playSound('coin');
    document.getElementById('shop-gold').textContent = s.gold;
    
    // Pick random loot
    const lootKeys = Object.keys(lootTable);
    const randomLootId = lootKeys[Math.floor(Math.random() * lootKeys.length)];
    const lootItem = lootTable[randomLootId];
    
    if (!s.inventory) s.inventory = {};
    if (!s.inventory[lootItem.id]) s.inventory[lootItem.id] = 0;
    
    // Give 1-3 random loot items
    const amount = Math.floor(Math.random() * 3) + 1;
    s.inventory[lootItem.id] += amount;
    
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `🎁 Gacha! Mendapatkan ${amount}x ${lootItem.name}!`;
    
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = 'Gold tidak cukup!';
  }
}

// ─── Blacksmith ───────────────────────────────────────────────────────────────

export function openBlacksmith() {
  const s = state;
  s.blacksmithOpen = true;
  s.isPaused = true;
  document.getElementById('blacksmith').style.display = 'flex';
  updateBlacksmithUI();
}

export function closeBlacksmith() {
  const s = state;
  document.getElementById('blacksmith').style.display = 'none';
  s.blacksmithOpen = false;
  s.isPaused = false;
  s.shopCooldown = 30;
}

export function updateBlacksmithUI() {
  const s = state;
  document.getElementById('blacksmith-gold').textContent = s.gold;

  const highestW = Math.max(...s.ownedWeapons);
  const wNext = weaponList[highestW + 1];
  if (wNext && highestW + 1 < weaponList.length - 1) { // exclude excalibur
    const lvReq = wNext.minLevel || 1;
    const lvOk = (s.player.level || 1) >= lvReq;
    document.getElementById('weapon-desc').textContent = `${wNext.name} (DMG +${wNext.damage}) | Lv.${lvReq}`;
    document.getElementById('weapon-cost').textContent = wNext.cost;
    document.getElementById('btn-buy-weapon').disabled = s.gold < wNext.cost || !lvOk;
    document.getElementById('btn-buy-weapon').textContent = !lvOk ? `🔒 Butuh Lv.${lvReq}` : 'Tempa Senjata';
  } else {
    document.getElementById('weapon-desc').textContent = 'Max Level';
    document.getElementById('weapon-cost').textContent = '-';
    document.getElementById('btn-buy-weapon').disabled = true;
    document.getElementById('btn-buy-weapon').textContent = 'Max Level';
  }

  const highestA = Math.max(...s.ownedArmors);
  const aNext = armorList[highestA + 1];
  if (aNext) {
    const lvReq = aNext.minLevel || 1;
    const lvOk = (s.player.level || 1) >= lvReq;
    document.getElementById('armor-desc').textContent = `${aNext.name} (HP +${aNext.hp}) | Lv.${lvReq}`;
    document.getElementById('armor-cost').textContent = aNext.cost;
    document.getElementById('btn-buy-armor').disabled = s.gold < aNext.cost || !lvOk;
    document.getElementById('btn-buy-armor').textContent = !lvOk ? `🔒 Butuh Lv.${lvReq}` : 'Tempa Armor';
  } else {
    document.getElementById('armor-desc').textContent = 'Max Level';
    document.getElementById('armor-cost').textContent = '-';
    document.getElementById('btn-buy-armor').disabled = true;
    document.getElementById('btn-buy-armor').textContent = 'Max Level';
  }

  const highestH = Math.max(...s.ownedHelmets);
  const hNext = helmetList[highestH + 1];
  if (hNext) {
    const lvReq = hNext.minLevel || 1;
    const lvOk = (s.player.level || 1) >= lvReq;
    document.getElementById('helmet-desc').textContent = `${hNext.name} (HP +${hNext.hp}) | Lv.${lvReq}`;
    document.getElementById('helmet-cost').textContent = hNext.cost;
    document.getElementById('btn-buy-helmet').disabled = s.gold < hNext.cost || !lvOk;
    document.getElementById('btn-buy-helmet').textContent = !lvOk ? `🔒 Butuh Lv.${lvReq}` : 'Tempa Helm';
  } else {
    document.getElementById('helmet-desc').textContent = 'Max Level';
    document.getElementById('helmet-cost').textContent = '-';
    document.getElementById('btn-buy-helmet').disabled = true;
    document.getElementById('btn-buy-helmet').textContent = 'Max Level';
  }

  const highestB = Math.max(...s.ownedBoots);
  const bNext = bootList[highestB + 1];
  if (bNext) {
    const lvReq = bNext.minLevel || 1;
    const lvOk = (s.player.level || 1) >= lvReq;
    document.getElementById('boots-desc').textContent = `${bNext.name} (Speed +${bNext.speed}) | Lv.${lvReq}`;
    document.getElementById('boots-cost').textContent = bNext.cost;
    document.getElementById('btn-buy-boots').disabled = s.gold < bNext.cost || !lvOk;
    document.getElementById('btn-buy-boots').textContent = !lvOk ? `🔒 Butuh Lv.${lvReq}` : 'Tempa Boots';
  } else {
    document.getElementById('boots-desc').textContent = 'Max Level';
    document.getElementById('boots-cost').textContent = '-';
    document.getElementById('btn-buy-boots').disabled = true;
    document.getElementById('btn-buy-boots').textContent = 'Max Level';
  }
}

export function buyWeapon() {
  const s = state;
  const highestOwned = Math.max(...s.ownedWeapons);
  const wNextIdx = highestOwned + 1;
  const wNext = weaponList[wNextIdx];
  const lvReq = wNext?.minLevel || 1;
  if (wNext && s.gold >= wNext.cost && wNextIdx < weaponList.length - 1 && (s.player.level || 1) >= lvReq) {
    s.gold -= wNext.cost;
    s.ownedWeapons.push(wNextIdx);
    playSound('boss_spawn');
    equipWeapon(wNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else if ((s.player.level || 1) < lvReq) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `🔒 ${wNext.name} membutuhkan Level ${lvReq}!`;
  }
}

export function buyHelmet() {
  const s = state;
  const highestOwned = Math.max(...s.ownedHelmets);
  const hNextIdx = highestOwned + 1;
  const hNext = helmetList[hNextIdx];
  const lvReq = hNext?.minLevel || 1;
  if (hNext && s.gold >= hNext.cost && (s.player.level || 1) >= lvReq) {
    s.gold -= hNext.cost;
    s.ownedHelmets.push(hNextIdx);
    playSound('coin');
    equipHelmet(hNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else if (hNext && (s.player.level || 1) < lvReq) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `🔒 ${hNext.name} membutuhkan Level ${lvReq}!`;
  }
}

export function buyBoots() {
  const s = state;
  const highestOwned = Math.max(...s.ownedBoots);
  const bNextIdx = highestOwned + 1;
  const bNext = bootList[bNextIdx];
  const lvReq = bNext?.minLevel || 1;
  if (bNext && s.gold >= bNext.cost && (s.player.level || 1) >= lvReq) {
    s.gold -= bNext.cost;
    s.ownedBoots.push(bNextIdx);
    playSound('coin');
    equipBoots(bNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else if (bNext && (s.player.level || 1) < lvReq) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `🔒 ${bNext.name} membutuhkan Level ${lvReq}!`;
  }
}

function makeSparkTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 96, 0);
  g.addColorStop(0,   'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 32);
  return new BABYLON.DynamicTexture("sparkTex", c, state.scene, false, true);
}

window.equipWeapon = (idx) => {
  const s = state;
  if (!s.ownedWeapons.includes(idx)) return;
  const prevDmg = weaponList[s.currentWeapon]?.damage ?? 0;
  s.currentWeapon = idx;
  const wNext = weaponList[idx];
  s.player.attackDamage += (wNext.damage - prevDmg);

  if (s.playerSwordMesh) {
    const bs = s.swordBaseScale || { x: 100, y: 180, z: 320 };
    const visualTier = Math.min(idx, 3);
    const factor = 1 + visualTier * 0.15;
    s.playerSwordMesh.scaling.set(bs.x * factor, bs.y * factor, bs.z * factor);

    if (s.playerSwordMesh.getChildren) {
      // Remove existing aura children from sword
      const children = s.playerSwordMesh.getDescendants();
      for (const c of children) {
        if (c.name?.startsWith("aura_")) { c.dispose(); }
      }
    }

    if (s.weaponAuraGroup) { s.weaponAuraGroup.dispose(); s.weaponAuraGroup = null; }
    if (s.auraBursts) { s.auraBursts.dispose(); s.auraBursts = null; }

    // Create aura group as sibling under sceneMount
    s.weaponAuraGroup = new UMDTransformNode("aura_group", s.scene);
    s.weaponAuraGroup.parent = s.sceneMount;

    const wColor = BABYLON.Color3.FromHexString(wNext.color || "#ff0000");

    // Layer 1 — core wisps (40, shared emissive material)
    const coreMat = new BABYLON.StandardMaterial("aura_core_mat", s.scene);
    coreMat.diffuseColor = BABYLON.Color3.Black();
    coreMat.emissiveColor = wColor.clone();
    coreMat.alpha = 0.55;
    coreMat.disableLighting = true;
    coreMat.backFaceCulling = false;

    for (let i = 0; i < 40; i++) {
      const m = BABYLON.MeshBuilder.CreateCylinder("aura_core_" + i, {
        diameterTop: 0.24, diameterBottom: 0.56, height: 6, tessellation: 5,
      }, s.scene);
      m.material = coreMat;
      m.position.set(
        (Math.random() - 0.5) * 3,
        Math.random() * 3,
        (Math.random() - 0.5) * 3
      );
      m.userData = {
        t: Math.random(),
        vt: 0.004 + Math.random() * 0.006,
        r: 1.0 + Math.random() * 1.2,
        angSpeed: 0.5 + Math.random() * 1.0,
        twist: 1.5 + Math.random(),
        animOffset: Math.random() * Math.PI * 2,
      };
      m.parent = s.weaponAuraGroup;
    }

    // Layer 2 — sparks (60, individual material per-mesh for opacity)
    const sparkTex = makeSparkTexture();
    for (let i = 0; i < 60; i++) {
      const isWhiteTint = i < 15;
      const c = isWhiteTint
        ? BABYLON.Color3.Lerp(wColor, BABYLON.Color3.White(), 0.3)
        : wColor.clone();
      const baseOp = 0.25 + Math.random() * 0.2;
      const mat = new BABYLON.StandardMaterial("aura_spark_mat_" + i, s.scene);
      mat.diffuseColor = BABYLON.Color3.Black();
      mat.emissiveColor = c;
      mat.alpha = baseOp;
      mat.disableLighting = true;
      mat.backFaceCulling = false;
      if (sparkTex) {
        mat.emissiveTexture = sparkTex;
        mat.emissiveTexture.uOffset = 0;
        mat.emissiveTexture.vOffset = 0;
        mat.emissiveTexture.uScale = 0.5;
        mat.emissiveTexture.vScale = 0.5;
      }

      const p = BABYLON.MeshBuilder.CreatePlane("aura_spark_" + i, { size: 1.6 }, s.scene);
      p.scaling.x = 0.5 / 1.6;
      p.material = mat;
      p.position.set(
        (Math.random() - 0.5) * 4,
        Math.random() * 2,
        (Math.random() - 0.5) * 4
      );
      p.userData = {
        t: Math.random(),
        vt: 0.002 + Math.random() * 0.004,
        r: 2.2 + Math.random() * 2.3,
        angSpeed: 0.3 + Math.random() * 0.6,
        twist: 1.0 + Math.random() * 1.5,
        animOffset: Math.random() * Math.PI * 2,
        baseOp,
      };
      p.parent = s.weaponAuraGroup;
    }

    // Layer 3 — attack burst pool (20)
    s.auraBursts = new UMDTransformNode("aura_bursts", s.scene);
    s.auraBursts.parent = s.sceneMount;

    for (let i = 0; i < 20; i++) {
      const b = BABYLON.MeshBuilder.CreateSphere("aura_burst_" + i, { diameter: 1.0 }, s.scene);
      const bMat = new BABYLON.StandardMaterial("aura_burst_mat_" + i, s.scene);
      bMat.diffuseColor = BABYLON.Color3.Black();
      bMat.emissiveColor = wColor.clone();
      bMat.alpha = 0;
      bMat.disableLighting = true;
      b.material = bMat;
      b.setEnabled(false);
      b._burstLife = 0;
      b._burstBaseScale = 1.0;
      b._burstSpd = 2.2 + Math.random() * 2.0;
      b.userData = { life: 0, maxLife: 30, spd: b._burstSpd, ang: 0 };
      b.parent = s.auraBursts;
    }
  }
  updateInventoryUI();
};

export function buyArmor() {
  const s = state;
  const highestOwned = Math.max(...s.ownedArmors);
  const aNextIdx = highestOwned + 1;
  const aNext = armorList[aNextIdx];
  const lvReq = aNext?.minLevel || 1;
  if (aNext && s.gold >= aNext.cost && (s.player.level || 1) >= lvReq) {
    s.gold -= aNext.cost;
    s.ownedArmors.push(aNextIdx);
    playSound('boss_spawn');
    equipArmor(aNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  } else if (aNext && (s.player.level || 1) < lvReq) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `🔒 ${aNext.name} membutuhkan Level ${lvReq}!`;
  }
}

window.equipArmor = (idx) => {
  const s = state;
  if (!s.ownedArmors.includes(idx)) return;
  const prevHp = armorList[s.currentArmor]?.hp ?? 0;
  s.currentArmor = idx;
  const aNext = armorList[idx];
  const hpDiff = aNext.hp - prevHp;
  s.player.maxHp += hpDiff;
  s.player.hp += hpDiff; // Heal or take away the difference
  
  // Tidak ada efek visual khusus untuk armor — hanya stat HP yang berubah
  updateInventoryUI();
};

window.equipHelmet = (idx) => {
  const s = state;
  if (!s.ownedHelmets.includes(idx)) return;
  const prevHp = helmetList[s.currentHelmet]?.hp ?? 0;
  s.currentHelmet = idx;
  const hNext = helmetList[idx];
  const hpDiff = hNext.hp - prevHp;
  s.player.maxHp += hpDiff;
  s.player.hp += hpDiff;
  if (typeof window.updateUI === 'function') window.updateUI();
  updateInventoryUI();
  if (typeof window.saveGame === 'function') window.saveGame(true);
};

window.equipBoots = (idx) => {
  const s = state;
  if (!s.ownedBoots.includes(idx)) return;
  const prevSpeed = bootList[s.currentBoots]?.speed ?? 0;
  s.currentBoots = idx;
  const bNext = bootList[idx];
  const speedDiff = bNext.speed - prevSpeed;
  s.player.speed += speedDiff;
  if (typeof window.updateUI === 'function') window.updateUI();
  updateInventoryUI();
  if (typeof window.saveGame === 'function') window.saveGame(true);
};

// ─── Level up ──────────────────────────────────────────────────────────────────

export function levelUp() {
  const s = state;
  s.player.level++;
  s.player.exp -= s.player.nextExp;
  s.player.nextExp = Math.floor(s.player.nextExp * 1.5);
  s.player.statPoints += 1;

  playSound('boss_spawn');
  spawnParticles(s.player.x, s.player.y, 0xffff00, 50, 'levelup');

  const modal = document.getElementById('level-up-modal');
  if (modal) {
    modal.querySelector('p').textContent = `Kekuatan Anda meningkat pesat! (+1 Stat Point)`;
    modal.style.display = 'flex';
    setTimeout(() => modal.style.display = 'none', 3000);
  }
  updateStatsUI();
  if (typeof window.saveGame === 'function') window.saveGame(true);
}

export function openStats() {
  const el = document.getElementById('stats-menu');
  if (!el) return;
  el.style.display = 'flex';
  updateStatsUI();
}

export function closeStats() {
  document.getElementById('stats-menu').style.display = 'none';
}

export function addStat(type) {
  const s = state;
  if (s.player.statPoints > 0) {
    s.player.statPoints--;
    s.player.stats[type]++;
    
    if (type === 'str') {
      s.player.attackDamage += 1;
    } else if (type === 'agi') {
      s.player.speed += 0.3;
      s.player.maxStamina += 20;
      s.player.stamina += 20;
      s.critChance = Math.min(0.6, s.critChance + 0.005);
    } else if (type === 'vit') {
      s.player.maxHp += 30;
      s.player.hp += 30;
    }
    
    updateStatsUI();
    updateUI();
  }
}

export function updateStatsUI() {
  const s = state;
  const statPointsEl = document.getElementById('stat-points');
  if (!statPointsEl) return;
  statPointsEl.textContent = s.player.statPoints;
  document.getElementById('stat-str').textContent = s.player.stats.str;
  document.getElementById('stat-agi').textContent = s.player.stats.agi;
  document.getElementById('stat-vit').textContent = s.player.stats.vit;
  
  const notifEl = document.getElementById('stat-notif');
  if (notifEl) {
    notifEl.style.display = s.player.statPoints > 0 ? 'inline-block' : 'none';
  }
}

// Multi-stage quest definitions
const QUEST_STAGES = [
  { id: 1, name: 'Basmi 5 Monster', desc: 'Kalahkan 5 musuh', count: 5, reward: 100, expReward: 50 },
  { id: 2, name: 'Kumpulkan Bahan', desc: 'Kumpulkan 3 Iron Shard', count: 3, reward: 250, expReward: 100, itemReq: 'iron_shard' },
  { id: 3, name: 'Kalahkan Boss', desc: 'Kalahkan The Golden Golem', count: 1, reward: 500, expReward: 200 },
];

export function openQuestBoard() {
  document.getElementById('quest-board').style.display = 'flex';
  const s = state;

  // Initialize quest state if needed
  if (s.questStage === 0 && !s.bountyQuest) {
    s.bountyQuest = { ...QUEST_STAGES[0] };
    s.questCompleted = [];
  }

  // Show current quest
  const currentQuest = s.bountyQuest;
  if (currentQuest) {
    document.getElementById('quest-title').textContent = currentQuest.name;
    document.getElementById('quest-desc').textContent = currentQuest.desc;
    document.getElementById('quest-reward').textContent = `${currentQuest.reward} G + ${currentQuest.expReward} EXP`;
    document.getElementById('quest-progress').textContent = `${s.bountyQuestProgress}/${currentQuest.count}`;
  }

  // Show quest history
  const historyEl = document.getElementById('quest-history');
  if (historyEl) {
    if (s.questCompleted.length > 0) {
      historyEl.innerHTML = '<p style="color:#2ecc71;font-size:12px;margin:5px 0;">✅ Selesai:</p>' +
        s.questCompleted.map(id => `<p style="color:#888;font-size:11px;">• ${QUEST_STAGES[id-1]?.name}</p>`).join('');
    } else {
      historyEl.innerHTML = '';
    }
  }

  const btn = document.getElementById('btn-quest-action');
  if (s.bountyQuestProgress >= s.bountyQuest.count) {
    btn.textContent = 'Klaim Hadiah';
    btn.onclick = window.claimQuest;
  } else if (s.bountyQuestProgress > 0 || document.getElementById('side-quest-badge').style.display !== 'none') {
    btn.textContent = 'Misi Sedang Dikerjakan';
    btn.onclick = null;
  } else {
    btn.textContent = 'Terima Misi';
    btn.onclick = window.acceptQuest;
  }
}

export function acceptQuest() {
  playSound('coin'); 
  document.getElementById('side-quest-badge').style.display = 'inline-flex';
  updateQuestUI();
  closeQuestBoard();
}

export function claimQuest() {
  const s = state;
  if (s.bountyQuest && s.bountyQuestProgress >= s.bountyQuest.count) {
    s.gold += s.bountyQuest.reward;
    s.player.exp += s.bountyQuest.expReward;
    playSound('coin');
    spawnParticles(s.player.x, s.player.y, 0xffff00, 30, 'heal');
    s.questCompleted.push(s.bountyQuest.id);
    s.bountyQuestProgress = 0;

    // Advance to next quest stage
    const nextStage = QUEST_STAGES[s.bountyQuest.id];
    if (nextStage && s.bountyQuest.id < QUEST_STAGES.length) {
      s.bountyQuest = { ...QUEST_STAGES[s.bountyQuest.id] };
    } else {
      s.bountyQuest = null;
      document.getElementById('side-quest-badge').style.display = 'none';
    }
    closeQuestBoard();
    updateUI();
    if (s.player.exp >= s.player.nextExp) levelUp();
  }
}

export function closeQuestBoard() {
  document.getElementById('quest-board').style.display = 'none';
}

export function updateQuestUI() {
  const s = state;
  if (s.bountyQuest) {
    document.getElementById('side-quest-badge').style.display = 'inline-flex';
    document.getElementById('side-quest-text').textContent = `${s.bountyQuest.name} (${s.bountyQuestProgress} / ${s.bountyQuest.count})`;
  } else {
    document.getElementById('side-quest-badge').style.display = 'none';
  }
}

window.useConsumable = useConsumable;

export function openInventory() {
  const el = document.getElementById('inventory-menu');
  if (!el) return;
  el.style.display = 'flex';
  updateInventoryUI();
}

export function closeInventory() {
  document.getElementById('inventory-menu').style.display = 'none';
}

export function updateInventoryUI() {
  const s = state;
  const listEl = document.getElementById('inventory-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  let hasItems = false;
  
  if (!s.inventory) s.inventory = {};

  // Migrasi jika ada gold lama di inventory langsung ke data gold pemain
  if (s.inventory.gold) {
    s.gold = (s.gold || 0) + (s.inventory.gold * 10);
    delete s.inventory.gold;
    const goldEl = document.getElementById('gold');
    if (goldEl) goldEl.textContent = s.gold;
    if (typeof window.saveGame === 'function') window.saveGame(true);
  }

  // Sinkronkan s.potions ke inventory health_potion
  if (s.potions > 0) {
    s.inventory['health_potion'] = s.potions;
  } else {
    delete s.inventory['health_potion'];
  }
  
  for (const [id, count] of Object.entries(s.inventory)) {
    if (id === 'gold') continue;
    if (count > 0) {
      hasItems = true;
      const lootDef = Object.values(lootTable).find(l => l.id === id);
      const consDef = consumableItems[id];
      const name = lootDef ? lootDef.name : (consDef ? consDef.name : id);
      
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.padding = '5px 0';
      div.style.borderBottom = '1px solid #444';
      
      const nameSpan = document.createElement('span');
      let icon = '';
      if (lootDef && lootDef.icon) icon = lootDef.icon;
      else if (consDef && consDef.icon) icon = consDef.icon;
      nameSpan.textContent = icon ? `${icon} ${name}` : name;
      
      const countSpan = document.createElement('span');
      countSpan.textContent = `x${count}`;
      countSpan.style.color = '#f1c40f';

      div.appendChild(nameSpan);
      div.appendChild(countSpan);

      // Add "Sell" button
      if (lootDef) {
        const sellBtn = document.createElement('button');
        const sellPrice = Math.floor(lootDef.value * 0.8);
        sellBtn.textContent = `Jual (${sellPrice}G)`;
        sellBtn.style.padding = '2px 8px';
        sellBtn.style.background = '#e67e22';
        sellBtn.style.marginLeft = '8px';
        sellBtn.onclick = () => sellItem(id, sellPrice);
        div.appendChild(sellBtn);
      }

      // Add "Use" button for consumable items
      const consumableDef = Object.values(consumableItems).find(c => c.id === id);
      if (consumableDef && count > 0) {
        const useBtn = document.createElement('button');
        useBtn.textContent = 'Gunakan';
        useBtn.style.padding = '2px 8px';
        useBtn.style.background = '#27ae60';
        useBtn.style.marginLeft = '8px';
        useBtn.onclick = () => window.useConsumable(id);
        div.appendChild(useBtn);
      }

      listEl.appendChild(div);
    }
  }

  if (!hasItems) {
    listEl.innerHTML = '<p style="text-align:center; color:#888;">Tas kosong...</p>';
  }

  // Crafting section
  const craftEl = document.getElementById('crafting-content');
  if (craftEl) {
    craftEl.innerHTML = '';
    const recipes = [
      { name: 'Health Potion', icon: '🧪', ingredients: { wood_scrap: 2, slime_gel: 1 }, result: 'health_potion' },
      { name: 'Stamina Potion', icon: '⚡', ingredients: { slime_gel: 1, bone: 2 }, result: 'stamina_potion' },
      { name: 'Antidote', icon: '🧪', ingredients: { bone: 3, magic_dust: 1 }, result: 'antidote' },
      { name: 'Cooling Tea', icon: '🍵', ingredients: { iron_shard: 2, golem_core: 1 }, result: 'cooling_tea' },
      { name: 'Health Crystal', icon: '💎', ingredients: { demon_horn: 1, hell_fire: 1, holy_gem: 1 }, result: 'health_crystal' },
    ];
    recipes.forEach(recipe => {
      const canCraft = Object.entries(recipe.ingredients).every(([id, count]) => (s.inventory[id] ?? 0) >= count);
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      div.style.padding = '5px 0';
      div.style.borderBottom = '1px solid #444';
      const ingText = Object.entries(recipe.ingredients).map(([id, count]) => {
        const loot = Object.values(lootTable).find(l => l.id === id);
        return `${loot ? loot.icon : id} x${count}`;
      }).join(' + ');
      div.innerHTML = `<span>${recipe.icon} ${recipe.name} <span style="color:#888; font-size:12px;">(${ingText})</span></span>`;
      const btn = document.createElement('button');
      btn.textContent = 'Craft';
      btn.disabled = !canCraft;
      btn.style.padding = '2px 8px';
      btn.style.background = canCraft ? '#27ae60' : '#555';
      btn.onclick = () => craftItem(recipe.result, recipe.ingredients);
      div.appendChild(btn);
      craftEl.appendChild(div);
    });
  }

  // Update Equipment section
  const eqEl = document.getElementById('equipment-content');
  if (eqEl) {
    eqEl.innerHTML = '';
    
    // Weapons
    s.ownedWeapons.forEach(idx => {
      const w = weaponList[idx];
      const isEquipped = s.currentWeapon === idx;
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.padding = '5px 0';
      div.style.borderBottom = '1px solid #444';
      div.innerHTML = `<span>⚔️ ${w.name} <span style="color:#888; font-size:12px;">(+${w.damage} DMG)</span></span>`;
      
      const btn = document.createElement('button');
      btn.textContent = isEquipped ? 'Dipakai' : 'Pakai';
      btn.disabled = isEquipped;
      btn.style.padding = '2px 8px';
      btn.style.background = isEquipped ? '#27ae60' : '#3498db';
      btn.onclick = () => window.equipWeapon(idx);
      div.appendChild(btn);
      eqEl.appendChild(div);
    });
    
    // Armors
    s.ownedArmors.forEach(idx => {
      const a = armorList[idx];
      const isEquipped = s.currentArmor === idx;
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.padding = '5px 0';
      div.style.borderBottom = '1px solid #444';
      div.innerHTML = `<span>🛡️ ${a.name} <span style="color:#888; font-size:12px;">(+${a.hp} HP)</span></span>`;
      
      const btn = document.createElement('button');
      btn.textContent = isEquipped ? 'Dipakai' : 'Pakai';
      btn.disabled = isEquipped;
      btn.style.padding = '2px 8px';
      btn.style.background = isEquipped ? '#27ae60' : '#3498db';
      btn.onclick = () => window.equipArmor(idx);
      div.appendChild(btn);
      eqEl.appendChild(div);
    });

    // Helmets
    s.ownedHelmets.forEach(idx => {
      const h = helmetList[idx];
      const isEquipped = s.currentHelmet === idx;
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.padding = '5px 0';
      div.style.borderBottom = '1px solid #444';
      div.innerHTML = `<span>🪖 ${h.name} <span style="color:#888; font-size:12px;">(+${h.hp} HP)</span></span>`;
      const btn = document.createElement('button');
      btn.textContent = isEquipped ? 'Dipakai' : 'Pakai';
      btn.disabled = isEquipped;
      btn.style.padding = '2px 8px';
      btn.style.background = isEquipped ? '#27ae60' : '#3498db';
      btn.onclick = () => window.equipHelmet(idx);
      div.appendChild(btn);
      eqEl.appendChild(div);
    });

    // Boots
    s.ownedBoots.forEach(idx => {
      const b = bootList[idx];
      const isEquipped = s.currentBoots === idx;
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.padding = '5px 0';
      div.style.borderBottom = '1px solid #444';
      div.innerHTML = `<span>👢 ${b.name} <span style="color:#888; font-size:12px;">(+${b.speed} Speed)</span></span>`;
      const btn = document.createElement('button');
      btn.textContent = isEquipped ? 'Dipakai' : 'Pakai';
      btn.disabled = isEquipped;
      btn.style.padding = '2px 8px';
      btn.style.background = isEquipped ? '#27ae60' : '#3498db';
      btn.onclick = () => window.equipBoots(idx);
      div.appendChild(btn);
      eqEl.appendChild(div);
    });
  }
}

export function craftItem(resultId, ingredients) {
  const s = state;
  // Check if player has enough ingredients
  for (const [id, count] of Object.entries(ingredients)) {
    if ((s.inventory[id] ?? 0) < count) return;
  }
  // Remove ingredients
  for (const [id, count] of Object.entries(ingredients)) {
    s.inventory[id] -= count;
  }
  // Add result
  if (resultId === 'health_potion') {
    s.potions = (s.potions || 0) + 1;
    s.inventory['health_potion'] = s.potions;
  } else {
    s.inventory[resultId] = (s.inventory[resultId] ?? 0) + 1;
  }
  playSound('coin');
  if (typeof updateUI === 'function') updateUI(true);
  updateInventoryUI();
  if (typeof window.saveGame === 'function') window.saveGame(true);
  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent = '✅ Crafting berhasil!';
}

export function useConsumable(id) {
  const s = state;
  if (id === 'health_potion') {
    if (typeof window.usePotion === 'function') {
      window.usePotion();
    }
    return;
  }
  if (id === 'stamina_potion') {
    if (typeof window.useStaminaPotion === 'function') {
      window.useStaminaPotion();
    }
    return;
  }
  const def = consumableItems[id];
  if (!def || !s.inventory || !s.inventory[id] || s.inventory[id] <= 0) return;

  const now = Date.now();
  if (now - (s.lastCrystalUse || 0) < def.cooldown * 16.667) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '⏳ Item ini masih cooldown!';
    return;
  }

  s.inventory[id]--;
  if (s.inventory[id] <= 0) delete s.inventory[id];

  if (def.effect === 'heal') {
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + def.value);
    s.lastCrystalUse = now;
    playSound('coin');
    spawnParticles(s.player.x, s.player.y, 0x00ff00, 10, 'heal');
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `💎 ${def.name} digunakan! (+${def.value} HP)`;
  } else if (def.effect === 'cure_poison') {
    if (s.player.statusEffect && s.player.statusEffect.type === 'poison') {
      s.player.statusEffect = null;
      playSound('coin');
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.textContent = '✅ Racun berhasil diobati!';
    } else {
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.textContent = 'Anda tidak sedang diracun.';
    }
  } else if (def.effect === 'cure_burn') {
    if (s.player.statusEffect && s.player.statusEffect.type === 'burn') {
      s.player.statusEffect = null;
      playSound('coin');
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.textContent = '✅ Luka bakar berhasil diobati!';
    } else {
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.textContent = 'Anda tidak sedang terbakar.';
    }
  } else if (def.effect === 'teleport') {
    if (typeof window.teleportTo === 'function') {
      window.teleportTo('hometown');
      playSound('coin');
      const msgEl = document.getElementById('message');
      if (msgEl) msgEl.textContent = '🌀 Berteleportasi ke Hometown!';
      closeInventory();
    }
  } else if (def.effect === 'restore_sp') {
    s.player.stamina = s.player.maxStamina;
    playSound('coin');
    spawnParticles(s.player.x, s.player.y, 0x00ffff, 10, 'heal');
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '⚡ Stamina pulih penuh!';
  }

  if (typeof window.updateUI === 'function') window.updateUI();
  updateInventoryUI();
}

// ─── Auto-Use Potion (berdasarkan threshold yang di-set user) ─────────────────
// Dipanggil tiap frame dari main.js. Both potion tetap bisa dipakai manual.
export function autoUsePotions() {
  const s = state;
  if (s.gameOver || s.isPaused || !s.isGameStarted) return;

  const hpPct = (s.player.hp / s.player.maxHp) * 100;
  if (hpPct <= s.autoHealThreshold) {
    if (typeof window.usePotion === 'function') window.usePotion();
  }

  const spPct = (s.player.stamina / s.player.maxStamina) * 100;
  if (spPct <= s.autoSPThreshold) {
    if (typeof window.useStaminaPotion === 'function') {
      window.useStaminaPotion();
    } else {
      useConsumable('stamina_potion');
    }
  }
}

export function updateAutoUseSettings() {
  const hEl = document.getElementById('set-auto-health');
  const sEl = document.getElementById('set-auto-sp');
  if (hEl) {
    state.autoHealThreshold = +hEl.value;
    const hVal = document.getElementById('val-auto-health');
    if (hVal) hVal.innerText = hEl.value;
  }
  if (sEl) {
    state.autoSPThreshold = +sEl.value;
    const sVal = document.getElementById('val-auto-sp');
    if (sVal) sVal.innerText = sEl.value;
  }
}

// ─── Mode Auto-Attack ─────────────────────────────────────────────────────────

export function toggleAutoAttack(forceVal = null) {
  state.autoAttack = forceVal !== null ? !!forceVal : !state.autoAttack;
  playSound(state.autoAttack ? 'dash' : 'click');
  const msgEl = document.getElementById('message');
  if (msgEl) {
    msgEl.textContent = state.autoAttack
      ? '⚔️ Mode Auto-Attack: AKTIF (Karakter otomatis menyerang musuh di dekatnya!)'
      : '⚔️ Mode Auto-Attack: NONAKTIF';
  }
  syncAutoAttackUI();
  updateUI(true);
  if (typeof window.saveGame === 'function') {
    window.saveGame(true);
  }
}

export function updateAutoAttackSettings() {
  const spinEl = document.getElementById('set-auto-spin');
  const rangeEl = document.getElementById('set-auto-range');
  if (spinEl) {
    state.autoAttackSpin = !!spinEl.checked;
  }
  if (rangeEl) {
    state.autoAttackRange = +rangeEl.value;
    const rVal = document.getElementById('val-auto-range');
    if (rVal) rVal.innerText = rangeEl.value;
  }
  if (typeof window.saveGame === 'function') {
    window.saveGame(true);
  }
}

export function syncAutoAttackUI() {
  const s = state;
  const btn = document.getElementById('btn-auto-attack');
  if (btn) {
    btn.textContent = s.autoAttack ? '⚔️ Auto (T): ON' : '⚔️ Auto (T): OFF';
    btn.classList.toggle('active', !!s.autoAttack);
  }
  const badge = document.getElementById('auto-attack-badge');
  const status = document.getElementById('auto-attack-status');
  if (badge && status) {
    status.textContent = s.autoAttack ? 'ON' : 'OFF';
    badge.classList.toggle('active', !!s.autoAttack);
  }
  const menuBtn = document.getElementById('set-auto-attack-btn');
  if (menuBtn) {
    menuBtn.textContent = s.autoAttack ? 'ON' : 'OFF';
    menuBtn.style.background = s.autoAttack ? '#27ae60' : '#555';
  }
  const spinEl = document.getElementById('set-auto-spin');
  if (spinEl) spinEl.checked = !!s.autoAttackSpin;
  const rangeEl = document.getElementById('set-auto-range');
  if (rangeEl) {
    rangeEl.value = s.autoAttackRange || 140;
    const rVal = document.getElementById('val-auto-range');
    if (rVal) rVal.innerText = s.autoAttackRange || 140;
  }
}

export function sellItem(id, sellPrice) {
  const s = state;
  if (!s.inventory || !s.inventory[id] || s.inventory[id] <= 0) return;
  s.inventory[id]--;
  s.gold += sellPrice;
  playSound('coin');
  const lootDef = Object.values(lootTable).find(l => l.id === id);
  const itemName = lootDef ? lootDef.name : id;
  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent = `Terjual 1 ${itemName} seharga ${sellPrice}G!`;
  const shopGold = document.getElementById('shop-gold');
  if (shopGold) shopGold.textContent = s.gold;
  if (typeof window.updateUI === 'function') window.updateUI();
  updateInventoryUI();
  if (typeof window.saveGame === 'function') window.saveGame(true);
}

export function sellAllLoot() {
  const s = state;
  let totalEarned = 0;
  for (const [id, count] of Object.entries(s.inventory)) {
    if (count > 0) {
      if (id === 'gold') {
        totalEarned += count * 10;
        delete s.inventory[id];
        continue;
      }
      const lootDef = Object.values(lootTable).find(l => l.id === id);
      if (lootDef) {
        totalEarned += lootDef.value * count;
      }
      s.inventory[id] = 0;
    }
  }
  
  if (totalEarned > 0) {
    s.gold += totalEarned;
    playSound('coin');
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `Terjual semua loot seharga ${totalEarned} Gold!`;
    document.getElementById('shop-gold').textContent = s.gold;
    updateUI();
  } else {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = `Tas kamu kosong!`;
  }
}

// ─── Input handling ────────────────────────────────────────────────────────────

const ZOOM_MIN = 50, ZOOM_MAX = 500, ZOOM_STEP = 20;

window.zoomCamera = function(dir) {
  const newVal = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.cameraOffsetZ + dir * ZOOM_STEP));
  if (newVal === state.cameraOffsetZ) return;
  state.cameraOffsetZ = newVal;
  state.zoomLevel = newVal;
  const hud = document.getElementById('val-cam-z-hud');
  if (hud) hud.textContent = newVal;
  const settings = document.getElementById('cam-z');
  if (settings) settings.value = newVal;
  const val = document.getElementById('val-cam-z');
  if (val) val.textContent = newVal;
  const badge = document.getElementById('zoom-badge');
  if (badge) {
    badge.style.transition = 'transform 0.08s';
    badge.style.transform = 'scale(1.15)';
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 80);
  }
};

window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  state.keys[key] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'z', 'x', 'r', 'c', 'v', 'b', 'tab', 'f', 'i', 'j', 'm', 't', '=', '-'].includes(key)) {
    e.preventDefault();
  }
  if (key === 't') toggleAutoAttack();
  if (key === 'escape' && typeof window.togglePause === 'function') window.togglePause();
  if (key === 'i') {
    const invEl = document.getElementById('inventory-menu');
    if (invEl && invEl.style.display === 'flex') closeInventory();
    else openInventory();
  }
  if (key === 'j') {
    const qbEl = document.getElementById('quest-board');
    if (qbEl && qbEl.style.display === 'flex') closeQuestBoard();
    else openQuestBoard();
  }
  if (key === 'm') {
    const mapEl = document.getElementById('full-map-modal');
    if (mapEl && mapEl.style.display === 'flex') closeFullMap();
    else openFullMap();
  }
  // Zoom: + = zoom in, - = zoom out
  if (key === '=' || key === '+') {
    e.preventDefault();
    window.zoomCamera(-1);
  } else if (key === '-' || key === '_') {
    e.preventDefault();
    window.zoomCamera(1);
  }
});

window.addEventListener('keyup', e => {
  state.keys[e.key.toLowerCase()] = false;
});

// ─── Tutorial ─────────────────────────────────────────────────────────────────

export function openTutorial() {
  state.isPaused = true;
  document.getElementById('tutorial-modal').style.display = 'flex';
}

export function closeTutorial() {
  state.isPaused = false;
  document.getElementById('tutorial-modal').style.display = 'none';
}

// ─── Full Map ─────────────────────────────────────────────────────────────────

export function openFullMap() {
  state.isPaused = true;
  document.getElementById('full-map-modal').style.display = 'flex';
  drawFullMap();
}

export function closeFullMap() {
  state.isPaused = false;
  document.getElementById('full-map-modal').style.display = 'none';
}

export function setAutoWalkTarget(x, y) {
  const s = state;
  if (!s.scene || !s.isGameStarted || s.gameOver) return;

  if (s.autoWalkTarget) {
    s.autoWalkTarget.x = x;
    s.autoWalkTarget.y = y;
  } else {
    s.autoWalkTarget = { x, y };
    s.waypointMesh = BABYLON.MeshBuilder.CreateDisc("waypoint_ring", { radius: 18, tessellation: 24 }, s.scene);
    const wpMat = new BABYLON.StandardMaterial("waypoint_mat", s.scene);
    wpMat.diffuseColor = BABYLON.Color3.Black();
    wpMat.emissiveColor = BABYLON.Color3.FromHexString("#00ff88");
    wpMat.alpha = 0.85;
    wpMat.disableLighting = true;
    wpMat.backFaceCulling = false;
    s.waypointMesh.material = wpMat;
    s.waypointMesh.rotation.x = -Math.PI / 2;
    s.waypointMesh.parent = s.sceneMount;
  }

  const terrainY = s.currentScene === 'wilds2'
    ? getTerrainHeightWilds2(x, y)
    : getTerrainHeight(x, y);
  s.waypointMesh.position.set(x, 4 + terrainY, y);
  if (typeof drawMinimap === 'function') drawMinimap();

  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent = `🏃 Otomatis berjalan ke tujuan di peta...`;
}

export function clearAutoWalkTargetUI() {
  state.autoWalkTarget = null;
  if (state.waypointMesh) {
    state.waypointMesh.dispose();
    state.waypointMesh = null;
  }
  if (typeof drawMinimap === 'function') drawMinimap();
}
window.clearAutoWalkTargetUI = clearAutoWalkTargetUI;
window.clearWaypoint = clearAutoWalkTargetUI;

export function drawFullMap() {
  const canvas = document.getElementById('fullmap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const mapWidth = 600;
  const mapHeight = 600;
  ctx.clearRect(0, 0, mapWidth, mapHeight);

  const s = state;

  // 1. Update Header and Footer status DOM elements
  const zoneNameEl = document.getElementById('fullmap-zone-name');
  if (zoneNameEl) {
    if (s.currentScene === 'hometown') zoneNameEl.textContent = '🏰 Hometown (Desa)';
    else if (s.currentScene === 'wilds2') zoneNameEl.textContent = '🏜️ Scorched Dunes (Gurun Pasir)';
    else zoneNameEl.textContent = '🌲 The Wilds (Hutan Mistis)';
  }
  const coordsEl = document.getElementById('fullmap-player-coords');
  if (coordsEl) {
    coordsEl.textContent = `X: ${Math.round(s.player.x)}, Y: ${Math.round(s.player.y)}`;
  }
  const wpStatusEl = document.getElementById('fullmap-waypoint-status');
  const wpCancelBtn = document.getElementById('btn-cancel-waypoint');
  if (s.autoWalkTarget) {
    const dist = Math.round(Math.hypot(s.autoWalkTarget.x - s.player.x, s.autoWalkTarget.y - s.player.y));
    if (wpStatusEl) wpStatusEl.innerHTML = `🎯 <span style="color:#00ff88;">Menuju Tujuan (${dist}m)</span> — Berjalan otomatis saat peta ditutup`;
    if (wpCancelBtn) wpCancelBtn.style.display = 'inline-block';
  } else {
    if (wpStatusEl) wpStatusEl.textContent = '💡 Klik di mana saja pada peta untuk menandai rute jalan otomatis (auto-walk)';
    if (wpCancelBtn) wpCancelBtn.style.display = 'none';
  }

  // 2. Coordinate Transformation based on Scene
  let toX, toY;
  if (s.currentScene === 'hometown') {
    // Hometown bounds: -100 to 1100 (span 1200)
    const minX = -100, minY = -100, span = 1200;
    toX = x => ((x - minX) / span) * mapWidth;
    toY = y => ((y - minY) / span) * mapHeight;
  } else {
    // Wilds / Wilds2: 0 to mapSize (20000)
    const scale = mapWidth / mapSize;
    toX = x => x * scale;
    toY = y => y * scale;
  }

  // 3. Map Background & Visual Cartography
  if (s.currentScene === 'hometown') {
    // Lush village grass background
    ctx.fillStyle = '#162e1a';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // Village outer boundary wall
    ctx.strokeStyle = '#4a5b48';
    ctx.lineWidth = 3;
    ctx.strokeRect(toX(-70), toY(-70), (1140 / 1200) * mapWidth, (1140 / 1200) * mapHeight);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= mapWidth; g += 60) {
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, mapHeight); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(mapWidth, g); ctx.stroke();
    }

    // Dirt paths connecting plaza to houses and portal
    const px0 = toX(500), py0 = toY(500);
    ctx.strokeStyle = '#3d3023';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(px0, py0); ctx.lineTo(toX(500), toY(900)); // to Portal
    ctx.moveTo(px0, py0); ctx.lineTo(toX(300), toY(300)); // to Shop
    ctx.moveTo(px0, py0); ctx.lineTo(toX(700), toY(300)); // to Healer
    ctx.moveTo(px0, py0); ctx.lineTo(toX(300), toY(700)); // to Blacksmith
    ctx.moveTo(px0, py0); ctx.lineTo(toX(660), toY(200)); // to Training dummy
    ctx.stroke();

    // Cobblestone Plaza (radius 250 in world units)
    const plazaRadius = (250 / 1200) * mapWidth;
    ctx.fillStyle = '#323c34';
    ctx.beginPath();
    ctx.arc(px0, py0, plazaRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4e5a50';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Central Fountain
    ctx.fillStyle = '#2980b9';
    ctx.beginPath();
    ctx.arc(px0, py0, (40 / 1200) * mapWidth, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Village Houses (Stylized Roofs)
    const houses = [
      { x: 200, y: 200, w: 90, h: 70, label: 'Rumah' },
      { x: 800, y: 800, w: 90, h: 70, label: 'Rumah' },
      { x: 200, y: 800, w: 80, h: 80, label: 'Lumbung' },
      { x: 850, y: 350, w: 90, h: 70, label: 'Gudang' },
    ];
    houses.forEach(h => {
      const hx = toX(h.x), hy = toY(h.y);
      const hw = (h.w / 1200) * mapWidth;
      const hh = (h.h / 1200) * mapHeight;
      ctx.fillStyle = '#4a2e1b';
      ctx.fillRect(hx - hw / 2, hy - hh / 2, hw, hh);
      ctx.strokeStyle = '#7f4f24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx - hw / 2, hy - hh / 2, hw, hh);
      ctx.fillStyle = '#dcdcdc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(h.label, hx, hy + 3);
    });

    // Training Dummy Area
    const tdx = toX(660), tdy = toY(200);
    ctx.fillStyle = '#d35400';
    ctx.beginPath();
    ctx.arc(tdx, tdy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎯 Latihan', tdx, tdy - 11);

  } else if (s.currentScene === 'wilds') {
    // Deep Forest Background
    ctx.fillStyle = '#0f2113';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // Decorative Forest Danger Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= mapWidth; g += 60) {
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, mapHeight); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(mapWidth, g); ctx.stroke();
    }

    // Sacred Altar Ruins (Center: 10000, 10000)
    const ax = toX(mapSize / 2), ay = toY(mapSize / 2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.beginPath();
    ctx.arc(ax, ay, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(ax - 7, ay - 7, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏛️ Altar Kuno', ax, ay - 14);

  } else if (s.currentScene === 'wilds2') {
    // Scorched Dunes Desert Background
    ctx.fillStyle = '#805d26';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // Subtle dune wave lines & Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= mapWidth; g += 60) {
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, mapHeight); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(mapWidth, g); ctx.stroke();
    }

    // Great Stepped Pyramid at Center (10000, 10000)
    const px = toX(mapSize / 2), py = toY(mapSize / 2);
    // Outer terrace
    ctx.fillStyle = '#5c4117';
    ctx.fillRect(px - 32, py - 32, 64, 64);
    // Middle terrace
    ctx.fillStyle = '#9e732d';
    ctx.fillRect(px - 22, py - 22, 44, 44);
    // Inner terrace
    ctx.fillStyle = '#cca047';
    ctx.fillRect(px - 12, py - 12, 24, 24);
    // Apex
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(px - 5, py - 5, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔺 Piramida Berapi', px, py - 38);
  }

  // 4. Portals
  if (s.currentScene === 'hometown' && s.hometownPortal) {
    const hpx = toX(s.hometownPortal.position.x);
    const hpy = toY(s.hometownPortal.position.z);
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(hpx, hpy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌀 Portal ke Hutan', hpx, hpy + 18);
  }

  if (s.currentScene === 'wilds') {
    if (s.wildsPortal) {
      const wpx = toX(s.wildsPortal.position.x);
      const wpy = toY(s.wildsPortal.position.z);
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(wpx, wpy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ff77ff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌀 Ke Desa', wpx, wpy + 16);
    }
    if (s.desertPortalWilds) {
      const dpx = toX(s.desertPortalWilds.position.x);
      const dpy = toY(s.desertPortalWilds.position.z);
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(dpx, dpy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffaa44';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔥 Ke Gurun (Lv.10+)', dpx, dpy + 16);
    }
  }

  if (s.currentScene === 'wilds2' && s.desertPortalWilds2) {
    const dpx = toX(s.desertPortalWilds2.position.x);
    const dpy = toY(s.desertPortalWilds2.position.z);
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(dpx, dpy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffaa44';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌀 Ke Hutan', dpx, dpy + 16);
  }

  // 5. NPCs (Hometown only)
  if (s.currentScene === 'hometown') {
    const npcs = [
      { npc: s.shopNPC, label: '🛒 Toko', color: '#f1c40f' },
      { npc: s.healerNPC, label: '❤️ Tabib', color: '#e74c3c' },
      { npc: s.blacksmithNPC, label: '🔨 Pandai Besi', color: '#e67e22' }
    ];
    npcs.forEach(({ npc, label, color }) => {
      if (npc && npc.position) {
        const nx = toX(npc.position.x), ny = toY(npc.position.z);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(nx, ny, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#f1f2f6';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, nx, ny - 10);
      }
    });
  }

  // 6. Unlooted Treasure Chests
  if (s.interactables && s.interactables.length) {
    s.interactables.forEach(it => {
      if (it.type === 'chest' && !it.looted && it.scene === s.currentScene) {
        const cx = toX(it.x), cy = toY(it.y);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx - 4, cy - 3, 8, 6);
        ctx.strokeStyle = '#4a3200';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 4, cy - 3, 8, 6);
      }
    });
  }

  // 7. Elite Monsters on Full Map
  if (s.enemies && s.enemies.length) {
    s.enemies.forEach(e => {
      if (e.isElite) {
        const ex = toX(e.x), ey = toY(e.y);
        // Golden glowing star icon
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ [Elit]', ex, ey - 9);
      }
    });
  }

  // 8. Boss
  if (s.bossActive && s.currentScene !== 'hometown') {
    const bx = toX(s.bossX), by = toY(s.bossY);
    // Danger radius circle
    ctx.strokeStyle = 'rgba(255, 0, 50, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ff0033';
    ctx.fillRect(bx - 9, by - 9, 18, 18);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 10, by - 10, 20, 20);

    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const bTitle = s.currentScene === 'wilds2' ? '👑 Arena Champion' : '👑 Golden Golem';
    ctx.fillText(bTitle, bx, by - 14);
  }

  // 9. Auto-Walk Waypoint & Path
  if (s.autoWalkTarget) {
    const wx = toX(s.autoWalkTarget.x);
    const wy = toY(s.autoWalkTarget.y);
    const px = toX(s.player.x);
    const py = toY(s.player.y);

    // Dashed path line
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target beacon rings
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(wx, wy, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(wx, wy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Distance tag above waypoint
    const distMeters = Math.round(Math.hypot(s.autoWalkTarget.x - s.player.x, s.autoWalkTarget.y - s.player.y));
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎯 ${distMeters}m`, wx, wy - 14);
  }

  // 10. Player (Position & Direction Cone)
  const px = toX(s.player.x);
  const py = toY(s.player.y);

  const norm = Math.hypot(s.player.facingX, s.player.facingY) || 1;
  const fX = s.player.facingX / norm;
  const fY = s.player.facingY / norm;
  const faceAngle = Math.atan2(fY, fX);

  // Vision cone
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, 32, faceAngle - 0.45, faceAngle + 0.45);
  ctx.closePath();
  ctx.fill();

  // Player Arrow
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2980b9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + fX * 11, py + fY * 11);
  ctx.lineTo(px - fX * 6 - fY * 6, py - fY * 6 + fX * 6);
  ctx.lineTo(px - fX * 3, py - fY * 3);
  ctx.lineTo(px - fX * 6 + fY * 6, py - fY * 6 - fX * 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // "Anda" Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📍 Anda', px, py - 12);

  // 11. Scale Bar in Bottom Left
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(10, mapHeight - 34, 110, 24);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, mapHeight - 34, 110, 24);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const scaleText = s.currentScene === 'hometown' ? '── 200m ──' : '── 2000m ──';
  ctx.fillText(scaleText, 65, mapHeight - 18);

  // 12. Compass Rose in Top Right
  const crX = mapWidth - 36, crY = 36;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(crX, crY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', crX, crY - 6);
  ctx.fillStyle = '#bbb';
  ctx.font = '9px sans-serif';
  ctx.fillText('S', crX, crY + 14);
  ctx.fillText('W', crX - 11, crY + 3);
  ctx.fillText('E', crX + 11, crY + 3);
}

export function handleFullMapClick(e) {
  const canvas = document.getElementById('fullmap-canvas');
  if (!canvas) return;
  const s = state;
  if (!s.isGameStarted || s.gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const clickPxX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickPxY = (e.clientY - rect.top) * (canvas.height / rect.height);

  let targetX, targetY;
  if (s.currentScene === 'hometown') {
    const minX = -100, minY = -100, span = 1200;
    targetX = minX + (clickPxX / canvas.width) * span;
    targetY = minY + (clickPxY / canvas.height) * span;
  } else {
    targetX = (clickPxX / canvas.width) * mapSize;
    targetY = (clickPxY / canvas.height) * mapSize;
  }

  setAutoWalkTarget(targetX, targetY);
  drawFullMap();
}
window.handleFullMapClick = handleFullMapClick;

// Wire full-map canvas click to set auto-walk target
{
  const canvas = document.getElementById('fullmap-canvas');
  if (canvas) {
    canvas.addEventListener('click', handleFullMapClick);
  }
}
