import {admin} from "@/lib/supabase";
import {digest,oauthConfig,redeemCode,robloxIdentity,seal,unseal} from "@/lib/roblox-oauth";
export const runtime="nodejs";
function redirect(outcome:string){
 const {origin}=oauthConfig();
 return Response.redirect(new URL("/?roblox="+encodeURIComponent(outcome),origin),303);
}
export async function GET(req:Request){
 try{
  const params=new URL(req.url).searchParams;
  const code=params.get("code"),state=params.get("state");
  if(!code||!state||code.length>4096||state.length>256)return redirect("cancelled");
  const db=admin();
  const {data:claim,error}=await db.from("roblox_oauth_states")
   .update({consumed_at:new Date().toISOString()}).eq("state_hash",digest(state))
   .is("consumed_at",null).gt("expires_at",new Date().toISOString())
   .select("owner_id,verifier_cipher").maybeSingle();
  if(error||!claim)return redirect("expired");
  const tokens=await redeemCode(code,unseal(claim.verifier_cipher));
  const user=await robloxIdentity(tokens.access_token);
  const {error:storeError}=await db.from("roblox_connections").upsert({
   owner_id:claim.owner_id,roblox_user_id:user.id,roblox_username:user.name,
   access_cipher:seal(tokens.access_token),refresh_cipher:seal(tokens.refresh_token),
   access_expires_at:new Date(Date.now()+tokens.expires_in*1000).toISOString(),
   status:"connected",refresh_claimed_at:null,updated_at:new Date().toISOString(),
  },{onConflict:"owner_id"});
  if(storeError)throw storeError;
  return redirect("connected");
 }catch{return redirect("error");}
}
