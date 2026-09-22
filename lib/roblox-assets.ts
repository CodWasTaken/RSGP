import {numericRobloxId as rawId,normalizedRobloxOperation as rawOp,normalizedRobloxAsset as rawAsset} from "./roblox-assets.mjs";
export const numericRobloxId=rawId as (value:unknown)=>string;
export const normalizedRobloxOperation=rawOp as (value:unknown)=>string;
export const normalizedRobloxAsset=rawAsset as (value:unknown)=>{status:"pending"|"failed"|"approved"|"pending_moderation";assetId?:string;moderation?:string|null;errorCode?:string|number};
