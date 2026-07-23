import { useEffect, useRef, useState } from 'react';

/**
 * Tracks scroll direction for hide-on-scroll-down / show-on-scroll-up UI.
 * @param {{ threshold?: number, target?: Window | HTMLElement | null }} options
 */
export function useScrollDirection({ threshold = 10, target = null } = {}) {
  const [direction, setDirection] = useState('up');
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const el = target ?? window;
    const getY = () =>
      el === window ? window.scrollY || document.documentElement.scrollTop : el.scrollTop;

    const getMetrics = () => {
      if (el === window) {
        const y = getY();
        const max = Math.max(
          0,
          (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight
        );
        return { y, max };
      }
      return { y: el.scrollTop, max: Math.max(0, el.scrollHeight - el.clientHeight) };
    };

    const { y: initialY, max: initialMax } = getMetrics();
    lastY.current = initialY;
    setIsAtTop(initialY < 8);
    setIsAtBottom(initialMax > 0 && initialY >= initialMax - 8);

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const { y, max } = getMetrics();
        const delta = y - lastY.current;
        setIsAtTop(y < 8);
        setIsAtBottom(max > 0 && y >= max - 8);
        if (Math.abs(delta) >= threshold) {
          setDirection(delta > 0 ? 'down' : 'up');
          lastY.current = y;
        }
        ticking.current = false;
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [threshold, target]);

  // Keep bar reachable at page ends (top always; bottom after scroll-down).
  return {
    direction,
    isAtTop,
    isAtBottom,
    hidden: direction === 'down' && !isAtTop && !isAtBottom,
  };
}
