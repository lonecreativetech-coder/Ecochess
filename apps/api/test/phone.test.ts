import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../src/auth/phone.js';

test('normalizePhone converts Nigerian local numbers to E.164', () => {
  assert.equal(normalizePhone('08012345678'), '+2348012345678');
  assert.equal(normalizePhone('0801-234-5678'), '+2348012345678');
  assert.equal(normalizePhone('2348012345678'), '+2348012345678');
  assert.equal(normalizePhone('+234 801 234 5678'), '+2348012345678');
});

test('normalizePhone rejects invalid inputs', () => {
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone('not-a-phone'), null);
});
