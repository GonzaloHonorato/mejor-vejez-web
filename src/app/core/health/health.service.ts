import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { runtimeConfig } from '../config/runtime-config';

export type ComponentStatus = 'UP' | 'DOWN';

export interface ApiHealth {
  status: 'UP' | 'DEGRADED';
  service: string;
  version: string;
  timestamp: string;
  database: { status: ComponentStatus; latencyMs: number | null };
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  check(): Observable<ApiHealth> {
    return this.http.get<ApiHealth>(`${runtimeConfig.apiUrl}/api/health`);
  }
}
