import {
  fechaEnSantiago,
  formatearFecha,
  formatearHora,
  hoyEnSantiago,
  instanteSantiago,
  nombreDia,
  sumarDias,
} from './fechas';

describe('formatearFecha', () => {
  it('formateaIsoADdMmAaaa', () => {
    expect(formatearFecha('2026-03-05')).toBe('05-03-2026');
  });

  it('nuloDevuelveVacio', () => {
    expect(formatearFecha(null)).toBe('');
  });

  it('usaSoloLaParteDeFechaDeUnDatetimeIso', () => {
    expect(formatearFecha('2026-01-01T00:00:00-03:00')).toBe('01-01-2026');
  });
});

describe('hoyEnSantiago', () => {
  afterEach(() => vi.useRealTimers());

  it('devuelveLaFechaEnChileAunqueEnUtcYaSeaMañana', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 02:00 UTC del 1 de marzo = 23:00 del 28 de febrero en Santiago (UTC-3).
    vi.setSystemTime(new Date('2026-03-01T02:00:00Z'));

    expect(hoyEnSantiago()).toBe('2026-02-28');
  });

  it('devuelveYyyyMmDd', () => {
    expect(hoyEnSantiago()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatearHora', () => {
  it('formateaUnInstanteUtcComoHoraDeSantiagoEnFormato24h', () => {
    expect(formatearHora('2026-11-02T11:00:00Z')).toBe('08:00');
  });
});

describe('fechaEnSantiago', () => {
  it('convierteUnInstanteUtcAlDiaDeSantiago', () => {
    // 02:30 UTC del 3 de noviembre = 23:30 del 2 de noviembre en Santiago (UTC-3, DST).
    expect(fechaEnSantiago('2026-11-03T02:30:00Z')).toBe('2026-11-02');
  });
});

describe('sumarDias', () => {
  it('sumaUnDiaCruzandoFinDeMes', () => {
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('noDependeDeLaZonaHorariaDelProceso', () => {
    // Aritmética de calendario en UTC: no debe variar con TZ del proceso.
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('nombreDia', () => {
  it('devuelveElNombreDelDiaEnEspanol', () => {
    // 2026-11-02 es lunes.
    expect(nombreDia('2026-11-02')).toBe('lunes');
    expect(nombreDia('2026-11-08')).toBe('domingo');
  });
});

describe('instanteSantiago', () => {
  it('enHorarioDeVeranoUsaOffsetMenosTres', () => {
    expect(instanteSantiago('2026-11-02', '08:00')).toBe('2026-11-02T08:00:00-03:00');
  });

  it('despuesDelRetrocesoDeOtonoUsaOffsetMenosCuatro', () => {
    expect(instanteSantiago('2026-04-05', '10:00')).toBe('2026-04-05T10:00:00-04:00');
  });

  it('antesDelRetrocesoDeOtonoUsaOffsetMenosTres', () => {
    expect(instanteSantiago('2026-04-04', '10:00')).toBe('2026-04-04T10:00:00-03:00');
  });

  it('enElSaltoDePrimaveraUnaHoraInexistenteAvanzaIgualQueLaApi', () => {
    // 2026-09-06 00:00-00:59 no existe (el salto adelanta el reloj a la
    // 01:00): debe AVANZAR a la 01:30 con el offset nuevo (-03:00), nunca
    // retroceder a las 23:30 del 05-09.
    expect(instanteSantiago('2026-09-06', '00:30')).toBe('2026-09-06T01:30:00-03:00');
  });

  it('elMismoDiaDelSaltoDePrimaveraUnaHoraExistenteUsaOffsetMenosTres', () => {
    expect(instanteSantiago('2026-09-06', '10:00')).toBe('2026-09-06T10:00:00-03:00');
  });
});
