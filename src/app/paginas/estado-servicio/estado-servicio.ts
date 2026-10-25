import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SaludApi, ServicioSalud } from '../../nucleo/salud/servicio-salud';

type Estado = 'revisando' | 'ok' | 'degradado' | 'caido';

const REVISAR_CADA_MS = 30_000;

@Component({
  selector: 'app-estado-servicio',
  imports: [DatePipe, RouterLink],
  templateUrl: './estado-servicio.html',
  styleUrl: './estado-servicio.scss',
})
export class EstadoServicio implements OnInit {
  private readonly servicioSalud = inject(ServicioSalud);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly salud = signal<SaludApi | null>(null);
  protected readonly apiAlcanzable = signal<boolean | null>(null);
  protected readonly revisando = signal(false);
  protected readonly ultimaRevision = signal<Date | null>(null);

  protected readonly estado = computed<Estado>(() => {
    const alcanzable = this.apiAlcanzable();
    if (alcanzable === null) return 'revisando';
    if (!alcanzable) return 'caido';
    return this.salud()?.estado === 'DISPONIBLE' ? 'ok' : 'degradado';
  });

  protected readonly resumen = computed(() => {
    switch (this.estado()) {
      case 'revisando':
        return 'Revisando el estado del servicio…';
      case 'ok':
        return 'Todos los servicios funcionan correctamente.';
      case 'degradado':
        return 'La API responde, pero la base de datos no está disponible.';
      case 'caido':
        return 'No pudimos conectar con la API.';
    }
  });

  ngOnInit(): void {
    this.revisar();
    const id = setInterval(() => this.revisar(), REVISAR_CADA_MS);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }

  protected revisar(): void {
    if (this.revisando()) return;
    this.revisando.set(true);
    this.servicioSalud.consultar().subscribe({
      next: (salud) => {
        this.salud.set(salud);
        this.apiAlcanzable.set(true);
        this.terminar();
      },
      error: () => {
        this.salud.set(null);
        this.apiAlcanzable.set(false);
        this.terminar();
      },
    });
  }

  private terminar(): void {
    this.revisando.set(false);
    this.ultimaRevision.set(new Date());
  }
}
