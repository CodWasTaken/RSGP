import {admin,authenticate,bodyJson,HttpError,jsonError} from "@/lib/supabase";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{
  const {id}=await params,uid=await authenticate(req),body=await bodyJson(req);
  if(body.outcome!=="applied"&&body.outcome!=="not_applied")throw new HttpError(400,"Select applied or not_applied after inspecting Studio");
  const {data,error}=await admin().from("commands")
   .update({
    status:body.outcome==="applied"?"completed":"failed",
    result:{detail:body.outcome==="applied"?"Owner reported an applied change after inspecting Studio (not independently verified).":"Owner reported the change was not applied after inspecting Studio.",source:"user-reconciliation"},
    lease_expires_at:null,lease_id:null,
   })
   .eq("id",id).eq("owner_id",uid).eq("status","needs_reconciliation")
   .select("id,status").maybeSingle();
  if(error)throw error;
  if(!data)throw new HttpError(409,"Command does not need reconciliation or not found");
  return Response.json({command:data});
 }catch(error){return jsonError(error);}
}
