import { formatearFecha, hoyEnSantiago } from './fechas';

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
