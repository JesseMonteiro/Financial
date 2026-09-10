import React from 'react';
import { motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

/** Enter-only fade. Exit + AnimatePresence would swap Outlet to the next route mid-animation. */
export function PageTransition() {
  const location = useLocation();
  const reduce = usePrefersReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: '100%' }}
    >
      <Outlet />
    </motion.div>
  );
}
