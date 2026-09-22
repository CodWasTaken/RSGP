# RSGP — Roblox Studio Game Printer

**RSGP is a cloud-first AI Roblox game-building workspace.** Create an account, connect Roblox Studio to a project, ask the AI for changes, review the proposal, then approve selected operations. The site is designed for **Vercel + Supabase**, with a lightweight Roblox Studio plugin. No local server, Fedora desktop client, or Rojo is required.

> **Early MVP source, not yet deployed or live-verified.** It proposes and installs basic parts, native GUI layouts (labels and visual-only button prototypes), and Luau scripts. It does not generate a complete production game, publish experiences, create 3D meshes or audio, or perform automated gameplay verification. The Asset Lab can generate private PNGs through a configured server-side image API, but cannot yet upload them to Roblox. Generated Script/LocalScript instances are disabled until you review and enable them.

## Set up

1. Create a **new RSGP Supabase project**, not the existing RobloxGPT Community Dev database. Apply [supabase/migrations/20260922_rsgp_initial.sql](supabase/migrations/20260922_rsgp_initial.sql), then enable email/password sign-up, set your site URL and configure SMTP/confirmation redirects as needed.
2. Import this repository into **Vercel** as a Next.js app. Set the environment variables in [.env.example](.env.example): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and `NEXT_PUBLIC_RSGP_ORIGIN`. The last one should be your public HTTPS Vercel origin. Keep the service-role and OpenAI keys server-only.
3. Install [studio/RSGP.server.lua](studio/RSGP.server.lua) as a **local Roblox Studio plugin**, not as an in-game Script. Allow the plugin's HTTPS requests if Studio prompts for permission.
4. Sign in to the site, create a project, generate a one-time pairing code, and paste the HTTPS site origin and code into the Studio plugin. Keep Studio in **Edit mode** while applying operations.
5. Request a small game feature in the chat. Inspect the proposed operations, approve each intended change, then review the created instances and generated Luau in Studio. Enable scripts only after you review them.

After applying the initial Supabase migration, also apply [the lease-reconciliation migration](supabase/migrations/20260922_rsgp_lease_reconciliation.sql). An expired Studio command is not automatically retried: open the project queue, inspect the actual Studio place, and choose **I see it in Studio** or **Not applied**. That resolution records your report, not independently verified gameplay. Generated GUI buttons are not wired to actions. Review each proposal before approval; use **Reject** to discard unwanted work.

### Image Asset Lab

Apply [the generated-assets migration](supabase/migrations/20260922_rsgp_generated_assets.sql) **after the initial and lease-reconciliation migrations**. It creates a private `rsgp-generated` Storage bucket and a per-project asset ledger. RSGP's server uses `RSGP_IMAGE_MODEL` (default: `gpt-image-1-mini`) and the existing server-only `OPENAI_API_KEY` to create one low-quality PNG for each explicitly submitted image-generation request.

The project page can generate icons, thumbnails, textures, and GUI art, then preview and open saved images using five-minute signed URLs. The server reserves one of **three image generations per account per hour and ten per account per rolling 24 hours** in an atomic database transaction. Limits count attempts even when they fail, and are an interim safety ceiling—not a subscription plan, price quote, or guarantee of available OpenAI credits.

Each request has a unique ID and is atomically claimed before the provider call. Duplicates do not trigger another billable call. Timeouts, uncertain provider outcomes, and upload failures are recorded as `needs_reconciliation`; they are never automatically retried. RSGP does not yet have automatic provider-side reconciliation or Roblox image publishing. A generated PNG is not a Roblox asset ID or evidence of Studio installation.

For local website development, copy `.env.example` to `.env.local`, fill the variables, then run `npm install && npm run dev`. Run `npm test`, `npm run typecheck`, and `npm run build` before deploying.

## Architecture and limitations

The Vercel server verifies the Supabase user and project ownership before writing state. The plugin receives a high-entropy token through a one-use pairing code; token and code hashes are stored in Supabase. All AI mutations require user approval. The server does not expose the service-role key to the browser or plugin.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the trust boundaries, milestones, and known gaps, including incomplete operation reconciliation and missing full snapshots/undo. Test on a disposable or backed-up Roblox place.

The original `CodWasTaken/RobloxGPT-Studio` is private. RSGP reuses its **architectural concepts**, not its unpublished code. The public ForgeGUI integration is a feature/workflow reference; RSGP's code is written independently and does not depend on ForgeGUI's hosted backend.
