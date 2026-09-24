import type { AnalysisModel, AnalysisResult } from '../../core/analysis/Model';

export function renderAnalysisCanvas(
  model: AnalysisModel | null,
  result: AnalysisResult | null,
  documentRef: Document = document,
): void {
  const canvas = documentRef.getElementById('analysis-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, 720, 420);
  if (!model?.nodes.length) return;

  const nodes = model.nodes;
  const xs = nodes.map(node => node.x);
  const ys = nodes.map(node => node.y);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const scale = Math.min(600 / Math.max(xmax - xmin, 1), 310 / Math.max(ymax - ymin, 1));
  const point = (x: number, y: number): [number, number] => [60 + (x - xmin) * scale, 365 - (y - ymin) * scale];

  model.members.forEach(member => {
    const start = nodes.find(node => node.id === member.start)!;
    const end = nodes.find(node => node.id === member.end)!;
    context.beginPath();
    context.moveTo(...point(start.x, start.y));
    context.lineTo(...point(end.x, end.y));
    context.lineWidth = 2;
    context.strokeStyle = '#56747a';
    context.stroke();
  });
  nodes.forEach(node => {
    const [x, y] = point(node.x, node.y);
    context.fillStyle = node.support === 'free' ? '#fff' : '#167253';
    context.strokeStyle = '#167253';
    context.fillRect(x - 4, y - 4, 8, 8);
    context.strokeRect(x - 4, y - 4, 8, 8);
    context.fillStyle = '#304850';
    context.font = '11px Arial';
    context.fillText(node.id, x + 7, y - 7);
  });

  if (result) {
    const maximum = Math.max(...result.members.flatMap(member => [...member.deflectionX, ...member.deflectionY].map(Math.abs)), 1e-10);
    const factor = 35 / (maximum * scale);
    result.members.forEach(memberResult => {
      const member = model.members.find(item => item.id === memberResult.id)!;
      const start = nodes.find(node => node.id === member.start)!;
      const end = nodes.find(node => node.id === member.end)!;
      context.beginPath();
      memberResult.deflectionX.forEach((ux, index) => {
        const t = index / (memberResult.deflectionX.length - 1);
        const position = point(
          start.x + (end.x - start.x) * t + ux * factor,
          start.y + (end.y - start.y) * t + memberResult.deflectionY[index] * factor,
        );
        if (index) context.lineTo(...position);
        else context.moveTo(...position);
      });
      context.strokeStyle = '#c14578';
      context.lineWidth = 2;
      context.stroke();
    });
    context.fillStyle = '#a33862';
    context.fillText(`Deformada x ${factor.toFixed(0)}`, 20, 24);
  }

  const info = documentRef.getElementById('analysis-info');
  if (info) info.textContent = model.issues.slice(0, 6).join(' ');
}
