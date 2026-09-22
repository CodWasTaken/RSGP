import {imageInput as validate,promptForImage as prompt,pngBytes as decode} from "./image-generation.mjs";
export type ImageKind="icon"|"thumbnail"|"texture"|"gui";
export const imageInput=validate as (raw:unknown)=>{prompt:string;kind:ImageKind;requestId:string};
export const promptForImage=prompt as (kind:ImageKind,description:string)=>string;
export const pngBytes=decode as (value:string,maxBytes?:number)=>Buffer;
