# Dokumentasi The Lost Kingdom 3D

The Lost Kingdom 3D adalah game web bergenre *Action RPG / Hack & Slash* bersudut pandang atas (top-down) yang dibuat menggunakan JavaScript, HTML5, dan library rendering 3D **Three.js**. 

Dokumen ini merangkum struktur proyek, mekanik inti (khususnya sistem pertarungan), serta kontrol yang digunakan di dalam game.

---

## 1. Arsitektur Proyek

Game ini dibangun secara modular menggunakan ECMAScript Modules (ESM). Berikut adalah pembagian file dan tugasnya:

*   **`index.html`**: File utama penyaji UI (User Interface) berbasis HTML/CSS. Menangani *overlay* menu utama, papan misi, toko (shop/altar), inventaris, pengaturan kamera, dan *joystick/on-screen buttons* untuk versi *mobile*.
*   **`src/main.js`**: Titik masuk utama aplikasi (Entry Point). Menangani inisialisasi awal Three.js, *game loop* utama (`requestAnimationFrame`), transisi cuaca, sinkronisasi kamera, input *keyboard*, dan penyimpanan data (*save/load*).
*   **`src/state.js`**: Pusat penyimpanan data (*State Management*). Menyimpan status *real-time* pemain, daftar musuh, proyektil, referensi aset 3D (*meshes*), inventaris, emas, hingga level pemain.
*   **`src/scenes.js`**: Bertugas memuat model 3D (GLTF), membangun peta dasar (Hometown & Wilds), pencahayaan (*lighting*), efek pasca-pemrosesan (*Bloom Pass*), serta memposisikan NPC dan objek lingkungan.
*   **`src/combat.js`**: Inti logika pertempuran. Menangani pergerakan pemain/musuh, kalkulasi *hitbox* dan jeda tebasan (*delay*), status stun, pengurangan HP (Health Points), sistem skill berputar (*spin attack*), serta *drop loot* musuh.
*   **`src/environment.js`**: Menangani elemen lingkungan dinamis, seperti pergerakan efek partikel, hewan peliharaan (Peri), dan cuaca (Siang-Malam / Hujan).
*   **`src/audio.js`**: Sistem pemutaran *sound effect* dan *background music* menggunakan Web Audio API.

---

## 2. Sistem Pertarungan (Combat System)

Sistem pertarungan telah direvisi dari gaya tembak (*shooter*) menjadi pertarungan jarak dekat (*melee/hack and slash*) berat dengan mengandalkan pedang raksasa.

### Efek Pertarungan (Visual & Feel)
*   **Bilah Energi (Slash Effect)**: Setiap kali melakukan serangan, muncul gelombang bilah energi berwarna emas (mesh 3D) yang meluncur ke depan dan memudar dengan cepat.
*   **Camera Shake**: Setiap serangan yang mengenai musuh akan memicu getaran layar (*screen shake*) untuk memberikan kesan hantaman yang berbobot (*meaty hit*).

### Mekanik Serangan Pemain
1.  **Hitbox 360 Derajat**: Batasan sudut (*angle*) dihapus sehingga pedang memukul secara area. Setiap tebasan akan mengenai semua musuh dalam jangkauan (radius `100` untuk musuh biasa, `150` untuk boss).
2.  **Delayed Damage**: Ketika pemain menekan tombol serangan, karakter akan memulai animasi mengayun. *Damage* tidak masuk secara instan, melainkan diberikan jeda sekitar `10 frame` (~0.16 detik) (`attackHitDelay`). Ini disinkronisasikan tepat dengan animasi ujung pedang yang mendarat ke tanah.
3.  **Cooldown (Jeda Antar Serangan)**: Setelah menyerang, terdapat jeda pemulihan sepanjang `90 frame` (~1.5 detik) (`attackCooldown`) yang membuat pertarungan terasa lebih strategis dan berbobot.
4.  **Serangan Putar (Spin Attack)**: Menggunakan tombol `X`. Mengonsumsi 50 Stamina dan langsung memberikan 3x lipat *damage* ke area sekitar (radius 100), dengan jeda *cooldown* 5 detik.

### Mekanik Musuh
1.  **Chasing (Mengejar)**: Musuh biasa akan selalu mengejar posisi pemain. Jika mereka mendekat pada jarak tertentu, mereka akan melakukan animasi memukul, dan jika berhasil menyentuh pemain, akan mengurangi HP pemain.
2.  **Musuh Terbang (Flying Enemies)**: Terdapat tipe musuh seperti *Bat* dan *Gargoyle* yang melayang di udara (memiliki flag `isFlying`). Mereka melakukan gerakan memantul (*bobbing*). Serangan pemain dapat mengenai mereka dengan menggunakan ayunan pedang dari bawah atau dengan cara **melompat**.
3.  **Status Ailments**: Musuh yang terkena serangan pedang pemain akan memicu efek partikel (hit) dan teks *damage*. Musuh juga akan mengalami *Stun* selama `10 frame` dan perlambatan (*Slow*) selama `30 frame`.
4.  **Kamikaze**: Tipe musuh khusus yang langsung meledak dan memberikan *damage* masif saat berhasil menyentuh pemain.

---

## 3. Kontrol Game & UI

Tampilan UI telah dirapikan untuk permainan di PC. Tombol *virtual joystick* dan tombol serangan utama di layar telah dihapus. Hanya tersisa indikator/tombol *cooldown* untuk **Heal**, **Dash**, dan **Spin** di sudut layar. Game juga dilengkapi tombol popup **"Cara Main"** (Tutorial Modal) untuk memudahkan pemain baru.

*   **Panah (Arrow Keys)**: Menggerakkan Karakter utama.
*   **Spasi (Space)**: Melakukan tebasan pedang (*Melee Attack*).
*   **Tombol Z**: *Dash* / Berguling untuk menghindar (Mengonsumsi 30 Stamina).
*   **Tombol X**: Mengeluarkan *Skill Spin Attack* (Putaran Pedang, Mengonsumsi 50 Stamina).
*   **Tombol C**: Mengonsumsi Ramuan Pemulih (Potion) untuk memulihkan HP.
*   **Tombol V**: Melompat ke udara (Mengonsumsi 15 Stamina).
*   **Tombol Shift**: Menahan serangan musuh (*Defend/Block*).
*   **Tombol Q / E**: Memutar sudut pandang kamera (Kiri/Kanan).
*   **Tombol + / -**: Zoom kamera (Mendekat/Menjauh).
*   **Tombol Tab**: Mengunci pandangan ke musuh (*Lock-on target*).

---

## 4. Konfigurasi 3D (Three.js) Khusus

*   **Kamera**: Menggunakan `PerspectiveCamera` dengan sudut pandang yang diubah suai melalui menu UI. Kamera menggunakan interpolasi posisi (Lerp) untuk mengikuti pemain secara halus.
*   **Animasi Karakter**: Animasi GLTF dijalankan menggunakan `THREE.AnimationMixer`. Aksi seperti *Idle*, *Run*, dan *Attack* telah diatur sistem transisi silangnya (*crossfade*) sebesar `0.2s`.
*   **Efek Cahaya (Bloom)**: Kesehatan (HP Bar) dan beberapa objek khusus disorot menggunakan `UnrealBloomPass` di `scenes.js`, menciptakan efek material neon yang bercahaya. Efek visual diatur agar tidak bereaksi berlebihan terhadap material dasar di layar.

---

## 5. Sistem Penyimpanan (Persistence)
Game menggunakan backend **Node.js** dan **SQLite** (`server.js`) untuk menyimpan progres secara permanen (melalui *Auto-save* maupun Manual).
*   Data posisi, uang, item di **Inventory**, senjata, armor, hingga **Stat Points (STR, AGI, VIT)** berhasil diintegrasikan secara dinamis ke dalam kolom tabel `player_data`.
*   Sistem sinkronisasi di `persistence.js` merekonstruksi (*rebuild*) daftar senjata dan armor yang dimiliki ketika game dimuat ulang (refresh) agar progress equipment pemain tidak hilang.
