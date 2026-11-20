"use strict";
// Real DOM/CSS in an isolated headless profile. No live Vault, translation APIs or screenshots.
const fs = require("fs"), path = require("path"), os = require("os"), assert = require("assert/strict");
const { pathToFileURL } = require("url");
const root = path.resolve(__dirname, "../..");
const { runChromiumPage } = require(path.join(root, "tests/helpers/chromium-page.js"));
const browser = process.argv[2];
if (!browser || !fs.existsSync(browser)) throw Error("Provide an existing Chrome executable; nothing is installed.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mini-popup-reuse-layout-"));
(async () => {
  for (const locale of ["zh-CN", "en"]) for (const width of [1400, 560]) {
    const file = path.join(directory, `${locale}-${width}.html`);
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(path.join(root, "styles.css")).href}">
<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui;--font-smaller:14px;--font-text-size:16px;--background-primary:#fff;--background-secondary:#eee;--background-modifier-border:#ccc;--text-normal:#222;--text-muted:#777;--interactive-accent:#8050ee}button{font:inherit}</style>
<pre id="result" hidden>pending</pre>
<script>
window.module={exports:{}};
window.require=name=>{if(name!=="obsidian")throw Error("Unexpected import "+name);return new Proxy({}, {get:(_,k)=>{
 if(k==="setIcon")return (el,icon)=>el.setAttribute("data-icon",icon);
 if(k==="requestUrl")return ()=>{throw Error("No network allowed")};
 if(k==="getLanguage")return ()=>${JSON.stringify(locale)};
 return class {};
}})};
HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);e.className=o.cls||'';if(o.text)e.textContent=o.text;this.appendChild(e);return e;};
HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};
HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
HTMLElement.prototype.setText=function(s){this.textContent=s};
HTMLElement.prototype.addClass=function(c){this.classList.add(c)};
HTMLElement.prototype.empty=function(){this.replaceChildren()};
HTMLElement.prototype.appendText=function(s){this.append(document.createTextNode(s))};
</script>
<script src="${pathToFileURL(path.join(root, "dist/main.js")).href}"></script>
<script>
(async()=>{try{
 setUiLanguage(${JSON.stringify(locale)});
 const p=new module.exports();p.settings={sourceLanguage:'en',targetLanguage:'zh-Hans',popupMaxSize:'standard',rememberPopupSize:true};
 let saves=0;p.saveData=async()=>{saves++};
 const wait=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const rect=()=>{const r=p.popupEl.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}};
 const same=(a,b)=>Object.keys(a).every(k=>Math.abs(a[k]-b[k])<0.6);
 const anchor={left:25,top:170,right:240,bottom:200},far={left:innerWidth-180,top:20,right:innerWidth-25,bottom:40};
 const source='Reading scientific papers with a bilingual translation popup. '.repeat(6);
 p.showPopup(source,anchor.left,anchor.bottom+6,null,false,anchor);
 p.showPopupSources([{en:source,waiting:false}]);p.updatePopupTranslation(0,{en:source,zh:'在笔记中阅读与翻译论文。'.repeat(15)},'offline');
 await wait();const initial=rect(),el=p.popupEl,body=p.popupBodyEl,header=p.popupHeaderEl,control=p.popupLockBtn;
 control.click();
 const replace=text=>{p.showPopup(text,far.left,far.bottom+6,null,false,far);p.showPopupSources([{en:text,waiting:true}]);p.updatePopupTranslation(0,{en:text,zh:'新的译文。'.repeat(300)},'offline')};
 replace('Long replacement selection. '.repeat(150));await wait();
 const longStable=same(initial,rect()),identical=p.popupEl===el&&p.popupBodyEl===body&&p.popupHeaderEl===header&&p.popupLockBtn===control;
 const scrolls=body.scrollHeight>body.clientHeight&&getComputedStyle(body).overflowY==='auto';
 const locked=p._popupLocked&&control.getAttribute('aria-pressed')==='true';
 const localized=getUiLanguage()===${JSON.stringify(locale)}&&control.title===t('translation.unlock_popup');
 replace('Short source.');await wait();const shortStable=same(initial,rect());
 const headerRect=header.getBoundingClientRect(),buttonRect=control.getBoundingClientRect();
 const reachable=buttonRect.left>=headerRect.left&&buttonRect.right<=headerRect.right&&buttonRect.height>0;
 const notSaved=saves===0&&p.settings.popupLastSize==null;
 header.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:60,clientY:220,bubbles:true}));
 document.dispatchEvent(new MouseEvent('mousemove',{clientX:90,clientY:250,bubbles:true}));
 document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
 const dragged=rect();replace('After dragging.');await wait();const dragStable=same(dragged,rect());
 // A real viewport reduction must still keep the locked popup reachable.
 const oldWidth=window.innerWidth;Object.defineProperty(window,'innerWidth',{configurable:true,value:360});
 window.dispatchEvent(new Event('resize'));await wait();const clamped=p.popupEl.getBoundingClientRect();
 const viewportSafe=clamped.left>=7&&clamped.right<=353;
 Object.defineProperty(window,'innerWidth',{configurable:true,value:oldWidth});window.dispatchEvent(new Event('resize'));await wait();
 control.click();p.showPopup('Unlocked replacement',25,206,null,false,anchor);
 const unlockedReplacement=p.popupEl!==el&&!p._popupLocked&&!p._popupRetained;
 p.popupLockBtn.click();replace('Locked again.');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 const escapeCloses=p.popupEl===null&&!p._popupLocked;
 p.settings.history=Array.from({length:7},(_,i)=>({via:'offline',pairs:[{en:'History entry '+i+'.',zh:'以前的翻译 '+i+'。'}]}));
 p.openPopupHistory();await wait();
 const historyHeader=p.popupHeaderEl, get=which=>historyHeader.querySelector('.mini-popup-history-'+which);
 const historyReopens=p.lastPopupText==='以前的翻译 0。'&&historyHeader.querySelector('span').textContent.startsWith(t('popup_history.position',{index:1,count:5}));
 const controlWithin=button=>{const r=button.getBoundingClientRect(), h=historyHeader.getBoundingClientRect();return r.width>0&&r.left>=h.left&&r.right<=h.right};
 const historyReachable=['older','newer','current'].every(n=>controlWithin(get(n)));
 for(let i=0;i<7;i++)get('older').click();await wait();
 const historyLimit=get('older').disabled&&p.lastPopupText==='以前的翻译 4。';
 get('current').click();const newest=p.lastPopupText==='以前的翻译 0。';
 p.closePopup();
 p.showPopup('',25,206,null,false,anchor);
 const live=[{en:'Current source.',zh:'当前译文。'}];p.updatePopupPairs(live,'offline');
 p._popupTranslationDone=true;p._popupCurrentPairs=live;p.refreshPopupHistoryControls();
 const liveNode=p.popupBodyEl.querySelector('.mini-target-line');
 const group=p.popupHeaderEl.querySelector('.mini-popup-history-controls');
 const back=group.querySelector('.mini-popup-history-current');
 const up=group.querySelector('.mini-popup-history-older');
 const down=group.querySelector('.mini-popup-history-newer');
 const slots=()=>[up,down].map(b=>b.getBoundingClientRect().left-group.getBoundingClientRect().left);
 const beforeSlots=slots();
 const currentHidden=getComputedStyle(back).display==='none';
 up.click();await wait();
 const backIsLeft=back.getBoundingClientRect().right<=up.getBoundingClientRect().left;
 const duringSlots=slots();
 back.click();await wait();
 const afterSlots=slots();
 const stableSlots=beforeSlots.every((x,i)=>Math.abs(x-duringSlots[i])<0.5&&Math.abs(x-afterSlots[i])<0.5);
 const currentRestored=p.lastPopupText==='当前译文。'&&p.popupBodyEl.querySelector('.mini-target-line')===liveNode;
 p.closePopup();
 document.getElementById('result').textContent=JSON.stringify({longStable,shortStable,identical,scrolls,locked,localized,reachable,notSaved,dragStable,viewportSafe,unlockedReplacement,escapeCloses,historyReopens,historyReachable,historyLimit,newest,currentHidden,backIsLeft,stableSlots,currentRestored});
}catch(e){document.getElementById('result').textContent=JSON.stringify({error:e.stack||String(e)})}})();
</script>`, "utf8");
    const result = JSON.parse((await runChromiumPage(browser, pathToFileURL(file).href,
      fs.mkdtempSync(path.join(directory, "profile-")), { width, height: 900 })).value);
    assert.ok(!result.error, JSON.stringify(result));
    for (const [name, value] of Object.entries(result)) assert.equal(value, true, `${locale} ${width}px ${name}: ${JSON.stringify(result)}`);
    console.log(`PASS isolated popup reuse ${locale} ${width}px: stable box/controls, scroll, drag, viewport clamp, unlock, Escape and bounded history`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
