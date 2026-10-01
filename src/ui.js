import * as THREE from 'three';
import { state } from './state.js';
import { mapSize, weaponList, armorList, helmetList, bootList, lootTable, consumableItems, WILDS2_MIN_LEVEL } from './constants.js';
import { playSound } from './audio.js';
import { blocked, spawnParticles, checkItems } from './helpers.js';
import { updatePortalAnimations, getTerrainHeight, getTerrainHeightWilds2 } from './scenes.js';


// ─── UI throttled update ──────────────────────────────────────────────────────

let uiThrottle = 0;
let lastHp = -1, lastGold = -1, lastPotions = -1;

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

  const btnTriple = document.getElementById('btn-triple');
  if (btnTriple) {
    if (s.player.tripleCooldown > 0) {
      btnTriple.style.opacity = '0.4';
      btnTriple.textContent = `⏳ ${(s.player.tripleCooldown / 60).toFixed(1)}s`;
    } else {
      btnTriple.style.opacity = '1.0';
      btnTriple.textContent = `⚔️ Triple (R)`;
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

  const s = state;
  const cx = 75, cy = 75;          // center = player
  const range = 1500;               // world units shown at canvas edge
  const scale = 150 / (range * 2);  // map units → px, player-centered
  // World (x,z) → minimap px, offset so player sits at center
  const mx = x => cx + (x - s.player.x) * scale;
  const mz = z => cy + (z - s.player.y) * scale;

  // Background — hometown is green, The Wilds is dark forest green,
  // Scorched Dunes (wilds2) is sandy/tan.
  ctx.fillStyle =
    s.currentScene === 'hometown' ? '#2d4f30'
    : s.currentScene === 'wilds2' ? '#c2a36b'
    : '#1a3a1a';
  ctx.fillRect(0, 0, 150, 150);

  // Altar (center of wilds) — only shown when actually in the Wilds, since
  // the same coordinates point to the pyramid in wilds2.
  if (s.currentScene !== 'wilds2') {
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(mx(mapSize / 2) - 3, mz(mapSize / 2) - 3, 6, 6);
  }

  // Portals
  if (s.hometownPortal) {
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(mx(s.hometownPortal.position.x) - 3, mz(s.hometownPortal.position.z) - 3, 6, 6);
  }
  if (s.wildsPortal) {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(mx(s.wildsPortal.position.x) - 3, mz(s.wildsPortal.position.z) - 3, 6, 6);
  }
  // Desert portals — orange
  if (s.desertPortalWilds && s.currentScene !== 'wilds2') {
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(mx(s.desertPortalWilds.position.x) - 3, mz(s.desertPortalWilds.position.z) - 3, 6, 6);
  }
  if (s.desertPortalWilds2 && s.currentScene === 'wilds2') {
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(mx(s.desertPortalWilds2.position.x) - 3, mz(s.desertPortalWilds2.position.z) - 3, 6, 6);
  }

  // Nearby enemies (max 15 for performance)
  const nearby = s.enemies
    .filter(e => Math.hypot(e.x - s.player.x, e.y - s.player.y) < range)
    .sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y))
    .slice(0, 15);
  ctx.fillStyle = '#ff4444';
  nearby.forEach(e => ctx.fillRect(mx(e.x) - 1.5, mz(e.y) - 1.5, 3, 3));

  // Boss
  if (s.bossActive) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(mx(s.bossX) - 5, mz(s.bossY) - 5, 10, 10);
  }

  // NPCs (shop, healer, blacksmith)
  const npcColor = '#ffcc00';
  [s.shopNPC, s.healerNPC, s.blacksmithNPC].forEach(npc => {
    if (npc && npc.position) {
      ctx.fillStyle = npcColor;
      ctx.fillRect(mx(npc.position.x) - 2, mz(npc.position.z) - 2, 4, 4);
    }
  });

  // Auto-walk waypoint
  if (s.autoWalkTarget) {
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(mx(s.autoWalkTarget.x), mz(s.autoWalkTarget.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Player (centered, always)
  const px = cx, py = cy;
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

  updatePortalAnimations();

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
    updateUI();
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
  
  // Gunakan skala awal yang disimpan agar proporsi kustom terjaga
  if (s.playerSwordMesh) {
    const bs = s.swordBaseScale || { x: 100, y: 180, z: 320 };
    const visualTier = Math.min(idx, 3);
    const factor = 1 + visualTier * 0.15;
    s.playerSwordMesh.scale.set(bs.x * factor, bs.y * factor, bs.z * factor);
    
    // Hapus perubahan material sepenuhnya — partikel aura ditaruh di scene (world space)
    // agar tidak terpengaruh rotasi/skala pedang
    if (s.weaponAuraLight) {
      s.playerSwordMesh.remove(s.weaponAuraLight);
      s.weaponAuraLight = null;
    }
    // Hapus aura lama jika ada
    if (s.weaponAuraGroup) {
      s.scene.remove(s.weaponAuraGroup);
      s.weaponAuraGroup = null;
    }
    // Buat group baru di scene (world space)
    s.weaponAuraGroup = new THREE.Group();
    s.scene.add(s.weaponAuraGroup);
    
    const auraMat = new THREE.MeshBasicMaterial({
      color: wNext.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    });
    for (let i = 0; i < 100 + visualTier * 5; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.25 + visualTier * 0.05, 6, 6), auraMat);
      p.userData = {
        t: Math.random(),                      // posisi di sepanjang bilah (0=pangkal, 1=ujung)
        vt: 0.005 + Math.random() * 0.008,     // kecepatan naik ke ujung pedang
        r: 1.5 + Math.random() * 2.5,          // radius melingkar di sekitar bilah
        angSpeed: 0.5 + Math.random() * 1.5,   // kecepatan putaran
        animOffset: Math.random() * Math.PI * 2
      };
      s.weaponAuraGroup.add(p);
    }
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
    useConsumable('stamina_potion');
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
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'z', 'x', 'r', 'c', 'v', 'tab', 'f', 'i', 'j', 'm', '=', '-'].includes(key)) {
    e.preventDefault();
  }
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
    s.waypointMesh = new THREE.Mesh(
      new THREE.RingGeometry(14, 18, 24),
      new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    s.waypointMesh.rotation.x = -Math.PI / 2;
    s.scene.add(s.waypointMesh);
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
    state.scene?.remove(state.waypointMesh);
    state.waypointMesh.geometry?.dispose?.();
    state.waypointMesh.material?.dispose?.();
    state.waypointMesh = null;
  }
  if (typeof drawMinimap === 'function') drawMinimap();
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
  
    // Auto-walk waypoint
  if (s.autoWalkTarget) {
    const wx = s.autoWalkTarget.x * scale;
    const wy = s.autoWalkTarget.y * scale;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, wy, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(wx, wy, 4, 0, Math.PI * 2);
    ctx.fill();
    // Dashed line from player to waypoint
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(0,255,136,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Click instruction
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px sans-serif';
  ctx.fillText('Klik peta untuk menandai tujuan auto-walk', 10, mapHeight - 10);
}

// Wire full-map canvas click to set auto-walk target
{
  const canvas = document.getElementById('fullmap-canvas');
  if (canvas) {
    canvas.addEventListener('click', e => {
      const s = state;
      if (!s.isGameStarted || s.gameOver) return;

      const rect = canvas.getBoundingClientRect();
      const scale = 600 / mapSize; // same scale used in drawFullMap

      const clickX = (e.clientX - rect.left) / scale;
      const clickY = (e.clientY - rect.top) / scale;

      setAutoWalkTarget(clickX, clickY);
      drawFullMap();
    });
  }
}
