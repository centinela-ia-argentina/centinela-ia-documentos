'use client';
import { motion } from 'motion/react';
import { ReactNode } from 'react';

export function MotionCard({ children, className = '', index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition-colors hover:border-neutral-400 ${className}`}
    >
      {children}
    </motion.div>
  );
}
