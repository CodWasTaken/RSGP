import {admin,authenticate,bodyJson,HttpError,jsonError,requireProject} from "@/lib/supabase";
import {parsePlan} from "@/lib/operations";
export const runtime="nodejs";
export const maxDuration=60;
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{
 const {id}=await params,uid=await authenticate(req);
 await requireProject(uid,id);
 const body=await bodyJson(req),prompt=body.prompt;
 if(typeof prompt!=="string"||prompt.trim().length<5||prompt.length>3000)throw new HttpError(400,"Prompt must be 5–3000 characters");
 if(!process.env.OPENAI_API_KEY)throw new HttpError(503,"AI provider not configured");
 const db=admin();
 const {data:recent,error:recentError}=await db.from("messages").select("created_at").eq("project_id",id).eq("role","user").gte("created_at",new Date(Date.now()-60000).toISOString()).limit(3);
 if(recentError)throw recentError;
 if((recent?.length||0)>=3)throw new HttpError(429,"Please allow a minute before more prompts");
 const instruction='You are RSGP, a Roblox Studio game-building planner. Return ONLY a JSON object with "summary" (string) and "operations" (array of at most 12). Allowed operations: {"kind":"create_part","name":string,"position":[x,y,z],"size":[x,y,z],"color":[r,g,b]}; {"kind":"create_script","name":string,"parent":"ServerScriptService"|"ReplicatedStorage"|"StarterPlayerScripts","className":"Script"|"ModuleScript"|"LocalScript","source":valid Luau string}; {"kind":"create_gui","name":string,"title":string,"color":[r,g,b],"elements":[{"kind":"label"|"button","text":string}]}. Parent mapping: Script to ServerScriptService, LocalScript to StarterPlayerScripts, ModuleScript to ReplicatedStorage. Build a coherent small prototype. Do not use HTTP calls, require(assetId), external modules, purchases, web requests, or data exfiltration. Never claim the work was installed, played, verified or published. GUI elements are native Roblox labels and visual-only button prototypes; never claim buttons are wired or gameplay is functional. Human approval is required before execution. If a full request exceeds 12 operations, summarize the achievable portion.';
 const response=await fetch("https://api.openai.com/v1/chat/completions",{
 method:"POST",headers:{"authorization":"Bearer "+process.env.OPENAI_API_KEY,"content-type":"application/json"},
 body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",response_format:{type:"json_object"},temperature:0.4,max_completion_tokens:3500,messages:[{role:"system",content:instruction},{role:"user",content:prompt}]}),
 signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new HttpError(502,"AI provider temporarily unavailable");
 const out=await response.json(),raw=out.choices?.[0]?.message?.content;
 if(typeof raw!=="string")throw new HttpError(502,"AI provider returned no plan");
 let plan:ReturnType<typeof parsePlan>;
 try{plan=parsePlan(raw);}catch{throw new HttpError(502,"AI plan failed validation; no Studio commands were sent");}
 const {error:userError}=await db.from("messages").insert({project_id:id,owner_id:uid,role:"user",content:prompt});
 if(userError)throw userError;
 const {error:assistantError}=await db.from("messages").insert({project_id:id,owner_id:uid,role:"assistant",content:plan.summary});
 if(assistantError)throw assistantError;
 if(plan.operations.length){
 const {error}=await db.from("commands").insert(plan.operations.map(op=>({project_id:id,owner_id:uid,kind:op.kind,payload:op.payload,status:"pending_approval"})));
 if(error)throw error;
 }
 return Response.json({summary:plan.summary,proposed:plan.operations.length});
 }catch(error){return jsonError(error);}
}
