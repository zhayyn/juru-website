import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_LOCAL_HISTORY, SAMPLE_LOCAL_RANKINGS, AUDIT_STANDARDS } from './standards.ts';

test('tidak menyertakan hasil audit rekaan untuk domain instansi sungguhan', () => {
  assert.deepEqual(SAMPLE_LOCAL_RANKINGS, []);
  assert.deepEqual(SAMPLE_LOCAL_HISTORY, {});
  assert.match(AUDIT_STANDARDS.peradilan_agama.regulationRef, /perlu.*verifikasi|bukan.*resmi/i);
});
