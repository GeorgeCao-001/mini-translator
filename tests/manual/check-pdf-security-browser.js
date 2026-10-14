"use strict";

// Optional genuine browser render/Worker check; needs an existing Chromium,
// no dependencies, no translation API, no credentials or personal profile.
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { makePdfSecurityFixture } = require("../helpers/pdf-security-fixtures.js");
const { runChromiumPage } = require("../helpers/chromium-page.js");
const root = path.resolve(__dirname, "../..");
const browser = process.argv[2];
if (!browser || !fs.existsSync(browser)) throw new Error("Provide an existing Chrome/Edge executable.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mini-translator-pdf-security-"));
const fixtures = [false, true].map((bad) => Array.from(makePdfSecurityFixture(bad)));
(async () => {
for (const blocked of [false, true]) {
  const page = path.join(directory, blocked ? "fallback.html" : "worker.html");
  fs.writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="result">pending</pre>
<script>
window.module={exports:{}};window.exports=window.module.exports;
window.require=function(name){
 if(name!=="obsidian")throw new Error("Unexpected module: "+name);
 return new Proxy({}, {get:function(){return class MockComponent{};}});
};
window.__dynamicCalls=0;window.__workerCount=0;
window.__errors=[];window.addEventListener("error",function(e){window.__errors.push(e.message||e.target.src);},true);
var NativeFunction=window.Function;
window.Function=function(){window.__dynamicCalls++;throw new Error("Generated code forbidden");};
window.Function.prototype=NativeFunction.prototype;
window.eval=function(){window.__dynamicCalls++;throw new Error("Evaluated code forbidden");};
var NativeBlob=window.Blob;
window.Blob=class GuardedWorkerBlob extends NativeBlob {
 constructor(parts,options){
  var guard="var nativeFunction=globalThis.Function;globalThis.Function=function(){self.postMessage({__pdfSecurityDynamic:true});throw new Error('Worker generated code forbidden');};globalThis.Function.prototype=nativeFunction.prototype;globalThis.eval=function(){self.postMessage({__pdfSecurityDynamic:true});throw new Error('Worker evaluated code forbidden');};";
  super(options&&options.type==="application/javascript"?[guard].concat(parts):parts,options);
 }
};
var NativeWorker=window.Worker;
window.Worker=class TestWorker extends NativeWorker {
 constructor(url,options){
  if(${blocked})throw new Error("Test deliberately blocks Workers");
  window.__workerCount++;super(url,options);
  this.addEventListener("message",function(e){if(e.data&&e.data.__pdfSecurityDynamic){window.__dynamicCalls++;e.stopImmediatePropagation();}});
 }
};
window.fetch=function(){throw new Error("External network forbidden");};
</script>
<script src="${pathToFileURL(path.join(root, "dist/main.js")).href}"></script>
<script>
(async function(){
 try {
  var lib=loadPdfJs({register:function(){}}), results=[];
  for(var data of ${JSON.stringify(fixtures)}){
   var task=lib.getDocument({data:new Uint8Array(data),isEvalSupported:true});
   var pdf=await task.promise,page=await pdf.getPage(1),text=await page.getTextContent();
   var viewport=page.getViewport({scale:0.5}),canvas=document.createElement("canvas");
   canvas.width=viewport.width;canvas.height=viewport.height;
   var ctx=canvas.getContext("2d");
   await page.render({canvasContext:ctx,viewport:viewport}).promise;
   var pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data, colored=0;
   for(var i=0;i<pixels.length;i+=4)if(pixels[i]<240||pixels[i+1]<240||pixels[i+2]<240)colored++;
   results.push({text:text.items.map(function(x){return x.str;}).join(" "),colored:colored});
   await pdf.destroy();
  }
  document.getElementById("result").textContent=JSON.stringify({ok:true,results:results,
   workers:window.__workerCount,fallback:!!window.pdfjsWorker,dynamic:window.__dynamicCalls,
   injected:window.__pdfInjected||0});
 }catch(e){document.getElementById("result").textContent=JSON.stringify({ok:false,error:String(e),stack:e.stack,errors:window.__errors});}
})();
</script></body></html>`, "utf8");
  const run = await runChromiumPage(browser, pathToFileURL(page).href,
    path.join(directory, blocked ? "fallback-profile" : "worker-profile"));
  fs.writeFileSync(path.join(directory, blocked ? "fallback-output.txt" : "worker-output.txt"),
    run.value + "\n" + (run.stderr || ""), "utf8");
  const result = JSON.parse(run.value);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.dynamic, 0);
  assert.equal(result.injected, 0);
  for (const sample of result.results) {
    assert.equal(sample.text, "Hello Mini Translator");
    assert.ok(sample.colored > 1000, "PDF vector/shading render is unexpectedly empty");
  }
  assert.equal(result.fallback, blocked);
  assert.equal(result.workers > 0, !blocked);
  console.log(`PASS genuine Chromium PDF text/vector/PostScript render (${blocked ? "blocked Worker fallback" : "Blob Worker"}); malformed font matrix inert; no dynamic code`);
}
console.log("PASS 4 browser PDF render cases; logs: " + directory);
})().catch((error) => { console.error(error); process.exitCode = 1; });
