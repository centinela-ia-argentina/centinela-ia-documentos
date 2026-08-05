'use server';

import { guardarEventoManual, GuardarEventoResult } from '@/app/agenda/actions';

export type GuardarPlazoResult = GuardarEventoResult;

export async function guardarPlazoEnAgenda(input: {
  titulo: string;
  fecha: string; // 'YYYY-MM-DD'
  detalle?: string;
}): Promise<GuardarPlazoResult> {
  return guardarEventoManual({
    titulo: input.titulo,
    fecha: input.fecha,
    detalle: input.detalle,
  });
}

