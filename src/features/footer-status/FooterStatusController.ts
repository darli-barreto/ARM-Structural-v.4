import { footerStatusStore } from './FooterStatusStore';

export class FooterStatusBar {
  public setMessage(msg: string): void {
    footerStatusStore.setMessage(msg);
  }

  public setCoordinates(x: number, z: number, y: number): void {
    footerStatusStore.setCoordinates(x, z, y);
  }

  public updateMetrics(count: number, volume: number, calcMs: number, fps: number): void {
    footerStatusStore.updateMetrics(count, volume, calcMs, fps);
  }
}
