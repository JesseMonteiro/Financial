import { useMediaQuery } from './useMediaQuery';
import { useSettingsStore } from '../stores/settingsStore';

export function usePrefersReducedMotion() {
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled);
  return systemReduce || animationsEnabled === false;
}
