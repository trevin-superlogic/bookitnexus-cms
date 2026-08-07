/**
 * Inheritance rules, asserted against the PDP's four stated behaviours plus
 * the failure modes they're guarding against.
 *
 *   node --experimental-strip-types lib/resolve/inheritance.test.ts
 */
import { applyVisibility, resolveSection, resolveWithDefaults } from './inheritance.ts';

let assertions = 0;
let failed = 0;

function expect(label: string, actual: unknown, expected: unknown): void {
  assertions++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}\n      expected: ${e}\n      actual:   ${a}`);
  }
}

console.log('Inheritance:\n');

expect(
  'unset tenant field inherits the default',
  resolveWithDefaults({ pointsName: 'PT', currency: 'USD' }, { currency: undefined }).value,
  { pointsName: 'PT', currency: 'USD' },
);

expect(
  'populated tenant field overrides',
  resolveWithDefaults({ pointsName: 'PT' }, { pointsName: 'CRO' }).value,
  { pointsName: 'CRO' },
);

// The bug this exists to prevent: a falsy check here means a tenant can never
// switch off something the universal default switches on.
expect(
  'false overrides true',
  resolveWithDefaults({ hasTicketing: true, hasSweeps: true }, { hasTicketing: false }).value,
  { hasTicketing: false, hasSweeps: true },
);

expect('zero overrides a non-zero default', resolveWithDefaults({ feePercentage: 4 }, { feePercentage: 0 }).value, {
  feePercentage: 0,
});

expect(
  'empty string inherits rather than blanking the UI',
  resolveWithDefaults({ supportEmail: 'support@bookit.com' }, { supportEmail: '' }).value,
  { supportEmail: 'support@bookit.com' },
);

expect(
  'empty string raises a warning that names the field',
  resolveWithDefaults({ supportEmail: 'a@b.com' }, { supportEmail: '   ' }).warnings.map((w) => [w.path, w.code]),
  [['supportEmail', 'empty-string-inherits']],
);

expect(
  'nested objects merge key by key',
  resolveWithDefaults(
    { footer: { supportEmail: 'a@b.com', phone: '+1', legal: 'ONE Inc.' } },
    { footer: { phone: '+44' } },
  ).value,
  { footer: { supportEmail: 'a@b.com', phone: '+44', legal: 'ONE Inc.' } },
);

expect(
  'arrays replace wholesale instead of merging by index',
  resolveWithDefaults({ nav: ['Stays', 'Flights', 'Cars'] }, { nav: ['Tickets'] }).value,
  { nav: ['Tickets'] },
);

expect(
  'overridden paths are reported',
  resolveWithDefaults({ a: { b: 1, c: 2 }, d: 3 }, { a: { b: 9 } }).overridden,
  ['a.b'],
);

console.log('\nVisibility:\n');

expect(
  'visible:false removes the block',
  applyVisibility({ footer: { visible: false, phone: '+1' }, nav: { visible: true, items: ['Stays'] } }),
  { nav: { items: ['Stays'] } },
);

expect(
  'visible key never reaches the app',
  applyVisibility({ nav: { visible: true, items: ['Stays'] } }),
  { nav: { items: ['Stays'] } },
);

expect(
  'hidden array entries are dropped',
  applyVisibility({ slots: [{ visible: true, label: 'Stays' }, { visible: false, label: 'Slot 3' }] }),
  { slots: [{ label: 'Stays' }] },
);

expect(
  'emptiness alone never hides — only an explicit toggle does',
  applyVisibility({ footer: { phone: '' } }),
  { footer: { phone: '' } },
);

console.log('\nFull section pipeline:\n');

// Mirrors the real Nav Bar shape from the Figma tenant-config collection.
const navDefaults = {
  level1: [
    { visible: true, label: 'Stays', url: '/stays' },
    { visible: true, label: 'Flights', url: '/flights' },
    { visible: true, label: 'Tickets', url: '/tickets' },
  ],
  featured: { visible: true, label: 'Sweepstakes', url: '/sweeps' },
};

expect(
  'a tenant without ticketing hides the featured slot and keeps the rest',
  resolveSection(navDefaults, { featured: { visible: false } }).value,
  { level1: [{ label: 'Stays', url: '/stays' }, { label: 'Flights', url: '/flights' }, { label: 'Tickets', url: '/tickets' }] },
);

expect(
  'a tenant replacing nav supplies the whole list',
  resolveSection(navDefaults, { level1: [{ visible: true, label: 'Experiences', url: '/x' }] }).value,
  { level1: [{ label: 'Experiences', url: '/x' }], featured: { label: 'Sweepstakes', url: '/sweeps' } },
);

console.log(`\n${assertions - failed}/${assertions} assertions passed.`);
process.exit(failed === 0 ? 0 : 1);
