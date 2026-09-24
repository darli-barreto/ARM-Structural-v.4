import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('test-results',{recursive:true});
async function pixels(name){
  const png=PNG.sync.read(await page.locator('#canvas-container canvas').screenshot({path:`test-results/${name}.png`}));
  const colors=new Set();for(let i=0;i<png.data.length;i+=16)colors.add(`${png.data[i]},${png.data[i+1]},${png.data[i+2]}`);assert.ok(colors.size>20,`${name}: blank canvas`);return png;
}
async function ready(){
  const deadline=Date.now()+90000;
  while(Date.now()<deadline){
    const info=await dbInfo();
    if(info.count>0&&info.ready){
      await page.waitForFunction(()=>document.querySelector('#model-toolbar')?.dataset.joinState==='ready');return;
    }
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(done)));
  }
  throw new Error('El metrado de la revision activa no termino.');
}
async function dbInfo(){return page.evaluate(async()=>{const {BimDatabase}=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/core/database/BimDatabase.ts')).name);const db=BimDatabase.getInstance(),docs=db.getAllElements();return {revision:db.revision,count:docs.length,gross:docs.reduce((s,d)=>s+d.instanceParameters.grossVolume,0),net:docs.reduce((s,d)=>s+d.instanceParameters.netVolume,0),deduction:docs.reduce((s,d)=>s+d.instanceParameters.overlapVolume,0),ready:docs.every(d=>d.instanceParameters.quantityState==='ready')};});}
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:3015',{waitUntil:'domcontentloaded'});
  await page.locator('#btn-full-building').click();await page.locator('input[name="example"][value="office-8"]').check();await page.locator('#examples-load').click();await ready();
  const totals=await dbInfo();assert.equal(totals.count,827);assert.ok(totals.ready&&totals.deduction>0);assert.ok(Math.abs(totals.gross-totals.net-totals.deduction)<1e-8);console.log('Office physical quantities',totals);
  await pixels('dual-physical-desktop');await page.locator('#model-analytical').click();await pixels('dual-analytical-desktop');
  await page.locator('#model-projection').selectOption('plan');await pixels('dual-plan');await page.locator('#model-projection').selectOption('elevation');await pixels('dual-elevation');
  await page.locator('#model-projection').selectOption('3d');await page.locator('#model-sync').check();await pixels('dual-compare-desktop');
  assert.equal(await page.locator('[data-view-id]:visible').count(),2);
  await page.setViewportSize({width:390,height:844});await page.locator('#model-sync').uncheck();await page.locator('#model-sync').check();await pixels('dual-compare-mobile');
  const bounds=await page.locator('#app-workspace').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
  await page.setViewportSize({width:1440,height:1000});await page.locator('#model-sync').uncheck();
  await page.locator('#model-scope').selectOption('calculation');await page.locator('#model-calculate').click();await page.locator('#analysis-solve').click();await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent.includes('Equilibrio relativo'));await page.locator('#analysis-close').click();
  await page.locator('#model-diagram').selectOption('moment');await page.waitForFunction(()=>document.querySelector('#model-toolbar')?.dataset.modelStatus?.includes('|max|'));await page.locator('#model-projection').selectOption('elevation');await pixels('dual-moment');
  // Quantities-only changes do not invalidate analysis; geometry changes do.
  await page.evaluate(async()=>{const {BimDatabase}=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/core/database/BimDatabase.ts')).name);const db=BimDatabase.getInstance(),d=db.getAllElements().find(d=>d.geometry.definition.type==='beam');const def=structuredClone(d.geometry.definition);def.width+=.01;db.updateGeometry(d.uniqueId,def);});
  await page.waitForFunction(()=>document.querySelector('#model-toolbar')?.dataset.modelStatus?.includes('OBSOLETA'));await ready();assert.match(await page.locator('#model-toolbar').getAttribute('data-model-status'),/Sin resultados vigentes/);
  await page.locator('#model-physical').click();await page.keyboard.press('Control+Shift+s');await page.locator('#sched-search').fill('VIG');
  const focus=page.locator('#sched-body [data-focus]').first();await focus.click();
  await page.locator('#model-rebar').click();await page.locator('#rebar-dialog button[type="submit"]').click();await ready();const rebarPixels=await pixels('dual-manual-rebar');
  assert.equal(await page.locator('#model-physical').getAttribute('class'),'active');
  let redPixels=0;for(let i=0;i<rebarPixels.data.length;i+=4)if(rebarPixels.data[i]>100&&rebarPixels.data[i]>rebarPixels.data[i+1]*1.5&&rebarPixels.data[i+1]<150)redPixels++;assert.ok(redPixels>100,'Visible reinforcement');
  const steel=await page.evaluate(async()=>{const {BimDatabase}=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/core/database/BimDatabase.ts')).name);return BimDatabase.getInstance().getAllElements().filter(d=>d.reinforcement).map(d=>({mass:d.instanceParameters.steelMass,status:d.reinforcement.status}));});assert.equal(steel.length,1);assert.ok(steel[0].mass>0);assert.equal(steel[0].status,'manual-unverified');
  await page.keyboard.press('Control+Shift+s');assert.match(await page.locator('#sched-head').textContent(),/Bruto.*Solape.*Neto.*Acero/);await page.screenshot({path:'test-results/dual-quantities.png'});await page.locator('#sched-close').click();
  await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Guardado local');await page.reload({waitUntil:'domcontentloaded'});await ready();
  assert.equal((await dbInfo()).count,827);
  await page.locator('#btn-full-building').click();await page.locator('input[name="example"][value="cantilever"]').check();page.once('dialog',d=>d.accept());await page.locator('#examples-load').click();await ready();
  await page.locator('#model-analytical').click();await page.locator('#model-projection').selectOption('elevation');
  const img=await pixels('dual-selection-source'),candidates=[];
  for(let y=30;y<img.height-50;y++)for(let x=0;x<img.width;x++){const i=(y*img.width+x)*4;if(img.data[i+1]-img.data[i]>20&&Math.abs(img.data[i+1]-img.data[i+2])<15&&img.data[i+1]<220)candidates.push({x,y});}
  assert.ok(candidates.length>30);const pt=candidates[Math.floor(candidates.length/2)],rect=await page.locator('#canvas-container canvas').boundingBox();
  await page.mouse.click(rect.x+pt.x,rect.y+pt.y);await page.waitForFunction(()=>document.querySelector('#model-toolbar')?.dataset.selectedId);
  const linked=await page.locator('#model-toolbar').getAttribute('data-selected-id');await page.locator('#model-physical').click();assert.equal(await page.locator('#model-toolbar').getAttribute('data-selected-id'),linked);
  await page.locator('#model-projection').selectOption('3d');const before=await pixels('dual-before-orbit');
  const viewport=await page.locator('[data-view-id="view-3d"] .view-panel-content').boundingBox();await page.mouse.move(viewport.x+viewport.width*.5,viewport.y+viewport.height*.5);await page.mouse.down();await page.mouse.move(viewport.x+viewport.width*.6,viewport.y+viewport.height*.6,{steps:10});await page.mouse.up();
  const after=await pixels('dual-after-orbit');let changed=0;for(let i=0;i<before.data.length;i+=4)if(Math.abs(before.data[i]-after.data[i])>20)changed++;assert.ok(changed>1000,'Orbit updates rendered model');
  assert.deepEqual(errors,[]);console.log('Dual view tests passed: 827 solids, net volumes, projections, comparison, diagrams, invalidation, visible rebar, linked selection, orbit and reload.');
}finally{await browser.close();}
