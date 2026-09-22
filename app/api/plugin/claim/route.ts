import {admin,bodyJson,HttpError,jsonError} from "@/lib/supabase";
import {digest,randomToken} from "@/lib/security";
export const runtime="nodejs";
export async function POST(req:Request){
 try{
 const body=await bodyJson(req),code=body.code,studioId=body.studioId,label=body.label;
 if(typeof code!=="string"||!/^[0-9a-f]{24}$/.test(code))throw new HttpError(400,"Invalid pairing code");
 if(typeof studioId!=="string"||studioId.length<1||studioId.length>100||typeof label!=="string"||label.length<1||label.length>80)throw new HttpError(400,"Invalid Studio identity");
 const db=admin();
 const {data,error}=await db.from("pairing_codes").update({claimed_at:new Date().toISOString()}).eq("code_hash",digest(code)).is("claimed_at",null).gt("expires_at",new Date().toISOString()).select("project_id,owner_id").maybeSingle();
 if(error)throw error;
 if(!data)throw new HttpError(401,"Pairing code expired or already used");
 const token=randomToken();
 const {error:insertError}=await db.from("studio_connections").insert({project_id:data.project_id,owner_id:data.owner_id,token_hash:digest(token),studio_id:studioId,label,active:true});
 if(insertError)throw insertError;
 return Response.json({token,projectId:data.project_id});
 }catch(error){return jsonError(error);}
}
