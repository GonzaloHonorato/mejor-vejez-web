import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { ApiHealth, HealthService } from '../../core/health/health.service';

type Estado = 'revisando' | 'ok' | 'degradado' | 'caido';

const REVISAR_CADA_MS = 30_000;

@Component({
  selector: 'app-en-construccion',
  imports: [DatePipe],
  templateUrl: './en-construccion.html',
  styleUrl: './en-construccion.scss',
})
export class EnConstruccion implements OnInit {
  private readonly healthService = inject(HealthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly health = signal<ApiHealth | null>(null);
  protected readonly apiAlcanzable = signal<boolean | null>(null);
  protected readonly revisando = signal(false);
  protected readonly ultimaRevision = signal<Date | null>(null);

  protected readonly estado = computed<Estado>(() => {
    const alcanzable = this.apiAlcanzable();
    if (alcanzable === null) return 'revisando';
    if (!alcanzable) return 'caido';
    return this.health()?.status === 'UP' ? 'ok' : 'degradado';
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
    this.healthService.check().subscribe({
      next: (health) => {
        this.health.set(health);
        this.apiAlcanzable.set(true);
        this.terminar();
      },
      error: () => {
        this.health.set(null);
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
