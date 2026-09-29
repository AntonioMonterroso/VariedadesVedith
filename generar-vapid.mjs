// Genera las llaves para notificaciones push. Uso:  node generar-vapid.mjs
// No necesita instalar nada. Guarda la salida: la PRIVADA y el SECRETO van a
// Supabase (secrets), la PÚBLICA va en config.js. Nunca subas la privada a GitHub.
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const prv = privateKey.export({ format: 'jwk' });
const b64u = (b) => Buffer.from(b).toString('base64url');
const publica = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]));
const privada = prv.d;

console.log('\nVAPID_PUBLIC_KEY  (va en config.js y en el secret de Supabase):\n' + publica);
console.log('\nVAPID_PRIVATE_KEY (SOLO en el secret de Supabase, secreta):\n' + privada);
console.log('\nPUSH_SECRET (secret de Supabase Y push_setup.sql):\n' + b64u(randomBytes(32)) + '\n');
