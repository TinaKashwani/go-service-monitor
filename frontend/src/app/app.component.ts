import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { CheckResult } from './models/check-result.model';
import { ServiceStatusService } from './services/service-status.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <main class="shell">
      <p class="sr-only" aria-live="polite" aria-atomic="true" data-testid="live-status">
        {{ announcement() }}
      </p>

      <section class="hero" aria-labelledby="dashboard-title">
        <div>
          <p class="eyebrow">Service Monitor</p>
          <h1 id="dashboard-title">Live service health at a glance.</h1>
          <p class="intro">The dashboard reads directly from the Go backend and keeps the current service state easy to scan.</p>
          <p *ngIf="lastRefreshed()" class="last-refreshed" data-testid="last-refreshed">
            Last refreshed: <time [attr.datetime]="lastRefreshed()">{{ lastRefreshed() | date:'medium' }}</time>
          </p>
        </div>

        <button
          type="button"
          class="refresh-button"
          data-testid="refresh-button"
          aria-label="Refresh service statuses"
          [disabled]="requestActive()"
          (click)="refresh()"
        >
          {{ requestActive() ? 'Refreshing…' : 'Refresh' }}
        </button>
      </section>

      <section class="summary-panel" aria-label="Service status summary">
        <div class="summary-item"><span class="summary-label">Services checked</span><strong data-testid="services-count">{{ statuses().length }}</strong></div>
        <div class="summary-item"><span class="summary-label">Healthy</span><strong data-testid="healthy-count">{{ healthyCount() }}</strong></div>
        <div class="summary-item"><span class="summary-label">Unhealthy</span><strong data-testid="unhealthy-count">{{ unhealthyCount() }}</strong></div>
      </section>

      <section *ngIf="initialLoading()" class="state-card state-card--loading" data-testid="loading-state">
        <h2>Checking services</h2>
        <p>Fetching the latest monitoring results from the backend API.</p>
      </section>

      <section *ngIf="refreshing()" class="refresh-notice" data-testid="refreshing-state" aria-hidden="true">
        Updating service statuses…
      </section>

      <section *ngIf="errorMessage() && statuses().length === 0" class="state-card state-card--error" data-testid="error-state">
        <h2>Unable to load service data</h2>
        <p>{{ errorMessage() }}</p>
        <button type="button" class="retry-button" [disabled]="requestActive()" (click)="refresh()">Try again</button>
      </section>

      <section *ngIf="errorMessage() && statuses().length > 0" class="refresh-error" data-testid="refresh-error" role="alert">
        <div><strong>Refresh failed.</strong> {{ errorMessage() }} The previous results are still shown.</div>
        <button type="button" class="retry-button" [disabled]="requestActive()" (click)="refresh()">Try again</button>
      </section>

      <section *ngIf="!requestActive() && !errorMessage() && statuses().length === 0" class="state-card" data-testid="empty-state">
        <h2>No services configured</h2>
        <p>The backend returned an empty result set.</p>
      </section>

      <section *ngIf="statuses().length > 0" class="results-grid" data-testid="results-grid" aria-label="Service check results">
        <article *ngFor="let service of statuses(); trackBy: trackByUrl" class="result-card" [class.result-card--down]="service.status !== 'up'" data-testid="result-card">
          <header class="result-header">
            <div>
              <p class="result-label">{{ service.name ? 'Service' : 'Service URL' }}</p>
              <h2>{{ service.name || service.url }}</h2>
              <p *ngIf="service.name" class="service-url">{{ service.url }}</p>
            </div>
            <span class="status-chip" [class.status-chip--up]="service.status === 'up'" [class.status-chip--down]="service.status !== 'up'">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="sr-only">Status: </span>{{ service.status === 'up' ? 'Up' : 'Down' }}
            </span>
          </header>

          <dl class="result-metrics">
            <div><dt>Status code</dt><dd>{{ metric(service.status_code) }}</dd></div>
            <div><dt>Response time</dt><dd>{{ responseTime(service.response_time_ms) }}</dd></div>
            <div><dt>Checked at</dt><dd>{{ service.checked_at ? (service.checked_at | date:'medium') : 'N/A' }}</dd></div>
          </dl>
          <p *ngIf="service.error" class="error-text">{{ service.error }}</p>
        </article>
      </section>
    </main>
  `,
  styles: [`
    .shell { width: min(1100px, calc(100% - 2rem)); margin: 0 auto; padding: 2rem 0 3rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .hero { display: flex; justify-content: space-between; gap: 1.5rem; align-items: end; margin-bottom: 1.5rem; }
    .eyebrow { margin: 0 0 .5rem; text-transform: uppercase; letter-spacing: .16em; font-size: .76rem; color: var(--accent-strong); font-weight: 700; }
    h1 { margin: 0; font-size: clamp(2.4rem, 6vw, 4.8rem); line-height: .92; letter-spacing: -.04em; max-width: 10ch; }
    .intro { max-width: 46rem; font-size: 1.04rem; line-height: 1.6; color: var(--text-muted); margin: 1rem 0 0; }
    .last-refreshed, .service-url { color: var(--text-muted); margin: .65rem 0 0; overflow-wrap: anywhere; }
    .refresh-button, .retry-button { border: 0; border-radius: 999px; padding: .9rem 1.4rem; background: var(--accent); color: white; font-weight: 700; cursor: pointer; }
    .refresh-button { box-shadow: 0 18px 34px rgba(15,118,110,.22); transition: transform 160ms ease, box-shadow 160ms ease; }
    .refresh-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 22px 38px rgba(15,118,110,.28); }
    button:focus-visible { outline: 3px solid #f59e0b; outline-offset: 3px; }
    button:disabled { cursor: wait; opacity: .62; box-shadow: none; }
    .summary-panel { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .summary-item, .state-card, .result-card { background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 24px; box-shadow: var(--panel-shadow); backdrop-filter: blur(12px); }
    .summary-item { padding: 1.1rem 1.2rem; }
    .summary-label, .result-label, dt { display: block; font-size: .84rem; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin-bottom: .45rem; }
    .summary-item strong { font-size: 1.6rem; }
    .state-card { padding: 1.5rem; margin-top: 1rem; }
    .state-card h2, .result-header h2 { margin: 0; font-size: 1.15rem; overflow-wrap: anywhere; }
    .state-card p { margin: .6rem 0 0; color: var(--text-muted); }
    .state-card .retry-button { margin-top: 1rem; }
    .state-card--loading { border-color: rgba(15,118,110,.28); }
    .state-card--error, .refresh-error { border-color: rgba(180,35,24,.35); background: #fff4f2; }
    .refresh-notice { margin: -.5rem 0 1rem; color: var(--accent-strong); font-weight: 700; }
    .refresh-error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.2rem; border: 1px solid; border-radius: 18px; margin-bottom: 1rem; color: var(--danger); }
    .results-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(280px,100%),1fr)); gap: 1rem; margin-top: 1rem; }
    .result-card { padding: 1.3rem; min-width: 0; }
    .result-card--down { background: linear-gradient(180deg,rgba(255,252,247,.9),rgba(254,243,242,.95)); }
    .result-header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; margin-bottom: 1rem; }
    .result-header > div { min-width: 0; }
    .status-chip { display: inline-flex; align-items: center; gap: .4rem; border-radius: 999px; padding: .45rem .8rem; font-size: .82rem; font-weight: 700; white-space: nowrap; }
    .status-dot { width: .55rem; height: .55rem; border-radius: 50%; background: currentColor; }
    .status-chip--up { color: var(--success); background: var(--success-soft); }
    .status-chip--down { color: var(--danger); background: var(--danger-soft); }
    .result-metrics { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: .9rem; margin: 0; }
    .result-metrics div { min-width: 0; }
    dt { margin-bottom: .35rem; }
    dd { margin: 0; font-size: 1rem; font-weight: 700; overflow-wrap: anywhere; }
    .error-text { margin: 1rem 0 0; padding: .85rem 1rem; border-radius: 16px; color: var(--danger); background: var(--danger-soft); font-size: .94rem; overflow-wrap: anywhere; }
    @media (max-width: 720px) {
      .shell { width: min(100% - 1rem,1100px); padding-top: 1.2rem; }
      .hero, .refresh-error { flex-direction: column; align-items: stretch; }
      .refresh-button, .retry-button { width: 100%; }
      .summary-panel, .result-metrics { grid-template-columns: 1fr; }
      .result-header { flex-wrap: wrap; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly serviceStatusService = inject(ServiceStatusService);

  readonly statuses = signal<CheckResult[]>([]);
  readonly requestActive = signal(false);
  readonly hasLoaded = signal(false);
  readonly errorMessage = signal('');
  readonly announcement = signal('');
  readonly initialLoading = computed(() => this.requestActive() && !this.hasLoaded());
  readonly refreshing = computed(() => this.requestActive() && this.hasLoaded());
  readonly lastRefreshed = computed(() => {
    const timestamps = this.statuses()
      .map((service) => Date.parse(service.checked_at ?? ''))
      .filter((timestamp) => !Number.isNaN(timestamp));
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : '';
  });

  constructor() { this.loadStatuses(); }

  healthyCount(): number { return this.statuses().filter((service) => service.status === 'up').length; }
  unhealthyCount(): number { return this.statuses().filter((service) => service.status !== 'up').length; }
  refresh(): void { this.loadStatuses(); }
  trackByUrl(index: number, service: CheckResult): string { return `${index}-${service.url}`; }
  metric(value: number | null | undefined): number | string { return value === null || value === undefined ? 'N/A' : value; }
  responseTime(value: number | null | undefined): string { return value === null || value === undefined ? 'N/A' : `${value} ms`; }

  private loadStatuses(): void {
    if (this.requestActive()) return;

    const isRefresh = this.hasLoaded();
    this.requestActive.set(true);
    this.errorMessage.set('');
    this.announcement.set(isRefresh ? 'Refreshing service statuses.' : 'Loading service statuses.');

    this.serviceStatusService.getStatuses().pipe(
      finalize(() => {
        this.requestActive.set(false);
        this.hasLoaded.set(true);
      })
    ).subscribe({
      next: (statuses) => {
        this.statuses.set(statuses);
        this.announcement.set(statuses.length ? `Service statuses refreshed. ${statuses.length} services checked.` : 'Service statuses refreshed. No services are configured.');
      },
      error: (error: unknown) => {
        const message = this.getErrorMessage(error);
        this.errorMessage.set(message);
        this.announcement.set(isRefresh && this.statuses().length ? `Refresh failed. Previous results remain available. ${message}` : `Unable to load service data. ${message}`);
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0 ? 'The frontend could not reach the backend API.' : `The backend returned HTTP ${error.status}.`;
    }
    return 'An unexpected error occurred while loading service data.';
  }
}
