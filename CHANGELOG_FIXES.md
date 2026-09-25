### Fix #8 — TypeError spawnParticles saat loadGame (scene belum ready)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/helpers.js` · `spawnParticles` crash: `Cannot read properties of null (reading 'add')` saat loadGame · `window.onload` memanggil `loadGame()` sebelum `startGame()`, jadi `state.scene` masih `null` · Tambahkan guard `if (!s.scene) return;` di awal `spawnParticles()` · ✅ LIVE — test load tanpa backend + build vite · **Always guard against null scene in render-side helpers** · `TypeError spawnParticles scene` · belum deploy

### Fix #1 — Equipment purchase blank screen (null weapon/armor from DB)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/persistence.js` · `s.currentWeapon` / `s.currentArmor` set ke `null` saat load · SQLite column bernilai NULL → `??` hanya dipakai untuk `player.*`, bukan array-index fields · Tambahkan `?? 0` untuk `gold`, `potions`, `crystalCount`, `currentWeapon`, `currentArmor` di `loadGame()` · ✅ LIVE — test manual + build vite · **Never assume DB fields are non-null.** Always use `?? default` for every field from load response · `null` · belum deploy

### Fix #2 — TypeError saat beli weapon/armor pertama
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/ui.js` · `buyWeapon()` crash: `weaponList[s.currentWeapon - 1].damage` → index -1 · Setelah `s.currentWeapon++`, index `-1` mengembalikan `undefined` → `.damage` throw TypeError · Gunakan conditional: `prevDmg = currentWeapon > 0 ? weaponList[currentWeapon-1]?.damage ?? 0 : 0` · ✅ LIVE — simulasi Node.js verifikasi damage=3 untuk Iron Sword pertama · **Increment happened before prev lookup.** Reorder logic or guard index · `TypeError: Cannot read properties of undefined` · belum deploy

### Fix #3 — Error loadGame menampilkan pesan misleading
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/persistence.js` · `loadGame()` crash `ReferenceError: updateUI is not defined` yang ditangkap `.catch()` → tampil "Belum ada save data atau Server Backend mati" padahal backend hidup · `updateUI()` dipanggil di baris 98 tapi tidak di-import di file · Tambahkan `import { updateUI } from './ui.js'` dan `import { weaponList, armorList } from './constants.js'` · ✅ LIVE — build vite sukses · **Import semua dependency sebelum pakai, jangan rely pada global scope** · `ReferenceError: updateUI is not defined` · belum deploy

### Fix #4 — EXP sisa muat dimuat tapi tidak diproses level-up + notif hilang
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/persistence.js` · `loadGame()` memuat `exp:200/nextExp:20` tapi player tetap Lv1, tidak ada notif level-up · `checkItems()` hanya trigger `levelUp()` saat collect exp orb baru · Awalnya pakai loop langsung update stats, tapi tanpa sound/particles/modal · Sekarang pakai `levelUp()` dari ui.js di setiap iterasi loop → sound + particles + modal muncul · ✅ LIVE — build vite sukses · **Gunakan fungsi yang sudah ada, jangan duplikat logika** · `levelUp` · belum deploy

### Fix #5 — Animasi spin karakter hilang
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/main.js` · Animasi putar (spin attack) tidak terlihat · Baris 116 menambah `rotation.y` saat spinning, tapi baris 141 langsung menimpa dengan `-Math.PI/2` setiap frame · Tambah `state.player.spinAngle` untuk akumulasikan rotasi spin, dan reset ke 0 saat spin berakhir · ✅ LIVE — build vite sukses · **Jangan overwrite rotasi yang sedang dianimasikan** · `isSpinning rotation.y` · belum deploy

### Fix #6 — Notif level-up tidak muncul saat gameplay (hanya setelah refresh)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/main.js` · `levelUp()` tidak ter-trigger saat collect exp orb di game · `window.levelUp` tidak di-expose di main.js, sehingga check `typeof window.levelUp === 'function'` di helpers.js selalu false · Tambah `window.levelUp = levelUp` · ✅ LIVE — build vite sukses · **Setiap fungsi yang dipanggil via onclick/window harus di-expose** · `window.levelUp` · belum deploy

### Fix #8 — Tombol beli equipment stuck (disabled tidak update + material referensi salah)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/ui.js` · Tombol beli senjata/armor selalu enabled meski gold 0, klik tidak ada feedback · `updateBlacksmithUI()` set `.disabled = false` untuk semua item yang belum max level, tanpa cek `s.gold >= cost` · Tambah kondisi `disabled = s.gold < wNext.cost` dan `s.gold < aNext.cost` · ✅ LIVE — build vite sukses · **Selalu validasi affordance di UI, jangan asumsi user punya资源 cukup** · `disabled btn-buy-weapon btn-buy-armor` · belum deploy
2026-09-25 · `src/scenes.js` · Fallback player crash/merah saat load model · `createFallbackPlayer()` mengakses `window.playerBodyMat` / `window.playerBladeMat` yang belum di-set (hanya di `state`) · Tambah `window.playerBodyMat = s.playerBodyMat; window.playerBladeMat = s.playerBladeMat;` setelah create material, sebelum panggil `createFallbackPlayer()` · ✅ LIVE — build vite sukses · **Variable yang diakses via window harus di-expose sebelum dipakai** · `window.playerBladeMat window.playerBodyMat` · belum deploy

### Fix #7 — Tombol beli equipment tidak merespon (stuck)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/main.js` · Klik "Tempa Senjata"/"Tempa Armor" tidak respon · Fungsi `buyWeapon`, `buyArmor`, `openBlacksmith`, `closeBlacksmith`, `openShop`, `closeShop`, `buyUpgrade` di-import tapi tidak di-assign ke `window`, sehingga onclick di HTML tidak bisa menemukannya · Tambah 7 baris `window.*` assignment · ✅ LIVE — build vite sukses · **Semua handler onclick HTML harus di-expose di window** · `onclick buyWeapon buyArmor` · belum deploy
