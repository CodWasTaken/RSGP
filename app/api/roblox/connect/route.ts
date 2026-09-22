import {admin,authenticate,jsonError} from "@/lib/supabase";
import {createAuthorization,digest,seal} from "@/lib/roblox-oauth";
export const runtime="nodejs";
export async function POST(req:Request){
 try{
  const ownerId=await authenticate(req),{url,state,verifier}=createAuthorization();
  const {error}=await admin().from("roblox_oauth_states").insert({
   state_hash:digest(state),owner_id:ownerId,verifier_cipher:seal(verifier),
   expires_at:new Date(Date.now()+5*60000).toISOString(),
  });
  if(error)throw error;
  return Response.json({authorizeUrl:url});
 }catch(error){return jsonError(error);}
}
