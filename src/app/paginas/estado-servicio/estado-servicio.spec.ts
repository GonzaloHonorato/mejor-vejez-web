import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { EstadoServicio } from './estado-servicio';

describe('EstadoServicio', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstadoServicio],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('muestraApiYBaseDisponiblesCuandoLaSaludEstaDisponible', async () => {
    const fixture = TestBed.createComponent(EstadoServicio);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/salud'))
      .flush({
        estado: 'DISPONIBLE',
        servicio: 'mejor-vejez-api',
        version: '1.0.0',
        fechaHora: new Date().toISOString(),
        baseDatos: { estado: 'DISPONIBLE', latenciaMs: 12 },
      });
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Todos los servicios funcionan correctamente.');
    expect(texto).toContain('12 ms');
    fixture.destroy();
  });

  it('avisaCuandoNoHayConexionConLaApi', async () => {
    const fixture = TestBed.createComponent(EstadoServicio);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/salud'))
      .error(new ProgressEvent('error'));
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('No pudimos conectar con la API.');
    expect(texto).toContain('Sin conexión');
    fixture.destroy();
  });

  it('ofreceVolverAlPanelSinMensajeDeEnConstruccion', () => {
    const fixture = TestBed.createComponent(EstadoServicio);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((req) => req.url.endsWith('/api/salud'));
    const elemento = fixture.nativeElement as HTMLElement;
    const enlace = Array.from(elemento.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Volver al panel'),
    );
    expect(enlace?.getAttribute('href')).toBe('/');
    expect(elemento.textContent).not.toContain('En construcción');
    expect(elemento.textContent).not.toContain('Estamos construyendo');
    fixture.destroy();
  });

  it('cadaServicioMuestraUnChipConElTonoDeSuEstado', async () => {
    const fixture = TestBed.createComponent(EstadoServicio);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/salud'))
      .flush({
        estado: 'DEGRADADO',
        servicio: 'mejor-vejez-api',
        version: '1.0.0',
        fechaHora: new Date().toISOString(),
        baseDatos: { estado: 'NO_DISPONIBLE', latenciaMs: null },
      });
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    const chips = Array.from(elemento.querySelectorAll('.estado__fila .mv-chip'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Disponible', 'No disponible']);
    expect(chips[0].classList.contains('mv-chip--exito')).toBe(true);
    expect(chips[1].classList.contains('mv-chip--peligro')).toBe(true);
    const volver = elemento.querySelector('a.volver');
    expect(volver?.querySelector('app-icono')?.getAttribute('aria-hidden')).toBe('true');
    expect(elemento.querySelector('h1.mv-encabezado__titulo')?.textContent).toContain(
      'Estado del servicio',
    );
    fixture.destroy();
  });
});
