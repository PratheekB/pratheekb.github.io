#!/usr/bin/env node
// Encrypts photos and other files (PDFs and so on) for the hidden vault page (vault/index.html). Run it on your
// own computer with Node 18 or newer; it needs no packages.
//
//   node tools/vault.mjs add ~/Pictures/a.jpg ~/Docs/b.pdf       add photos or files
//   node tools/vault.mjs list                                    show what's inside
//   node tools/vault.mjs remove 3                                remove item number 3
//   node tools/vault.mjs passwd                                  change the password
//
// The first `add` creates the vault and asks for a new password. Only
// ciphertext is written into vault/, so the repo never holds a plain file or
// the password; commit vault/ afterwards. The password can also be given in
// the VAULT_PASSWORD environment variable.
//
// Format: vault/vault.json holds the PBKDF2 salt and iteration count, plus the
// encrypted list of items. Each item is vault/photos/<id>.bin, laid out as
// a 12-byte IV followed by AES-256-GCM ciphertext, with the id as associated
// data so files can't be swapped around.

import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ITERATIONS = 600000;
const VAULT = join(dirname(fileURLToPath(import.meta.url)), '..', 'vault');
const INDEX = join(VAULT, 'vault.json');
const PHOTOS = join(VAULT, 'photos');
// Images show in the vault's grid; any other file is listed below it
const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/plain', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.zip': 'application/zip', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const typeOf = (f) => TYPES[extname(f).toLowerCase()] || 'application/octet-stream';

const enc = new TextEncoder();
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

function ask(question) {
  if (process.env.VAULT_PASSWORD) return Promise.resolve(process.env.VAULT_PASSWORD);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.startsWith(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.output.write('\n'); rl.close(); resolve(answer); });
  });
}

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function seal(key, bytes, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

async function open(key, bytes, aad) {
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode(aad) }, key, bytes.slice(12)));
}

// Returns { key, salt, iterations, photos }, creating a new vault if none exists
async function unlock({ create }) {
  if (!existsSync(INDEX)) {
    if (!create) throw new Error('No vault yet. Add a photo first.');
    const password = await ask('New vault password: ');
    if (password.length < 12) throw new Error('Use at least 12 characters; anyone can download the vault and guess offline.');
    if (await ask('Repeat password: ') !== password) throw new Error('Passwords did not match.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { key: await deriveKey(password, salt, ITERATIONS), salt, iterations: ITERATIONS, photos: [] };
  }
  const index = JSON.parse(await readFile(INDEX, 'utf8'));
  const salt = unb64(index.salt);
  const key = await deriveKey(await ask('Vault password: '), salt, index.iterations);
  let photos;
  try {
    photos = JSON.parse(new TextDecoder().decode(await open(key, unb64(index.data), 'index')));
  } catch {
    throw new Error('Wrong password.');
  }
  return { key, salt, iterations: index.iterations, photos };
}

async function save({ key, salt, iterations, photos }) {
  const data = await seal(key, enc.encode(JSON.stringify(photos)), 'index');
  await writeFile(INDEX, JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iterations, salt: b64(salt), data: b64(data) }, null, 2) + '\n');
}

async function add(files) {
  if (!files.length) throw new Error('Name the files to add.');
  for (const f of files) if (!existsSync(f)) throw new Error(`No such file: ${f}`);
  const vault = await unlock({ create: true });
  await mkdir(PHOTOS, { recursive: true });
  for (const f of files) {
    // Random ids, so file names in the repo say nothing about the contents
    const id = b64(crypto.getRandomValues(new Uint8Array(9))).replace(/\+/g, '-').replace(/\//g, '_');
    await writeFile(join(PHOTOS, id + '.bin'), await seal(vault.key, await readFile(f), id));
    vault.photos.push({ id, type: typeOf(f), caption: basename(f, extname(f)), name: basename(f) });
    console.log(`Added ${basename(f)}`);
  }
  await save(vault);
  console.log(`The vault now holds ${vault.photos.length} item(s). Commit the vault/ folder to publish.`);
}

async function list() {
  const { photos } = await unlock({ create: false });
  photos.forEach((p, i) => console.log(`${i + 1}. ${p.name || p.caption}  (${p.id})`));
  if (!photos.length) console.log('The vault is empty.');
}

async function remove(n) {
  const vault = await unlock({ create: false });
  const i = Number(n) - 1;
  if (!vault.photos[i]) throw new Error('No item with that number; see `list`.');
  const [photo] = vault.photos.splice(i, 1);
  await rm(join(PHOTOS, photo.id + '.bin'), { force: true });
  await save(vault);
  console.log(`Removed ${photo.caption}.`);
}

async function passwd() {
  const old = await unlock({ create: false });
  const blobs = [];
  for (const p of old.photos) blobs.push(await open(old.key, await readFile(join(PHOTOS, p.id + '.bin')), p.id));
  delete process.env.VAULT_PASSWORD;
  const password = await ask('New vault password: ');
  if (password.length < 12) throw new Error('Use at least 12 characters.');
  if (await ask('Repeat password: ') !== password) throw new Error('Passwords did not match.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const vault = { key: await deriveKey(password, salt, ITERATIONS), salt, iterations: ITERATIONS, photos: old.photos };
  for (const [i, p] of vault.photos.entries()) await writeFile(join(PHOTOS, p.id + '.bin'), await seal(vault.key, blobs[i], p.id));
  await save(vault);
  console.log('Password changed. Commit the vault/ folder to publish.');
}

const [cmd, ...args] = process.argv.slice(2);
const commands = { add: () => add(args), list, remove: () => remove(args[0]), passwd };
if (!commands[cmd]) {
  console.log('Usage: node tools/vault.mjs add <files...> | list | remove <number> | passwd');
  process.exit(1);
}
commands[cmd]().catch((e) => { console.error(e.message); process.exit(1); });
