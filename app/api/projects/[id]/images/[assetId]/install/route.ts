import {admin,authenticate,HttpError,jsonError,requireProject} from "@/lib/supabase";
import {numericRobloxId} from "@/lib/roblox-assets";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string;assetId:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{
  const {id,assetId}=await params,uid=await authenticate(req);
  await requireProject(uid,id);
  const db=admin();
  const {data:asset,error}=await db.from("generated_assets")
   .select("id,kind,status,publication_status,roblox_asset_id").eq("id",assetId)
   .eq("project_id",id).eq("owner_id",uid).maybeSingle();
  if(error)throw error;
  if(!asset||asset.status!=="ready"||!["approved","manual_unverified"].includes(asset.publication_status))
   throw new HttpError(409,"Asset is not published or manually linked for installation");
  const robloxAssetId=numericRobloxId(asset.roblox_asset_id);
  const {data:existing,error:existingError}=await db.from("commands").select("id,status")
   .eq("project_id",id).eq("owner_id",uid).eq("source_asset_id",asset.id)
   .in("status",["pending_approval","queued","leased","needs_reconciliation"]).limit(1);
  if(existingError)throw existingError;
  if(existing?.length)throw new HttpError(409,"This asset already has an unresolved Studio installation proposal");
  const {data:command,error:createError}=await db.from("commands")
   .insert({project_id:id,owner_id:uid,source_asset_id:asset.id,kind:"install_image",
    payload:{name:"RSGP Image "+asset.id.slice(0,8),robloxAssetId,kind:asset.kind,assetId:asset.id},
    status:"pending_approval"})
   .select("id,status").single();
  if(createError)throw createError;
  return Response.json({command},{status:201});
 }catch(error){return jsonError(error);}
}
