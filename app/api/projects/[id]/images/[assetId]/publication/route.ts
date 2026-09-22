import {admin,authenticate,HttpError,jsonError,requireProject} from "@/lib/supabase";
import {readModeration,readPublication} from "@/lib/roblox-publisher";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string;assetId:string}>};
export async function GET(req:Request,{params}:Ctx){
 try{
  const {id,assetId}=await params,uid=await authenticate(req);
  await requireProject(uid,id);
  const db=admin();
  const {data:asset,error}=await db.from("generated_assets")
   .select("id,publication_status,upload_operation,roblox_asset_id,roblox_owner_id,publication_error_code")
   .eq("id",assetId).eq("project_id",id).eq("owner_id",uid).maybeSingle();
  if(error)throw error;
  if(!asset)throw new HttpError(404,"Asset not found");
  if(asset.publication_status==="uploading"){
   const {error:expire}=await db.from("generated_assets").update({
    publication_status:"needs_reconciliation",publication_error_code:"missing_upload_receipt",
   }).eq("id",assetId).eq("owner_id",uid).eq("publication_status","uploading")
    .lt("publication_requested_at",new Date(Date.now()-120000).toISOString());
   if(expire)throw expire;
   return Response.json({status:"uploading"});
  }
  if(!["submitted","pending_moderation"].includes(asset.publication_status))
   return Response.json({status:asset.publication_status,robloxAssetId:asset.roblox_asset_id});
  if(!asset.roblox_owner_id||!asset.upload_operation)throw new HttpError(409,"Missing publication receipt; manual reconciliation required");
  const result=asset.publication_status==="pending_moderation"&&asset.roblox_asset_id
   ?await readModeration(uid,asset.roblox_asset_id,asset.roblox_owner_id)
   :await readPublication(uid,asset.upload_operation,asset.roblox_owner_id);
  if(result.status==="pending")return Response.json({status:"submitted"});
  const status=result.status==="approved"?"approved":result.status==="failed"?"failed":"pending_moderation";
  const {error:saveError}=await db.from("generated_assets").update({
   publication_status:status,roblox_asset_id:result.assetId??asset.roblox_asset_id,
   publication_error_code:result.errorCode?String(result.errorCode):null,
  }).eq("id",assetId).eq("owner_id",uid).in("publication_status",["submitted","pending_moderation"]);
  if(saveError)throw saveError;
  return Response.json({status,robloxAssetId:result.assetId??asset.roblox_asset_id});
 }catch(error){return jsonError(error);}
}
