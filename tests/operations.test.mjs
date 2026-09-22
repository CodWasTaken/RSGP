import test from "node:test";
import assert from "node:assert/strict";
import {parsePlan,validateOperation} from "../lib/operations.mjs";
const part={kind:"create_part",name:"Checkpoint",position:[1,2,3],size:[4,1,4],color:[180,80,240]};
test("accepts and normalizes a part",()=>assert.deepEqual(validateOperation(part),{kind:"create_part",payload:{name:"Checkpoint",position:[1,2,3],size:[4,1,4],color:[180,80,240]}}));
test("rejects unsupported or malformed operations",()=>{assert.throws(()=>validateOperation({kind:"execute_luau",source:"print(1)"}));assert.throws(()=>validateOperation({...part,size:[100000,1,1]}));assert.throws(()=>validateOperation({...part,name:"../oops"}));});
test("scripts have matching parent",()=>{assert.throws(()=>validateOperation({kind:"create_script",name:"x",className:"Script",parent:"StarterPlayerScripts",source:"print(1)"}));assert.equal(validateOperation({kind:"create_script",name:"x",className:"Script",parent:"ServerScriptService",source:"print(1)"}).kind,"create_script");});
test("invalid plans never become commands",()=>{assert.throws(()=>parsePlan(JSON.stringify({summary:"hello",operations:Array.from({length:13},()=>part)})));assert.throws(()=>parsePlan(JSON.stringify({summary:"bad",operations:[part,{kind:"delete_game"}]})));});
test("valid plan",()=>assert.equal(parsePlan(JSON.stringify({summary:"First step",operations:[part]})).operations.length,1));
