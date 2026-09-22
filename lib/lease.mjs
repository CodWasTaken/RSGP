export const LEASE_MS = 60_000;
/** Disconnected Studio may have applied a change; expiration never means "retry". */
export function expiredLeaseStatus(status, expiresAt, now = Date.now()) {
  if (status !== "leased") return status;
  const expires = Date.parse(expiresAt ?? "");
  return Number.isFinite(expires) && expires <= now ? "needs_reconciliation" : status;
}
export function validLeaseReceipt(receipt, expected, now = Date.now()) {
  return receipt?.commandId === expected?.id &&
    receipt?.leaseId === expected?.lease_id &&
    expected?.status === "leased" &&
    expiredLeaseStatus(expected.status, expected.lease_expires_at, now) === "leased";
}
