import test from "node:test";
import assert from "node:assert/strict";
import {canProposeUndo,isLiveStudioTarget} from "../lib/studio-review.mjs";

test("only reported-completed mutating commands can have an undo proposal",()=>{
 for(const kind of ["create_part","create_script","create_gui","install_image"])
  assert.equal(canProposeUndo({kind,status:"completed"}),true);
 for(const kind of ["inspect_project","undo_command"])
  assert.equal(canProposeUndo({kind,status:"completed"}),false);
 for(const status of ["pending_approval","queued","leased","failed","needs_reconciliation"])
  assert.equal(canProposeUndo({kind:"create_part",status}),false);
});
test("owner-scoped target must be the same project and recently seen",()=>{
 const now=Date.parse("2026-09-22T18:00:00Z");
 const conn={active:true,project_id:"alpha",owner_id:"user",studio_id:"100:200",last_seen_at:new Date(now-3500).toISOString()};
 assert.equal(isLiveStudioTarget(conn,"alpha","user",now),true);
 assert.equal(isLiveStudioTarget({...conn,project_id:"beta"},"alpha","user",now),false);
 assert.equal(isLiveStudioTarget({...conn,owner_id:"other"},"alpha","user",now),false);
 assert.equal(isLiveStudioTarget({...conn,active:false},"alpha","user",now),false);
 assert.equal(isLiveStudioTarget({...conn,last_seen_at:new Date(now-25000).toISOString()},"alpha","user",now),false);
 assert.equal(isLiveStudioTarget({...conn,last_seen_at:"not a date"},"alpha","user",now),false);
});
