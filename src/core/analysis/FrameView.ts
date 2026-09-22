import type { BimElementDocument } from '../database/BimDatabaseTypes';
import type { Vector3D } from '../model/Geometry';
import { memberAxes } from './AnalyticalGraph';

export interface FrameView {plane:'all'|'XY'|'ZY';ordinate:number}
export function segmentInFrame(a:Vector3D,b:Vector3D,frame:FrameView):boolean {
  if(frame.plane==='all')return true;
  if(!Number.isFinite(frame.ordinate))return false;
  const axis=frame.plane==='XY'?'z':'x';
  // Membership requires both endpoints on the plane; crossing it is insufficient.
  return Math.abs(a[axis]-frame.ordinate)<=.001&&Math.abs(b[axis]-frame.ordinate)<=.001;
}
export function frameDocuments(documents:BimElementDocument[],frame:FrameView):BimElementDocument[]{
  return documents.filter(d=>{const axis=memberAxes(d.geometry.definition);return axis!==null&&segmentInFrame(axis.a,axis.b,frame);});
}
