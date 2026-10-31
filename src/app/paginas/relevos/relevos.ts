import {
  Component,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { descripcionEstado } from '../../nucleo/catalogos/descripcion-estado';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';
import { RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { erroresDeCampos, mensajeDeCampo, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaRelevoResumen, SolicitudRegistrarRelevo } from '../../nucleo/relevos/modelos-relevos';
import { ServicioRelevos } from '../../nucleo/relevos/servicio-relevos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { Icono } from '../../compartido/icono/icono';

const TAMANO_PAGINA = 20;
/** `notas` admite hasta 2000 caracteres (`@Size` de la API). */
export const MAXIMO_CARACTERES_NOTAS = 2000;

/** Campos del formulario cuyo aviso se arma con `mensajeDeCampo`. */
type CampoRelevo = 'idAdulto' | 'idUsuarioSaliente' | 'idUsuarioEntrante';

const MENSAJES_REQUERIDO: Record<CampoRelevo, string> = {
  idAdulto: 'Elige un adulto mayor',
  idUsuarioSaliente: 'Elige quién entrega el turno',
  idUsuarioEntrante: 'Elige quién recibe el turno',
};

/** Texto recortado, o `null` si queda en blanco (igual que en `NuevaTarea`). */
function textoONulo(valor: string): string | null {
  const recortado = valor.trim();
  return recortado === '' ? null : recortado;
}

/**
 * Página "Relevos" (`/relevos?idAdulto=`): lista de relevos del grupo
 * activo, con filtro por adulto, y el formulario "Registrar relevo", que
 * queda plegado tras la acción principal del encabezado. Sigue el mismo
 * patrón de reacción al grupo activo de `paginas/alertas`/`paginas/adultos`:
 * un `effect()` con contador de generación recarga (o limpia) la lista cada
 * vez que el grupo activo o el filtro de adulto cambian, descartando
 * respuestas tardías de una combinación ya obsoleta.
 *
 * El query param `idAdulto` (enlace "Registrar relevo" de `FichaAdulto`)
 * inicializa el filtro de la lista y el adulto del formulario, y abre el
 * formulario, pero solo vale para la primera carga: si el grupo activo
 * cambia de verdad, el filtro y los campos del formulario vuelven a `null`
 * y se quita el `idAdulto` de la URL (igual que `inicio.ts`), porque el
 * adulto o los integrantes elegidos pueden no existir en el grupo nuevo.
 *
 * Un COLABORADOR solo puede registrarse a sí mismo como "quien entrega": el
 * control queda fijo y deshabilitado en cuanto se conoce su `idUsuario`
 * (`ServicioYo`) y su rol en el grupo activo. "Quien recibe" siempre excluye
 * a quien ya está elegido como "quien entrega".
 */
@Component({
  selector: 'app-relevos',
  imports: [ReactiveFormsModule, RouterLink, Icono],
  templateUrl: './relevos.html',
  styleUrl: './relevos.scss',
})
export class Relevos implements OnInit {
  private readonly servicioRelevos = inject(ServicioRelevos);
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly fechaHoraLegible = fechaHoraLegible;
  protected readonly maximoCaracteresNotas = MAXIMO_CARACTERES_NOTAS;

  protected readonly elementos = signal<RespuestaRelevoResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(false);
  protected readonly cargandoMas = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly estadosRelevo = signal<RespuestaEstadoCatalogo[]>([]);

  /** Adultos ACTIVOS del grupo (`ServicioAdultos.listar` ya los filtra por defecto): opciones del filtro y del formulario. */
  protected readonly adultos = signal<RespuestaAdultoMayor[]>([]);
  private readonly integrantesTodos = signal<RespuestaIntegrante[]>([]);
  private readonly idEstadoActivoIntegrante = signal<number | null>(null);
  protected readonly integrantesActivos = computed(() => {
    const idActivo = this.idEstadoActivoIntegrante();
    if (idActivo === null) return [];
    return this.integrantesTodos().filter((integrante) => integrante.idEstado === idActivo);
  });

  protected readonly idUsuario = signal<number | null>(null);
  /** Sólo este rol queda fijo como "quien entrega" en sí mismo. */
  protected readonly esColaborador = computed(() => this.activo()?.miRol === 'COLABORADOR');

  /** Filtro "Adulto mayor" de la lista, inicializado con el query param `idAdulto`. */
  protected readonly idAdultoFiltro = signal<number | null>(this.leerIdAdultoDeLaUrl());
  protected readonly controlFiltroAdulto = this.fb.control<number | null>(this.idAdultoFiltro());

  protected readonly hayMas = computed(() => this.elementos().length < this.total());
  /** La API entrega los relevos del más reciente al más antiguo. */
  protected readonly ultimo = computed(() => this.elementos()[0] ?? null);

  /** El formulario "Registrar relevo" se abre desde el encabezado; ya viene abierto desde la ficha del adulto. */
  protected readonly formularioAbierto = signal(this.leerIdAdultoDeLaUrl() !== null);

  protected readonly formulario = this.fb.group({
    idAdulto: this.fb.control<number | null>(this.leerIdAdultoDeLaUrl(), Validators.required),
    idUsuarioSaliente: this.fb.control<number | null>(null, Validators.required),
    idUsuarioEntrante: this.fb.control<number | null>(null, Validators.required),
    notas: ['', Validators.maxLength(MAXIMO_CARACTERES_NOTAS)],
  });

  /** "Quien entrega" elegido ahora mismo, como señal (incluye los cambios que impone el efecto del colaborador). */
  private readonly idSalienteElegido = toSignal(
    this.formulario.controls.idUsuarioSaliente.valueChanges,
    { initialValue: this.formulario.controls.idUsuarioSaliente.value },
  );

  /** Integrantes ACTIVOS para "quien recibe": nunca incluye a quien ya entrega. */
  protected readonly integrantesParaEntrante = computed(() => {
    const idSaliente = this.idSalienteElegido();
    return this.integrantesActivos().filter((integrante) => integrante.idUsuario !== idSaliente);
  });

  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});

  /** Descarta respuestas de `cargar()` obsoletas (grupo o filtro de la lista ya cambiaron de nuevo). */
  private generacionCarga = 0;
  /** Descarta respuestas de adultos/integrantes obsoletas (el grupo ya cambió de nuevo). */
  private generacionReferencias = 0;
  /** Suscripciones en vuelo de adultos/integrantes; se cancelan al llegar un grupo nuevo. */
  private suscripcionAdultos: Subscription | null = null;
  private suscripcionIntegrantes: Subscription | null = null;
  /** idGrupo visto por el efecto de reseteo; undefined hasta la primera corrida (nunca "cambió" ahí). */
  private idGrupoAnterior: number | null | undefined = undefined;

  constructor() {
    // Si el grupo activo cambia de verdad (no en la carga inicial), el
    // filtro de adulto y los campos del formulario vuelven a `null` y se
    // quita el `idAdulto` de la URL (igual que `inicio.ts`, efecto 2): el
    // `?idAdulto` solo vale para la primera carga. Va primero para que los
    // demás efectos (lista, colaborador) ya vean el filtro/formulario
    // reiniciados en esta misma corrida.
    effect(() => {
      const grupo = this.activo();
      const idGrupo = grupo?.idGrupo ?? null;
      if (this.idGrupoAnterior === undefined) {
        this.idGrupoAnterior = idGrupo;
        return;
      }
      if (idGrupo !== this.idGrupoAnterior) {
        this.idGrupoAnterior = idGrupo;
        this.idAdultoFiltro.set(null);
        this.controlFiltroAdulto.setValue(null);
        // `reset()` sin valores volvería `idAdulto` al valor inicial del
        // control (el `?idAdulto` de la URL de la primera carga), no a
        // `null`; por eso se pasan los valores explícitos.
        this.formulario.reset({
          idAdulto: null,
          idUsuarioSaliente: null,
          idUsuarioEntrante: null,
          notas: '',
        });
        this.router.navigate([], {
          relativeTo: this.ruta,
          queryParams: { idAdulto: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });

    // Lista: reacciona al grupo activo y al filtro de adulto.
    effect(() => {
      const grupo = this.activo();
      const idAdulto = this.idAdultoFiltro();

      this.error.set(null);
      // Nunca se muestran relevos del grupo/filtro anterior mientras carga el nuevo.
      this.elementos.set([]);
      this.total.set(0);

      if (!grupo) {
        this.cargando.set(false);
        return;
      }
      this.cargar(grupo.idGrupo, idAdulto);
    });

    // Referencias del formulario (adultos, integrantes): sólo cambian con el
    // grupo. Generación propia + `unsubscribe` (igual que `inicio.ts:116-131`):
    // si el grupo cambia dos veces rápido, una respuesta tardía del grupo
    // anterior no puede pisar las opciones del grupo vigente.
    effect(() => {
      const grupo = this.activo();
      this.adultos.set([]);
      this.integrantesTodos.set([]);
      this.suscripcionAdultos?.unsubscribe();
      this.suscripcionIntegrantes?.unsubscribe();
      if (!grupo) return;

      const generacion = ++this.generacionReferencias;
      this.suscripcionAdultos = this.servicioAdultos.listar(grupo.idGrupo).subscribe({
        next: (adultos) => {
          if (generacion !== this.generacionReferencias) return;
          this.adultos.set(adultos);
        },
        error: () => undefined,
      });
      this.suscripcionIntegrantes = this.servicioGrupos.integrantes(grupo.idGrupo).subscribe({
        next: (integrantes) => {
          if (generacion !== this.generacionReferencias) return;
          this.integrantesTodos.set(integrantes);
        },
        error: () => undefined,
      });
    });

    // Un colaborador siempre entrega su propio turno; el
    // control queda fijo en su id y deshabilitado. Si deja de ser colaborador
    // (cambio de grupo activo), se vuelve a habilitar.
    effect(() => {
      const esColaborador = this.esColaborador();
      const idUsuario = this.idUsuario();
      const control = this.formulario.controls.idUsuarioSaliente;
      if (esColaborador && idUsuario !== null) {
        control.setValue(idUsuario);
        control.disable();
      } else if (!esColaborador) {
        control.enable();
      }
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.idUsuario.set(yo.idUsuario),
      // Defensivo: sin esto no se fija "quien entrega" para un colaborador.
      error: () => undefined,
    });
    this.servicioCatalogos.estados('TRASPASO_FAMILIAR', 'ESTADO').subscribe({
      next: (estados) => this.estadosRelevo.set(estados),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('INTEGRANTE_GRUPO', 'ESTADO').subscribe({
      next: (estados) => {
        const activo = estados.find((estado) => estado.codigo === 'ACTIVO');
        this.idEstadoActivoIntegrante.set(activo?.idEstado ?? null);
      },
      error: () => undefined,
    });
  }

  protected descripcionEstadoRelevo(idEstado: number): string {
    return descripcionEstado(this.estadosRelevo(), idEstado);
  }

  /** "Cancelada" no es un éxito: usa el tono de advertencia. */
  protected tonoEstado(relevo: RespuestaRelevoResumen): string {
    return relevo.codigoEstado === 'CANCELADA' ? 'mv-chip--alerta' : 'mv-chip--exito';
  }

  /** Nombre accesible único del enlace al detalle. */
  protected etiquetaEnlace(relevo: RespuestaRelevoResumen): string {
    return (
      `Relevo de ${relevo.nombreAdulto}: ${relevo.saliente.nombre} entrega a ` +
      `${relevo.entrante.nombre}, ${fechaHoraLegible(relevo.fechaTraspaso)}`
    );
  }

  /** Singular o plural de un conteo ("1 relevo registrado", "2 relevos registrados"). */
  protected plural(cantidad: number, singular: string, plural: string): string {
    return cantidad === 1 ? singular : plural;
  }

  protected abrirFormulario(): void {
    this.formularioAbierto.set(true);
    this.enfocar('relevos-adulto');
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.enfocar('relevos-abrir-registro');
  }

  protected alternarFormulario(): void {
    if (this.formularioAbierto()) this.cerrarFormulario();
    else this.abrirFormulario();
  }

  protected mensaje(campo: CampoRelevo): string | null {
    const control: AbstractControl = this.formulario.controls[campo];
    return mensajeDeCampo(control, this.erroresServidor(), campo, MENSAJES_REQUERIDO[campo]);
  }

  protected contadorNotas(): string {
    return `${this.formulario.controls.notas.value.length} / ${MAXIMO_CARACTERES_NOTAS}`;
  }

  /** Cambia el filtro de adulto de la lista y lo refleja en el query param `idAdulto` de la URL. */
  protected cambiarFiltroAdulto(): void {
    const idAdulto = this.controlFiltroAdulto.value;
    this.idAdultoFiltro.set(idAdulto);
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { idAdulto },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected cargarMas(): void {
    const grupo = this.activo();
    if (!grupo || this.cargandoMas()) return;

    const generacion = this.generacionCarga;
    const siguientePagina = Math.floor(this.elementos().length / TAMANO_PAGINA);
    this.cargandoMas.set(true);
    this.servicioRelevos
      .listar(grupo.idGrupo, {
        idAdulto: this.idAdultoFiltro() ?? undefined,
        pagina: siguientePagina,
        tamano: TAMANO_PAGINA,
      })
      .subscribe({
        next: (respuesta) => {
          this.cargandoMas.set(false);
          if (generacion !== this.generacionCarga) return;
          this.elementos.update((actuales) => [...actuales, ...respuesta.elementos]);
          this.total.set(respuesta.total);
        },
        error: (error: unknown) => {
          this.cargandoMas.set(false);
          if (generacion !== this.generacionCarga) return;
          this.error.set(mensajeDeError(error));
        },
      });
  }

  protected reintentar(): void {
    const grupo = this.activo();
    if (!grupo) return;
    this.cargar(grupo.idGrupo, this.idAdultoFiltro());
  }

  protected registrar(): void {
    if (this.guardando()) return;
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;

    const grupo = this.activo();
    if (!grupo) return;

    const valores = this.formulario.getRawValue();
    const solicitud: SolicitudRegistrarRelevo = {
      idAdulto: valores.idAdulto!,
      idUsuarioSaliente: valores.idUsuarioSaliente!,
      idUsuarioEntrante: valores.idUsuarioEntrante!,
      notas: textoONulo(valores.notas),
    };

    this.errorFormulario.set(null);
    this.erroresServidor.set({});
    this.guardando.set(true);
    this.servicioRelevos.registrar(grupo.idGrupo, solicitud).subscribe({
      next: (relevo) => {
        this.guardando.set(false);
        this.router.navigate(['/relevos', relevo.idRelevo]);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const campos = erroresDeCampos(error);
        this.erroresServidor.set(campos);
        if (Object.keys(campos).length === 0) {
          this.errorFormulario.set(mensajeDeError(error));
        }
      },
    });
  }

  private cargar(idGrupo: number, idAdulto: number | null): void {
    const generacion = ++this.generacionCarga;
    this.error.set(null);
    this.cargando.set(true);
    this.servicioRelevos
      .listar(idGrupo, { idAdulto: idAdulto ?? undefined, pagina: 0, tamano: TAMANO_PAGINA })
      .subscribe({
        next: (respuesta) => {
          if (generacion !== this.generacionCarga) return;
          this.elementos.set(respuesta.elementos);
          this.total.set(respuesta.total);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          if (generacion !== this.generacionCarga) return;
          this.error.set(mensajeDeError(error));
          this.cargando.set(false);
        },
      });
  }

  private enfocar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  private leerIdAdultoDeLaUrl(): number | null {
    const valor = this.ruta.snapshot.queryParamMap.get('idAdulto');
    if (!valor) return null;
    const idAdulto = Number(valor);
    return Number.isFinite(idAdulto) ? idAdulto : null;
  }
}
