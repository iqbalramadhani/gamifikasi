# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server for the frontend (auto-picks a port, usually 5173; `index.html` loads `src/main.js` as an ES module)
- `node server.js` — start the Express backend on port **3001** (API only, does NOT serve static files); uses SQLite (`game_save.sqlite`)
- `npm run server` — same as above but with `--watch`
- `npm run build` — Vite production build to `dist/`

There is no test runner. `test.js`, `test-blocked.js`, `test_glb.js` are ad-hoc scratch scripts, not a suite.

## Architecture

**Active code lives in `src/` (ES modules) — the `js/` folder is legacy 2.5D code and is NOT imported by the `src/` pipeline.** Don't make changes in `js/`.

- `index.html` → `src/main.js` (entry point, game loop, camera sync, input handling, save/load orchestration)
- `src/state.js` — single mutable `state` object: player (HP/stamina/cooldowns/inventory), enemies, projectiles, meshes, current scene, upgrades, equipment, and auto-use thresholds (`autoHealThreshold`, `autoSPThreshold`)
- `src/scenes.js` — Babylon.js setup: model loading, map/terrain/lighting per scene, NPC/portal placement, `initEntities()` (player mesh + animation)
- `src/combat.js` — all combat logic: `move()` (player movement, dash/spin skills), `attack()`, `doMeleeHit()`, `updateEnemies()`, `updateBoss()`, `animatePlayer()`
- `src/environment.js` — dynamic ambient effects (particles, day/night cycle, weather, pets)
- `src/persistence.js` + `server.js` — save/load player progress via `/api/save` and `/api/load` (Express + SQLite)
- `src/model-loader.js` — GLTF and FBX asset loading (all model/animation files must be registered in `modelsToLoad` or `fbxModelsToLoad` here, then referenced by key in `scenes.js`/`combat.js`)
- `src/ui.js` — HUD, shop/blacksmith (equipment upgrades), level-up, modals, keydown/keyup capture (`state.keys`), and `autoUsePotions()` (per-frame auto-heal / auto-SP based on thresholds)
- `src/constants.js` — weapon/armor tiers and stat definitions
- `src/helpers.js` — `blocked(x, y, r)` collision check (scene-aware obstacle set)

### Babylon.js model/animation pipeline
`model-loader.js` loads GLTF assets via `@babylonjs/loaders` (`GLTFLoader.Register()`), cloning the root `TransformNode` with `node.clone(name, true, false)` for each enemy/player instance. **Phase 1 limitation**: skeleton animation is not yet ported — `createEnemyMixer()` returns no-op stubs, and walk/idle/attack actions are cosmetic only. Full `AnimationMixer`-equivalent layer is planned for Phase 2.

### HUD navbar & settings menu
The HUD navbar (`#hud`) in `index.html` shows only status badges on the left (HP, SP, level, gold) and a single `⚙️ Menu` button on the right. The `#settings-menu` overlay (opened via `openSettings()`) contains:
- **Quick action buttons** (2×2 grid): `🎵 Musik` (toggles BGM, `id="btn-toggle-bgm"` — updated by `updateBgmButtonUI()` in `audio.js`), `🎒 Tas (I)` → `closeSettings(); openInventory()`, `📊 Stats` (with `#stat-notif` badge for unspent stat points), `📜 Misi (J)` → `closeSettings(); openQuestBoard()`
- Camera settings sliders
- Auto-use potion sliders
- `💾 Simpan Game` and `📖 Cara Main` buttons

All modals (inventory, stats, quest board, full map) are triggered via keyboard shortcuts (`I`, `J`, `M`) or the quick-action buttons in the settings menu. The full map has **no dedicated navbar button** — it is opened by clicking the minimap overlay or pressing `M`.

### World layout
Three scenes: `hometown` (safe zone, no enemies), `wilds` (main hunting area, has a boss), `wilds2` (Scorched Dunes — level-gated at 10+). Each scene has its own `TransformNode` (Babylon); only the active one is enabled via `setEnabled(true/false)`. Terrain height differs per scene — use `getTerrainHeightWilds2()` for `wilds2`, `getTerrainHeight()` for `wilds`/`hometown`.

### Combat timing
All combat timers (`attackCooldown`, `attackHitDelay`, `dashCooldown`, `spinCooldown`, etc.) are frame counters (60fps reference), decremented with `dt` each tick in `main.js`'s game loop — not real-time milliseconds.

### Auto-use potions
Player auto-heal / auto-SP is driven by `state.autoHealThreshold` and `state.autoSPThreshold` (both 0–100 %, defaults 50 / 30). `autoUsePotions()` in `src/ui.js` runs every frame from `main.js`'s loop: it calls `window.usePotion()` when HP ≤ `autoHealThreshold` % and `useConsumable('stamina_potion')` when SP ≤ `autoSPThreshold` %. Over-consumption is prevented by the guards already in `usePotion` (HP full / no stock) and `useConsumable` (stock + `lastCrystalUse` cooldown) — so the per-frame call is safe to always run. Thresholds are edited via two sliders in the `#settings-menu` (index.html) wired to `window.updateAutoUseSettings` (`updateAutoUseSettings()` in `src/ui.js`), and synced into the sliders by `syncAutoUseSliders()` when the menu opens. Both thresholds are persisted.

### Save/load DB schema gotcha
`src/persistence.js` serializes a flat `data` object, and `server.js` writes it to SQLite `player_data` with **explicit column lists** in both the `UPDATE` and `INSERT` statements (plus `ALTER TABLE ADD COLUMN` migrations at startup for pre-existing DBs). If you add a new save field in `persistence.js`, you MUST also add the matching column to **all three** in `server.js` (ALTER, UPDATE, INSERT) — otherwise it silently never persists. This has burned us before (e.g. `critChance`/`questStage` were sent by the client but had no DB column until they were migrated in).

### CHANGELOG_FIXES.md
This project tracks all verified bug fixes in `CHANGELOG_FIXES.md` at the root. **Before debugging a bug, `grep` this file first** — many bugs are regressions or variants of previously fixed issues and the root cause is already documented. **After a fix is verified working, add a new entry to the top of the file** in the established format (see existing entries for structure).
