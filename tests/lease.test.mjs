import test from "node:test";
import assert from "node:assert/strict";
import {expiredLeaseStatus, validLeaseReceipt} from "../lib/lease.mjs";

test("leased command with expired deadline requires reconciliation",()=>{
 assert.equal(expiredLeaseStatus("leased","2026-01-01T00:00:00.000Z",Date.parse("2026-01-01T00:01:00Z")),"needs_reconciliation");
 assert.equal(expiredLeaseStatus("queued","2026-01-01T00:00:00.000Z",Date.parse("2026-01-01T00:01:00Z")),"queued");
 assert.equal(expiredLeaseStatus("leased",null),"leased");
});
test("late, duplicate or wrong-lease receipts cannot confirm a command",()=>{
 const expected={id:"job",lease_id:"token1",status:"leased",lease_expires_at:"2026-01-01T00:01:00.000Z"};
 const good={commandId:"job",leaseId:"token1"};
 assert.equal(validLeaseReceipt(good,expected,Date.parse("2026-01-01T00:00:30Z")),true);
 assert.equal(validLeaseReceipt({...good,leaseId:"token2"},expected,Date.parse("2026-01-01T00:00:30Z")),false);
 assert.equal(validLeaseReceipt(good,expected,Date.parse("2026-01-01T00:02:00Z")),false);
 assert.equal(validLeaseReceipt(good,{...expected,status:"completed"},Date.parse("2026-01-01T00:00:30Z")),false);
});
