import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { formatearFecha, hoyEnSantiago } from '../../nucleo/fechas';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { erroresDeCampos, mensajeDeCampo, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaPlan } from '../../nucleo/planificacion/modelos-planificacion';
import { ServicioPlanes } from '../../nucleo/planificacion/servicio-planes';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Página "Medicamentos" (`/planes`): lista de planes de medicamentos del
 * grupo activo, con el filtro por adulto mayor (sincronizado con el query
 * param `idAdulto`) y el formulario de alta para quien administra. Sigue
 * el mismo patrón de `paginas/adultos`: un `effect()` con contador de
 * generación recarga (o limpia) la lista cada vez que el grupo activo, el
 * filtro de inactivos o el filtro de adulto cambian.
 */
@Component({
  selector: 'app-planes',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './planes.html',
  styleUrl: './planes.scss',
})
export class Planes implements OnInit {
  private readonly servicioPlanes = inject(ServicioPlanes);
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly formatearFecha = formatearFecha;

  protected readonly planes = signal<RespuestaPlan[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarInactivos = signal(false);
  protected readonly esAdministrador = signal(false);
  /** Todos los adultos del grupo (activos e inactivos): alimenta el filtro. */
  protected readonly adultosFiltro = signal<RespuestaAdultoMayor[]>([]);
  /** Subconjunto activo de `adultosFiltro()`: el único que ofrece el formulario de alta. */
  protected readonly adultosActivos = computed(() =>
    this.adultosFiltro().filter((adulto) => !this.estaAdultoInactivo(adulto)),
  );
  protected readonly creando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  /** idEstado de "INACTIVO" para PLAN_MEDICAMENTOS; null hasta que llegue el catálogo. */
  private readonly idEstadoInactivo = signal<number | null>(null);
  /** idEstado de "INACTIVO" para ADULTO_MAYOR; null hasta que llegue el catálogo. */
  private readonly idEstadoInactivoAdulto = signal<number | null>(null);

  /** Filtro "Adulto mayor"; se inicializa con el query param `idAdulto` de la URL. */
  protected readonly idAdultoFiltro = signal<number | null>(this.leerIdAdultoDeLaUrl());
  protected readonly controlFiltroAdulto = this.fb.control<number | null>(this.idAdultoFiltro());

  /** Sin grupo activo no hay nada que administrar, aunque la persona sea admin. */
  protected readonly puedeAdministrar = computed(() =>
    puedeAdministrarGrupo(this.activo()?.miRol, this.esAdministrador()),
  );

  protected readonly formulario = this.fb.group({
    // null hasta elegir un adulto real: con Validators.required, 0 no sería
    // válido igual (no hay adulto con id 0), pero null deja la intención explícita.
    idAdultoMayor: this.fb.control<number | null>(null, Validators.required),
    nombrePlan: ['', Validators.required],
    vigenteDesde: [hoyEnSantiago(), Validators.required],
    vigenteHasta: [''],
  });

  /** Descarta respuestas de `listar()` obsoletas (grupo o filtros ya cambiaron de nuevo). */
  private generacionCarga = 0;
  /** Descarta respuestas de `ServicioAdultos.listar()` obsoletas (el grupo ya cambió de nuevo). */
  private generacionAdultos = 0;
  /**
   * idGrupo con el que ya se trabajó, para distinguir el primer grupo que
   * llega (el filtro de la URL debe respetarse) de un cambio real de grupo
   * (el filtro de adulto y el adulto del alta quedan obsoletos: pertenecen
   * al grupo anterior).
   */
  private idGrupoAnterior: number | null = null;

  constructor() {
    // Lista de adultos del grupo (filtro y formulario de alta): solo cambia con el grupo.
    effect(() => {
      const grupo = this.activo();
      this.adultosFiltro.set([]);

      if (grupo && grupo.idGrupo !== this.idGrupoAnterior) {
        if (this.idGrupoAnterior !== null) {
          // Cambio real de grupo (no la primera carga): el filtro de adulto y
          // el adulto elegido en el alta son del grupo anterior.
          this.idAdultoFiltro.set(null);
          this.controlFiltroAdulto.setValue(null);
          this.formulario.controls.idAdultoMayor.setValue(null);
          this.router.navigate([], {
            relativeTo: this.ruta,
            queryParams: { idAdulto: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
        this.idGrupoAnterior = grupo.idGrupo;
      }

      if (!grupo) return;
      const generacion = ++this.generacionAdultos;
      // incluirInactivos=true: el filtro lista a todos; adultosActivos() deriva el
      // subconjunto activo para el formulario de alta.
      this.servicioAdultos.listar(grupo.idGrupo, true).subscribe({
        next: (adultos) => {
          if (generacion !== this.generacionAdultos) return;
          this.adultosFiltro.set(adultos);
        },
        // Defensivo: sin la lista simplemente no hay opciones en los selects.
        error: () => undefined,
      });
    });

    effect(() => {
      const grupo = this.activo();
      const incluirInactivos = this.mostrarInactivos();
      const idAdulto = this.idAdultoFiltro();

      this.errorGeneral.set(null);
      this.erroresCampos.set({});
      // Nunca se muestran datos del grupo anterior mientras carga el nuevo.
      this.planes.set([]);

      if (!grupo) {
        this.error.set(null);
        this.cargando.set(false);
        return;
      }
      this.cargar(grupo.idGrupo, incluirInactivos, idAdulto);
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      // Defensivo: si falla, simplemente no se muestra el formulario de alta.
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('PLAN_MEDICAMENTOS', 'ESTADO').subscribe({
      next: (estados) => {
        const inactivo = estados.find((estado) => estado.codigo === 'INACTIVO');
        this.idEstadoInactivo.set(inactivo?.idEstado ?? null);
      },
      // Defensivo: sin el catálogo simplemente no se marca ningún plan como inactivo.
      error: () => undefined,
    });
    this.servicioCatalogos.estados('ADULTO_MAYOR', 'ESTADO').subscribe({
      next: (estados) => {
        const inactivo = estados.find((estado) => estado.codigo === 'INACTIVO');
        this.idEstadoInactivoAdulto.set(inactivo?.idEstado ?? null);
      },
      // Defensivo: sin el catálogo, ningún adulto se trata como inactivo (lado
      // seguro: el formulario de alta igual exige elegir uno de la lista).
      error: () => undefined,
    });
  }

  protected estaInactivo(plan: RespuestaPlan): boolean {
    const idEstadoInactivo = this.idEstadoInactivo();
    return idEstadoInactivo !== null && plan.idEstado === idEstadoInactivo;
  }

  protected estaAdultoInactivo(adulto: RespuestaAdultoMayor): boolean {
    const idEstadoInactivoAdulto = this.idEstadoInactivoAdulto();
    return idEstadoInactivoAdulto !== null && adulto.idEstado === idEstadoInactivoAdulto;
  }

  protected alternarMostrarInactivos(): void {
    this.mostrarInactivos.set(!this.mostrarInactivos());
  }

  /** Cambia el filtro de adulto y lo refleja en el query param `idAdulto` de la URL. */
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

  /** Error de la API, o si no un mensaje local cuando se tocó el campo sin elegir un adulto. */
  protected mensajeCampoAdulto(): string | null {
    return mensajeDeCampo(
      this.formulario.controls.idAdultoMayor,
      this.erroresCampos(),
      'idAdultoMayor',
      'Elige un adulto mayor',
    );
  }

  /** Error de la API, o si no un mensaje local cuando se tocó el campo sin completar el nombre. */
  protected mensajeCampoNombre(): string | null {
    return mensajeDeCampo(
      this.formulario.controls.nombrePlan,
      this.erroresCampos(),
      'nombrePlan',
      'Ingresa el nombre del plan',
    );
  }

  /** Error de la API, o si no un mensaje local cuando se tocó el campo sin la vigencia desde. */
  protected mensajeCampoVigenteDesde(): string | null {
    return mensajeDeCampo(
      this.formulario.controls.vigenteDesde,
      this.erroresCampos(),
      'vigenteDesde',
      'Indica desde cuándo rige el plan',
    );
  }

  protected crear(): void {
    const grupo = this.activo();
    if (!grupo || this.creando()) return;

    // Antes de validar: un error de la API de un envío previo nunca debe
    // quedar mostrado junto a los avisos de campos requeridos del envío actual.
    this.errorGeneral.set(null);
    this.erroresCampos.set({});

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { idAdultoMayor, nombrePlan, vigenteDesde, vigenteHasta } = this.formulario.getRawValue();
    this.creando.set(true);
    this.servicioPlanes
      .crear(grupo.idGrupo, {
        idAdultoMayor: idAdultoMayor!,
        nombrePlan: nombrePlan.trim(),
        vigenteDesde,
        vigenteHasta: vigenteHasta.trim() === '' ? null : vigenteHasta,
      })
      .subscribe({
        next: (plan) => {
          this.creando.set(false);
          this.router.navigateByUrl(`/planes/${plan.idPlan}`);
        },
        error: (error: unknown) => {
          this.creando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCampos.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorGeneral.set(mensajeDeError(error));
          }
        },
      });
  }

  private cargar(idGrupo: number, incluirInactivos: boolean, idAdulto: number | null): void {
    const generacion = ++this.generacionCarga;
    this.cargando.set(true);
    this.error.set(null);
    this.servicioPlanes
      .listar(idGrupo, { idAdulto: idAdulto ?? undefined, incluirInactivos })
      .subscribe({
        next: (planes) => {
          if (generacion !== this.generacionCarga) return;
          this.planes.set(planes);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          if (generacion !== this.generacionCarga) return;
          this.error.set(mensajeDeError(error));
          this.cargando.set(false);
        },
      });
  }

  private leerIdAdultoDeLaUrl(): number | null {
    const valor = this.ruta.snapshot.queryParamMap.get('idAdulto');
    if (!valor) return null;
    const idAdulto = Number(valor);
    return Number.isFinite(idAdulto) ? idAdulto : null;
  }
}
