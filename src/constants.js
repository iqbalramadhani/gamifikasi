// Immutable constants and data tables used across modules.

export const mapSize = 20000;

// Minimum player level to enter the Scorched Dunes (wilds2) map
export const WILDS2_MIN_LEVEL = 10;

export const weaponList = [
  { name: "Wooden Sword",       damage: 0,   cost: 0,      color: 0xeeeeee, minLevel: 1  },
  { name: "Iron Sword",         damage: 3,   cost: 250,    color: 0xaaaaaa, minLevel: 3  },
  { name: "Steel Sword",        damage: 7,   cost: 600,    color: 0xcccccc, minLevel: 6  },
  { name: "Golden Sword",       damage: 12,  cost: 1200,   color: 0xffd700, minLevel: 10 },
  { name: "Fire Blade",         damage: 20,  cost: 2500,   color: 0xff4400, minLevel: 15 },
  { name: "Shadow Blade",       damage: 30,  cost: 5000,   color: 0x440088, minLevel: 20 },
  { name: "Void Reaper",        damage: 45,  cost: 10000,  color: 0x220044, minLevel: 28 },
  { name: "Dragon Fang",        damage: 65,  cost: 20000,  color: 0xff2200, minLevel: 35 },
  { name: "Excalibur (Legendary)", damage: 100, cost: Infinity, color: 0x00ffff, minLevel: 40 },
];

export const armorList = [
  { name: "Rusted Armor",    hp: 0,    cost: 0,      color: 0xaaaaaa, minLevel: 1  },
  { name: "Leather Armor",  hp: 30,   cost: 300,    color: 0x8b5a2b, minLevel: 3  },
  { name: "Knight Armor",   hp: 80,   cost: 800,    color: 0xdddddd, minLevel: 8  },
  { name: "Paladin Armor",  hp: 180,  cost: 2000,   color: 0xffcc00, minLevel: 14 },
  { name: "Dragon Armor",   hp: 350,  cost: 5000,   color: 0x221111, minLevel: 20 },
  { name: "Void Armor",     hp: 600,  cost: 12000,  color: 0x330055, minLevel: 28 },
  { name: "Celestial Plate",hp: 1000, cost: 25000,  color: 0xaaddff, minLevel: 38 },
];

export const helmetList = [
  { name: "Leather Cap",     hp: 10,  cost: 200,    color: 0x8b5a2b, minLevel: 1  },
  { name: "Iron Helm",       hp: 30,  cost: 600,    color: 0xaaaaaa, minLevel: 5  },
  { name: "Steel Helm",      hp: 60,  cost: 1500,   color: 0xcccccc, minLevel: 10 },
  { name: "Dragon Helm",     hp: 110, cost: 3500,   color: 0xcc4400, minLevel: 18 },
  { name: "Shadow Helm",     hp: 180, cost: 8000,   color: 0x330044, minLevel: 26 },
  { name: "Celestial Crown", hp: 300, cost: 18000,  color: 0xeeeeff, minLevel: 36 },
];

export const bootList = [
  { name: "Traveler Boots",  speed: 0.5, cost: 150,    color: 0x8b5a2b, minLevel: 1  },
  { name: "Knight Boots",    speed: 1.0, cost: 500,    color: 0xaaaaaa, minLevel: 5  },
  { name: "Swift Boots",     speed: 1.5, cost: 1200,   color: 0x44aaff, minLevel: 10 },
  { name: "Dragon Boots",    speed: 2.0, cost: 3000,   color: 0xcc4400, minLevel: 18 },
  { name: "Shadow Treads",   speed: 2.8, cost: 7000,   color: 0x220033, minLevel: 26 },
  { name: "Void Striders",   speed: 3.5, cost: 15000,  color: 0x9900ff, minLevel: 36 },
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
  { hp: 15,  speed: 2.0, r: 16, damage: 25, typeStr: 'sc_soldier',  charKey: 'arena_soldier' },
];

export const eliteTemplates = {
  // Wilds Tier-1 Elites
  slime: {
    name: "King Slime Vorax",
    title: "Penguasa Lendir Rawa",
    auraColor: 0x00ff66,
    scaleBonus: 1.6,
    hpMultiplier: 3.0,
    damageMultiplier: 1.5,
    speedMultiplier: 1.1,
    ability: 'acid_pool',
    bonusGold: 50,
    bonusExp: 40,
    icon: '👑'
  },
  archer: {
    name: "Deadeye Vex",
    title: "Penembak Jitu Bayangan",
    auraColor: 0x00e5ff,
    scaleBonus: 1.5,
    hpMultiplier: 2.8,
    damageMultiplier: 1.6,
    speedMultiplier: 1.2,
    ability: 'triple_shot',
    bonusGold: 60,
    bonusExp: 45,
    icon: '🎯'
  },
  kamikaze: {
    name: "Doom Birb Inferno",
    title: "Burung Penghancur Neraka",
    auraColor: 0xff3d00,
    scaleBonus: 1.5,
    hpMultiplier: 2.5,
    damageMultiplier: 2.0,
    speedMultiplier: 1.3,
    ability: 'super_nova',
    bonusGold: 55,
    bonusExp: 40,
    icon: '💣'
  },
  spike: {
    name: "Thorn Emperor Cactoro",
    title: "Raja Duri Berbisa",
    auraColor: 0xffd600,
    scaleBonus: 1.6,
    hpMultiplier: 3.2,
    damageMultiplier: 1.4,
    speedMultiplier: 1.0,
    ability: 'thorns_reflect',
    bonusGold: 65,
    bonusExp: 45,
    icon: '🌵'
  },
  golem: {
    name: "Ancient Obsidian Titan",
    title: "Raksasa Batu Purba",
    auraColor: 0xaa00ff,
    scaleBonus: 1.75,
    hpMultiplier: 3.5,
    damageMultiplier: 1.8,
    speedMultiplier: 0.95,
    ability: 'earth_slam',
    bonusGold: 90,
    bonusExp: 70,
    icon: '🗿'
  },
  ghost: {
    name: "Phantom Wraith Mushnub",
    title: "Roh Penjerat Jiwa",
    auraColor: 0x7c4dff,
    scaleBonus: 1.5,
    hpMultiplier: 2.8,
    damageMultiplier: 1.5,
    speedMultiplier: 1.25,
    ability: 'phase_shift',
    bonusGold: 65,
    bonusExp: 50,
    icon: '👻'
  },
  mage: {
    name: "Archmage Sorath",
    title: "Penyihir Kekacauan",
    auraColor: 0xff007f,
    scaleBonus: 1.6,
    hpMultiplier: 2.8,
    damageMultiplier: 1.8,
    speedMultiplier: 1.1,
    ability: 'meteor_burst',
    bonusGold: 80,
    bonusExp: 60,
    icon: '🔮'
  },
  warrior: {
    name: "Warlord Yeti Frostbane",
    title: "Panglima Dingin Abadi",
    auraColor: 0x00b0ff,
    scaleBonus: 1.7,
    hpMultiplier: 3.5,
    damageMultiplier: 1.7,
    speedMultiplier: 1.15,
    ability: 'berserk_frenzy',
    bonusGold: 85,
    bonusExp: 65,
    icon: '⚔️'
  },

  // Scorched Dunes Tier-2 Elites
  sc_golem: {
    name: "Magma Colossus Khamsin",
    title: "Penguasa Inti Lahar",
    auraColor: 0xff1744,
    scaleBonus: 1.75,
    hpMultiplier: 3.5,
    damageMultiplier: 1.8,
    speedMultiplier: 1.0,
    ability: 'lava_eruption',
    bonusGold: 130,
    bonusExp: 100,
    icon: '🌋'
  },
  sc_warrior: {
    name: "Dune Berserker Orix",
    title: "Jagotua Padang Pasir",
    auraColor: 0xff6d00,
    scaleBonus: 1.7,
    hpMultiplier: 3.2,
    damageMultiplier: 1.7,
    speedMultiplier: 1.2,
    ability: 'sand_whirlwind',
    bonusGold: 120,
    bonusExp: 90,
    icon: '🦁'
  },
  sc_mage: {
    name: "Solar Prophet Ra'zul",
    title: "Utusan Api Matahari",
    auraColor: 0xffea00,
    scaleBonus: 1.6,
    hpMultiplier: 3.0,
    damageMultiplier: 1.9,
    speedMultiplier: 1.15,
    ability: 'solar_flare',
    bonusGold: 140,
    bonusExp: 110,
    icon: '☀️'
  },
  sc_slime: {
    name: "Golden Midas Slime",
    title: "Lendir Emas Berkilau",
    auraColor: 0xffd700,
    scaleBonus: 1.5,
    hpMultiplier: 2.5,
    damageMultiplier: 1.3,
    speedMultiplier: 1.4,
    ability: 'golden_burst',
    bonusGold: 250,
    bonusExp: 80,
    icon: '✨'
  },
  sc_archer: {
    name: "Sandstorm Zephyr",
    title: "Pemanah Badai Pasir",
    auraColor: 0xffab00,
    scaleBonus: 1.5,
    hpMultiplier: 2.8,
    damageMultiplier: 1.7,
    speedMultiplier: 1.25,
    ability: 'blinding_volley',
    bonusGold: 110,
    bonusExp: 85,
    icon: '🌪️'
  },
  sc_dragon: {
    name: "Dreadwing Ignis",
    title: "Naga Purba Pembakar Langit",
    auraColor: 0xd50000,
    scaleBonus: 1.65,
    hpMultiplier: 3.8,
    damageMultiplier: 2.0,
    speedMultiplier: 1.3,
    ability: 'dragon_breath',
    bonusGold: 200,
    bonusExp: 150,
    icon: '🐲'
  },
  sc_ghost: {
    name: "Banshee of the Sands",
    title: "Jeritan Jiwa Gurun",
    auraColor: 0x00e676,
    scaleBonus: 1.55,
    hpMultiplier: 3.0,
    damageMultiplier: 1.6,
    speedMultiplier: 1.35,
    ability: 'dune_shriek',
    bonusGold: 125,
    bonusExp: 95,
    icon: '💀'
  },
  sc_squidle: {
    name: "Leviathan Dune Stalker",
    title: "Monster Tentakel Gurun",
    auraColor: 0x651fff,
    scaleBonus: 1.6,
    hpMultiplier: 3.2,
    damageMultiplier: 1.7,
    speedMultiplier: 1.3,
    ability: 'sand_vortex',
    bonusGold: 135,
    bonusExp: 100,
    icon: '🦑'
  },
  sc_soldier: {
    name: "Centurion Maximus",
    title: "Jenderal Pasukan Tanpa Tanding",
    auraColor: 0xffffff,
    scaleBonus: 1.5,
    hpMultiplier: 3.6,
    damageMultiplier: 1.9,
    speedMultiplier: 1.1,
    ability: 'phalanx_shield',
    bonusGold: 160,
    bonusExp: 120,
    icon: '🛡️'
  }
};

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
  sc_soldier: { id: 'sc_soldier_badge', name: 'Soldier Badge',   value: 35, color: 0xcccccc, icon: '🛡️' },
};

export const consumableItems = {
  health_crystal: { id: 'health_crystal', name: 'Health Crystal', icon: '💎', effect: 'heal', value: 50, cooldown: 300 },
  antidote: { id: 'antidote', name: 'Antidote', icon: '🧪', effect: 'cure_poison', value: 15, cooldown: 0 },
  cooling_tea: { id: 'cooling_tea', name: 'Cooling Tea', icon: '🍵', effect: 'cure_burn', value: 15, cooldown: 0 },
  health_potion: { id: 'health_potion', name: 'Health Potion', icon: '🧪', effect: 'heal', value: 40, cooldown: 0 },
  hometown_portal: { id: 'hometown_portal', name: 'Portal Scroll', icon: '📜', effect: 'teleport', value: 50, cooldown: 0 },
  stamina_potion: { id: 'stamina_potion', name: 'Stamina Potion', icon: '⚡', effect: 'restore_sp', value: 25, cooldown: 0 },
};

export const statusEffects = {
  poison: { name: 'Poison', color: 0x00ff00, damage: 2, duration: 300, tickInterval: 60 },
  burn: { name: 'Burn', color: 0xff4400, damage: 3, duration: 240, tickInterval: 60 },
};

export const craftingRecipes = [
  { result: 'health_potion', count: 1, ingredients: { wood_scrap: 2, slime_gel: 1 } },
  { result: 'stamina_potion', count: 1, ingredients: { slime_gel: 1, bone: 2 } },
  { result: 'antidote', count: 1, ingredients: { bone: 3, magic_dust: 1 } },
  { result: 'cooling_tea', count: 1, ingredients: { iron_shard: 2, golem_core: 1 } },
  { result: 'health_crystal', count: 1, ingredients: { demon_horn: 1, hell_fire: 1, holy_gem: 1 } },
];
