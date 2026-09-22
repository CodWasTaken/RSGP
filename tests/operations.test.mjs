import test from "node:test";
import assert from "node:assert/strict";
import {parsePlan,validateOperation} from "../lib/operations.mjs";
const part={kind:"create_part",name:"Checkpoint",position:[1,2,3],size:[4,1,4],color:[180,80,240]};
test("accepts and normalizes a part",()=>assert.deepEqual(validateOperation(part),{kind:"create_part",payload:{name:"Checkpoint",position:[1,2,3],size:[4,1,4],color:[180,80,240]}}));
test("rejects unsupported or malformed operations",()=>{assert.throws(()=>validateOperation({kind:"execute_luau",source:"print(1)"}));assert.throws(()=>validateOperation({...part,size:[100000,1,1]}));assert.throws(()=>validateOperation({...part,name:"../oops"}));});
test("scripts have matching parent",()=>{assert.throws(()=>validateOperation({kind:"create_script",name:"x",className:"Script",parent:"StarterPlayerScripts",source:"print(1)"}));assert.equal(validateOperation({kind:"create_script",name:"x",className:"Script",parent:"ServerScriptService",source:"print(1)"}).kind,"create_script");});
test("invalid plans never become commands",()=>{assert.throws(()=>parsePlan(JSON.stringify({summary:"hello",operations:Array.from({length:13},()=>part)})));assert.throws(()=>parsePlan(JSON.stringify({summary:"bad",operations:[part,{kind:"delete_game"}]})));});
test("valid plan",()=>assert.equal(parsePlan(JSON.stringify({summary:"First step",operations:[part]})).operations.length,1));

test("native GUI accepts up to eight bounded labels and visual-only button prototypes",()=>{
 const result=validateOperation({kind:"create_gui",name:"Status HUD",title:"Game status",color:[22,32,47],elements:[{kind:"label",text:"Stage 1"},{kind:"button",text:"Play"}]});
 assert.deepEqual(result.payload.elements,[{kind:"label",text:"Stage 1"},{kind:"button",text:"Play"}]);
 assert.throws(()=>validateOperation({kind:"create_gui",name:"HUD",title:"Hi",color:[0,0,0],elements:Array.from({length:9},()=>({kind:"label",text:"Too many"}))}));
 assert.throws(()=>validateOperation({kind:"create_gui",name:"HUD",title:"Hi",color:[0,0,0],elements:[{kind:"script",text:"Danger"}]}));
 assert.throws(()=>validateOperation({kind:"create_gui",name:"HUD",title:"Hi",color:[0,0,0],elements:[{kind:"label",text:""}]}));
});
