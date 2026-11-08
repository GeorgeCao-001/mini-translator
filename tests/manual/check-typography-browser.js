"use strict";
// Isolated generated fixture, not live Obsidian or a recording. No screenshots,
// translation requests, real data.json, personal profiles or downloaded fonts.
const fs = require("fs"), path = require("path"), os = require("os"), assert = require("assert/strict");
const { pathToFileURL } = require("url");
const root = path.resolve(__dirname, "../..");
const { runChromiumPage } = require(path.join(root, "tests/helpers/chromium-page.js"));
const browser = process.argv[2];
if (!browser || !fs.existsSync(browser)) throw Error("Provide existing Chrome; nothing is installed.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mini-typography-layout-"));
(async () => {
  for (const locale of ["zh-CN", "en"]) for (const theme of ["light", "dark"]) for (const width of [1200, 390]) {
    const file = path.join(directory, locale + "-" + theme + "-" + width + ".html");
    const style = pathToFileURL(path.join(root, "styles.css")).href;
    const bundle = pathToFileURL(path.join(root, "dist/main.js")).href;
    const html = [
      '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="' + style + '">',
      '<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;--font-interface:Arial;--font-text:Arial;--font-smaller:14px;--font-text-size:16px;--font-ui-small:13px;--background-primary:#fff;--background-secondary:#eee;--background-modifier-border:#ccc;--text-normal:#222;--text-muted:#777;--text-faint:#888;--text-error:#b33;--text-on-accent:#fff;--interactive-accent:#8050ee}.fixture-modal{position:fixed;inset:0;display:flex;justify-content:center;align-items:center;background:#ffffffdd;z-index:2000}.modal{background:var(--background-primary);padding:16px;border:1px solid #ccc;overflow:auto}.modal-content{min-width:0}button,input,select{font:inherit}button{padding:5px 10px}#sidebar{max-width:340px}</style>',
      '<style>body.dark{--background-primary:#202020;--background-secondary:#262626;--background-modifier-border:#3d3d3d;--text-normal:#e4e4e4;--text-muted:#a3a3a3;--text-faint:#777;--interactive-accent:#ab94f9;--text-on-accent:#202020}body{background:var(--background-primary);color:var(--text-normal)}</style>',
      '<div id="sidebar"></div><pre id="result" hidden>pending</pre><script>',
      "HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);e.className=o.cls||'';if(o.text)e.textContent=o.text;if(o.type)e.type=o.type;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.appendChild(e);return e};",
      "HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};HTMLElement.prototype.setText=function(s){this.textContent=s};HTMLElement.prototype.addClass=function(c){this.classList.add(c)};HTMLElement.prototype.empty=function(){this.replaceChildren()};HTMLElement.prototype.appendText=function(s){this.append(document.createTextNode(s))};",
      "class FakeModal{constructor(app){this.app=app;this.host=document.body.createDiv({cls:'fixture-modal'});this.host.hidden=true;this.modalEl=this.host.createDiv({cls:'modal'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'})}open(){this.host.hidden=false;this.host.style.display='flex';this.onOpen?.()}close(){this.onClose?.();this.host.remove()}};",
      "window.module={exports:{}};window.require=name=>{if(name!=='obsidian')throw Error('Unexpected import '+name);return new Proxy({}, {get:(_,key)=>{if(key==='Modal')return FakeModal;if(key==='requestUrl')return ()=>{throw Error('No network')};if(key==='setIcon'||key==='finishRenderMath')return ()=>{};if(key==='renderMath')return (src)=>{const e=document.createElement('span');e.setAttribute('jax','test');e.textContent=src;return e};return class {}}})};",
      '</script><script src="' + bundle + '"></script><script>',
      "(async()=>{try{",
      "document.body.classList.add(" + JSON.stringify(theme) + ");setUiLanguage(" + JSON.stringify(locale) + ");",
      "const p=new module.exports();p.settings={popupSourceFontSize:14,popupTargetFontSize:18,popupFontFollowResize:true,sourceLanguage:'en',targetLanguage:'zh-Hans',primarySource:'Do not change',popupLastFontScale:1.5};let saves=0;p.saveData=async()=>{saves++};p.panelView={flowEl:document.getElementById('sidebar')};",
      "const source='Source paragraph $E=mc^2$.\\n\\nAnother source paragraph.',target='第一自然段。\\n\\n第二自然段。';",
      "const pairs=[{en:source,zh:target,sourceLanguage:'en',targetLanguage:'zh-Hans'}];renderPairsTo(p.panelView.flowEl,pairs);",
      "p.showPopup('',20,120,null,false,{left:20,top:90,right:250,bottom:115});p._popupFontScale=1.5;p.popupLockBtn.click();p.showPopupSources([{en:source,waiting:false}]);p.updatePopupTranslation(0,pairs[0],'offline');const shell=p.popupEl,body=p.popupBodyEl,line=p._popupSlots[0].zhEl,original=p.lastPopupText;",
      "TYPOGRAPHY.updateTypography(p.settings,'popup','target',{fontSize:24,lineHeight:2,letterSpacing:1,wordSpacing:3,paragraphSpacing:26,spaceAfter:15,firstLineIndent:1.5,alignment:'center',weight:'600',fontStyle:'italic',decoration:'underline',color:'#123456',background:'#eeeeff',opacity:0.8});",
      "TYPOGRAPHY.updateTypography(p.settings,'sidebar','target',{fontSize:19,lineHeight:1.6});p.refreshTypography();",
      "const cs=getComputedStyle(line),sideLine=p.panelView.flowEl.querySelector('.mini-target-line'),ss=getComputedStyle(sideLine);const para=line.children[1];",
      "const actualStyles=cs.fontSize==='36px'&&cs.lineHeight==='72px'&&cs.letterSpacing==='1px'&&cs.wordSpacing==='3px'&&cs.textAlign==='center'&&cs.fontWeight==='600'&&cs.fontStyle==='italic'&&cs.textDecorationLine==='underline'&&cs.color==='rgb(18, 52, 86)'&&cs.backgroundColor==='rgb(238, 238, 255)'&&cs.opacity==='0.8';",
      "const separate=ss.fontSize==='19px'&&Math.abs(parseFloat(ss.lineHeight)-30.4)<0.1;const paragraphSpacing=getComputedStyle(para).marginBlockStart==='26px';const indent=getComputedStyle(para,'::before').inlineSize==='54px';",
      "const math=getComputedStyle(p.popupBodyEl.querySelector('[jax]'));const mathSpacing=['normal','0px'].includes(math.letterSpacing)&&['normal','0px'].includes(math.wordSpacing);",
      "const m=new TypographyModal({},p);m.open();await new Promise(r=>requestAnimationFrame(r));",
      "const field=(role,key)=>[...m.contentEl.querySelectorAll('.mini-typography-field')].find(e=>e.dataset.role===role&&e.dataset.field===key);",
      "const preview=m.previewEl,previewChild=preview.firstElementChild;const input=field('target','lineHeight').querySelector('input'),controlFont=getComputedStyle(field('target','lineHeight').querySelector('input')).fontSize;input.value='1.8';input.dispatchEvent(new Event('change'));await m.queue;",
      "const stable=m.previewEl===preview&&m.previewEl.firstElementChild===previewChild&&field('target','lineHeight').querySelector('input')===input;const live=p.settings.typography.popup.target.lineHeight===1.8&&getComputedStyle(line).lineHeight==='64.8px'&&p.popupEl===shell&&p.popupBodyEl===body&&p.lastPopupText===original&&p._popupLocked;",
      "const findButton=text=>[...m.contentEl.querySelectorAll('button')].find(b=>b.textContent===text);findButton(t('typography.sync_to',{target:t('typography.sidebar')})).click();await m.queue;",
      "const synced=getComputedStyle(sideLine).fontSize==='24px'&&p.settings.popupLastFontScale===1.5&&p.settings.primarySource==='Do not change';",
      "findButton(t('typography.sidebar')).click();const sideInput=field('target','fontSize').querySelector('input');sideInput.value='22';sideInput.dispatchEvent(new Event('change'));await m.queue;const independent=getComputedStyle(sideLine).fontSize==='22px'&&getComputedStyle(line).fontSize==='36px';",
      "const frame=()=>new Promise(r=>requestAnimationFrame(r));",
      "const more=m.editor.querySelector('.mini-typography-section-more'),common=m.editor.querySelector('.mini-typography-section-common');",
      "const previewBounds=m.previewPane.getBoundingClientRect();const toggled=new Promise(resolve=>more.addEventListener('toggle',resolve,{once:true}));more.open=true;await toggled;await frame();",
      "const disclosure=more.open&&common.open&&field('target','opacity').querySelector('input').getClientRects().length>0&&field('target','lineHeight').querySelector('input').getClientRects().length>0;",
      "const formFlow=innerWidth>760||m.editor.scrollHeight<=m.editor.clientHeight+1;",
      "const changeSection=async(section,open)=>{const toggled=new Promise(resolve=>section.addEventListener('toggle',resolve,{once:true}));section.open=open;await toggled;await frame()};",
      "await changeSection(common,false);const commonIndependent=!common.open&&more.open;await changeSection(common,true);",
      "await changeSection(more,false);const moreIndependent=common.open&&!more.open;await changeSection(more,true);",
      "const bothExpanded=common.open&&more.open;",
      "const percent=field('target','opacity').querySelector('input');percent.value='85';percent.dispatchEvent(new Event('change'));await m.queue;",
      "const opacityPercent=p.settings.typography.sidebar.target.opacity===0.85;",
      "m.roleTabs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));await frame();",
      "const keyboard=m.role==='source'&&document.activeElement===m.roleTabs[0];",
      "m.roleTabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));await frame();",
      "const roleIsolation=m.role==='target'&&field('target','opacity').querySelector('input').value==='85';",
      "const commonAgain=m.editor.querySelector('.mini-typography-section-common');commonAgain.open=true;await frame();",
      "m.editor.querySelector('[aria-label=\"'+t('typography.inherit_emphasis')+'\"]').click();await m.queue;const italic=field('target','fontStyle').querySelector('button');italic.click();await m.queue;",
      "const emphasis=p.settings.typography.sidebar.target.fontStyle==='italic'&&italic.getAttribute('aria-pressed')==='true';",
      "m.editor.querySelector('[aria-label=\"'+t('typography.inherit_emphasis')+'\"]').click();await m.queue;",
      "const emphasisDefaults=p.settings.typography.sidebar.target.fontStyle==='auto'&&p.settings.typography.sidebar.target.decoration==='auto';",
      "p.saveData=async()=>{throw Error('isolated expected save failure')};const changeInput=field('target','fontSize').querySelector('input');changeInput.value='25';changeInput.dispatchEvent(new Event('change'));await m.queue.catch(()=>{});",
      "const retryVisible=!m.retry.hidden&&m.status.textContent.includes('isolated expected save failure');",
      "p.saveData=async()=>{saves++};m.retry.click();await m.queue;",
      "const retryRecovered=m.retry.hidden&&m.status.dataset.state==='saved';",
      "m.tabs[0].click();const follow=m.editor.querySelector('input[type=checkbox]');follow.checked=false;follow.dispatchEvent(new Event('change'));await m.queue;",
      "const resizePolicy=!p.settings.popupFontFollowResize&&p.settings.popupLastFontScale===1&&p._popupFontScale===1&&p._popupLocked;",
      "m.tabs[1].click();await frame();",
      "const viewportFixed=m.previewPane.getBoundingClientRect().left===previewBounds.left;",
      "const rect=m.modalEl.getBoundingClientRect();const fields=[...m.contentEl.querySelectorAll('.mini-typography-field')];const reachable=rect.left>=0&&rect.right<=innerWidth+1&&m.modalEl.scrollWidth<=m.modalEl.clientWidth+1&&fields.length===15;",
      "const labelled=fields.every(f=>{const label=f.querySelector('label');return !!document.getElementById(label.htmlFor)});",
      "const uiUnchanged=controlFont==='13px';const nativeNumbers=fields.filter(f=>f.querySelector('input[type=number]')).length===8;",
      "findButton(t('typography.reset')).click();await m.queue;const reset=getComputedStyle(sideLine).fontSize==='16px'&&p.settings.popupTargetFontSize===24;",
      "const footer=m.contentEl.querySelector('.mini-typography-footer').getBoundingClientRect(),previewRect=m.previewPane.getBoundingClientRect(),editorRect=m.editor.getBoundingClientRect();const fixedFooter=footer.bottom<=innerHeight&&footer.top>=0;const layout=innerWidth>760?previewRect.left>=editorRect.right-1:previewRect.top>=editorRect.bottom-1;const data={commonIndependent,moreIndependent,bothExpanded,formFlow,disclosure,opacityPercent,keyboard,roleIsolation,emphasis,emphasisDefaults,retryVisible,retryRecovered,resizePolicy,viewportFixed,stable,fixedFooter,layout,actualStyles,separate,paragraphSpacing,indent,mathSpacing,live,synced,independent,reachable,labelled,uiUnchanged,nativeNumbers,reset,saved:saves>0,locale:getUiLanguage()===" + JSON.stringify(locale) + "};m.close();p.closePopup();document.getElementById('result').textContent=JSON.stringify(data);",
      "}catch(e){document.getElementById('result').textContent=JSON.stringify({error:e.stack||String(e)})}})();</script>",
    ].join("\n");
    fs.writeFileSync(file, html, "utf8");
    const result = JSON.parse((await runChromiumPage(browser, pathToFileURL(file).href,
      fs.mkdtempSync(path.join(directory, "profile-")), { width, height: 900 })).value);
    assert.ok(!result.error, JSON.stringify(result));
    for (const [key, value] of Object.entries(result)) assert.equal(value, true, locale + " " + theme + " " + width + "px " + key + ": " + JSON.stringify(result));
    console.log("PASS isolated advanced typography " + locale + " " + theme + " " + width + "px: actual CSS, paragraphs, math spacing, independent live styles, copy/reset, controls and layout");
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
