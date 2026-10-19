export interface ReeferAutoSizingOptions {
  cargoWeight?: number;
  stowageFactor?: number;
  vessel?: unknown;
  onDwtChange?: (dwt: number) => void;
}

export interface ReeferAutoSizingResult {
  optimalDwt: number;
  isAutoSized: boolean;
  badgeText: string | null;
}

export function calculateOptimalDwt(cargoWeight: number, stowageFactor: number): number;
export function isTbnVessel(vessel: unknown): boolean;
export function useReeferAutoSizing(options?: ReeferAutoSizingOptions): ReeferAutoSizingResult;
export default useReeferAutoSizing;
