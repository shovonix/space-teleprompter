# Space Prompter (repo: space-teleprompter)

Self-hosted teleprompter for video shoots. Live at https://prompter.shovonix.dev (old address studio.shovonix.dev is being phased out). The first Space app; the others copy its style.

## What's in this repo
- `index.html` — the whole app. No build step. Scripts and settings live in `localStorage`.
- `relay/` — small Node relay for QR phone/tablet pairing (end-to-end encrypted). Setup in `relay/INSTALL.md`.
- `site/` — the shovonix.dev hub page and blog.
- `landing/` — landing pages (`space-prompter/`, `fx/`).
- `ops/sp-stats.sh` — GoAccess traffic stats from nginx logs (runs on the VPS as root).
- `migrate.html` — moves saved scripts from the old studio address.

Preview locally: `python3 -m http.server 8000`, then open http://localhost:8000

## Space key
- Tap = play/pause. Double tap = previous paragraph. Hold = back to top. `F` = full screen.
- Bluetooth pedals send keys too. Test pedal keys after touching keyboard handling.

## Space Cam is a fork
- `space-cam` copies this prompter (v3.5, Dual Monitor only). When you fix a bug in the prompter core, say whether it should be ported to space-cam.

## Design
- Black and white only. Tokens: `--bg #070707`, `--fg #F0F0EE`, `--hair #2A2A2C`. Red only for warnings.

## Rules
- After changing any cached file, bump `CACHE` in `sw.js` so installed copies update.
- Never break existing saved scripts in `localStorage`. Migrate old data instead of dropping it.
- No analytics or tracking scripts.
- Licence: all rights reserved. Don't add an open-source licence.
- Ask before adding a dependency or a build step.

## Workflow
- Work on the Mac in `~/Sites/space/space-teleprompter`, on the `next` branch. `main` = what's live.
- Preview locally: the `prompter` config in `.claude/launch.json` (port 8001; Space Cam uses 8000). The service worker only registers on https, so localhost never serves a stale cached copy.
- Commit small on `next`. Add each user-facing fix to **Unreleased** in `CHANGELOG.md`.
- Don't merge to `main`, push `main`, or deploy until Shovon says so.

## Releasing (only when Shovon says "release" / "send the update")
- When a set of fixes is complete, tell Shovon what's in Unreleased and ask when to send the update. Don't release on your own.
- To release: bump `APP_VERSION` (e.g. v3.5 → v3.6), set `APP_NOTES` to the one-line toast text (short, plain), bump `CACHE` in `sw.js`, move Unreleased under the new version in `CHANGELOG.md`.
- Merge `next` into `main` (fast-forward), push, then Shovon runs `deploy-space prompter` on the VPS.
- Open copies see the update toast within ~10 minutes (or on tab focus): "v3.6 is ready: <notes> Tap to reload." Copies on v3.5 or older show the plain toast without the note.

## Naming
- The product is **Space Prompter**. "teleprompter" as a plain word for the kind of app is fine.
- Keep internal ids as they are (`mgdTeleprompterSync`, `mgdTeleprompterStageV2`, `--mgd-stage-width`, localStorage keys): renaming them breaks pairing between open windows on different versions, or saved data.
- The repo/folder name `space-teleprompter` stays unless Shovon decides to rename it (the VPS git paths, deploy-space and relay/INSTALL.md depend on it).
- Live files on the VPS (CloudPanel, one site user each):
  - App: `/home/prompter/htdocs/prompter.shovonix.dev` (user `prompter`)
  - Old address: `/home/studio/htdocs/studio.shovonix.dev` (user `studio`)
  - Hub + blog + landing pages (`site/`, `landing/`): `/home/shovonix/htdocs/shovonix.dev` (user `shovonix`)
  - Stats: `/home/stats/htdocs/stats.shovonix.dev` (user `stats`)
  - Relay: not under any htdocs folder. Location not recorded yet; find it before touching it, then add it here.
- Deploy the app: push to `main`, then on the VPS run `deploy-space prompter` as root. It pulls `main` as user `prompter` (fast-forward only) and checks the site returns 200.
- Git data lives outside the web root at `/home/prompter/space-teleprompter.git`. `landing/`, `site/`, `relay/`, `ops/`, `README.md` and `CLAUDE.md` are excluded from the live folder via sparse-checkout.
- Hub: `deploy-space hub` pulls source copies in `/home/shovonix/src/` and copies `site/` → hub root, `landing/fx/` → `/fx/`, `landing/space-prompter/` → `/space-prompter/`, plus each app's `landing/space-<app>/`. It never deletes files on the hub (the `stats-…` folder lives there).
- studio (old address) and the relay are NOT on `deploy-space`. Ask Shovon before touching them.
- Never edit the live files on the VPS directly.
