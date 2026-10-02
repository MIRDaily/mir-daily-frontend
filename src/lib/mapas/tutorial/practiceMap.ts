import type { MapDoc } from '@/lib/mapas/types'

// El mapa con el que se practica en el tutorial (/mapas/tutorial). Es un ÁRBOL (formato v1): el
// editor lo convierte y lo ordena al abrirlo, igual que un mapa importado. No se guarda nunca.
//
// Pequeño a propósito (15 nodos): cabe entero en pantalla con el panel de la mascota, y aun así
// tiene lo que piden las lecciones —ramas con hijos para plegar y mover, un nodo con "BNP" para
// buscar y categorías distintas para ver el color de cada una—.

export const PRACTICE_TITLE = 'Mapa de práctica'

export const PRACTICE_IDS = {
  root: 'ic',
  definicion: 'def',
  etiologia: 'eti',
  clinica: 'cli',
  diagnostico: 'dx',
  tratamiento: 'tto',
  bnp: 'dx-bnp',
} as const

export const PRACTICE_MAP: MapDoc = {
  version: 1,
  nodes: [
    { id: 'ic', parentId: null, text: 'Insuficiencia cardiaca', category: 'general' },

    { id: 'def', parentId: 'ic', text: 'Definición', category: 'definicion' },
    { id: 'def-1', parentId: 'def', text: 'El corazón no bombea lo que el cuerpo necesita', category: 'definicion' },

    { id: 'eti', parentId: 'ic', text: 'Etiología', category: 'etiologia' },
    { id: 'eti-1', parentId: 'eti', text: 'Cardiopatía isquémica', category: 'etiologia' },
    { id: 'eti-2', parentId: 'eti', text: 'HTA', category: 'etiologia' },

    { id: 'cli', parentId: 'ic', text: 'Clínica', category: 'clinica' },
    { id: 'cli-1', parentId: 'cli', text: 'Disnea', category: 'clinica' },
    { id: 'cli-2', parentId: 'cli', text: 'Edemas', category: 'clinica' },

    { id: 'dx', parentId: 'ic', text: 'Diagnóstico', category: 'diagnostico' },
    { id: 'dx-bnp', parentId: 'dx', text: 'Péptidos natriuréticos (BNP)', category: 'diagnostico' },
    { id: 'dx-eco', parentId: 'dx', text: 'Ecocardiograma: FEVI', category: 'diagnostico' },

    { id: 'tto', parentId: 'ic', text: 'Tratamiento', category: 'tratamiento' },
    { id: 'tto-1', parentId: 'tto', text: 'IECA / ARA-II', category: 'tratamiento' },
    { id: 'tto-2', parentId: 'tto', text: 'Diuréticos', category: 'tratamiento' },
  ],
}
