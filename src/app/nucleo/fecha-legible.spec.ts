import {
  fechaConAnio,
  fechaHoraConAnio,
  fechaHoraLegible,
  fechaLarga,
  fechaLegible,
} from './fecha-legible';

describe('fechaHoraLegible', () => {
  it('hoyMuestraSoloHoyYLaHora', () => {
    expect(fechaHoraLegible('2026-10-26T20:30:00-03:00', '2026-10-26')).toBe('Hoy 20:30');
  });

  it('mananaMuestraMananaYLaHora', () => {
    expect(fechaHoraLegible('2026-10-27T08:00:00-03:00', '2026-10-26')).toBe('Mañana 08:00');
  });

  it('otroDiaMuestraDiaAbreviadoFechaYHora', () => {
    expect(fechaHoraLegible('2026-10-26T20:30:00-03:00', '2026-10-30')).toBe('Lun 26 oct · 20:30');
  });

  it('usaElDiaEnSantiagoNoEnUtc', () => {
    // 01:30 UTC del 27 = 22:30 del 26 en Santiago (UTC-3).
    expect(fechaHoraLegible('2026-10-27T01:30:00Z', '2026-10-26')).toBe('Hoy 22:30');
  });

  it('abreviaDiasConTilde', () => {
    expect(fechaHoraLegible('2026-10-28T09:00:00-03:00', '2026-11-05')).toBe('Mié 28 oct · 09:00');
    expect(fechaHoraLegible('2026-10-31T09:00:00-03:00', '2026-11-05')).toBe('Sáb 31 oct · 09:00');
  });
});

describe('fechaLegible', () => {
  it('fechaCalendarioDeHoyEsHoy', () => {
    expect(fechaLegible('2026-10-26', '2026-10-26')).toBe('Hoy');
  });

  it('fechaCalendarioNoSeCorreAlDiaAnterior', () => {
    expect(fechaLegible('2026-11-02', '2026-10-26')).toBe('Lun 2 nov');
  });

  it('instanteUsaSuDiaEnSantiago', () => {
    expect(fechaLegible('2026-10-27T01:30:00Z', '2026-10-20')).toBe('Lun 26 oct');
  });

  it('mananaEsManana', () => {
    expect(fechaLegible('2026-10-27', '2026-10-26')).toBe('Mañana');
  });
});

describe('fechaLarga', () => {
  it('nombraElDiaConMayusculaYElMesCompleto', () => {
    expect(fechaLarga('2026-10-31')).toBe('Sábado, 31 de octubre');
  });

  it('noDependeDeLaZonaDelNavegador', () => {
    expect(fechaLarga('2026-11-02')).toBe('Lunes, 2 de noviembre');
    expect(fechaLarga('2027-01-01')).toBe('Viernes, 1 de enero');
  });
});

describe('fechaConAnio', () => {
  it('fechaCalendarioConMesAbreviadoYAnio', () => {
    expect(fechaConAnio('2026-10-26')).toBe('26 oct 2026');
    expect(fechaConAnio('2027-01-01')).toBe('1 ene 2027');
  });

  it('instanteUsaSuDiaEnSantiago', () => {
    // 01:30 UTC del 1 de enero = 22:30 del 31 de diciembre en Santiago.
    expect(fechaConAnio('2027-01-01T01:30:00Z')).toBe('31 dic 2026');
  });

  it('sinFechaEsCadenaVacia', () => {
    expect(fechaConAnio(null)).toBe('');
    expect(fechaConAnio(undefined)).toBe('');
    expect(fechaConAnio('')).toBe('');
  });
});

describe('fechaHoraConAnio', () => {
  it('agregaLaHoraDeSantiago', () => {
    expect(fechaHoraConAnio('2026-11-03T13:00:00Z')).toBe('3 nov 2026 · 10:00');
  });
});
