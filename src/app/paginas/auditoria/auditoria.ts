import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

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
import { formatearFecha, formatearHora } from '../../nucleo/fechas';
import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';

const TAMANO_PAGINA = 20;

/** Mismo breakpoint de escritorio que el SCSS (`@media (min-width: 768px)`). */
const CONSULTA_ESCRITORIO = '(min-width: 768px)';

/** Opciones del selector "Código de acción": etiqueta legible, ordenada; el valor es el código. */
const OPCIONES_ACCION = CODIGOS_ACCION_AUDITORIA.map((codigo) => ({
  codigo,
  etiqueta: etiquetaAccion(codigo),
})).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));

/**
 * Los filtros empiezan abiertos en escritorio y cerrados en móvil. Se decide
 * una sola vez al iniciar; sin `window`/`matchMedia` (SSR, jsdom) o si
 * falla, se toma como móvil.
 */
function esEscritorio(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.(CONSULTA_ESCRITORIO).matches;
  } catch {
    return false;
  }
}

/** Texto recortado, o `undefined` si queda en blanco (filtros opcionales de texto libre). */
function textoOUndefined(valor: string): string | undefined {
  const recortado = valor.trim();
  return recortado === '' ? undefined : recortado;
}

/**
 * Página "Auditoría" (HU-12, TSA-52, Tarea 7): lista paginada de
 * `EVENTO_AUDITORIA`, de solo lectura, con filtros. El modo lo decide la
 * ruta (`data.modo`, regla 25 del plan):
 *  - `'grupo'` (`/grupos/:idGrupo/auditoria`): el grupo sale de la URL
 *    (como `Integrantes`) y usa `ServicioAuditoria.consultarGrupo`. La API
 *    exige coordinador o administrador (403 si no); el enlace que lleva
 *    aquí ya está oculto para el resto (regla 25/28, ver `Integrantes`).
 *  - `'global'` (`/administracion/auditoria`, con `guardAdministrador`):
 *    `ServicioAuditoria.consultarGlobal`, con un filtro adicional "Id de
 *    grupo" (incluye eventos sin grupo).
 *
 * El resultado de cada evento se muestra con la descripción del catálogo
 * (regla 26 del plan, `ServicioCatalogos.estados('EVENTO_AUDITORIA',
 * 'RESULTADO')`), nunca con su código. `actor === null` es un proceso
 * automático. Los filtros vacíos no se envían (misma regla que
 * `ServicioAuditoria.parametros`); "Aplicar filtros" siempre vuelve a la
 * página 0.
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
  imports: [ReactiveFormsModule],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.scss',
})
export class Auditoria implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly servicioAuditoria = inject(ServicioAuditoria);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly formatearFecha = formatearFecha;
  protected readonly formatearHora = formatearHora;
  protected readonly tiposEntidad = TIPOS_ENTIDAD_AUDITORIA;
  protected readonly opcionesAccion = OPCIONES_ACCION;
  protected readonly etiquetaAccion = etiquetaAccion;
  protected readonly etiquetaEntidad = etiquetaEntidad;
  /** Estado inicial del `<details class="filtros">`; después lo maneja la persona. */
  protected readonly filtrosAbiertosAlIniciar = esEscritorio();

  /** Regla 25 del plan: el mismo componente sirve ambos modos, según `data.modo` de la ruta. */
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
  /** Cantidad de filtros del `filtroAplicado` (no del formulario en vivo), para el `summary`. */
  protected readonly cantidadFiltrosAplicados = computed(
    () => Object.values(this.filtroAplicado()).filter((valor) => valor !== undefined).length,
  );
  protected readonly textoResumenFiltros = computed(() => {
    const cantidad = this.cantidadFiltrosAplicados();
    if (cantidad === 0) return 'Filtros';
    return `Filtros (${cantidad} ${cantidad === 1 ? 'activo' : 'activos'})`;
  });
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

  protected detallesComoJson(detalles: Record<string, unknown>): string {
    return JSON.stringify(detalles, null, 2);
  }

  protected aplicarFiltros(): void {
    this.pagina.set(0);
    this.filtroAplicado.set(this.filtroActual());
    this.cargar();
  }

  protected paginaAnterior(): void {
    if (!this.hayPaginaAnterior() || this.cargando()) return;
    this.pagina.set(this.pagina() - 1);
    this.cargar();
  }

  protected paginaSiguiente(): void {
    if (!this.hayPaginaSiguiente() || this.cargando()) return;
    this.pagina.set(this.pagina() + 1);
    this.cargar();
  }

  protected reintentar(): void {
    this.cargar();
  }

  /** Sólo los filtros con valor viajan a la API (regla 9/28 del plan). */
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

  private cargar(): void {
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
        this.total.set(respuesta.total);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        if (generacion !== this.generacionCarga) return;
        this.cargando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }
}
