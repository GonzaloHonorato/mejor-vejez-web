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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { inicialesDe } from '../../compartido/marco-app/identidad-usuario';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { AVISO_OPERATIVO, puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { detalleAdulto } from './detalle-adulto';
import {
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../nucleo/http/mensaje-de-error';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Página "Adultos mayores" (`/adultos`): lista de perfiles del grupo activo,
 * con su contacto principal, y el formulario de alta (plegado tras la acción
 * principal) para quien administra.
 * Siempre trabaja sobre `ServicioGrupoActivo.activo()`: un `effect` recarga
 * la lista (o la limpia) cada vez que el grupo activo o el filtro de
 * inactivos cambian.
 */
@Component({
  selector: 'app-adultos',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './adultos.html',
  styleUrl: './adultos.scss',
})
export class Adultos implements OnInit {
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly avisoOperativo = AVISO_OPERATIVO;

  protected readonly adultos = signal<RespuestaAdultoMayor[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarInactivos = signal(false);
  protected readonly esAdministrador = signal(false);
  protected readonly creando = signal(false);
  protected readonly formularioAbierto = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  /** idEstado de "INACTIVO" para ADULTO_MAYOR; null hasta que llegue el catálogo. */
  private readonly idEstadoInactivo = signal<number | null>(null);

  /** Sin grupo activo no hay nada que administrar, aunque la persona sea admin. */
  protected readonly puedeAdministrar = computed(() =>
    puedeAdministrarGrupo(this.activo()?.miRol, this.esAdministrador()),
  );

  protected readonly cuenta = computed(() => {
    const total = this.adultos().length;
    return `${total} ${total === 1 ? 'adulto mayor' : 'adultos mayores'}`;
  });

  protected readonly formulario = this.fb.group({
    nombreCompleto: ['', Validators.required],
    codigoInterno: [''],
    fechaNacimiento: [''],
  });

  /** Descarta respuestas de `listar()` obsoletas (grupo o filtro ya cambiaron de nuevo). */
  private generacionCarga = 0;

  constructor() {
    effect(() => {
      const grupo = this.activo();
      const incluirInactivos = this.mostrarInactivos();

      this.errorGeneral.set(null);
      this.erroresCampos.set({});
      // Nunca se muestran datos del grupo anterior mientras carga el nuevo.
      this.adultos.set([]);

      if (!grupo) {
        this.error.set(null);
        this.cargando.set(false);
        return;
      }
      this.cargar(grupo.idGrupo, incluirInactivos);
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      // Defensivo: si falla, simplemente no se muestran las acciones de admin.
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('ADULTO_MAYOR', 'ESTADO').subscribe({
      next: (estados) => {
        const inactivo = estados.find((estado) => estado.codigo === 'INACTIVO');
        this.idEstadoInactivo.set(inactivo?.idEstado ?? null);
      },
      // Defensivo: sin el catálogo simplemente no se marca ningún adulto como inactivo.
      error: () => undefined,
    });
  }

  protected iniciales(adulto: RespuestaAdultoMayor): string {
    return inicialesDe(adulto.nombreCompleto);
  }

  protected readonly detalle = detalleAdulto;

  /** Nombre accesible del enlace a la ficha; el código lo distingue de un homónimo. */
  protected etiquetaFicha(adulto: RespuestaAdultoMayor): string {
    const codigo = adulto.codigoInterno ? `, código ${adulto.codigoInterno}` : '';
    return `Ver ficha de ${adulto.nombreCompleto}${codigo}`;
  }

  protected estaInactivo(adulto: RespuestaAdultoMayor): boolean {
    const idEstadoInactivo = this.idEstadoInactivo();
    return idEstadoInactivo !== null && adulto.idEstado === idEstadoInactivo;
  }

  /** Sin el catálogo no se sabe qué idEstado es "inactivo": no se afirma ningún estado. */
  protected conoceEstado(): boolean {
    return this.idEstadoInactivo() !== null;
  }

  protected alternarFormulario(): void {
    const abrir = !this.formularioAbierto();
    this.formularioAbierto.set(abrir);
    this.enfocar(abrir ? 'adulto-nombre' : 'adultos-abrir-alta');
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.formulario.reset();
    this.errorGeneral.set(null);
    this.erroresCampos.set({});
    this.enfocar('adultos-abrir-alta');
  }

  private enfocar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  protected reintentar(): void {
    const grupo = this.activo();
    if (grupo) this.cargar(grupo.idGrupo, this.mostrarInactivos());
  }

  protected alternarMostrarInactivos(): void {
    this.mostrarInactivos.set(!this.mostrarInactivos());
  }

  /** Error de la API, o si no un mensaje local cuando se tocó el campo sin completar el nombre. */
  protected mensajeCampoNombre(): string | null {
    return mensajeDeCampo(
      this.formulario.controls.nombreCompleto,
      this.erroresCampos(),
      'nombreCompleto',
      'Ingresa el nombre completo',
    );
  }

  protected crear(): void {
    const grupo = this.activo();
    if (!grupo || this.creando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.errorGeneral.set(null);
    this.erroresCampos.set({});
    const { nombreCompleto, codigoInterno, fechaNacimiento } = this.formulario.getRawValue();
    this.creando.set(true);
    this.servicioAdultos
      .crear(grupo.idGrupo, {
        nombreCompleto: nombreCompleto.trim(),
        codigoInterno: codigoInterno.trim() === '' ? null : codigoInterno.trim(),
        fechaNacimiento: fechaNacimiento.trim() === '' ? null : fechaNacimiento,
        notasEmergencia: null,
        observacionesGenerales: null,
      })
      .subscribe({
        next: (adulto) => {
          this.creando.set(false);
          this.router.navigateByUrl(`/adultos/${adulto.idAdultoMayor}`);
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

  private cargar(idGrupo: number, incluirInactivos: boolean): void {
    const generacion = ++this.generacionCarga;
    this.cargando.set(true);
    this.error.set(null);
    this.servicioAdultos.listar(idGrupo, incluirInactivos).subscribe({
      next: (adultos) => {
        if (generacion !== this.generacionCarga) return;
        this.adultos.set(adultos);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        if (generacion !== this.generacionCarga) return;
        this.error.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }
}
