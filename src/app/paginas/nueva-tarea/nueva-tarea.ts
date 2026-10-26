import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { BuscadorMedicamento } from '../plan/buscador-medicamento/buscador-medicamento';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import {
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { instanteSantiago } from '../../nucleo/fechas';
import { RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import {
  erroresDeCampos,
  mensajeDeCampo,
  mensajeDeError,
} from '../../nucleo/http/mensaje-de-error';
import { RespuestaMedicamento } from '../../nucleo/planificacion/modelos-planificacion';
import {
  SolicitudCrearTareaManual,
  TipoTareaManual,
} from '../../nucleo/tareas/modelos-tareas';
import { ServicioTareas } from '../../nucleo/tareas/servicio-tareas';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

type GrupoLinea = FormGroup<{
  idMedicamento: FormControl<number | null>;
  nombreMedicamento: FormControl<string>;
  idPresentacion: FormControl<number | null>;
  cantidadSolicitada: FormControl<number | null>;
  idUnidadCantidad: FormControl<number | null>;
  dosisIndicada: FormControl<string>;
  observaciones: FormControl<string>;
}>;

/** Campos comunes (no de línea/cita) cuyo aviso se arma con `mensajeDeCampo`. */
type CampoComun = 'idAdultoMayor' | 'titulo' | 'descripcion' | 'fecha' | 'hora' | 'idResponsable';
/** Campos de una línea de compra. */
type CampoLinea = 'idMedicamento' | 'idPresentacion' | 'cantidadSolicitada' | 'idUnidadCantidad';
/** Campos de la cita. */
type CampoCita = 'nombreMedico' | 'lugarAtencion' | 'observaciones';

const MENSAJES_REQUERIDO_COMUN: Partial<Record<CampoComun, string>> = {
  idAdultoMayor: 'Elige un adulto mayor',
  titulo: 'Ingresa un título',
  fecha: 'Indica la fecha',
  hora: 'Indica la hora',
};

const MENSAJES_REQUERIDO_LINEA: Partial<Record<CampoLinea, string>> = {
  idMedicamento: 'Elige un medicamento',
  idPresentacion: 'Elige la presentación',
  cantidadSolicitada: 'Ingresa la cantidad',
  idUnidadCantidad: 'Elige la unidad',
};

const MENSAJES_REQUERIDO_CITA: Partial<Record<CampoCita, string>> = {
  nombreMedico: 'Ingresa el nombre del médico',
  lugarAtencion: 'Ingresa el lugar de la atención',
};

/** Texto recortado, o `null` si queda en blanco (igual que en `FormularioDetalle`). */
function textoONulo(valor: string): string | null {
  const recortado = valor.trim();
  return recortado === '' ? null : recortado;
}

/**
 * Página "Nueva tarea" (`/tareas/nueva`): alta manual de una tarea de
 * cuidado, de compra/retiro de medicamentos (varias líneas) o de cita o
 * control médico. Consume `ServicioTareas.crearManual` (Tarea 8 de la API).
 *
 * Solo coordinador o administrador (regla de permisos de la Fase 4): sin
 * grupo activo no hay nada que crear (mismo aviso de `Tareas`); con grupo
 * pero sin poder administrar, se muestra el aviso de la regla y no se monta
 * el formulario.
 *
 * Reutiliza `BuscadorMedicamento` (Tarea 9) una vez por línea de compra,
 * igual que `FormularioDetalle`: el medicamento elegido se muestra como
 * texto y preselecciona su presentación si la trae. Al elegir "Cita o
 * control médico" el `FormArray` de líneas se deshabilita (y viceversa con
 * el grupo de la cita) para que su validez no bloquee el envío del tipo que
 * no se está usando.
 */
@Component({
  selector: 'app-nueva-tarea',
  imports: [ReactiveFormsModule, RouterLink, BuscadorMedicamento],
  templateUrl: './nueva-tarea.html',
  styleUrl: './nueva-tarea.scss',
})
export class NuevaTarea implements OnInit {
  private readonly servicioTareas = inject(ServicioTareas);
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;

  protected readonly esAdministrador = signal(false);
  protected readonly puedeAdministrar = computed(() =>
    puedeAdministrarGrupo(this.activo()?.miRol, this.esAdministrador()),
  );

  protected readonly adultos = signal<RespuestaAdultoMayor[]>([]);
  protected readonly presentaciones = signal<RespuestaOpcionCatalogo[]>([]);
  protected readonly unidades = signal<RespuestaOpcionCatalogo[]>([]);

  /** Integrantes del grupo tal cual los devuelve la API (todos los estados). */
  private readonly integrantesTodos = signal<RespuestaIntegrante[]>([]);
  /** idEstado de "ACTIVO" para INTEGRANTE_GRUPO; null hasta que llegue el catálogo. */
  private readonly idEstadoActivoIntegrante = signal<number | null>(null);
  /** Integrantes ACTIVOS del grupo: los únicos que se ofrecen como responsable. */
  protected readonly integrantesActivos = computed(() => {
    const idActivo = this.idEstadoActivoIntegrante();
    if (idActivo === null) return [];
    return this.integrantesTodos().filter((integrante) => integrante.idEstado === idActivo);
  });

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});

  protected readonly formulario = this.fb.group({
    tipoTarea: this.fb.control<TipoTareaManual>('COMPRA_RETIRO_MEDICAMENTOS', Validators.required),
    idAdultoMayor: this.fb.control<number | null>(null, Validators.required),
    titulo: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['', Validators.maxLength(1000)],
    fecha: ['', Validators.required],
    hora: ['', Validators.required],
    idResponsable: this.fb.control<number | null>(null),
    compra: this.fb.array<GrupoLinea>([]),
    cita: this.fb.group({
      nombreMedico: ['', [Validators.required, Validators.maxLength(180)]],
      lugarAtencion: ['', [Validators.required, Validators.maxLength(250)]],
      observaciones: ['', Validators.maxLength(1000)],
    }),
  });

  protected readonly compra = this.formulario.controls.compra;
  protected readonly cita = this.formulario.controls.cita;

  /** idGrupo con el que ya se cargaron (o se intentaron cargar) los datos de referencia. */
  private idGrupoCargado: number | null = null;

  constructor() {
    this.compra.push(this.crearLinea());
    // Tipo por defecto es COMPRA: la cita arranca deshabilitada (excluida de
    // la validez del formulario) hasta que se elija "Cita o control médico".
    this.cita.disable();

    this.formulario.controls.tipoTarea.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((tipo) => this.alCambiarTipo(tipo));

    effect(() => {
      const grupo = this.activo();
      if (this.idGrupoCargado === null) {
        if (grupo) {
          this.idGrupoCargado = grupo.idGrupo;
          this.cargarReferencias(grupo.idGrupo);
        }
        return;
      }
      if (!grupo || grupo.idGrupo !== this.idGrupoCargado) {
        this.router.navigateByUrl('/tareas');
      }
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      // Defensivo: sin esto, un administrador sin membresía no vería el formulario.
      error: () => undefined,
    });
    this.servicioCatalogos.opciones('PRESENTACION_MEDICAMENTO').subscribe({
      next: (opciones) => this.presentaciones.set(opciones),
      error: () => undefined,
    });
    this.servicioCatalogos.opciones('UNIDAD_DOSIS').subscribe({
      next: (opciones) => this.unidades.set(opciones),
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

  protected mensaje(campo: CampoComun): string | null {
    const control: AbstractControl = this.formulario.controls[campo];
    return mensajeDeCampo(
      control,
      this.erroresServidor(),
      campo,
      MENSAJES_REQUERIDO_COMUN[campo] ?? '',
    );
  }

  protected mensajeLinea(indice: number, campo: CampoLinea): string | null {
    const control = this.compra.at(indice).controls[campo];
    const mensaje = mensajeDeCampo(
      control,
      this.erroresServidor(),
      `compra[${indice}].${campo}`,
      MENSAJES_REQUERIDO_LINEA[campo] ?? '',
    );
    if (mensaje) return mensaje;
    if (campo === 'cantidadSolicitada' && control.touched && control.hasError('min')) {
      return 'La cantidad debe ser mayor que 0';
    }
    return null;
  }

  protected mensajeCita(campo: CampoCita): string | null {
    const control = this.cita.controls[campo];
    return mensajeDeCampo(
      control,
      this.erroresServidor(),
      `cita.${campo}`,
      MENSAJES_REQUERIDO_CITA[campo] ?? '',
    );
  }

  protected elegirMedicamento(indice: number, medicamento: RespuestaMedicamento): void {
    const controles = this.compra.at(indice).controls;
    controles.nombreMedicamento.setValue(medicamento.nombre);
    controles.idMedicamento.setValue(medicamento.idMedicamento);
    // Siempre se fija (incluso a `null`): si no, un medicamento sin
    // presentación propia conserva la del anterior y se pide la compra
    // equivocada (riesgo de datos, hallazgo T12-1).
    controles.idPresentacion.setValue(medicamento.idPresentacion ?? null);
  }

  protected cambiarMedicamento(indice: number): void {
    const controles = this.compra.at(indice).controls;
    controles.nombreMedicamento.setValue('');
    controles.idMedicamento.setValue(null);
  }

  protected agregarLinea(): void {
    this.compra.push(this.crearLinea());
  }

  protected quitarLinea(indice: number): void {
    if (this.compra.length <= 1) return;
    this.compra.removeAt(indice);
  }

  protected cancelar(): void {
    this.router.navigateByUrl('/tareas');
  }

  protected enviar(): void {
    if (this.guardando()) return;
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;

    const grupo = this.activo();
    if (!grupo) return;

    const valores = this.formulario.getRawValue();
    const tipoTarea = valores.tipoTarea;
    const esCompra = tipoTarea === 'COMPRA_RETIRO_MEDICAMENTOS';

    const solicitud: SolicitudCrearTareaManual = {
      tipoTarea,
      idAdultoMayor: valores.idAdultoMayor!,
      titulo: valores.titulo.trim(),
      descripcion: textoONulo(valores.descripcion),
      fechaHorario: instanteSantiago(valores.fecha, valores.hora),
      idResponsable: valores.idResponsable,
      compra: esCompra
        ? valores.compra.map((linea) => ({
            idMedicamento: linea.idMedicamento!,
            idPresentacion: linea.idPresentacion!,
            dosisIndicada: textoONulo(linea.dosisIndicada),
            cantidadSolicitada: Number(linea.cantidadSolicitada),
            idUnidadCantidad: linea.idUnidadCantidad!,
            observaciones: textoONulo(linea.observaciones),
          }))
        : null,
      cita: esCompra
        ? null
        : {
            nombreMedico: valores.cita.nombreMedico.trim(),
            lugarAtencion: valores.cita.lugarAtencion.trim(),
            observaciones: textoONulo(valores.cita.observaciones),
          },
    };

    this.error.set(null);
    this.erroresServidor.set({});
    this.guardando.set(true);
    this.servicioTareas.crearManual(grupo.idGrupo, solicitud).subscribe({
      next: (tarea) => {
        this.guardando.set(false);
        this.router.navigate(['/tareas', tarea.idTarea]);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const campos = erroresDeCampos(error);
        this.erroresServidor.set(campos);
        if (Object.keys(campos).length === 0) {
          this.error.set(mensajeDeError(error));
        }
      },
    });
  }

  private alCambiarTipo(tipo: TipoTareaManual): void {
    if (tipo === 'COMPRA_RETIRO_MEDICAMENTOS') {
      this.compra.enable();
      this.cita.disable();
    } else {
      this.compra.disable();
      this.cita.enable();
    }
  }

  private crearLinea(): GrupoLinea {
    return this.fb.group({
      idMedicamento: this.fb.control<number | null>(null, Validators.required),
      nombreMedicamento: [''],
      idPresentacion: this.fb.control<number | null>(null, Validators.required),
      cantidadSolicitada: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.001),
      ]),
      idUnidadCantidad: this.fb.control<number | null>(null, Validators.required),
      dosisIndicada: [''],
      observaciones: [''],
    });
  }

  private cargarReferencias(idGrupo: number): void {
    this.servicioAdultos.listar(idGrupo).subscribe({
      next: (adultos) => this.adultos.set(adultos),
      error: () => undefined,
    });
    this.servicioGrupos.integrantes(idGrupo).subscribe({
      next: (integrantes) => this.integrantesTodos.set(integrantes),
      error: () => undefined,
    });
  }
}
