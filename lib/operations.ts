import {parsePlan as rawParsePlan,validateOperation as rawValidateOperation} from "./operations.mjs";
export type Operation={kind:"create_part"|"create_script"|"create_gui";payload:Record<string,unknown>};
export const validateOperation=rawValidateOperation as (input:unknown)=>Operation;
export const parsePlan=rawParsePlan as (text:string)=>{summary:string;operations:Operation[]};
