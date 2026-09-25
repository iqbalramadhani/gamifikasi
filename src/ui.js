import * as THREE from 'three';
import { state } from './state.js';
import { mapSize, weaponList, armorList, lootTable } from './constants.js';
import { playSound } from './audio.js';
import { blocked, spawnParticles, checkItems } from './helpers.js';


// ─── UI throttled update ──────────────────────────────────────────────────────

let uiThrottle = 0;
let lastHp = -1, lastGold = -1, lastCrystal = -1;

export function updateUI() {
  checkItems();

  uiThrottle++;
  if (uiThrottle % 6 !== 0) return; // Throttle to ~10 fps for DOM writes

  const s = state;
  const curHp = Math.ceil(s.player.hp);
  if (lastHp !== curHp) {
    document.getElementById('hp').textContent = `${curHp}/${s.player.maxHp}`;
    lastHp = curHp;
  }
  
  const curStamina = Math.floor(s.player.stamina);
  const staminaTextEl = document.getElementById('stamina-text');
  const staminaBarEl = document.getElementById('stamina-bar');
  if (staminaTextEl) staminaTextEl.textContent = `${curStamina}/${s.player.maxStamina}`;
  if (staminaBarEl) staminaBarEl.style.width = `${Math.max(0, (curStamina / s.player.maxStamina) * 100)}%`;

  if (lastGold !== s.gold) {
    document.getElementById('gold').textContent = s.gold;
    lastGold = s.gold;
  }
  if (lastCrystal !== s.crystalCount) {
    document.getElementById('crystal').textContent = `${s.crystalCount}/${s.crystalGoal}`;
    lastCrystal = s.crystalCount;
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
      btnDash.style.opacity = '1.0';
      btnDash.textContent = `⚡ Dash (Z)`;
    }
  }

  const btnSpin = document.getElementById('btn-spin');
  if (btnSpin) {
    if (s.player.spinCooldown > 0) {
      btnSpin.style.opacity = '0.4';
      btnSpin.textContent = `⏳ ${(s.player.spinCooldown / 60).toFixed(1)}s`;
    } else {
      btnSpin.style.opacity = '1.0';
      btnSpin.textContent = `🌀 Spin (X)`;
    }
  }

  drawMinimap();
}

// ─── Minimap ───────────────────────────────────────────────────────────────────

export function drawMinimap() {
  const mm = document.getElementById('minimap');
  if (!mm) return;
  const ctx = mm.getContext('2d');
  ctx.clearRect(0, 0, 150, 150);

  const scale = 150 / mapSize;
  const s = state;

  // Altar
  ctx.fillStyle = 'yellow';
  ctx.fillRect((mapSize / 2) * scale - 3, (mapSize / 2) * scale - 3, 6, 6);

  // Crystals
  ctx.fillStyle = 'cyan';
  s.crystalItems.forEach(c => {
    if (!c.taken) ctx.fillRect(c.x * scale - 1, c.y * scale - 1, 2, 2);
  });

  // Enemies
  ctx.fillStyle = 'red';
  s.enemies.forEach(e => ctx.fillRect(e.x * scale - 1, e.y * scale - 1, 3, 3));

  if (s.bossActive) {
    ctx.fillStyle = 'purple';
    ctx.fillRect(s.bossX * scale - 4, s.bossY * scale - 4, 8, 8);
  }

  // Player
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(s.player.x * scale, s.player.y * scale, 3, 0, Math.PI * 2);
  ctx.fill();
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

  if (s.hometownPortal) s.hometownPortal.rotation.y += 0.05;
  if (s.wildsPortal) s.wildsPortal.rotation.y += 0.05;

  let interactText = '';

  if (s.currentScene === 'hometown') {
    const distShop = Math.hypot(s.player.x - s.shopNPC.position.x, s.player.y - s.shopNPC.position.z);
    if (distShop < 50) {
      interactText = 'Tekan [F] untuk Bicara';
      if (s.keys.f && !s.shopOpen && s.shopCooldown === 0) {
        s.shopCooldown = 30;
        s.keys.f = false;
        startDialogue('Altar Shop', 'Halo pahlawan! Aku dapat memberikanmu berkah kekuatan untuk membantumu mengalahkan monster di Wilds.', openShop);
      }
    }

    const distHeal = Math.hypot(s.player.x - s.healerNPC.position.x, s.player.y - s.healerNPC.position.z);
    if (distHeal < 50) {
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
    if (distPortal < 50) {
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
      if (distBS < 50) {
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
      if (distQB < 50) {
        interactText = 'Tekan [F] Papan Misi';
        if (s.keys.f && s.shopCooldown === 0) {
          s.shopCooldown = 30;
          s.keys.f = false;
          openQuestBoard();
        }
      }
    }
  } else {
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
  }

  const msgEl = document.getElementById('message');
  if (msgEl) {
    if (interactText !== '') msgEl.textContent = interactText;
    else if (msgEl.textContent.startsWith('Tekan [F]')) msgEl.textContent = '';
  }
}

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

export function buyUpgrade(type) {
  const s = state;
  if (type === 'hp' && s.gold >= 15) {
    s.gold -= 15;
    s.player.maxHp += 20;
    s.player.hp = s.player.maxHp;
    s.upgrades.hpLevel++;
    document.getElementById('shop-hp-level').textContent = 'Lv ' + s.upgrades.hpLevel;
  } else if (type === 'atk' && s.gold >= 20) {
    s.gold -= 20;
    s.player.attackDamage += 1;
    s.upgrades.atkLevel++;
    document.getElementById('shop-atk-level').textContent = 'Lv ' + s.upgrades.atkLevel;
  } else if (type === 'spd' && s.gold >= 15) {
    s.gold -= 15;
    s.player.speed += 1;
    s.upgrades.spdLevel++;
    document.getElementById('shop-spd-level').textContent = 'Lv ' + s.upgrades.spdLevel;
  }
  document.getElementById('shop-gold').textContent = s.gold;
  updateUI();
  if (typeof window.saveGame === 'function') window.saveGame(true);
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

  const wNext = weaponList[s.currentWeapon + 1];
  if (wNext) {
    document.getElementById('weapon-desc').textContent = `${wNext.name} (DMG +${wNext.damage})`;
    document.getElementById('weapon-cost').textContent = wNext.cost;
    document.getElementById('btn-buy-weapon').disabled = s.gold < wNext.cost;
    document.getElementById('btn-buy-weapon').textContent = 'Tempa Senjata';
  } else {
    document.getElementById('weapon-desc').textContent = 'Max Level';
    document.getElementById('weapon-cost').textContent = '-';
    document.getElementById('btn-buy-weapon').disabled = true;
    document.getElementById('btn-buy-weapon').textContent = 'Max Level';
  }

  const aNext = armorList[s.currentArmor + 1];
  if (aNext) {
    document.getElementById('armor-desc').textContent = `${aNext.name} (HP +${aNext.hp})`;
    document.getElementById('armor-cost').textContent = aNext.cost;
    document.getElementById('btn-buy-armor').disabled = s.gold < aNext.cost;
    document.getElementById('btn-buy-armor').textContent = 'Tempa Armor';
  } else {
    document.getElementById('armor-desc').textContent = 'Max Level';
    document.getElementById('armor-cost').textContent = '-';
    document.getElementById('btn-buy-armor').disabled = true;
    document.getElementById('btn-buy-armor').textContent = 'Max Level';
  }
}

export function buyWeapon() {
  const s = state;
  const wNext = weaponList[s.currentWeapon + 1];
  if (wNext && s.gold >= wNext.cost) {
    s.gold -= wNext.cost;
    s.currentWeapon++;
    const prevDmg = s.currentWeapon > 0 ? weaponList[s.currentWeapon - 1]?.damage ?? 0 : 0;
    s.player.attackDamage += wNext.damage - prevDmg;
    if (typeof s.playerBladeMat !== 'undefined' && s.playerBladeMat) s.playerBladeMat.color.setHex(wNext.color);
    
    if (s.playerSwordMesh) {
      const baseScale = s.gltfPlayerRef ? 0.5 : 15;
      const newScale = baseScale + s.currentWeapon * (baseScale * 0.3);
      s.playerSwordMesh.scale.set(newScale, newScale, newScale);
      
      s.playerSwordMesh.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.color.setHex(wNext.color);
          child.material.emissive.setHex(wNext.color);
          child.material.emissiveIntensity = s.currentWeapon * 0.3;
        }
      });
    }

    playSound('boss_spawn');
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  }
}

export function buyArmor() {
  const s = state;
  const aNext = armorList[s.currentArmor + 1];
  if (aNext && s.gold >= aNext.cost) {
    s.gold -= aNext.cost;
    s.currentArmor++;
    const prevHp = s.currentArmor > 0 ? armorList[s.currentArmor - 1]?.hp ?? 0 : 0;
    const hpDiff = aNext.hp - prevHp;
    s.player.maxHp += hpDiff;
    s.player.hp += hpDiff;
    if (typeof s.playerBodyMat !== 'undefined' && s.playerBodyMat) s.playerBodyMat.color.setHex(aNext.color);
    
    if (s.gltfPlayerRef) {
      s.gltfPlayerRef.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.color.setHex(aNext.color);
        }
      });
    }

    if (!s.playerAuraLight && s.playerMesh) {
      s.playerAuraLight = new THREE.PointLight(aNext.color, 1 + s.currentArmor * 0.5, 100 + s.currentArmor * 20);
      s.playerAuraLight.position.y = 15;
      s.playerMesh.add(s.playerAuraLight);
    } else if (s.playerAuraLight) {
      s.playerAuraLight.color.setHex(aNext.color);
      s.playerAuraLight.intensity = 1 + s.currentArmor * 0.5;
      s.playerAuraLight.distance = 100 + s.currentArmor * 20;
    }

    playSound('boss_spawn');
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  }
}

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

export function openQuestBoard() {
  document.getElementById('quest-board').style.display = 'flex';
  const s = state;
  if (!s.bountyQuest) {
    s.bountyQuest = { count: 5 + Math.floor(Math.random() * 10), reward: 50 + Math.floor(Math.random() * 100) };
    s.bountyQuestProgress = 0;
  }
  document.getElementById('quest-title').textContent = `Basmi ${s.bountyQuest.count} Monster`;
  document.getElementById('quest-reward').textContent = `${s.bountyQuest.reward} G`;
  
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
    s.player.exp += s.bountyQuest.reward;
    playSound('coin');
    spawnParticles(s.player.x, s.player.y, 0xffff00, 30, 'heal');
    s.bountyQuest = null;
    s.bountyQuestProgress = 0;
    document.getElementById('side-quest-badge').style.display = 'none';
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
    document.getElementById('side-quest-text').textContent = `${s.bountyQuestProgress} / ${s.bountyQuest.count}`;
  }
}

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
  
  for (const [id, count] of Object.entries(s.inventory)) {
    if (count > 0) {
      hasItems = true;
      const lootDef = Object.values(lootTable).find(l => l.id === id);
      const name = lootDef ? lootDef.name : id;
      
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.padding = '5px 0';
      div.style.borderBottom = '1px solid #444';
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = name;
      
      const countSpan = document.createElement('span');
      countSpan.textContent = `x${count}`;
      countSpan.style.color = '#f1c40f';
      
      div.appendChild(nameSpan);
      div.appendChild(countSpan);
      listEl.appendChild(div);
    }
  }
  
  if (!hasItems) {
    listEl.innerHTML = '<p style="text-align:center; color:#888;">Tas kosong...</p>';
  }
}

export function sellAllLoot() {
  const s = state;
  let totalEarned = 0;
  for (const [id, count] of Object.entries(s.inventory)) {
    if (count > 0) {
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
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'z', 'x', 'c', 'v', 'tab', 'f', 'i', '=', '-'].includes(key)) {
    e.preventDefault();
  }
  if (key === 'escape' && typeof window.togglePause === 'function') window.togglePause();
  if (key === 'i') {
    const invEl = document.getElementById('inventory-menu');
    if (invEl && invEl.style.display === 'flex') closeInventory();
    else openInventory();
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
