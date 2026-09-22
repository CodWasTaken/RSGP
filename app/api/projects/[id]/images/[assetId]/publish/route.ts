import {createHash} from "node:crypto";
import {admin,authenticate,HttpError,jsonError,requireProject} from "@/lib/supabase";
import {submitImageUpload} from "@/lib/roblox-publisher";
export const runtime="nodejs";
export const maxDuration=60;
type Ctx={params:Promise<{id:string;assetId:string}>};
export async function POST(req:Request,{params}:Ctx){
 let claimed=false,assetId="",ownerId="",projectId="";
 try{
  const paramsValue=await params;assetId=paramsValue.assetId;projectId=paramsValue.id;
  ownerId=await authenticate(req);
  await requireProject(ownerId,projectId);
  const db=admin();
  const {data:asset,error}=await db.from("generated_assets")
   .select("id,kind,prompt,status,storage_path,sha256,size_bytes,publication_status")
   .eq("id",assetId).eq("project_id",projectId).eq("owner_id",ownerId).maybeSingle();
  if(error)throw error;
  if(!asset||asset.status!=="ready"||!asset.storage_path||!asset.sha256||!asset.size_bytes)
   throw new HttpError(409,"Generate and save an image before publishing");
  if(asset.publication_status!=="not_published")
   throw new HttpError(409,"Image has a publication record; check its status rather than resubmitting");
  // Verify authorization BEFORE claiming: a reconnect failure must not consume the publication attempt.
  const {connectedRobloxAccess}=await import("@/lib/roblox-oauth");
  await connectedRobloxAccess(ownerId);
  const {data:lock,error:lockError}=await db.from("generated_assets")
   .update({publication_status:"uploading",publication_requested_at:new Date().toISOString()})
   .eq("id",assetId).eq("project_id",projectId).eq("owner_id",ownerId).eq("publication_status","not_published")
   .select("id").maybeSingle();
  if(lockError)throw lockError;
  if(!lock)throw new HttpError(409,"Publication already started. Do not submit twice.");
  claimed=true;
  const {data:storage,error:downloadError}=await db.storage.from("rsgp-generated").download(asset.storage_path);
  if(downloadError||!storage)throw new Error("Could not read the private asset");
  const bytes=new Uint8Array(await storage.arrayBuffer());
  if(bytes.length!==asset.size_bytes||
     createHash("sha256").update(bytes).digest("hex")!==asset.sha256||
     bytes.length<24||bytes.length>12582912||
     Buffer.from(bytes.subarray(0,8)).toString("hex")!=="89504e470d0a1a0a")
    throw new Error("Private image integrity check failed");
  const result=await submitImageUpload(ownerId,bytes,"RSGP "+asset.kind+" "+assetId.slice(0,8));
  const {error:saveError}=await db.from("generated_assets")
   .update({publication_status:"submitted",upload_operation:result.operation,roblox_owner_id:result.robloxUserId,publication_error_code:null})
   .eq("id",assetId).eq("owner_id",ownerId).eq("publication_status","uploading");
  if(saveError)throw saveError;
  return Response.json({status:"submitted",operation:result.operation},{status:202});
 }catch(error){
  if(claimed){
   // A 4xx from Roblox, a timeout, a lost response, or a DB write failure may
   // have crossed the upload boundary. Never blindly repeat the upload.
   try{await admin().from("generated_assets").update({
    publication_status:"needs_reconciliation",publication_error_code:"upload_outcome_unknown",
   }).eq("id",assetId).eq("owner_id",ownerId).eq("publication_status","uploading");}catch{}
   return Response.json({error:"Roblox upload outcome is uncertain. Do not resubmit automatically."},{status:502});
  }
  return jsonError(error);
 }
}
