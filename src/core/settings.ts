import { WEIGHT_STEPS } from './limits';
import { DEFAULT_REST_SEC, clampRestSec } from './rest';
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  soundOn: true,
  keepAwake: true,
  weightStep: 2.5,
  defaultRestSec: DEFAULT_REST_SEC,
};

/** Fill missing fields; malformed values (e.g. from a hand-edited backup) fall back to the defaults. */
export function withDefaults(stored: unknown): Settings {
  const s = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  return {
    soundOn: typeof s.soundOn === 'boolean' ? s.soundOn : DEFAULT_SETTINGS.soundOn,
    keepAwake: typeof s.keepAwake === 'boolean' ? s.keepAwake : DEFAULT_SETTINGS.keepAwake,
    weightStep:
      typeof s.weightStep === 'number' && WEIGHT_STEPS.includes(s.weightStep) ? s.weightStep : DEFAULT_SETTINGS.weightStep,
    defaultRestSec:
      typeof s.defaultRestSec === 'number' && Number.isFinite(s.defaultRestSec)
        ? clampRestSec(s.defaultRestSec)
        : DEFAULT_SETTINGS.defaultRestSec,
  };
}
