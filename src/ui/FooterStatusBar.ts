export class FooterStatusBar {
  private statusText = document.getElementById('status-message')!;
  private coordsText = document.getElementById('status-coords')!;
  private metricsPill = document.getElementById('status-metrics')!;

  public setMessage(msg: string): void {
    this.statusText.innerText = msg;
  }

  public setCoordinates(x: number, z: number, y: number): void {
    this.coordsText.innerText = `X: ${x.toFixed(2)}m  |  Z: ${z.toFixed(2)}m  |  Elev (Y): ${y.toFixed(2)}m`;
  }

  public updateMetrics(count: number, volume: number, calcMs: number, fps: number): void {
    this.metricsPill.innerHTML = `
      <span>Elementos: <strong>${count}</strong></span>
      <span>Concreto: <strong>${volume.toFixed(2)} m³</strong></span>
      <span>Kernel: <strong>${calcMs.toFixed(2)} ms</strong></span>
      <span>FPS: <strong>${fps}</strong></span>
    `;
  }
}
