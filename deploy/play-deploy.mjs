#!/usr/bin/env node
/**
 * Vector Vanguard — Google Play deploy script.
 *
 * Uploads a signed .aab to a Play track via the Android Publisher API v3.
 * Zero dependencies: JWT is signed with node:crypto, HTTP via global fetch.
 *
 * Usage:
 *   node deploy/play-deploy.mjs --check                 # verify auth + show tracks
 *   node deploy/play-deploy.mjs --track internal        # upload + commit
 *   node deploy/play-deploy.mjs --track internal --dry-run
 *
 * Flags:
 *   --track <internal|alpha|beta|production>  target track (default: internal)
 *   --aab <path>        bundle to upload (default: android/app/build/outputs/bundle/release/app-release.aab)
 *   --creds <path>      service account json (default: deploy/service-account.json)
 *   --package <id>      package name (default: read from capacitor.config.json)
 *   --status <draft|completed|inProgress>     release status (default: completed)
 *   --rollout <0..1>    user fraction, requires --status inProgress
 *   --notes <text>      release notes for en-US
 *   --edit <id>         reuse an existing open edit instead of uploading again
 *   --listing           push the store listing from docs/playstore/store-listing.md
 *   --countries <list>  ISO codes for the release, or "world" for everywhere
 *   --version-code <n>  promote an already-uploaded bundle; skips the upload
 *                       entirely (use when moving a build between tracks)
 *   --images            upload icon/feature graphic/screenshots from resources/playstore
 *   --force-images      allow --images to shrink a set that is larger on Play
 *   --details           push contact email/website/phone from store-listing.md
 *   --data-safety <csv> upload a Data Safety CSV exported from Play Console
 *   --ai-generated <v>  image provenance: "none" or "attested" (see README)
 *   --check             auth + track listing only, no upload
 *   --verify            read every API-visible field back and report
 *   --dry-run           do everything except commit the edit (edit is deleted)
 */

import { readFileSync, statSync, createReadStream, readdirSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const TRACKS = ['internal', 'alpha', 'beta', 'production'];

// ---------- args ----------

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// Flags that take no value. Anything else consumes the following token, so a
// boolean omitted from this list silently swallows the next flag.
const BOOLEAN_FLAGS = new Set(['check', 'dry-run', 'verify', 'images', 'details', 'listing', 'force-images']);

function parseArgs(argv) {
  const out = { track: 'internal', status: 'completed' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      out[key === 'dry-run' ? 'dryRun' : key] = true;
      continue;
    }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) {
      fail(`--${key} expects a value`);
    }
    out[key] = val;
    i++;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const credsPath = resolve(ROOT, args.creds ?? 'deploy/service-account.json');
const aabPath = resolve(ROOT, args.aab ?? 'android/app/build/outputs/bundle/release/app-release.aab');

function readPackageName() {
  if (args.package) return args.package;
  const cfg = JSON.parse(readFileSync(resolve(ROOT, 'capacitor.config.json'), 'utf8'));
  return cfg.appId;
}

// ---------- auth ----------

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: SCOPE,
    aud: creds.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(creds.private_key));
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(creds.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Token request failed (${res.status}): ${body.error} — ${body.error_description ?? ''}`);
  }
  return body.access_token;
}

// ---------- api helper ----------

let token;

async function api(method, path, { json, body, headers = {}, upload = false } = {}) {
  const url = `${upload ? UPLOAD_API : API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : body,
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const msg = parsed?.error?.message ?? parsed.raw ?? text;
    const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.details = parsed?.error;
    throw err;
  }
  return parsed;
}

/**
 * Stream the bundle with node:https rather than fetch.
 *
 * fetch() applies undici's 300s bodyTimeout, which a slow uplink trips long
 * before a multi-MB bundle finishes. node:https has no such default, and the
 * progress output keeps a slow upload visibly alive.
 */
function uploadBundle({ packageName, editId, path, size }) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest({
      method: 'POST',
      host: 'androidpublisher.googleapis.com',
      path: `/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/bundles?uploadType=media`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': size,
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`bundle upload -> ${res.statusCode}: ${parsed?.error?.message ?? text}`);
          err.status = res.statusCode;
          err.details = parsed?.error;
          return reject(err);
        }
        resolve(parsed);
      });
    });

    req.setTimeout(0);
    req.on('error', reject);

    let sent = 0;
    let lastPct = -1;
    const started = Date.now();
    const stream = createReadStream(path);
    stream.on('data', (chunk) => {
      sent += chunk.length;
      const pct = Math.floor((sent / size) * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct;
        const kbs = sent / 1024 / ((Date.now() - started) / 1000);
        process.stdout.write(`    ${String(pct).padStart(3)}%  ${kbs.toFixed(1)} KB/s\n`);
      }
    });
    stream.on('error', reject);
    stream.pipe(req);
  });
}

/** Generic resumable-free media POST, sharing uploadBundle's no-timeout behaviour. */
function uploadMedia({ path, file, contentType }) {
  const size = statSync(file).size;
  return new Promise((resolve, reject) => {
    const req = httpsRequest({
      method: 'POST',
      host: 'androidpublisher.googleapis.com',
      path,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': size,
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`${path} -> ${res.statusCode}: ${parsed?.error?.message ?? text}`);
          err.status = res.statusCode;
          err.details = parsed?.error;
          return reject(err);
        }
        resolve(parsed);
      });
    });
    req.setTimeout(0);
    req.on('error', reject);
    createReadStream(file).on('error', reject).pipe(req);
  });
}

// Play's imageType enum -> where we keep each asset. Verified against the v3
// discovery doc (edits.images.upload).
const IMAGE_SETS = {
  icon: { files: ['resources/playstore/icon-512.png'] },
  featureGraphic: { files: ['resources/playstore/feature-graphic.png'] },
  phoneScreenshots: { dir: 'resources/playstore/screenshots/phone' },
  sevenInchScreenshots: { dir: 'resources/playstore/screenshots/tablet-7' },
  tenInchScreenshots: { dir: 'resources/playstore/screenshots/tablet-10' },
};

function imageFilesFor(spec) {
  if (spec.files) return spec.files.map((f) => resolve(ROOT, f)).filter((f) => existsSync(f));
  const dir = resolve(ROOT, spec.dir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
    .map((f) => resolve(dir, f));
}

/**
 * Replace the listing graphics for a language.
 *
 * deleteall runs first so re-running is idempotent rather than appending
 * duplicate screenshots. Nothing is visible until the edit commits.
 */
async function pushImages({ packageName, editId, language }) {
  const ai = args['ai-generated'];
  const aiParam = ai === 'attested' ? '&aiGeneratedState=aiGeneratedStateAiGeneratedDeveloperAttested'
    : ai === 'none' ? '&aiGeneratedState=aiGeneratedStateNotAiGenerated'
    : '';
  const summary = {};
  for (const [imageType, spec] of Object.entries(IMAGE_SETS)) {
    const files = imageFilesFor(spec);
    if (!files.length) { console.log(`    ${imageType}: no local files, skipped`); continue; }

    // Console uploads are invisible to the repo. Replacing blind would silently
    // discard assets that only exist on Play, so refuse to shrink a set.
    const live = await api('GET', `/applications/${packageName}/edits/${editId}/listings/${language}/${imageType}`);
    const liveCount = (live.images ?? []).length;
    if (liveCount > files.length && !args['force-images']) {
      fail(`${imageType}: Play has ${liveCount} image(s) but only ${files.length} exist locally.\n` +
        `  Replacing would delete ${liveCount - files.length}. Someone likely uploaded in Console.\n` +
        `  Pull them down first, or pass --force-images to overwrite deliberately.`);
    }

    await api('DELETE', `/applications/${packageName}/edits/${editId}/listings/${language}/${imageType}`);
    for (const f of files) {
      const ct = /\.png$/i.test(f) ? 'image/png' : 'image/jpeg';
      await uploadMedia({
        path: `/upload/androidpublisher/v3/applications/${packageName}/edits/${editId}/listings/${language}/${imageType}?uploadType=media${aiParam}`,
        file: f,
        contentType: ct,
      });
    }
    summary[imageType] = files.length;
    console.log(`    ${imageType}: ${files.length} uploaded`);
  }
  return summary;
}

/** Contact details shown on the store page (edits.details). */
function readDetails() {
  const md = readFileSync(resolve(ROOT, 'docs/playstore/store-listing.md'), 'utf8');
  const grab = (label) => {
    const m = md.match(new RegExp(`- ${label}:\\s*(.+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  const d = { defaultLanguage: 'en-US' };
  const email = grab('Support email');
  const site = grab('Website');
  const phone = grab('Phone');
  if (email) d.contactEmail = email;
  if (site) d.contactWebsite = site;
  if (phone) d.contactPhone = phone;
  return d;
}

/**
 * Pull the store copy out of docs/playstore/store-listing.md.
 *
 * The doc keeps each field in a fenced block under a known heading, so the
 * markdown stays the single source of truth rather than duplicating copy here.
 */
function readListing() {
  const md = readFileSync(resolve(ROOT, 'docs/playstore/store-listing.md'), 'utf8');
  const block = (heading) => {
    const h = md.indexOf(heading);
    if (h === -1) return null;
    const open = md.indexOf('```', h);
    if (open === -1) return null;
    const start = md.indexOf('\n', open) + 1;
    const close = md.indexOf('```', start);
    return md.slice(start, close).trim();
  };

  const listing = {
    title: 'Vector Vanguard',
    shortDescription: block('## Short description'),
    fullDescription: block('## Full description'),
  };

  const limits = { title: 30, shortDescription: 80, fullDescription: 4000 };
  for (const [field, max] of Object.entries(limits)) {
    if (!listing[field]) fail(`Could not parse "${field}" from docs/playstore/store-listing.md`);
    if (listing[field].length > max) {
      fail(`${field} is ${listing[field].length} chars, Play allows ${max}`);
    }
  }
  return listing;
}

/** Read every API-visible field back from Play and print it. Never trust a write. */
async function reportState({ packageName, editId }) {
  const line = (k, v) => console.log(`    ${k.padEnd(22)} ${v}`);

  console.log('\n  App details:');
  try {
    const d = await api('GET', `/applications/${packageName}/edits/${editId}/details`);
    line('defaultLanguage', d.defaultLanguage ?? '(unset)');
    line('contactEmail', d.contactEmail ?? '(unset)');
    line('contactWebsite', d.contactWebsite ?? '(unset)');
    line('contactPhone', d.contactPhone ?? '(unset)');
  } catch (e) { line('details', `unavailable — ${e.message}`); }

  console.log('\n  Listings:');
  try {
    const l = await api('GET', `/applications/${packageName}/edits/${editId}/listings`);
    for (const li of l.listings ?? []) {
      line(li.language, `title=${(li.title ?? '').length}c short=${(li.shortDescription ?? '').length}c full=${(li.fullDescription ?? '').length}c`);
    }
    if (!(l.listings ?? []).length) line('(none)', 'no listings');
  } catch (e) { line('listings', `unavailable — ${e.message}`); }

  console.log('\n  Graphics (en-US):');
  for (const imageType of Object.keys(IMAGE_SETS)) {
    try {
      const r = await api('GET', `/applications/${packageName}/edits/${editId}/listings/en-US/${imageType}`);
      line(imageType, `${(r.images ?? []).length} on Play`);
    } catch (e) { line(imageType, `error — ${e.message}`); }
  }

  console.log('\n  Country availability (read-only in the API):');
  for (const t of TRACKS) {
    try {
      const c = await api('GET', `/applications/${packageName}/edits/${editId}/countryAvailability/${t}`);
      const n = (c.countries ?? []).length;
      line(t, `restOfWorld=${!!c.restOfWorld} countries=${n} syncWithProduction=${!!c.syncWithProduction}`);
    } catch (e) { line(t, `n/a — ${(e.message || '').slice(-60)}`); }
  }
}

/**
 * Upload a Data Safety declaration.
 *
 * The API takes the *same CSV* that Play Console imports and exports, so the
 * file must come from Console (Data safety -> Export). We deliberately do not
 * synthesise this CSV: it is a legal declaration, and a guessed column layout
 * could silently file the wrong answers.
 */
async function pushDataSafety({ packageName, file }) {
  const csv = readFileSync(resolve(ROOT, file), 'utf8');
  console.log(`\n→ Uploading Data Safety CSV (${csv.split(/\r?\n/).length} lines)…`);
  await api('POST', `/applications/${packageName}/dataSafety`, { json: { safetyLabels: csv } });
  console.log('  ✓ Play accepted the Data Safety declaration');
  console.log('    Verify it in Console → App content → Data safety.');
}

/** versionCode in the gradle config that produced the local bundle. */
function localVersionCode() {
  try {
    const g = readFileSync(resolve(ROOT, 'android/app/build.gradle'), 'utf8');
    const m = g.match(/versionCode\s+(\d+)/);
    return m ? Number(m[1]) : null;
  } catch { return null; }
}

// ---------- steps ----------

async function main() {
  if (!TRACKS.includes(args.track)) fail(`--track must be one of: ${TRACKS.join(', ')}`);
  if (args.rollout && args.status !== 'inProgress') {
    fail('--rollout requires --status inProgress');
  }
  // Play rejects countryTargeting outside a staged rollout:
  // "Country targeting is only supported for staged releases."
  if (args.countries && args.status !== 'inProgress') {
    fail('--countries only applies to staged releases (--status inProgress --rollout <n>).\n' +
      '  For a full release, set availability in Play Console →\n' +
      '  Production → Countries / regions.');
  }

  let creds;
  try {
    creds = JSON.parse(readFileSync(credsPath, 'utf8'));
  } catch (e) {
    fail(`Cannot read service account at ${credsPath}\n  ${e.message}`);
  }

  const packageName = readPackageName();

  console.log(`Package  : ${packageName}`);
  console.log(`Account  : ${creds.client_email}`);
  console.log(`Track    : ${args.track}`);

  console.log('\n→ Requesting access token…');
  token = await getAccessToken(creds);
  console.log('  ✓ authenticated');

  console.log(args.edit ? `\n→ Reusing edit ${args.edit}…` : '\n→ Opening edit…');
  let edit;
  try {
    edit = args.edit
      ? await api('GET', `/applications/${packageName}/edits/${args.edit}`)
      : await api('POST', `/applications/${packageName}/edits`);
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      fail(`Play API rejected the service account (${e.status}).\n` +
        `  ${e.message}\n\n` +
        `  Checklist:\n` +
        `   1. Play Console → Users and permissions → invite ${creds.client_email}\n` +
        `      with "Release to testing tracks" + "Release to production" app permissions.\n` +
        `   2. Google Cloud console → enable "Google Play Android Developer API"\n` +
        `      for project ${creds.project_id}.\n` +
        `   3. Play Console → Setup → API access → link the Cloud project.`);
    }
    if (e.status === 404) {
      fail(`App "${packageName}" does not exist in this Play Console account.\n\n` +
        `  The Play API cannot create apps — the first app entry and the first\n` +
        `  release upload must be done manually in Play Console. Create the app at\n` +
        `  https://play.google.com/console → Create app, then re-run this script.`);
    }
    throw e;
  }
  const editId = edit.id;
  console.log(`  ✓ edit ${editId}`);

  // Only discard edits this run created. A resumed edit (--edit) belongs to the
  // caller and may hold an already-uploaded bundle worth keeping.
  async function cleanup() {
    if (args.edit) {
      console.log(`\n  (edit ${editId} left open for reuse: --edit ${editId})`);
      return;
    }
    try { await api('DELETE', `/applications/${packageName}/edits/${editId}`); } catch { /* best effort */ }
  }

  // Show current track state — useful on its own.
  const tracks = await api('GET', `/applications/${packageName}/edits/${editId}/tracks`);
  console.log('\n  Current tracks:');
  for (const t of tracks.tracks ?? []) {
    const rel = (t.releases ?? [])
      .map((r) => `${r.name ?? '?'} (vc ${r.versionCodes?.join(',') ?? '-'}, ${r.status})`)
      .join('; ') || 'no releases';
    console.log(`   • ${t.track.padEnd(12)} ${rel}`);
  }

  if (args.check || args.verify) {
    if (args.verify) await reportState({ packageName, editId });
    await cleanup();
    console.log('\n✓ Check passed — credentials work and the app is reachable.\n');
    return;
  }

  // ---- upload bundle ----
  let stat;
  if (!args['version-code']) {
    try {
      stat = statSync(aabPath);
    } catch {
      await cleanup();
      fail(`AAB not found at ${aabPath}\n  Build it first: npm run android:build`);
    }
  }
  // Promotion: the bundle is already on Play, so assign it to another track
  // rather than re-uploading. Play rejects a versionCode that is already used.
  let bundle;
  if (args['version-code']) {
    const all = await api('GET', `/applications/${packageName}/edits/${editId}/bundles`);
    bundle = (all.bundles ?? []).find((b) => String(b.versionCode) === String(args['version-code']));
    if (!bundle) {
      await cleanup();
      fail(`versionCode ${args['version-code']} is not uploaded to this app.\n` +
        `  Available: ${(all.bundles ?? []).map((b) => b.versionCode).join(', ') || 'none'}`);
    }
    console.log(`\n→ Promoting existing versionCode ${bundle.versionCode} — no upload needed.`);
  }

  // A resumed edit may already hold the bundle; re-uploading is wasteful on a
  // slow link, so reuse whatever is already there.
  if (!bundle && args.edit) {
    const existing = await api('GET', `/applications/${packageName}/edits/${editId}/bundles`);
    bundle = (existing.bundles ?? []).at(-1);
    if (bundle) console.log(`\n→ Edit already holds versionCode ${bundle.versionCode} — skipping upload.`);
  }

  if (!bundle) {
    // Play permanently burns a versionCode on commit. Refuse to re-upload one
    // that already exists rather than failing halfway through a long upload.
    const vc = localVersionCode();
    const onPlay = await api('GET', `/applications/${packageName}/edits/${editId}/bundles`);
    const used = (onPlay.bundles ?? []).map((b) => Number(b.versionCode));
    if (vc && used.includes(vc)) {
      await cleanup();
      fail(`versionCode ${vc} is already uploaded to this app (present: ${used.join(', ')}).\n` +
        `  Play never allows a versionCode to be reused. Either:\n` +
        `   • bump versionCode in android/app/build.gradle and rebuild, or\n` +
        `   • promote the existing build with --version-code ${vc}`);
    }
    if (vc) console.log(`\n  versionCode ${vc} is free (on Play: ${used.join(', ') || 'none'})`);
    console.log(`\n→ Uploading ${aabPath.replace(ROOT + '/', '')} (${(stat.size / 1024 / 1024).toFixed(2)} MB)…`);
    console.log('    (slow uplinks can take several minutes; progress below)');
    bundle = await uploadBundle({ packageName, editId, path: aabPath, size: stat.size });
  }

  const versionCode = bundle.versionCode;
  console.log(`  ✓ versionCode ${versionCode} (sha256 ${bundle.sha256?.slice(0, 16)}…)`);

  // ---- assign to track ----
  const release = {
    name: args.notes ? undefined : `${versionCode}`,
    versionCodes: [String(versionCode)],
    status: args.status,
  };
  if (args.rollout) release.userFraction = Number(args.rollout);
  if (args.countries) {
    release.countryTargeting = args.countries === 'world'
      ? { includeRestOfWorld: true }
      : { countries: args.countries.split(',').map((c) => c.trim().toUpperCase()), includeRestOfWorld: false };
  }
  if (args.notes) {
    release.releaseNotes = [{ language: 'en-US', text: args.notes }];
  }

  if (args['data-safety']) {
    await pushDataSafety({ packageName, file: args['data-safety'] });
  }

  if (args.details) {
    const details = readDetails();
    console.log('\n→ Updating app details…');
    const got = await api('PUT', `/applications/${packageName}/edits/${editId}/details`, { json: details });
    console.log(`  ✓ ${got.contactEmail ?? '-'} · ${got.contactWebsite ?? '-'} · ${got.contactPhone ?? '-'}`);
  }

  if (args.images) {
    console.log('\n→ Uploading store graphics…');
    await pushImages({ packageName, editId, language: 'en-US' });
  }

  if (args.listing) {
    const listing = readListing();
    console.log('\n→ Updating en-US store listing…');
    await api('PUT', `/applications/${packageName}/edits/${editId}/listings/en-US`, {
      json: { language: 'en-US', ...listing },
    });
    console.log(`  ✓ title ${listing.title.length}c · short ${listing.shortDescription.length}c · full ${listing.fullDescription.length}c`);
  }

  console.log(`\n→ Assigning to "${args.track}" track (status: ${args.status}${args.rollout ? `, rollout ${args.rollout}` : ''})…`);
  await api('PUT', `/applications/${packageName}/edits/${editId}/tracks/${args.track}`, {
    json: { track: args.track, releases: [release] },
  });
  console.log('  ✓ track updated');

  if (args.dryRun) {
    // edits:validate runs Play's own server-side checks without publishing,
    // which catches far more than simply discarding the edit ever did.
    console.log('\n→ Validating edit (server-side, no publish)…');
    try {
      await api('POST', `/applications/${packageName}/edits/${editId}:validate`);
      console.log('  ✓ Play validated the edit');
    } catch (e) {
      console.log(`  ✗ validation failed: ${e.message}`);
      await cleanup();
      process.exit(1);
    }
    await cleanup();
    console.log('\n✓ Dry run complete — edit discarded, nothing published.\n');
    return;
  }

  console.log('\n→ Committing edit…');
  await api('POST', `/applications/${packageName}/edits/${editId}:commit`);
  console.log('  ✓ committed');

  if (args.status === 'draft') {
    console.log(`\n✓ versionCode ${versionCode} staged as a DRAFT on "${args.track}" — it is NOT live.`);
    console.log('  Publish it from Play Console → Release → Review and roll out.');
  } else if (args.rollout) {
    console.log(`\n✓ versionCode ${versionCode} rolling out to ${Number(args.rollout) * 100}% of "${args.track}".`);
  } else {
    console.log(`\n✓ versionCode ${versionCode} released to the "${args.track}" track.`);
  }
  console.log('  https://play.google.com/console → Vector Vanguard → Testing/Production\n');
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  if (e.details) console.error(JSON.stringify(e.details, null, 2));
  process.exit(1);
});
