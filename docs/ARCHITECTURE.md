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

1. Provision a **new** RSGP Supabase project and Vercel deployment, install/test the Studio plugin and verify signup, pairing and project ownership.
2. Add versioned project snapshots, reversible edits, explicit lease reconciliation and richer native Roblox GUI generation.
3. Add a provider-neutral asset pipeline for images, textures, Roblox-native meshes, optional external 3D/audio providers, publication, moderation, and Studio verification.
4. Add game templates, interactive playtest evidence, screenshot review, iterative fixes and release gates. Add paid tiers and quotas only after the end-to-end build workflow is reliable.

## Existing work and references

RSGP follows the *architectural ideas* of the privately owned `CodWasTaken/RobloxGPT-Studio` (project context, guarded mutations, evidence-backed validation), but it does **not copy that private repository** into this public one. The ForgeGUI public Claude Code integration is treated as a documented capability/workflow reference, not vendored or used to bypass its hosted backend. RSGP's plugin is independently implemented and does not use Lemonade's proprietary code. Roblox Studio's official MCP remains a possible future optional tool backend, not an installed dependency.

## Studio queue recovery and GUI scope (September 2026 increment)

Apply `20260922_rsgp_lease_reconciliation.sql` after the initial schema. Each queued command gets a unique random lease ID at dispatch, and the plugin echoes that lease ID when reporting an outcome. A receipt requires an active matching, unexpired lease; the server refuses stale or mismatched receipts. Expired leases move to `needs_reconciliation`, and neither the API nor the Studio plugin retries them automatically. The owner must inspect the place and report **applied** or **not applied**; this is a human report, not automatic verification. The plugin pauses after an uncertain result submission.

The review queue supports explicit rejection before an operation is delivered. Generated GUI proposals may now contain up to eight native text labels or visual-only buttons. The plugin uses Roblox `ScreenGui`, `Frame`, `TextLabel`, `TextButton`, `UIListLayout`, and `UISizeConstraint`; it does not auto-execute a button handler. A request for functional UI still needs reviewed script wiring and actual gameplay validation.

**Known remaining limitations:** one-minute leases are not refreshed during long operations; result delivery may require manual resolution even when an instance was successfully created. There is no transactionally atomic multi-command game build, full project backup, automated rollback, or independent verification that user-reported reconciliation is correct. The current command validation enforces shape, not full semantic safety of generated Luau. Studio behavior has not been live-tested.

