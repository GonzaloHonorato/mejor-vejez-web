import { Routes } from '@angular/router';

import { tituloDocumento } from './compartido/marca';
import { guardAdministrador } from './nucleo/autenticacion/guard-administrador';
import { guardAutenticado } from './nucleo/autenticacion/guard-autenticado';

export const routes: Routes = [
  {
    path: 'ingreso',
    title: tituloDocumento('Iniciar sesión'),
    loadComponent: () => import('./paginas/ingreso/ingreso').then((m) => m.Ingreso),
  },
  {
    path: 'estado',
    title: tituloDocumento('Estado del servicio'),
    loadComponent: () =>
      import('./paginas/estado-servicio/estado-servicio').then((m) => m.EstadoServicio),
  },
  {
    path: 'restablecer-clave',
    title: tituloDocumento('Restablecer contraseña'),
    loadComponent: () =>
      import('./paginas/restablecer-clave/restablecer-clave').then((m) => m.RestablecerClave),
  },
  {
    path: '',
    canActivate: [guardAutenticado],
    loadComponent: () => import('./compartido/marco-app/marco-app').then((m) => m.MarcoApp),
    children: [
      {
        path: '',
        title: tituloDocumento('Panel familiar'),
        data: { tituloPagina: 'Panel familiar' },
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'perfil',
        title: tituloDocumento('Mi perfil'),
        data: { tituloPagina: 'Mi perfil' },
        loadComponent: () => import('./paginas/mi-perfil/mi-perfil').then((m) => m.MiPerfil),
      },
      {
        path: 'grupos',
        title: tituloDocumento('Grupos'),
        data: { tituloPagina: 'Grupos' },
        loadComponent: () => import('./paginas/grupos/grupos').then((m) => m.Grupos),
      },
      {
        path: 'grupos/:idGrupo',
        title: tituloDocumento('Integrantes'),
        data: { tituloPagina: 'Integrantes' },
        loadComponent: () => import('./paginas/integrantes/integrantes').then((m) => m.Integrantes),
      },
      {
        path: 'grupos/:idGrupo/auditoria',
        title: tituloDocumento('Auditoría'),
        data: { tituloPagina: 'Auditoría', modo: 'grupo' },
        loadComponent: () => import('./paginas/auditoria/auditoria').then((m) => m.Auditoria),
      },
      {
        path: 'tareas',
        title: tituloDocumento('Tareas'),
        data: { tituloPagina: 'Tareas' },
        loadComponent: () => import('./paginas/tareas/tareas').then((m) => m.Tareas),
      },
      {
        // IMPORTANTE: 'tareas/nueva' debe quedar ANTES de 'tareas/:idTarea':
        // si no, el router la confundiría con un idTarea literal "nueva".
        path: 'tareas/nueva',
        title: tituloDocumento('Nueva tarea'),
        data: { tituloPagina: 'Nueva tarea' },
        loadComponent: () => import('./paginas/nueva-tarea/nueva-tarea').then((m) => m.NuevaTarea),
      },
      {
        path: 'tareas/:idTarea',
        title: tituloDocumento('Tarea'),
        data: { tituloPagina: 'Tarea' },
        loadComponent: () => import('./paginas/tarea/tarea').then((m) => m.Tarea),
      },
      {
        path: 'alertas',
        title: tituloDocumento('Alertas'),
        data: { tituloPagina: 'Alertas' },
        loadComponent: () => import('./paginas/alertas/alertas').then((m) => m.Alertas),
      },
      {
        path: 'alertas/:idAlerta',
        title: tituloDocumento('Alerta'),
        data: { tituloPagina: 'Alerta' },
        loadComponent: () => import('./paginas/alerta/alerta').then((m) => m.Alerta),
      },
      {
        path: 'planes',
        title: tituloDocumento('Medicamentos'),
        data: { tituloPagina: 'Medicamentos' },
        loadComponent: () => import('./paginas/planes/planes').then((m) => m.Planes),
      },
      {
        path: 'planes/:idPlan',
        title: tituloDocumento('Plan de medicamentos'),
        data: { tituloPagina: 'Plan de medicamentos' },
        loadComponent: () => import('./paginas/plan/plan').then((m) => m.Plan),
      },
      {
        path: 'adultos',
        title: tituloDocumento('Adultos mayores'),
        data: { tituloPagina: 'Adultos mayores' },
        loadComponent: () => import('./paginas/adultos/adultos').then((m) => m.Adultos),
      },
      {
        path: 'adultos/:idAdulto',
        title: tituloDocumento('Ficha del adulto mayor'),
        data: { tituloPagina: 'Adulto mayor' },
        loadComponent: () =>
          import('./paginas/ficha-adulto/ficha-adulto').then((m) => m.FichaAdulto),
      },
      {
        path: 'relevos',
        title: tituloDocumento('Relevos'),
        data: { tituloPagina: 'Relevos' },
        loadComponent: () => import('./paginas/relevos/relevos').then((m) => m.Relevos),
      },
      {
        path: 'relevos/:idRelevo',
        title: tituloDocumento('Relevo'),
        data: { tituloPagina: 'Relevo' },
        loadComponent: () => import('./paginas/relevo/relevo').then((m) => m.Relevo),
      },
      {
        path: 'administracion/usuarios',
        title: tituloDocumento('Administración de usuarios'),
        data: { tituloPagina: 'Administración' },
        canActivate: [guardAdministrador],
        loadComponent: () =>
          import('./paginas/administracion-usuarios/administracion-usuarios').then(
            (m) => m.AdministracionUsuarios,
          ),
      },
      {
        path: 'administracion/auditoria',
        title: tituloDocumento('Auditoría'),
        data: { tituloPagina: 'Auditoría', modo: 'global' },
        canActivate: [guardAdministrador],
        loadComponent: () => import('./paginas/auditoria/auditoria').then((m) => m.Auditoria),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
