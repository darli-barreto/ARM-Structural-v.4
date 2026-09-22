import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultNormativeProfile,parseNormativeProfile,updateNormativeProfile} from '../src/core/normative/Profile';
import {EDITIONS,REGISTRY_VERSION,REQUIREMENTS,STANDARD_IDS,type RequirementDefinition} from '../src/core/normative/Registry';
import {evaluateVerification,normativeMatrix,normativeReport,type VerificationContext,type VerificationEvidence} from '../src/core/normative/Verification';
import {parseProject} from '../src/core/model/Project';

const legacy={format:'arm-project',schemaVersion:1,projectId:'legacy',savedAt:'',units:{length:'m',force:'kN',stress:'MPa'},code:'RNE-PE',elements:[],levels:[],grids:[]};
function configured(){
  const profile=defaultNormativeProfile();profile.scope='Vivienda de concreto armado';
  for(const standard of STANDARD_IDS)profile.selections[standard]={editionId:EDITIONS.find(e=>e.standard===standard)!.id,justification:'Propuesta pendiente de revision del responsable.',evidenceReference:'Expediente de ensayo / referencia 001'};
  return profile;
}

test('Migra proyectos antiguos sin asumir edicion ni cumplimiento; no muta entrada',()=>{
  const project=parseProject(legacy);
  assert.deepEqual(project.normative,defaultNormativeProfile());assert.equal('normative' in legacy,false);
  assert.ok(normativeMatrix(project.normative!).every(c=>c.status==='DATOS_INSUFICIENTES'));
  project.normative!.scope='Modificado';assert.equal(defaultNormativeProfile().scope,'');
});

test('Valida perfil, ediciones cruzadas, textos, pais y version; descarta estados importados',()=>{
  for(const malformed of [null,[],{}, {...configured(),country:'US'}, {...configured(),schemaVersion:2}, {...configured(),revision:NaN}, {...configured(),scope:'x'.repeat(4001)}])
    assert.throws(()=>parseNormativeProfile(malformed));
  const wrong=configured();wrong.selections['E.030'].editionId='E060-2009';assert.throws(()=>parseNormativeProfile(wrong));
  wrong.selections['E.030'].editionId='unknown';assert.throws(()=>parseNormativeProfile(wrong));
  assert.throws(()=>parseProject({...legacy,normative:null}));
  const clean=parseNormativeProfile({...configured(),status:'CUMPLE',checks:[{status:'CUMPLE'}]});
  assert.equal('status' in clean,false);assert.equal('checks' in clean,false);
  assert.ok(normativeMatrix(clean).every(c=>c.status==='NO_EVALUADO'));
});

test('Roundtrip de perfil y revision solo cuando cambian datos normativos',()=>{
  const profile=configured();const loaded=parseProject(JSON.parse(JSON.stringify({...legacy,normative:profile})));
  assert.deepEqual(loaded.normative,profile);
  assert.equal(updateNormativeProfile(profile,profile).revision,1);
  const next=structuredClone(profile);next.scope='Otro alcance';next.revision=100;
  assert.equal(updateNormativeProfile(profile,next).revision,2);
  assert.equal(profile.revision,1);
  const report=normativeReport(profile,'project-1',7);
  assert.equal(report.projectId,'project-1');assert.equal(report.modelRevision,7);assert.equal(report.registryVersion,REGISTRY_VERSION);
  assert.equal(report.checks.length,5);assert.ok(report.checks.every(c=>c.edition?.url.startsWith('https://')));
  profile.scope='Luego';assert.notEqual(report.profile.scope,profile.scope);
});

// Synthetic scalar QA fixture, deliberately not an implemented RNE design rule.
const rule:RequirementDefinition={id:'TEST-ONLY',standard:'E.060',title:'Contrato QA',article:'Fixture sintetico',requiredInputs:['load'],implementation:'available',validation:'reviewed',engineVersion:'test-1',criterion:{unit:'kN',operator:'<=',editionId:'test-edition'}};
const context:VerificationContext={projectId:'test',modelRevision:1,analysisRevision:'load-case-1',profileRevision:1,registryVersion:REGISTRY_VERSION,editionId:'test-edition',engineVersion:'test-1'};
function evidence():VerificationEvidence{
  return {requirementId:rule.id,context:{...context},evaluatedAt:'2026-09-20T12:00:00Z',reviewer:'QA fixture',reference:'Synthetic reference',applicability:{applies:true,justification:'Caso sintetico'},inputs:{load:0},comparison:{demand:10,limit:10,unit:'kN',operator:'<='}};
}

test('Contrato: distingue no evaluado, datos insuficientes, cumple y no cumple',()=>{
  assert.equal(evaluateVerification(rule,context).status,'NO_EVALUADO');
  const e=evidence();assert.equal(evaluateVerification(rule,context,e).status,'CUMPLE');
  e.comparison!.demand=11;assert.equal(evaluateVerification(rule,context,e).status,'NO_CUMPLE');
  e.comparison!.demand=9;assert.equal(evaluateVerification(rule,context,e).status,'CUMPLE');
  for(const missing of [undefined,null,'',NaN,Infinity,{},[],[null]]){
    e.inputs.load=missing;assert.equal(evaluateVerification(rule,context,e).status,'DATOS_INSUFICIENTES');
  }
  e.inputs.load=0;e.comparison!.demand=NaN;assert.equal(evaluateVerification(rule,context,e).status,'DATOS_INSUFICIENTES');
  e.comparison!.demand=1;e.comparison!.unit='kg';assert.equal(evaluateVerification(rule,context,e).status,'DATOS_INSUFICIENTES');
  e.comparison!.unit='kN';e.comparison!.operator='>=';assert.equal(evaluateVerification(rule,context,e).status,'DATOS_INSUFICIENTES');
});

test('Contrato: no aplica necesita evidencia y una regla validada; resultados obsoletos nunca pasan',()=>{
  const e=evidence();e.applicability.applies=false;
  assert.equal(evaluateVerification(rule,context,e).status,'NO_APLICA_JUSTIFICADO');
  assert.equal(evaluateVerification({...rule,criterion:{...rule.criterion!,editionId:'other'}},context,e).status,'NO_EVALUADO');
  e.applicability.justification='';assert.equal(evaluateVerification(rule,context,e).status,'DATOS_INSUFICIENTES');
  assert.equal(evaluateVerification({...rule,implementation:'pending'},context,e).status,'NO_EVALUADO');
  assert.equal(evaluateVerification({...rule,validation:'pending'},context,e).status,'NO_EVALUADO');
  for(const key of Object.keys(context) as (keyof VerificationContext)[]){
    const changed={...context,[key]:typeof context[key]==='number'?2:'changed'};
    assert.equal(evaluateVerification(rule,changed,evidence()).status,'OBSOLETO',key);
  }
  e.requirementId='another';assert.equal(evaluateVerification(rule,context,e).status,'NO_EVALUADO');
});

test('Ninguna regla RNE pendiente acepta evidencia inventada como cumplimiento',()=>{
  for(const pending of REQUIREMENTS){
    const e=evidence();e.requirementId=pending.id;
    assert.equal(evaluateVerification(pending,context,e).status,'NO_EVALUADO');
  }
  const e=evidence();e.reviewer='';assert.equal(evaluateVerification(rule,context,e).status,'DATOS_INSUFICIENTES');
  for(const field of ['reference','evaluatedAt'] as const){
    const incomplete=evidence();incomplete[field]='';assert.equal(evaluateVerification(rule,context,incomplete).status,'DATOS_INSUFICIENTES');
  }
  assert.equal(evaluateVerification({...rule,criterion:undefined},context,evidence()).status,'NO_EVALUADO');
});
