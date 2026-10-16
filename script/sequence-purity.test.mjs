import assert from 'node:assert/strict';
import test from 'node:test';
import { sequenceGrade, sequenceStats } from '../client/src/lib/sequence.ts';

const trades = (...grades) => grades.map(setupGrade => ({ setupGrade, date: '2026-10-16', realisedR: 0 }));
test('A+ and A both count toward purity', () => {
  const stats = sequenceStats(trades('A+', 'A'));
  assert.equal(stats.purity, '100%');
  assert.equal(stats.good, 2);
});
test('Fake A+, B, and Retard each reduce purity', () => {
  for (const grade of ['Fake A+', 'B', 'Retard']) {
    assert.equal(sequenceStats(trades('A+', grade)).purity, '50%');
    assert.equal(sequenceStats(trades(grade)).purity, '0%');
  }
});
test('mixed grades use all five classifications', () => {
  const stats = sequenceStats(trades('A+', 'A', 'Fake A+', 'B', 'Retard'));
  assert.equal(stats.purity, '40%');
  assert.equal(stats.good, 2);
  assert.equal(stats.bad, 3);
  assert.deepEqual([stats.aPlus, stats.a, stats.fake, stats.b, stats.retard], [1, 1, 1, 1, 1]);
});
test('missing and unknown grades are excluded rather than counted as good', () => {
  assert.equal(sequenceStats(trades('A', 'B', '', null, 'Custom')).purity, '50%');
  assert.equal(sequenceStats(trades('', null, 'Custom')).purity, '—');
  assert.equal(sequenceStats([]).purity, '—');
});
test('grade normalization and results do not change quality', () => {
  assert.deepEqual(trades(' a+ ', ' a ', ' fake   a+ ', ' b ', ' RETARD ').map(sequenceGrade), ['A+', 'A', 'Fake A+', 'B', 'Retard']);
  assert.equal(sequenceStats(trades('A', 'B').map((t,i) => ({...t, realisedR: i ? 5 : -1}))).purity, '50%');
});
