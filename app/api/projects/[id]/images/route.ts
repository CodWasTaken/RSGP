import {createHash} from "node:crypto";
import {admin,authenticate,bodyJson,HttpError,jsonError,requireProject} from "@/lib/supabase";
import {createImage} from "@/lib/image-provider";
import {imageInput} from "@/lib/image-generation";
export const runtime="nodejs";
export const maxDuration=120;
const BUCKET="rsgp-generated";
type Ctx={params:Promise<{id:string}>};
type AssetRow={id:string;kind:string;prompt:string;status:string;storage_path:string|null;error_code:string|null;size_bytes:number|null;publication_status:string;roblox_asset_id:string|null;publication_error_code:string|null;created_at:string};

export async function GET(req:Request,{params}:Ctx){
 try{
  const {id}=await params,uid=await authenticate(req);
  await requireProject(uid,id);
  const db=admin();
  // A lost server invocation is not proof that generation failed or that it can be repeated.
  const {error:expireError}=await db.from("generated_assets")
   .update({status:"needs_reconciliation",error_code:"generation_outcome_unknown"})
   .eq("project_id",id).eq("owner_id",uid).eq("status","generating")
   .lt("started_at",new Date(Date.now()-300000).toISOString());
  if(expireError)throw expireError;
  const {data,error}=await db.from("generated_assets")
   .select("id,kind,prompt,status,storage_path,error_code,size_bytes,publication_status,roblox_asset_id,publication_error_code,created_at")
   .eq("project_id",id).eq("owner_id",uid).order("created_at",{ascending:false}).limit(40);
  if(error)throw error;
  const assets=await Promise.all((data??[]).map(async(asset:AssetRow)=>{
   let previewUrl:null|string=null;
   if(asset.status==="ready"&&asset.storage_path){
    const {data:signed,error:signError}=await db.storage.from(BUCKET).createSignedUrl(asset.storage_path,300);
    if(!signError&&signed)previewUrl=signed.signedUrl;
   }
   return {id:asset.id,kind:asset.kind,prompt:asset.prompt,status:asset.status,
    errorCode:asset.error_code,sizeBytes:asset.size_bytes,publicationStatus:asset.publication_status,robloxAssetId:asset.roblox_asset_id,publicationErrorCode:asset.publication_error_code,createdAt:asset.created_at,previewUrl};
  }));
  return Response.json({assets},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return jsonError(error);}
}

export async function POST(req:Request,{params}:Ctx){
 let claimId:string|null=null;
 let claimUser:string|null=null;
 try{
  const {id}=await params,uid=await authenticate(req);
  await requireProject(uid,id);
  const body=await bodyJson(req);
  let input:ReturnType<typeof imageInput>;
  try{input=imageInput(body);}catch(error){throw new HttpError(400,(error as Error).message);}
  if(!process.env.OPENAI_API_KEY)throw new HttpError(503,"Image generation is not configured");
  const db=admin();
  // Atomic project/user metering + stable request ID. A duplicate cannot trigger a second provider request.
  const {error:reservationError}=await db.rpc("rsgp_reserve_image_generation",{
   p_project_id:id,p_owner_id:uid,p_request_id:input.requestId,p_kind:input.kind,p_prompt:input.prompt,
  });
  if(reservationError){
   if(/(limit reached)/i.test(reservationError.message))throw new HttpError(429,"Image generation limit reached");
   if(reservationError.code==="23505")throw new HttpError(409,"Request ID already belongs to another generation");
   throw reservationError;
  }
  const {data:claimed,error:claimError}=await db.from("generated_assets")
   .update({status:"generating",started_at:new Date().toISOString()})
   .eq("id",input.requestId).eq("project_id",id).eq("owner_id",uid).eq("status","reserved")
   .select("id").maybeSingle();
  if(claimError)throw claimError;
  if(!claimed)throw new HttpError(409,"Generation was already submitted. Check the asset library rather than retrying.");
  claimId=input.requestId;
  claimUser=uid;
  const bytes=await createImage(input.kind,input.prompt,uid);
  const storagePath=uid+"/"+id+"/"+input.requestId+".png";
  const hash=createHash("sha256").update(bytes).digest("hex");
  const {error:storageError}=await db.storage.from(BUCKET).upload(storagePath,new Uint8Array(bytes),{
   contentType:"image/png",upsert:false,cacheControl:"3600",
  });
  if(storageError)throw new Error("Storage upload failed; generation outcome requires reconciliation");
  const {data:asset,error:updateError}=await db.from("generated_assets")
   .update({status:"ready",storage_path:storagePath,mime_type:"image/png",sha256:hash,size_bytes:bytes.length,completed_at:new Date().toISOString(),error_code:null})
   .eq("id",input.requestId).eq("project_id",id).eq("owner_id",uid).eq("status","generating")
   .select("id,status").maybeSingle();
  if(updateError||!asset)throw new Error("Could not commit generated image; manual reconciliation required");
  return Response.json({asset},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  // Only an explicitly identifiable, rejected provider request can be called failed.
  // A network timeout, 5xx, upload problem, or lost response may have already incurred a charge.
  if(claimId&&claimUser){
   const providerStatus=(error as {providerStatus?:number}).providerStatus;
   const knownRejection=typeof providerStatus==="number"&&providerStatus>=400&&providerStatus<500;
   const status=knownRejection?"failed":"needs_reconciliation";
   try{
    await admin().from("generated_assets").update({
     status,error_code:knownRejection?"provider_rejected":"generation_outcome_unknown",
     completed_at:new Date().toISOString(),
    }).eq("id",claimId).eq("owner_id",claimUser).eq("status","generating");
   }catch{ /* A stale generating record is surfaced as uncertain by GET. */ }
   return Response.json({error:knownRejection?"Image provider rejected the request":"Generation outcome is uncertain. Inspect the asset library; do not retry automatically.",status},{status:knownRejection?422:502});
  }
  return jsonError(error);
 }
}
