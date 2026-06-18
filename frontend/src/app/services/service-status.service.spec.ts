import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CheckResult } from '../models/check-result.model';
import { ServiceStatusService } from './service-status.service';

describe('ServiceStatusService', () => {
  let service: ServiceStatusService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(ServiceStatusService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('requests the backend service status endpoint', () => {
    service.getStatuses().subscribe();

    const request = httpTestingController.expectOne('/api/v1/services/status');

    expect(request.request.method).toBe('GET');

    request.flush([]);
  });

  it('returns parsed service status results from the API response', () => {
    const response: CheckResult[] = [
      {
        url: 'https://healthy.example.com',
        status: 'up',
        status_code: 200,
        response_time: 34000000,
        response_time_ms: 34,
        checked_at: '2026-01-15T12:30:00Z'
      },
      {
        url: 'https://offline.example.com',
        status: 'down',
        status_code: 0,
        response_time: 0,
        response_time_ms: 0,
        checked_at: '2026-01-15T12:31:00Z',
        error: 'dial tcp: lookup failed'
      }
    ];

    let receivedResults: CheckResult[] | undefined;

    service.getStatuses().subscribe((results) => {
      receivedResults = results;
    });

    httpTestingController.expectOne('/api/v1/services/status').flush(response);

    expect(receivedResults).toEqual(response);
  });
});
