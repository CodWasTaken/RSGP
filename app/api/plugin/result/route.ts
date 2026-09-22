import {admin,bodyJson,HttpError,jsonError} from "@/lib/supabase";
import {pluginAuth} from "@/lib/security";
export const runtime="nodejs";
export async function POST(req:Request){
 try{
 const conn=await pluginAuth(req),body=await bodyJson(req);
 if(typeof body.commandId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.commandId)||typeof body.success!=="boolean"||(body.detail!==undefined&&(typeof body.detail!=="string"||body.detail.length>800)))throw new HttpError(400,"Invalid result");
 const {data,error}=await admin().from("commands").update({status:body.success?"completed":"failed",result:{detail:body.detail||""},lease_expires_at:null}).eq("id",body.commandId).eq("project_id",conn.project_id).eq("connection_id",conn.id).eq("status","leased").select("id,status").maybeSingle();
 if(error)throw error;
 if(!data)throw new HttpError(409,"Command lease not found");
 return Response.json({command:data});
 }catch(error){return jsonError(error);}
}
