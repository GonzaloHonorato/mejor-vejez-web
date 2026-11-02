import { Component, Injector, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { Icono } from '../../compartido/icono/icono';
import {
  CodigoResultadoAuditoria,
  RespuestaEventoAuditoria,
  TIPOS_ENTIDAD_AUDITORIA,
} from '../../nucleo/auditoria/modelos-auditoria';
import {
  CODIGOS_ACCION_AUDITORIA,
  etiquetaAccion,
  etiquetaEntidad,
} from '../../nucleo/auditoria/etiquetas-auditoria';
import { FiltroAuditoria, ServicioAuditoria } from '../../nucleo/auditoria/servicio-auditoria';
import { descripcionEstado } from '../../nucleo/catalogos/descripcion-estado';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';
import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { enfocarPrimeraNueva, mostrarAviso, porId, traerALaVista } from '../../nucleo/foco';

const TAMANO_PAGINA = 20;

/** Tono del chip según el resultado: el texto sale del catálogo, no del código. */
const TONO_RESULTADO: Readonly<Record<string, string>> = {
  EXITO: 'mv-chip--exito',
  FALLO: 'mv-chip--peligro',
  RECHAZADA: 'mv-chip--alerta',
};

/** Opciones del selector "Código de acción": etiqueta legible, ordenada; el valor es el código. */
const OPCIONES_ACCION = CODIGOS_ACCION_AUDITORIA.map((codigo) => ({
  codigo,
  etiqueta: etiquetaAccion(codigo),
})).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));

/** Texto recortado, o `undefined` si queda en blanco (filtros opcionales de texto libre). */
function textoOUndefined(valor: string): string | undefined {
  const recortado = valor.trim();
  return recortado === '' ? undefined : recortado;
}

/**
 * Página "Auditoría": lista paginada de `EVENTO_AUDITORIA`, de solo
 * lectura, con filtros. El modo lo decide la ruta (`data.modo`):
 *  - `'grupo'` (`/grupos/:idGrupo/auditoria`): el grupo sale de la URL
 *    (como `Integrantes`) y usa `ServicioAuditoria.consultarGrupo`. La API
 *    exige coordinador o administrador (403 si no); el enlace que lleva
 *    aquí ya está oculto para el resto (ver `Integrantes`).
 *  - `'global'` (`/administracion/auditoria`, con `guardAdministrador`):
 *    `ServicioAuditoria.consultarGlobal`, con un filtro adicional "Id de
 *    grupo" (incluye eventos sin grupo).
 *
 * El resultado de cada evento se muestra con la descripción del catálogo
 * (`ServicioCatalogos.estados('EVENTO_AUDITORIA', 'RESULTADO')`), nunca con
 * su código. `actor === null` es un proceso automático. Los filtros vacíos
 * no se envían (igual que en `ServicioAuditoria.parametros`); "Aplicar
 * filtros" siempre vuelve a la página 0.
 *
 * `cargar()` siempre pagina con `filtroAplicado` (el filtro congelado al
 * pulsar "Aplicar filtros"), nunca con los valores en vivo de
 * `formularioFiltros`: si alguien cambia un filtro sin aplicarlo y pulsa
 * "Siguiente"/"Anterior", la página pedida sigue correspondiendo a lo que
 * se ve en pantalla. `cargar()` también lleva su propia generación (mismo
 * patrón de `relevos.ts`/`inicio.ts`) para descartar una respuesta vieja
 * que llega después de una más nueva (doble toque en "Siguiente"), y los
 * botones de paginación se deshabilitan mientras `cargando()`.
 */
@Component({
  selector: 'app-auditoria',
  imports: [ReactiveFormsModule, Icono],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.scss',
})
export class Auditoria implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly servicioAuditoria = inject(ServicioAuditoria);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly fechaHoraLegible = fechaHoraLegible;
  protected readonly tiposEntidad = TIPOS_ENTIDAD_AUDITORIA;
  protected readonly opcionesAccion = OPCIONES_ACCION;
  protected readonly etiquetaAccion = etiquetaAccion;
  protected readonly etiquetaEntidad = etiquetaEntidad;
  /** Formulario de filtros desplegado en celular; desde tableta el CSS lo muestra siempre. */
  protected readonly filtrosAbiertos = signal(false);

  /** El mismo componente sirve ambos modos, según `data.modo` de la ruta. */
  protected readonly modoGlobal = this.ruta.snapshot.data['modo'] === 'global';
  /** Sólo en modo grupo: el `idGrupo` viene fijo de la URL (como `Integrantes`), nunca del grupo activo. */
  private readonly idGrupoRuta = this.modoGlobal
    ? null
    : Number(this.ruta.snapshot.paramMap.get('idGrupo'));

  protected readonly elementos = signal<RespuestaEventoAuditoria[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(0);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly resultados = signal<RespuestaEstadoCatalogo[]>([]);

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA)),
  );
  protected readonly textoTotal = computed(() =>
    this.total() === 1 ? '1 evento' : `${this.total()} eventos`,
  );
  protected readonly hayPaginaAnterior = computed(() => this.pagina() > 0);
  protected readonly hayPaginaSiguiente = computed(
    () => (this.pagina() + 1) * TAMANO_PAGINA < this.total(),
  );

  protected readonly formularioFiltros = this.fb.group({
    tipoEntidad: this.fb.control<string | null>(null),
    idEntidad: [''],
    codigoAccion: this.fb.control<string | null>(null),
    codigoResultado: this.fb.control<CodigoResultadoAuditoria | null>(null),
    desde: [''],
    hasta: [''],
    idGrupo: this.fb.control<number | null>(null),
  });

  /** Filtro congelado en la última "Aplicar filtros" (o el inicial, vacío): es el único que usa `cargar()`. */
  protected readonly filtroAplicado = signal<FiltroAuditoria>(this.filtroActual());
  /** Cantidad de filtros del `filtroAplicado` (no del formulario en vivo), para el botón "Filtros". */
  protected readonly cantidadFiltrosAplicados = computed(
    () => Object.values(this.filtroAplicado()).filter((valor) => valor !== undefined).length,
  );
  /** Descarta respuestas de `cargar()` obsoletas (doble toque en la paginación). */
  private generacionCarga = 0;

  ngOnInit(): void {
    this.servicioCatalogos.estados('EVENTO_AUDITORIA', 'RESULTADO').subscribe({
      next: (estados) => this.resultados.set(estados),
      error: () => undefined,
    });
    this.cargar();
  }

  protected descripcionResultado(idResultado: number): string {
    return descripcionEstado(this.resultados(), idResultado);
  }

  protected tonoResultado(evento: RespuestaEventoAuditoria): string {
    return TONO_RESULTADO[evento.codigoResultado] ?? '';
  }

  /** Nombre accesible de "Ver detalles": el texto visible, la acción, el elemento y la fecha. */
  protected etiquetaDetalle(evento: RespuestaEventoAuditoria): string {
    return `Ver detalles: ${etiquetaAccion(evento.codigoAccion)}, ${etiquetaEntidad(
      evento.tipoEntidad,
    )} ${evento.idEntidad}, ${fechaHoraLegible(evento.fechaEvento)}`;
  }

  /** Eventos con su fila de detalle desplegada (de la página visible). */
  private readonly detallesAbiertos = signal<ReadonlySet<number>>(new Set());

  protected detalleAbierto(idEvento: number): boolean {
    return this.detallesAbiertos().has(idEvento);
  }

  /**
   * Abre o cierra la fila de detalle. Al abrirla se trae a la vista (la
   * grilla tiene scroll propio desde tableta); el foco queda en "Ver
   * detalles", que anuncia `aria-expanded`.
   */
  protected alternarDetalle(idEvento: number): void {
    const abrir = !this.detalleAbierto(idEvento);
    this.detallesAbiertos.update((abiertos) => {
      const siguiente = new Set(abiertos);
      if (!siguiente.delete(idEvento)) siguiente.add(idEvento);
      return siguiente;
    });
    if (abrir) traerALaVista(porId(`auditoria-detalle-${idEvento}`), this.injector);
  }

  protected detallesComoJson(detalles: Record<string, unknown>): string {
    return JSON.stringify(detalles, null, 2);
  }

  protected aplicarFiltros(): void {
    this.pagina.set(0);
    this.filtroAplicado.set(this.filtroActual());
    // Los resultados pueden quedar bajo el formulario (en celular, fuera de
    // la vista): se trae su título a la vista y el total se anuncia.
    this.cargar(() => traerALaVista(porId('auditoria-actividad'), this.injector));
  }

  protected paginaAnterior(): void {
    if (!this.hayPaginaAnterior() || this.cargando()) return;
    this.pagina.set(this.pagina() - 1);
    this.cargar(() => this.enfocarPrimeraFila());
  }

  protected paginaSiguiente(): void {
    if (!this.hayPaginaSiguiente() || this.cargando()) return;
    this.pagina.set(this.pagina() + 1);
    this.cargar(() => this.enfocarPrimeraFila());
  }

  /**
   * Tras cambiar de página, el foco va al "Ver detalles" del primer evento:
   * los botones de paginación se deshabilitan mientras carga y el foco se
   * perdería en `body`.
   */
  private enfocarPrimeraFila(): void {
    enfocarPrimeraNueva(porId('auditoria-grilla'), 'tbody tr:not(.fila-detalle)', 0, this.injector);
  }

  protected reintentar(): void {
    this.cargar();
  }

  /** Sólo los filtros con valor viajan a la API. */
  private filtroActual(): FiltroAuditoria {
    const valores = this.formularioFiltros.getRawValue();
    return {
      idGrupo: this.modoGlobal ? valores.idGrupo ?? undefined : undefined,
      tipoEntidad: valores.tipoEntidad ?? undefined,
      idEntidad: textoOUndefined(valores.idEntidad),
      codigoAccion: valores.codigoAccion ?? undefined,
      codigoResultado: valores.codigoResultado ?? undefined,
      desde: textoOUndefined(valores.desde),
      hasta: textoOUndefined(valores.hasta),
    };
  }

  private cargar(alTerminar?: () => void): void {
    this.error.set(null);
    this.cargando.set(true);
    const generacion = ++this.generacionCarga;
    const filtro = this.filtroAplicado();
    const observable = this.modoGlobal
      ? this.servicioAuditoria.consultarGlobal(filtro, this.pagina(), TAMANO_PAGINA)
      : this.servicioAuditoria.consultarGrupo(this.idGrupoRuta!, filtro, this.pagina(), TAMANO_PAGINA);

    observable.subscribe({
      next: (respuesta) => {
        if (generacion !== this.generacionCarga) return;
        this.elementos.set(respuesta.elementos);
        this.detallesAbiertos.set(new Set());
        this.total.set(respuesta.total);
        this.cargando.set(false);
        alTerminar?.();
      },
      error: (error: unknown) => {
        if (generacion !== this.generacionCarga) return;
        this.cargando.set(false);
        this.error.set(mensajeDeError(error));
        mostrarAviso(porId('auditoria-error'), this.injector);
      },
    });
  }
}
