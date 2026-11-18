import { useEffect, useState } from 'react';

export function useAnimatedValue(target: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
