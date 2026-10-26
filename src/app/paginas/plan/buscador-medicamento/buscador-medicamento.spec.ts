import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { BuscadorMedicamento } from './buscador-medicamento';
import { RespuestaOpcionCatalogo } from '../../../nucleo/catalogos/servicio-catalogos';
import { RespuestaMedicamento } from '../../../nucleo/planificacion/modelos-planificacion';
import { ServicioMedicamentos } from '../../../nucleo/planificacion/servicio-medicamentos';

const PRESENTACIONES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 211, codigo: 'COMPRIMIDO', descripcion: 'Comprimido', orden: 1 },
  { idOpcion: 212, codigo: 'JARABE', descripcion: 'Jarabe', orden: 2 },
];

function medicamento(datos: Partial<RespuestaMedicamento> = {}): RespuestaMedicamento {
  return {
    idMedicamento: 1,
    nombre: 'Paracetamol',
    principioActivo: 'Paracetamol',
    idPresentacion: 211,
    concentracion: '500 mg',
    usadoEnGrupo: false,
    ...datos,
  };
}

async function configurar(resultados: RespuestaMedicamento[] = []) {
  const servicio = {
    buscar: vi.fn(() => of(resultados)),
    crear: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [BuscadorMedicamento],
    providers: [{ provide: ServicioMedicamentos, useValue: servicio }],
  });
  const fixture = TestBed.createComponent(BuscadorMedicamento);
  fixture.componentRef.setInput('idGrupo', 7);
  fixture.componentRef.setInput('presentaciones', PRESENTACIONES);
  const elegidos: RespuestaMedicamento[] = [];
  fixture.componentInstance.elegido.subscribe((m) => elegidos.push(m));
  await fixture.whenStable();
  return { fixture, servicio, elegidos, elemento: fixture.nativeElement as HTMLElement };
}

function escribir(input: HTMLInputElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

function botonConTexto(elemento: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(elemento.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(texto),
  );
}

describe('BuscadorMedicamento', () => {
  beforeEach(() => {
    // Solo el reloj de rxjs (setInterval + Date): el planificador de Angular sigue con timers reales.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buscaConEspera', async () => {
    const { fixture, servicio, elegidos, elemento } = await configurar([
      medicamento({ idMedicamento: 300, usadoEnGrupo: true }),
      medicamento({ idMedicamento: 301, nombre: 'Paracetamol forte', concentracion: '1 g' }),
    ]);
    const campo = elemento.querySelector<HTMLInputElement>('#buscador-medicamento-texto')!;

    escribir(campo, 'pa');
    vi.advanceTimersByTime(200);
    escribir(campo, 'para');
    vi.advanceTimersByTime(299);
    expect(servicio.buscar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await fixture.whenStable();
    expect(servicio.buscar).toHaveBeenCalledTimes(1);
    expect(servicio.buscar).toHaveBeenCalledWith(7, 'para');

    const resultados = Array.from(elemento.querySelectorAll('.resultado'));
    expect(resultados).toHaveLength(2);
    expect(resultados[0].textContent).toContain('Paracetamol');
    expect(resultados[0].textContent).toContain('500 mg');
    expect(resultados[0].textContent).toContain('Comprimido');
    expect(resultados[0].textContent).toContain('Usado en este grupo');
    expect(resultados[1].textContent).not.toContain('Usado en este grupo');
    expect(botonConTexto(elemento, 'Agregar «para» al catálogo')).toBeDefined();

    (resultados[1] as HTMLButtonElement).click();
    expect(elegidos.map((m) => m.idMedicamento)).toEqual([301]);
  });

  it('crearAlCatalogoEligeElDevuelto', async () => {
    const { fixture, servicio, elegidos, elemento } = await configurar([]);
    const existente = medicamento({ idMedicamento: 900, usadoEnGrupo: true });
    servicio.crear.mockReturnValue(of(existente));

    escribir(
      elemento.querySelector<HTMLInputElement>('#buscador-medicamento-texto')!,
      '  Paracetamol ',
    );
    vi.advanceTimersByTime(300);
    await fixture.whenStable();

    botonConTexto(elemento, 'Agregar «Paracetamol» al catálogo')!.click();
    await fixture.whenStable();

    const nombre = elemento.querySelector<HTMLInputElement>('#medicamento-nuevo-nombre')!;
    expect(nombre.value).toBe('Paracetamol');
    const presentacion = elemento.querySelector<HTMLSelectElement>(
      '#medicamento-nuevo-presentacion',
    )!;
    presentacion.selectedIndex = 1; // [0] = "Selecciona…", [1] = Comprimido
    presentacion.dispatchEvent(new Event('change'));
    escribir(
      elemento.querySelector<HTMLInputElement>('#medicamento-nuevo-concentracion')!,
      ' 500 mg ',
    );
    await fixture.whenStable();

    botonConTexto(elemento, 'Agregar al catálogo')!.click();
    await fixture.whenStable();

    expect(servicio.crear).toHaveBeenCalledWith(7, {
      nombre: 'Paracetamol',
      principioActivo: null,
      idPresentacion: 211,
      concentracion: '500 mg',
    });
    expect(elegidos).toEqual([existente]);
    expect(elemento.querySelector('.nuevo')).toBeNull();
  });

  it('crearSinPresentacionNoLlamaALaApi', async () => {
    const { fixture, servicio, elemento } = await configurar([]);

    escribir(elemento.querySelector<HTMLInputElement>('#buscador-medicamento-texto')!, 'Losartán');
    vi.advanceTimersByTime(300);
    await fixture.whenStable();
    botonConTexto(elemento, 'Agregar «Losartán» al catálogo')!.click();
    await fixture.whenStable();

    // Enter en el alta ejecuta "Agregar al catálogo" (sin enviar ningún formulario contenedor).
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    elemento.querySelector<HTMLInputElement>('#medicamento-nuevo-nombre')!.dispatchEvent(enter);
    await fixture.whenStable();

    expect(enter.defaultPrevented).toBe(true);
    expect(servicio.crear).not.toHaveBeenCalled();
    expect(elemento.textContent).toContain('Elige la presentación');
  });

  it('nombreDeSoloEspaciosNoLlamaALaApi', async () => {
    const { fixture, servicio, elemento } = await configurar([]);

    escribir(elemento.querySelector<HTMLInputElement>('#buscador-medicamento-texto')!, 'xx');
    vi.advanceTimersByTime(300);
    await fixture.whenStable();
    botonConTexto(elemento, 'Agregar «xx» al catálogo')!.click();
    await fixture.whenStable();

    const nombre = elemento.querySelector<HTMLInputElement>('#medicamento-nuevo-nombre')!;
    escribir(nombre, '   ');
    await fixture.whenStable();

    botonConTexto(elemento, 'Agregar al catálogo')!.click();
    await fixture.whenStable();

    expect(servicio.crear).not.toHaveBeenCalled();
    expect(elemento.querySelector('#medicamento-nuevo-nombre-error')?.textContent).toContain(
      'Ingresa el nombre',
    );
  });

  it('errorDeCampoSinVisibleCaeEnElMensajeGeneral', async () => {
    const { fixture, servicio, elemento } = await configurar([]);
    servicio.crear.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              detail: 'Datos no válidos',
              errores: [{ campo: 'concentracion', mensaje: 'Formato no reconocido' }],
            },
          }),
      ),
    );

    escribir(elemento.querySelector<HTMLInputElement>('#buscador-medicamento-texto')!, 'Paracetamol');
    vi.advanceTimersByTime(300);
    await fixture.whenStable();
    botonConTexto(elemento, 'Agregar «Paracetamol» al catálogo')!.click();
    await fixture.whenStable();

    const presentacion = elemento.querySelector<HTMLSelectElement>(
      '#medicamento-nuevo-presentacion',
    )!;
    presentacion.selectedIndex = 1;
    presentacion.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    botonConTexto(elemento, 'Agregar al catálogo')!.click();
    await fixture.whenStable();

    // El error llegó para "concentracion" (sin aviso visible en el formulario):
    // sin el mensaje general, la persona no vería ningún aviso del todo.
    expect(elemento.querySelector('#medicamento-nuevo-nombre-error')).toBeNull();
    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('Datos no válidos');
  });
});
