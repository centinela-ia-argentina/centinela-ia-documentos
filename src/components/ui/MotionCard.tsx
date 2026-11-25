'use client';
import { motion } from 'motion/react';
import { ReactNode } from 'react';

export function MotionCard({ children, className = '', index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  // Card del sistema: borde y fondo visibles SIEMPRE (los estilos oscuros hardcodeados
  // dejaban la card invisible sobre el shell claro), y sin levantamiento al hover
  // (el whileHover y:-4 hacia que las métricas "saltaran" y chocaran con las tabs en Reportes).
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      className={`rounded-2xl border border-[#e3e4e5] bg-white p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}
