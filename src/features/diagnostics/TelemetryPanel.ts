export class TelemetryPanel {
  private elCount = document.getElementById('elem-count')!;
  private elVol = document.getElementById('vol-count')!;
  private elCalc = document.getElementById('calc-time')!;
  private elFps = document.getElementById('fps-val')!;

  public update(count: number, volume: number, durationMs: number) {
    this.elCount.innerText = count.toString();
    this.elVol.innerText = `${volume.toFixed(2)} m³`;
    this.elCalc.innerText = `${durationMs.toFixed(3)} ms`;
  }

  public setFps(fps: number) {
    this.elFps.innerText = fps.toString();
  }
}
