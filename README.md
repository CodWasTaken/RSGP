# RSGP — Roblox Studio Game Printer

**RSGP is a cloud-first AI Roblox game-building workspace.** Create an account, connect Roblox Studio to a project, ask the AI for changes, review the proposal, then approve selected operations. The site is designed for **Vercel + Supabase**, with a lightweight Roblox Studio plugin. No local server, Fedora desktop client, or Rojo is required.

> **Early MVP source, not yet deployed or live-verified.** It proposes and installs basic parts, native GUI layouts (labels and visual-only button prototypes), and Luau scripts. It does not generate a complete production game, publish experiences, create 3D meshes or audio, or perform automated gameplay verification. The Asset Lab can generate private PNGs and optionally publish them as Roblox Images via per-user OAuth; a separate review step creates a visual-only Studio preview. Generated Script/LocalScript instances are disabled until you review and enable them.

## Set up

1. Use the **repurposed RobloxGPT Community Dev Supabase project** (`qznmxbwhotgwmcrskdtd`) as RSGP's database. It was restored to `ACTIVE_HEALTHY` and all five RSGP migrations were applied on September 22, 2026. The existing Auth user, two RGPT migrations, and legacy `community`/`private` tables were retained. Configure email/password sign-up, your site URL and SMTP/confirmation redirects as needed. Do not rerun already applied migrations.
2. Import this repository into **Vercel** as a Next.js app. Set the environment variables in [.env.example](.env.example): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and `NEXT_PUBLIC_RSGP_ORIGIN`. The last one should be your public HTTPS Vercel origin. Keep the service-role and OpenAI keys server-only.
3. Install [studio/RSGP.server.lua](studio/RSGP.server.lua) as a **local Roblox Studio plugin**, not as an in-game Script. Allow the plugin's HTTPS requests if Studio prompts for permission.
4. Sign in to the site, create a project, generate a one-time pairing code, and paste the HTTPS site origin and code into the Studio plugin. Keep Studio in **Edit mode** while applying operations.
5. Request a small game feature in the chat. Inspect the proposed operations, approve each intended change, then review the created instances and generated Luau in Studio. Enable scripts only after you review them.

[The lease-reconciliation migration](supabase/migrations/20260922_rsgp_lease_reconciliation.sql) is already applied in the designated RSGP project. An expired Studio command is not automatically retried: open the project queue, inspect the actual Studio place, and choose **I see it in Studio** or **Not applied**. That resolution records your report, not independently verified gameplay. Generated GUI buttons are not wired to actions. Review each proposal before approval; use **Reject** to discard unwanted work.

### Image Asset Lab

[The generated-assets migration](supabase/migrations/20260922_rsgp_generated_assets.sql) is already applied to the designated project. It creates a private `rsgp-generated` Storage bucket and a per-project asset ledger. RSGP's server uses `RSGP_IMAGE_MODEL` (default: `gpt-image-1-mini`) and the existing server-only `OPENAI_API_KEY` to create one low-quality PNG for each explicitly submitted image-generation request.

The project page can generate icons, thumbnails, textures, and GUI art, then preview and open saved images using five-minute signed URLs. The server reserves one of **three image generations per account per hour and ten per account per rolling 24 hours** in an atomic database transaction. Limits count attempts even when they fail, and are an interim safety ceiling—not a subscription plan, price quote, or guarantee of available OpenAI credits.

Each request has a unique ID and is atomically claimed before the provider call. Duplicates do not trigger another billable call. Timeouts, uncertain provider outcomes, and upload failures are recorded as `needs_reconciliation`; they are never automatically retried. RSGP does not yet have automatic provider-side reconciliation. A generated PNG is not a Roblox asset ID or evidence of Studio installation.

### Roblox Image publishing and Studio preview (optional OAuth)

[The Roblox publication migration](supabase/migrations/20260922_rsgp_roblox_publication.sql) is already applied to the designated project. To enable direct upload, register an OAuth app in Roblox Creator Dashboard with the callback `https://YOUR-RSGP-ORIGIN/api/roblox/callback` and scopes `openid profile asset:read asset:write`. Configure the server-only `ROBLOX_OAUTH_CLIENT_ID`, `ROBLOX_OAUTH_CLIENT_SECRET`, and stable `RSGP_TOKEN_ENCRYPTION_KEY` (32 random bytes, base64) in Vercel. Roblox Open Cloud OAuth and Assets API are beta; no live acceptance has been verified.

Each signed-in creator connects their **own** Roblox account. RSGP encrypts access and rotating refresh tokens at rest, never includes them in browser responses, and uploads one explicitly selected private PNG as Roblox `Image` with the creator's Roblox user ID. The site checks the returned operation ID and moderation before enabling the installation proposal. It **does not prove target-experience permission or image rendering**; inspect the resulting `ImageLabel` in Studio. A lost upload receipt is marked for manual reconciliation and is not resubmitted.

Without OAuth, download the PNG, upload it in Roblox Creator Dashboard as an **Image**, then paste its numeric asset ID into the asset's **Link manual ID** form. Such an ID is *user-reported, not independently verified*. In either case, click **Propose Studio preview**, then inspect and approve the `install_image` operation in the build queue. The Studio plugin creates a non-interactive `ScreenGui` preview in the paired place and reports only the assigned Image property. Generated icons, thumbnails and textures are displayed as previews—not automatically assigned to a published game icon, store thumbnail or material.

Disconnecting in RSGP deletes stored OAuth credentials; to revoke Roblox authorization as well, use Roblox's connected-app controls. Never share the application's client secret, encryption key or personal tokens.

### Exact Studio targeting and scoped undo

RSGP displays the live Studio place identity in each project and requires you to **select a target when multiple Studio sessions are connected**. Before sending an approved proposal, the server checks the selected session is active, recently seen, owned by the signed-in user, and paired with that project. It no longer routes an approval to the most recently seen session without your input. The same target selection applies to the read-only inventory.

[The fifth, additive migration](supabase/migrations/20260922_rsgp_command_undo.sql) is already applied in the repurposed database. For a command reported applied, the queue can propose an explicit `undo_command`. After you review and approve it for the intended live Studio place, the plugin looks for **exactly one** root bearing the original command ID and matching RSGP project ID, then destroys that root (including its descendants). Roblox Studio change-history waypoints bracket the operation. If a root is missing, untagged, duplicated, or of an unexpected class, undo fails closed without deleting anything. Existing manually edited descendants would also be deleted; back up valuable places first. This is per-operation deletion, **not** full project snapshots, transaction rollback, or undo for objects created by older untagged plugins. A lost undo result must be manually reconciled, not replayed.

### Read-only Studio inventory

The website can request an **Inspect RSGP objects in Studio** inventory from an active paired plugin. New RSGP-created instances are tagged with project and command IDs. The plugin returns bounded counts of tagged parts, scripts, disabled scripts, GUIs and image previews. This is a self-reported Edit-mode inventory—not a screenshot, gameplay test, or guarantee of accessible asset rendering. Instances created by older plugin versions without tags are not counted.

For local website development, copy `.env.example` to `.env.local`, fill the variables, then run `npm install && npm run dev`. Run `npm test`, `npm run typecheck`, and `npm run build` before deploying.

## Architecture and limitations

The Vercel server verifies the Supabase user and project ownership before writing state. The plugin receives a high-entropy token through a one-use pairing code; token and code hashes are stored in Supabase. All AI mutations require user approval. The server does not expose the service-role key to the browser or plugin.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the trust boundaries, milestones, and known gaps, including incomplete operation reconciliation and missing full snapshots/undo. Test on a disposable or backed-up Roblox place.

The existing Supabase project was restored and its database was extended for RSGP at the owner's request. This repository does not contain its service-role key or database password; set those server-side during Vercel deployment. A Supabase project rename, if wanted, is a dashboard setting and is not required for the API URL to work.

The original `CodWasTaken/RobloxGPT-Studio` is private. RSGP reuses its **architectural concepts**, not its unpublished code. The public ForgeGUI integration is a feature/workflow reference; RSGP's code is written independently and does not depend on ForgeGUI's hosted backend.
