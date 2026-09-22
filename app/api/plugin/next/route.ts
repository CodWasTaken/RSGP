import {randomUUID} from "node:crypto";
import {admin,jsonError} from "@/lib/supabase";
import {pluginAuth} from "@/lib/security";
import {LEASE_MS} from "@/lib/lease";
export const runtime="nodejs";
export async function GET(req:Request){
 try{
  const conn=await pluginAuth(req),db=admin(),now=new Date().toISOString();
  const {error:heartbeatError}=await db.from("studio_connections").update({last_seen_at:now}).eq("id",conn.id).eq("active",true);
  if(heartbeatError)throw heartbeatError;
  // A lost result is ambiguous: move it to human reconciliation; NEVER requeue it.
  const {error:expiredError}=await db.from("commands").update({status:"needs_reconciliation",result:{detail:"Lease expired. Inspect Studio before resolving; do not repeat automatically."}})
   .eq("project_id",conn.project_id).eq("connection_id",conn.id).eq("status","leased").lt("lease_expires_at",now);
  if(expiredError)throw expiredError;
  const {data:rows,error}=await db.from("commands").select("id,kind,payload").eq("project_id",conn.project_id)
   .eq("connection_id",conn.id).eq("status","queued").order("created_at",{ascending:true}).limit(1);
  if(error)throw error;
  if(!rows?.[0])return Response.json({command:null});
  const leaseId=randomUUID();
  const {data,error:leaseError}=await db.from("commands")
   .update({status:"leased",lease_id:leaseId,lease_expires_at:new Date(Date.now()+LEASE_MS).toISOString()})
   .eq("id",rows[0].id).eq("project_id",conn.project_id).eq("status","queued").eq("connection_id",conn.id)
   .select("id,kind,payload,lease_id").maybeSingle();
  if(leaseError)throw leaseError;
  return Response.json({command:data?{...data,leaseId:data.lease_id,lease_id:undefined}:null});
 }catch(error){return jsonError(error);}
}
