import {admin,authenticate,jsonError} from "@/lib/supabase";
export const runtime="nodejs";
export async function GET(req:Request){
 try{
  const ownerId=await authenticate(req);
  const {data,error}=await admin().from("roblox_connections")
   .select("roblox_user_id,roblox_username,status").eq("owner_id",ownerId).maybeSingle();
  if(error)throw error;
  return Response.json({connected:data?.status==="connected",status:data?.status??"not_connected",
   userId:data?.roblox_user_id??null,username:data?.roblox_username??null});
 }catch(error){return jsonError(error);}
}
export async function DELETE(req:Request){
 try{
  const ownerId=await authenticate(req);
  const {error}=await admin().from("roblox_connections").delete().eq("owner_id",ownerId);
  if(error)throw error;
  // Deleting RSGP credentials does not revoke Roblox's separate OAuth authorization.
  return Response.json({disconnected:true});
 }catch(error){return jsonError(error);}
}
