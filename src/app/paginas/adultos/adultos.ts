import {
  Component,
  ElementRef,
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
import {
  mensajeCampoFechaNacimiento,
  validadorFechaNoFutura,
} from '../../nucleo/adultos/fecha-nacimiento';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { AVISO_OPERATIVO, puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import {
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { dentroDe, enfocarPrimerCampoInvalido } from '../../nucleo/foco';
import { hoyEnSantiago } from '../../nucleo/fechas';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { detalleAdulto } from './detalle-adulto';
import {
  describirCon,
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../nucleo/http/mensaje-de-error';
import {
  AYUDA_TELEFONO,
  enlaceTelefono,
  formatearControlTelefono,
  formatearTelefono,
  mensajeCampoTelefono,
  normalizarTelefono,
  validadorTelefonoChileno,
} from '../../nucleo/telefono';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

type CampoContacto = 'nombre' | 'idParentesco' | 'telefono';

/**
 * Página "Adultos mayores" (`/adultos`): lista de perfiles del grupo activo,
 * con su contacto principal, y el formulario de alta (plegado tras la acción
 * principal) para quien administra. El alta exige fecha de nacimiento y un
 * contacto principal (nombre, parentesco del catálogo y teléfono chileno),
 * que el core crea junto con el adulto.
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly avisoOperativo = AVISO_OPERATIVO;
  protected readonly ayudaTelefono = AYUDA_TELEFONO;
  protected readonly formatearTelefono = formatearTelefono;
  protected readonly enlaceTelefono = enlaceTelefono;
  protected readonly hoy = hoyEnSantiago();

  protected readonly adultos = signal<RespuestaAdultoMayor[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarInactivos = signal(false);
  protected readonly esAdministrador = signal(false);
  protected readonly creando = signal(false);
  protected readonly formularioAbierto = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});
  protected readonly parentescos = signal<RespuestaOpcionCatalogo[]>([]);
  protected readonly errorParentescos = signal<string | null>(null);

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
    fechaNacimiento: ['', [Validators.required, validadorFechaNoFutura()]],
    contactoPrincipal: this.fb.group({
      nombre: ['', Validators.required],
      idParentesco: this.fb.control<number | null>(null, Validators.required),
      telefono: ['', [Validators.required, validadorTelefonoChileno]],
    }),
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
    this.servicioCatalogos.opciones('PARENTESCO').subscribe({
      next: (opciones) => this.parentescos.set(opciones),
      error: (error: unknown) =>
        this.errorParentescos.set(mensajeDeError(error, 'No pudimos cargar los parentescos.')),
    });
  }

  protected iniciales(adulto: RespuestaAdultoMayor): string {
    return inicialesDe(adulto.nombreCompleto);
  }

  protected readonly detalle = detalleAdulto;

  /** Nombre accesible del nombre enlazado (el único enlace de la fila para lectores): único por el código. */
  protected etiquetaAdulto(adulto: RespuestaAdultoMayor): string {
    const codigo = adulto.codigoInterno ? `, código ${adulto.codigoInterno}` : '';
    return `${adulto.nombreCompleto}${codigo}`;
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

  protected mensajeCampoFecha(): string | null {
    return mensajeCampoFechaNacimiento(
      this.formulario.controls.fechaNacimiento,
      this.erroresCampos(),
      'fechaNacimiento',
    );
  }

  /** Mensaje de un campo del contacto principal: la API los devuelve como `contactoPrincipal.<campo>`. */
  protected mensajeCampoContacto(campo: CampoContacto): string | null {
    const control = this.formulario.controls.contactoPrincipal.controls[campo];
    const clave = `contactoPrincipal.${campo}`;
    if (campo === 'telefono') {
      return mensajeCampoTelefono(control, this.erroresCampos(), clave, 'Ingresa un teléfono');
    }
    const requerido = campo === 'nombre' ? 'Ingresa el nombre del contacto' : 'Elige el parentesco';
    return mensajeDeCampo(control, this.erroresCampos(), clave, requerido);
  }

  /** `aria-describedby` de un campo con ids `<id>-ayuda` / `<id>-error`. */
  protected describirCampo(
    idCampo: string,
    mensaje: string | null,
    conAyuda = false,
  ): string | null {
    return describirCon(conAyuda && `${idCampo}-ayuda`, mensaje && `${idCampo}-error`);
  }

  protected formatearTelefonoContacto(): void {
    formatearControlTelefono(this.formulario.controls.contactoPrincipal.controls.telefono);
  }

  protected crear(): void {
    const grupo = this.activo();
    if (!grupo || this.creando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerInvalido();
      return;
    }

    this.errorGeneral.set(null);
    this.erroresCampos.set({});
    const { nombreCompleto, codigoInterno, fechaNacimiento, contactoPrincipal } =
      this.formulario.getRawValue();
    this.creando.set(true);
    this.servicioAdultos
      .crear(grupo.idGrupo, {
        nombreCompleto: nombreCompleto.trim(),
        codigoInterno: codigoInterno.trim() === '' ? null : codigoInterno.trim(),
        fechaNacimiento,
        notasEmergencia: null,
        observacionesGenerales: null,
        contactoPrincipal: {
          nombre: contactoPrincipal.nombre.trim(),
          idParentesco: contactoPrincipal.idParentesco!,
          telefono:
            normalizarTelefono(contactoPrincipal.telefono) ?? contactoPrincipal.telefono.trim(),
        },
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
          } else {
            this.enfocarPrimerInvalido();
          }
        },
      });
  }

  private enfocarPrimerInvalido(): void {
    enfocarPrimerCampoInvalido(dentroDe(this.host, '#adultos-alta form'), this.injector);
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
