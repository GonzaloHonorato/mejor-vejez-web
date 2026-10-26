import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  RespuestaPanelAlertas,
  RespuestaPanelCitas,
  RespuestaPanelHorarios,
  RespuestaPanelPreventivas,
  RespuestaPanelTareas,
} from './modelos-panel';
import { ServicioPanel } from './servicio-panel';

function panelTareas(): RespuestaPanelTareas {
  return {
    fecha: '2026-11-02',
    pendientes: 0,
    enCurso: 0,
    completadas: 0,
    noRealizadas: 0,
    canceladas: 0,
    atrasadas: 0,
    tareasAtrasadas: [],
  };
}

function panelAlertas(): RespuestaPanelAlertas {
  return { abiertas: 0, cerradasUltimos7Dias: 0, recientes: [] };
}

function panelHorarios(): RespuestaPanelHorarios {
  return { tareas: [] };
}

function panelCitas(): RespuestaPanelCitas {
  return { citas: [] };
}

function panelPreventivas(): RespuestaPanelPreventivas {
  return { alertas: [] };
}

describe('ServicioPanel', () => {
  let servicio: ServicioPanel;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioPanel);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('tareasSinIdAdultoNoEnviaElParametro', () => {
    servicio.tareas(1).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/tareas'),
    );
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    peticion.flush(panelTareas());
  });

  it('tareasConIdAdultoIndefinidoNoEnviaElParametro', () => {
    servicio.tareas(1, undefined).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/tareas'),
    );
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    peticion.flush(panelTareas());
  });

  it('tareasConIdAdultoNuloNoEnviaElParametro', () => {
    servicio.tareas(1, null).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/tareas'),
    );
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    peticion.flush(panelTareas());
  });

  it('tareasConIdAdultoEnviaElParametro', () => {
    servicio.tareas(1, 5).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/tareas'),
    );
    expect(peticion.request.params.get('idAdulto')).toBe('5');
    peticion.flush(panelTareas());
  });

  it('alertasConsultaElEndpointDeAlertasDelPanel', () => {
    servicio.alertas(1, 5).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/alertas'),
    );
    expect(peticion.request.params.get('idAdulto')).toBe('5');
    peticion.flush(panelAlertas());
  });

  it('proximosHorariosConsultaElEndpointDeProximosHorarios', () => {
    servicio.proximosHorarios(1).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/proximos-horarios'),
    );
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    peticion.flush(panelHorarios());
  });

  it('citasConsultaElEndpointDeCitasDelPanel', () => {
    servicio.citas(1, 3).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/citas'),
    );
    expect(peticion.request.params.get('idAdulto')).toBe('3');
    peticion.flush(panelCitas());
  });

  it('alertasPreventivasConsultaElEndpointDeAlertasPreventivas', () => {
    servicio.alertasPreventivas(1).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/panel/alertas-preventivas'),
    );
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    peticion.flush(panelPreventivas());
  });
});
