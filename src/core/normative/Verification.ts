import type { NormativeProfile } from './Profile';
import { findEdition, REGISTRY_VERSION, REQUIREMENTS, type RequirementDefinition } from './Registry';

export type VerificationStatus = 'NO_EVALUADO' | 'DATOS_INSUFICIENTES' | 'NO_APLICA_JUSTIFICADO' | 'CUMPLE' | 'NO_CUMPLE' | 'OBSOLETO';
export const STATUS_LABELS: Record<VerificationStatus,string> = {
  NO_EVALUADO:'No evaluado', DATOS_INSUFICIENTES:'Datos insuficientes', NO_APLICA_JUSTIFICADO:'No aplica justificado',
  CUMPLE:'Cumple', NO_CUMPLE:'No cumple', OBSOLETO:'Obsoleto',
};
export interface VerificationContext {
  projectId: string;
  modelRevision: number;
  analysisRevision: string;
  profileRevision: number;
  registryVersion: string;
  editionId: string;
  engineVersion: string;
}
export interface VerificationEvidence {
  requirementId: string;
  context: VerificationContext;
  evaluatedAt: string;
  reviewer: string;
  reference: string;
  applicability: {applies:boolean;justification:string};
  inputs: Record<string, unknown>;
  comparison?: {demand:number;limit:number;unit:string;operator:'<='|'>='};
}
export interface VerificationResult {
  requirementId: string;
  status: VerificationStatus;
  reason: string;
}

function supplied(value: unknown): boolean {
  if(typeof value==='number') return Number.isFinite(value);
  if(typeof value==='string') return value.trim().length>0;
  if(typeof value==='boolean') return true;
  if(Array.isArray(value)) return value.length>0 && value.every(supplied);
  if(value && typeof value==='object') return Object.keys(value).length>0 && Object.values(value).every(supplied);
  return false;
}

// This contract handles one reviewed scalar check, not a whole-building certificate.
// Rule-specific adapters must validate dimensions, applicability and inputs before producing evidence.
export function evaluateVerification(rule: RequirementDefinition, context: VerificationContext, evidence?: VerificationEvidence): VerificationResult {
  const result=(status:VerificationStatus,reason:string):VerificationResult=>({requirementId:rule.id,status,reason});
  if(evidence && evidence.requirementId!==rule.id)
    return result('NO_EVALUADO','La evidencia corresponde a otra comprobacion.');
  if(evidence && Object.keys(context).some(key=>context[key as keyof VerificationContext]!==evidence.context[key as keyof VerificationContext]))
    return result('OBSOLETO','La evidencia pertenece a otra revision, edicion o motor.');
  if(rule.implementation!=='available' || rule.validation!=='reviewed')
    return result('NO_EVALUADO','Algoritmo pendiente de implementacion o validacion independiente.');
  if(context.engineVersion!==rule.engineVersion || !context.editionId.trim() || context.registryVersion!==REGISTRY_VERSION || !rule.article.trim())
    return result('NO_EVALUADO','Motor o edicion sin correspondencia con la regla.');
  if(!evidence) return result('NO_EVALUADO','No hay evidencia de calculo.');
  if(!evidence.reference.trim() || !evidence.reviewer.trim() || !Number.isFinite(Date.parse(evidence.evaluatedAt)) || !evidence.applicability.justification.trim())
    return result('DATOS_INSUFICIENTES','Falta fuente, revision profesional, fecha o justificacion de aplicabilidad.');
  if(!rule.criterion || rule.criterion.editionId!==context.editionId)
    return result('NO_EVALUADO','Criterio o edicion no habilitados para esta comprobacion.');
  if(evidence.applicability.applies===false)
    return result('NO_APLICA_JUSTIFICADO',evidence.applicability.justification);
  if(evidence.applicability.applies!==true || rule.requiredInputs.some(key=>!supplied(evidence.inputs[key])))
    return result('DATOS_INSUFICIENTES','Faltan entradas necesarias o contienen valores no validos.');
  const c=evidence.comparison;
  if(!c || !Number.isFinite(c.demand) || !Number.isFinite(c.limit) || !c.unit.trim() || !['<=','>='].includes(c.operator))
    return result('DATOS_INSUFICIENTES','Comparacion numerica incompleta.');
  if(c.unit!==rule.criterion.unit || c.operator!==rule.criterion.operator)
    return result('DATOS_INSUFICIENTES','Unidad u operador incompatibles con el criterio.');
  const passes=c.operator==='<='?c.demand<=c.limit:c.demand>=c.limit;
  return result(passes?'CUMPLE':'NO_CUMPLE',`${c.demand} ${c.operator} ${c.limit} ${c.unit}`);
}

export function normativeMatrix(profile: NormativeProfile): VerificationResult[] {
  return REQUIREMENTS.map(rule=>{
    const selection=profile.selections[rule.standard],edition=findEdition(selection.editionId);
    const missing=!profile.scope.trim() || !edition || !selection.justification.trim() || !selection.evidenceReference.trim();
    return {requirementId:rule.id,status:missing?'DATOS_INSUFICIENTES':'NO_EVALUADO',reason:missing
      ?'Falta alcance, edicion propuesta o sustento de aplicabilidad.'
      :`${edition.limitation} Algoritmo no habilitado. La seleccion documental no acredita cumplimiento.`};
  });
}

export function normativeReport(profile: NormativeProfile, projectId: string, modelRevision: number) {
  return {format:'arm-normative-review',schemaVersion:1,generatedAt:new Date().toISOString(),projectId,modelRevision,
    registryVersion:REGISTRY_VERSION,profile:structuredClone(profile),
    scope:'Registro documental parcial. Sin certificacion ni comprobacion integral del RNE.',
    checks:normativeMatrix(profile).map(check=>{
      const requirement=REQUIREMENTS.find(rule=>rule.id===check.requirementId)!;
      return {...check,requirement,edition:findEdition(profile.selections[requirement.standard].editionId)??null};
    })};
}
