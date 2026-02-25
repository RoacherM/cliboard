import { useLayoutEffect } from 'react';
import { useStdin } from 'ink';

export interface KeyBinding {
  key: string;
  context?: string;
  handler: () => void;
}

export function useKeyBindings(bindings: KeyBinding[], activeContext: string): void {
  const { stdin } = useStdin();

  useLayoutEffect(() => {
    if (!stdin) return;

    const onData = (data: Buffer | string) => {
      const input = String(data);
      for (const binding of bindings) {
        if (binding.key === input) {
          if (binding.context === undefined || binding.context === activeContext) {
            binding.handler();
          }
        }
      }
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
    };
  }, [stdin, bindings, activeContext]);
}
