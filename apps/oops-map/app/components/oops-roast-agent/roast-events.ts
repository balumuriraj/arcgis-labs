import type { RoastTurnResult } from "./types";

type RoastTurnHandler = (result: RoastTurnResult) => void;

let _handler: RoastTurnHandler | null = null;

export function setRoastTurnHandler(handler: RoastTurnHandler): void {
  _handler = handler;
}

export function clearRoastTurnHandler(): void {
  _handler = null;
}

export function dispatchRoastTurnComplete(result: RoastTurnResult): void {
  _handler?.(result);
}
