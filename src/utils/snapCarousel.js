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
