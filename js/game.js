function gameLoop() {
  if (!isGameStarted) return;
  requestAnimationFrame(gameLoop);

  if (!gameOver) {
    if (isPaused) {
      renderer.render(scene, camera);
      return;
    }

    player.defending = !!keys["shift"];
    shieldMesh.visible = player.defending;

    move(); // Menangani semua arah gerakan termasuk serong
    if (keys[" "]) shoot();

    if (player.attackCooldown > 0) player.attackCooldown--;
    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.spinCooldown > 0) player.spinCooldown--;

    if (player.isSpinning > 0) {
       player.isSpinning--;
       playerMesh.rotation.y += 0.5;
    }

    updateProjectiles();
    updateEnemies();
    if (bossActive) updateBoss();
    if (typeof checkInteractions === 'function') checkInteractions();
    updateWeather();
    if (typeof updateParticles === 'function') updateParticles();
    if (typeof updatePet === 'function') updatePet();
    updateUI();
  }

  // Render 3D Scene
  playerMesh.position.set(player.x, 15, player.y);
  
  // Membuat karakter menghadap ke arah jalannya (kecuali jika sedang spin)
  if (player.isSpinning === 0 && (player.facingX !== 0 || player.facingY !== 0)) {
    playerMesh.rotation.y = -Math.atan2(player.facingY, player.facingX);
  }

  // Kamera sekarang mengikuti pemain!
  camera.position.x = player.x;
  camera.position.y = 350;
  camera.position.z = player.y + 400;
  camera.lookAt(player.x, 0, player.y);
  
  if (player.defending) {
    shieldMesh.rotation.y += 0.05;
    shieldMesh.rotation.x += 0.02;
  }

  crystalItems.forEach(item => {
    if (!item.taken) item.mesh.rotation.y += 0.05;
  });
  coinItems.forEach(item => {
    if (!item.taken) item.mesh.rotation.z += 0.05;
  });
  expOrbs.forEach(item => {
    if (!item.taken) item.mesh.rotation.y += 0.05;
  });
  potionItems.forEach(item => {
    if (!item.taken) item.mesh.rotation.y += 0.05;
  });

  renderer.render(scene, camera);
}

function updateWeather() {
  if (bossActive) {
     dayTime = 0.8; // Force storm
  } else {
     dayTime += 0.0001;
     if (dayTime > 1) dayTime = 0;
  }

  let lightIntensity = 0.8;
  let r = 45, g = 79, b = 48; // 0x2d4f30 (siang)
  
  if (dayTime > 0.4) {
     let nightFactor = Math.sin((dayTime - 0.4) * Math.PI * (1/0.6));
     if (nightFactor < 0) nightFactor = 0;
     lightIntensity = 0.8 - (nightFactor * 0.6); 
     r -= nightFactor * 35;
     g -= nightFactor * 59;
     b += nightFactor * 20;
  }
  if (bossActive) {
     r = 80; g = 10; b = 10; // Blood moon
     lightIntensity = 0.3;
  }

  dirLight.intensity = lightIntensity;
  scene.background.setRGB(r/255, g/255, b/255);
  scene.fog.color.setRGB(r/255, g/255, b/255);

  if (bossActive || (dayTime > 0.6 && dayTime < 0.9)) {
     rainParticles.material.opacity = 0.6;
     const positions = rainParticles.geometry.attributes.position.array;
     for (let i = 0; i < 1500; i++) {
        positions[i * 3 + 1] -= 15; 
        if (positions[i * 3 + 1] < 0) {
           positions[i * 3 + 1] = 500;
        }
     }
     rainParticles.geometry.attributes.position.needsUpdate = true;
     rainParticles.position.x = player.x;
     rainParticles.position.z = player.y;
  } else {
     rainParticles.material.opacity = 0;
  }
}

// Mulai Game Loop Utama dipindah ke init.js

window.updateParticles = function() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= p.decay;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
            continue;
        }
        p.mesh.position.x += p.dx;
        p.mesh.position.y += p.dz;
        p.mesh.position.z += p.dy;
        p.mesh.material.opacity = p.life;
        p.mesh.scale.setScalar(p.life);
    }
};

let petAngle = 0;
window.updatePet = function() {
    if (!petActive || !petMesh) return;
    petAngle += 0.05;
    
    let targetX = player.x + Math.cos(petAngle) * 20;
    let targetZ = player.y + Math.sin(petAngle) * 20;
    let targetY = 25 + Math.sin(petAngle * 2) * 5;
    
    petMesh.position.x += (targetX - petMesh.position.x) * 0.1;
    petMesh.position.y += (targetY - petMesh.position.y) * 0.1;
    petMesh.position.z += (targetZ - petMesh.position.z) * 0.1;
    petMesh.rotation.y += 0.1;
    
    if (Math.random() < 0.02) {
        let closest = null;
        let minDist = 200;
        enemies.forEach(e => {
            let d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d < minDist) { minDist = d; closest = e; }
        });
        if (closest) {
            let angle = Math.atan2(closest.y - petMesh.position.z, closest.x - petMesh.position.x);
            let pGeo = new THREE.SphereGeometry(3, 4, 4);
            let pMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
            let m = new THREE.Mesh(pGeo, pMat);
            m.position.copy(petMesh.position);
            scene.add(m);
            projectiles.push({
                x: m.position.x, y: m.position.z,
                dx: Math.cos(angle) * 15, dy: Math.sin(angle) * 15,
                mesh: m, isPet: true
            });
            playSound('shoot');
        }
    }
};

window.teleportTo = function(sceneName) {
    currentScene = sceneName;
    if (sceneName === 'wilds') {
        player.x = 2000;
        player.y = 2100;
        enemies.forEach(e => {
            scene.remove(e.mesh);
            scene.remove(e.hpGroup);
        });
        enemies.length = 0; 
        
        // Spawn batch awal musuh
        let initialSpawns = Math.min(30, 10 + player.level * 2);
        for(let i=0; i<initialSpawns; i++) {
            if (typeof spawnEnemy === 'function') spawnEnemy();
        }
        
        document.getElementById("message").textContent = "Merasuki The Wilds...";
    } else {
        player.x = 10000;
        player.y = 10080;
        document.getElementById("message").textContent = "Kembali ke Safe Haven.";
    }
    playSound('coin'); 
};
