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
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AccionMenu, BotonDividido } from '../../compartido/boton-dividido/boton-dividido';
import { ClaveTemporal } from '../../compartido/clave-temporal/clave-temporal';
import { Icono } from '../../compartido/icono/icono';
import { inicialesDe } from '../../compartido/marco-app/identidad-usuario';
import { erroresDeCampos, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { dentroDe, enfocarPrimerCampoInvalido } from '../../nucleo/foco';
import {
  AYUDA_TELEFONO,
  MENSAJE_TELEFONO_CHILENO,
  formatearControlTelefono,
  formatearTelefono,
  mismoTelefono,
  normalizarTelefono,
  validadorTelefonoChileno,
  validadorTelefonoChilenoSalvo,
} from '../../nucleo/telefono';
import { RespuestaUsuario } from '../../nucleo/usuarios/modelos-usuarios';
import { ServicioUsuarios } from '../../nucleo/usuarios/servicio-usuarios';

const TAMANO_PAGINA = 10;

/** Cómo se nombra en el menú el paso a cada estado de la cuenta. */
const ACCION_POR_ESTADO: Record<string, string> = {
  ACTIVO: 'Activar',
  INACTIVO: 'Desactivar',
  BLOQUEADO: 'Bloquear',
};

/** Lo que muestra el diálogo de clave temporal: cuenta creada o acceso reenviado. */
interface ClaveAMostrar {
  titulo: string;
  clave: string;
  correoEnviado: boolean;
}

/**
 * Página "Administración de usuarios" (`/administracion/usuarios`, solo
 * administradores, ver `guardAdministrador`): buscador, grilla paginada y,
 * por usuario, un botón combinado: "Editar" (nombre/teléfono/administrador,
 * en una fila bajo la del usuario) y, en el menú, reenvío de accesos y
 * cambio de estado.
 * Tiene además el enlace "Auditoría global" (`/administracion/auditoria`):
 * esta página ya está detrás de `guardAdministrador`, así que no hace falta
 * ninguna condición extra para mostrarlo.
 */
@Component({
  selector: 'app-administracion-usuarios',
  imports: [ReactiveFormsModule, RouterLink, ClaveTemporal, Icono, BotonDividido],
  templateUrl: './administracion-usuarios.html',
  styleUrl: './administracion-usuarios.scss',
})
export class AdministracionUsuarios implements OnInit {
  private readonly servicioUsuarios = inject(ServicioUsuarios);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly ayudaTelefono = AYUDA_TELEFONO;

  protected readonly iniciales = inicialesDe;

  protected readonly usuarios = signal<RespuestaUsuario[]>([]);

  /** Nombres que se repiten en la página: esas filas suman el correo a sus nombres accesibles. */
  private readonly nombresRepetidos = computed(() => {
    const vistos = new Set<string>();
    const repetidos = new Set<string>();
    for (const { nombre } of this.usuarios()) (vistos.has(nombre) ? repetidos : vistos).add(nombre);
    return repetidos;
  });

  /** Nombre de la fila para lectores: "Ana" o, si hay otra "Ana", "Ana, ana@correo.cl". */
  protected nombreDistintivo(usuario: RespuestaUsuario): string {
    return this.nombresRepetidos().has(usuario.nombre) ? `${usuario.nombre}, ${usuario.email}` : usuario.nombre;
  }
  protected readonly estados = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly pagina = signal(0);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  /** Carga del listado: en curso y su error (con "Reintentar"), aparte de los errores de las acciones. */
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly hayMasPaginas = computed(() => (this.pagina() + 1) * TAMANO_PAGINA < this.total());

  protected readonly editando = signal<RespuestaUsuario | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorEdicion = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  protected readonly formularioBusqueda = inject(NonNullableFormBuilder).group({
    texto: [''],
  });

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: ['', Validators.required],
    telefono: ['', validadorTelefonoChilenoSalvo(() => this.editando()?.telefono)],
    esAdministrador: [false],
  });

  /** "Crear usuario": abierto/cerrado, envío en curso, error y campos. */
  protected readonly creandoUsuario = signal(false);
  protected readonly guardandoCrear = signal(false);
  protected readonly errorCrear = signal<string | null>(null);
  protected readonly erroresCamposCrear = signal<Record<string, string>>({});
  /** Usuario cuyo "Reenviar accesos" está en curso (bloquea un segundo clic sobre la misma fila). */
  protected readonly reenviando = signal<number | null>(null);
  /**
   * La clave temporal vive únicamente mientras este diálogo está montado
   * (ver `ClaveTemporal`): al cerrarlo se vuelve a `null` y se descarta, sin
   * quedar en ningún servicio, `localStorage` ni log.
   */
  protected readonly claveAMostrar = signal<ClaveAMostrar | null>(null);
  /** Botón "Crear usuario" del encabezado, que abre y cierra el formulario de alta. */
  private readonly botonCrearUsuario = viewChild<ElementRef<HTMLButtonElement>>('botonCrearUsuario');
  /** Dónde devolver el foco al cerrar `ClaveTemporal`: se fija al abrir cada flujo. */
  private restaurarFoco: (() => void) | null = null;

  protected readonly formularioCrear = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', validadorTelefonoChileno],
  });

  ngOnInit(): void {
    this.servicioCatalogos.estados('USUARIO', 'ESTADO').subscribe({
      next: (estados) => this.estados.set(estados),
      error: (error: unknown) =>
        this.error.set(mensajeDeError(error, 'No pudimos cargar los estados.')),
    });
    this.cargar();
  }

  protected buscar(): void {
    this.pagina.set(0);
    this.cargar();
  }

  protected paginaAnterior(): void {
    if (this.pagina() === 0) return;
    this.pagina.set(this.pagina() - 1);
    this.cargar();
  }

  protected siguientePagina(): void {
    if (!this.hayMasPaginas()) return;
    this.pagina.set(this.pagina() + 1);
    this.cargar();
  }

  /**
   * Menú del botón combinado: "Reenviar accesos" (solo ACTIVO) y el paso a
   * cada otro estado del catálogo; bloquear va al final, como peligro.
   */
  protected accionesMenu(usuario: RespuestaUsuario): AccionMenu[] {
    const acciones: AccionMenu[] = [];
    if (this.puedeReenviarAcceso(usuario)) {
      acciones.push({
        id: 'reenviar',
        etiqueta: 'Reenviar accesos',
        deshabilitada: this.reenviando() === usuario.idUsuario,
      });
    }
    const cambios = [...this.estados()]
      .filter((estado) => estado.idEstado !== usuario.idEstado)
      .sort((a, b) => a.orden - b.orden)
      .map((estado) => ({
        id: `estado-${estado.idEstado}`,
        etiqueta: ACCION_POR_ESTADO[estado.codigo] ?? `Cambiar a ${estado.descripcion}`,
        peligro: estado.codigo === 'BLOQUEADO',
      }));
    return [...acciones, ...cambios.filter((c) => !c.peligro), ...cambios.filter((c) => c.peligro)];
  }

  protected ejecutar(usuario: RespuestaUsuario, accion: string): void {
    if (accion === 'reenviar') {
      this.reenviarAcceso(usuario);
    } else if (accion.startsWith('estado-')) {
      this.cambiarEstado(usuario, Number(accion.slice('estado-'.length)));
    }
  }

  /** Teléfono formateado (`+56 9 1234 5678`) o "Sin teléfono". */
  protected telefono(usuario: RespuestaUsuario): string {
    return formatearTelefono(usuario.telefono) || 'Sin teléfono';
  }

  protected cambiarEstado(usuario: RespuestaUsuario, idEstado: number): void {
    this.error.set(null);
    this.servicioUsuarios.cambiarEstado(usuario.idUsuario, idEstado).subscribe({
      next: () => this.cargar(),
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        this.cargar();
      },
    });
  }

  protected editar(usuario: RespuestaUsuario): void {
    this.editando.set(usuario);
    this.errorEdicion.set(null);
    this.erroresCampos.set({});
    this.formulario.setValue({
      nombre: usuario.nombre,
      telefono: formatearTelefono(usuario.telefono),
      esAdministrador: usuario.esAdministrador,
    });
    this.enfocar('usuario-nombre');
  }

  protected cancelarEdicion(): void {
    const usuario = this.editando();
    this.editando.set(null);
    if (usuario) {
      this.enfocarElemento(`#usuario-acciones-${usuario.idUsuario} .mv-boton-dividido__principal`);
    }
  }

  protected guardar(): void {
    const usuario = this.editando();
    if (!usuario || this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorEdicion.set(null);
      this.erroresCampos.set({
        ...(this.formulario.controls.nombre.invalid ? { nombre: 'El nombre es obligatorio.' } : {}),
        ...this.errorLocalTelefono(this.formulario.controls.telefono),
      });
      this.enfocarPrimerInvalido('.editar-usuario form');
      return;
    }

    this.erroresCampos.set({});
    this.errorEdicion.set(null);
    const { nombre, telefono, esAdministrador } = this.formulario.getRawValue();
    this.guardando.set(true);
    this.servicioUsuarios
      .actualizar(usuario.idUsuario, {
        nombre,
        telefono: this.telefonoAEnviar(telefono, usuario.telefono),
        esAdministrador,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.editando.set(null);
          this.cargar();
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCampos.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorEdicion.set(mensajeDeError(error));
          } else {
            this.enfocarPrimerInvalido('.editar-usuario form');
          }
        },
      });
  }

  protected abrirCrear(): void {
    this.restaurarFoco = () => this.botonCrearUsuario()?.nativeElement.focus();
    this.creandoUsuario.set(true);
    this.errorCrear.set(null);
    this.erroresCamposCrear.set({});
    this.formularioCrear.reset({ nombre: '', email: '', telefono: '' });
    this.enfocar('usuario-crear-nombre');
  }

  protected cancelarCrear(): void {
    this.creandoUsuario.set(false);
    this.enfocar('usuarios-abrir-crear');
  }

  protected alternarCrear(): void {
    if (this.creandoUsuario()) this.cancelarCrear();
    else this.abrirCrear();
  }

  /** Tono del chip de estado: ACTIVO en verde, el resto neutro. */
  protected tonoEstado(usuario: RespuestaUsuario): string {
    return this.codigoEstado(usuario) === 'ACTIVO' ? 'mv-chip--exito' : '';
  }

  protected descripcionEstado(usuario: RespuestaUsuario): string {
    return this.estados().find((estado) => estado.idEstado === usuario.idEstado)?.descripcion ?? '';
  }

  private codigoEstado(usuario: RespuestaUsuario): string | undefined {
    return this.estados().find((estado) => estado.idEstado === usuario.idEstado)?.codigo;
  }

  protected crear(): void {
    if (this.guardandoCrear()) return;
    if (this.formularioCrear.invalid) {
      this.formularioCrear.markAllAsTouched();
      this.errorCrear.set(null);
      this.erroresCamposCrear.set({
        ...this.erroresLocalesNombreCrear(),
        ...this.errorLocalTelefono(this.formularioCrear.controls.telefono),
      });
      this.enfocarPrimerInvalido('.crear-usuario form');
      return;
    }

    this.errorCrear.set(null);
    this.erroresCamposCrear.set({});
    const { nombre, email, telefono } = this.formularioCrear.getRawValue();
    this.guardandoCrear.set(true);
    this.servicioUsuarios
      .crear({ nombre, email, telefono: this.telefonoAEnviar(telefono, null) })
      .subscribe({
        next: (respuesta) => {
          this.guardandoCrear.set(false);
          this.creandoUsuario.set(false);
          this.claveAMostrar.set({
            titulo: 'Cuenta creada',
            clave: respuesta.claveTemporal,
            correoEnviado: respuesta.correoEnviado,
          });
          this.cargar();
        },
        error: (error: unknown) => {
          this.guardandoCrear.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCamposCrear.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorCrear.set(mensajeDeError(error));
          } else {
            this.enfocarPrimerInvalido('.crear-usuario form');
          }
        },
      });
  }

  protected formatearTelefono(control: FormControl<string>): void {
    formatearControlTelefono(control);
  }

  /** Error local del teléfono (misma regla y mensaje que el core), con la clave `telefono` de la API. */
  private errorLocalTelefono(control: FormControl<string>): Record<string, string> {
    return control.hasError('telefonoChileno') ? { telefono: MENSAJE_TELEFONO_CHILENO } : {};
  }

  /** `null` si viene vacío; el guardado tal cual si no cambió; si no, el nuevo normalizado. */
  private telefonoAEnviar(telefono: string, guardado: string | null): string | null {
    if (telefono.trim() === '') return null;
    if (mismoTelefono(telefono, guardado)) return guardado;
    return normalizarTelefono(telefono) ?? telefono.trim();
  }

  private enfocarPrimerInvalido(selectorFormulario: string): void {
    enfocarPrimerCampoInvalido(dentroDe(this.host, selectorFormulario), this.injector);
  }

  /** Mensaje local para "nombre" cuando el formulario es inválido del lado del cliente (antes de llamar a la API). */
  private erroresLocalesNombreCrear(): Record<string, string> {
    const control = this.formularioCrear.controls.nombre;
    if (control.hasError('required')) {
      return { nombre: 'El nombre es obligatorio.' };
    }
    if (control.hasError('maxlength')) {
      return { nombre: 'El nombre no puede superar los 160 caracteres.' };
    }
    return {};
  }

  /**
   * La API responde 422 a "Reenviar accesos" para un usuario que no está
   * ACTIVO: el botón ni se ofrece. El estado real se busca en el catálogo
   * cargado (`estados()`), no por un `idEstado` fijo (puede variar según
   * el entorno/seed).
   */
  protected puedeReenviarAcceso(usuario: RespuestaUsuario): boolean {
    return this.codigoEstado(usuario) === 'ACTIVO';
  }

  protected reenviarAcceso(usuarioObjetivo: RespuestaUsuario): void {
    if (this.reenviando() !== null) return;
    if (!window.confirm(`¿Reenviar los accesos a ${usuarioObjetivo.nombre}?`)) return;

    // El segmento del botón combinado (el menú le devuelve el foco al
    // elegir) no se destruye mientras dura el pedido: basta la referencia.
    const origen = document.activeElement as HTMLElement | null;
    this.restaurarFoco = () => origen?.focus();
    this.error.set(null);
    this.reenviando.set(usuarioObjetivo.idUsuario);
    this.servicioUsuarios.reenviarAcceso(usuarioObjetivo.idUsuario).subscribe({
      next: (respuesta) => {
        this.reenviando.set(null);
        this.claveAMostrar.set({
          titulo: 'Acceso reenviado',
          clave: respuesta.claveTemporal,
          correoEnviado: respuesta.correoEnviado,
        });
      },
      error: (error: unknown) => {
        this.reenviando.set(null);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  /** Cierra `ClaveTemporal` y devuelve el foco a quien abrió el flujo que la mostró. */
  protected cerrarClave(): void {
    this.claveAMostrar.set(null);
    const restaurar = this.restaurarFoco;
    this.restaurarFoco = null;
    restaurar?.();
  }

  protected reintentar(): void {
    this.cargar();
  }

  private enfocar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  private enfocarElemento(selector: string): void {
    afterNextRender(() => document.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    const { texto } = this.formularioBusqueda.getRawValue();
    this.servicioUsuarios
      .listar({
        texto: texto.trim() === '' ? undefined : texto.trim(),
        pagina: this.pagina(),
        tamano: TAMANO_PAGINA,
      })
      .subscribe({
        next: (respuesta) => {
          this.cargando.set(false);
          this.usuarios.set(respuesta.elementos);
          this.total.set(respuesta.total);
        },
        error: (error: unknown) => {
          this.cargando.set(false);
          this.errorCarga.set(mensajeDeError(error));
        },
      });
  }
}
