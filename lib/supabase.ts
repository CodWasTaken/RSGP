import {createClient} from "@supabase/supabase-js";
function env(name:string):string{const value=process.env[name];if(!value)throw new Error("Missing "+name);return value;}
export function admin(){
 return createClient(env("NEXT_PUBLIC_SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
}
export function browserClient(){
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||"https://invalid.supabase.co",process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"unconfigured");
}
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export function jsonError(error:unknown):Response{
 const status=error instanceof HttpError?error.status:500;
 if(status>=500)console.error("RSGP API:",error instanceof Error?error.message:String(error));
 return Response.json({error:status>=500?"Server error":(error as Error).message},{status});
}
export async function authenticate(req:Request):Promise<string>{
 const token=req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)throw new HttpError(401,"Sign in required");
 const {data,error}=await admin().auth.getUser(token);
 if(error||!data.user)throw new HttpError(401,"Invalid session");
 return data.user.id;
}
export async function requireProject(userId:string,id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(400,"Invalid project ID");
 const {data,error}=await admin().from("projects").select("id,name,owner_id").eq("id",id).eq("owner_id",userId).maybeSingle();
 if(error)throw error;
 if(!data)throw new HttpError(404,"Project not found");
 return data;
}
export async function bodyJson(req:Request):Promise<Record<string,unknown>>{
 if(Number(req.headers.get("content-length")||"0")>25000)throw new HttpError(413,"Request too large");
 const raw=await req.text();
 if(raw.length>25000)throw new HttpError(413,"Request too large");
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{throw new HttpError(400,"Invalid JSON");}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new HttpError(400,"Expected JSON object");
 return parsed as Record<string,unknown>;
}
