import {expiredLeaseStatus as rawExpiredLeaseStatus,validLeaseReceipt as rawValidLeaseReceipt,LEASE_MS} from "./lease.mjs";
export {LEASE_MS};
export const expiredLeaseStatus = rawExpiredLeaseStatus as (status:string,expiresAt:string|null,now?:number)=>string;
export const validLeaseReceipt = rawValidLeaseReceipt as (receipt:{commandId:string;leaseId:string},expected:{id:string;lease_id:string;status:string;lease_expires_at:string},now?:number)=>boolean;
