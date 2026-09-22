import {createHash,randomBytes} from "node:crypto";
import {admin,HttpError} from "./supabase";
export const digest=(text:string)=>createHash("sha256").update(text).digest("hex");
export const pairingCode=()=>randomBytes(12).toString("hex");
export const randomToken=()=>randomBytes(32).toString("base64url");
export async function pluginAuth(req:Request){
 const token=req.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/)?.[1];
 if(!token)throw new HttpError(401,"Plugin token required");
 const {data,error}=await admin().from("studio_connections").select("id,project_id,owner_id,active").eq("token_hash",digest(token)).maybeSingle();
 if(error)throw error;
 if(!data?.active)throw new HttpError(401,"Connection revoked");
 return data;
}
