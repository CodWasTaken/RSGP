# RSGP — Roblox Studio Game Printer

**Status:** cloud-first implementation slice. Not deployed or live-tested. Not yet a complete autonomous game printer.

## Product

An account-centric Roblox building workspace: sign in, create a project, describe a game in AI chat, review proposed actions, connect Roblox Studio via a small plugin, and apply approved changes. The site is intended for Vercel and a separate Supabase project. There is **no Rojo, local command-line server or desktop gateway** in the RSGP flow. A running local Roblox Studio is necessary for editing and playtesting.

```
Browser (Supabase Auth) -- JWT --> Vercel Next.js API
        |                            |             |
        |                        AI provider   Supabase (server-only service role)
        |                                          ^
        +-- proposal / review / project state -----+
                                                   ^
Roblox Studio plugin -- HTTPS claim/poll/report ----+
```

## Implemented now

- Supabase email/password registration and authentication, per-account projects, stored chat and operation records.
- AI planner with strict output shape for at most 12 actions: `create_part`, `create_gui`, and `create_script`; each proposal requires explicit user approval.
- Pairing with a 96-bit single-use code expiring after 10 minutes; plugin gets a 256-bit bearer token, stored only as a hash in Supabase.
- Studio plugin polls for approved commands in Edit mode and reports applied instance paths or errors. Script and LocalScript instances are disabled by default; ModuleScripts remain inert until required.
- Workspace connection status and a revoke action. Basic per-project AI request throttle (three per minute).

## Trust model

- The **browser** gets only the Supabase public key and authenticated user session. It never gets the service-role or AI API key.
- **Vercel** verifies the signed-in user and project ownership. It parses untrusted LLM JSON and places only normalized actions into a pending review queue.
- **Supabase** enables RLS on all tables. Browser-side direct writes are not permitted. Pairing tokens and codes are not directly readable by normal authenticated users.
- The **Studio plugin** stores its session token in memory, does not use `loadstring`, validates the command type and arguments again, and applies only an explicitly approved action. A lost plugin response can leave the command leased: never blindly retry it.
- Generated Luau is **not semantically sandboxed or guaranteed safe**; inspect before enabling and use a backup/test place until stronger versioned snapshots, rollback and validation are implemented.

## Next milestones

1. Use the **repurposed** RSGP Supabase project and Vercel deployment, install/test the Studio plugin and verify signup, pairing and project ownership.
2. Add versioned project snapshots, reversible edits, explicit lease reconciliation and richer native Roblox GUI generation.
3. Add a provider-neutral asset pipeline for images, textures, Roblox-native meshes, optional external 3D/audio providers, publication, moderation, and Studio verification.
4. Add game templates, interactive playtest evidence, screenshot review, iterative fixes and release gates. Add paid tiers and quotas only after the end-to-end build workflow is reliable.

## Existing work and references

RSGP follows the *architectural ideas* of the privately owned `CodWasTaken/RobloxGPT-Studio` (project context, guarded mutations, evidence-backed validation), but it does **not copy that private repository** into this public one. The ForgeGUI public Claude Code integration is treated as a documented capability/workflow reference, not vendored or used to bypass its hosted backend. RSGP's plugin is independently implemented and does not use Lemonade's proprietary code. Roblox Studio's official MCP remains a possible future optional tool backend, not an installed dependency.

## Studio queue recovery and GUI scope (September 2026 increment)

Apply `20260922_rsgp_lease_reconciliation.sql` after the initial schema. Each queued command gets a unique random lease ID at dispatch, and the plugin echoes that lease ID when reporting an outcome. A receipt requires an active matching, unexpired lease; the server refuses stale or mismatched receipts. Expired leases move to `needs_reconciliation`, and neither the API nor the Studio plugin retries them automatically. The owner must inspect the place and report **applied** or **not applied**; this is a human report, not automatic verification. The plugin pauses after an uncertain result submission.

The review queue supports explicit rejection before an operation is delivered. Generated GUI proposals may now contain up to eight native text labels or visual-only buttons. The plugin uses Roblox `ScreenGui`, `Frame`, `TextLabel`, `TextButton`, `UIListLayout`, and `UISizeConstraint`; it does not auto-execute a button handler. A request for functional UI still needs reviewed script wiring and actual gameplay validation.

**Known remaining limitations:** one-minute leases are not refreshed during long operations; result delivery may require manual resolution even when an instance was successfully created. There is no transactionally atomic multi-command game build, full project backup, automated rollback, or independent verification that user-reported reconciliation is correct. The current command validation enforces shape, not full semantic safety of generated Luau. Studio behavior has not been live-tested.


## Cloud Asset Lab: first image provider (September 2026 increment)

A dedicated Supabase migration (`20260922_rsgp_generated_assets.sql`) creates a private `rsgp-generated` bucket, private `generated_assets` ledger, and a **service-role-only** transaction function `rsgp_reserve_image_generation`. An advisory transaction lock prevents concurrent requests from bypassing per-account limits: three operations per rolling hour and ten per rolling day. The request UUID is a durable idempotency key, unique across the ledger. It is atomically claimed from `reserved` to `generating`; no second invocation can claim the same request.

The website presents explicit one-image generation (icons, thumbnails, textures, GUI art). The Vercel server calls the configured OpenAI image API (default `gpt-image-1-mini`), verifies a bounded PNG, computes a SHA-256 hash, and uploads bytes to the private bucket. The project's authenticated image API returns only ownership-checked, five-minute signed URLs—never the storage service key or provider API key. Signed URLs are temporary bearer links; treat them as sensitive.

The lifecycle records `reserved -> generating -> ready`, or `failed` for an explicit provider rejection. Timeouts, unknown provider outcomes, malformed responses, storage failures, and stale generating records become `needs_reconciliation` without automatic paid retry. A successful generation is **not** publication, moderation, Roblox asset ownership, installation, playtesting or completion. Generated thumbnails and texture tiling remain AI output goals, not validated properties.

Limitations: provider charges and actual entitlements are not measured yet; the counter is a protective cap rather than billing. Vercel function limits and model latency may still cause uncertain results. No provider-side idempotent recovery or automatic reconciliation is claimed. No Roblox upload or Studio installation has been implemented for these images. The migrations were applied after restoration; no RSGP browser or Studio integration has been live-tested.


## Creator-owned Roblox Image publication (September 2026 increment)

The fourth SQL migration, `20260922_rsgp_roblox_publication.sql`, adds per-account encrypted Roblox OAuth connections, single-use PKCE state records, publication status fields on generated assets, and an `install_image` command linked to a source asset.

**OAuth boundaries:** Roblox authorizes each user's own account with `openid profile asset:read asset:write`. RSGP registers the exact HTTPS callback, stores AES-256-GCM encrypted access/refresh tokens using a server-only, stable 32-byte key, and receives Roblox identity through the authenticated userinfo endpoint. The server does not expose tokens in browser responses. Roblox refresh tokens rotate once: RSGP conditionally claims one refresh and requires reconnect if the outcome is uncertain. A user can disconnect stored credentials in RSGP; separately revoke the OAuth grant in Roblox. OAuth application registration/review and third-party asset permissions remain Roblox beta capabilities, not assumed enabled in every creator account.

**Publication steps:** An authenticated project owner selects a previously saved private PNG. The server checks OAuth access and claims `not_published -> uploading` exactly once. It downloads the original PNG from private Supabase Storage, verifies SHA-256 and byte count, submits it as type `Image` under that creator's Roblox user ID using Open Cloud Assets, and persists the returned `operations/...` ID and owner identity. An unknown upload outcome moves to `needs_reconciliation`, not an automatic replay. The owner checks the operation and subsequent asset metadata for moderation. `approved` means a Roblox moderation state, **not** ownership/experience-access or rendered Studio verification. Roblox creator group publishing, experience access checks, and publication recovery without an operation ID are not yet implemented.

**Manual fallback:** The creator may download the private PNG, upload it through Roblox Creator Dashboard, and attach their numeric Roblox **Image** ID. RSGP labels this `manual_unverified`, never implying it independently checked uploader ownership, moderation, or target-experience access.

**Studio integration:** The website creates an owner-reviewable `install_image` proposal from an `approved` or `manual_unverified` asset record. A bound Studio plugin creates a native `ScreenGui/ImageLabel` and assigns `rbxassetid://<id>`. The returned path is evidence only that the property was assigned; it is not visual proof that the asset is loaded, approved or usable in the intended place. Gameplay screenshots, failure detection and release verification remain future work. The plugin checks its original place identity before executing commands.

**Deployment:** Requires four SQL migrations in order, configured Supabase/Vercel credentials, registered Roblox OAuth app and approved scopes, and a stable token encryption key. No Roblox OAuth credentials, published assets or live Studio runtime have been tested from this repository.


## Database repurposing decision (2026-09-22)

The owner approved reusing Supabase project `qznmxbwhotgwmcrskdtd` (formerly RobloxGPT Community Dev) for RSGP. The **completed post-restore inventory** showed no existing public application tables, but one existing Auth user, two historical RGPT migrations, and eight RGPT tables in the `community` and `private` schemas. The initial checks during `COMING_UP` were incomplete. Do not drop existing schemas or reuse old RGPT service keys in the browser. All five RSGP SQL migrations were applied successfully after the project became `ACTIVE_HEALTHY`. The eight new RSGP public tables have RLS enabled, and `rsgp-generated` is a private Storage bucket. RGPT's user, history and legacy schemas were preserved. Configure the site's server-only Vercel secrets and review Supabase security advisors. Project display name may still show RobloxGPT until renamed in Supabase Dashboard.

## Read-only Studio inventory

A paired Studio plugin tags **newly created** RSGP parts, scripts, and GUI roots with the project and command ID. The owner can request an explicit `inspect_project` read-only command from the site. The plugin scans tagged instances in the paired place and reports bounded counts and sample paths. This is plugin-reported Edit-mode evidence, not an independent gameplay test, screenshot, moderation verdict, or assurance that older untagged objects are included.

**Supabase review:** The security advisor reported an Auth leaked-password-protection setting currently disabled, which must be enabled in the Auth dashboard if supported by the project plan. The no-policy advisories on server-only credentials and private RGPT tables are intentional deny-by-default protections, not missing public grants. Performance advisories identified optional foreign-key indexes; add those separately without dropping RGPT indexes.

## Explicit Studio session routing and per-command undo (2026-09-22)

All mutations requiring approval now specify the exact live `studio_connections.id` selected in the project UI. The API checks that the connection is active, has checked in recently, belongs to the same authenticated owner, and is scoped to the same project. When multiple live places are present, the website requires an explicit choice; it never substitutes the newest session. Read-only inventory requests use the same check.

The additive `20260922_rsgp_command_undo.sql` migration expands the command allowlist and tracks the original source command ID. A unique partial index prevents simultaneous unresolved undo proposals for one source. Only a reported-completed `create_part`, `create_script`, `create_gui`, or `install_image` is eligible. The plugin checks its original paired place and Edit mode, searches newly RSGP-tagged roots for exactly one object with both the source command ID and project ID, confirms an expected Roblox instance class, and then destroys that root and all descendants inside Studio change-history waypoints. It fails closed for zero or multiple matches. Older untagged objects are ineligible.

**Limitations:** a command marked completed following human reconciliation is only owner-reported, not independently verified. Removing a generated root also removes any later manually edited descendants. Undo is not a complete snapshot/rollback engine. If an undo result is lost, the job enters manual reconciliation and is not retried automatically. Real Studio end-to-end acceptance testing remains required.
