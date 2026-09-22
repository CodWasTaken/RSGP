export const REVERSIBLE_KINDS=Object.freeze(["create_part","create_script","create_gui","install_image"]);
export function canProposeUndo(command){
 return Boolean(command&&command.status==="completed"&&REVERSIBLE_KINDS.includes(command.kind));
}
export function isLiveStudioTarget(connection,projectId,ownerId,now=Date.now()){
 if(!connection||connection.active!==true||connection.project_id!==projectId||
  connection.owner_id!==ownerId||typeof connection.studio_id!=="string"||!connection.studio_id||
  typeof connection.last_seen_at!=="string")return false;
 const age=now-Date.parse(connection.last_seen_at);
 return Number.isFinite(age)&&age>=-5000&&age<20000;
}
