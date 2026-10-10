'use client';

import { useSyncExternalStore } from 'react';

interface TimeAwareGreetingProps {
  name: string;
}

function greetingForHour(hour: number) {
  if (hour < 6) return 'Buenas noches';
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function subscribeToClock(onStoreChange: () => void) {
  const timer = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(timer);
}

function getGreetingSnapshot() {
  return greetingForHour(new Date().getHours());
}

function getServerGreetingSnapshot() {
  return 'Hola';
}

function getDateSnapshot() {
  const value = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getServerDateSnapshot() {
  return 'Resumen actualizado';
}

export function TimeAwareGreeting({ name }: TimeAwareGreetingProps) {
  const greeting = useSyncExternalStore(
    subscribeToClock,
    getGreetingSnapshot,
    getServerGreetingSnapshot
  );

  return <>{greeting}, {name}.</>;
}

export function LocalDateLabel() {
  const label = useSyncExternalStore(
    subscribeToClock,
    getDateSnapshot,
    getServerDateSnapshot
  );

  return <>{label}</>;
}
