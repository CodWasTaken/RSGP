// Display configuration completeness, not a live dependency health or authorization check.
// Never return environment variable values or secrets to the browser.
const filled = value => typeof value === "string" && value.trim().length > 0;
export function deploymentReadiness(env) {
  const accountReady = filled(env.NEXT_PUBLIC_SUPABASE_URL)
    && filled(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    && filled(env.SUPABASE_SERVICE_ROLE_KEY);
  const aiReady = accountReady && filled(env.OPENAI_API_KEY);
  const robloxUploadReady = accountReady && filled(env.ROBLOX_OAUTH_CLIENT_ID)
    && filled(env.ROBLOX_OAUTH_CLIENT_SECRET)
    && filled(env.RSGP_TOKEN_ENCRYPTION_KEY);
  return { accountReady, aiReady, robloxUploadReady };
}
