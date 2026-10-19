import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// All motion respects the system reduce-motion setting (brief §6).
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduce,
    );
    return () => sub.remove();
  }, []);
  return reduce;
}
