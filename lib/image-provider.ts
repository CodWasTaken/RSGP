import {HttpError} from "./supabase";
import {pngBytes,promptForImage,type ImageKind} from "./image-generation";
export async function createImage(kind:ImageKind,prompt:string,userId:string):Promise<Buffer>{
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new HttpError(503,"Image provider is not configured");
 const model=process.env.RSGP_IMAGE_MODEL||"gpt-image-1-mini";
 // Explicitly supported and conservative: one PNG, low quality. Billing is not assumed to equal one credit.
 const response=await fetch("https://api.openai.com/v1/images/generations",{
  method:"POST",
  headers:{"authorization":"Bearer "+key,"content-type":"application/json"},
  body:JSON.stringify({
   model,prompt:promptForImage(kind,prompt),n:1,quality:"low",
   size:kind==="thumbnail"?"1536x1024":"1024x1024",
   output_format:"png",moderation:"auto",user:userId,
  }),
  signal:AbortSignal.timeout(110000),
 });
 if(!response.ok){
  const error=new Error("Image provider error: HTTP "+response.status);
  Object.assign(error,{providerStatus:response.status});
  throw error;
 }
 const payload=await response.json();
 return pngBytes(payload?.data?.[0]?.b64_json);
}
