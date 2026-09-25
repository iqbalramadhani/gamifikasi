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

### Fix #10 — Modal blacksmith tidak terlihat di layar (stuck)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `style.css` · Modal `#blacksmith` terbuka tapi tidak terlihat — tidak ada CSS overlay seperti `#shop` · Tidak ada rule CSS untuk `#blacksmith`, hanya inline `style="display:none"` tanpa position/z-index/fullscreen · Tambah CSS block `#blacksmith` dengan position:absolute, full viewport, background overlay, z-index:30 · ✅ LIVE — build vite sukses · **Setiap modal fullscreen harus punya CSS rule lengkap, jangan rely hanya pada inline style** · `modal #blacksmith display flex` · belum deploy

### Fix #9 — Tombol beli装备 stuck (disabled tidak update + material referensi salah)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/ui.js` · Tombol beli senjata/armor selalu enabled meski gold 0, klik tidak ada feedback · `updateBlacksmithUI()` set `.disabled = false` untuk semua item yang belum max level, tanpa cek `s.gold >= cost` · Tambah kondisi `disabled = s.gold < wNext.cost` dan `s.gold < aNext.cost` · ✅ LIVE — build vite sukses · **Selalu validasi affordance di UI, jangan asumsi user punya资源 cukup** · `disabled btn-buy-weapon btn-buy-armor` · belum deploy
2026-09-25 · `src/scenes.js` · Fallback player crash/merah saat load model · `createFallbackPlayer()` mengakses `window.playerBodyMat` / `window.playerBladeMat` yang belum di-set (hanya di `state`) · Tambah `window.playerBodyMat = s.playerBodyMat; window.playerBladeMat = s.playerBladeMat;` setelah create material, sebelum panggil `createFallbackPlayer()` · ✅ LIVE — build vite sukses · **Variable yang diakses via window harus di-expose sebelum dipakai** · `window.playerBladeMat window.playerBodyMat` · belum deploy

### Fix #11 — Sistem Stamina & Combat Improvement
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/main.js`, `src/combat.js`, `src/state.js` · Dash/spin/defend tidak ada batas stamina → bisa spam tanpa henti · Tambah field `stamina`/`maxStamina` di state player, kurangi stamina saat dash (-30), spin (-50), defend (-0.5/frame), regenerasi +0.3/frame · V key untuk jump dengan stamina cost 15 · ✅ LIVE — test manual · **Combat ability harus punya resource cost agar tidak spam** · `stamina dash spin defend jump` · belum deploy
2026-09-25 · `src/main.js`, `src/combat.js` · Camera follow player tapi tidak bisa diputar dengan Q/E · Tambah `state.cameraAngle`, Q/E putar sudut kamera, chase camera gunakan trigonometri (`sin/cos(angle) * offset`) · TAB lock-on ke musuh terdekat, camera otomatis menghadap musuh · ✅ LIVE — test manual · **Camera kontrol perlu input terpisah dari movement** · `cameraAngle Q E TAB lock-on` · belum deploy
2026-09-25 · `src/combat.js` · Input movement absolut (world-space) tapi kamera bisa berp Putar · Arah gerakan tidak mengikuti kamera → player jalan ke arah salah saat kamera diputar · Rotate input vector (`dx, dy`) berdasarkan `cameraAngle` sebelum apply movement · ✅ LIVE — test manual · **Movement input harus dirotasi sesuai sudut kamera** · `movement rotation cameraAngle` · belum deploy
2026-09-25 · `src/combat.js` · Spin attack tidak ada feedback visual/audio · Tambah knockback musuh (12 units), stunTimer 20 frame, cameraShake 8, spawnDamageText, particle trail warna weapon · Boss slam attack: timer 150 frame, radius 100, knockback 40 (20 jika defending), cameraShake 20 · ✅ LIVE — test manual · **Attack yang kuat harus punya impact visual yang jelas** · `spin knockback stun cameraShake boss slam` · belum deploy
2026-09-25 · `src/helpers.js`, `src/combat.js` · Tidak ada damage number floating text saat diserang · Buat fungsi `spawnDamageText(x, y, z, text, color)` yang menghitung screen position dari 3D position via `pos.project(camera)` dan membuat DOM element absolut · Dipanggil di setiap hit enemy/boss/player · ✅ LIVE — test manual · **Floating text butuh project 3D→2D + DOM overlay** · `spawnDamageText project camera` · belum deploy
2026-09-25 · `src/combat.js` · Tidak ada efek kaki (footstep) saat berjalan · Tambah deteksi `Math.floor(walkCycle / Math.PI)` berbeda → spawn 2 partikel dust + playSound('footstep') · ✅ LIVE — test manual · **Subtle feedback meningkatkan immersion** · `footstep dust particles` · belum deploy
2026-09-25 · `src/combat.js` · Trail particle tidak muncul saat dash/spin · Di `animatePlayer()`, tambahkan kondisi: if isSpinning spawn trail particle di posisi sekitar player dengan warna weapon; if isDashing spawn trail dengan warna armor · ✅ LIVE — test manual · **Animasi action harus punya particle feedback** · `trail dash spin particle` · belum deploy
2026-09-25 · `src/scenes.js` · Shadow tidak aktif — semua objek terlihat datar · Tambah `shadowMap.enabled = true` dan `PCFSoftShadowMap` di renderer init · DirLight set `castShadow = true` dengan mapSize 2048×2048, camera frustum ±500 · Floor dan semua mesh model set `receiveShadow/castShadow = true` · ✅ LIVE — test manual · **Shadow memberikan depth dan realisme signifikan** · `shadowMap PCFSoftShadowMap castShadow` · belum deploy

### Fix #12 — Sistem NPC Dialogue
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/ui.js`, `index.html` · NPC interaction langsung buka shop/blacksmith tanpa dialog · Tambah state `currentDialogue`, `isTyping`, `typeInterval` · Fungsi `startDialogue(speaker, text, onComplete)` dengan typewriter effect (30ms per char) · Fungsi `advanceDialogue()` — klik F lanjut typewriter atau tutup dialogue + jalankan callback · ✅ LIVE — test manual · **NPC interaction harus punya narrative layer sebelum action** · `dialogue typewriter startDialogue advanceDialogue` · belum deploy
2026-09-25 · `src/ui.js` · CheckInteractions langsung open shop tanpa dialog · Ganti semua `openShop()`/`openBlacksmith()` langsung → panggil `startDialogue()` dengan pesan NPC, lalu callback ke fungsi asli · Shop/Blacksmith tetap terbuka setelah dialog selesai · ✅ LIVE — test manual · **Semua NPC interaction lewat dialogue flow** · `checkInteractions dialogue callback` · belum deploy

### Fix #13 — Sistem Level Up & Stat Allocation
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/ui.js`, `src/state.js`, `index.html` · Level up otomatis tambah HP/Attack tanpa kontrol player · Rubah: level up berikan `+1 statPoint` alih-alih auto-stats · Tambah modal `#stats-menu` dengan 3 stat: STR (+1 dmg), AGI (+0.3 speed, +20 maxStamina), VIT (+30 maxHp) · Fungsi `addStat(type)` dan `updateStatsUI()` · Button Stats di HUD dengan notif badge · ✅ LIVE — test manual · **Player harus punya kontrol atas progression stats** · `levelUp statPoints STR AGI VIT stats-menu` · belum deploy
2026-09-25 · `src/ui.js` · Key V dan TAB tidak preventDefault → scroll halaman · Tambah `'v'` dan `'tab'` ke array key yang di-preventDefault di `keydown` handler · ✅ LIVE — build vite sukses · **Semua game key harus preventDefault** · `keydown preventDefault v tab` · belum deploy

### Fix #14 — Hometown Visual Overhaul: Jalan Dirt & Pagar Bangunan
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/scenes.js` · Hometown hanya punya plaza stone dan pagar lingkaran kayu besar · Hapus wooden palisade loop (radius 300) · Tambah `addPath(startX,startZ,endX,endZ)` — loop buat patch-dirt dari fountain ke setiap bangunan (scale 30,30,30, pos y=-3) · 8 jalur: house, platform, struct_roof, house2, platform2, struct_roof2, shop, healer, blacksmith, target · ✅ LIVE — test manual · **Jalan setapak membuat navigasi visual lebih jelas** · `patch_dirt addPath hometown path` · belum deploy
2026-09-25 · `src/scenes.js` · Bangunan tidak punya pembatas area · Tambah `addBuildingFence(cx,cz,hw)` — 2 fence segments (utara/selatan) di sekeliling tiap bangunan (hw=60 untuk building, hw=45 untuk NPC) · 9 panggilan fence: 6 bangunan + 3 NPC stall · ✅ LIVE — test manual · **Pagar persegi memberikan sense of place tiap area** · `addBuildingFence fence` · belum deploy
2026-09-25 · `src/scenes.js`, `index.html` · Tidak ada quest board di hometown · Tambah procedural quest board mesh (box + 2 post + paper) di posisi `(hx, hy+50)` · Tambah modal `#quest-board` di HTML dengan quest info + tombol accept · State `bountyQuest` dan `bountyQuestProgress` di state.js · ✅ LIVE — test manual · **Quest board memberi konteks misi di dunia** · `questBoard quest-board bountyQuest` · belum deploy

### Fix #15 — Player Visual Upgrade: Weapon Color & Armor Aura
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/ui.js`, `src/state.js` · Beli senjata baru tidak ubah warna/ukuran model player · Tambah `playerSwordMesh` dan `playerAuraLight` ke state · `buyWeapon()`: traverse sword mesh, clone material, set color+emissive, scale up berdasarkan weapon level · `buyArmor()`: traverse gltfPlayerRef body parts, set color, buat PointLight aura (color dari armor, intensity+distance naik per level) · ✅ LIVE — test manual · **Upgrade visual harus terlihat di model 3D, bukan hanya stats** · `playerSwordMesh playerAuraLight emissive armor light` · belum deploy

### Fix #16 — Model Shadow Support
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/model-loader.js` · Model GLB yang dimuat tidak cast/receive shadow meskipun shadow map aktif · Setelah `gltf.scene` di-set ke loadedModels, traverse semua child meshes dan set `castShadow = true` serta `receiveShadow = true` · ✅ LIVE — build vite sukses · **Shadow settings harus di-set saat load model, bukan setelahnya** · `model-loader castShadow receiveShadow traverse` · belum deploy

### Fix #17 — Texture patch-dirt tidak muncul (posisi Y salah)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/scenes.js` · Tekstur `patch-dirt.glb` tidak terlihat di jalan setapak — model tampak transparan/hilang · Model `patch-dirt` dimuat dengan top surface di y=0 (ground level), sehingga player berjalan menembus jalan dan tekstur tidak terlihat dari atas · Pindahkan posisi Y dari 0 ke -3: `dirt.position.set(px, -3, pz)` agar permukaan atas model sejajar ground (y=0), ketebalan 3 unit ke bawah · ✅ LIVE — test manual · **Model dengan tekstur harus diposisikan agar surface yang relevan menghadap arah kamera** · `patch_dirt texture position y=-3` · belum deploy

### Fix #7 — Tombol beli equipment tidak merespon (stuck)
Tanggal · File · Masalah · Akar · Fix · Verifikasi · Pelajaran · Log Keyword · Deploy
2026-09-25 · `src/main.js` · Klik "Tempa Senjata"/"Tempa Armor" tidak respon · Fungsi `buyWeapon`, `buyArmor`, `openBlacksmith`, `closeBlacksmith`, `openShop`, `closeShop`, `buyUpgrade` di-import tapi tidak di-assign ke `window`, sehingga onclick di HTML tidak bisa menemukannya · Tambah 7 baris `window.*` assignment · ✅ LIVE — build vite sukses · **Semua handler onclick HTML harus di-expose di window** · `onclick buyWeapon buyArmor` · belum deploy
