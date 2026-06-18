import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { CheckResult } from './models/check-result.model';
import { ServiceStatusService } from './services/service-status.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Service Monitor</p>
          <h1>Live service health at a glance.</h1>
          <p class="intro">
            The dashboard reads directly from the Go backend and keeps the
            current service state easy to scan.
          </p>
        </div>

        <button type="button" class="refresh-button" (click)="refresh()">
          Refresh
        </button>
      </section>

      <section class="summary-panel">
        <div class="summary-item">
          <span class="summary-label">Services checked</span>
          <strong>{{ statuses().length }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Healthy</span>
          <strong>{{ healthyCount() }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Unhealthy</span>
          <strong>{{ unhealthyCount() }}</strong>
        </div>
      </section>

      <section *ngIf="loading()" class="state-card state-card--loading">
        <h2>Checking services</h2>
        <p>Fetching the latest monitoring results from the backend API.</p>
      </section>

      <section *ngIf="!loading() && errorMessage()" class="state-card state-card--error">
        <h2>Unable to load service data</h2>
        <p>{{ errorMessage() }}</p>
      </section>

      <section *ngIf="!loading() && !errorMessage() && statuses().length === 0" class="state-card">
        <h2>No services configured</h2>
        <p>The backend returned an empty result set.</p>
      </section>

      <section *ngIf="!loading() && !errorMessage() && statuses().length > 0" class="results-grid">
        <article
          *ngFor="let service of statuses(); trackBy: trackByUrl"
          class="result-card"
          [class.result-card--down]="service.status !== 'up'"
        >
          <header class="result-header">
            <div>
              <p class="result-label">Service URL</p>
              <h2>{{ service.url }}</h2>
            </div>

            <span
              class="status-chip"
              [class.status-chip--up]="service.status === 'up'"
              [class.status-chip--down]="service.status !== 'up'"
            >
              {{ service.status === 'up' ? 'Up' : 'Down' }}
            </span>
          </header>

          <dl class="result-metrics">
            <div>
              <dt>Status code</dt>
              <dd>{{ service.status_code || 'N/A' }}</dd>
            </div>
            <div>
              <dt>Response time</dt>
              <dd>{{ service.response_time_ms }} ms</dd>
            </div>
            <div>
              <dt>Checked at</dt>
              <dd>{{ service.checked_at | date:'medium' }}</dd>
            </div>
          </dl>

          <p *ngIf="service.error" class="error-text">{{ service.error }}</p>
        </article>
      </section>
    </main>
  `,
  styles: [`
    .shell {
      width: min(1100px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2rem 0 3rem;
    }

    .hero {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      align-items: end;
      margin-bottom: 1.5rem;
    }

    .eyebrow {
      margin: 0 0 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.76rem;
      color: var(--accent-strong);
      font-weight: 700;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.4rem, 6vw, 4.8rem);
      line-height: 0.92;
      letter-spacing: -0.04em;
      max-width: 10ch;
    }

    .intro {
      max-width: 46rem;
      font-size: 1.04rem;
      line-height: 1.6;
      color: var(--text-muted);
      margin: 1rem 0 0;
    }

    .refresh-button {
      border: 0;
      border-radius: 999px;
      padding: 0.9rem 1.4rem;
      background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      color: white;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 18px 34px rgba(15, 118, 110, 0.22);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .refresh-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 22px 38px rgba(15, 118, 110, 0.28);
    }

    .summary-panel {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .summary-item,
    .state-card,
    .result-card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      box-shadow: var(--panel-shadow);
      backdrop-filter: blur(12px);
    }

    .summary-item {
      padding: 1.1rem 1.2rem;
    }

    .summary-label,
    .result-label,
    dt {
      display: block;
      font-size: 0.84rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.45rem;
    }

    .summary-item strong {
      font-size: 1.6rem;
    }

    .state-card {
      padding: 1.5rem;
      margin-top: 1rem;
    }

    .state-card h2,
    .result-header h2 {
      margin: 0;
      font-size: 1.15rem;
      overflow-wrap: anywhere;
    }

    .state-card p {
      margin: 0.6rem 0 0;
      color: var(--text-muted);
    }

    .state-card--loading {
      border-color: rgba(15, 118, 110, 0.18);
    }

    .state-card--error {
      border-color: rgba(180, 35, 24, 0.24);
      background: rgba(254, 243, 242, 0.92);
    }

    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .result-card {
      padding: 1.3rem;
    }

    .result-card--down {
      background: linear-gradient(180deg, rgba(255, 252, 247, 0.9), rgba(254, 243, 242, 0.95));
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      margin-bottom: 1rem;
    }

    .status-chip {
      border-radius: 999px;
      padding: 0.45rem 0.8rem;
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-chip--up {
      color: var(--success);
      background: var(--success-soft);
    }

    .status-chip--down {
      color: var(--danger);
      background: var(--danger-soft);
    }

    .result-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
      margin: 0;
    }

    .result-metrics div {
      min-width: 0;
    }

    dt {
      margin-bottom: 0.35rem;
    }

    dd {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .error-text {
      margin: 1rem 0 0;
      padding: 0.85rem 1rem;
      border-radius: 16px;
      color: var(--danger);
      background: var(--danger-soft);
      font-size: 0.94rem;
      overflow-wrap: anywhere;
    }

    @media (max-width: 720px) {
      .shell {
        width: min(100% - 1rem, 1100px);
        padding-top: 1.2rem;
      }

      .hero {
        flex-direction: column;
        align-items: stretch;
      }

      .refresh-button {
        width: 100%;
      }

      .summary-panel,
      .result-metrics {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly serviceStatusService = inject(ServiceStatusService);

  readonly statuses = signal<CheckResult[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  constructor() {
    this.loadStatuses();
  }

  healthyCount(): number {
    return this.statuses().filter((service) => service.status === 'up').length;
  }

  unhealthyCount(): number {
    return this.statuses().filter((service) => service.status !== 'up').length;
  }

  refresh(): void {
    this.loadStatuses();
  }

  trackByUrl(index: number, service: CheckResult): string {
    return `${index}-${service.url}`;
  }

  private loadStatuses(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.serviceStatusService.getStatuses().subscribe({
      next: (statuses) => {
        this.statuses.set(statuses);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.statuses.set([]);
        this.errorMessage.set(this.getErrorMessage(error));
        this.loading.set(false);
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'The frontend could not reach the backend API.';
      }

      return `The backend returned HTTP ${error.status}.`;
    }

    return 'An unexpected error occurred while loading service data.';
  }
}
