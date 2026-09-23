window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift", "z", "x", "c"].includes(key)) {
    e.preventDefault();
  }
  if (key === "escape" && typeof togglePause === 'function') {
      togglePause();
  }
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

function move() {
  if (gameOver || isPaused || typeof isGameStarted === 'undefined' || !isGameStarted) return;

  let dx = 0, dy = 0;
  if (keys.arrowup) dy -= 1;
  if (keys.arrowdown) dy += 1;
  if (keys.arrowleft) dx -= 1;
  if (keys.arrowright) dx += 1;

  if (dx !== 0 || dy !== 0) {
    // Normalisasi arah agar serong (diagonal) tidak lebih cepat dari lurus
    let length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    
    player.facingX = dx;
    player.facingY = dy;
    
    if (keys.c) {
       keys.c = false;
       usePotion();
    }
    
    if (keys.z && player.dashCooldown <= 0) {
       player.dashCooldown = 180;
       player.isDashing = 15;
       playSound('dash');
       if (typeof spawnParticles === 'function') {
           spawnParticles(player.x, player.y, 0xaaaaaa, 5, 'dust');
       }
    }
    if (keys.x && player.spinCooldown <= 0) {
       player.spinCooldown = 300;
       player.isSpinning = 30;
       playSound('spin');
       for (let i = enemies.length - 1; i >= 0; i--) {
          let e = enemies[i];
          if (Math.hypot(e.x - player.x, e.y - player.y) < player.r + e.r + 50) {
             e.hp -= player.attackDamage * 3;
             e.slowTimer = 90;
             if (e.hp <= 0) {
                scene.remove(e.mesh);
                scene.remove(e.hpGroup);
                enemies.splice(i, 1);
                gold += 5;
                playSound('hit');
                if (typeof spawnParticles === 'function') spawnParticles(e.x, e.y, 0xff0000, 20, 'death');
                
                 let expGeo = new THREE.DodecahedronGeometry(5, 0);
                 let expMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
                 let expMesh = new THREE.Mesh(expGeo, expMat);
                 expMesh.position.set(e.x, 10, e.y);
                 scene.add(expMesh);
                 expOrbs.push({ x: e.x, y: e.y, mesh: expMesh, taken: false });
                 
                 if (Math.random() < 0.15) {
                     let potGeo = new THREE.CylinderGeometry(3, 3, 8, 8);
                     let potMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
                     let potMesh = new THREE.Mesh(potGeo, potMat);
                     potMesh.position.set(e.x + 10, 10, e.y + 10);
                     scene.add(potMesh);
                     potionItems.push({ x: e.x + 10, y: e.y + 10, mesh: potMesh, taken: false });
                 }
             } else {
                 if (typeof spawnParticles === 'function') spawnParticles(e.x, e.y, 0xffaa00, 5, 'hit');
             }
          }
       }
       if (bossActive && Math.hypot(bossX - player.x, bossY - player.y) < player.r + 60 + 50) {
           bossHp -= player.attackDamage * 3;
           playSound('hit');
       }
    }

    let currentSpeed = player.defending ? player.speed * 0.4 : player.speed;
    if (player.isDashing > 0) {
       currentSpeed *= 3.5;
       player.isDashing--;
    }
    
    let nx = player.x + dx * currentSpeed;
    let ny = player.y + dy * currentSpeed;

    if (!blocked(nx, player.y)) player.x = nx;
    if (!blocked(player.x, ny)) player.y = ny;

    // Animasi Jalan (ayunan kaki)
    player.walkCycle += currentSpeed * 0.08;
    if (player.leftHip && player.rightHip) {
       player.leftHip.rotation.z = Math.sin(player.walkCycle) * 0.6;
       player.rightHip.rotation.z = Math.sin(player.walkCycle + Math.PI) * 0.6;
    }
  } else {
    // Berdiri tegak jika tidak berjalan
    player.walkCycle = 0;
    if (player.leftHip && player.rightHip) {
       player.leftHip.rotation.z = 0;
       player.rightHip.rotation.z = 0;
    }
  }
  updateUI();
}

const projGeo = new THREE.SphereGeometry(6, 8, 8);
const projMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

function shoot() {
  if (player.attackCooldown > 0 || gameOver || isPaused || !isGameStarted) return;
  player.attackCooldown = 15; 
  playSound('shoot');
  
  const mesh = new THREE.Mesh(projGeo, projMat);
  mesh.position.set(player.x, 15, player.y);
  scene.add(mesh);
  
  projectiles.push({
    x: player.x,
    y: player.y,
    dx: player.facingX * 10,
    dy: player.facingY * 10,
    mesh: mesh
  });
}

window.usePotion = function() {
  if (potions > 0 && player.hp < player.maxHp) {
      potions--;
      player.hp = Math.min(player.maxHp, player.hp + 40);
      playSound('coin'); 
      if (typeof spawnParticles === 'function') {
          spawnParticles(player.x, player.y, 0x00ff00, 10, 'heal');
      }
      const btn = document.getElementById("btn-potion");
      if (btn) btn.textContent = `🧪 Heal (C) [${potions}]`;
  }
};
