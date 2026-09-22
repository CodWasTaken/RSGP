import {admin,authenticate,bodyJson,HttpError,jsonError,requireProject} from "@/lib/supabase";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{const {id}=await params,uid=await authenticate(req),body=await bodyJson(req);await requireProject(uid,id);
 if(typeof body.connectionId!=="string")throw new HttpError(400,"Missing connection ID");
 const db=admin();
 const {data,error}=await db.from("studio_connections").update({active:false}).eq("id",body.connectionId).eq("project_id",id).eq("owner_id",uid).eq("active",true).select("id").maybeSingle();
 if(error)throw error;
 if(!data)throw new HttpError(404,"Connection not found");
 const {error:queuedError}=await db.from("commands").update({status:"failed",result:{detail:"Connection revoked"}}).eq("connection_id",data.id).eq("project_id",id).in("status",["queued","leased"]);
 if(queuedError)throw queuedError;
 return Response.json({revoked:true});
 }catch(error){return jsonError(error);}
}
