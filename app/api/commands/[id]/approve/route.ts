import {admin,authenticate,HttpError,jsonError} from "@/lib/supabase";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{const {id}=await params,uid=await authenticate(req),db=admin();
 const {data:command,error}=await db.from("commands").select("id,project_id,status").eq("id",id).eq("owner_id",uid).maybeSingle();
 if(error)throw error;
 if(!command)throw new HttpError(404,"Command not found");
 if(command.status!=="pending_approval")throw new HttpError(409,"Command already reviewed");
 const {data:connections,error:connError}=await db.from("studio_connections").select("id").eq("project_id",command.project_id).eq("owner_id",uid).eq("active",true).order("last_seen_at",{ascending:false}).limit(1);
 if(connError)throw connError;
 if(!connections?.[0])throw new HttpError(409,"Connect Studio before approving");
 const {data,error:updateError}=await db.from("commands").update({status:"queued",connection_id:connections[0].id}).eq("id",id).eq("owner_id",uid).eq("status","pending_approval").select("id,status").maybeSingle();
 if(updateError)throw updateError;
 if(!data)throw new HttpError(409,"Command already reviewed");
 return Response.json({command:data});
 }catch(error){return jsonError(error);}
}
