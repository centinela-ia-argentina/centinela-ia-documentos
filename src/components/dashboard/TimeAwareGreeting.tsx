'use client';

import { useSyncExternalStore } from 'react';

interface TimeAwareGreetingProps {
  name: string;
}

function greetingForHour(hour: number) {
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
  return 'Buenos días';
}

export function TimeAwareGreeting({ name }: TimeAwareGreetingProps) {
  const greeting = useSyncExternalStore(
    subscribeToClock,
    getGreetingSnapshot,
    getServerGreetingSnapshot
  );

  return (
    <>
      {greeting}, {name}.
    </>
  );
}
