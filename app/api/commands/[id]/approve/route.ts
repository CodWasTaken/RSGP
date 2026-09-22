import {admin,authenticate,bodyJson,HttpError,jsonError} from "@/lib/supabase";
import {isLiveStudioTarget} from "@/lib/studio-review";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{
  const {id}=await params,uid=await authenticate(req),body=await bodyJson(req),db=admin();
  const connectionId=body.connectionId;
  if(typeof connectionId!=="string"||!/^[0-9a-f-]{36}$/i.test(connectionId))
   throw new HttpError(400,"Select a connected Studio session to receive this command");
  const {data:command,error}=await db.from("commands").select("id,project_id,status")
   .eq("id",id).eq("owner_id",uid).maybeSingle();
  if(error)throw error;
  if(!command)throw new HttpError(404,"Command not found");
  if(command.status!=="pending_approval")throw new HttpError(409,"Command already reviewed");
  // No implicit fallback to the newest connection: multi-place projects must be explicit.
  const {data:conn,error:connError}=await db.from("studio_connections")
   .select("id,studio_id,project_id,owner_id,active,last_seen_at").eq("id",connectionId)
   .eq("project_id",command.project_id).eq("owner_id",uid).eq("active",true).maybeSingle();
  if(connError)throw connError;
  if(!conn||!isLiveStudioTarget(conn,command.project_id,uid))
   throw new HttpError(409,"Selected Studio session is offline; reconnect or choose a live session");
  const {data,error:updateError}=await db.from("commands")
   .update({status:"queued",connection_id:conn.id}).eq("id",id)
   .eq("owner_id",uid).eq("project_id",command.project_id).eq("status","pending_approval")
   .select("id,status,connection_id").maybeSingle();
  if(updateError)throw updateError;
  if(!data)throw new HttpError(409,"Command already reviewed");
  return Response.json({command:data});
 }catch(error){return jsonError(error);}
}
