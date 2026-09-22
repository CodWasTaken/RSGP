import test from "node:test";
import assert from "node:assert/strict";
import {imageInput,promptForImage,pngBytes} from "../lib/image-generation.mjs";
const good={kind:"icon",prompt:"A crystalline blue compass emblem",requestId:"123e4567-e89b-42d3-a456-426614174000"};
test("image requests require a bounded prompt, kind and stable UUID",()=>{
 assert.equal(imageInput(good).kind,"icon");
 assert.throws(()=>imageInput({...good,prompt:"short"}));
 assert.throws(()=>imageInput({...good,kind:"video"}));
 assert.throws(()=>imageInput({...good,requestId:"unsafe/filename"}));
});
test("type prompts emphasize intended asset usage",()=>{
 assert.match(promptForImage("texture","mossy stone"),/seamless/);
 assert.match(promptForImage("gui","blue fantasy"),/native GUI text/);
});
test("rejects non-PNG, malformed and oversized provider outputs",()=>{
 assert.throws(()=>pngBytes(Buffer.from("not an image").toString("base64")));
 assert.throws(()=>pngBytes("invalid!!!"));
 const png=Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),Buffer.from([0,0,0,13]),Buffer.from("IHDR"),Buffer.alloc(12)]);
 assert.equal(pngBytes(png.toString("base64")).length,png.length);
 assert.throws(()=>pngBytes(png.toString("base64"),16));
});
