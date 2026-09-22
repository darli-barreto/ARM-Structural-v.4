import assert from 'node:assert/strict';
import { mkdir,readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('test-results',{recursive:true});
async function choose(id,replace=false,analyze=true){
  await page.locator('#btn-full-building').click();await page.locator(`input[name="example"][value="${id}"]`).check();
  if(replace)page.once('dialog',d=>d.accept());
  await page.locator(analyze?'#examples-analyze':'#examples-load').click();
  if(analyze)await page.locator('#analysis-panel').waitFor({state:'visible'});
}
async function solve(){await page.locator('#analysis-solve').click();await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent.includes('Equilibrio relativo'));}
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:3015',{waitUntil:'domcontentloaded'});
  await page.locator('#btn-full-building').click();await page.screenshot({path:'test-results/examples-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/examples-mobile.png'});
  const bounds=await page.locator('.examples-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
  await page.setViewportSize({width:1440,height:1000});await page.locator('#examples-close').click();
  await choose('office-8',false,false);
  const canvas=PNG.sync.read(await page.locator('#canvas-container canvas').screenshot({path:'test-results/offices-8-desktop.png'})),colors=new Set();
  for(let i=0;i<canvas.data.length;i+=16)colors.add(`${canvas.data[i]},${canvas.data[i+1]},${canvas.data[i+2]}`);assert.ok(colors.size>30);
  await page.locator('#project-analysis').click();assert.equal(await page.locator('#analysis-tolerance').inputValue(),'0.001');
  assert.equal(await page.locator('[data-support]').count(),103);await solve();await page.screenshot({path:'test-results/offices-8-analysis.png'});
  await page.locator('#analysis-close').click();
  await page.locator('#btn-full-building').click();await page.locator('input[value="cantilever"]').check();page.once('dialog',d=>d.dismiss());await page.locator('#examples-load').click();
  assert.equal(await page.locator('#examples-modal').isVisible(),true);await page.locator('#examples-close').click();
  await page.locator('#project-analysis').click();await page.locator('[data-tab="nodes"]').click();assert.equal(await page.locator('[data-support]').count(),103);await page.locator('#analysis-close').click();
  for(const id of ['cantilever','supported']){
    await choose(id,true);assert.match(await page.locator('.benchmark-comparison h3').textContent(),/Pendiente/);
    await solve();assert.equal(await page.locator('.benchmark-comparison h3').textContent(),'Coincide con la referencia');
    assert.equal(await page.locator('.benchmark-comparison tbody tr').count(),3);
    assert.deepEqual(await page.locator('.benchmark-comparison tbody tr td:last-child').allTextContents(),['OK','OK','OK']);
    await page.screenshot({path:`test-results/reference-${id}.png`});
    const reportWait=page.waitForEvent('download');await page.locator('#analysis-report').click();await (await reportWait).saveAs(`test-results/reference-${id}.html`);
    assert.match(await readFile(`test-results/reference-${id}.html`,'utf8'),/Coincide con la referencia/);
    await page.locator('#analysis-close').click();
  }
  await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Guardado local');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Proyecto recuperado');
  await page.locator('#project-analysis').click();await solve();assert.equal(await page.locator('.benchmark-comparison h3').textContent(),'Coincide con la referencia');
  await page.locator('[data-tab="members"]').click();await page.locator('[data-key="dead"]').fill('11');await page.locator('[data-key="dead"]').press('Tab');await solve();
  assert.equal(await page.locator('.benchmark-comparison').count(),0);assert.match(await page.locator('.benchmark-note').textContent(),/Referencia modificada/);
  assert.deepEqual(errors,[]);console.log('Examples passed: office frame, replacement cancellation, 2 references, reports, persistence and changed-input guard.');
}finally{await browser.close();}
