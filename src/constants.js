// Immutable constants and data tables used across modules.

export const mapSize = 20000;

// Minimum player level to enter the Scorched Dunes (wilds2) map
export const WILDS2_MIN_LEVEL = 10;

export const weaponList = [
  { name: "Wooden Sword", damage: 0, cost: 0, color: 0xeeeeee },
  { name: "Iron Sword", damage: 2, cost: 100, color: 0xaaaaaa },
  { name: "Golden Sword", damage: 5, cost: 300, color: 0xffd700 },
  { name: "Fire Blade", damage: 10, cost: 800, color: 0xff4400 },
  { name: "Excalibur (Legendary)", damage: 50, cost: Infinity, color: 0x00ffff },
];

export const armorList = [
  { name: "Rusted Armor", hp: 0, cost: 0, color: 0xaaaaaa },
  { name: "Knight Armor", hp: 50, cost: 150, color: 0xdddddd },
  { name: "Paladin Armor", hp: 150, cost: 400, color: 0xffcc00 },
  { name: "Dragon Armor", hp: 300, cost: 1000, color: 0x221111 },
];

export const helmetList = [
  { name: "Leather Cap", hp: 10, cost: 200, color: 0x8b5a2b },
  { name: "Iron Helm", hp: 25, cost: 400, color: 0xaaaaaa },
  { name: "Dragon Helm", hp: 50, cost: 800, color: 0xcc4400 },
];

export const bootList = [
  { name: "Traveler Boots", speed: 0.5, cost: 150, color: 0x8b5a2b },
  { name: "Knight Boots", speed: 1, cost: 350, color: 0xaaaaaa },
  { name: "Dragon Boots", speed: 2, cost: 700, color: 0xcc4400 },
];

export const enemyTemplates = [
  { hp: 4,   speed: 1.5, r: 9,  damage: 10, typeStr: 'archer',   charKey: 'blob_alien' },
  { hp: 2,   speed: 1.5, r: 9,  damage: 15, typeStr: 'kamikaze', charKey: 'blob_birb', isFlying: true },
  { hp: 3,   speed: 1.5, r: 11, damage: 8,  typeStr: 'spike',    charKey: 'blob_cactoro' },
  { hp: 1.5, speed: 1.5, r: 9,  damage: 5,  typeStr: 'slime',    charKey: 'blob_green' },
  { hp: 8,   speed: 1.5, r: 15, damage: 12, typeStr: 'golem',    charKey: 'blob_green_spiky' },
  { hp: 5,   speed: 1.5, r: 8,  damage: 8,  typeStr: 'ghost',    charKey: 'blob_mushnub' },
  { hp: 3,   speed: 1.5, r: 8,  damage: 12, typeStr: 'mage',     charKey: 'blob_pink' },
  { hp: 10,  speed: 1.5, r: 18, damage: 15, typeStr: 'warrior',  charKey: 'blob_yeti' },
];

// Scorched Dunes (wilds2) enemy templates — level 10+
// Mix of reused Blob models (stats bumped) + new Flying models.
export const enemyTemplates2 = [
  { hp: 12,  speed: 1.6, r: 16, damage: 20, typeStr: 'sc_golem',    charKey: 'blob_green_spiky' },
  { hp: 10,  speed: 1.8, r: 15, damage: 18, typeStr: 'sc_warrior',  charKey: 'blob_yeti' },
  { hp: 14,  speed: 1.5, r: 18, damage: 25, typeStr: 'sc_mage',     charKey: 'blob_pink' },
  { hp: 8,   speed: 2.0, r: 12, damage: 12, typeStr: 'sc_slime',    charKey: 'blob_green' },
  { hp: 6,   speed: 2.2, r: 12, damage: 15, typeStr: 'sc_archer',   charKey: 'blob_alien' },
  { hp: 14,  speed: 2.5, r: 20, damage: 30, typeStr: 'sc_dragon',   charKey: 'fly_dragon',  isFlying: true },
  { hp: 10,  speed: 2.8, r: 15, damage: 22, typeStr: 'sc_ghost',    charKey: 'fly_ghost',   isFlying: true },
  { hp: 8,   speed: 3.0, r: 12, damage: 15, typeStr: 'sc_squidle',  charKey: 'fly_squidle', isFlying: true },
];

export const lootTable = {
  spike: { id: 'wood_scrap', name: 'Wood Scrap', value: 2, color: 0x8b5a2b, icon: '🪵' },
  slime: { id: 'slime_gel', name: 'Slime Gel', value: 5, color: 0x00ff00, icon: '💧' },
  golem: { id: 'golem_core', name: 'Golem Core', value: 25, color: 0x888888, icon: '🪨' },
  archer: { id: 'broken_arrow', name: 'Broken Arrow', value: 4, color: 0xddddaa, icon: '🏹' },
  kamikaze: { id: 'gunpowder', name: 'Gunpowder', value: 8, color: 0x333333, icon: '💣' },
  ghost: { id: 'ectoplasm', name: 'Ectoplasm', value: 10, color: 0xaabbff, icon: '👻' },
  knight: { id: 'iron_shard', name: 'Iron Shard', value: 8, color: 0xaaaaaa, icon: '🛡️' },
  mage: { id: 'magic_dust', name: 'Magic Dust', value: 6, color: 0xaa44ff, icon: '✨' },
  warrior: { id: 'warrior_talon', name: 'Warrior Talon', value: 20, color: 0x884422, icon: '🦅' },
  thief: { id: 'stolen_gem', name: 'Stolen Gem', value: 12, color: 0xff44ff, icon: '💎' },
  paladin: { id: 'holy_gem', name: 'Holy Gem', value: 30, color: 0xffdd44, icon: '🌟' },
  necro: { id: 'dark_essence', name: 'Dark Essence', value: 15, color: 0x440088, icon: '🔮' },
  ranger: { id: 'beast_fang', name: 'Beast Fang', value: 10, color: 0x228822, icon: '🐺' },
  demon: { id: 'demon_horn', name: 'Demon Horn', value: 50, color: 0xff0000, icon: '👿' },
  zombie: { id: 'rotten_flesh', name: 'Rotten Flesh', value: 1, color: 0x558855, icon: '🧟' },
  skeleton: { id: 'bone', name: 'Bone', value: 3, color: 0xeeeeee, icon: '🦴' },
  vampire: { id: 'vampire_fang', name: 'Vampire Fang', value: 18, color: 0xff0000, icon: '🧛' },
  goblin: { id: 'goblin_ear', name: 'Goblin Ear', value: 4, color: 0x00cc00, icon: '👺' },
  beast: { id: 'beast_claw', name: 'Beast Claw', value: 12, color: 0x8b4513, icon: '🐾' },
  archdemon: { id: 'hell_fire', name: 'Hell Fire', value: 100, color: 0xff4400, icon: '🔥' },
  bat: { id: 'bat_wing', name: 'Bat Wing', value: 3, color: 0x333333, icon: '🦇' },
  gargoyle: { id: 'stone_wing', name: 'Stone Wing', value: 15, color: 0x555555, icon: '🗿' },
  dragon: { id: 'dragon_scale', name: 'Dragon Scale', value: 80, color: 0xcc2200, icon: '🐉' },
  // Scorched Dunes (wilds2) tier-2 loot
  sc_golem:   { id: 'sc_golem_heart',   name: 'Golem Heart',     value: 30, color: 0x556655, icon: '💚' },
  sc_warrior: { id: 'sc_warrior_crown', name: 'Warrior Crown',   value: 35, color: 0x885522, icon: '👑' },
  sc_mage:    { id: 'sc_mage_orb',      name: 'Mage Orb',        value: 40, color: 0x8844ff, icon: '🔮' },
  sc_slime:   { id: 'sc_slime_essence', name: 'Slime Essence',   value: 25, color: 0x66ff66, icon: '💧' },
  sc_archer:  { id: 'sc_archer_quiver', name: 'Archer Quiver',   value: 20, color: 0xaa8844, icon: '🏹' },
  sc_dragon:  { id: 'sc_dragon_claw',   name: 'Dragon Claw',     value: 60, color: 0xff4400, icon: '🐲' },
  sc_ghost:   { id: 'sc_ghost_wisp',    name: 'Ghost Wisp',      value: 45, color: 0x99bbff, icon: '👻' },
  sc_squidle: { id: 'sc_squidle_fang',  name: 'Squidle Fang',    value: 30, color: 0x44aaaa, icon: '🦈' },
};

export const consumableItems = {
  health_crystal: { id: 'health_crystal', name: 'Health Crystal', icon: '💎', effect: 'heal', value: 50, cooldown: 300 },
  antidote: { id: 'antidote', name: 'Antidote', icon: '🧪', effect: 'cure_poison', value: 15, cooldown: 0 },
  cooling_tea: { id: 'cooling_tea', name: 'Cooling Tea', icon: '🍵', effect: 'cure_burn', value: 15, cooldown: 0 },
  health_potion: { id: 'health_potion', name: 'Health Potion', icon: '🧪', effect: 'heal', value: 30, cooldown: 0 },
  hometown_portal: { id: 'hometown_portal', name: 'Portal Scroll', icon: '📜', effect: 'teleport', value: 50, cooldown: 0 },
  stamina_potion: { id: 'stamina_potion', name: 'Stamina Potion', icon: '⚡', effect: 'restore_sp', value: 25, cooldown: 0 },
};

export const statusEffects = {
  poison: { name: 'Poison', color: 0x00ff00, damage: 2, duration: 300, tickInterval: 60 },
  burn: { name: 'Burn', color: 0xff4400, damage: 3, duration: 240, tickInterval: 60 },
};

export const craftingRecipes = [
  { result: 'health_potion', count: 1, ingredients: { wood_scrap: 2, slime_gel: 1 } },
  { result: 'antidote', count: 1, ingredients: { bone: 3, magic_dust: 1 } },
  { result: 'cooling_tea', count: 1, ingredients: { iron_shard: 2, golem_core: 1 } },
  { result: 'health_crystal', count: 1, ingredients: { demon_horn: 1, hell_fire: 1, holy_gem: 1 } },
];
