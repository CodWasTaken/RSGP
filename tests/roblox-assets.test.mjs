import test from "node:test";
import assert from "node:assert/strict";
import {numericRobloxId,normalizedRobloxAsset,normalizedRobloxOperation} from "../lib/roblox-assets.mjs";
test("asset IDs stay decimal strings and invalid identifiers cannot reach Studio",()=>{
 assert.equal(numericRobloxId("1234567890123456789"),"1234567890123456789");
 for(const id of [0,"0","01","1e5","-12","abc"," 123 ","1".repeat(21)])assert.throws(()=>numericRobloxId(id));
});
test("upload response requires a canonical operation path",()=>{
 assert.equal(normalizedRobloxOperation({path:"operations/A_123"}),"operations/A_123");
 assert.throws(()=>normalizedRobloxOperation({path:"https://evil.example/operations/a"}));
 assert.throws(()=>normalizedRobloxOperation({path:"../../"}));
});
test("Roblox moderation and publication remain separate",()=>{
 assert.deepEqual(normalizedRobloxAsset({done:false}),{status:"pending"});
 assert.deepEqual(normalizedRobloxAsset({done:true,response:{assetId:"42",assetType:"Image",moderationResult:{moderationState:"MODERATION_STATE_APPROVED"}}}),{status:"approved",assetId:"42",moderation:"MODERATION_STATE_APPROVED"});
 assert.equal(normalizedRobloxAsset({done:true,response:{assetId:"42",assetType:"Image"}}).status,"pending_moderation");
 assert.equal(normalizedRobloxAsset({done:true,response:{assetId:"42",assetType:"Decal"}}).status,"failed");
});
