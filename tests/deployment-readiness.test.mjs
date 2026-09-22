import test from "node:test";
import assert from "node:assert/strict";
import {deploymentReadiness} from "../lib/deployment-readiness.mjs";

test("missing private credentials do not report ready",()=>{
 assert.deepEqual(deploymentReadiness({
  NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-key",
  RSGP_TOKEN_ENCRYPTION_KEY:"local-key",
 }),{accountReady:false,aiReady:false,robloxUploadReady:false});
});
test("only available capabilities report ready, not secret contents",()=>{
 const base={NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-key",SUPABASE_SERVICE_ROLE_KEY:"server-value"};
 assert.deepEqual(deploymentReadiness(base),{accountReady:true,aiReady:false,robloxUploadReady:false});
 assert.deepEqual(deploymentReadiness({...base,OPENAI_API_KEY:"provider-token"}),
  {accountReady:true,aiReady:true,robloxUploadReady:false});
 assert.deepEqual(deploymentReadiness({...base,ROBLOX_OAUTH_CLIENT_ID:"cid",
  ROBLOX_OAUTH_CLIENT_SECRET:"secret",RSGP_TOKEN_ENCRYPTION_KEY:"cipher-key"}),
  {accountReady:true,aiReady:false,robloxUploadReady:true});
});
test("blank or whitespace credentials do not count",()=>{
 const flags=deploymentReadiness({NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-key",SUPABASE_SERVICE_ROLE_KEY:"  ",
  OPENAI_API_KEY:"provider-token"});
 assert.equal(flags.accountReady,false);
 assert.equal(flags.aiReady,false);
});
