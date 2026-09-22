import {connectedRobloxAccess} from "./roblox-oauth";
import {normalizedRobloxAsset,normalizedRobloxOperation} from "./roblox-assets";
import {HttpError} from "./supabase";

const ROOT="https://apis.roblox.com/assets/v1";
export async function submitImageUpload(ownerId:string,bytes:Uint8Array,name:string){
 const {accessToken,robloxUserId}=await connectedRobloxAccess(ownerId);
 const form=new FormData();
 form.append("request",JSON.stringify({
  assetType:"Image",displayName:name.slice(0,50),description:"Created with RSGP",
  creationContext:{creator:{userId:robloxUserId}},
 }));
 form.append("fileContent",new Blob([new Uint8Array(bytes)],{type:"image/png"}),"rsgp.png");
 const response=await fetch(ROOT+"/assets",{
  method:"POST",headers:{Authorization:"Bearer "+accessToken},body:form,signal:AbortSignal.timeout(25000),
 });
 if(!response.ok){
  const message=response.status===401||response.status===403
   ?"Roblox authorization cannot publish this image":"Roblox asset submission was not accepted";
  const error=new HttpError(response.status===429?429:502,message);
  Object.assign(error,{robloxStatus:response.status});
  throw error;
 }
 const receipt=await response.json();
 return {operation:normalizedRobloxOperation(receipt),robloxUserId};
}
export async function readPublication(ownerId:string,operation:string,expectedOwner:string){
 const {accessToken,robloxUserId}=await connectedRobloxAccess(ownerId);
 if(robloxUserId!==expectedOwner)throw new HttpError(409,"Reconnect the Roblox account used to upload this image");
 const path=normalizedRobloxOperation({path:operation});
 const response=await fetch(ROOT+"/"+path,{
  headers:{Authorization:"Bearer "+accessToken},signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw new HttpError(502,"Roblox upload status could not be checked");
 return normalizedRobloxAsset(await response.json());
}
export async function readModeration(ownerId:string,assetId:string,expectedOwner:string){
 const {accessToken,robloxUserId}=await connectedRobloxAccess(ownerId);
 if(robloxUserId!==expectedOwner)throw new HttpError(409,"Reconnect the Roblox account used to upload this image");
 const response=await fetch(ROOT+"/assets/"+assetId,{
  headers:{Authorization:"Bearer "+accessToken},signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw new HttpError(502,"Roblox moderation status could not be checked");
 const asset=await response.json();
 return normalizedRobloxAsset({done:true,response:asset});
}
