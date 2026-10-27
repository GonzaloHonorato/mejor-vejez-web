import { Routes } from '@angular/router';

import { guardAdministrador } from './nucleo/autenticacion/guard-administrador';
import { guardAutenticado } from './nucleo/autenticacion/guard-autenticado';

export const routes: Routes = [
  {
    path: 'ingreso',
    title: 'Iniciar sesión · Mejor Vejez',
    loadComponent: () => import('./paginas/ingreso/ingreso').then((m) => m.Ingreso),
  },
  {
    path: 'estado',
    title: 'Estado del servicio · Mejor Vejez',
    loadComponent: () =>
      import('./paginas/estado-servicio/estado-servicio').then((m) => m.EstadoServicio),
  },
  {
    path: '',
    canActivate: [guardAutenticado],
    loadComponent: () => import('./compartido/marco-app/marco-app').then((m) => m.MarcoApp),
    children: [
      {
        path: '',
        title: 'Panel familiar · Mejor Vejez',
        data: { tituloPagina: 'Panel familiar' },
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'perfil',
        title: 'Mi perfil · Mejor Vejez',
        data: { tituloPagina: 'Mi perfil' },
        loadComponent: () => import('./paginas/mi-perfil/mi-perfil').then((m) => m.MiPerfil),
      },
      {
        path: 'grupos',
        title: 'Grupos · Mejor Vejez',
        data: { tituloPagina: 'Grupos' },
        loadComponent: () => import('./paginas/grupos/grupos').then((m) => m.Grupos),
      },
      {
        path: 'grupos/:idGrupo',
        title: 'Integrantes · Mejor Vejez',
        data: { tituloPagina: 'Integrantes' },
        loadComponent: () =>
          import('./paginas/integrantes/integrantes').then((m) => m.Integrantes),
      },
      {
        path: 'grupos/:idGrupo/auditoria',
        title: 'Auditoría · Mejor Vejez',
        data: { tituloPagina: 'Auditoría', modo: 'grupo' },
        loadComponent: () => import('./paginas/auditoria/auditoria').then((m) => m.Auditoria),
      },
      {
        path: 'tareas',
        title: 'Tareas · Mejor Vejez',
        data: { tituloPagina: 'Tareas' },
        loadComponent: () => import('./paginas/tareas/tareas').then((m) => m.Tareas),
      },
      {
        // IMPORTANTE: 'tareas/nueva' debe quedar ANTES de 'tareas/:idTarea'
        // (Tarea 11): si no, el router la confundiría con un idTarea
        // literal "nueva".
        path: 'tareas/nueva',
        title: 'Nueva tarea · Mejor Vejez',
        data: { tituloPagina: 'Nueva tarea' },
        loadComponent: () => import('./paginas/nueva-tarea/nueva-tarea').then((m) => m.NuevaTarea),
      },
      {
        path: 'tareas/:idTarea',
        title: 'Tarea · Mejor Vejez',
        data: { tituloPagina: 'Tarea' },
        loadComponent: () => import('./paginas/tarea/tarea').then((m) => m.Tarea),
      },
      {
        path: 'alertas',
        title: 'Alertas · Mejor Vejez',
        data: { tituloPagina: 'Alertas' },
        loadComponent: () => import('./paginas/alertas/alertas').then((m) => m.Alertas),
      },
      {
        path: 'alertas/:idAlerta',
        title: 'Alerta · Mejor Vejez',
        data: { tituloPagina: 'Alerta' },
        loadComponent: () => import('./paginas/alerta/alerta').then((m) => m.Alerta),
      },
      {
        path: 'planes',
        title: 'Medicamentos · Mejor Vejez',
        data: { tituloPagina: 'Medicamentos' },
        loadComponent: () => import('./paginas/planes/planes').then((m) => m.Planes),
      },
      {
        path: 'planes/:idPlan',
        title: 'Plan de medicamentos · Mejor Vejez',
        data: { tituloPagina: 'Plan de medicamentos' },
        loadComponent: () => import('./paginas/plan/plan').then((m) => m.Plan),
      },
      {
        path: 'adultos',
        title: 'Adultos mayores · Mejor Vejez',
        data: { tituloPagina: 'Adultos mayores' },
        loadComponent: () => import('./paginas/adultos/adultos').then((m) => m.Adultos),
      },
      {
        path: 'adultos/:idAdulto',
        title: 'Ficha del adulto mayor · Mejor Vejez',
        data: { tituloPagina: 'Adulto mayor' },
        loadComponent: () =>
          import('./paginas/ficha-adulto/ficha-adulto').then((m) => m.FichaAdulto),
      },
      {
        path: 'relevos',
        title: 'Relevos · Mejor Vejez',
        data: { tituloPagina: 'Relevos' },
        loadComponent: () => import('./paginas/relevos/relevos').then((m) => m.Relevos),
      },
      {
        path: 'relevos/:idRelevo',
        title: 'Relevo · Mejor Vejez',
        data: { tituloPagina: 'Relevo' },
        loadComponent: () => import('./paginas/relevo/relevo').then((m) => m.Relevo),
      },
      {
        path: 'administracion/usuarios',
        title: 'Administración de usuarios · Mejor Vejez',
        data: { tituloPagina: 'Administración' },
        canActivate: [guardAdministrador],
        loadComponent: () =>
          import('./paginas/administracion-usuarios/administracion-usuarios').then(
            (m) => m.AdministracionUsuarios,
          ),
      },
      {
        path: 'administracion/auditoria',
        title: 'Auditoría · Mejor Vejez',
        data: { tituloPagina: 'Auditoría', modo: 'global' },
        canActivate: [guardAdministrador],
        loadComponent: () => import('./paginas/auditoria/auditoria').then((m) => m.Auditoria),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
