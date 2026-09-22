import {admin,authenticate,bodyJson,HttpError,jsonError,requireProject} from "@/lib/supabase";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
// Explicit owner-requested, read-only inventory of instances RSGP has tagged in Studio.
export async function POST(req:Request,{params}:Ctx){
 try{
  const {id}=await params,uid=await authenticate(req);
  await requireProject(uid,id);
  const body=await bodyJson(req),connectionId=body.connectionId;
  if(typeof connectionId!=="string"||!/^[0-9a-f-]{36}$/i.test(connectionId))throw new HttpError(400,"Select a Studio session");
  const db=admin();
  const {data:connections,error:connectionError}=await db.from("studio_connections")
   .select("id,last_seen_at").eq("id",connectionId).eq("project_id",id).eq("owner_id",uid).eq("active",true)
   .limit(1);
  if(connectionError)throw connectionError;
  const connection=connections?.[0];
  if(!connection||!connection.last_seen_at||Date.now()-Date.parse(connection.last_seen_at)>20000)
   throw new HttpError(409,"Connect an active Studio plugin before requesting inventory");
  const {data:recent,error:recentError}=await db.from("commands")
   .select("id").eq("project_id",id).eq("owner_id",uid).eq("kind","inspect_project")
   .gte("created_at",new Date(Date.now()-60000).toISOString()).limit(5);
  if(recentError)throw recentError;
  if((recent?.length||0)>=5)throw new HttpError(429,"Studio inventory limit reached; try again later");
  const {data:command,error}=await db.from("commands")
   .insert({project_id:id,owner_id:uid,connection_id:connection.id,kind:"inspect_project",
    payload:{scope:"rsgp_tagged"},status:"queued"})
   .select("id,status").single();
  if(error)throw error;
  return Response.json({command},{status:201});
 }catch(error){return jsonError(error);}
}
