import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));await mkdir('test-results',{recursive:true});
const exported=async(name)=>{
  const wait=page.waitForEvent('download');await page.locator('#project-save').click();await (await wait).saveAs(`test-results/${name}.json`);
  return JSON.parse(await readFile(`test-results/${name}.json`,'utf8'));
};
const pixels=async(name)=>{
  const png=PNG.sync.read(await page.locator('#canvas-container canvas').screenshot({path:`test-results/${name}.png`}));
  let axes=0;for(let i=0;i<png.data.length;i+=4)if(png.data[i+1]-png.data[i]>20&&Math.abs(png.data[i+1]-png.data[i+2])<15&&png.data[i+1]<220)axes++;
  assert.ok(axes>200,`${name}: ejes visibles`);
};
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:3015',{waitUntil:'domcontentloaded'});
  await page.locator('#btn-full-building').click();await page.locator('input[value="office-8"]').check();await page.locator('#examples-load').click();
  await page.locator('#model-analytical').click();await page.locator('#model-frame-plane').selectOption('XY');
  await page.waitForFunction(()=>document.querySelector('#model-toolbar')?.dataset.axisNodes==='103');
  assert.equal(await page.locator('#model-toolbar').getAttribute('data-axis-segments'),'136');await pixels('unified-axes');
  await page.locator('#model-scope').selectOption('calculation');
  await page.waitForFunction(()=>document.querySelector('#model-toolbar')?.dataset.calculationNodes==='103');
  assert.equal(await page.locator('#model-toolbar').getAttribute('data-calculation-segments'),'136');await pixels('unified-calculation');
  await page.setViewportSize({width:390,height:844});await page.locator('#model-fit').click();await pixels('unified-mobile');
  await page.setViewportSize({width:1440,height:1000});await page.locator('#project-analysis').click();
  await page.locator('#analysis-solve').click();await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent.includes('Equilibrio relativo'));
  await page.locator('[data-tab="members"]').click();assert.equal(await page.locator('[data-focus]').count(),136);
  await page.screenshot({path:'test-results/unified-members.png'});await page.locator('#analysis-close').click();
  const original=await exported('unified-project'),legacy=structuredClone(original);delete legacy.analysis.model.geometryVersion;
  page.once('dialog',dialog=>dialog.accept());await page.locator('#project-file').setInputFiles({name:'legacy.arm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Guardado local');
  await page.locator('#project-analysis').click();assert.equal(await page.locator('#analysis-solve').isDisabled(),true);
  assert.match(await page.locator('#analysis-status').textContent(),/no vigente/);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#analysis-generate').click();assert.equal(await page.locator('#analysis-solve').isDisabled(),true);
  await page.locator('#analysis-close').click();
  const preserved=await exported('unified-legacy-preserved');assert.equal(preserved.analysis.requiresRegeneration,true);
  assert.deepEqual(preserved.analysis.model.members,legacy.analysis.model.members);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Proyecto recuperado');
  await page.locator('#project-analysis').click();assert.equal(await page.locator('#analysis-solve').isDisabled(),true);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#analysis-generate').click();
  assert.equal(await page.locator('#analysis-solve').isEnabled(),true);await page.locator('#analysis-bases').click();await page.locator('#analysis-solve').click();
  await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent.includes('Equilibrio relativo'));
  await page.locator('#analysis-close').click();
  const regenerated=await exported('unified-regenerated');assert.equal(regenerated.analysis.requiresRegeneration,false);
  assert.equal(regenerated.analysis.model.geometryVersion,'centroid-intersections-v1');assert.ok(regenerated.analysis.model.members.every(m=>m.dead===0&&m.live===0));
  assert.deepEqual(errors,[]);console.log('Unified analytical geometry passed: matching view/FEM, pixels, mobile, source spans, legacy preservation and explicit regeneration.');
}finally{await browser.close();}
