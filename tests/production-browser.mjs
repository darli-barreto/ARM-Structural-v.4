import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:3016');await page.locator('#btn-full-building').click();await page.locator('input[value="office-8"]').check();await page.locator('#examples-load').click();
  await page.waitForFunction(()=>document.querySelector('#model-status')?.textContent.includes('Neto 2268.866'),{},{timeout:60000});
  await page.locator('#model-analytical').click();await page.locator('#model-calculate').click();await page.locator('#analysis-solve').click();await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent.includes('Equilibrio relativo'));await page.locator('#analysis-close').click();
  await page.locator('#model-diagram').selectOption('moment');await page.waitForFunction(()=>document.querySelector('#model-status')?.textContent.includes('|max|'));
  assert.deepEqual(errors,[]);console.log('Production workers passed: WASM joins, analytical view and FEM diagram.');
}finally{await browser.close();}
