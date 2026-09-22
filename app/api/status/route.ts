import {deploymentReadiness} from "@/lib/deployment-readiness";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Configuration only. Deliberately no connection attempt and no secret values.
export async function GET(){
 const state=deploymentReadiness(process.env);
 return Response.json(state,{headers:{"Cache-Control":"no-store"}});
}
