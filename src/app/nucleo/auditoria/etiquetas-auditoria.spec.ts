import { TIPOS_ENTIDAD_AUDITORIA } from './modelos-auditoria';
import { CODIGOS_ACCION_AUDITORIA, etiquetaAccion, etiquetaEntidad } from './etiquetas-auditoria';

describe('etiquetas de auditoría', () => {
  it('etiquetaAccionConocidaYRespaldo', () => {
    expect(etiquetaAccion('REGISTRAR_RELEVO')).toBe('Registró un relevo');
    expect(etiquetaAccion('CAMBIAR_ROL_INTEGRANTE')).toBe('Cambió el rol de un integrante');
    expect(etiquetaAccion('ACCESO_GRUPO')).toBe('Intento de acceso al grupo');
    expect(etiquetaAccion('EJECUTAR_DETECCION_ATRASOS')).toBe('Ejecutó la detección de atrasos');
    expect(etiquetaAccion('CONSULTAR_AUDITORIA')).toBe('Consultó la auditoría');
    expect(etiquetaAccion('CREAR_CUENTA')).toBe('Creó una cuenta');
    expect(etiquetaAccion('CAMBIAR_ESTADO_TAREA')).toBe('Cambió el estado de una tarea');
    // Respaldo: código desconocido → frase legible, sin guiones bajos.
    expect(etiquetaAccion('ALGO_NUEVO')).toBe('Algo nuevo');
    expect(etiquetaAccion('')).toBe('');
    // Ninguna acción conocida cae al respaldo con guiones bajos.
    for (const codigo of CODIGOS_ACCION_AUDITORIA) {
      expect(etiquetaAccion(codigo), codigo).not.toContain('_');
    }
  });

  it('etiquetaEntidadConocidaYRespaldo', () => {
    expect(etiquetaEntidad('TRASPASO_FAMILIAR')).toBe('Relevo');
    expect(etiquetaEntidad('PROPUESTA_SUCESION')).toBe('Propuesta de sucesión');
    expect(etiquetaEntidad('EJECUCION_PROCESO')).toBe('Proceso automático');
    expect(etiquetaEntidad('OTRA_TABLA')).toBe('Otra tabla');
    for (const tipo of TIPOS_ENTIDAD_AUDITORIA) {
      expect(etiquetaEntidad(tipo), tipo).not.toContain('_');
    }
  });
});
