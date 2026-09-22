import {admin,authenticate,bodyJson,HttpError,jsonError} from "@/lib/supabase";
export const runtime="nodejs";
export async function GET(req:Request){
 try{const uid=await authenticate(req);const {data,error}=await admin().from("projects").select("id,name,created_at").eq("owner_id",uid).order("created_at",{ascending:false}).limit(50);if(error)throw error;return Response.json({projects:data});}
 catch(error){return jsonError(error);}
}
export async function POST(req:Request){
 try{const uid=await authenticate(req),body=await bodyJson(req),name=body.name;
 if(typeof name!=="string"||name.trim().length<2||name.length>80)throw new HttpError(400,"Name must be 2–80 characters");
 const {data,error}=await admin().from("projects").insert({name:name.trim(),owner_id:uid}).select("id,name,created_at").single();if(error)throw error;
 return Response.json({project:data},{status:201});}catch(error){return jsonError(error);}
}
