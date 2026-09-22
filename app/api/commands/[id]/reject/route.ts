import {admin,authenticate,HttpError,jsonError} from "@/lib/supabase";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{
  const {id}=await params,uid=await authenticate(req);
  const {data,error}=await admin().from("commands")
   .update({status:"failed",result:{detail:"Rejected by project owner; never sent to Studio.",source:"user"}})
   .eq("id",id).eq("owner_id",uid).eq("status","pending_approval").select("id,status").maybeSingle();
  if(error)throw error;
  if(!data)throw new HttpError(409,"Command not pending approval or not found");
  return Response.json({command:data});
 }catch(error){return jsonError(error);}
}
