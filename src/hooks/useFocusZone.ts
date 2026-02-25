import { useState, useCallback } from 'react';

export interface FocusZoneResult {
  activeZone: string;
  setActiveZone: (zone: string) => void;
  cycleForward: () => void;
  cycleBackward: () => void;
}

export function useFocusZone(
  zones: string[],
  options?: { trapped?: string },
): FocusZoneResult {
  const [activeZone, setActiveZoneState] = useState(zones[0]);

  const setActiveZone = useCallback((zone: string) => {
    setActiveZoneState(zone);
  }, []);

  const cycleForward = useCallback(() => {
    setActiveZoneState((current) => {
      if (options?.trapped && current === options.trapped) {
        return current;
      }
      const idx = zones.indexOf(current);
      return zones[(idx + 1) % zones.length];
    });
  }, [zones, options]);

  const cycleBackward = useCallback(() => {
    setActiveZoneState((current) => {
      if (options?.trapped && current === options.trapped) {
        return current;
      }
      const idx = zones.indexOf(current);
      return zones[(idx - 1 + zones.length) % zones.length];
    });
  }, [zones, options]);

  return { activeZone, setActiveZone, cycleForward, cycleBackward };
}
