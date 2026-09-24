import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MonitorSummary, OverviewSummary } from '../models/observability.models';
import { MonitorApiService } from '../services/monitor-api.service';
import { ChartComponent } from '../shared/chart.component';
import { StateComponent, StatusComponent, TimeRangeComponent } from '../shared/ui.component';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgFor, NgIf, RouterLink, ChartComponent, StateComponent, StatusComponent, TimeRangeComponent],
  template: `
    <header class="page-heading">
      <div><p class="eyebrow">Fleet health</p><h2>See what needs attention.</h2><p class="lede">Live status and recent performance across every website you monitor.</p></div>
      <div class="heading-actions">
        <app-time-range [value]="range()" (changed)="load($event)" />
        <button class="button" type="button" (click)="load(range())" [disabled]="loading()"><span aria-hidden="true">↻</span>{{ loading() ? 'Refreshing' : 'Refresh' }}</button>
      </div>
    </header>

    <app-state *ngIf="loading() && !data()" kind="loading" title="Loading fleet health" message="Reading the latest persisted checks." />
    <app-state *ngIf="error() && !data()" kind="error" title="Overview unavailable" [message]="error()" action="Retry" (activated)="load(range())" />

    <ng-container *ngIf="data() as overview">
      <div *ngIf="error()" class="notice stale" role="status"><strong>Showing saved data.</strong> The latest refresh failed. Values below were loaded <time *ngIf="lastUpdated() as updated" [attr.datetime]="updated.toISOString()">{{ updated | date:'mediumTime' }}</time>. <button type="button" (click)="load(range())">Try again</button></div>

      <app-state *ngIf="overview.total_monitors === 0" kind="empty" title="Start monitoring your first website" message="Add an HTTP or HTTPS endpoint to begin collecting availability and response-time history." action="Add a monitor" (activated)="goToMonitors()" />

      <ng-container *ngIf="overview.total_monitors > 0">
        <section class="health-banner" [attr.data-state]="fleetState(overview)">
          <div class="health-icon" aria-hidden="true">{{ fleetState(overview) === 'up' ? '✓' : '!' }}</div>
          <div><p class="eyebrow">Current assessment</p><h3>{{ fleetMessage(overview) }}</h3><p>{{ healthDetail(overview) }}</p></div>
          <a *ngIf="overview.active_incidents" routerLink="/incidents">Review active incidents <span aria-hidden="true">→</span></a>
          <a *ngIf="!overview.active_incidents" routerLink="/monitors">Open monitor inventory <span aria-hidden="true">→</span></a>
        </section>

        <section class="kpis" aria-label="Fleet summary">
          <article><div class="metric-label"><span>Fleet uptime</span><i title="Successful checks in the selected range">?</i></div><strong>{{ overview.uptime | number:'1.2-2' }}%</strong><small>Across {{ totalChecks(overview) | number }} checks</small></article>
          <article><div class="metric-label"><span>Average latency</span><i title="Mean elapsed request time">?</i></div><strong>{{ overview.average_latency_ms | number:'1.0-0' }} <em>ms</em></strong><small>Selected {{ rangeLabel() }}</small></article>
          <article><div class="metric-label"><span>Websites up</span></div><strong>{{ upCount(overview) }} <em>/ {{ overview.enabled_monitors }}</em></strong><small>{{ pendingCount(overview) }} awaiting data</small></article>
          <article [class.needs-attention]="overview.active_incidents > 0"><div class="metric-label"><span>Active incidents</span></div><strong>{{ overview.active_incidents }}</strong><small>{{ overview.active_incidents ? 'Needs attention' : 'No open incidents' }}</small></article>
        </section>

        <div class="dashboard-grid">
          <section class="panel attention-panel">
            <header><div><p class="eyebrow">Priority queue</p><h3>Needs attention</h3></div><a routerLink="/monitors">View all</a></header>
            <div *ngIf="attention(overview).length; else allClear" class="attention-list">
              <a *ngFor="let item of attention(overview)" [routerLink]="['/monitors', item.monitor.id]">
                <app-status [status]="item.status || 'pending'" />
                <span><strong>{{ item.monitor.name }}</strong><small>{{ item.monitor.url }}</small></span>
                <span class="measure">{{ item.check_count ? (item.uptime | number:'1.1-1') + '% uptime' : 'No checks yet' }}</span>
                <span aria-hidden="true">›</span>
              </a>
            </div>
            <ng-template #allClear><div class="all-clear"><span aria-hidden="true">✓</span><div><strong>Everything looks healthy</strong><p>No enabled monitor is reporting a failure.</p></div></div></ng-template>
          </section>

          <section class="panel latency-panel">
            <header><div><p class="eyebrow">Performance</p><h3>Average latency by website</h3></div><span>{{ rangeLabel() }}</span></header>
            <app-chart [labels]="names(overview)" [values]="latencies(overview)" label="Average latency in milliseconds" [summary]="chartSummary(overview)" />
          </section>
        </div>

        <section class="panel inventory-preview">
          <header><div><p class="eyebrow">Monitor status</p><h3>Website overview</h3></div><span>Updated <time *ngIf="lastUpdated() as updated" [attr.datetime]="updated.toISOString()">{{ updated | date:'mediumTime' }}</time></span></header>
          <div class="table-wrap"><table><thead><tr><th>Website</th><th>Status</th><th>Uptime</th><th>Average</th><th>P95</th><th>Checks</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>
            <tr *ngFor="let item of ranked(overview)"><td><a [routerLink]="['/monitors',item.monitor.id]"><strong>{{ item.monitor.name }}</strong><small>{{ item.monitor.url }}</small></a></td><td><app-status [status]="item.monitor.enabled ? (item.status || 'pending') : 'paused'" /></td><td>{{ item.check_count ? (item.uptime | number:'1.2-2') + '%' : '—' }}</td><td>{{ item.check_count ? (item.average_latency_ms | number:'1.0-0') + ' ms' : '—' }}</td><td>{{ item.check_count ? (item.p95_latency_ms | number:'1.0-0') + ' ms' : '—' }}</td><td>{{ item.check_count | number }}</td><td><a class="row-link" [routerLink]="['/monitors',item.monitor.id]" [attr.aria-label]="'Open ' + item.monitor.name">→</a></td></tr>
          </tbody></table></div>
        </section>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    .page-heading{display:flex;align-items:end;justify-content:space-between;gap:2rem;margin-bottom:1.6rem}.page-heading h2{font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.045em;margin:.28rem 0}.lede{color:var(--muted);margin:0;line-height:1.5}.heading-actions{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap}.notice{padding:.85rem 1rem;border:1px solid rgba(242,189,92,.45);background:rgba(242,189,92,.08);border-radius:.65rem;color:#e7d4a5;margin-bottom:1rem;font-size:.85rem}.notice button{border:0;background:transparent;color:var(--accent);text-decoration:underline;padding:.2rem .4rem}
    .health-banner{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:1rem;padding:1.1rem 1.25rem;margin-bottom:1rem;background:linear-gradient(105deg,rgba(70,211,145,.1),rgba(18,24,35,.9) 48%);border:1px solid rgba(70,211,145,.28);border-radius:.8rem}.health-banner[data-state=down]{background:linear-gradient(105deg,rgba(255,111,125,.12),rgba(18,24,35,.9) 48%);border-color:rgba(255,111,125,.38)}.health-icon{display:grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:50%;color:#07160f;background:var(--success);font-size:1.1rem;font-weight:950}.health-banner[data-state=down] .health-icon{background:var(--danger);color:#210407}.health-banner h3{margin:.25rem 0;font-size:1.05rem}.health-banner p:not(.eyebrow){margin:0;color:var(--muted);font-size:.82rem}.health-banner a,.panel header a{color:var(--accent);font-size:.8rem;font-weight:750;text-decoration:none}
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-bottom:1rem}.kpis article,.panel{background:linear-gradient(145deg,rgba(20,27,39,.98),rgba(16,22,32,.98));border:1px solid var(--border);border-radius:.8rem;box-shadow:0 16px 50px rgba(0,0,0,.1)}.kpis article{padding:1.15rem 1.2rem}.kpis article.needs-attention{border-color:rgba(255,111,125,.42)}.metric-label{display:flex;align-items:center;gap:.45rem;color:var(--muted);font-size:.75rem;font-weight:650}.metric-label i{display:grid;place-items:center;width:1rem;height:1rem;border:1px solid var(--border-strong);border-radius:50%;font-style:normal;font-size:.62rem}.kpis strong{display:block;font-size:1.65rem;letter-spacing:-.04em;margin:.45rem 0}.kpis em{font-size:.82rem;color:var(--muted);font-style:normal;letter-spacing:0}.kpis small{color:var(--muted);font-size:.72rem}
    .dashboard-grid{display:grid;grid-template-columns:minmax(300px,.82fr) minmax(440px,1.18fr);gap:1rem}.panel{padding:1.2rem;min-width:0}.panel>header{display:flex;justify-content:space-between;align-items:start;gap:1rem;margin-bottom:1rem}.panel h3{margin:.28rem 0 0;font-size:1rem}.panel>header>span{color:var(--muted);font-size:.75rem}.attention-list{display:grid}.attention-list>a{display:grid;grid-template-columns:70px minmax(0,1fr) auto auto;align-items:center;gap:.8rem;padding:.85rem .1rem;border-bottom:1px solid var(--border);color:var(--text);text-decoration:none}.attention-list>a:last-child{border:0}.attention-list>a:hover strong{color:var(--accent)}.attention-list strong,.attention-list small{display:block}.attention-list small{color:var(--muted);font-size:.7rem;margin-top:.22rem;overflow:hidden;text-overflow:ellipsis}.measure{font-size:.72rem;color:var(--muted)}.all-clear{display:flex;align-items:center;gap:.8rem;min-height:160px;justify-content:center}.all-clear>span{display:grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:50%;background:rgba(70,211,145,.12);color:var(--success);font-weight:900}.all-clear p{color:var(--muted);margin:.3rem 0;font-size:.8rem}
    .inventory-preview{margin-top:1rem}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:760px}th,td{text-align:left;padding:.8rem;border-bottom:1px solid var(--border);font-size:.8rem}th{color:var(--muted);font-size:.67rem;text-transform:uppercase;letter-spacing:.06em}tbody tr:last-child td{border:0}td>a{color:var(--text);text-decoration:none}td>a strong,td>a small{display:block}td>a small{max-width:300px;color:var(--muted);font-size:.68rem;margin-top:.22rem;overflow:hidden;text-overflow:ellipsis}.row-link{color:var(--accent);font-size:1rem}
    @media(max-width:1050px){.kpis{grid-template-columns:repeat(2,1fr)}.dashboard-grid{grid-template-columns:1fr}}
    @media(max-width:680px){.page-heading{align-items:stretch;flex-direction:column;gap:1rem}.heading-actions{justify-content:space-between}.health-banner{grid-template-columns:auto 1fr}.health-banner>a{grid-column:1/-1}.kpis{gap:.7rem}.kpis article{padding:1rem}.kpis strong{font-size:1.35rem}.attention-list>a{grid-template-columns:65px minmax(0,1fr) auto}.attention-list .measure{display:none}.panel{padding:1rem}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewComponent {
  private readonly api = inject(MonitorApiService);
  private readonly router = inject(Router);
  readonly data = signal<OverviewSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly range = signal('24h');
  readonly lastUpdated = signal<Date | null>(null);

  constructor() { this.load('24h'); }

  load(value: string): void {
    this.range.set(value);
    this.loading.set(true);
    this.error.set('');
    this.api.overview(value).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: result => { this.data.set(result); this.lastUpdated.set(new Date()); },
      error: () => this.error.set('The backend could not refresh overview data. Check that the service and database are available.')
    });
  }

  goToMonitors(): void { void this.router.navigateByUrl('/monitors'); }
  upCount(value: OverviewSummary): number { return value.monitors.filter(item => item.monitor.enabled && item.status === 'up').length; }
  pendingCount(value: OverviewSummary): number { return value.monitors.filter(item => item.monitor.enabled && (!item.status || item.status === 'pending')).length; }
  totalChecks(value: OverviewSummary): number { return value.monitors.reduce((total, item) => total + item.check_count, 0); }
  fleetState(value: OverviewSummary): 'up' | 'down' { return value.active_incidents > 0 || value.monitors.some(item => item.monitor.enabled && item.status === 'down') ? 'down' : 'up'; }
  fleetMessage(value: OverviewSummary): string { return this.fleetState(value) === 'down' ? 'Some websites need attention' : 'All reporting websites are healthy'; }
  healthDetail(value: OverviewSummary): string {
    const down = value.monitors.filter(item => item.monitor.enabled && item.status === 'down').length;
    return down ? `${down} website${down === 1 ? '' : 's'} reporting down · ${value.active_incidents} active incident${value.active_incidents === 1 ? '' : 's'}` : `${this.upCount(value)} healthy · ${this.pendingCount(value)} awaiting a first check`;
  }
  rangeLabel(): string { return this.range() === '24h' ? '24 hours' : this.range() === '7d' ? '7 days' : '30 days'; }
  attention(value: OverviewSummary): MonitorSummary[] { return this.ranked(value).filter(item => item.monitor.enabled && item.status !== 'up').slice(0, 5); }
  ranked(value: OverviewSummary): MonitorSummary[] { return [...value.monitors].sort((a, b) => this.rank(a) - this.rank(b) || a.monitor.name.localeCompare(b.monitor.name)); }
  names(value: OverviewSummary): string[] { return value.monitors.map(item => item.monitor.name); }
  latencies(value: OverviewSummary): number[] { return value.monitors.map(item => item.average_latency_ms); }
  chartSummary(value: OverviewSummary): string { return value.monitors.map(item => `${item.monitor.name}: ${Math.round(item.average_latency_ms)} milliseconds`).join(', '); }
  private rank(item: MonitorSummary): number { if (!item.monitor.enabled) return 3; if (item.status === 'down') return 0; if (!item.status || item.status === 'pending') return 1; return 2; }
}
