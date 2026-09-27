// Immutable constants and data tables used across modules.

export const mapSize = 20000;

export const weaponList = [
  { name: "Wooden Sword", damage: 0, cost: 0, color: 0xeeeeee },
  { name: "Iron Sword", damage: 2, cost: 100, color: 0xaaaaaa },
  { name: "Golden Sword", damage: 5, cost: 300, color: 0xffd700 },
  { name: "Fire Blade", damage: 10, cost: 800, color: 0xff4400 },
];

export const armorList = [
  { name: "Rusted Armor", hp: 0, cost: 0, color: 0xaaaaaa },
  { name: "Knight Armor", hp: 50, cost: 150, color: 0xdddddd },
  { name: "Paladin Armor", hp: 150, cost: 400, color: 0xffcc00 },
  { name: "Dragon Armor", hp: 300, cost: 1000, color: 0x221111 },
];

/** Enemy template definitions — order matches the random type selector. */
export const enemyTemplates = [
  { hp: 3,   speed: 1.5, r: 11, typeStr: 'spike',    charKey: 'char_e' },
  { hp: 1.5, speed: 1.5, r: 9,  typeStr: 'slime',    charKey: 'char_f' },
  { hp: 8,   speed: 1.5, r: 15, typeStr: 'golem',    charKey: 'char_g' },
  { hp: 4,   speed: 1.5, r: 9,  typeStr: 'archer',   charKey: 'char_h' },
  { hp: 2,   speed: 1.5, r: 9,  typeStr: 'kamikaze', charKey: 'char_i' },
  { hp: 5,   speed: 1.5, r: 8,  typeStr: 'ghost',    charKey: 'char_j' },
  { hp: 6,   speed: 1.8, r: 12, typeStr: 'knight',   charKey: 'char_k' },
  { hp: 3,   speed: 1.2, r: 8,  typeStr: 'mage',     charKey: 'char_l' },
  { hp: 10,  speed: 1.0, r: 18, typeStr: 'warrior',  charKey: 'char_m' },
  { hp: 4,   speed: 2.5, r: 8,  typeStr: 'thief',    charKey: 'char_n' },
  { hp: 12,  speed: 1.3, r: 16, typeStr: 'paladin',  charKey: 'char_o' },
  { hp: 7,   speed: 1.4, r: 10, typeStr: 'necro',    charKey: 'char_p' },
  { hp: 5,   speed: 2.0, r: 9,  typeStr: 'ranger',   charKey: 'char_q' },
  { hp: 15,  speed: 1.1, r: 20, typeStr: 'demon',    charKey: 'char_r' },
];

export const lootTable = {
  spike: { id: 'wood_scrap', name: 'Wood Scrap', value: 2, color: 0x8b5a2b },
  slime: { id: 'slime_gel', name: 'Slime Gel', value: 5, color: 0x00ff00 },
  golem: { id: 'golem_core', name: 'Golem Core', value: 25, color: 0x888888 },
  archer: { id: 'broken_arrow', name: 'Broken Arrow', value: 4, color: 0xddddaa },
  kamikaze: { id: 'gunpowder', name: 'Gunpowder', value: 8, color: 0x333333 },
  ghost: { id: 'ectoplasm', name: 'Ectoplasm', value: 10, color: 0xaabbff },
  knight: { id: 'iron_shard', name: 'Iron Shard', value: 8, color: 0xaaaaaa },
  mage: { id: 'magic_dust', name: 'Magic Dust', value: 6, color: 0xaa44ff },
  warrior: { id: 'warrior_talon', name: 'Warrior Talon', value: 20, color: 0x884422 },
  thief: { id: 'stolen_gem', name: 'Stolen Gem', value: 12, color: 0xff44ff },
  paladin: { id: 'holy_gem', name: 'Holy Gem', value: 30, color: 0xffdd44 },
  necro: { id: 'dark_essence', name: 'Dark Essence', value: 15, color: 0x440088 },
  ranger: { id: 'beast_fang', name: 'Beast Fang', value: 10, color: 0x228822 },
  demon: { id: 'demon_horn', name: 'Demon Horn', value: 50, color: 0xff0000 },
};
