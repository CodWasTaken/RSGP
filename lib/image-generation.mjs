export const IMAGE_KINDS = Object.freeze(["icon","thumbnail","texture","gui"]);
const SAFE_TEXT = /[\p{L}\p{N}]/u;
export function imageInput(raw) {
 if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Invalid image request");
 const {prompt,kind,requestId}=raw;
 if (typeof prompt !== "string" || prompt.trim().length < 8 || prompt.length > 900 || !SAFE_TEXT.test(prompt)) throw Error("Describe the asset in 8–900 characters");
 if (!IMAGE_KINDS.includes(kind)) throw Error("Choose icon, thumbnail, texture, or gui");
 if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw Error("Invalid image request ID");
 return {prompt:prompt.trim(),kind,requestId:requestId.toLowerCase()};
}
export function promptForImage(kind,description) {
 const directions = {
  icon:"Create a polished square Roblox game icon or inventory icon. Make the subject clear, recognizable, and visually readable at a small size.",
  thumbnail:"Create a vibrant landscape Roblox game thumbnail suitable for a game discovery card. Strong central subject; avoid tiny illegible lettering.",
  texture:"Create a seamless, repeatable square game texture. Even lighting, straight-on surface, no perspective, no text or watermark.",
  gui:"Create one polished, game-ready 2D Roblox interface art element with clear silhouette and space for separately rendered native GUI text."
 };
 if(!IMAGE_KINDS.includes(kind))throw Error("Unsupported image type");
 return directions[kind]+" Visual direction: "+description;
}
export function pngBytes(base64,maxBytes=12582912) {
 if(typeof base64!=="string" || base64.length<32 || base64.length>Math.ceil(maxBytes/3)*4+4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw Error("Invalid image data");
 const bytes=Buffer.from(base64,"base64");
 if(bytes.length<24 || bytes.length>maxBytes || bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a" || bytes.toString("ascii",12,16)!=="IHDR") throw Error("Invalid PNG artifact");
 return bytes;
}
