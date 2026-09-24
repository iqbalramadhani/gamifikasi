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
                level = ?, exp = ?, nextExp = ?, camera_y = ?, camera_z = ?, camera_look_y = ? WHERE id = 1`;
            const params = [
                data.x, data.y, data.hp, data.maxHp, data.attackDamage,
                data.gold, data.potions, data.crystalCount, data.currentWeapon, data.currentArmor,
                data.level, data.exp, data.nextExp, data.camera_y, data.camera_z, data.camera_look_y
            ];
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Progres berhasil disimpan!', changes: this.changes });
            });
        } else {
            // Insert jika belum ada
            const sql = `INSERT INTO player_data (
                id, player_x, player_y, hp, maxHp, attackDamage, 
                gold, potions, crystalCount, currentWeapon, currentArmor, level, exp, nextExp, camera_y, camera_z, camera_look_y
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const params = [
                data.x, data.y, data.hp, data.maxHp, data.attackDamage,
                data.gold, data.potions, data.crystalCount, data.currentWeapon, data.currentArmor,
                data.level, data.exp, data.nextExp, data.camera_y, data.camera_z, data.camera_look_y
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
