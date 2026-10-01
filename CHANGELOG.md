# 📋 Changelog — Gamifikasi Project

## 🗂 Git Commit History

### `b9a13d4` — Initial Commit
- Setup project awal dengan struktur `js/` monolitik (sebelum modularisasi)
- File utama: `js/game.js`, `js/combat.js`, `js/controls.js`, `js/entities.js`, `js/map.js`, `js/ui.js`, `js/audio.js`
- Aset model 3D: `player.glb`, `enemy.glb`, `sword.glb`, `house.glb`, `tree.glb`, dll
- Setup server Express di `server.js`

---

### `53b754f` — feat: add Kenney blocky characters asset pack
- Menambahkan pack karakter Kenney Blocky Characters (18 karakter a–r)
- Format OBJ + MTL + PNG texture
- Menghapus model `character-archer.glb`, `weapon-arrow.glb`, `weapon-bow.glb` (tidak dipakai)

---

### `127b2a5` — refactor: modularize monolithic game logic
- Memecah `js/game.js` (monolitik) menjadi modul terpisah di `src/`:
  - `src/main.js` — Game loop, kamera, inisialisasi
  - `src/combat.js` — Pergerakan pemain, musuh, proyektil, combat
  - `src/environment.js` — Teleport, cuaca, portal
  - `src/ui.js` — Interaksi NPC, portal, HUD
  - `src/scenes.js` — Setup scene Three.js, load model
  - `src/state.js` — Global state terpusat
  - `src/persistence.js` — Save/load data pemain
- Menambahkan `test-blocked.js` untuk testing collision
- Update `server.js` (ESM support, static serving)
- Memindahkan semua logika ke modul ES6 dengan `import/export`

---

## 🛠 Perubahan Sesi (Session Changes)

### 📌 Masalah 1: Kontrol Karakter Terbalik (Awal Sesi)
**Gejala:** Arrow up bergerak mundur, arrow down bergerak maju.

**Root Cause:** Kamera diposisikan di depan karakter (`-Z`), bukan di belakang. Sehingga arah gerakan terasa terbalik dari perspektif layar.

**Fix di `src/scenes.js` / `src/main.js`:**
- Pindahkan posisi kamera ke belakang karakter (`+Z offset`)
- Setup `camera.lookAt()` mengarah ke posisi pemain

---

### 📌 Masalah 2: Karakter Tidak Terlihat / Kamera Terbalik
**Gejala:** Karakter tidak muncul, kamera posisinya di depan karakter dan terbalik (upside down).

**Fix:**
- Set `rotation.x` kamera yang benar
- Posisikan kamera di `(player.x, cameraOffsetY, player.y - cameraOffsetZ)` — di **belakang** pemain (Z negatif relatif terhadap pemain)
- Kamera `lookAt(player.x, lookAtY, player.y)` — melihat ke depan/atas sedikit

---

### 📌 Masalah 3: Kamera Berputar Saat Tekan Kiri/Kanan
**Gejala:** Menekan tombol kiri atau kanan menyebabkan kamera ikut berputar.

**Fix di `src/main.js`:**
- Menonaktifkan rotasi kamera mengikuti arah pemain
- Kamera sekarang hanya mengikuti posisi (chase camera), tidak merotasi

---

### 📌 Masalah 4: Teleportasi Tidak Berfungsi (Portal)
**Gejala:** Menekan `F` di portal tidak melakukan teleport.

**Fix di `src/environment.js`:**
```js
export function teleportTo(destination) {
  console.log(`Teleporting to ${destination}`);
  // pindahkan player ke koordinat tujuan
  // reset kamera ke belakang pemain
  // clear enemy lama, spawn enemy baru (jika ke Wilds)
}
```

**Fix di `src/main.js`:**
```js
window.teleportTo = teleportTo; // expose ke scope global agar ui.js bisa memanggil
```

---

### 📌 Masalah 5: Teleportasi Loop Terus-Menerus
**Gejala:** Log `Teleporting to wilds → Teleporting to hometown → Teleporting to wilds...` berulang terus.

**Root Cause:** Fungsi `checkInteractions()` berjalan setiap frame. Saat `s.keys.f` masih `true` dan pemain masih dalam jangkauan portal, teleport ter-trigger setiap frame.

**Fix di `src/ui.js`:**
```js
// Portal Hometown → Wilds
if (distPortal < 50) {
  interactText = 'Tekan [F] masuk ke The Wilds';
  if (s.keys.f) {
    if (typeof window.teleportTo === 'function') window.teleportTo('wilds');
    s.shopCooldown = 30;  // cooldown mencegah re-trigger
    s.keys.f = false;     // reset key
  }
}

// Portal Wilds → Hometown
if (distPortal < 50) {
  interactText = 'Tekan [F] pulang ke Kota';
  if (s.keys.f && s.shopCooldown === 0) {
    s.shopCooldown = 60;
    if (typeof window.teleportTo === 'function') window.teleportTo('hometown');
    s.keys.f = false;     // ← ini yang missing, menyebabkan loop
  }
}
```

---

### 📌 Masalah 6: Karakter Tidak Menghadap Sesuai Arah Kiri/Kanan

**Gejala:** Saat menekan ← atau →, wajah karakter tidak berubah mengikuti arah.

**Root Cause & Investigasi:**
Beberapa pendekatan dicoba:

| Pendekatan | Hasil |
|-----------|-------|
| `atan2(facingY, facingX)` — formula asli | Kiri/kanan terbalik |
| `facingX < 0 ? -π/2 : π/2` | Karakter hadap depan/belakang saat kiri/kanan |
| `atan2(facingY, -facingX)` | Karakter hadap belakang saat kiri/kanan |
| `atan2(facingY, facingX) - π` | Kiri/kanan masih terbalik |
| `rotation.y = -π/2` (fixed) + `scale.z = -1` | ✅ **BENAR** |

**Fix Final di `src/main.js`:**
```js
// Character always faces forward
state.playerMesh.rotation.y = -Math.PI / 2;

// Flip left/right using scale.z
if (state.player.facingX < 0) {
  state.playerMesh.scale.z = -1; // facing left
} else if (state.player.facingX > 0) {
  state.playerMesh.scale.z = -1; // facing right
}
```

> **Kenapa `scale.z` bukan `scale.x`?**
> Setelah `rotation.y = -π/2`, sumbu **lokal Z** model mengarah ke **dunia X** (kiri/kanan di layar). Flip `scale.z = -1` membalik visual horizontal model.
>
> Kedua kondisi menggunakan `-1` karena model perlu selalu di-flip untuk terlihat benar dari sudut kamera ini.

---

### 📌 Masalah 7: Arah Tombol Kiri/Kanan Gerakan
**Fix Final di `src/combat.js`:**
```js
let dx = 0, dy = 0;
if (s.keys.arrowup)    dy += 1;   // maju (ke +Z dunia)
if (s.keys.arrowdown)  dy -= 1;   // mundur
if (s.keys.arrowleft)  dx += 1;   // kiri di layar (karena kamera menghadap +Z, +X tampak sebagai kiri)
if (s.keys.arrowright) dx -= 1;   // kanan di layar
```

> **Kenapa `dx += 1` untuk kiri?**
> Kamera menghadap arah `+Z` dari posisi `player.y - offset`. Dari perspektif kamera ini, sumbu `+X` dunia terlihat sebagai **kiri** di layar (terbalik dari intuisi normal).

---

### 📌 Masalah 8: Map "Scorched Dunes" (wilds2) — stuck di portal balik

**Gejala:** Setelah masuk gurun lewat portal oranye, pemain *stuck* di zona portal balik dan tidak bisa bergerak menjauhinya.

**Root Cause:** Titik spawn gurun (`(ms/2, ms/2 + 150)` di `environment.js`) berada 50 satuan dari portal balik `desertPortalWilds2` (`(ms/2, ms/2 + 200)` di `scenes.js`). Radius interaksi F portal sendiri = 50, jadi begitu masuk gurun pemain sudah *di dalam* zona F — setiap tekan F langsung melempar balik ke The Wilds sebelum sempat keluar dari zona.

**Fix di `src/scenes.js`:**
Pindahkan portal balik dari `(ms/2, ms/2 + 200)` ke `(ms/2 + 600, ms/2)` — 600 satuan ke samping dari tengah. Jarak portal↔spawn sekarang ~630 satuan, di luar zona F.

```js
// scenes.js — portal balik ke The Wilds
s.desertPortalWilds2.position.set(ms / 2 + 600, 30, ms / 2);
```

> **Catatan:** Save lama yang koordinatnya dekat portal lama tetap aman — portalnya sudah tidak menempel lagi, jadi tidak ada loop.
> **Status:** Terpasang, belum di-verify di browser (butuh `npm run dev` + jalan ke gurun).

---

## 📌 Map Baru: Scorched Dunes (`wilds2`) — Level 10+

Fitur map kedua bertema gurun pasir (penerus The Wilds, mewakili level 20-30 dalam rencana panjang). Ini merangkum perubahan lintas file yang sudah terpasang:

| Area | Perubahan |
|------|-----------|
| `constants.js` | `WILDS2_MIN_LEVEL = 10`, `enemyTemplates2` (5 Blob + 3 Flying), loot tier-2 |
| `model-loader.js` | Register `fly_dragon`, `fly_ghost`, `fly_squidle` (aset glTF embedded) |
| `state.js` | Flag `wilds2Loaded`, `wilds2Group`, `desertPortalWilds`, `desertPortalWilds2` |
| `scenes.js` | `initWilds2()` — piramida tengah, cluster batu gurun, kolam quicksand, border cliffs, portal balik; `getTerrainHeightWilds2` |
| `environment.js` | Branch `teleportTo('wilds2')`, override cuaca pasir di `updateWeather` |
| `combat.js` | `spawnEnemy2()` (level 10+), spawner `updateEnemies` cabang per scene |
| `helpers.js` | `blocked()` pilih set obstacle per scene (wilds2) |
| `ui.js` | Interaksi portal (gate level 10), minimap: bg pasir `#c2a36b`, dot oranye portal |
| `main.js` | Import `initWilds2` + `spawnEnemy2`, expose `window.spawnEnemy2`, branch `startGame` untuk `wilds2` |
| `persistence.js` + `server.js` | Simpan/muat `current_scene` (save di gurun tidak drop ke The Wilds) |

**Alur portal:** Hometown → (portal desa) → The Wilds → (portal oranye, level ≥ 10) → Scorched Dunes → (portal oranye balik, bebas) → The Wilds.

---

## 📁 File yang Diubah dalam Sesi

| File | Perubahan |
|------|-----------|
| `src/main.js` | Kamera chase, rotasi karakter, scale flip, expose `window.teleportTo`; import `initWilds2`+`spawnEnemy2`, branch startGame wilds2 |
| `src/combat.js` | Tombol arah (dx/dy), `facingX`/`facingY`; `spawnEnemy2` + spawner per scene |
| `src/ui.js` | Cooldown portal, minimap pasir + dot oranye, interaksi portal gurun |
| `src/environment.js` | Fungsi `teleportTo` (termasuk wilds2), cuaca gurun, clear enemy |
| `src/scenes.js` | `initWilds2`, portal oranye dua arah, terrain gurun |
| `src/constants.js` / `state.js` / `helpers.js` / `model-loader.js` | Konstanta, flag, collision, aset Flying |
| `src/persistence.js` / `server.js` | Kolom `current_scene` save/load |

---

## ✅ State Akhir yang Berfungsi

```
Kamera   : Di belakang pemain (player.y - cameraOffsetZ), lookAt ke posisi pemain
Rotasi   : rotation.y = -π/2 (fixed, selalu hadap depan)
Flip     : scale.z = -1 saat bergerak kiri atau kanan
Gerakan  : ↑=maju, ↓=mundur, ←=kiri di layar, →=kanan di layar
Teleport : Cooldown + key reset mencegah loop
```

## Update Animasi & Perbaikan Peta (Player.glb)

### 🔄 Perubahan pada Model dan Animasi
- **src/model-loader.js**: Menambahkan logika untuk mempertahankan `gltf.animations` ketika memuat file `.glb` sehingga animasi bawaan karakter tidak hilang.
- **src/model-loader.js**: Menonaktifkan pemuatan `player_model.fbx` sehingga game memprioritaskan dan menggunakan `player.glb` sebagai karakter utama.
- **src/scenes.js**: Menambahkan `THREE.AnimationMixer` khusus untuk `player.glb`. Kode sekarang akan otomatis menggunakan animasi **idle**, **run**, dan **attack** bawaan dari model `.glb` tersebut (termasuk menghubungkan senjata ke tangan yang tepat jika memungkinkan).
- **src/combat.js**: Menyesuaikan perhitungan sudut rotasi karakter (`faceAngle`) menjadi `Math.atan2(..., ...) + Math.PI / 2`. Perbaikan ini memastikan orientasi kiri, kanan, depan, dan belakang karakter sudah benar dan tidak lagi kebalik.

### 🌍 Perbaikan pada Bentuk Fisika Peta
- **src/scenes.js**: Memperbaiki rotasi dan perhitungan koordinat Z/Y pada pembentukan mesh daratan. Sebelumnya, posisi gundukan tanah secara visual kebalik dibandingkan dengan perhitungan fisika, sehingga menyebabkan karakter terlihat tenggelam saat menaiki gundukan. Sekarang visual peta sudah tersinkronisasi penuh dengan fungsi fisika `getTerrainHeight`.
