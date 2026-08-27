import assert from 'node:assert/strict';
import {
  allowedOrigin,bootstrapTokenHash,hmacHex,normalizeActivationCode,normalizeEmployeeNumber,
  randomSixDigits,syntheticEmail,validActivationCode,validEmployeeNumber
} from './src/security.js';

assert.equal(normalizeEmployeeNumber(' sm001 '),'SM001');
assert.equal(normalizeEmployeeNumber(' sm 001 '),'SM 001');
assert.equal(normalizeActivationCode('12 34-56'),'123456');
assert.equal(validEmployeeNumber('SM-001'),true);
assert.equal(validEmployeeNumber('bad employee id'),false);
assert.equal(validActivationCode('123456'),true);
assert.equal(validActivationCode('12345'),false);
assert.equal(syntheticEmail('123e4567-e89b-12d3-a456-426614174000'),'smi-123e4567e89b12d3a456426614174000@auth.invalid');
assert.match(randomSixDigits(),/^\d{6}$/);
const h1=await hmacHex('pepper','activation:SM001:123456');
const h2=await hmacHex('pepper','activation:SM001:123456');
const h3=await hmacHex('pepper','activation:SM001:123457');
assert.equal(h1,h2);assert.notEqual(h1,h3);assert.equal(h1.length,64);
const env={ALLOWED_ORIGIN:'https://sindhorn-midtown-internal.pages.dev',PREVIEW_MODE:'true'};
assert.equal(allowedOrigin(env.ALLOWED_ORIGIN,env),true);
assert.equal(allowedOrigin('https://phase9-auth.sindhorn-midtown-internal.pages.dev',env),true);
assert.equal(allowedOrigin('https://evil.example',env),false);
assert.equal(bootstrapTokenHash({properties:{hashed_token:'abc123'}}),'abc123');
assert.equal(bootstrapTokenHash({properties:{action_link:'https://x.example/verify?token=hash456&type=magiclink'}}),'hash456');
console.log('auth-worker tests passed');
