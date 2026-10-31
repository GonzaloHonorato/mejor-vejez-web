import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { NuevaTarea } from './nueva-tarea';
import { BuscadorMedicamento } from '../plan/buscador-medicamento/buscador-medicamento';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import {
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaEstadoCatalogo } from '../../nucleo/catalogos/servicio-catalogos';
import { RespuestaGrupo, RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { RespuestaMedicamento } from '../../nucleo/planificacion/modelos-planificacion';
import { RespuestaTarea, SolicitudCrearTareaManual } from '../../nucleo/tareas/modelos-tareas';
import { ServicioTareas } from '../../nucleo/tareas/servicio-tareas';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

const PRESENTACIONES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 211, codigo: 'COMPRIMIDO', descripcion: 'Comprimido', orden: 1 },
  { idOpcion: 212, codigo: 'JARABE', descripcion: 'Jarabe', orden: 2 },
];
const UNIDADES: RespuestaOpcionCatalogo[] = [
  { idOpcion: 221, codigo: 'COMPRIMIDO', descripcion: 'comprimido(s)', orden: 1 },
  { idOpcion: 222, codigo: 'ML', descripcion: 'ml', orden: 2 },
];
// idEstado > 127 a propósito: la comparación de estado de integrante debe ser por valor.
const ESTADOS_INTEGRANTE: RespuestaEstadoCatalogo[] = [
  { idEstado: 140, codigo: 'ACTIVO', descripcion: 'Activo', orden: 1 },
  { idEstado: 141, codigo: 'INACTIVO', descripcion: 'Inactivo', orden: 2 },
];

function grupo(idGrupo: number, miRol: string | null): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo: 'Familia Rojas',
    notificaCoordinador: true,
    idEstado: 1,
    miRol,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

function adulto(datos: Partial<RespuestaAdultoMayor> = {}): RespuestaAdultoMayor {
  return {
    idAdultoMayor: 1,
    idGrupo: 1,
    codigoInterno: null,
    nombreCompleto: 'Rosa González',
    fechaNacimiento: '1950-05-10',
    notasEmergencia: null,
    observacionesGenerales: null,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
    contactoPrincipal: null,
    ...datos,
  };
}

function integrante(idUsuario: number, nombre: string, idEstado = 140): RespuestaIntegrante {
  return {
    idIntegrante: idUsuario + 1000,
    idUsuario,
    nombre,
    email: `${idUsuario}@correo.cl`,
    idRol: 2,
    nombreRol: 'CUIDADOR',
    idEstado,
    fechaIncorporacion: '2026-01-01T00:00:00-03:00',
    fechaDesactivacion: null,
  };
}

const PARACETAMOL: RespuestaMedicamento = {
  idMedicamento: 500,
  nombre: 'Paracetamol',
  principioActivo: 'Paracetamol',
  idPresentacion: 211,
  concentracion: '500 mg',
  usadoEnGrupo: true,
};
const IBUPROFENO: RespuestaMedicamento = {
  idMedicamento: 501,
  nombre: 'Ibuprofeno',
  principioActivo: 'Ibuprofeno',
  idPresentacion: null,
  concentracion: null,
  usadoEnGrupo: false,
};

function tarea(datos: Partial<RespuestaTarea> = {}): RespuestaTarea {
  return {
    idTarea: 900,
    tipoTarea: 'COMPRA_RETIRO_MEDICAMENTOS',
    idAdultoMayor: 1,
    nombreAdulto: 'Rosa González',
    idDetallePlan: null,
    titulo: 'Comprar medicamentos',
    descripcion: null,
    fechaHorario: '2026-11-02T08:00:00-03:00',
    minutosTolerancia: 30,
    idEstado: 10,
    atrasada: false,
    responsable: null,
    observacionCierre: null,
    nombreConfirmador: null,
    fechaConfirmacion: null,
    motivoCancelacion: null,
    compra: [],
    cita: null,
    ...datos,
  };
}

interface Opciones {
  activo?: RespuestaGrupo | null;
  esAdministrador?: boolean;
  adultos?: RespuestaAdultoMayor[];
  integrantes?: RespuestaIntegrante[];
  crearManualImpl?: (
    idGrupo: number,
    s: SolicitudCrearTareaManual,
  ) => ReturnType<ServicioTareas['crearManual']>;
}

async function configurar(opciones: Opciones = {}) {
  const activo = signal<RespuestaGrupo | null>(
    opciones.activo !== undefined ? opciones.activo : grupo(1, 'COORDINADOR'),
  );
  const servicioTareas = {
    crearManual: vi.fn(opciones.crearManualImpl ?? (() => of(tarea()))),
  };
  const servicioAdultos = { listar: vi.fn(() => of(opciones.adultos ?? [adulto()])) };
  const servicioGrupos = {
    integrantes: vi.fn(() => of(opciones.integrantes ?? [integrante(300, 'Ana Rojas')])),
  };
  const servicioCatalogos = {
    opciones: vi.fn((tipo: string) =>
      of(tipo === 'PRESENTACION_MEDICAMENTO' ? PRESENTACIONES : UNIDADES),
    ),
    estados: vi.fn(() => of(ESTADOS_INTEGRANTE)),
  };
  const servicioYo = {
    obtener: vi.fn(() =>
      of({
        idUsuario: 200,
        nombre: 'Ana',
        email: 'ana@correo.cl',
        telefono: null,
        esAdministrador: opciones.esAdministrador ?? false,
      }),
    ),
  };

  TestBed.configureTestingModule({
    imports: [NuevaTarea],
    providers: [
      provideRouter([]),
      { provide: ServicioTareas, useValue: servicioTareas },
      { provide: ServicioAdultos, useValue: servicioAdultos },
      { provide: ServicioGrupos, useValue: servicioGrupos },
      { provide: ServicioCatalogos, useValue: servicioCatalogos },
      { provide: ServicioGrupoActivo, useValue: { activo } },
      { provide: ServicioYo, useValue: servicioYo },
    ],
  });

  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(NuevaTarea);
  await fixture.whenStable();
  return {
    fixture,
    servicioTareas,
    router,
    elemento: fixture.nativeElement as HTMLElement,
  };
}

type Fixture = Awaited<ReturnType<typeof configurar>>['fixture'];

function porId<T extends HTMLElement>(elemento: HTMLElement, id: string): T {
  const encontrado = elemento.querySelector<T>(`#${id}`);
  if (!encontrado) throw new Error(`Sin #${id}`);
  return encontrado;
}

function escribir(input: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

function elegirOpcion(select: HTMLSelectElement, texto: string): void {
  const indice = Array.from(select.options).findIndex((o) => o.textContent?.trim() === texto);
  if (indice < 0) throw new Error(`Sin opción "${texto}"`);
  select.selectedIndex = indice;
  select.dispatchEvent(new Event('change'));
}

function radio(elemento: HTMLElement, texto: string): HTMLInputElement {
  const label = Array.from(elemento.querySelectorAll('label')).find(
    (l) => l.textContent?.trim() === texto,
  );
  if (!label) throw new Error(`Sin radio "${texto}"`);
  return label.querySelector('input')!;
}

async function elegirMedicamento(
  fixture: Fixture,
  indice: number,
  medicamento: RespuestaMedicamento,
) {
  // Busca el buscador DENTRO de la línea `indice` (y no en todo el formulario):
  // una vez elegido un medicamento, esa línea deja de mostrar su buscador, así
  // que el índice entre "todos los buscadores visibles" ya no coincide con el
  // índice de línea.
  const lineas = fixture.debugElement.queryAll(By.css('.compra-linea'));
  const buscador = lineas[indice].query(By.directive(BuscadorMedicamento));
  (buscador.componentInstance as BuscadorMedicamento).elegido.emit(medicamento);
  await fixture.whenStable();
}

async function enviar(fixture: Fixture, elemento: HTMLElement) {
  elemento.querySelector<HTMLFormElement>('form.formulario')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

/** Llena los campos comunes requeridos (adulto, título, fecha, hora). */
async function llenarComunes(elemento: HTMLElement) {
  elegirOpcion(porId(elemento, 'nueva-tarea-adulto'), 'Rosa González');
  escribir(porId(elemento, 'nueva-tarea-titulo'), 'Comprar Losartán');
  escribir(porId(elemento, 'nueva-tarea-fecha'), '2026-11-02');
  escribir(porId(elemento, 'nueva-tarea-hora'), '08:00');
}

describe('NuevaTarea', () => {
  it('unaComandoDeCompraConDosLineasEnviaElCuerpoExactoConSuOffset', async () => {
    const { fixture, elemento, servicioTareas, router } = await configurar();
    await llenarComunes(elemento);

    await elegirMedicamento(fixture, 0, PARACETAMOL);
    escribir(porId(elemento, 'nueva-tarea-compra-0-cantidad'), '1');
    elegirOpcion(porId(elemento, 'nueva-tarea-compra-0-unidad'), 'comprimido(s)');

    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Agregar medicamento')!
      .click();
    await fixture.whenStable();

    await elegirMedicamento(fixture, 1, IBUPROFENO);
    elegirOpcion(porId(elemento, 'nueva-tarea-compra-1-presentacion'), 'Jarabe');
    escribir(porId(elemento, 'nueva-tarea-compra-1-cantidad'), '2.5');
    elegirOpcion(porId(elemento, 'nueva-tarea-compra-1-unidad'), 'ml');
    escribir(porId(elemento, 'nueva-tarea-compra-1-dosis'), '1 comprimido');
    escribir(porId(elemento, 'nueva-tarea-compra-1-observaciones'), 'Retirar en farmacia');

    await enviar(fixture, elemento);

    expect(servicioTareas.crearManual).toHaveBeenCalledTimes(1);
    expect(servicioTareas.crearManual).toHaveBeenCalledWith(1, {
      tipoTarea: 'COMPRA_RETIRO_MEDICAMENTOS',
      idAdultoMayor: 1,
      titulo: 'Comprar Losartán',
      descripcion: null,
      fechaHorario: '2026-11-02T08:00:00-03:00',
      idResponsable: null,
      compra: [
        {
          idMedicamento: 500,
          idPresentacion: 211,
          dosisIndicada: null,
          cantidadSolicitada: 1,
          idUnidadCantidad: 221,
          observaciones: null,
        },
        {
          idMedicamento: 501,
          idPresentacion: 212,
          dosisIndicada: '1 comprimido',
          cantidadSolicitada: 2.5,
          idUnidadCantidad: 222,
          observaciones: 'Retirar en farmacia',
        },
      ],
      cita: null,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/tareas', 900]);
  });

  it('elegirUnMedicamentoSinPresentacionLimpiaLaPresentacionDelAnterior', async () => {
    const { fixture, elemento } = await configurar();

    await elegirMedicamento(fixture, 0, PARACETAMOL);
    const presentacion = porId<HTMLSelectElement>(elemento, 'nueva-tarea-compra-0-presentacion');
    expect(presentacion.options[presentacion.selectedIndex].textContent?.trim()).toBe('Comprimido');

    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Cambiar medicamento')!
      .click();
    await fixture.whenStable();

    await elegirMedicamento(fixture, 0, IBUPROFENO);

    // Ibuprofeno no trae presentación: la línea no debe conservar la de
    // Paracetamol.
    expect(presentacion.options[presentacion.selectedIndex].textContent?.trim()).toBe('Selecciona…');
  });

  it('unaCitaEnviaCitaYNoCompra', async () => {
    const { fixture, elemento, servicioTareas } = await configurar();
    await llenarComunes(elemento);

    radio(elemento, 'Cita o control médico').click();
    await fixture.whenStable();

    escribir(porId(elemento, 'nueva-tarea-cita-medico'), 'Dr. Pérez');
    escribir(porId(elemento, 'nueva-tarea-cita-lugar'), 'Clínica Central');
    escribir(porId(elemento, 'nueva-tarea-cita-observaciones'), 'Llevar carnet');

    await enviar(fixture, elemento);

    expect(servicioTareas.crearManual).toHaveBeenCalledTimes(1);
    const cuerpo = servicioTareas.crearManual.mock.calls[0][1] as SolicitudCrearTareaManual;
    expect(cuerpo.tipoTarea).toBe('CITAS_CONTROLES_MEDICOS');
    expect(cuerpo.compra).toBeNull();
    expect(cuerpo.cita).toEqual({
      nombreMedico: 'Dr. Pérez',
      lugarAtencion: 'Clínica Central',
      observaciones: 'Llevar carnet',
    });
  });

  it('noEnviaSinAdultoFechaUHora', async () => {
    const { fixture, elemento, servicioTareas } = await configurar();

    await enviar(fixture, elemento);

    expect(servicioTareas.crearManual).not.toHaveBeenCalled();
  });

  it('quitarUnaLinea', async () => {
    const { fixture, elemento } = await configurar();
    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Agregar medicamento')!
      .click();
    await fixture.whenStable();

    expect(elemento.querySelectorAll('.compra-linea').length).toBe(2);

    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.getAttribute('aria-label') === 'Quitar medicamento 2')!
      .click();
    await fixture.whenStable();

    expect(elemento.querySelectorAll('.compra-linea').length).toBe(1);
    const botonesQuitar = Array.from(elemento.querySelectorAll('button')).filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Quitar medicamento'),
    );
    expect(botonesQuitar[0].hasAttribute('disabled')).toBe(true);
  });

  it('un422DeLaApiSeMuestra', async () => {
    const mensaje = 'La fecha y hora debe ser futura';
    const { fixture, elemento, servicioTareas } = await configurar({
      crearManualImpl: () =>
        throwError(
          () => new HttpErrorResponse({ status: 422, error: { detail: mensaje } }),
        ) as never,
    });
    await llenarComunes(elemento);
    await elegirMedicamento(fixture, 0, PARACETAMOL);
    escribir(porId(elemento, 'nueva-tarea-compra-0-cantidad'), '1');
    elegirOpcion(porId(elemento, 'nueva-tarea-compra-0-unidad'), 'comprimido(s)');

    await enviar(fixture, elemento);

    const alertas = Array.from(elemento.querySelectorAll('[role="alert"]')).map(
      (a) => a.textContent,
    );
    expect(servicioTareas.crearManual).toHaveBeenCalledTimes(1);
    expect(alertas.some((texto) => texto?.includes(mensaje))).toBe(true);
  });

  it('unColaboradorVeElAviso', async () => {
    const { elemento } = await configurar({ activo: grupo(1, 'CUIDADOR'), esAdministrador: false });

    const aviso = elemento.querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('Solo el coordinador puede crear tareas.');
    expect(elemento.querySelector('form.formulario')).toBeNull();
  });

  it('losCamposUsanMvCampoConSuEtiquetaYElEnvioEsElBotonPrincipal', async () => {
    const { elemento } = await configurar();

    for (const id of ['nueva-tarea-adulto', 'nueva-tarea-titulo', 'nueva-tarea-fecha', 'nueva-tarea-hora']) {
      const control = porId(elemento, id);
      expect(control.classList.contains('mv-campo__control')).toBe(true);
      const campo = control.closest('.mv-campo')!;
      expect(campo.querySelector(`label.mv-campo__etiqueta[for="${id}"]`)).not.toBeNull();
    }
    const enviarBoton = elemento.querySelector<HTMLButtonElement>('form.formulario button[type="submit"]')!;
    expect(enviarBoton.textContent).toContain('Crear tarea');
    expect(enviarBoton.classList.contains('mv-boton--primario')).toBe(true);
  });

  it('elErrorDeUnCampoQuedaEnlazadoConAriaDescribedby', async () => {
    const { fixture, elemento } = await configurar();

    await enviar(fixture, elemento);

    const titulo = porId(elemento, 'nueva-tarea-titulo');
    const idError = titulo.getAttribute('aria-describedby')!;
    expect(idError).toBe('nueva-tarea-titulo-error');
    expect(porId(elemento, idError).classList.contains('mv-campo__error')).toBe(true);
  });

  it('losErroresDeCadaLineaDeCompraTienenIdPorIndiceYSeEnlazanASuControl', async () => {
    const { fixture, elemento } = await configurar();

    Array.from(elemento.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Agregar medicamento')!
      .click();
    await fixture.whenStable();
    await enviar(fixture, elemento);

    const lineas = elemento.querySelectorAll<HTMLElement>('.compra-linea');
    expect(lineas).toHaveLength(2);
    lineas.forEach((linea, i) => {
      const enlazados: [HTMLElement, string][] = [
        [linea.querySelector<HTMLElement>('app-buscador-medicamento input[type="search"]')!, 'medicamento'],
        [porId(elemento, `nueva-tarea-compra-${i}-presentacion`), 'presentacion'],
        [porId(elemento, `nueva-tarea-compra-${i}-cantidad`), 'cantidad'],
        [porId(elemento, `nueva-tarea-compra-${i}-unidad`), 'unidad'],
      ];
      for (const [control, campo] of enlazados) {
        const idError = `nueva-tarea-compra-${i}-${campo}-error`;
        expect(control.getAttribute('aria-describedby')).toBe(idError);
        expect(control.getAttribute('aria-invalid')).toBe('true');
        const error = porId(elemento, idError);
        expect(linea.contains(error)).toBe(true);
        expect(error.classList.contains('mv-campo__error')).toBe(true);
      }
    });
  });
});
