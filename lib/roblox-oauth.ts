import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {HttpError,admin} from "./supabase";
const OAUTH="https://apis.roblox.com/oauth/v1";
type Tokens={access_token:string;refresh_token:string;expires_in:number;scope?:string};
function key(){
 const raw=process.env.RSGP_TOKEN_ENCRYPTION_KEY;
 if(!raw)throw new HttpError(503,"Roblox authorization is not configured");
 const value=Buffer.from(raw,"base64");
 if(value.length!==32)throw new HttpError(503,"Roblox token encryption key must contain 32 bytes");
 return value;
}
export function seal(value:string){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv),encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString("base64url");
}
export function unseal(value:string){
 const bytes=Buffer.from(value,"base64url");
 if(bytes.length<29)throw new Error("Invalid encrypted token");
 const decipher=createDecipheriv("aes-256-gcm",key(),bytes.subarray(0,12));
 decipher.setAuthTag(bytes.subarray(12,28));
 return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString("utf8");
}
export const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
export function oauthConfig(){
 const clientId=process.env.ROBLOX_OAUTH_CLIENT_ID,clientSecret=process.env.ROBLOX_OAUTH_CLIENT_SECRET,origin=process.env.NEXT_PUBLIC_RSGP_ORIGIN;
 if(!clientId||!clientSecret||!origin)throw new HttpError(503,"Roblox OAuth app is not configured");
 const url=new URL(origin);
 if(url.origin!==origin||url.protocol!=="https:")throw new HttpError(503,"RSGP requires an exact HTTPS origin for Roblox OAuth");
 return {clientId,clientSecret,origin,redirectUri:origin+"/api/roblox/callback"};
}
export function createAuthorization(){
 const config=oauthConfig(),state=randomBytes(32).toString("base64url"),verifier=randomBytes(32).toString("base64url");
 const challenge=createHash("sha256").update(verifier).digest("base64url");
 const url=new URL(OAUTH+"/authorize");
 for(const [name,value] of Object.entries({
  client_id:config.clientId,redirect_uri:config.redirectUri,scope:"openid profile asset:read asset:write",
  response_type:"code",prompt:"login consent",state,code_challenge:challenge,code_challenge_method:"S256",
 }))url.searchParams.set(name,value);
 return {url:url.toString(),state,verifier};
}
async function exchange(params:Record<string,string>):Promise<Tokens>{
 const {clientId,clientSecret}=oauthConfig();
 const response=await fetch(OAUTH+"/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...params}),
  signal:AbortSignal.timeout(13000),
 });
 if(!response.ok)throw new Error("Roblox token exchange failed");
 const token=await response.json();
 if(typeof token.access_token!=="string"||typeof token.refresh_token!=="string"||
  typeof token.expires_in!=="number"||token.expires_in<60)throw new Error("Incomplete Roblox authorization");
 return token as Tokens;
}
export function redeemCode(code:string,verifier:string){
 return exchange({grant_type:"authorization_code",code,code_verifier:verifier,redirect_uri:oauthConfig().redirectUri});
}
export function refreshTokens(refreshToken:string){
 return exchange({grant_type:"refresh_token",refresh_token:refreshToken});
}
export async function robloxIdentity(accessToken:string){
 const response=await fetch(OAUTH+"/userinfo",{
  headers:{Authorization:"Bearer "+accessToken},signal:AbortSignal.timeout(10000),
 });
 if(!response.ok)throw new Error("Could not verify Roblox identity");
 const user=await response.json();
 if(typeof user.sub!=="string"||! /^[1-9][0-9]{0,19}$/.test(user.sub))throw new Error("Invalid Roblox user ID");
 return {id:user.sub,name:typeof user.preferred_username==="string"?user.preferred_username:null};
}
export async function connectedRobloxAccess(ownerId:string){
 const db=admin();
 const {data:row,error}=await db.from("roblox_connections")
  .select("access_cipher,refresh_cipher,access_expires_at,status,refresh_claimed_at,roblox_user_id,updated_at")
  .eq("owner_id",ownerId).maybeSingle();
 if(error)throw error;
 if(!row||row.status==="needs_reconnect")throw new HttpError(409,"Connect your Roblox account to publish assets");
 if(row.status==="refreshing")throw new HttpError(409,"Roblox authorization is refreshing; check again");
 if(Date.parse(row.access_expires_at)-Date.now()>90000)
  return {accessToken:unseal(row.access_cipher),robloxUserId:row.roblox_user_id as string};

 // Claim refresh once. Roblox refresh tokens are one-use: on an uncertain response, require reconnect.
 const started=new Date().toISOString();
 const {data:claim,error:claimError}=await db.from("roblox_connections")
  .update({status:"refreshing",refresh_claimed_at:started})
  .eq("owner_id",ownerId).eq("status","connected").eq("updated_at",row.updated_at)
  .select("owner_id").maybeSingle();
 if(claimError)throw claimError;
 if(!claim)throw new HttpError(409,"Roblox authorization changed; check again");
 try{
  const tokens=await refreshTokens(unseal(row.refresh_cipher));
  const {data:saved,error:saveError}=await db.from("roblox_connections").update({
   access_cipher:seal(tokens.access_token),refresh_cipher:seal(tokens.refresh_token),
   access_expires_at:new Date(Date.now()+tokens.expires_in*1000).toISOString(),
   status:"connected",refresh_claimed_at:null,updated_at:new Date().toISOString(),
  }).eq("owner_id",ownerId).eq("status","refreshing").eq("refresh_claimed_at",started).select("owner_id").maybeSingle();
  if(saveError||!saved)throw new Error("Could not persist refreshed Roblox authorization");
  return {accessToken:tokens.access_token,robloxUserId:row.roblox_user_id as string};
 }catch{
  await db.from("roblox_connections").update({status:"needs_reconnect"})
   .eq("owner_id",ownerId).eq("status","refreshing").eq("refresh_claimed_at",started);
  throw new HttpError(409,"Roblox authorization needs to be reconnected");
 }
}
