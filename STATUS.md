# STATUS — Rewrite TypeScript + Vite + Babylon.js
Diperbarui: 2026-10-09 (checkpoint `262ee67`, sebelum reset sesi)

## Ringkasan
Semua 13 file `.ts` di `src/` SUDAH TULIS (Phase 1–3 pada plan.md), tapi **457 error typecheck** (`npx tsc --noEmit`). Game belum bisa build/run dari kode TS — `index.html` sudah menunjuk ke `/src/main.ts` (baris 404) tapi Vite/tsc gagal.

## Sudah selesai
- [x] Scaffold: `tsconfig.json`, `tsconfig.node.json` (ada di root), `vite.config.ts` (proxy `/api` → :3001, manualChunks babylon), `vite-env.d.ts`, `package.json` (babi `@babylonjs/core` 9.30 + `@babylonjs/loaders` 9.29, scripts `dev`/`server`/`dev:all`/`typecheck`/`build`)
- [x] Semua module TS sudah dibuat (porting dari JS lama):
  - `state.ts` + `types.ts` (satu file, bukan folder `types/` seperti di plan)
  - `constants.ts`, `model-loader.ts`, `helpers.ts`, `landmarks.ts`, `audio.ts`, `environment.ts`, `persistence.ts`, `ui.ts`, `combat.ts`, `scenes.ts`, `main.ts`
- [x] `index.html` entry di-update ke `/src/main.ts`
- [x] Commit WIP `262ee67` — 1 commit ahead of origin

## Belum selesai (457 error `tsc --noEmit`, per file)
| File | # error | Contoh issue |
|---|---|---|
| `scenes.ts` | 253 | `Engine(HTMLElement\|null)` butuh `!`, `floorPositions` nullable, `DynamicTexture.wrapMode` bukan di `Texture`, mesh builder opts `depth`/`tessellation` tak dikenal |
| `main.ts` | 71 | import `usePotion`/`triggerSpinAttack`/`updateEnemies`/`updateProjectiles`/`updateBoss` dari `combat.ts` — belum di-export; `window.*` handler (teleportTo, spawnEnemy, spawnBoss, usePotion, levelUp, dst.) belum di-assign → perlu `declare global { interface Window {...} }` |
| `combat.ts` | 37 | banyak `clone(.,.,true)` signature Babylon v9 berubah; `gltfEnemy` nullable check; `killEnemy`/`triggerSpinAttack` belum ada di module; `BLENDMODEONEONE` di `Engine` bukan di material |
| `landmarks.ts` | 27 | nullable model + clone signature |
| `helpers.ts` | 24 | nullable + clone(.,.,true) |
| `ui.ts` | 21 | `weaponAuraGroup` tak ada di `GameState`; `userData` di `Mesh`; `number\|null` → `number\|undefined` |
| `environment.ts` | 14 | `talkTimer`/`waitTimer`/`angle`/`center` possibly undefined |
| `persistence.ts` | 8 | (perlu cek detail) |
| `audio.ts` | 2 | `toggleBGM`/`setBGMVolume` tak ada di `Window` |

## Langkah berikutnya
1. **Fix 457 error typecheck** (prioritas, semua blocker build). Kelompokkan:
   a. Babylon v9 API drift: signature `clone()` berubah (`MeshCloneOptions`/`Nullable<Node>`), `WRAPMODE_*` pindah ke `Texture`, mesh builder options — perlu audit per file, kemungkinan besar di `scenes.ts` (253)
   b. Missing export di `combat.ts` → `main.ts` (71 error utama di main.ts sebenarnya root-cause di sini: export dulu, lalu declare global window handler)
   c. `GameState` di `types.ts` kurang field (`weaponAuraGroup` dsb.)
   d. Nullable handling (`!`, optional chaining, default)
2. **Verifikasi runtime**: `npm run dev` + `node server.js` → browser, cek console (Fix #34 UMD/ESM class crash JANGAN terulang — sekarang pakai ESM murni, harusnya aman, tapi wajib cek)
3. **Delete file lama** (plan Phase 4): 12× `src/*.js`, folder `js/`, `test.js`, `test-blocked.js`, `test_glb.js`, `dist/` — **hanya setelah step 1–2 proven jalan** (cek CHANGELOG_FIXES.md dulu sebelum hapus apa pun)
4. Update `CLAUDE.md` (struktur masih merujuk `src/*.js`) + `CHANGELOG_FIXES.md` kalau ada fix terverifikasi

## Keputusan penting
- `src/types.ts` jadi satu file (bukan folder `src/types/` seperti plan) — sudah jadi, ikut saja
- `package.json` tidak persis seperti plan (pakai `@babylonjs/core` bukannya `babylonjs`, ada `concurrently` + `dev:all`) — sudah jadi, ikuti kondisi nyata
- `server.js` & `public/` & `index.html` & `style.css` tak diubah (sesuai plan)

## Jangan lakukan (jebakan)
- **JANGAN** hapus `src/*.js` sebelum game jalan di browser (plan Phase 4 = terakhir)
- **JANGAN** pakai `window.BABYLON`/UMD — Fix #34 di CHANGELOG_FIXES.md: class hierarchy crash. ESM murni + `registerBuiltInLoaders()` dari `@babylonjs/loaders`
- `npm run build` sekarang = `tsc --noEmit && vite build` → pasti gagal karena 457 error. Jangan dianggap bug build system, ini efek typecheck belum bersih
- Cek `CHANGELOG_FIXES.md` (grep dulu, jangan baca utuh) sebelum debug bug spesifik — banyak akar sudah terdokumentasi
