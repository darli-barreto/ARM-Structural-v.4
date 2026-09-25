import { solveFrame, type SolvePhase } from './Solver';
import type { AnalysisModel } from './Model';

interface AnalysisRequest {
  model: AnalysisModel;
  factors: { dead: number; live: number; nodal: number };
  caseName: string;
  profile?: boolean;
}

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    const { model, factors, caseName, profile } = event.data;
    const started = performance.now();
    let last = started;
    const phases: { phase: SolvePhase; durationMs: number }[] = [];
    const onPhase = profile ? (phase: SolvePhase) => {
      const now = performance.now();
      phases.push({ phase, durationMs: now - last });
      last = now;
    } : undefined;
    const result = solveFrame(model, factors, caseName, onPhase);
    self.postMessage({ result, ...(profile ? { profile: {
      solveFrameMs: performance.now() - started, phases,
    } } : {}) });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
