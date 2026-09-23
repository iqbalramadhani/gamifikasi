# AI CODING GUIDE: THE LOST KINGDOM 3D

File ini ditujukan untuk memberikan konteks cepat kepada AI (Artificial Intelligence) atau asisten koding lainnya (seperti Cursor, Copilot, atau LLM lainnya) mengenai struktur, arsitektur, dan status pengembangan game **The Lost Kingdom 3D**.

## 1. Arsitektur Proyek
Game ini dibangun murni menggunakan **HTML5**, **Vanilla JavaScript**, dan **Three.js (r128)** tanpa *bundler* (Webpack/Vite). Semua aset (mesh/material) dibuat secara prosedural (*primitives*) tanpa file eksternal 3D.

- **Main HTML**: `lost_kingdom_adventure (1).html`
- **Main CSS**: `style.css`
- **Folder JS**: `/js/` (berisi skrip modular).

## 2. Peta File JavaScript (`/js/`)
1. **`globals.js`**: Pusat variabel global dan konfigurasi *State Management*.
   - Menyimpan objek `player`, array `weaponList`, `armorList`, `gold`, `crystalCount`, `currentScene` ('hometown' atau 'wilds'), dan variabel kontrol *pause/shop/blacksmith*.
2. **`init.js`**: Titik masuk (*Entry Point*). Memuat *Scene*, *Camera*, *Renderer*, Lighting, UI event listeners, dan memanggil fungsi inisialisasi dari file lain.
3. **`map.js`**: Generator Peta.
   - `initMap()`: Membangun hutan *The Wilds* (Pohon, batu, obstacle).
   - `initHometown()`: Membangun markas (*Safe Haven*) di koordinat `10000, 10000` lengkap dengan plaza batu, pagar kayu, air mancur, tenda toko, dan bengkel pandai besi.
4. **`entities.js`**: Definisi Mesh/Model 3D.
   - Membuat model 3D Pemain (tubuh, kepala, pedang). Mengekspos material secara global (seperti `window.playerBladeMat` dan `window.playerBodyMat`) agar bisa diubah warnanya saat *upgrade* *equipment*.
   - `initNPCs()`: Memunculkan *Merchant*, *Healer*, dan *Blacksmith* di Hometown.
5. **`controls.js`**: Menangani input *Keyboard* dan *Touch/Mobile* (Panah, WASD, Z, X, C, Shift, Spasi).
6. **`combat.js`**: Logika pertarungan, deteksi *Hitbox*, AI pergerakan musuh, sistem *Respawn* dan hukuman mati (hilang 50% *Gold*).
7. **`ui.js`**: Logika HUD dan Menu Modal.
   - `checkInteractions()`: Deteksi jarak pemain dengan NPC/Portal untuk menampilkan prompt `[F]`.
   - `updateUI()`, `updateBlacksmithUI()`: Memperbarui teks DOM HTML.
   - `buyWeapon()`, `buyArmor()`: Logika potong *Gold*, penambahan Stat, dan pengubahan warna 3D model.
8. **`game.js`**: Utama dari *Game Loop* (`requestAnimationFrame`), pengaturan posisi kamera, dan fungsi `teleportTo()` untuk berpindah dimensi antar peta.
9. **`audio.js`**: Sistem suara prosedural menggunakan *Web Audio API* (Oscillators).

## 3. Sistem Mekanik Penting
- **Teleportasi / Scene Transition**: Game tidak berpindah file HTML. Teleportasi antara *Hometown* dan *The Wilds* dilakukan dengan sekadar mengubah koordinat `player.x` dan `player.y` secara drastis (misal dari `2000,2000` ke `10000,10080`), lalu *scene* di-*update*.
- **Collision / Tabrakan**: Fungsi `blocked(x, y)` memeriksa tabrakan dengan *Bounding Box* peta dan array `obstacles`. Khusus *Hometown*, batas map diubah secara dinamis ke area `9700 - 10300`.
- **Sistem Equipment**: Membeli senjata/armor baru tidak merender ulang seluruh karakter, melainkan menggunakan `setHex()` pada `MeshLambertMaterial` yang di-*expose* secara global untuk mengubah warna secara instan.

## 4. Known Issues & TODOs
- **Bug "Jadi Blank" saat beli Equipment**: Terdapat laporan di mana saat membeli senjata atau armor, UI/gameplay mengalami interupsi/layar blank. AI selanjutnya diharapkan memeriksa aliran logika `gold`, `wNext.cost`, array out-of-bounds di `weaponList`, atau DOM elements di `lost_kingdom_adventure (1).html` dan `ui.js` fungsi `buyWeapon`/`buyArmor`.
