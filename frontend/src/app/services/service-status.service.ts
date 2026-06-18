import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CheckResult } from '../models/check-result.model';

@Injectable({
  providedIn: 'root'
})
export class ServiceStatusService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/v1/services/status';

  getStatuses(): Observable<CheckResult[]> {
    return this.http.get<CheckResult[]>(this.endpoint);
  }
}
