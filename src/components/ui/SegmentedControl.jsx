import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export function SegmentedControl({ options = [], value, onChange, layoutId = 'segment', className = '' }) {
  const reduce = usePrefersReducedMotion();

  return (
    <LayoutGroup id={layoutId}>
      <div className={`segmented ${className}`.trim()} role="tablist">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`segmented__btn ${active ? 'is-active' : ''}`}
              onClick={() => onChange(opt.id)}
            >
              {active && (
                <motion.span
                  layoutId={reduce ? undefined : `${layoutId}-pill`}
                  className="segmented__pill"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="segmented__label">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
