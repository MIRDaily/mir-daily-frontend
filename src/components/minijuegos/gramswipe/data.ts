export type Coverage = 'gram_positive' | 'gram_negative' | 'broad'

export type Antibiotic = {
  id: number
  name: string
  activeIngredient: string
  family: string
  mechanism: string
  coverage: Coverage
  image: string
}

export const ANTIBIOTICS: ReadonlyArray<Antibiotic> = [
  // ── GRAM + ──────────────────────────────────────────────────────────────
  {
    id: 1,
    name: 'Penicilina G',
    activeIngredient: 'Bencilpenicilina',
    family: 'Betalactámico — Penicilina natural',
    mechanism:
      'Inhibe la transpeptidasa (PBP), bloqueando el entrecruzamiento del peptidoglicano de la pared bacteriana.',
    coverage: 'gram_positive',
    image: '/img/gramswipe/1.jpg',
  },
  {
    id: 2,
    name: 'Oxacilina',
    activeIngredient: 'Oxacilina',
    family: 'Betalactámico — Penicilina antiestafilocócica',
    mechanism:
      'Resistente a penicilinasas estafilocócicas. Tratamiento de elección para S. aureus sensible a meticilina (SAMS).',
    coverage: 'gram_positive',
    image: '/img/gramswipe/2.jpg',
  },
  {
    id: 3,
    name: 'Vancomicina',
    activeIngredient: 'Vancomicina',
    family: 'Glucopéptido',
    mechanism:
      'Se une al extremo D-Ala-D-Ala del peptidoglicano naciente, impidiendo su polimerización. Activo frente a SARM.',
    coverage: 'gram_positive',
    image: '/img/gramswipe/3.jpg',
  },
  {
    id: 4,
    name: 'Clindamicina',
    activeIngredient: 'Clindamicina',
    family: 'Lincosamida',
    mechanism: 'Inhibe la subunidad 50S ribosomal bloqueando la síntesis proteica. También cubre anaerobios.',
    coverage: 'gram_positive',
    image: '/img/gramswipe/4.jpg',
  },
  {
    id: 5,
    name: 'Daptomicina',
    activeIngredient: 'Daptomicina',
    family: 'Lipopéptido cíclico',
    mechanism: 'Se inserta en la membrana citoplasmática y la despolariza rápidamente, destruyendo el potencial de membrana.',
    coverage: 'gram_positive',
    image: '/img/gramswipe/5.jpg',
  },
  {
    id: 6,
    name: 'Linezolid',
    activeIngredient: 'Linezolid',
    family: 'Oxazolidinona',
    mechanism: 'Inhibe la iniciación de la síntesis proteica uniéndose al ARNr 23S (subunidad 50S).',
    coverage: 'gram_positive',
    image: '/img/gramswipe/6.jpg',
  },
  {
    id: 7,
    name: 'Cefazolina',
    activeIngredient: 'Cefazolina',
    family: 'Cefalosporina 1.ª generación',
    mechanism: 'Inhibe PBPs. Buena actividad frente a S. aureus sensible a meticilina y estreptococos.',
    coverage: 'gram_positive',
    image: '/img/gramswipe/7.jpg',
  },
  // ── GRAM − ──────────────────────────────────────────────────────────────
  {
    id: 8,
    name: 'Aztreonam',
    activeIngredient: 'Aztreonam',
    family: 'Betalactámico — Monobactam',
    mechanism: 'Inhibe PBP3 de bacilos gramnegativos aerobios exclusivamente. Sin actividad sobre grampositivos ni anaerobios.',
    coverage: 'gram_negative',
    image: '/img/gramswipe/8.jpg',
  },
  {
    id: 9,
    name: 'Colistina',
    activeIngredient: 'Colistimetato (Polimixina E)',
    family: 'Polimixina',
    mechanism: 'Actúa como detergente catiónico sobre el LPS de la membrana externa gramnegativa, desestabilizándola.',
    coverage: 'gram_negative',
    image: '/img/gramswipe/9.jpg',
  },
  {
    id: 10,
    name: 'Gentamicina',
    activeIngredient: 'Gentamicina',
    family: 'Aminoglucósido',
    mechanism: 'Se une a la subunidad 30S ribosomal provocando lectura errónea del ARNm y síntesis de proteínas anómalas.',
    coverage: 'gram_negative',
    image: '/img/gramswipe/10.jpg',
  },
  {
    id: 11,
    name: 'Tobramicina',
    activeIngredient: 'Tobramicina',
    family: 'Aminoglucósido',
    mechanism: 'Similar a gentamicina. Especialmente activo frente a Pseudomonas aeruginosa.',
    coverage: 'gram_negative',
    image: '/img/gramswipe/11.jpg',
  },
  // ── AMPLIO ESPECTRO ───────────────────────────────────────────────────────
  {
    id: 12,
    name: 'Amoxicilina-Clavulánico',
    activeIngredient: 'Amoxicilina + Ácido clavulánico',
    family: 'Betalactámico + Inhibidor de betalactamasa',
    mechanism: 'Amoxicilina inhibe PBPs; clavulánico neutraliza betalactamasas de amplio espectro (no AmpC ni MBL).',
    coverage: 'broad',
    image: '/img/gramswipe/12.jpg',
  },
  {
    id: 13,
    name: 'Ampicilina-Sulbactam',
    activeIngredient: 'Ampicilina + Sulbactam',
    family: 'Betalactámico + Inhibidor de betalactamasa',
    mechanism: 'Espectro similar a amoxicilina-clavulánico. Sulbactam también tiene actividad intrínseca frente a Acinetobacter.',
    coverage: 'broad',
    image: '/img/gramswipe/13.jpg',
  },
  {
    id: 14,
    name: 'Piperacilina-Tazobactam',
    activeIngredient: 'Piperacilina + Tazobactam',
    family: 'Betalactámico antipseudomónico + Inhibidor de betalactamasa',
    mechanism: 'Piperacilina cubre Pseudomonas; tazobactam neutraliza BLEE. No activo frente a MBL.',
    coverage: 'broad',
    image: '/img/gramswipe/14.jpg',
  },
  {
    id: 15,
    name: 'Imipenem',
    activeIngredient: 'Imipenem + Cilastatina',
    family: 'Carbapenem',
    mechanism:
      'Inhibe múltiples PBPs con alta afinidad. Estable frente a la mayoría de betalactamasas (excepto MBL/KPC). Cilastatina impide degradación renal.',
    coverage: 'broad',
    image: '/img/gramswipe/15.jpg',
  },
  {
    id: 16,
    name: 'Meropenem',
    activeIngredient: 'Meropenem',
    family: 'Carbapenem',
    mechanism: 'Similar a imipenem. Mayor actividad frente a P. aeruginosa y menor riesgo de convulsiones.',
    coverage: 'broad',
    image: '/img/gramswipe/16.jpg',
  },
  {
    id: 17,
    name: 'Ertapenem',
    activeIngredient: 'Ertapenem',
    family: 'Carbapenem (1 vez/día)',
    mechanism: 'Carbapenem de vida media larga. NO cubre Pseudomonas ni Acinetobacter. Útil para BLEE comunitarias.',
    coverage: 'broad',
    image: '/img/gramswipe/17.jpg',
  },
  {
    id: 18,
    name: 'Ceftriaxona',
    activeIngredient: 'Ceftriaxona',
    family: 'Cefalosporina 3.ª generación',
    mechanism: 'Buen espectro gramnegativo (Enterobacterias, N. meningitidis, H. influenzae) y cocos grampositivos.',
    coverage: 'broad',
    image: '/img/gramswipe/18.jpg',
  },
  {
    id: 19,
    name: 'Cefepima',
    activeIngredient: 'Cefepima',
    family: 'Cefalosporina 4.ª generación',
    mechanism: 'Estable frente a AmpC. Cubre Pseudomonas y Enterobacterias. Mayor actividad grampositiva que ceftriaxona.',
    coverage: 'broad',
    image: '/img/gramswipe/19.jpg',
  },
  {
    id: 20,
    name: 'Ciprofloxacino',
    activeIngredient: 'Ciprofloxacino',
    family: 'Fluoroquinolona',
    mechanism: 'Inhibe ADN girasa (gramneg.) y topoisomerasa IV (grampos.), bloqueando la replicación del ADN bacteriano.',
    coverage: 'broad',
    image: '/img/gramswipe/20.jpg',
  },
  {
    id: 21,
    name: 'Levofloxacino',
    activeIngredient: 'Levofloxacino',
    family: 'Fluoroquinolona respiratoria',
    mechanism: 'L-isómero del ofloxacino. Mayor actividad sobre S. pneumoniae y Legionella. Cubre atípicos.',
    coverage: 'broad',
    image: '/img/gramswipe/21.jpg',
  },
  {
    id: 22,
    name: 'TMP-SMX',
    activeIngredient: 'Trimetoprima + Sulfametoxazol',
    family: 'Sulfonamida + Inhibidor de dihidrofolato reductasa',
    mechanism: 'Bloqueo secuencial de la síntesis de folato: SMX inhibe dihidropteroato sintasa; TMP inhibe dihidrofolato reductasa.',
    coverage: 'broad',
    image: '/img/gramswipe/22.jpg',
  },
  {
    id: 23,
    name: 'Doxiciclina',
    activeIngredient: 'Doxiciclina',
    family: 'Tetraciclina',
    mechanism: 'Inhibe la subunidad 30S ribosomal. Cubre atípicos (Mycoplasma, Chlamydia, Legionella), espiroquetas y algunos anaerobios.',
    coverage: 'broad',
    image: '/img/gramswipe/23.jpg',
  },
  {
    id: 24,
    name: 'Azitromicina',
    activeIngredient: 'Azitromicina',
    family: 'Macrólido — Azálido',
    mechanism: 'Inhibe la subunidad 50S ribosomal. Especialmente activo frente a atípicos (Mycoplasma, Chlamydia, Legionella).',
    coverage: 'broad',
    image: '/img/gramswipe/24.jpg',
  },
  {
    id: 25,
    name: 'Metronidazol',
    activeIngredient: 'Metronidazol',
    family: 'Nitroimidazol',
    mechanism: 'Se activa en células anaerobias generando radicales libres que dañan el ADN. Cubre Clostridium, Bacteroides y protozoos.',
    coverage: 'broad',
    image: '/img/gramswipe/25.jpg',
  },
]

export const COVERAGE_LABELS: Record<Coverage, string> = {
  gram_positive: 'Gram +',
  gram_negative: 'Gram −',
  broad: 'Amplio espectro',
}

export function shuffleArray<T>(arr: ReadonlyArray<T>): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
