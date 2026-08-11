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
        name: 'Healthy API',
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
    expect(getTextContent()).toContain('Healthy API');
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

    expect(getByTestId('refreshing-state')).not.toBeNull();
    expect(getRefreshButton().disabled).toBeTrue();
    const refreshRequest = httpTestingController.expectOne('/api/v1/services/status');
    getRefreshButton().click();
    httpTestingController.expectNone('/api/v1/services/status');

    refreshRequest.flush([
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
    expect(getRefreshButton().disabled).toBeFalse();
  });

  it('keeps existing results and offers retry when a refresh fails', () => {
    fixture.detectChanges();
    httpTestingController.expectOne('/api/v1/services/status').flush([{
      url: 'https://retained.example.com', status: 'up', status_code: 200,
      response_time: 1, response_time_ms: 1, checked_at: '2026-01-15T12:30:00Z'
    }] satisfies CheckResult[]);
    fixture.detectChanges();

    getRefreshButton().click();
    httpTestingController.expectOne('/api/v1/services/status').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(getByTestId('refresh-error')).not.toBeNull();
    expect(getTextContent()).toContain('https://retained.example.com');
    expect(getTextContent()).toContain('previous results are still shown');
  });

  it('renders missing metrics as N/A and exposes accessible controls and status', () => {
    fixture.detectChanges();
    httpTestingController.expectOne('/api/v1/services/status').flush([{
      url: 'https://missing.example.com', status: 'down'
    }] satisfies CheckResult[]);
    fixture.detectChanges();

    expect(getTextContent().match(/N\/A/g)?.length).toBe(3);
    expect(getRefreshButton().getAttribute('aria-label')).toBe('Refresh service statuses');
    expect(getByTestId('live-status')?.getAttribute('aria-live')).toBe('polite');
    expect(getTextContent()).toContain('Status: Down');
  });

  it('uses the newest check time and updates it with refreshed summary data', () => {
    fixture.detectChanges();
    httpTestingController.expectOne('/api/v1/services/status').flush([
      { url: 'https://older.example.com', status: 'up', checked_at: '2026-01-15T12:20:00Z' },
      { url: 'https://newer.example.com', status: 'down', checked_at: '2026-01-15T12:30:00Z' }
    ] satisfies CheckResult[]);
    fixture.detectChanges();

    expect(getByTestId('last-refreshed')?.textContent).toContain(datePipe.transform('2026-01-15T12:30:00Z', 'medium') ?? '');
    expect(getByTestId('services-count')?.textContent).toContain('2');

    getRefreshButton().click();
    httpTestingController.expectOne('/api/v1/services/status').flush([
      { url: 'https://latest.example.com', status: 'up', checked_at: '2026-01-15T12:45:00Z' }
    ] satisfies CheckResult[]);
    fixture.detectChanges();

    expect(getByTestId('last-refreshed')?.textContent).toContain(datePipe.transform('2026-01-15T12:45:00Z', 'medium') ?? '');
    expect(getByTestId('services-count')?.textContent).toContain('1');
    expect(getByTestId('healthy-count')?.textContent).toContain('1');
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
