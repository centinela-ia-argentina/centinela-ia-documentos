'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import type { IndustryType } from '@/lib/industries/documentTypes';

type AgentVisualState = 'idle' | 'listening' | 'thinking' | 'attentive';

type Props = {
  industry: IndustryType;
  state?: AgentVisualState;
  compact?: boolean;
  onActivate?: () => void;
  showHint?: boolean;
  className?: string;
};

const visualByIndustry: Record<
  IndustryType,
  { accent: string; secondary: string; coat: string; label: string }
> = {
  inmobiliaria: {
    accent: '#C8FF62',
    secondary: '#85E4D4',
    coat: '#12332D',
    label: 'Agente inmobiliario',
  },
  legal: {
    accent: '#8FB8FF',
    secondary: '#B7C9FF',
    coat: '#172943',
    label: 'Agente jurídico',
  },
  escribania: {
    accent: '#E5B879',
    secondary: '#F0D8B4',
    coat: '#3A2B25',
    label: 'Agente notarial',
  },
  general: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente Anulus' },
  gestoria: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente de gestoría' },
  empresa: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente empresarial' },
  contable: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente contable' },
  drogueria: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente de droguería' },
  farma: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente farmacéutico' },
  industria: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente industrial' },
  compliance: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente de compliance' },
  seguridad_documental: { accent: '#C8FF62', secondary: '#85E4D4', coat: '#12332D', label: 'Agente documental' },
};

export function AnulusAgentAvatar({
  industry,
  state = 'idle',
  compact = false,
  onActivate,
  showHint = true,
  className = '',
}: Props) {
  const theme = visualByIndustry[industry] ?? visualByIndustry.general;
  const reduceMotion = useReducedMotion();
  const [blinking, setBlinking] = useState(false);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const eyeX = useSpring(pointerX, { stiffness: 180, damping: 22, mass: 0.35 });
  const eyeY = useSpring(pointerY, { stiffness: 180, damping: 22, mass: 0.35 });

  useEffect(() => {
    if (reduceMotion) return;

    const scheduleBlink = () => {
      blinkTimer.current = setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 130);
        scheduleBlink();
      }, 2800 + Math.random() * 2600);
    };

    scheduleBlink();
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [reduceMotion]);

  function trackPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    if (reduceMotion || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const normalizedY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    pointerX.set(Math.max(-1, Math.min(1, normalizedX)) * 4.5);
    pointerY.set(Math.max(-1, Math.min(1, normalizedY)) * 3.5);
  }

  function resetPointer() {
    pointerX.set(0);
    pointerY.set(0);
  }

  const isThinking = state === 'thinking';
  const isListening = state === 'listening';

  return (
    <motion.button
      type="button"
      aria-label={`Hablar con el ${theme.label}`}
      onClick={onActivate}
      onPointerMove={trackPointer}
      onPointerLeave={resetPointer}
      className={`group relative isolate grid aspect-square w-full place-items-center rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62] ${compact ? 'max-w-[132px]' : 'max-w-[230px]'} ${className}`}
      animate={{ scale: compact ? 0.94 : 1 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      whileTap={reduceMotion ? undefined : { scale: compact ? 0.91 : 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <span
        className="absolute inset-[10%] rounded-full opacity-35 blur-3xl transition-opacity duration-300 group-hover:opacity-55"
        style={{ background: `radial-gradient(circle, ${theme.secondary} 0%, transparent 68%)` }}
        aria-hidden="true"
      />

      <motion.svg
        viewBox="0 0 240 250"
        role="img"
        aria-label={`${theme.label} de Anulus AI`}
        className="relative z-10 h-auto w-full overflow-visible drop-shadow-[0_22px_28px_rgba(0,0,0,0.34)]"
        animate={
          reduceMotion
            ? undefined
            : isThinking
              ? { y: [0, -3, 0], rotate: [-0.8, 0.8, -0.8] }
              : { y: [0, -6, 0], rotate: [-0.4, 0.4, -0.4] }
        }
        transition={{ duration: isThinking ? 1.5 : 4.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <linearGradient id={`shell-${industry}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F7FBF8" />
            <stop offset="0.58" stopColor="#DDE9E4" />
            <stop offset="1" stopColor="#AFC4BC" />
          </linearGradient>
          <linearGradient id={`coat-${industry}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.coat} />
            <stop offset="1" stopColor="#071513" />
          </linearGradient>
          <radialGradient id={`face-${industry}`} cx="50%" cy="35%" r="80%">
            <stop offset="0" stopColor="#18342F" />
            <stop offset="1" stopColor="#050D0C" />
          </radialGradient>
          <filter id={`glow-${industry}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <ellipse cx="120" cy="226" rx="58" ry="9" fill="#000" opacity="0.22" />

        <motion.g
          animate={reduceMotion || !isThinking ? undefined : { rotate: 360 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '120px 116px' }}
          opacity={isThinking ? 0.8 : 0.32}
        >
          <circle cx="120" cy="116" r="99" fill="none" stroke={theme.secondary} strokeWidth="1" strokeDasharray="7 13" />
          <circle cx="120" cy="17" r="3" fill={theme.accent} />
        </motion.g>

        <path d="M120 43V28" stroke="#98AEA6" strokeWidth="4" strokeLinecap="round" />
        <motion.circle
          cx="120"
          cy="23"
          r="7"
          fill={theme.accent}
          filter={`url(#glow-${industry})`}
          animate={reduceMotion ? undefined : { opacity: isThinking ? [0.45, 1, 0.45] : [0.7, 1, 0.7], scale: isThinking ? [0.85, 1.18, 0.85] : [1, 1.04, 1] }}
          transition={{ duration: isThinking ? 0.9 : 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '120px 23px' }}
        />

        <rect x="31" y="83" width="20" height="47" rx="10" fill="#B8CBC4" />
        <rect x="189" y="83" width="20" height="47" rx="10" fill="#B8CBC4" />
        <rect x="42" y="42" width="156" height="112" rx="47" fill={`url(#shell-${industry})`} stroke="#FFFFFF" strokeOpacity="0.62" />
        <rect x="59" y="59" width="122" height="76" rx="30" fill={`url(#face-${industry})`} stroke={theme.secondary} strokeOpacity="0.22" />
        <path d="M74 69C94 55 147 53 169 70" fill="none" stroke="#FFFFFF" strokeOpacity="0.07" strokeWidth="5" strokeLinecap="round" />

        <motion.g style={{ x: eyeX, y: eyeY }}>
          <motion.rect
            x="84"
            y="86"
            width="18"
            height="23"
            rx="9"
            fill={theme.secondary}
            filter={`url(#glow-${industry})`}
            animate={{ scaleY: blinking ? 0.12 : isListening ? 1.08 : 1 }}
            transition={{ duration: 0.11 }}
            style={{ transformOrigin: '93px 97.5px' }}
          />
          <motion.rect
            x="138"
            y="86"
            width="18"
            height="23"
            rx="9"
            fill={theme.secondary}
            filter={`url(#glow-${industry})`}
            animate={{ scaleY: blinking ? 0.12 : isListening ? 1.08 : 1 }}
            transition={{ duration: 0.11 }}
            style={{ transformOrigin: '147px 97.5px' }}
          />
        </motion.g>

        <motion.path
          d="M108 119Q120 125 132 119"
          fill="none"
          stroke={theme.accent}
          strokeWidth="3"
          strokeLinecap="round"
          animate={{ d: isThinking ? 'M109 121Q120 117 131 121' : 'M108 119Q120 125 132 119' }}
          transition={{ duration: 0.2 }}
        />

        <path d="M72 163C78 148 94 141 120 141C146 141 162 148 168 163L181 210C164 222 145 228 120 228C95 228 76 222 59 210L72 163Z" fill={`url(#coat-${industry})`} stroke="#FFFFFF" strokeOpacity="0.1" />
        <path d="M88 151L112 170L99 204L74 162C77 157 82 153 88 151Z" fill="#1C4C42" />
        <path d="M152 151L128 170L141 204L166 162C163 157 158 153 152 151Z" fill="#1C4C42" />
        <path d="M112 170L120 180L128 170L120 151L112 170Z" fill="#E8F1ED" />
        <path d="M120 181V214" stroke={theme.secondary} strokeOpacity="0.18" />

        {industry === 'inmobiliaria' ? (
          <g>
            <path d="M149 181L158 173L167 181V194H151V184" fill="none" stroke={theme.accent} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="158" cy="183" r="18" fill="none" stroke={theme.accent} strokeOpacity="0.16" />
          </g>
        ) : null}
        {industry === 'legal' ? <path d="M151 176H168M154 182H165M157 188H162" stroke={theme.accent} strokeWidth="2.2" strokeLinecap="round" /> : null}
        {industry === 'escribania' ? <circle cx="159" cy="183" r="10" fill="none" stroke={theme.accent} strokeWidth="2.2" /> : null}

        <circle cx="120" cy="216" r="3" fill={theme.accent} />
      </motion.svg>

      {showHint ? (
        <span className="pointer-events-none absolute bottom-0 translate-y-[115%] rounded-md border border-white/10 bg-[#071110]/88 px-2.5 py-1 font-ui text-[10px] font-semibold text-[#C9D5D1] opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md transition-[opacity,transform] duration-150 group-hover:translate-y-[108%] group-hover:opacity-100 group-focus-visible:translate-y-[108%] group-focus-visible:opacity-100">
          Tocame para conversar
        </span>
      ) : null}
    </motion.button>
  );
}
