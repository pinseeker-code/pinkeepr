// Temporary script to generate Nostr keypairs
// Run with: node generate-keys.mjs

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nsecEncode, npubEncode } from 'nostr-tools/nip19';

console.log('\n🔐 Generating Nostr Keypair for Pinkeepr...\n');

const sk = generateSecretKey();
const pk = getPublicKey(sk);

console.log('='.repeat(60));
console.log('PINKEEPR (Bot) Identity');
console.log('='.repeat(60));
console.log(`nsec (PRIVATE - keep secret!): ${nsecEncode(sk)}`);
console.log(`npub (PUBLIC - share this):    ${npubEncode(pk)}`);
console.log('='.repeat(60));

console.log('\n📋 Copy these to your .env file:\n');
console.log(`PINKEEPR_NSEC=${nsecEncode(sk)}`);
console.log(`# PINKEEPR_NPUB=${npubEncode(pk)}  # (for reference)`);
console.log('');
