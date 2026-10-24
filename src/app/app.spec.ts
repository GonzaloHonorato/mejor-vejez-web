import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EnConstruccion } from './pages/en-construccion/en-construccion';

describe('EnConstruccion', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnConstruccion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('muestra API y BD disponibles cuando el health está UP', async () => {
    const fixture = TestBed.createComponent(EnConstruccion);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/health'))
      .flush({
        status: 'UP',
        service: 'mejor-vejez-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: { status: 'UP', latencyMs: 12 },
      });
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Todos los servicios funcionan correctamente.');
    expect(text).toContain('12 ms');
    fixture.destroy();
  });

  it('avisa cuando no hay conexión con la API', async () => {
    const fixture = TestBed.createComponent(EnConstruccion);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/api/health'))
      .error(new ProgressEvent('error'));
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No pudimos conectar con la API.');
    expect(text).toContain('Sin conexión');
    fixture.destroy();
  });
});
