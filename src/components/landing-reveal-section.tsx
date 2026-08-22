'use client';

import {
  type ComponentPropsWithoutRef,
  useEffect,
  useRef,
  useState,
} from 'react';

type RevealSectionProps = ComponentPropsWithoutRef<'section'>;

export function RevealSection({
  children,
  className = '',
  ...props
}: RevealSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`landing-section ${isVisible ? 'is-visible' : ''} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
