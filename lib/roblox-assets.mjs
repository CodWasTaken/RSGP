export function numericRobloxId(value){
 if(typeof value!=="string"||! /^[1-9][0-9]{0,19}$/.test(value))throw new Error("Roblox asset ID must be a positive decimal string");
 return value;
}
export function normalizedRobloxOperation(data){
 if(!data||typeof data!=="object"||typeof data.path!=="string"||!/^operations\/[A-Za-z0-9_-]+$/.test(data.path))throw Error("Roblox did not provide a usable upload operation ID");
 return data.path;
}
export function normalizedRobloxAsset(data){
 if(!data||typeof data!=="object")throw Error("Invalid Roblox operation status");
 if(data.done!==true)return {status:"pending"};
 const asset=data.response;
 if(!asset||!asset.assetId||!["Image","ASSET_TYPE_IMAGE"].includes(asset.assetType)){
  return {status:"failed",errorCode:data.error?.code??"invalid_asset_response"};
 }
 const assetId=numericRobloxId(String(asset.assetId));
 const moderation=asset.moderationResult?.moderationState;
 if(moderation==="MODERATION_STATE_APPROVED")return {status:"approved",assetId,moderation};
 if(moderation==="MODERATION_STATE_REJECTED")return {status:"failed",assetId,errorCode:"moderation_rejected",moderation};
 return {status:"pending_moderation",assetId,moderation:typeof moderation==="string"?moderation:null};
}
