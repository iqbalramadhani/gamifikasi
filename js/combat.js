function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.mesh.position.set(p.x, 15, p.y);

    if (blocked(p.x, p.y, 6)) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }
    
    let hit = false;
    
    if (p.isEnemy) {
       if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 10) {
          hit = true;
          if (!player.defending) {
             player.hp -= 15; // Damage bos
             updateUI();
             playSound('hit');
             if (player.hp <= 0) {
                gameOver = true;
                document.getElementById("message").textContent = "💀 Tembakan Bos mengakhiri petualanganmu!";
                document.getElementById("lose").style.display = "flex";
             }
          }
       }
    } else {
       for (let j = enemies.length - 1; j >= 0; j--) {
         let e = enemies[j];
         if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 6) {
           e.hp -= player.attackDamage;
           e.slowTimer = 90;
           hit = true;
           playSound('hit');
           if (e.hp <= 0) {
             scene.remove(e.mesh);
             scene.remove(e.hpGroup);
             enemies.splice(j, 1);
             gold += 5;
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
           break;
         }
       }
       
       if (!hit && bossActive) {
          if (Math.hypot(p.x - bossX, p.y - bossY) < 30 + 6) {
             bossHp -= player.attackDamage;
             hit = true;
             playSound('hit');
          }
       }
    }
    
    if (hit) {
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

let spawnTimer = 0;

function updateEnemies() {
  if (currentScene === 'hometown') return;
  
  if (typeof isGameStarted !== 'undefined' && isGameStarted && !bossActive) {
      spawnTimer++;
      let spawnRate = Math.max(60, 180 - (player.level * 10)); 
      let maxEnemies = Math.min(60, 20 + (player.level * 5)); 
      if (spawnTimer > spawnRate && enemies.length < maxEnemies) {
          spawnTimer = 0;
          if (typeof spawnEnemy === 'function') {
              let edgeX = player.x + (Math.random() < 0.5 ? 800 : -800);
              let edgeY = player.y + (Math.random() < 0.5 ? 800 : -800);
              edgeX = Math.max(50, Math.min(mapSize - 50, edgeX));
              edgeY = Math.max(50, Math.min(mapSize - 50, edgeY));
              spawnEnemy(edgeX, edgeY);
          }
      }
  }

  for (let index = enemies.length - 1; index >= 0; index--) {
    let enemy = enemies[index];
    let distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);

    if (enemy.stunTimer > 0) {
       enemy.stunTimer--;
    } else {
       let currentBase = enemy.baseSpeed;
       let speed = (enemy.slowTimer > 0) ? currentBase * 0.4 : currentBase; 
       if (enemy.slowTimer > 0) enemy.slowTimer--;

       if (distToPlayer < 400) {
         let angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
         
         if (enemy.type === 'archer') {
             if (distToPlayer > 180) {
                 enemy.dx = Math.cos(angle) * speed;
                 enemy.dy = Math.sin(angle) * speed;
             } else {
                 enemy.dx = 0;
                 enemy.dy = 0;
             }
             if (enemy.attackTimer === undefined) enemy.attackTimer = 0;
             enemy.attackTimer++;
             if (enemy.attackTimer > 120 && distToPlayer < 250) {
                 enemy.attackTimer = 0;
                 let projGeo = new THREE.SphereGeometry(4, 4, 4);
                 let projMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                 let m = new THREE.Mesh(projGeo, projMat);
                 m.position.set(enemy.x, 10, enemy.y);
                 scene.add(m);
                 projectiles.push({
                     x: enemy.x, y: enemy.y,
                     dx: Math.cos(angle) * 8, dy: Math.sin(angle) * 8,
                     mesh: m, isEnemy: true
                 });
                 playSound('shoot');
             }
         } else {
             enemy.dx = Math.cos(angle) * speed;
             enemy.dy = Math.sin(angle) * speed;
         }
       } else {
         let spd = Math.hypot(enemy.dx, enemy.dy);
         if (spd !== speed && spd !== 0) {
            enemy.dx = (enemy.dx / spd) * speed;
            enemy.dy = (enemy.dy / spd) * speed;
         }
       }
    }

    let nx = enemy.x + enemy.dx * 1.5;
    let ny = enemy.y + enemy.dy * 1.5;

    if (enemy.type === 'ghost') {
        enemy.x = nx;
        enemy.y = ny;
    } else {
        if (blocked(nx, ny, enemy.r)) {
          if (!blocked(nx, enemy.y, enemy.r)) {
            enemy.x = nx;
          } else if (!blocked(enemy.x, ny, enemy.r)) {
            enemy.y = ny;
          } else {
            if (distToPlayer >= 350) {
              enemy.dx *= -1;
              enemy.dy *= -1;
            }
          }
        } else {
          enemy.x = nx;
          enemy.y = ny;
        }
    }
    
    enemy.mesh.position.set(enemy.x, enemy.meshY, enemy.y);
    
    if (enemy.baseSpeed < 1.0) {
       enemy.mesh.rotation.y += 0.02;
    } else {
       enemy.mesh.rotation.x += 0.05;
       enemy.mesh.rotation.y += 0.05;
    }

    enemy.hpGroup.position.set(enemy.x, enemy.meshY + 23, enemy.y);
    enemy.hpGroup.lookAt(camera.position);
    
    let hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
    enemy.hpFg.scale.x = Math.max(0.001, hpPercent); 
    enemy.hpFg.position.x = -(24 - (24 * hpPercent)) / 2;

    if (distToPlayer < player.r + enemy.r && enemy.hp > 0) {
      if (enemy.type === 'kamikaze') {
          if (typeof spawnParticles === 'function') spawnParticles(enemy.x, enemy.y, 0xff8800, 50, 'death');
          playSound('hit');
          player.hp = Math.max(0, player.hp - 20); 
          updateUI();
          enemy.hp = 0;
          scene.remove(enemy.mesh);
          scene.remove(enemy.hpGroup);
          enemies.splice(index, 1);
          if (player.hp <= 0) {
              player.hp = player.maxHp;
              gold = Math.max(0, Math.floor(gold / 2));
              if (typeof teleportTo === 'function') teleportTo('hometown');
              document.getElementById("message").textContent = "💀 Anda pingsan! Terlempar kembali ke Kota.";
          }
      } else if (player.defending) {
        let angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        enemy.dx = Math.cos(angle) * 5;
        enemy.dy = Math.sin(angle) * 5;
        enemy.stunTimer = 15;
      } else {
        let damage = 0.3; 
        player.hp = Math.max(0, player.hp - damage);
        updateUI();

        if (player.hp <= 0) {
            player.hp = player.maxHp;
            gold = Math.max(0, Math.floor(gold / 2));
            if (typeof teleportTo === 'function') teleportTo('hometown');
            document.getElementById("message").textContent = "💀 Anda pingsan! Terlempar kembali ke Kota.";
        }
      }
    }
  }
}

window.updateBoss = function() {
  if (!bossActive || !bossMesh) return;
  
  let dist = Math.hypot(player.x - bossX, player.y - bossY);
  let angle = Math.atan2(player.y - bossY, player.x - bossX);
  
  if (dist > 80) {
    bossX += Math.cos(angle) * 1.5;
    bossY += Math.sin(angle) * 1.5;
  }
  
  bossMesh.position.set(bossX, 30, bossY);
  bossMesh.rotation.y += 0.02;
  bossMesh.rotation.x = Math.sin(Date.now() / 300) * 0.2;
  
  bossHpGroup.position.set(bossX, 80, bossY);
  bossHpGroup.lookAt(camera.position);
  let pct = Math.max(0, bossHp / bossMaxHp);
  bossHpFg.scale.x = Math.max(0.001, pct);
  bossHpFg.position.x = -(80 - (80 * pct)) / 2;
  
  if (Math.random() < 0.05) { 
     let bossProjGeo = new THREE.SphereGeometry(10, 8, 8);
     let bossProjMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
     let m = new THREE.Mesh(bossProjGeo, bossProjMat);
     m.position.set(bossX, 30, bossY);
     scene.add(m);
     
     let pAngle = angle + (Math.random() - 0.5);
     projectiles.push({
        x: bossX, y: bossY,
        dx: Math.cos(pAngle) * 8,
        dy: Math.sin(pAngle) * 8,
        mesh: m,
        isEnemy: true
     });
     playSound('shoot'); 
  }
  
  if (dist < player.r + 30) {
      if (!player.defending) {
          player.hp -= 1.0;
          updateUI();
          if (player.hp <= 0) {
             gameOver = true;
             document.getElementById("message").textContent = "💀 Kamu dihancurkan The Golden Golem!";
             document.getElementById("lose").style.display = "flex";
          }
      } else {
          bossX -= Math.cos(angle) * 10;
          bossY -= Math.sin(angle) * 10;
      }
  }
  
  if (bossHp <= 0) {
      scene.remove(bossMesh);
      scene.remove(bossHpGroup);
      bossActive = false;
      gameOver = true;
      playSound('coin');
      if (typeof spawnParticles === 'function') spawnParticles(bossX, bossY, 0xffd700, 100, 'death');
      document.getElementById("win").style.display = "flex";
      document.getElementById("message").textContent = "👑 The Golden Golem telah dikalahkan!";
  }
};
