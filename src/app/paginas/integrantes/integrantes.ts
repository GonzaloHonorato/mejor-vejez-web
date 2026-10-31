import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ClaveTemporal } from '../../compartido/clave-temporal/clave-temporal';
import { Icono } from '../../compartido/icono/icono';
import { inicialesDe } from '../../compartido/marco-app/identidad-usuario';
import { erroresDeCampos, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { etiquetaRol } from '../../nucleo/grupos/etiqueta-rol';
import { RespuestaGrupo, RespuestaIntegrante, RespuestaRol } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { SeccionSucesion } from './seccion-sucesion/seccion-sucesion';

/** Lo que muestra el diálogo de clave temporal al crear un integrante nuevo. */
interface ClaveAMostrar {
  titulo: string;
  clave: string;
  correoEnviado: boolean;
}

/**
 * Como `Validators.email`, pero ignora espacios al inicio/fin: sin esto, un
 * correo con espacios pegados (típico al copiar/pegar) queda inválido sin
 * mensaje visible.
 */
function validarCorreoConEspacios(control: AbstractControl<string>): ValidationErrors | null {
  return Validators.email({ value: control.value.trim() } as AbstractControl);
}

/**
 * Página "Integrantes" (`/grupos/:idGrupo`): lista de integrantes del grupo
 * y, si quien mira es COORDINADOR o admin, las acciones de administración
 * (agregar, crear, cambiar rol, desactivar/reactivar, eliminar), con los
 * formularios de alta plegados tras sus acciones del encabezado. Cualquier
 * integrante activo puede salir del grupo. El enlace "Auditoría del grupo"
 * (`/grupos/:idGrupo/auditoria`) usa el mismo `puedeAdministrar()`: la API
 * ya exige coordinador o administrador, pero el enlace no se ofrece a quien
 * de todas formas recibiría un 403.
 *
 * Debajo va la sección de sucesión de la coordinación (`SeccionSucesion`),
 * visible para cualquiera que pueda ver el grupo. Cuando emite `cambio` se
 * recargan el grupo (el `miRol` propio cambia al completar la
 * transferencia), los integrantes y el grupo activo compartido.
 */
@Component({
  selector: 'app-integrantes',
  imports: [ReactiveFormsModule, RouterLink, SeccionSucesion, ClaveTemporal, Icono],
  templateUrl: './integrantes.html',
  styleUrl: './integrantes.scss',
})
export class Integrantes implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly grupoActivo = inject(ServicioGrupoActivo);
  private readonly injector = inject(Injector);

  protected readonly inicialesDe = inicialesDe;
  protected readonly etiquetaRol = etiquetaRol;
  protected readonly idGrupo = Number(this.ruta.snapshot.paramMap.get('idGrupo'));

  protected readonly grupo = signal<RespuestaGrupo | null>(null);
  /** Falso mientras no sepamos si la carga del grupo fue exitosa: sin esto no mostramos acciones. */
  protected readonly grupoCargado = signal(false);
  protected readonly integrantes = signal<RespuestaIntegrante[]>([]);
  /** Falso hasta que llega la primera lista: mientras tanto se muestra el esqueleto. */
  protected readonly integrantesCargados = signal(false);
  private readonly errorCargaGrupo = signal<string | null>(null);
  private readonly errorCargaIntegrantes = signal<string | null>(null);
  /** Error al cargar el grupo o sus integrantes; se ofrece "Reintentar". */
  protected readonly errorCarga = computed(
    () => this.errorCargaGrupo() ?? this.errorCargaIntegrantes(),
  );
  protected readonly roles = signal<RespuestaRol[]>([]);
  protected readonly esAdministrador = signal(false);
  /** Id del usuario de la sesión (`GET /api/yo`), para la sección de sucesión. */
  protected readonly idUsuario = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly agregando = signal(false);
  /** "Agregar integrante" por correo: plegado tras su acción del encabezado. */
  protected readonly agregarAbierto = signal(false);
  /** Interruptor "Notificar las alertas al coordinador". */
  protected readonly cambiandoNotificaCoordinador = signal(false);

  /** Activos primero; estable dentro de cada grupo (JS garantiza sort estable). */
  protected readonly integrantesOrdenados = computed<RespuestaIntegrante[]>(() =>
    [...this.integrantes()].sort(
      (a, b) => Number(!this.estaActivo(a)) - Number(!this.estaActivo(b)),
    ),
  );

  protected readonly totalActivos = computed(
    () => this.integrantes().filter((integrante) => this.estaActivo(integrante)).length,
  );

  /** Sin grupo cargado no hay acciones posibles, aunque la persona sea admin. */
  protected readonly puedeAdministrar = computed(
    () => this.grupoCargado() && (this.grupo()?.miRol === 'COORDINADOR' || this.esAdministrador()),
  );

  /** COORDINADOR con membresía: el único que puede proponer un sucesor. */
  protected readonly soyCoordinador = computed(() => this.grupo()?.miRol === 'COORDINADOR');

  /** Puede salir del grupo: tiene un rol asignado (membresía activa). */
  protected readonly esMiembroActivo = computed(
    () => this.grupoCargado() && this.grupo()?.miRol != null,
  );

  private readonly fb = inject(NonNullableFormBuilder);

  /**
   * Un `FormControl` por fila para el select de rol: a diferencia de
   * `[value]`/`[selected]`, `writeValue` de `SelectControlValueAccessor`
   * reaplica el valor real al <select> en cada carga (incluida la
   * reversión tras un 422), sin depender de la memoización de bindings
   * de Angular.
   */
  private readonly controlesRol = new Map<number, FormControl<number>>();

  protected controlRol(integrante: RespuestaIntegrante): FormControl<number> {
    let control = this.controlesRol.get(integrante.idIntegrante);
    if (!control) {
      control = this.fb.control(integrante.idRol);
      this.controlesRol.set(integrante.idIntegrante, control);
    }
    return control;
  }

  protected readonly formulario = this.fb.group({
    email: ['', [Validators.required, validarCorreoConEspacios]],
    // null hasta elegir/recibir un rol real: con Validators.required, 0 no sería válido
    // igual (no hay rol con idRol 0), pero null deja la intención explícita.
    idRol: this.fb.control<number | null>(null, Validators.required),
  });

  /** "Crear integrante nuevo": abierto/cerrado, envío en curso y error. */
  protected readonly creandoIntegrante = signal(false);
  protected readonly guardandoCrearIntegrante = signal(false);
  protected readonly errorCrearIntegrante = signal<string | null>(null);
  protected readonly erroresCamposCrearIntegrante = signal<Record<string, string>>({});
  /** 409 al crear: se sugiere agregar por correo en vez de crear la cuenta de nuevo. */
  protected readonly yaExisteCuentaIntegrante = signal(false);
  /**
   * La clave temporal vive únicamente mientras este diálogo está montado
   * (ver `ClaveTemporal`): al cerrarlo se vuelve a `null` y se descarta, sin
   * quedar en ningún servicio, `localStorage` ni log.
   */
  protected readonly claveAMostrar = signal<ClaveAMostrar | null>(null);
  /**
   * Botón "Crear integrante nuevo" del encabezado: se consulta de nuevo en
   * cada lectura (signal de `viewChild`), así que siempre apunta a la
   * instancia vigente aunque un `@if` la haya recreado.
   */
  private readonly botonCrearIntegranteNuevo = viewChild<ElementRef<HTMLButtonElement>>(
    'botonCrearIntegranteNuevo',
  );
  /** Dónde devolver el foco al cerrar `ClaveTemporal`: se fija al abrir el flujo. */
  private restaurarFoco: (() => void) | null = null;

  protected readonly formularioCrearIntegrante = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.required, validarCorreoConEspacios]],
    idRol: this.fb.control<number | null>(null, Validators.required),
  });

  ngOnInit(): void {
    this.cargarGrupo();
    this.cargarIntegrantes();
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.esAdministrador.set(yo.esAdministrador);
        this.idUsuario.set(yo.idUsuario);
      },
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
    this.servicioGrupos.roles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        if (roles.length > 0) {
          this.formulario.patchValue({ idRol: roles[0].idRol });
          this.formularioCrearIntegrante.patchValue({ idRol: roles[0].idRol });
        }
      },
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected estaActivo(integrante: RespuestaIntegrante): boolean {
    return integrante.fechaDesactivacion === null;
  }

  protected agregar(): void {
    if (this.agregando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.error.set(null);
    const { email, idRol } = this.formulario.getRawValue();
    // El formulario es inválido (y agregar() retorna antes) mientras idRol sea null.
    this.agregando.set(true);
    this.servicioGrupos.incorporar(this.idGrupo, { email: email.trim(), idRol: idRol! }).subscribe({
      next: () => {
        this.agregando.set(false);
        this.formulario.patchValue({ email: '' });
        this.cargarIntegrantes();
      },
      error: (error: unknown) => {
        this.agregando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  protected alternarAgregar(): void {
    if (this.agregarAbierto()) this.cerrarAgregar();
    else this.abrirAgregar();
  }

  protected abrirAgregar(): void {
    this.creandoIntegrante.set(false);
    this.agregarAbierto.set(true);
    this.enfocar(() => document.getElementById('integrante-email'));
  }

  protected cerrarAgregar(): void {
    this.agregarAbierto.set(false);
    this.enfocar(() => document.getElementById('integrantes-abrir-agregar'));
  }

  protected alternarCrearIntegrante(): void {
    if (this.creandoIntegrante()) this.cancelarCrearIntegrante();
    else this.abrirCrearIntegrante();
  }

  protected abrirCrearIntegrante(): void {
    this.agregarAbierto.set(false);
    this.restaurarFoco = () => this.botonCrearIntegranteNuevo()?.nativeElement.focus();
    this.creandoIntegrante.set(true);
    this.errorCrearIntegrante.set(null);
    this.erroresCamposCrearIntegrante.set({});
    this.yaExisteCuentaIntegrante.set(false);
    this.formularioCrearIntegrante.reset({
      nombre: '',
      email: '',
      idRol: this.roles()[0]?.idRol ?? null,
    });
    this.enfocar(() => document.getElementById('integrante-crear-nombre'));
  }

  protected cancelarCrearIntegrante(): void {
    this.creandoIntegrante.set(false);
    this.enfocar(() => this.botonCrearIntegranteNuevo()?.nativeElement ?? null);
  }

  protected crearIntegrante(): void {
    if (this.guardandoCrearIntegrante()) return;
    if (this.formularioCrearIntegrante.invalid) {
      this.formularioCrearIntegrante.markAllAsTouched();
      this.errorCrearIntegrante.set(null);
      this.erroresCamposCrearIntegrante.set(this.erroresLocalesNombreCrearIntegrante());
      return;
    }

    this.errorCrearIntegrante.set(null);
    this.erroresCamposCrearIntegrante.set({});
    this.yaExisteCuentaIntegrante.set(false);
    const { nombre, email, idRol } = this.formularioCrearIntegrante.getRawValue();
    // El formulario es inválido (y crearIntegrante() retorna antes) mientras idRol sea null.
    this.guardandoCrearIntegrante.set(true);
    this.servicioGrupos.crearIntegrante(this.idGrupo, { nombre, email: email.trim(), idRol: idRol! }).subscribe({
      next: (respuesta) => {
        this.guardandoCrearIntegrante.set(false);
        this.creandoIntegrante.set(false);
        this.claveAMostrar.set({
          titulo: 'Integrante creado',
          clave: respuesta.claveTemporal,
          correoEnviado: respuesta.correoEnviado,
        });
        this.cargarIntegrantes();
      },
      error: (error: unknown) => {
        this.guardandoCrearIntegrante.set(false);
        this.yaExisteCuentaIntegrante.set(error instanceof HttpErrorResponse && error.status === 409);
        const campos = erroresDeCampos(error);
        this.erroresCamposCrearIntegrante.set(campos);
        if (Object.keys(campos).length === 0) {
          this.errorCrearIntegrante.set(mensajeDeError(error));
        }
      },
    });
  }

  /** Mensaje local para "nombre" cuando el formulario es inválido del lado del cliente (antes de llamar a la API). */
  private erroresLocalesNombreCrearIntegrante(): Record<string, string> {
    const control = this.formularioCrearIntegrante.controls.nombre;
    if (control.hasError('required')) {
      return { nombre: 'El nombre es obligatorio.' };
    }
    if (control.hasError('maxlength')) {
      return { nombre: 'El nombre no puede superar los 160 caracteres.' };
    }
    return {};
  }

  /** Si ya existe una cuenta con ese correo, se abre el flujo de agregar por correo de esta misma página. */
  protected irAAgregarPorCorreo(): void {
    this.yaExisteCuentaIntegrante.set(false);
    this.errorCrearIntegrante.set(null);
    this.abrirAgregar();
  }

  /** Cierra `ClaveTemporal` y devuelve el foco a quien abrió el flujo que la mostró. */
  protected cerrarClave(): void {
    this.claveAMostrar.set(null);
    const restaurar = this.restaurarFoco;
    this.restaurarFoco = null;
    restaurar?.();
  }

  protected cambiarRol(integrante: RespuestaIntegrante, idRol: number): void {
    this.error.set(null);
    this.servicioGrupos.cambiarRol(this.idGrupo, integrante.idIntegrante, idRol).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => {
        // Revertimos el select recargando el estado real desde la API.
        this.error.set(mensajeDeError(error));
        this.cargarIntegrantes();
      },
    });
  }

  protected desactivar(integrante: RespuestaIntegrante): void {
    this.error.set(null);
    this.servicioGrupos.desactivar(this.idGrupo, integrante.idIntegrante).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected reactivar(integrante: RespuestaIntegrante): void {
    this.error.set(null);
    this.servicioGrupos.reactivar(this.idGrupo, integrante.idIntegrante).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected eliminar(integrante: RespuestaIntegrante): void {
    if (!window.confirm('Solo si fue agregado por error.')) return;

    this.error.set(null);
    this.servicioGrupos.eliminar(this.idGrupo, integrante.idIntegrante).subscribe({
      next: () => this.cargarIntegrantes(),
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected salir(): void {
    if (!window.confirm('¿Seguro que quieres salir del grupo?')) return;

    this.error.set(null);
    this.servicioGrupos.salir(this.idGrupo).subscribe({
      next: async () => {
        await this.grupoActivo.cargar();
        this.router.navigateByUrl('/grupos');
      },
      error: (error: unknown) => this.error.set(mensajeDeError(error)),
    });
  }

  protected reintentar(): void {
    this.cargarGrupo();
    this.cargarIntegrantes();
  }

  /**
   * Cambia "Notificar las alertas al coordinador" (sólo coordinador o
   * administrador, `puedeAdministrar()`). Envía el nombre actual del grupo
   * porque `PATCH /api/grupos/{idGrupo}` exige ambos campos, y refresca
   * `ServicioGrupoActivo` para que el resto de la app vea el cambio.
   */
  protected alternarNotificarCoordinador(evento: Event): void {
    const grupo = this.grupo();
    if (!grupo || this.cambiandoNotificaCoordinador()) return;

    this.error.set(null);
    this.cambiandoNotificaCoordinador.set(true);
    this.servicioGrupos
      .actualizar(this.idGrupo, {
        nombreGrupo: grupo.nombreGrupo,
        notificaCoordinador: !grupo.notificaCoordinador,
      })
      .subscribe({
        next: async (grupoActualizado) => {
          this.grupo.set(grupoActualizado);
          this.cambiandoNotificaCoordinador.set(false);
          await this.grupoActivo.cargar();
        },
        error: (error: unknown) => {
          this.cambiandoNotificaCoordinador.set(false);
          this.error.set(mensajeDeError(error));
          // El clic ya cambió el `checked` del DOM nativo, pero `grupo()` no
          // cambió: sin esto, Angular no repinta (el binding `[checked]` no
          // vio una expresión distinta) y el interruptor queda mostrando el
          // valor nuevo que NO se guardó.
          (evento.target as HTMLInputElement).checked = grupo.notificaCoordinador;
        },
      });
  }

  /**
   * La sección de sucesión cambió algo: al completar la transferencia
   * cambian los roles (el propio incluido), así que se recargan el grupo,
   * los integrantes y el grupo activo compartido.
   */
  protected alCambiarSucesion(): void {
    this.cargarGrupo();
    this.cargarIntegrantes();
    void this.grupoActivo.cargar();
  }

  private cargarGrupo(): void {
    this.servicioGrupos.obtener(this.idGrupo).subscribe({
      next: (grupo) => {
        this.grupo.set(grupo);
        this.grupoCargado.set(true);
        this.errorCargaGrupo.set(null);
      },
      error: (error: unknown) => this.errorCargaGrupo.set(mensajeDeError(error)),
    });
  }

  private cargarIntegrantes(): void {
    this.servicioGrupos.integrantes(this.idGrupo).subscribe({
      next: (integrantes) => {
        this.integrantes.set(integrantes);
        this.integrantesCargados.set(true);
        this.errorCargaIntegrantes.set(null);
        // Sincroniza cada select con el valor real de la API: también revierte
        // una selección optimista que haya quedado desfasada tras un error.
        for (const integrante of integrantes) {
          this.controlRol(integrante).setValue(integrante.idRol);
        }
      },
      error: (error: unknown) => this.errorCargaIntegrantes.set(mensajeDeError(error)),
    });
  }

  /** Enfoca el elemento cuando la vista ya lo pintó (los formularios se montan con `@if`). */
  private enfocar(elemento: () => HTMLElement | null): void {
    afterNextRender(() => elemento()?.focus(), { injector: this.injector });
  }
}
