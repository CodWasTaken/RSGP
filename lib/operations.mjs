const name = (x,max=80)=>typeof x==="string"&&x.length>0&&x.length<=max&&/^[A-Za-z0-9 _-]+$/.test(x);
const vec=(x,min,max)=>Array.isArray(x)&&x.length===3&&x.every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=min&&n<=max);
export function validateOperation(op){
 if(!op||typeof op!=="object"||Array.isArray(op))throw Error("Invalid operation");
 if(op.kind==="create_part"){
  if(!name(op.name)||!vec(op.position,-2048,2048)||!vec(op.size,.1,256)||!vec(op.color,0,255))throw Error("Invalid part");
  return {kind:"create_part",payload:{name:op.name,position:op.position,size:op.size,color:op.color}};
 }
 if(op.kind==="create_script"){
  if(!name(op.name)||!["Script","LocalScript","ModuleScript"].includes(op.className)||!["ServerScriptService","ReplicatedStorage","StarterPlayerScripts"].includes(op.parent)||typeof op.source!=="string"||!op.source.trim()||op.source.length>16000)throw Error("Invalid script");
  if((op.className==="Script"&&op.parent!=="ServerScriptService")||(op.className==="LocalScript"&&op.parent!=="StarterPlayerScripts")||(op.className==="ModuleScript"&&op.parent!=="ReplicatedStorage"))throw Error("Invalid script parent");
  return {kind:"create_script",payload:{name:op.name,parent:op.parent,className:op.className,source:op.source}};
 }
 if(op.kind==="create_gui"){
  if(!name(op.name)||typeof op.title!=="string"||!op.title.trim()||op.title.length>100||!vec(op.color,0,255))throw Error("Invalid GUI");
  const elements=op.elements===undefined?[]:op.elements;
  if(!Array.isArray(elements)||elements.length>8)throw Error("Invalid GUI elements");
  const normalized=elements.map(item=>{
    if(!item||typeof item!=="object"||Array.isArray(item)||!["label","button"].includes(item.kind)||
       typeof item.text!=="string"||!item.text.trim()||item.text.length>80)throw Error("Invalid GUI element");
    return {kind:item.kind,text:item.text};
  });
  return {kind:"create_gui",payload:{name:op.name,title:op.title,color:op.color,elements:normalized}};
 }
 throw Error("Unsupported operation");
}
export function parsePlan(text){
 const plan=JSON.parse(text);
 if(!plan||typeof plan.summary!=="string"||!plan.summary.trim()||plan.summary.length>1200||!Array.isArray(plan.operations)||plan.operations.length>12)throw Error("Invalid plan");
 return {summary:plan.summary,operations:plan.operations.map(validateOperation)};
}
