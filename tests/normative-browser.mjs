import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await mkdir('test-results',{recursive:true});
const saveDownload=async(id,path)=>{
  const wait=page.waitForEvent('download');await page.locator(id).click();await (await wait).saveAs(path);
  return JSON.parse(await readFile(path,'utf8'));
};
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:3015',{waitUntil:'domcontentloaded'});
  await page.locator('#project-normative').click();
  assert.equal(await page.locator('.normative-state').filter({hasText:'Datos insuficientes'}).count(),5);
  await page.locator('#normative-scope').fill('Edificio piloto / concreto armado');
  for(const [standard,edition] of [['E.020','E020-2006'],['E.030','E030-2026'],['E.050','E050-2018'],['E.060','E060-2009']]){
    const row=page.locator(`[data-standard="${standard}"]`);
    await row.locator('[data-edition]').selectOption(edition);
    await row.locator('[data-justification]').fill('Propuesta del ensayo, pendiente de revision.');
    await row.locator('[data-evidence]').fill('Expediente de ensayo 001');
  }
  assert.equal(await page.locator('#normative-export').isDisabled(),true);
  assert.equal(await page.locator('.normative-state').filter({hasText:'No evaluado'}).count(),5);
  await page.locator('#normative-save').click();assert.equal(await page.locator('#normative-revision').textContent(),'2');
  await page.screenshot({path:'test-results/normative-desktop.png'});
  const report=await saveDownload('#normative-export','test-results/normative-matrix.json');
  assert.ok(report.checks.every(check=>check.status==='NO_EVALUADO'));
  assert.equal(report.profile.revision,2);
  await page.locator('#normative-scope').fill('Descartar este borrador');await page.locator('#normative-cancel').click();
  await page.locator('#project-normative').click();assert.equal(await page.locator('#normative-scope').inputValue(),'Edificio piloto / concreto armado');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/normative-mobile.png'});
  const bounds=await page.locator('.normative-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
  assert.ok(await page.locator('.normative-body').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.locator('#normative-matrix').scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/normative-mobile-matrix.png'});
  assert.ok(await page.locator('#normative-matrix').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.locator('#normative-close').click();
  await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Guardado local');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Proyecto recuperado');
  await page.locator('#project-normative').click();assert.equal(await page.locator('#normative-revision').textContent(),'2');
  assert.equal(await page.locator('#normative-scope').inputValue(),'Edificio piloto / concreto armado');
  await page.locator('#normative-close').click();await page.setViewportSize({width:1440,height:1000});
  const project=await saveDownload('#project-save','test-results/normative-project.arm.json');
  assert.deepEqual(project.normative,report.profile);
  const legacy={...project};delete legacy.normative;
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#project-file').setInputFiles({name:'legacy.arm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Guardado local');
  await page.locator('#project-normative').click();assert.equal(await page.locator('#normative-scope').inputValue(),'');await page.locator('#normative-close').click();
  page.once('dialog',dialog=>dialog.accept());await page.locator('#project-file').setInputFiles('test-results/normative-project.arm.json');
  await page.waitForFunction(()=>document.querySelector('#project-save-status')?.textContent==='Guardado local');
  await page.locator('#project-normative').click();assert.equal(await page.locator('#normative-scope').inputValue(),'Edificio piloto / concreto armado');await page.locator('#normative-close').click();
  await page.locator('#btn-full-building').click();await page.locator('input[value="cantilever"]').check();await page.locator('#examples-load').click();
  await page.locator('#project-normative').click();assert.equal(await page.locator('#normative-scope').inputValue(),'');await page.locator('#normative-close').click();
  const pixels=PNG.sync.read(await page.locator('#canvas-container canvas').screenshot({path:'test-results/normative-workspace.png'}));
  const colors=new Set();for(let i=0;i<pixels.data.length;i+=16)colors.add(`${pixels.data[i]},${pixels.data[i+1]},${pixels.data[i+2]}`);
  assert.ok(colors.size>30,'Modelo visible despues de importar/cargar');
  assert.deepEqual(errors,[]);console.log('Normative browser passed: defaults, editing, cancellation, export, legacy import, persistence, examples, desktop/mobile.');
}finally{await browser.close();}
