'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { MotionCard } from '@/components/ui/MotionCard';
import type { NavItem } from '@/config/navigation';
import { navigation } from '@/config/navigation';
import { getNavItemLabel, getNavItemDescription } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';

export function ModulosGrid({ role, industry }: { role: string; industry: string }) {
  const modules = navigation.filter(
    (m) =>
      m.href !== '/dashboard' &&
      m.roles.includes(role) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (!m.industries || m.industries.includes(industry as any))
  );
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const label = (m: NavItem) => getNavItemLabel(m, industry as IndustryType);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const stored = localStorage.getItem('centinela_fav_modulos');
    if (stored) {
      try {
        setFavs(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleFav = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setFavs((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      localStorage.setItem('centinela_fav_modulos', JSON.stringify(next));
      return next;
    });
  };

  // Filter by query and sort: favorites first
  const filtered = modules
    .filter((m) => label(m).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const aFav = favs.includes(a.href) ? 1 : 0;
      const bFav = favs.includes(b.href) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return label(a).localeCompare(label(b));
    });

  // Since favs rely on localStorage, prevent hydration mismatch by not rendering sorted favs until mounted
  const displayModules = mounted ? filtered : modules.filter((m) => label(m).toLowerCase().includes(q.toLowerCase()));

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Módulos</h2>
          <p className="mt-1 text-sm text-slate-400">Acceso rápido a las herramientas de la plataforma.</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar módulo…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent sm:w-64"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayModules.map((m, i) => {
          const isFav = favs.includes(m.href);
          return (
            <Link key={m.href} href={m.href}>
              <MotionCard index={i} className="group h-full">
                <div className="flex items-start justify-between">
                  <span className="rounded-xl bg-cyan-500/10 p-2 transition-colors group-hover:bg-cyan-500/20">
                    <m.icon className="h-5 w-5 text-cyan-300" />
                  </span>
                  <button 
                    onClick={(e) => toggleFav(e, m.href)} 
                    className="p-1 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-60"
                  >
                    <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-400 opacity-100' : 'text-slate-400'}`} />
                  </button>
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-white group-hover:text-accent-soft">{label(m)}</h3>
                <p className="mt-1 text-sm text-slate-400">{getNavItemDescription(m, industry as IndustryType)}</p>
              </MotionCard>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
