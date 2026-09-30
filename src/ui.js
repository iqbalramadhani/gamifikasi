import * as THREE from 'three';
import { state } from './state.js';
import { mapSize, weaponList, armorList, helmetList, bootList, lootTable, consumableItems } from './constants.js';
import { playSound } from './audio.js';
import { blocked, spawnParticles, checkItems } from './helpers.js';


// ─── UI throttled update ──────────────────────────────────────────────────────

let uiThrottle = 0;
let lastHp = -1, lastGold = -1;

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
  
  const atkEl = document.getElementById('atk');
  if (atkEl) atkEl.textContent = s.player.attackDamage;
  const critEl = document.getElementById('crit-chance');
  if (critEl) critEl.textContent = `${(s.critChance * 100).toFixed(1)}%`;
  
  const curStamina = Math.floor(s.player.stamina);
  const staminaTextEl = document.getElementById('stamina-text');
  const staminaBarEl = document.getElementById('stamina-bar');
  if (staminaTextEl) staminaTextEl.textContent = `${curStamina}/${s.player.maxStamina}`;
  if (staminaBarEl) staminaBarEl.style.width = `${Math.max(0, (curStamina / s.player.maxStamina) * 100)}%`;

  if (lastGold !== s.gold) {
    document.getElementById('gold').textContent = s.gold;
    lastGold = s.gold;
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

  // Background
  ctx.fillStyle = s.currentScene === 'hometown' ? '#2d4f30' : '#1a3a1a';
  ctx.fillRect(0, 0, 150, 150);

  // Altar (center of wilds)
  ctx.fillStyle = '#ffd700';
  ctx.fillRect((mapSize / 2) * scale - 3, (mapSize / 2) * scale - 3, 6, 6);

  // Portals
  if (s.hometownPortal) {
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(s.hometownPortal.position.x * scale - 3, s.hometownPortal.position.z * scale - 3, 6, 6);
  }
  if (s.wildsPortal) {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(s.wildsPortal.position.x * scale - 3, s.wildsPortal.position.z * scale - 3, 6, 6);
  }

  // Nearby enemies (max 15 for performance)
  const nearby = s.enemies
    .filter(e => Math.hypot(e.x - s.player.x, e.y - s.player.y) < 1500)
    .sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y))
    .slice(0, 15);
  ctx.fillStyle = '#ff4444';
  nearby.forEach(e => ctx.fillRect(e.x * scale - 1.5, e.y * scale - 1.5, 3, 3));

  // Boss
  if (s.bossActive) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(s.bossX * scale - 5, s.bossY * scale - 5, 10, 10);
  }

  // NPCs (shop, healer, blacksmith)
  const npcColor = '#ffcc00';
  [s.shopNPC, s.healerNPC, s.blacksmithNPC].forEach(npc => {
    if (npc && npc.position) {
      ctx.fillStyle = npcColor;
      ctx.fillRect(npc.position.x * scale - 2, npc.position.z * scale - 2, 4, 4);
    }
  });

  // Player (centered, always)
  const px = 75, py = 75;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();

  // Direction indicator
  const dirLen = 8;
  const dirAngle = Math.atan2(s.player.facingX, s.player.facingY);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.sin(dirAngle) * dirLen, py - Math.cos(dirAngle) * dirLen);
  ctx.stroke();

  // Border
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 150, 150);
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

  const highestW = Math.max(...s.ownedWeapons);
  const wNext = weaponList[highestW + 1];
  if (wNext && highestW + 1 < weaponList.length - 1) { // exclude excalibur
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

  const highestA = Math.max(...s.ownedArmors);
  const aNext = armorList[highestA + 1];
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

  const highestH = Math.max(...s.ownedHelmets);
  const hNext = helmetList[highestH + 1];
  if (hNext) {
    document.getElementById('helmet-desc').textContent = `${hNext.name} (HP +${hNext.hp})`;
    document.getElementById('helmet-cost').textContent = hNext.cost;
    document.getElementById('btn-buy-helmet').disabled = s.gold < hNext.cost;
    document.getElementById('btn-buy-helmet').textContent = 'Tempa Helm';
  } else {
    document.getElementById('helmet-desc').textContent = 'Max Level';
    document.getElementById('helmet-cost').textContent = '-';
    document.getElementById('btn-buy-helmet').disabled = true;
    document.getElementById('btn-buy-helmet').textContent = 'Max Level';
  }

  const highestB = Math.max(...s.ownedBoots);
  const bNext = bootList[highestB + 1];
  if (bNext) {
    document.getElementById('boots-desc').textContent = `${bNext.name} (Speed +${bNext.speed})`;
    document.getElementById('boots-cost').textContent = bNext.cost;
    document.getElementById('btn-buy-boots').disabled = s.gold < bNext.cost;
    document.getElementById('btn-buy-boots').textContent = 'Tempa Boots';
  } else {
    document.getElementById('boots-desc').textContent = 'Max Level';
    document.getElementById('boots-cost').textContent = '-';
    document.getElementById('btn-buy-boots').disabled = true;
    document.getElementById('btn-buy-boots').textContent = 'Max Level';
  }
}

export function buyWeapon() {
  const s = state;
  // Blacksmith sells the NEXT unowned weapon in the sequence, up to max index (excluding Legendary)
  const highestOwned = Math.max(...s.ownedWeapons);
  const wNextIdx = highestOwned + 1;
  const wNext = weaponList[wNextIdx];
  if (wNext && s.gold >= wNext.cost && wNextIdx < weaponList.length - 1) { // exclude excalibur
    s.gold -= wNext.cost;
    s.ownedWeapons.push(wNextIdx);
    
    playSound('boss_spawn');
    equipWeapon(wNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  }
}

export function buyHelmet() {
  const s = state;
  const highestOwned = Math.max(...s.ownedHelmets);
  const hNextIdx = highestOwned + 1;
  const hNext = helmetList[hNextIdx];
  if (hNext && s.gold >= hNext.cost) {
    s.gold -= hNext.cost;
    s.ownedHelmets.push(hNextIdx);
    playSound('coin');
    equipHelmet(hNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  }
}

export function buyBoots() {
  const s = state;
  const highestOwned = Math.max(...s.ownedBoots);
  const bNextIdx = highestOwned + 1;
  const bNext = bootList[bNextIdx];
  if (bNext && s.gold >= bNext.cost) {
    s.gold -= bNext.cost;
    s.ownedBoots.push(bNextIdx);
    playSound('coin');
    equipBoots(bNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
  }
}

window.equipWeapon = (idx) => {
  const s = state;
  if (!s.ownedWeapons.includes(idx)) return;
  const prevDmg = weaponList[s.currentWeapon]?.damage ?? 0;
  s.currentWeapon = idx;
  const wNext = weaponList[idx];
  s.player.attackDamage += (wNext.damage - prevDmg);
  
  if (typeof s.playerBladeMat !== 'undefined' && s.playerBladeMat) s.playerBladeMat.color.setHex(wNext.color);
  if (s.playerSwordMesh) {
    const baseScale = s.gltfPlayerRef ? 250 : 15;
    // Cap visual scaling
    const visualTier = Math.min(idx, 3);
    const newScale = baseScale + visualTier * (baseScale * 0.3);
    s.playerSwordMesh.scale.set(newScale, newScale, newScale);
    
    s.playerSwordMesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.color.setHex(wNext.color);
        child.material.emissive.setHex(wNext.color);
        child.material.emissiveIntensity = visualTier * 0.3;
      }
    });
  }
  updateInventoryUI();
};

export function buyArmor() {
  const s = state;
  const highestOwned = Math.max(...s.ownedArmors);
  const aNextIdx = highestOwned + 1;
  const aNext = armorList[aNextIdx];
  if (aNext && s.gold >= aNext.cost) {
    s.gold -= aNext.cost;
    s.ownedArmors.push(aNextIdx);
    
    playSound('boss_spawn');
    equipArmor(aNextIdx);
    updateBlacksmithUI();
    updateUI();
    if (typeof window.saveGame === 'function') window.saveGame(true);
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
    s.playerAuraLight = new THREE.PointLight(aNext.color, 1 + idx * 0.5, 100 + idx * 20);
    s.playerAuraLight.position.y = 15;
    s.playerMesh.add(s.playerAuraLight);
  } else if (s.playerAuraLight) {
    s.playerAuraLight.color.setHex(aNext.color);
    s.playerAuraLight.intensity = 1 + idx * 0.5;
    s.playerAuraLight.distance = 100 + idx * 20;
  }
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
  if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
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
  if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
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
    document.getElementById('side-quest-text').textContent = `${s.bountyQuestProgress} / ${s.bountyQuest.count}`;
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
      const icon = lootDef && lootDef.icon ? lootDef.icon : '';
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
  s.inventory[resultId] = (s.inventory[resultId] ?? 0) + 1;
  playSound('coin');
  if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
  if (typeof window.saveGame === 'function') window.saveGame(true);
  const msgEl = document.getElementById('message');
  if (msgEl) msgEl.textContent = '✅ Crafting berhasil!';
}

export function useConsumable(id) {
  const s = state;
  const def = consumableItems[id];
  if (!def || !s.inventory || !s.inventory[id] || s.inventory[id] <= 0) return;

  const now = Date.now();
  if (now - (s.lastCrystalUse || 0) < def.cooldown * 16.667) {
    const msgEl = document.getElementById('message');
    if (msgEl) msgEl.textContent = '⏳ Item ini masih cooldown!';
    return;
  }

  s.inventory[id]--;

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
  }

  if (typeof window.updateUI === 'function') window.updateUI();
  if (typeof window.updateInventoryUI === 'function') window.updateInventoryUI();
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
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'z', 'x', 'c', 'v', 'tab', 'f', 'i', 'm', '=', '-'].includes(key)) {
    e.preventDefault();
  }
  if (key === 'escape' && typeof window.togglePause === 'function') window.togglePause();
  if (key === 'i') {
    const invEl = document.getElementById('inventory-menu');
    if (invEl && invEl.style.display === 'flex') closeInventory();
    else openInventory();
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

export function drawFullMap() {
  const canvas = document.getElementById('fullmap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const mapWidth = 600;
  const mapHeight = 600;
  ctx.clearRect(0, 0, mapWidth, mapHeight);

  // Background
  ctx.fillStyle = '#1a3a1a';
  ctx.fillRect(0, 0, mapWidth, mapHeight);

  const scale = mapWidth / mapSize;
  const s = state;

  // Altar (Center)
  ctx.fillStyle = '#ffd700';
  ctx.fillRect((mapSize / 2) * scale - 4, (mapSize / 2) * scale - 4, 8, 8);

  // Portals
  if (s.hometownPortal) {
    ctx.fillStyle = '#00ffff'; // Desa
    ctx.beginPath();
    ctx.arc(s.hometownPortal.position.x * scale, s.hometownPortal.position.z * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.wildsPortal) {
    ctx.fillStyle = '#ff00ff'; // Hutan
    ctx.beginPath();
    ctx.arc(s.wildsPortal.position.x * scale, s.wildsPortal.position.z * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Boss
  if (s.bossActive || (s.bossX && s.bossY)) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(s.bossX * scale - 8, s.bossY * scale - 8, 16, 16);
  }

  // NPCs
  const npcColor = '#ffcc00';
  [s.shopNPC, s.healerNPC, s.blacksmithNPC].forEach(npc => {
    if (npc && npc.position) {
      ctx.fillStyle = npcColor;
      ctx.beginPath();
      ctx.arc(npc.position.x * scale, npc.position.z * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Player
  ctx.fillStyle = '#ffffff';
  const px = s.player.x * scale;
  const py = s.player.y * scale;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Direction indicator
  const dirLen = 12;
  const dirAngle = Math.atan2(s.player.facingX, s.player.facingY);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.sin(dirAngle) * dirLen, py - Math.cos(dirAngle) * dirLen);
  ctx.stroke();
}
