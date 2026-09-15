# Play Store deployment

Uploads builds and store metadata to Google Play via the Android Publisher
API v3. Zero dependencies, Node 18+.

Audited against the live discovery document on **2026-09-15**
(`androidpublisher` v3, revision `20260915`). The split below is derived from
that document, not from memory — re-run the audit with:

```bash
curl -s "https://androidpublisher.googleapis.com/\$discovery/rest?version=v3" | jq '.resources | keys'
```

## Files

| File | Committed? | Purpose |
|---|---|---|
| `play-deploy.mjs` | yes | Deploy + metadata script |
| `service-account.json` | **no — gitignored** | Play Developer API key |

Never commit the service account, any `.env`, or the keystore. `.gitignore`
covers `deploy/*.json`; verify with `git check-ignore -v deploy/service-account.json`.

## Commands

```bash
npm run play:check                 # auth + track state
node deploy/play-deploy.mjs --verify   # read EVERY API-visible field back

npm run android:build && npm run play:internal   # build + ship to internal

# Metadata only, no binary
node deploy/play-deploy.mjs --track internal --version-code 1 \
  --listing --details --images --dry-run
```

### Flags

| Flag | Default | Notes |
|---|---|---|
| `--track` | `internal` | `internal` \| `alpha` \| `beta` \| `production` |
| `--aab` | `android/app/.../app-release.aab` | |
| `--creds` | `deploy/service-account.json` | |
| `--package` | from `capacitor.config.json` | |
| `--status` | `completed` | `draft` \| `completed` \| `inProgress` |
| `--rollout` | — | `0`–`1`, requires `--status inProgress` |
| `--notes` | — | en-US release notes |
| `--listing` | — | push title/short/full from `docs/playstore/store-listing.md` |
| `--details` | — | push contact email/website/phone |
| `--images` | — | push icon, feature graphic, all screenshot sets |
| `--force-images` | — | allow `--images` to shrink a set (see below) |
| `--data-safety <csv>` | — | upload a Data Safety CSV **exported from Console** |
| `--ai-generated` | — | `none` \| `attested` — image provenance |
| `--version-code <n>` | — | promote an uploaded build; skips the upload |
| `--edit <id>` | — | reuse an open edit |
| `--countries <list>` | — | staged rollouts only (see below) |
| `--check` | — | auth + tracks |
| `--verify` | — | full read-back of details, listings, graphics, countries |
| `--dry-run` | — | runs `edits:validate`, then discards the edit |

## Fully automated

| Area | API | Flag |
|---|---|---|
| Bundle upload | `edits.bundles.upload` | default |
| Track assignment / promotion | `edits.tracks.update` | `--track`, `--version-code` |
| Staged rollout | `TrackRelease.userFraction` | `--rollout` |
| Release notes | `TrackRelease.releaseNotes` | `--notes` |
| Store listing text | `edits.listings.update` | `--listing` |
| Contact details | `edits.details.update` | `--details` |
| Icon / feature graphic / screenshots | `edits.images.upload` | `--images` |
| Data Safety labels | `applications.dataSafety` | `--data-safety` |
| Server-side validation | `edits.validate` | `--dry-run` |
| State read-back | various `GET` | `--verify` |

## Console-only — no API exists

Confirmed absent from the v3 discovery document (zero matches for
`advertis`, `health`, `app access`, `target audience`, `contentRating`):

- **Country / region selection** — `edits.countryavailability` is **GET only**.
  Release-level `countryTargeting` exists but Play rejects it outside a staged
  rollout: `400: Country targeting is only supported for staged releases.`
- **Content rating questionnaire** (IARC)
- **Target audience & content**
- **Advertising ID declaration**
- **App access** (login credentials for reviewers)
- **Health declaration**
- **Financial features declaration**
- **Privacy policy URL** — `privacyPolicyUrl` appears only on `CatalogAppView`,
  a read-only catalog export schema. Not settable.
- **News / COVID-19 / government app declarations**

## The first-production gate still applies

Until the app has ever been published, Play treats it as a *draft app* and
refuses any non-draft production release:

```
400 INVALID_ARGUMENT: Only releases with status draft may be created on draft app.
```

Stage with `--status draft`, then use **Review and roll out** in Console once.
After that first publish, `--track production` works from the API.

## Safety behaviours

**versionCode is never reused.** Before uploading, the script reads
`versionCode` from `android/app/build.gradle`, lists what Play already holds,
and aborts *before* the upload if it collides — rather than failing at commit.
Bump the gradle value, or promote the existing build with `--version-code`.

**`--images` refuses to shrink a set.** Console uploads are invisible to the
repo. If Play holds more images of a type than exist locally, the script stops:

```
✗ phoneScreenshots: Play has 4 image(s) but only 3 exist locally.
```

Override only when you mean it, with `--force-images`.

**Data Safety CSV is never synthesised.** `applications.dataSafety` accepts the
same CSV Console imports/exports. That is a legal declaration, so the script
only uploads a file you supply — export it from Console → App content →
Data safety, commit it, then pass `--data-safety <path>`. A guessed column
layout could silently file wrong answers.

**Writes are read back.** `--verify` re-reads details, listings, per-type image
counts and country availability. A field Play ignores shows up as absent rather
than as success.

**Image provenance.** `edits.images.upload` takes an `aiGeneratedState`
parameter. It is omitted unless you pass `--ai-generated none|attested`. Decide
this yourself — it is an attestation about how the artwork was produced.

## Gotchas

**Play serialises edits.** Creating a new edit invalidates any other open edit
(`400 FAILED_PRECONDITION: This Edit has been deleted`). Don't run `--check`
between an upload and its commit.

**Boolean flags must be registered.** `BOOLEAN_FLAGS` in the script lists every
valueless flag. A boolean missing from that set swallows the following
argument — this previously caused `--listing --countries world` to parse as
`listing="--countries"` with `countries` unset.

**Uploads can be slow.** Bundle upload streams via `node:https` with no
timeout; plain `fetch()` dies at undici's 300s body timeout with a bare
`fetch failed`.
