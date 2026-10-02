const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Inisialisasi Database SQLite
const dbPath = path.join(__dirname, 'game_save.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Gagal membuka database SQLite:', err.message);
    } else {
        console.log('✅ Berhasil terhubung ke database SQLite.');
        // Buat tabel jika belum ada
        db.run(`CREATE TABLE IF NOT EXISTS player_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_x REAL,
            player_y REAL,
            hp REAL,
            maxHp REAL,
            attackDamage REAL,
            gold INTEGER,
            potions INTEGER,
            crystalCount INTEGER,
            currentWeapon INTEGER,
            currentArmor INTEGER,
            level INTEGER,
            exp INTEGER,
            nextExp INTEGER
        )`, (err) => {
            if (err) {
                console.error('Error membuat tabel:', err.message);
            } else {
                db.run(`ALTER TABLE player_data ADD COLUMN camera_y INTEGER`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN camera_z INTEGER`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN camera_look_y INTEGER`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN inventory TEXT`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN statPoints INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN stat_str INTEGER DEFAULT 1`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN stat_agi INTEGER DEFAULT 1`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN stat_vit INTEGER DEFAULT 1`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN bountyQuest TEXT`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN bountyQuestProgress INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN lastCrystalUse INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN current_scene TEXT`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN currentHelmet INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN currentBoots INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN ownedWeapons TEXT DEFAULT '[0]'`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN ownedArmors TEXT DEFAULT '[0]'`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN ownedHelmets TEXT DEFAULT '[0]'`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN ownedBoots TEXT DEFAULT '[0]'`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN critChance REAL DEFAULT 0.05`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN critMultiplier REAL DEFAULT 2.0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN questStage INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN questCompleted TEXT DEFAULT '[]'`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN autoHealThreshold INTEGER DEFAULT 50`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN autoSPThreshold INTEGER DEFAULT 30`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN autoAttack INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN autoAttackSpin INTEGER DEFAULT 1`, () => {});
                db.run(`ALTER TABLE player_data ADD COLUMN autoAttackRange INTEGER DEFAULT 140`, () => {});
            }
        });
    }
});

// Endpoint untuk menyimpan data (SAVE)
app.post('/api/save', (req, res) => {
    const data = req.body;
    
    // Kita asumsikan hanya ada 1 slot save (id = 1)
    db.get('SELECT id FROM player_data WHERE id = 1', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (row) {
            // Update jika sudah ada
            const sql = `UPDATE player_data SET
                player_x = ?, player_y = ?, hp = ?, maxHp = ?, attackDamage = ?,
                gold = ?, potions = ?, crystalCount = ?, currentWeapon = ?, currentArmor = ?,
                level = ?, exp = ?, nextExp = ?, camera_y = ?, camera_z = ?, camera_look_y = ?, inventory = ?,
                statPoints = ?, stat_str = ?, stat_agi = ?, stat_vit = ?,
                bountyQuest = ?, bountyQuestProgress = ?, lastCrystalUse = ?, current_scene = ?,
                currentHelmet = ?, currentBoots = ?,
                ownedWeapons = ?, ownedArmors = ?, ownedHelmets = ?, ownedBoots = ?,
                critChance = ?, critMultiplier = ?, questStage = ?, questCompleted = ?,
                autoHealThreshold = ?, autoSPThreshold = ?,
                autoAttack = ?, autoAttackSpin = ?, autoAttackRange = ? WHERE id = 1`;
            const params = [
                data.x, data.y, data.hp, data.maxHp, data.attackDamage,
                data.gold, data.potions, data.crystalCount, data.currentWeapon, data.currentArmor,
                data.level, data.exp, data.nextExp, data.camera_y, data.camera_z, data.camera_look_y, data.inventory,
                data.statPoints, data.stats.str, data.stats.agi, data.stats.vit,
                data.bountyQuest, data.bountyQuestProgress, data.lastCrystalUse, data.current_scene,
                data.currentHelmet, data.currentBoots,
                data.ownedWeapons, data.ownedArmors, data.ownedHelmets, data.ownedBoots,
                data.critChance, data.critMultiplier, data.questStage, data.questCompleted,
                data.autoHealThreshold, data.autoSPThreshold,
                data.autoAttack ?? 0, data.autoAttackSpin ?? 1, data.autoAttackRange ?? 140,
            ];
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Progres berhasil disimpan!', changes: this.changes });
            });
        } else {
            // Insert jika belum ada
            const sql = `INSERT INTO player_data (
                id, player_x, player_y, hp, maxHp, attackDamage,
                gold, potions, crystalCount, currentWeapon, currentArmor, level, exp, nextExp, camera_y, camera_z, camera_look_y, inventory, statPoints, stat_str, stat_agi, stat_vit, bountyQuest, bountyQuestProgress, lastCrystalUse, current_scene,
                currentHelmet, currentBoots, ownedWeapons, ownedArmors, ownedHelmets, ownedBoots,
                critChance, critMultiplier, questStage, questCompleted, autoHealThreshold, autoSPThreshold,
                autoAttack, autoAttackSpin, autoAttackRange
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [
                data.x, data.y, data.hp, data.maxHp, data.attackDamage,
                data.gold, data.potions, data.crystalCount, data.currentWeapon, data.currentArmor,
                data.level, data.exp, data.nextExp, data.camera_y, data.camera_z, data.camera_look_y, data.inventory,
                data.statPoints, data.stats.str, data.stats.agi, data.stats.vit,
                data.bountyQuest, data.bountyQuestProgress, data.lastCrystalUse, data.current_scene,
                data.currentHelmet, data.currentBoots,
                data.ownedWeapons, data.ownedArmors, data.ownedHelmets, data.ownedBoots,
                data.critChance, data.critMultiplier, data.questStage, data.questCompleted,
                data.autoHealThreshold, data.autoSPThreshold,
                data.autoAttack ?? 0, data.autoAttackSpin ?? 1, data.autoAttackRange ?? 140,
            ];
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Progres berhasil dibuat dan disimpan!', id: this.lastID });
            });
        }
    });
});

// Endpoint untuk memuat data (LOAD)
app.get('/api/load', (req, res) => {
    db.get('SELECT * FROM player_data WHERE id = 1', [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            res.json({ success: true, data: row });
        } else {
            res.json({ success: false, message: 'Belum ada data save.' });
        }
    });
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`🚀 Backend Server berjalan di http://localhost:${PORT}`);
});
