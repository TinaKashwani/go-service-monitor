import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppComponent } from './app.component';
import { CheckResult } from './models/check-result.model';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let httpTestingController: HttpTestingController;
  let datePipe: DatePipe;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    datePipe = new DatePipe('en-US');
    fixture = TestBed.createComponent(AppComponent);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('creates the application shell', () => {
    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush([]);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the dashboard heading', () => {
    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush([]);

    expect(getTextContent()).toContain('Live service health at a glance.');
  });

  it('shows a loading state before the API responds', () => {
    fixture.detectChanges();

    expect(getByTestId('loading-state')).not.toBeNull();
    expect(getTextContent()).toContain('Fetching the latest monitoring results');

    httpTestingController.expectOne('/api/v1/services/status').flush([]);
  });

  it('shows an empty state when the backend returns no services', () => {
    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush([]);
    fixture.detectChanges();

    expect(getByTestId('empty-state')).not.toBeNull();
    expect(getTextContent()).toContain('No services configured');
  });

  it('renders healthy and unhealthy services with their metrics', () => {
    const checkedAt = '2026-01-15T12:30:00Z';
    const results: CheckResult[] = [
      {
        url: 'https://healthy.example.com',
        status: 'up',
        status_code: 200,
        response_time: 152000000,
        response_time_ms: 152,
        checked_at: checkedAt
      },
      {
        url: 'https://offline.example.com',
        status: 'down',
        status_code: 503,
        response_time: 0,
        response_time_ms: 0,
        checked_at: checkedAt,
        error: 'service unavailable'
      }
    ];

    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush(results);
    fixture.detectChanges();

    const resultCards = getAllByTestId('result-card');
    const expectedTimestamp = datePipe.transform(checkedAt, 'medium');

    expect(getByTestId('results-grid')).not.toBeNull();
    expect(resultCards.length).toBe(2);
    expect(getTextContent()).toContain('https://healthy.example.com');
    expect(getTextContent()).toContain('https://offline.example.com');
    expect(getTextContent()).toContain('Up');
    expect(getTextContent()).toContain('Down');
    expect(getTextContent()).toContain('200');
    expect(getTextContent()).toContain('503');
    expect(getTextContent()).toContain('152 ms');
    expect(getTextContent()).toContain('service unavailable');
    expect(getTextContent()).toContain(expectedTimestamp ?? '');
    expect(resultCards[1].classList).toContain('result-card--down');
  });

  it('shows an API error state when the request fails', () => {
    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush(
      { message: 'server error' },
      { status: 500, statusText: 'Server Error' }
    );
    fixture.detectChanges();

    expect(getByTestId('error-state')).not.toBeNull();
    expect(getTextContent()).toContain('Unable to load service data');
    expect(getTextContent()).toContain('The backend returned HTTP 500.');
  });

  it('shows a network error message when the backend cannot be reached', () => {
    fixture.detectChanges();

    const request = httpTestingController.expectOne('/api/v1/services/status');
    request.error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(getTextContent()).toContain('The frontend could not reach the backend API.');
  });

  it('refreshes the dashboard when the refresh button is clicked', () => {
    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush([
      {
        url: 'https://initial.example.com',
        status: 'up',
        status_code: 200,
        response_time: 21000000,
        response_time_ms: 21,
        checked_at: '2026-01-15T12:30:00Z'
      }
    ] satisfies CheckResult[]);
    fixture.detectChanges();

    getRefreshButton().click();
    fixture.detectChanges();

    expect(getByTestId('loading-state')).not.toBeNull();

    httpTestingController.expectOne('/api/v1/services/status').flush([
      {
        url: 'https://updated.example.com',
        status: 'down',
        status_code: 503,
        response_time: 87000000,
        response_time_ms: 87,
        checked_at: '2026-01-15T12:35:00Z',
        error: 'timeout'
      }
    ] satisfies CheckResult[]);
    fixture.detectChanges();

    expect(getTextContent()).toContain('https://updated.example.com');
    expect(getTextContent()).not.toContain('https://initial.example.com');
    expect(getTextContent()).toContain('87 ms');
    expect(getTextContent()).toContain('timeout');
  });

  function getRefreshButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="refresh-button"]');
  }

  function getByTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function getAllByTestId(testId: string): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`)
    );
  }

  function getTextContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }
});
