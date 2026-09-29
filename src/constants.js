// Immutable constants and data tables used across modules.

export const mapSize = 20000;

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

export const enemyTemplates = [
  { hp: 3,   speed: 1.5, r: 11, typeStr: 'spike',    charKey: 'char_e' },
  { hp: 1.5, speed: 1.5, r: 9,  typeStr: 'slime',    charKey: 'char_f' },
  { hp: 8,   speed: 1.5, r: 15, typeStr: 'golem',    charKey: 'char_g' },
  { hp: 4,   speed: 1.5, r: 9,  typeStr: 'archer',   charKey: 'char_h' },
  { hp: 2,   speed: 1.5, r: 9,  typeStr: 'kamikaze', charKey: 'char_i' },
  { hp: 5,   speed: 1.5, r: 8,  typeStr: 'ghost',    charKey: 'char_j' },
  { hp: 6,   speed: 1.5, r: 12, typeStr: 'knight',   charKey: 'char_k' },
  { hp: 3,   speed: 1.5, r: 8,  typeStr: 'mage',     charKey: 'char_l' },
  { hp: 10,  speed: 1.5, r: 18, typeStr: 'warrior',  charKey: 'char_m' },
  { hp: 4,   speed: 1.5, r: 8,  typeStr: 'thief',    charKey: 'char_n' },
  { hp: 12,  speed: 1.5, r: 16, typeStr: 'paladin',  charKey: 'char_o' },
  { hp: 7,   speed: 1.5, r: 10, typeStr: 'necro',    charKey: 'char_p' },
  { hp: 5,   speed: 1.5, r: 9,  typeStr: 'ranger',   charKey: 'char_q' },
  { hp: 15,  speed: 1.5, r: 20, typeStr: 'demon',    charKey: 'char_r' },
  { hp: 2,   speed: 1.5, r: 8,  typeStr: 'zombie',   charKey: 'char_a' },
  { hp: 4,   speed: 1.5, r: 10, typeStr: 'skeleton', charKey: 'char_b' },
  { hp: 6,   speed: 1.5, r: 12, typeStr: 'vampire',  charKey: 'char_c' },
  { hp: 3,   speed: 1.5, r: 8,  typeStr: 'goblin',   charKey: 'char_d' },
  { hp: 8,   speed: 1.5, r: 15, typeStr: 'beast',    charKey: 'enemy' },
  { hp: 25,  speed: 1.5, r: 25, typeStr: 'archdemon',charKey: 'char_r' },
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
};
