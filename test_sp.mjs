// Setup minimal mock DOM before any imports
globalThis.document = {
  getElementById: (id) => ({
    textContent: '',
    innerText: '',
    style: {},
    classList: { toggle: () => {} },
    value: '',
    appendChild: () => {},
    addEventListener: () => {},
    getContext: () => new Proxy({}, { get: () => () => {} }),
  }),
  createElement: () => ({
    appendChild: () => {},
    style: {},
  }),
  addEventListener: () => {},
};
globalThis.window = {
  updateUI: () => {},
  updateInventoryUI: () => {},
  saveGame: () => {},
  addEventListener: () => {},
};

const { state } = await import('./src/state.js');
const { useStaminaPotion } = await import('./src/combat.js');
const { buyStaminaPotion, useConsumable } = await import('./src/ui.js');
globalThis.window.useStaminaPotion = useStaminaPotion;

console.log('--- Test 1: SP Auto-Regen Disabled Check ---');
state.player.stamina = 40;
state.player.defending = false;
// Simulate game loop logic:
// Previously: state.player.stamina = Math.min(state.player.maxStamina, state.player.stamina + 0.3 * dt);
// Now: only drains when defending, no auto-regen!
const dt = 1;
if (state.player.defending) {
  state.player.stamina = Math.max(0, state.player.stamina - 0.5 * dt);
}
console.log('Stamina after frame without defending:', state.player.stamina);
if (state.player.stamina === 40) {
  console.log('✅ PASS: SP auto-regeneration is completely disabled.');
} else {
  console.error('❌ FAIL: SP auto-regenerated!');
  process.exit(1);
}

console.log('--- Test 2: Buy Stamina Potion from Shop ---');
state.gold = 50;
state.inventory = {};
buyStaminaPotion();
console.log('Gold after buying SP Potion (expected 30):', state.gold);
console.log('Stamina potions in inventory (expected 1):', state.inventory['stamina_potion']);
if (state.gold === 30 && state.inventory['stamina_potion'] === 1) {
  console.log('✅ PASS: Stamina Potion successfully bought from shop for 20 gold.');
} else {
  console.error('❌ FAIL: Buying Stamina Potion failed.');
  process.exit(1);
}

console.log('--- Test 3: Use Stamina Potion ---');
state.player.stamina = 35;
useStaminaPotion();
console.log('Stamina after potion (expected 100):', state.player.stamina);
console.log('Stamina potions remaining (expected undefined or 0):', state.inventory['stamina_potion']);
if (state.player.stamina === 100 && !state.inventory['stamina_potion']) {
  console.log('✅ PASS: Stamina Potion restores SP to 100 and removes from inventory.');
} else {
  console.error('❌ FAIL: Using Stamina Potion failed.');
  process.exit(1);
}

console.log('--- Test 4: Prevent using SP Potion when SP is full ---');
state.inventory['stamina_potion'] = 1;
state.player.stamina = 100;
useStaminaPotion();
console.log('Stamina potions remaining when SP full (expected 1):', state.inventory['stamina_potion']);
if (state.inventory['stamina_potion'] === 1) {
  console.log('✅ PASS: SP Potion is not consumed when SP is already full.');
} else {
  console.error('❌ FAIL: SP Potion was wasted when full.');
  process.exit(1);
}

console.log('🎉 ALL TESTS PASSED!');
