import {REVERSIBLE_KINDS,canProposeUndo as rawUndo,isLiveStudioTarget as rawLive} from "./studio-review.mjs";
export {REVERSIBLE_KINDS};
export const canProposeUndo=rawUndo as (command:{status:string;kind:string}|null)=>boolean;
export const isLiveStudioTarget=rawLive as (
 connection:{active:boolean;project_id:string;owner_id:string;studio_id:string;last_seen_at:string|null}|null,
 projectId:string,ownerId:string,now?:number
)=>boolean;
