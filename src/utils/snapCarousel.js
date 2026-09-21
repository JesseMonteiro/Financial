export function centerChild(container, child, behavior = 'smooth') {
  if (!container || !child) return false;
  const cRect = container.getBoundingClientRect();
  const eRect = child.getBoundingClientRect();
  const delta = (eRect.left + eRect.width / 2) - (cRect.left + cRect.width / 2);
  if (Math.abs(delta) < 6) return false;
  container.scrollTo({ left: container.scrollLeft + delta, behavior });
  return true;
}

export function nearestAttr(container, attr) {
  const cRect = container.getBoundingClientRect();
  const center = cRect.left + cRect.width / 2;
  let best = null;
  let bestDist = Infinity;
  for (const el of container.querySelectorAll(`[${attr}]`)) {
    const rect = el.getBoundingClientRect();
    const dist = Math.abs(rect.left + rect.width / 2 - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = el.getAttribute(attr);
    }
  }
  return best;
}

export function attrSelector(attr, value) {
  return `[${attr}="${CSS.escape(String(value))}"]`;
}

export function bindSnapSelect(container, { attr, ignoreRef, onSelect }) {
  if (!container) return () => {};
  let debounce;
  const pick = () => {
    if (ignoreRef?.current) return;
    const id = nearestAttr(container, attr);
    if (id) onSelect(id);
  };
  const onScroll = () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(pick, 90);
  };
  container.addEventListener('scroll', onScroll, { passive: true });
  container.addEventListener('scrollend', pick);
  return () => {
    clearTimeout(debounce);
    container.removeEventListener('scroll', onScroll);
    container.removeEventListener('scrollend', pick);
  };
}

/**
 * Bind a one-item-at-a-time snap carousel.
 *
 * Records which item is centred when a touch/scroll interaction begins.
 * On scrollend it limits the navigation to exactly ±1 item relative to
 * that snapshot, scrolls programmatically to the winner and calls onSelect.
 *
 * Works alongside CSS scroll-snap (the snap handles the visual feel; this
 * function enforces the "only one at a time" contract on top of it).
 */
export function bindOneByOneSnap(container, { attr, ignoreRef, onSelect }) {
  if (!container) return () => {};

  /** Value of the centred item captured at gesture-start */
  let anchorValue = null;
  let isProgrammatic = false;

  /** Ordered list of all snap-target values inside the container */
  const getItems = () =>
    [...container.querySelectorAll(`[${attr}]`)].map((el) => el.getAttribute(attr));

  /** Scroll container so that the element with value === targetValue is centred */
  const scrollToValue = (targetValue) => {
    const el = container.querySelector(attrSelector(attr, targetValue));
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = (eRect.left + eRect.width / 2) - (cRect.left + cRect.width / 2);
    if (Math.abs(delta) < 4) return;
    isProgrammatic = true;
    container.scrollTo({ left: container.scrollLeft + delta, behavior: 'smooth' });
    // Release programmatic flag after scroll settles
    window.setTimeout(() => { isProgrammatic = false; }, 600);
  };

  /** Capture the centred item at the very start of a gesture */
  const onTouchStart = () => {
    if (ignoreRef?.current) return;
    anchorValue = nearestAttr(container, attr);
  };

  /** Also handle mouse-wheel / trackpad starts */
  const onPointerDown = () => {
    if (ignoreRef?.current) return;
    anchorValue = nearestAttr(container, attr);
  };

  let scrollStartTimer = null;
  let hasScrollStarted = false;
  const onScroll = () => {
    if (ignoreRef?.current || isProgrammatic) return;
    if (!hasScrollStarted) {
      hasScrollStarted = true;
      // Capture anchor lazily on first scroll event (covers wheel/trackpad)
      if (!anchorValue) anchorValue = nearestAttr(container, attr);
    }
    clearTimeout(scrollStartTimer);
    scrollStartTimer = window.setTimeout(() => { hasScrollStarted = false; }, 300);
  };

  const onScrollEnd = () => {
    if (ignoreRef?.current || isProgrammatic) return;
    hasScrollStarted = false;

    const items = getItems();
    if (items.length === 0) return;

    const currentNearest = nearestAttr(container, attr);
    if (!currentNearest) return;

    const anchor = anchorValue || currentNearest;
    anchorValue = null;

    const anchorIdx = items.indexOf(anchor);
    const currentIdx = items.indexOf(currentNearest);

    // Clamp movement to ±1
    let targetIdx = currentIdx;
    if (anchorIdx !== -1 && currentIdx !== -1) {
      if (currentIdx > anchorIdx) targetIdx = anchorIdx + 1;
      else if (currentIdx < anchorIdx) targetIdx = anchorIdx - 1;
    }
    targetIdx = Math.max(0, Math.min(items.length - 1, targetIdx));

    const targetValue = items[targetIdx];

    // If snap already landed on the right item, just notify
    if (currentNearest === targetValue) {
      onSelect(targetValue);
      return;
    }

    // Otherwise correct the position
    scrollToValue(targetValue);
    onSelect(targetValue);
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('pointerdown', onPointerDown, { passive: true });
  container.addEventListener('scroll', onScroll, { passive: true });
  container.addEventListener('scrollend', onScrollEnd);

  return () => {
    clearTimeout(scrollStartTimer);
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('scroll', onScroll);
    container.removeEventListener('scrollend', onScrollEnd);
  };
}
