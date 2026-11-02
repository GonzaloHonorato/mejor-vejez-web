import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { ETIQUETA_TIPO_ALERTA } from '../../nucleo/alertas/alertas';
import { RespuestaAlerta, TipoAlerta } from '../../nucleo/alertas/modelos-alertas';
import { FiltroAlertas, ServicioAlertas } from '../../nucleo/alertas/servicio-alertas';
import {
  RespuestaEstadoCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';

const TAMANO_PAGINA = 20;
const LARGO_EXTRACTO = 120;

/** Pestaña de la bandeja: refleja el código de `ALERTA_CUIDADO.ESTADO`. */
type PestanaAlertas = 'ABIERTA' | 'CERRADA';

/**
 * Total de cada pestaña: `undefined` mientras se pide, `null` si no se pudo
 * saber (la petición falló).
 */
type Totales = Record<PestanaAlertas, number | null | undefined>;

const SIN_TOTALES: Totales = { ABIERTA: undefined, CERRADA: undefined };

/** Filtro "Adulto mayor": se guarda con el grupo al que pertenece el adulto. */
interface FiltroAdulto {
  idGrupo: number;
  idAdulto: number;
}

/** Filtros de la bandeja que también valen para el total de la otra pestaña. */
interface FiltrosBandeja {
  tipo: TipoAlerta | null;
  idAdulto: number | null;
}

/** Tono del chip de cada tipo de alerta. */
const TONO_TIPO: Record<TipoAlerta, string> = {
  ATRASO_TAREA: 'mv-chip--peligro',
  REPOSICION_MEDICAMENTO: 'mv-chip--alerta',
  CITA_PROXIMA: 'mv-chip--info',
};

function otraPestana(pestana: PestanaAlertas): PestanaAlertas {
  return pestana === 'ABIERTA' ? 'CERRADA' : 'ABIERTA';
}

/**
 * Página "Alertas" (`/alertas`): bandeja de alertas de cuidado del grupo
 * activo, con pestañas "Abiertas"/"Cerradas" (por defecto Abiertas) y un
 * filtro por tipo y otro por adulto mayor (los dos los aplica la API).
 * Sigue el mismo patrón de `paginas/tareas`/`paginas/adultos`: un
 * `effect()` con contador de generación recarga (o limpia) la lista cada
 * vez que el grupo activo, la pestaña o un filtro cambian, descartando
 * respuestas tardías de una combinación ya obsoleta.
 *
 * Los indicadores y los contadores de las pestañas son el `total` de cada
 * estado con los filtros aplicados: el de la pestaña visible sale de su
 * lista y el de la otra, de pedir su primera página con tamaño 1.
 *
 * El `idEstado` de cada pestaña sale del catálogo `ALERTA_CUIDADO`/`ESTADO`
 * (códigos `ABIERTA`/`CERRADA`, `ServicioCatalogos`): mientras no llega, el
 * efecto espera (se vuelve a correr solo cuando el catálogo resuelve, porque
 * lee un `computed` derivado de él).
 */
@Component({
  selector: 'app-alertas',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './alertas.html',
  styleUrl: './alertas.scss',
})
export class Alertas implements OnInit {
  private readonly servicioAlertas = inject(ServicioAlertas);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly etiquetaTipo = ETIQUETA_TIPO_ALERTA;
  protected readonly tonoTipo = TONO_TIPO;
  protected readonly tiposAlerta = Object.keys(ETIQUETA_TIPO_ALERTA) as TipoAlerta[];
  protected readonly fechaHoraLegible = fechaHoraLegible;

  protected readonly pestana = signal<PestanaAlertas>('ABIERTA');
  protected readonly tipoFiltro = signal<TipoAlerta | null>(null);
  protected readonly controlFiltroTipo = this.fb.control<TipoAlerta | ''>('');

  /** Adultos del grupo activo (activos e inactivos): alimentan el filtro "Adulto mayor". */
  protected readonly adultos = signal<RespuestaAdultoMayor[]>([]);
  private readonly filtroAdulto = signal<FiltroAdulto | null>(null);
  protected readonly controlFiltroAdulto = this.fb.control<number | null>(null);
  /** El adulto filtrado, solo si es del grupo activo (al cambiar de grupo deja de valer). */
  private readonly idAdultoFiltro = computed(() => {
    const filtro = this.filtroAdulto();
    return filtro && filtro.idGrupo === this.activo()?.idGrupo ? filtro.idAdulto : null;
  });

  protected readonly elementos = signal<RespuestaAlerta[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(0);
  protected readonly cargando = signal(false);
  protected readonly cargandoMas = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Error de `ALERTA_CUIDADO/ESTADO` por sí solo: el efecto de grupo/pestaña/filtro nunca lo limpia. */
  protected readonly errorCatalogo = signal<string | null>(null);

  protected readonly estados = signal<RespuestaEstadoCatalogo[]>([]);
  private readonly idEstadoAbierta = computed(
    () => this.estados().find((estado) => estado.codigo === 'ABIERTA')?.idEstado ?? null,
  );
  private readonly idEstadoCerrada = computed(
    () => this.estados().find((estado) => estado.codigo === 'CERRADA')?.idEstado ?? null,
  );

  protected readonly totales = signal<Totales>(SIN_TOTALES);

  protected readonly hayMas = computed(() => this.elementos().length < this.total());

  /** El error visible de la bandeja: el de la lista, o si no el del catálogo. */
  protected readonly errorVisible = computed(() => this.error() ?? this.errorCatalogo());

  /** Descarta respuestas de `cargar()`/`cargarMas()` obsoletas (grupo, pestaña o filtro ya cambiaron de nuevo). */
  private generacionCarga = 0;
  /** Lo mismo para el total de la otra pestaña. */
  private generacionConteo = 0;
  /** Descarta respuestas de `ServicioAdultos.listar()` de un grupo anterior. */
  private generacionAdultos = 0;
  /** Grupo y filtros de los totales actuales: si cambian, los totales ya no valen. */
  private claveTotales = '';

  constructor() {
    // Lista de adultos del filtro: solo cambia con el grupo.
    effect(() => {
      const grupo = this.activo();
      const generacion = ++this.generacionAdultos;
      this.adultos.set([]);
      this.filtroAdulto.set(null);
      this.controlFiltroAdulto.setValue(null);
      if (!grupo) return;
      // Si la lista no llega, el filtro queda solo con "Todos" y la bandeja sigue funcionando.
      this.servicioAdultos.listar(grupo.idGrupo, true).subscribe({
        next: (adultos) => {
          if (generacion === this.generacionAdultos) this.adultos.set(adultos);
        },
        error: () => undefined,
      });
    });

    effect(() => {
      const grupo = this.activo();
      const pestana = this.pestana();
      const filtros: FiltrosBandeja = { tipo: this.tipoFiltro(), idAdulto: this.idAdultoFiltro() };
      const idEstado = pestana === 'ABIERTA' ? this.idEstadoAbierta() : this.idEstadoCerrada();

      this.error.set(null);
      // Nunca se muestran alertas de la combinación anterior mientras carga la nueva.
      this.elementos.set([]);
      this.total.set(0);
      this.pagina.set(0);
      // Al cambiar solo de pestaña los totales siguen valiendo hasta que llegan los nuevos.
      const clave = `${grupo?.idGrupo ?? ''}|${filtros.tipo ?? ''}|${filtros.idAdulto ?? ''}`;
      if (clave !== this.claveTotales) {
        this.claveTotales = clave;
        this.generacionConteo++;
        this.totales.set(SIN_TOTALES);
      }

      if (!grupo) {
        this.cargando.set(false);
        return;
      }
      if (idEstado === null) {
        // El catálogo ALERTA_CUIDADO/ESTADO todavía no llegó. Si ya falló
        // antes (`errorCatalogo`), no hay nada que esperar: se deja de
        // "cargar" para que se vea el error en vez de una página en blanco
        // (por ejemplo, al cambiar de grupo). Si no falló, es la primera
        // carga: se espera a que el catálogo resuelva (el efecto lo lee y se
        // vuelve a correr solo).
        this.cargando.set(this.errorCatalogo() === null);
        return;
      }
      this.cargarBandeja(grupo.idGrupo, pestana, filtros);
    });
  }

  ngOnInit(): void {
    this.cargarCatalogo();
  }

  protected elegirPestana(pestana: PestanaAlertas): void {
    if (this.pestana() === pestana) return;
    this.pestana.set(pestana);
  }

  protected cambiarFiltroTipo(): void {
    const valor = this.controlFiltroTipo.value;
    this.tipoFiltro.set(valor === '' ? null : valor);
  }

  protected cambiarFiltroAdulto(): void {
    const idAdulto = this.controlFiltroAdulto.value;
    const grupo = this.activo();
    this.filtroAdulto.set(idAdulto !== null && grupo ? { idGrupo: grupo.idGrupo, idAdulto } : null);
  }

  /** Hay algún filtro aplicado (cambia el texto del estado vacío). */
  protected hayFiltros(): boolean {
    return this.tipoFiltro() !== null || this.idAdultoFiltro() !== null;
  }

  protected mensajeVacio(): string {
    return this.pestana() === 'ABIERTA' ? 'No hay alertas abiertas.' : 'No hay alertas cerradas.';
  }

  /** Singular o plural de un conteo ("1 abierta", "2 abiertas"). */
  protected plural(cantidad: number, singular: string, plural: string): string {
    return cantidad === 1 ? singular : plural;
  }

  /** Título corto de la fila: la tarea o el medicamento relacionado, o si no el tipo. */
  protected titulo(alerta: RespuestaAlerta): string {
    return (
      alerta.tituloTarea ?? alerta.nombreMedicamento ?? ETIQUETA_TIPO_ALERTA[alerta.tipoAlerta]
    );
  }

  /** "Revisada por Carlos Soto · Hoy 10:00" de una alerta cerrada. */
  protected revision(alerta: RespuestaAlerta): string {
    const quien = alerta.revisor
      ? `Revisada por ${alerta.revisor.nombre}`
      : 'Sin revisor registrado';
    return alerta.fechaRevision ? `${quien} · ${fechaHoraLegible(alerta.fechaRevision)}` : quien;
  }

  /** Comienzo de la observación de cierre, cortado por palabra si es larga. */
  protected extracto(texto: string): string {
    const limpio = texto.trim();
    if (limpio.length <= LARGO_EXTRACTO) return limpio;
    const corte = limpio.slice(0, LARGO_EXTRACTO);
    const espacio = corte.lastIndexOf(' ');
    return `${(espacio > 0 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
  }

  protected cargarMas(): void {
    const grupo = this.activo();
    const idEstado = this.idEstadoActual();
    if (!grupo || idEstado === null || this.cargandoMas()) return;

    // Misma generación que la carga en curso: si el grupo/pestaña/filtro
    // cambian mientras pide la página siguiente, esta respuesta se descarta.
    const generacion = this.generacionCarga;
    const siguientePagina = this.pagina() + 1;
    this.cargandoMas.set(true);
    this.servicioAlertas
      .listar(grupo.idGrupo, {
        idEstado,
        ...this.parametrosFiltro(this.filtrosActuales()),
        pagina: siguientePagina,
        tamano: TAMANO_PAGINA,
      })
      .subscribe({
        next: (respuesta) => {
          this.cargandoMas.set(false);
          if (generacion !== this.generacionCarga) return;
          this.elementos.update((actuales) => [...actuales, ...respuesta.elementos]);
          this.total.set(respuesta.total);
          this.pagina.set(respuesta.pagina);
          this.fijarTotal(this.pestana(), respuesta.total);
        },
        error: (error: unknown) => {
          this.cargandoMas.set(false);
          if (generacion !== this.generacionCarga) return;
          this.error.set(mensajeDeError(error));
        },
      });
  }

  protected reintentar(): void {
    if (this.idEstadoActual() === null) {
      // Sin catálogo no hay idEstado que enviar: hay que volver a pedirlo primero.
      this.cargarCatalogo();
      return;
    }
    const grupo = this.activo();
    if (!grupo) return;
    this.cargarBandeja(grupo.idGrupo, this.pestana(), this.filtrosActuales());
  }

  private filtrosActuales(): FiltrosBandeja {
    return { tipo: this.tipoFiltro(), idAdulto: this.idAdultoFiltro() };
  }

  /** `tipoAlerta` siempre (undefined si no hay); `idAdulto` solo si se eligió uno. */
  private parametrosFiltro(
    filtros: FiltrosBandeja,
  ): Pick<FiltroAlertas, 'tipoAlerta' | 'idAdulto'> {
    return {
      tipoAlerta: filtros.tipo ?? undefined,
      ...(filtros.idAdulto !== null ? { idAdulto: filtros.idAdulto } : {}),
    };
  }

  private idEstadoActual(): number | null {
    return this.idEstadoDe(this.pestana());
  }

  private idEstadoDe(pestana: PestanaAlertas): number | null {
    return pestana === 'ABIERTA' ? this.idEstadoAbierta() : this.idEstadoCerrada();
  }

  private fijarTotal(pestana: PestanaAlertas, total: number | null): void {
    this.totales.update((totales) => ({ ...totales, [pestana]: total }));
  }

  /** La lista de la pestaña visible y el total de la otra. */
  private cargarBandeja(idGrupo: number, pestana: PestanaAlertas, filtros: FiltrosBandeja): void {
    const idEstado = this.idEstadoDe(pestana);
    if (idEstado === null) return;
    this.cargar(idGrupo, idEstado, pestana, filtros);
    const otra = otraPestana(pestana);
    const idEstadoOtra = this.idEstadoDe(otra);
    if (idEstadoOtra !== null) this.cargarTotal(idGrupo, idEstadoOtra, otra, filtros);
  }

  private cargarTotal(
    idGrupo: number,
    idEstado: number,
    pestana: PestanaAlertas,
    filtros: FiltrosBandeja,
  ): void {
    const generacion = ++this.generacionConteo;
    this.servicioAlertas
      .listar(idGrupo, { idEstado, ...this.parametrosFiltro(filtros), pagina: 0, tamano: 1 })
      .subscribe({
        next: (respuesta) => {
          if (generacion === this.generacionConteo) this.fijarTotal(pestana, respuesta.total);
        },
        error: () => {
          if (generacion === this.generacionConteo) this.fijarTotal(pestana, null);
        },
      });
  }

  private cargarCatalogo(): void {
    this.errorCatalogo.set(null);
    this.cargando.set(true);
    this.servicioCatalogos.estados('ALERTA_CUIDADO', 'ESTADO').subscribe({
      next: (estados) => this.estados.set(estados),
      error: (error: unknown) => {
        // Sin el catálogo no hay idEstado que enviar: se informa en su
        // propia señal, que el efecto de grupo/pestaña/filtro no limpia.
        this.cargando.set(false);
        this.errorCatalogo.set(mensajeDeError(error, 'No pudimos cargar los estados de alertas.'));
      },
    });
  }

  private cargar(
    idGrupo: number,
    idEstado: number,
    pestana: PestanaAlertas,
    filtros: FiltrosBandeja,
  ): void {
    const generacion = ++this.generacionCarga;
    this.error.set(null);
    this.cargando.set(true);
    this.servicioAlertas
      .listar(idGrupo, {
        idEstado,
        ...this.parametrosFiltro(filtros),
        pagina: 0,
        tamano: TAMANO_PAGINA,
      })
      .subscribe({
        next: (respuesta) => {
          if (generacion !== this.generacionCarga) return;
          this.elementos.set(respuesta.elementos);
          this.total.set(respuesta.total);
          this.pagina.set(respuesta.pagina);
          this.fijarTotal(pestana, respuesta.total);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          if (generacion !== this.generacionCarga) return;
          this.error.set(mensajeDeError(error));
          this.fijarTotal(pestana, null);
          this.cargando.set(false);
        },
      });
  }
}
