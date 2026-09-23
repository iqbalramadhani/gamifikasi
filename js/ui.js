function checkItems() {
  crystalItems.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < 28) {
      item.taken = true;
      item.mesh.visible = false;
      crystalCount++;
      playSound('coin');
      document.getElementById("message").textContent = `💎 Crystal ditemukan! ${crystalCount}/${crystalGoal}`;

      if (crystalCount === crystalGoal) {
        // Trigger Boss!
        spawnBoss();
      }
    }
  });

  coinItems.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < 25) {
      item.taken = true;
      item.mesh.visible = false;
      gold++;
      playSound('coin');
    }
  });

  expOrbs.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < player.r + 15) {
      item.taken = true;
      item.mesh.visible = false;
      player.exp += 10;
      playSound('coin');
      if (player.exp >= player.nextExp && typeof levelUp === 'function') {
          levelUp();
      }
    }
  });

  potionItems.forEach(item => {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < player.r + 15) {
      if (potions < 3) {
          item.taken = true;
          item.mesh.visible = false;
          potions++;
          playSound('coin');
          const btn = document.getElementById("btn-potion");
          if (btn) btn.textContent = `🧪 Heal (C) [${potions}]`;
      }
    }
  });
}

let uiThrottle = 0;
let lastHp = -1, lastGold = -1, lastCrystal = -1;

function updateUI() {
  checkItems(); // Logika ambil barang tetap jalan 60 fps
  
  uiThrottle++;
  if (uiThrottle % 6 !== 0) return; // Render minimap & tulisan hanya 10 FPS (60/6) agar ringan

  let curHp = Math.ceil(player.hp);
  if (lastHp !== curHp) {
      document.getElementById("hp").textContent = `${curHp}/${player.maxHp}`;
      lastHp = curHp;
  }
  
  if (lastGold !== gold) {
      document.getElementById("gold").textContent = gold;
      lastGold = gold;
  }
  
  if (lastCrystal !== crystalCount) {
      document.getElementById("crystal").textContent = `${crystalCount}/${crystalGoal}`;
      lastCrystal = crystalCount;
  }
  
  const expEl = document.getElementById("exp");
  const maxExpEl = document.getElementById("max-exp");
  const levelEl = document.getElementById("player-level");
  if (expEl) expEl.textContent = player.exp;
  if (maxExpEl) maxExpEl.textContent = player.nextExp;
  if (levelEl) levelEl.textContent = player.level;
  
  const btnDash = document.getElementById("btn-dash");
  if (btnDash) {
     if (player.dashCooldown > 0) {
        btnDash.style.opacity = 0.4;
        btnDash.textContent = `⏳ ${(player.dashCooldown / 60).toFixed(1)}s`;
     } else {
        btnDash.style.opacity = 1.0;
        btnDash.textContent = `⚡ Dash (Z)`;
     }
  }

  const btnSpin = document.getElementById("btn-spin");
  if (btnSpin) {
     if (player.spinCooldown > 0) {
        btnSpin.style.opacity = 0.4;
        btnSpin.textContent = `⏳ ${(player.spinCooldown / 60).toFixed(1)}s`;
     } else {
        btnSpin.style.opacity = 1.0;
        btnSpin.textContent = `🌀 Spin (X)`;
     }
  }
  
  drawMinimap();
}

function drawMinimap() {
  const mm = document.getElementById("minimap");
  if (!mm) return;
  const ctx = mm.getContext("2d");
  
  // Bersihkan minimap
  ctx.clearRect(0, 0, 150, 150);
  
  // Skala peta ke minimap (4000x4000 ke 150x150)
  const scale = 150 / mapSize;
  
  // Altar (Kuning)
  ctx.fillStyle = "yellow";
  ctx.fillRect((mapSize/2)*scale - 3, (mapSize/2)*scale - 3, 6, 6);
  
  // Crystal (Cyan)
  ctx.fillStyle = "cyan";
  crystalItems.forEach(c => {
    if (!c.taken) ctx.fillRect(c.x*scale - 1, c.y*scale - 1, 2, 2);
  });
  
  // Musuh (Merah)
  ctx.fillStyle = "red";
  enemies.forEach(e => {
    ctx.fillRect(e.x*scale - 1, e.y*scale - 1, 3, 3);
  });
  if (bossActive) {
    ctx.fillStyle = "purple";
    ctx.fillRect(bossX*scale - 4, bossY*scale - 4, 8, 8);
  }
  
  // Pemain (Putih)
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(player.x*scale, player.y*scale, 3, 0, Math.PI*2);
  ctx.fill();
}

function checkInteractions() {
  if (shopCooldown > 0) shopCooldown--;
  
  if (typeof hometownPortal !== 'undefined' && hometownPortal) hometownPortal.rotation.y += 0.05;
  if (typeof wildsPortal !== 'undefined' && wildsPortal) wildsPortal.rotation.y += 0.05;

  let interactText = "";
  
  if (currentScene === 'hometown') {
      let distShop = Math.hypot(player.x - shopNPC.position.x, player.y - shopNPC.position.z);
      if (distShop < 50) {
          interactText = "Tekan [F] untuk Upgrade";
          if (keys["f"] && !shopOpen && shopCooldown === 0) {
              openShop();
          }
      }
      
      let distHeal = Math.hypot(player.x - healerNPC.position.x, player.y - healerNPC.position.z);
      if (distHeal < 50) {
          interactText = "Tekan [F] memulihkan HP (10 Gold)";
          if (keys["f"] && shopCooldown === 0) {
              shopCooldown = 30; 
              if (gold >= 10 && player.hp < player.maxHp) {
                  gold -= 10;
                  player.hp = player.maxHp;
                  playSound('coin');
                  updateUI();
              }
          }
      }
      
      let distPortal = Math.hypot(player.x - hometownPortal.position.x, player.y - hometownPortal.position.z);
      if (distPortal < 50) {
          interactText = "Tekan [F] masuk ke The Wilds";
          if (keys["f"] && shopCooldown === 0) {
              shopCooldown = 60;
              if (typeof teleportTo === 'function') teleportTo('wilds');
          }
      }
      
      if (typeof blacksmithNPC !== 'undefined' && blacksmithNPC) {
          let distBS = Math.hypot(player.x - blacksmithNPC.position.x, player.y - blacksmithNPC.position.z);
          if (distBS < 50) {
              interactText = "Tekan [F] Beli Equipment";
              if (keys["f"] && !blacksmithOpen && shopCooldown === 0) {
                  openBlacksmith();
              }
          }
      }
  } else {
      if (typeof wildsPortal !== 'undefined' && wildsPortal) {
          let distPortal = Math.hypot(player.x - wildsPortal.position.x, player.y - wildsPortal.position.z);
          if (distPortal < 50) {
              interactText = "Tekan [F] pulang ke Kota";
              if (keys["f"] && shopCooldown === 0) {
                  shopCooldown = 60;
                  if (typeof teleportTo === 'function') teleportTo('hometown');
              }
          }
      }
  }
  
  const msgEl = document.getElementById("message");
  if (msgEl) {
      if (interactText !== "") {
          msgEl.textContent = interactText;
      } else if (msgEl.textContent.startsWith("Tekan [F]")) {
          msgEl.textContent = "";
      }
  }
}

window.openShop = function() {
  shopOpen = true;
  isPaused = true;
  document.getElementById('shop').style.display = 'flex';
  document.getElementById('shop-gold').textContent = gold;
};

window.closeShop = function() {
  document.getElementById('shop').style.display = 'none';
  shopOpen = false;
  isPaused = false;
  shopCooldown = 30;
};

window.openBlacksmith = function() {
  blacksmithOpen = true;
  isPaused = true;
  document.getElementById('blacksmith').style.display = 'flex';
  updateBlacksmithUI();
};

window.closeBlacksmith = function() {
  document.getElementById('blacksmith').style.display = 'none';
  blacksmithOpen = false;
  isPaused = false;
  shopCooldown = 30;
};

window.updateBlacksmithUI = function() {
  document.getElementById('blacksmith-gold').textContent = gold;
  
  let wNext = weaponList[currentWeapon + 1];
  if (wNext) {
      document.getElementById('weapon-desc').textContent = `${wNext.name} (DMG +${wNext.damage})`;
      document.getElementById('weapon-cost').textContent = wNext.cost;
      document.getElementById('btn-buy-weapon').disabled = false;
      document.getElementById('btn-buy-weapon').textContent = "Tempa Senjata";
  } else {
      document.getElementById('weapon-desc').textContent = "Max Level";
      document.getElementById('weapon-cost').textContent = "-";
      document.getElementById('btn-buy-weapon').disabled = true;
      document.getElementById('btn-buy-weapon').textContent = "Max Level";
  }
  
  let aNext = armorList[currentArmor + 1];
  if (aNext) {
      document.getElementById('armor-desc').textContent = `${aNext.name} (HP +${aNext.hp})`;
      document.getElementById('armor-cost').textContent = aNext.cost;
      document.getElementById('btn-buy-armor').disabled = false;
      document.getElementById('btn-buy-armor').textContent = "Tempa Armor";
  } else {
      document.getElementById('armor-desc').textContent = "Max Level";
      document.getElementById('armor-cost').textContent = "-";
      document.getElementById('btn-buy-armor').disabled = true;
      document.getElementById('btn-buy-armor').textContent = "Max Level";
  }
};

window.buyWeapon = function() {
  let wNext = weaponList[currentWeapon + 1];
  if (wNext && gold >= wNext.cost) {
      gold -= wNext.cost;
      currentWeapon++;
      player.attackDamage += wNext.damage - weaponList[currentWeapon - 1].damage;
      
      // Ganti warna pedang
      if (typeof playerBladeMat !== 'undefined') {
          playerBladeMat.color.setHex(wNext.color);
      }
      playSound('coin');
      updateBlacksmithUI();
      updateUI();
  }
};

window.buyArmor = function() {
  let aNext = armorList[currentArmor + 1];
  if (aNext && gold >= aNext.cost) {
      gold -= aNext.cost;
      currentArmor++;
      let hpDiff = aNext.hp - armorList[currentArmor - 1].hp;
      player.maxHp += hpDiff;
      player.hp += hpDiff; // Heal instantly by the max hp diff
      
      // Ganti warna armor badan
      if (typeof playerBodyMat !== 'undefined') {
          playerBodyMat.color.setHex(aNext.color);
      }
      playSound('coin');
      updateBlacksmithUI();
      updateUI();
  }
};

window.buyUpgrade = function(type) {
  if (type === 'hp' && gold >= 15) {
    gold -= 15;
    player.maxHp += 20;
    player.hp = player.maxHp;
    upgrades.hpLevel++;
    document.getElementById('shop-hp-level').textContent = "Lv " + upgrades.hpLevel;
  } else if (type === 'atk' && gold >= 20) {
    gold -= 20;
    player.attackDamage += 1;
    upgrades.atkLevel++;
    document.getElementById('shop-atk-level').textContent = "Lv " + upgrades.atkLevel;
  } else if (type === 'spd' && gold >= 15) {
    gold -= 15;
    player.speed += 1;
    upgrades.spdLevel++;
    document.getElementById('shop-spd-level').textContent = "Lv " + upgrades.spdLevel;
  }
  document.getElementById('shop-gold').textContent = gold;
  updateUI();
};

window.levelUp = function() {
    player.level++;
    player.exp -= player.nextExp;
    player.nextExp = Math.floor(player.nextExp * 1.5);
    player.maxHp += 20;
    player.hp = player.maxHp;
    player.attackDamage += 0.5;
    
    playSound('boss_spawn'); 
    if (typeof spawnParticles === 'function') spawnParticles(player.x, player.y, 0xffff00, 50, 'levelup');
    
    const modal = document.getElementById("level-up-modal");
    if (modal) {
        modal.querySelector("p").textContent = `Level ${player.level}! Max HP & Attack Meningkat!`;
        modal.style.display = "flex";
        setTimeout(() => modal.style.display = "none", 3000);
    }
};
