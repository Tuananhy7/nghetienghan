import assert from 'node:assert';
import { compare } from '../js/diff.js';
const r = compare('안녕하세요 저는 학생이에요.', '안녕하세요 저는 학생이예요');
assert(r.score > 70 && r.score < 100); assert.equal(r.ref[2].ok, false); assert.equal(r.ref[0].ok, true);
assert.equal(compare('저는 학생이에요', '저는, 학생이에요!').score, 100);
assert.equal(compare('저는 학생이에요', '').score, 0);
console.log('diff ok', r.score);
