import { expandirHorario, reconstruirHorario, validarHorario, type HorarioJson } from './horario';

describe('validarHorario', () => {
  it('validaElEjemploDelContrato', () => {
    expect(
      validarHorario({ version: 1, tipo: 'HORAS_FIJAS', horas: ['08:00', '20:00'] }),
    ).toBeNull();

    expect(
      validarHorario({
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '08:00',
        hora_fin: '20:00',
        frecuencia_horas: 8,
      }),
    ).toBeNull();
  });

  it.each<[string, unknown, string]>([
    ['version ausente', { tipo: 'HORAS_FIJAS', horas: ['08:00'] }, 'Versión de horario no soportada (se espera 1)'],
    [
      'version 2',
      { version: 2, tipo: 'HORAS_FIJAS', horas: ['08:00'] },
      'Versión de horario no soportada (se espera 1)',
    ],
    ['tipo ausente', { version: 1, horas: ['08:00'] }, 'Tipo de horario no válido'],
    [
      'tipo desconocido',
      { version: 1, tipo: 'OTRO', horas: ['08:00'] },
      'Tipo de horario no válido',
    ],
    ['HORAS_FIJAS sin horas', { version: 1, tipo: 'HORAS_FIJAS' }, 'Indica al menos una hora'],
    [
      'HORAS_FIJAS con arreglo vacío',
      { version: 1, tipo: 'HORAS_FIJAS', horas: [] },
      'Indica al menos una hora',
    ],
    [
      'HORAS_FIJAS con "8:00"',
      { version: 1, tipo: 'HORAS_FIJAS', horas: ['8:00'] },
      'Hora no válida: 8:00 (usa HH:mm)',
    ],
    [
      'HORAS_FIJAS con "24:00"',
      { version: 1, tipo: 'HORAS_FIJAS', horas: ['24:00'] },
      'Hora no válida: 24:00 (usa HH:mm)',
    ],
    [
      'HORAS_FIJAS con "08:60"',
      { version: 1, tipo: 'HORAS_FIJAS', horas: ['08:60'] },
      'Hora no válida: 08:60 (usa HH:mm)',
    ],
    [
      'HORAS_FIJAS con duplicados',
      { version: 1, tipo: 'HORAS_FIJAS', horas: ['08:00', '08:00'] },
      'Hay horas repetidas',
    ],
    [
      'INTERVALO con frecuencia 0',
      {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '08:00',
        hora_fin: '20:00',
        frecuencia_horas: 0,
      },
      'La frecuencia debe ser un número entero de horas entre 1 y 24',
    ],
    [
      'INTERVALO con frecuencia 25',
      {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '08:00',
        hora_fin: '20:00',
        frecuencia_horas: 25,
      },
      'La frecuencia debe ser un número entero de horas entre 1 y 24',
    ],
    [
      'INTERVALO con frecuencia 1.5',
      {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '08:00',
        hora_fin: '20:00',
        frecuencia_horas: 1.5,
      },
      'La frecuencia debe ser un número entero de horas entre 1 y 24',
    ],
    [
      'INTERVALO con hora_fin igual a hora_inicio',
      {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '08:00',
        hora_fin: '08:00',
        frecuencia_horas: 8,
      },
      'La hora de fin debe ser posterior a la de inicio (sin cruzar medianoche)',
    ],
    [
      'INTERVALO con hora_fin anterior a hora_inicio',
      {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '20:00',
        hora_fin: '08:00',
        frecuencia_horas: 8,
      },
      'La hora de fin debe ser posterior a la de inicio (sin cruzar medianoche)',
    ],
    [
      'HORAS_FIJAS con atributos de INTERVALO mezclados',
      { version: 1, tipo: 'HORAS_FIJAS', horas: ['08:00'], hora_inicio: '08:00' },
      'El horario tiene atributos no permitidos: hora_inicio',
    ],
    [
      'INTERVALO con atributos de HORAS_FIJAS mezclados',
      {
        version: 1,
        tipo: 'INTERVALO',
        hora_inicio: '08:00',
        hora_fin: '20:00',
        frecuencia_horas: 8,
        horas: ['08:00'],
      },
      'El horario tiene atributos no permitidos: horas',
    ],
    ['horario nulo', null, 'El horario es obligatorio'],
    ['horario que no es objeto', '08:00', 'El horario es obligatorio'],
  ])('rechazaLosMismosCasosQueLaApi: %s', (_descripcion, horario, mensaje) => {
    expect(validarHorario(horario)).toBe(mensaje);
  });

  it('ordenaAlfabeticamenteLosAtributosNoPermitidosSinImportarElOrdenDeInsercion', () => {
    // Orden de inserción deliberadamente no alfabético: hora_inicio antes de frecuencia_horas.
    const horario = {
      version: 1,
      tipo: 'HORAS_FIJAS',
      horas: ['08:00'],
      hora_inicio: '08:00',
      frecuencia_horas: 8,
    };

    expect(validarHorario(horario)).toBe(
      'El horario tiene atributos no permitidos: frecuencia_horas, hora_inicio',
    );
  });

  it('horaInicioMalFormadaEnIntervaloDevuelveElValorRecibido', () => {
    const horario = {
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '8:00',
      hora_fin: '20:00',
      frecuencia_horas: 8,
    };

    expect(validarHorario(horario)).toBe('Hora no válida: 8:00 (usa HH:mm)');
  });

  it('horaFinAusenteEnIntervaloSeMuestraComoVacia', () => {
    const horario = { version: 1, tipo: 'INTERVALO', hora_inicio: '08:00', frecuencia_horas: 8 };

    expect(validarHorario(horario)).toBe('Hora no válida: (vacía) (usa HH:mm)');
  });

  it('conVariosErroresPrevaleceElDeVersionSobreElDeTipo', () => {
    const horario = { version: 2, tipo: 'OTRO_DESCONOCIDO' };

    expect(validarHorario(horario)).toBe('Versión de horario no soportada (se espera 1)');
  });

  it('horaEnBlancoDentroDeHorasFijasSeMuestraComoVacia', () => {
    const horario = { version: 1, tipo: 'HORAS_FIJAS', horas: ['   '] };

    expect(validarHorario(horario)).toBe('Hora no válida: (vacía) (usa HH:mm)');
  });

  it('horaNoTextoDentroDeHorasFijasSeMuestraComoSuJson', () => {
    const horario = { version: 1, tipo: 'HORAS_FIJAS', horas: [{ x: 1 }] };

    expect(validarHorario(horario)).toBe('Hora no válida: {"x":1} (usa HH:mm)');
  });

  it('horaInicioEnBlancoEnIntervaloSeMuestraComoVacia', () => {
    const horario = {
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '   ',
      hora_fin: '20:00',
      frecuencia_horas: 8,
    };

    expect(validarHorario(horario)).toBe('Hora no válida: (vacía) (usa HH:mm)');
  });

  it('horaFinNoTextoEnIntervaloSeMuestraComoSuJson', () => {
    const horario = {
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '08:00',
      hora_fin: ['20:00'],
      frecuencia_horas: 8,
    };

    expect(validarHorario(horario)).toBe('Hora no válida: ["20:00"] (usa HH:mm)');
  });

  it('enIntervaloPrevaleceElErrorDeHoraInicioSobreElDeFrecuencia', () => {
    const horario = {
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '8:00',
      hora_fin: '20:00',
      frecuencia_horas: 0,
    };

    expect(validarHorario(horario)).toBe('Hora no válida: 8:00 (usa HH:mm)');
  });
});

describe('expandirHorario', () => {
  it('expandeIntervalo', () => {
    const horario: HorarioJson = {
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '08:00',
      hora_fin: '20:00',
      frecuencia_horas: 8,
    };

    expect(expandirHorario(horario)).toEqual(['08:00', '16:00']);
  });

  it('ordenaYNoRepiteLasHorasFijas', () => {
    const horario: HorarioJson = { version: 1, tipo: 'HORAS_FIJAS', horas: ['22:00', '08:00'] };

    expect(expandirHorario(horario)).toEqual(['08:00', '22:00']);
  });
});

describe('reconstruirHorario', () => {
  it('reconstruyeIntervaloDesdeHorasEquiespaciadas', () => {
    expect(reconstruirHorario(['08:00', '16:00'])).toEqual({
      version: 1,
      tipo: 'INTERVALO',
      hora_inicio: '08:00',
      hora_fin: '16:00',
      frecuencia_horas: 8,
    });
  });

  it('horasIrregularesQuedanFijas', () => {
    expect(reconstruirHorario(['08:00', '09:30', '11:00'])).toEqual({
      version: 1,
      tipo: 'HORAS_FIJAS',
      horas: ['08:00', '09:30', '11:00'],
    });
  });

  it('unaSolaHoraQuedaFija', () => {
    expect(reconstruirHorario(['08:00'])).toEqual({
      version: 1,
      tipo: 'HORAS_FIJAS',
      horas: ['08:00'],
    });
  });
});
