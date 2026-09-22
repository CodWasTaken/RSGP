import {admin,jsonError} from "@/lib/supabase";
import {pluginAuth} from "@/lib/security";
export const runtime="nodejs";
export async function GET(req:Request){
 try{
 const conn=await pluginAuth(req),db=admin();
 await db.from("studio_connections").update({last_seen_at:new Date().toISOString()}).eq("id",conn.id);
 const {data:rows,error}=await db.from("commands").select("id,kind,payload").eq("project_id",conn.project_id).eq("connection_id",conn.id).eq("status","queued").order("created_at",{ascending:true}).limit(1);
 if(error)throw error;
 if(!rows?.[0])return Response.json({command:null});
 const {data,error:leaseError}=await db.from("commands").update({status:"leased",lease_expires_at:new Date(Date.now()+60000).toISOString()}).eq("id",rows[0].id).eq("status","queued").eq("connection_id",conn.id).select("id,kind,payload").maybeSingle();
 if(leaseError)throw leaseError;
 return Response.json({command:data||null});
 }catch(error){return jsonError(error);}
}
