import {
  INTERVALOS_SIMPLES,
  configuracionSimpleDeHoras,
  diasEntre,
  fechaFinSimple,
  horarioSimple,
  horasDesdePrimeraToma,
  horasEnOrdenDeToma,
  primeraTomaPorRegla,
  resumenSimple,
  textoHorarioGuardado,
} from './horario-simple';

describe('horasDesdePrimeraToma', () => {
  it('cada8DesdeLas8DaLaVueltaALas24', () => {
    expect(horasDesdePrimeraToma('08:00', 8)).toEqual(['08:00', '16:00', '00:00']);
  });

  it('cada12DesdeLas9', () => {
    expect(horasDesdePrimeraToma('09:00', 12)).toEqual(['09:00', '21:00']);
  });

  it('cada24EsUnaSolaToma', () => {
    expect(horasDesdePrimeraToma('07:30', 24)).toEqual(['07:30']);
  });

  it('cada4DesdeLas6SonSeisTomas', () => {
    expect(horasDesdePrimeraToma('06:00', 4)).toEqual([
      '06:00',
      '10:00',
      '14:00',
      '18:00',
      '22:00',
      '02:00',
    ]);
  });

  it('respetaLosMinutos', () => {
    expect(horasDesdePrimeraToma('08:30', 6)).toEqual(['08:30', '14:30', '20:30', '02:30']);
  });
});

describe('horarioSimple', () => {
  it('esHorasFijasOrdenadas', () => {
    expect(horarioSimple('08:00', 8)).toEqual({
      version: 1,
      tipo: 'HORAS_FIJAS',
      horas: ['00:00', '08:00', '16:00'],
    });
  });
});

describe('fechaFinSimple', () => {
  it('sieteDiasDesdeEl2TerminanEl8', () => {
    expect(fechaFinSimple('2026-11-02', 7)).toBe('2026-11-08');
  });

  it('unDiaTerminaElMismoDia', () => {
    expect(fechaFinSimple('2026-11-02', 1)).toBe('2026-11-02');
  });

  it('cruzaDeMesYDeAnio', () => {
    expect(fechaFinSimple('2026-12-28', 7)).toBe('2027-01-03');
  });
});

describe('diasEntre', () => {
  it('cuentaAmbosExtremos', () => {
    expect(diasEntre('2026-11-02', '2026-11-08')).toBe(7);
    expect(diasEntre('2026-11-02', '2026-11-02')).toBe(1);
    expect(diasEntre('2026-11-08', '2026-11-02')).toBe(-5);
  });
});

describe('configuracionSimpleDeHoras', () => {
  it('reconoceCadaIntervaloDeLaLista', () => {
    expect(configuracionSimpleDeHoras(['00:00', '08:00', '16:00'])).toEqual({
      primeraToma: '08:00',
      cada: 8,
    });
    expect(configuracionSimpleDeHoras(['21:00', '09:00'])).toEqual({
      primeraToma: '09:00',
      cada: 12,
    });
    expect(configuracionSimpleDeHoras(['07:30'])).toEqual({ primeraToma: '07:30', cada: 24 });
    expect(
      configuracionSimpleDeHoras(['02:00', '06:00', '10:00', '14:00', '18:00', '22:00']),
    ).toEqual({ primeraToma: '06:00', cada: 4 });
    expect(configuracionSimpleDeHoras(['02:30', '08:30', '14:30', '20:30'])).toEqual({
      primeraToma: '08:30',
      cada: 6,
    });
  });

  it('rechazaLoQueNoCubreElDiaParejo', () => {
    // 08 y 16: cada 8, pero no cubre el día (faltan las 00:00).
    expect(configuracionSimpleDeHoras(['08:00', '16:00'])).toBeNull();
    // Desparejas.
    expect(configuracionSimpleDeHoras(['08:00', '14:00', '20:00'])).toBeNull();
    // Cada 3: cubre el día pero no está en la lista.
    expect(
      configuracionSimpleDeHoras([
        '00:00',
        '03:00',
        '06:00',
        '09:00',
        '12:00',
        '15:00',
        '18:00',
        '21:00',
      ]),
    ).toBeNull();
    expect(configuracionSimpleDeHoras([])).toBeNull();
  });

  it('laListaDeIntervalosEsLaDelPedido', () => {
    expect(INTERVALOS_SIMPLES).toEqual([4, 6, 8, 12, 24]);
  });
});

describe('resumenSimple', () => {
  it('textoDelPedido', () => {
    expect(resumenSimple('08:00', 8, '2026-11-02', 7)).toBe(
      'Se tomará a las 08:00, 16:00 y 00:00, todos los días, del lun 2 nov al dom 8 nov 2026 (7 días).',
    );
  });

  it('unaTomaYUnDia', () => {
    expect(resumenSimple('09:00', 24, '2026-11-02', 1)).toBe(
      'Se tomará a las 09:00, todos los días, solo el lun 2 nov 2026 (1 día).',
    );
  });

  it('aLaUnaEnSingular', () => {
    expect(resumenSimple('01:00', 24, '2026-11-02', 2)).toBe(
      'Se tomará a la 01:00, todos los días, del lun 2 nov al mar 3 nov 2026 (2 días).',
    );
  });

  it('dosTomas', () => {
    expect(resumenSimple('09:00', 12, '2026-11-02', 7)).toContain('a las 09:00 y 21:00,');
  });

  it('cruzaDeAnioMuestraAmbosAnios', () => {
    expect(resumenSimple('08:00', 24, '2026-12-28', 7)).toBe(
      'Se tomará a las 08:00, todos los días, del lun 28 dic 2026 al dom 3 ene 2027 (7 días).',
    );
  });
});

describe('primeraTomaPorRegla', () => {
  it('esLaPrimeraHoraDesdeLas6', () => {
    expect(primeraTomaPorRegla(['00:00', '08:00', '16:00'])).toBe('08:00');
    expect(primeraTomaPorRegla(['16:00', '06:00'])).toBe('06:00');
    expect(primeraTomaPorRegla(['05:59', '23:00'])).toBe('23:00');
  });

  it('sinHorasDesdeLas6EsLaMasTemprana', () => {
    expect(primeraTomaPorRegla(['04:00', '00:00'])).toBe('00:00');
  });
});

describe('horasEnOrdenDeToma', () => {
  it('ordenaDesdeLaPrimeraTomaYDaLaVuelta', () => {
    expect(horasEnOrdenDeToma(['16:00', '00:00', '08:00'])).toEqual(['08:00', '16:00', '00:00']);
    expect(horasEnOrdenDeToma(['01:00', '03:00'])).toEqual(['01:00', '03:00']);
  });
});

describe('textoHorarioGuardado', () => {
  it('horasQueCubrenElDiaLlevanElIntervaloYEmpiezanDesdeLaPrimeraToma', () => {
    expect(textoHorarioGuardado(['00:00', '08:00', '16:00'])).toBe(
      'Cada 8 h: 08:00, 16:00 y 00:00',
    );
    expect(textoHorarioGuardado(['21:00', '09:00'])).toBe('Cada 12 h: 09:00 y 21:00');
    expect(
      textoHorarioGuardado([
        '00:00',
        '03:00',
        '06:00',
        '09:00',
        '12:00',
        '15:00',
        '18:00',
        '21:00',
      ]),
    ).toBe('Cada 3 h: 06:00, 09:00, 12:00, 15:00, 18:00, 21:00, 00:00 y 03:00');
  });

  it('intervaloQueNoCruzaMedianocheSigueIgual', () => {
    expect(textoHorarioGuardado(['08:00', '16:00'])).toBe('Cada 8 h de 08:00 a 16:00');
    expect(textoHorarioGuardado(['08:00', '12:00', '16:00', '20:00'])).toBe(
      'Cada 4 h de 08:00 a 20:00',
    );
  });

  it('horasFijasSeListanEnOrdenDeToma', () => {
    expect(textoHorarioGuardado(['09:00', '13:00', '19:00'])).toBe('09:00, 13:00 y 19:00');
    expect(textoHorarioGuardado(['00:00', '20:00', '08:00'])).toBe('08:00, 20:00 y 00:00');
  });

  it('unaSolaHoraEsLaHora', () => {
    expect(textoHorarioGuardado(['08:00'])).toBe('08:00');
  });
});
