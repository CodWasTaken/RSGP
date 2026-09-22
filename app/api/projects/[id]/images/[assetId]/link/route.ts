import {admin,authenticate,bodyJson,HttpError,jsonError,requireProject} from "@/lib/supabase";
import {numericRobloxId} from "@/lib/roblox-assets";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string;assetId:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{
  const {id,assetId}=await params,uid=await authenticate(req);
  await requireProject(uid,id);
  const input=await bodyJson(req);
  let robloxAssetId:string;
  try{robloxAssetId=numericRobloxId(input.robloxAssetId);}catch{throw new HttpError(400,"Enter a numeric Roblox Image asset ID");}
  const {data,error}=await admin().from("generated_assets").update({
   roblox_asset_id:robloxAssetId,publication_status:"manual_unverified",
  }).eq("id",assetId).eq("project_id",id).eq("owner_id",uid)
   .eq("status","ready").eq("publication_status","not_published")
   .select("id,publication_status,roblox_asset_id").maybeSingle();
  if(error)throw error;
  if(!data)throw new HttpError(409,"Image is not ready or already has a publication record");
  return Response.json({asset:data});
 }catch(error){return jsonError(error);}
}
