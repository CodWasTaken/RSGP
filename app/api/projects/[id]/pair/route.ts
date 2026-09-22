import {admin,authenticate,jsonError,requireProject} from "@/lib/supabase";
import {digest,pairingCode} from "@/lib/security";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{const {id}=await params,uid=await authenticate(req);await requireProject(uid,id);
 const code=pairingCode(),expiresAt=new Date(Date.now()+600000).toISOString();
 const {error}=await admin().from("pairing_codes").insert({project_id:id,owner_id:uid,code_hash:digest(code),expires_at:expiresAt});
 if(error)throw error;
 return Response.json({code,expiresAt,origin:process.env.NEXT_PUBLIC_RSGP_ORIGIN||new URL(req.url).origin});
 }catch(error){return jsonError(error);}
}
