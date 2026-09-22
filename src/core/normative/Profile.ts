import { findEdition, STANDARD_IDS, type StandardId } from './Registry';

export interface NormativeSelection {
  editionId: string | null;
  justification: string;
  evidenceReference: string;
}

export interface NormativeProfile {
  schemaVersion: 1;
  country: 'PE';
  revision: number;
  scope: string;
  selections: Record<StandardId, NormativeSelection>;
}

export function defaultNormativeProfile(): NormativeProfile {
  return {schemaVersion:1,country:'PE',revision:1,scope:'',selections:Object.fromEntries(
    STANDARD_IDS.map(id => [id,{editionId:null,justification:'',evidenceReference:''}]),
  ) as Record<StandardId, NormativeSelection>};
}

function object(value: unknown): Record<string, unknown> {
  if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Perfil normativo no valido.');
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if(typeof value !== 'string' || value.length > 4000) throw new Error('Texto normativo no valido (maximo 4000 caracteres).');
  return value;
}

export function parseNormativeProfile(value: unknown): NormativeProfile {
  const profile=object(value);
  if(profile.schemaVersion!==1 || profile.country!=='PE' || !Number.isSafeInteger(profile.revision) || (profile.revision as number)<1)
    throw new Error('Version o jurisdiccion normativa no compatible.');
  const selections=object(profile.selections),result=defaultNormativeProfile();
  result.revision=profile.revision as number;result.scope=text(profile.scope);
  for(const standard of STANDARD_IDS){
    const selection=object(selections[standard]);
    if(selection.editionId!==null && (typeof selection.editionId!=='string' || findEdition(selection.editionId)?.standard!==standard))
      throw new Error(`Edicion normativa incompatible con ${standard}.`);
    result.selections[standard]={editionId:selection.editionId as string|null,justification:text(selection.justification),evidenceReference:text(selection.evidenceReference)};
  }
  // Only configuration is imported. Saved "CUMPLE" flags and external rule definitions are never trusted.
  return result;
}

export function updateNormativeProfile(previous: NormativeProfile, draft: unknown): NormativeProfile {
  const next=parseNormativeProfile(draft);
  const unchanged=next.scope===previous.scope && JSON.stringify(next.selections)===JSON.stringify(previous.selections);
  next.revision=previous.revision+(unchanged?0:1);
  if(!Number.isSafeInteger(next.revision)) throw new Error('Limite de revisiones normativas alcanzado.');
  return next;
}
