"use strict";
// Isolated headless layout test, NOT an Obsidian recording. No screenshots or network.
const fs = require("fs"), path = require("path"), os = require("os"), assert = require("assert/strict");
const { pathToFileURL } = require("url");
const root = path.resolve(__dirname, "../..");
const { runChromiumPage } = require(path.join(root, "tests/helpers/chromium-page.js"));
const i18n = require(path.join(root, "src/i18n.js"));
const browser = process.argv[2];
if (!browser || !fs.existsSync(browser)) throw Error("Provide an existing Chrome executable; nothing is installed.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mini-pdf-picker-layout-"));
const keys = fs.readFileSync(path.join(root, "src/pdf-file-picker.js"), "utf8").matchAll(/\bt\("([^"]+)"/g);
const names = [...new Set([...keys].map(m => m[1]))];
(async () => {
  for (const locale of ["zh-CN", "en"]) for (const width of [1100, 480]) {
    i18n.setUiLanguage(locale);
    const messages = Object.fromEntries(names.map(k => [k, i18n.t(k)]));
    const file = path.join(directory, `${locale}-${width}.html`);
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, "styles.css")).href}">
<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui;--font-ui-small:14px;--font-smallest:12px;--font-smaller:13px;--font-semibold:600;--background-primary:#fff;--background-secondary:#eee;--background-modifier-border:#ccc;--text-normal:#222;--text-muted:#777;--text-faint:#888;--text-error:#c44}.modal{margin:25px auto;padding:18px;border:1px solid #ccc}.modal-content{overflow:auto}button,input{font:inherit}button{padding:5px 8px}input{max-width:100%}</style>
<div class="modal mini-pdf-picker-modal"><div class="modal-content mini-pdf-picker-content" id="host"><h3>PDF selection</h3></div></div><pre id="result" hidden>pending</pre>
<script>window.module={exports:{}};HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);e.className=o.cls||'';if(o.text)e.textContent=o.text;if(o.type)e.type=o.type;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.appendChild(e);return e;};HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};HTMLElement.prototype.setText=function(s){this.textContent=s};HTMLElement.prototype.toggleClass=function(c,on){this.classList.toggle(c,on)};</script>
<script src="${pathToFileURL(path.join(root, "src/pdf-file-picker.js")).href}"></script><script>
(async()=>{try{
 const messages=${JSON.stringify(messages)};const t=(k,p={})=>(messages[k]||k).replace(/\\{(\\w+)\\}/g,(_,n)=>p[n]??'{'+n+'}');
 const files=Array.from({length:120},(_,i)=>({path:'papers/paper-'+String(i).padStart(3,'0')+'.pdf',name:'paper-'+String(i).padStart(3,'0')+'.pdf'}));
 const state={};const c=module.exports.createPdfFilePicker(document.getElementById('host'),{files,t,state});
 const visible=e=>getComputedStyle(e).display!=='none'&&e.getClientRects().length>0;
 const fileCount=()=>[...c.rows.values()].filter(r=>visible(r.el)).length;
 const collapsed=fileCount()===0;
 c.dirs.get('papers').toggle.click();c.list.scrollTop=700;const scroll=c.list.scrollTop;
 const row=c.rows.get('papers/paper-030.pdf');row.name.click();const input=c.basketRows.get('papers/paper-030.pdf').range;
 input.focus();input.value='2-3, 7';input.setSelectionRange(2,2);input.dispatchEvent(new Event('input'));
 c.updateFile('papers/paper-030.pdf',{text:'Selected 3/100 pages · 32 blocks · 5400 tokens'});
 c.rows.get('papers/paper-031.pdf').name.click();
 c.setSummary('2 files selected · 8400 tokens',true);
 await new Promise(r=>requestAnimationFrame(r));
 const start=c.start.getBoundingClientRect(),box=c.el.getBoundingClientRect();
 const retainedScroll=c.list.scrollTop===scroll,retainedCaret=input.selectionStart===2,retainedIdentity=c.rows.get('papers/paper-030.pdf')===row&&c.basketRows.get('papers/paper-030.pdf').range===input;
 const expanded=fileCount()===120;
 const only=c.el.querySelector('.mini-pdf-only input');only.checked=true;only.dispatchEvent(new Event('change'));
 const filtered=fileCount()===2&&[...c.dirs.values()].every(r=>!visible(r.el));
 c.search.value='031';c.search.dispatchEvent(new Event('input'));const intersection=fileCount()===1;
 c.search.value='';c.search.dispatchEvent(new Event('input'));
 c.rows.get('papers/paper-030.pdf').name.click();const removed=fileCount()===1;
 c.rows.get('papers/paper-031.pdf').name.click();const emptyFiltered=fileCount()===0;
 only.checked=false;only.dispatchEvent(new Event('change'));c.dirs.get('papers').toggle.click();
 const recollapsed=fileCount()===0;
 c.dirs.get('papers').toggle.click();c.rows.get('papers/paper-030.pdf').name.click();c.rows.get('papers/paper-031.pdf').name.click();
 document.getElementById('result').textContent=JSON.stringify({stable:retainedIdentity,scroll:retainedScroll,caret:retainedCaret,collapsed,expanded,filtered,intersection,removed,emptyFiltered,recollapsed,footer:start.bottom<=innerHeight&&start.right<=innerWidth,overflow:document.documentElement.scrollWidth<=innerWidth,wide:box.width,selected:c.selected.size});
 c.destroy();
}catch(e){document.getElementById('result').textContent=JSON.stringify({error:String(e)});}})();</script>`, "utf8");
    const rendered = await runChromiumPage(browser, pathToFileURL(file).href,
      fs.mkdtempSync(path.join(directory, "profile-")), { width, height: 900 });
    const result = JSON.parse(rendered.value);
    assert.ok(!result.error, JSON.stringify(result));
    for (const key of ["stable", "scroll", "caret", "collapsed", "expanded", "filtered", "intersection", "removed", "emptyFiltered", "recollapsed", "footer", "overflow"]) assert.equal(result[key], true, `${locale} ${width}px ${key}: ${JSON.stringify(result)}`);
    assert.equal(result.selected, 2);
    console.log(`PASS headless isolated picker ${locale} ${width}px: computed visibility for collapse/expand/selected-only/search/removal, stable scroll/inputs, footer visible`);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
