import { defaultPhases } from './storage';

/** Re-export for components that still use watchlistModel */
export const DEFAULT_PHASES = defaultPhases;

/** Compute readiness 0-100 from all 3 phases (trend + pattern + entry). 9/15 = 60%. */
export function calcPhaseReadiness(phases) {
  const trend = phases?.trend;
  const pattern = phases?.pattern;
  const entry = phases?.entry;
  const trendItems = trend?.items || defaultPhases.trend.items;
  const patternItems = pattern?.items || defaultPhases.pattern.items;
  const entryItems = entry?.items || defaultPhases.entry.items;
  const trendChecks = trend?.checks ?? trendItems.map(() => false);
  const patternChecks = pattern?.checks ?? patternItems.map(() => false);
  const entryChecks = entry?.checks ?? entryItems.map(() => false);
  const trendTotal = Math.max(trendItems.length, trendChecks.length);
  const patternTotal = Math.max(patternItems.length, patternChecks.length);
  const entryTotal = Math.max(entryItems.length, entryChecks.length);
  const trendDone = trendChecks.filter(Boolean).length;
  const patternDone = patternChecks.filter(Boolean).length;
  const entryDone = entryChecks.filter(Boolean).length;
  const totalChecks = trendTotal + patternTotal + entryTotal;
  const totalDone = trendDone + patternDone + entryDone;
  const readiness = totalChecks ? Math.round((totalDone / totalChecks) * 100) : 0;
  return {
    trendScore: trendTotal ? trendDone / trendTotal : 0,
    patternScore: patternTotal ? patternDone / patternTotal : 0,
    entryScore: entryTotal ? entryDone / entryTotal : 0,
    readiness,
    trendDone,
    trendTotal,
    patternDone,
    patternTotal,
    entryDone,
    entryTotal,
  };
}
