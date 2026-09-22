import {admin,authenticate,HttpError,jsonError} from "@/lib/supabase";
import {canProposeUndo} from "@/lib/studio-review";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
export async function POST(req:Request,{params}:Ctx){
 try{
  const {id}=await params,uid=await authenticate(req),db=admin();
  const {data:source,error:sourceError}=await db.from("commands")
   .select("id,project_id,kind,status,payload")
   .eq("id",id).eq("owner_id",uid).maybeSingle();
  if(sourceError)throw sourceError;
  if(!source)throw new HttpError(404,"Command not found");
  if(!canProposeUndo(source))
   throw new HttpError(409,"Only reported-applied parts, scripts and GUI/image roots can be undone");
  // Manual reports and previous plugin versions may not have tagged an instance.
  // The Studio plugin must confirm the matching root before deleting anything.
  const {data:command,error:createError}=await db.from("commands")
   .insert({project_id:source.project_id,owner_id:uid,kind:"undo_command",
    source_command_id:source.id,status:"pending_approval",
    payload:{name:"Undo "+String(source.payload?.name||source.kind).slice(0,60),targetCommandId:source.id}})
   .select("id,status").single();
  if(createError){
   if(createError.code==="23505")throw new HttpError(409,"An undo for this command already awaits resolution");
   throw createError;
  }
  return Response.json({command},{status:201});
 }catch(error){return jsonError(error);}
}
