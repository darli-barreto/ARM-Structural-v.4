import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('test-results',{recursive:true});
async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function snapshot(name){
  await settle();const img=PNG.sync.read(await page.locator('#canvas-container canvas').screenshot({path:`test-results/frame-${name}.png`}));
  let teal=0;for(let i=0;i<img.data.length;i+=4)if(img.data[i+1]-img.data[i]>20&&Math.abs(img.data[i+1]-img.data[i+2])<15&&img.data[i+1]<220)teal++;
  assert.ok(teal>200,`${name}: visible frame axes`);return img;
}
try{
  await page.goto(process.env.APP_URL||'http://127.0.0.1:3015');await page.locator('#btn-full-building').click();await page.locator('input[value="office-8"]').check();await page.locator('#examples-load').click();
  await page.waitForFunction(()=>document.querySelector('#model-status')?.textContent.includes('Uniones listas'));
  await page.locator('#model-analytical').click();await settle();
  assert.equal(await page.locator('#model-slab-contours').isChecked(),false);assert.equal(await page.locator('#model-status').getAttribute('data-slab-contours'),'0');
  await page.locator('#model-frame-plane').selectOption('XY');await page.waitForFunction(()=>document.querySelector('#model-status')?.dataset.axisElements==='88');
  assert.equal(await page.locator('#model-projection').inputValue(),'elevation');await snapshot('xy-clean');
  await page.locator('#model-frame-plane').selectOption('all');await page.locator('#model-slab-contours').check();await page.waitForFunction(()=>Number(document.querySelector('#model-status')?.dataset.slabContours)>0);
  await page.locator('#model-slab-contours').uncheck();await page.locator('#model-frame-plane').selectOption('ZY');await snapshot('zy-clean');
  assert.match(await page.locator('#model-status').textContent(),/ZY \/ X = 0/);
  await page.locator('#model-frame-ordinate').fill('100');await page.locator('#model-frame-ordinate').press('Tab');await page.waitForFunction(()=>document.querySelector('#model-status')?.textContent.includes('Sin barras en este plano'));
  await page.locator('#model-frame-ordinate').fill('0');await page.locator('#model-frame-ordinate').press('Tab');await page.locator('#model-frame-plane').selectOption('XY');await settle();
  await page.setViewportSize({width:390,height:844});await page.locator('#model-fit').click();await snapshot('mobile');await page.screenshot({path:'test-results/frame-mobile-ui.png'});
  const viewport=await page.locator('[data-view-id="dual-elevation"] .view-panel-content').boundingBox();assert.ok(viewport.x>=0&&viewport.x+viewport.width<=390);
  await page.setViewportSize({width:1440,height:1000});await page.locator('#model-fit').click();await page.locator('#model-sync').check();await snapshot('comparison');await page.locator('#model-sync').uncheck();
  await page.locator('#model-scope').selectOption('calculation');await settle();assert.equal(await page.locator('#model-geometry-options').isVisible(),false);assert.equal(await page.locator('#model-supports').isEnabled(),true);
  await page.locator('#model-calculate').click();await page.locator('#analysis-solve').click();await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent.includes('Equilibrio relativo'));await page.locator('#analysis-close').click();
  await page.locator('#model-diagram').selectOption('moment');await page.waitForFunction(()=>document.querySelector('#model-status')?.textContent.includes('|max|'));await snapshot('calculation-moment');
  await page.locator('#model-scope').selectOption('axes');await settle();assert.equal(await page.locator('#model-diagram').inputValue(),'none');assert.equal(await page.locator('#model-supports').isDisabled(),true);
  await page.locator('#model-scope').selectOption('calculation');await page.locator('#model-diagram').selectOption('moment');await page.waitForFunction(()=>document.querySelector('#model-status')?.textContent.includes('|max|'));
  assert.deepEqual(errors,[]);console.log('Frame view passed: default unifilar, optional contours, XY/ZY isolation, empty plane, mobile framing and unchanged FEM results.');
}finally{await browser.close();}
