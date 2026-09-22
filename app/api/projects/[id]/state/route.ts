import {admin,authenticate,jsonError,requireProject} from "@/lib/supabase";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Ctx){
 try{const {id}=await params,uid=await authenticate(req),project=await requireProject(uid,id),db=admin();
 const [messages,commands,connections]=await Promise.all([
 db.from("messages").select("id,role,content,created_at").eq("project_id",id).order("created_at",{ascending:true}).limit(100),
 db.from("commands").select("id,kind,payload,status,result,created_at").eq("project_id",id).order("created_at",{ascending:false}).limit(100),
 db.from("studio_connections").select("id,label,studio_id,active,last_seen_at,created_at").eq("project_id",id).order("created_at",{ascending:false}).limit(20)
 ]);
 if(messages.error||commands.error||connections.error)throw messages.error||commands.error||connections.error;
 return Response.json({project,messages:messages.data,commands:commands.data,connections:connections.data});
 }catch(error){return jsonError(error);}
}
