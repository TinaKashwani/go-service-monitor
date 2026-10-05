import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { Monitor, MonitorSummary, MonitorStatus } from '../models/observability.models';
import { MonitorApiService } from '../services/monitor-api.service';
import { StateComponent, StatusComponent } from '../shared/ui.component';

type SortMode = 'attention' | 'name' | 'latency' | 'uptime';

@Component({
  selector: 'app-monitors',
  standalone: true,
  imports: [DecimalPipe, NgFor, NgIf, ReactiveFormsModule, RouterLink, StateComponent, StatusComponent],
  template: `
    <header class="page-heading">
      <div><p class="eyebrow">Website inventory</p><h2>Monitors</h2><p>Find an unhealthy website, run a check, or update its schedule.</p></div>
      <button type="button" class="button primary" (click)="openForm()"><span aria-hidden="true">＋</span> Add monitor</button>
    </header>

    <app-state *ngIf="loading()" kind="loading" title="Loading monitors" message="Reading configuration and the latest health summary." />
    <app-state *ngIf="error()" kind="error" title="Monitors unavailable" [message]="error()" action="Retry" (activated)="load()" />

    <ng-container *ngIf="!loading() && !error()">
      <div *ngIf="telemetryUnavailable()" class="notice" role="status"><strong>Live status is unavailable.</strong> Monitor configuration is still available, but health and performance values could not be refreshed.</div>
      <div *ngIf="actionError()" class="notice action-error" role="alert"><strong>Action failed.</strong> {{ actionError() }} <button type="button" aria-label="Dismiss action error" (click)="actionError.set('')">×</button></div>

      <section *ngIf="items().length" class="summary" aria-label="Monitor counts">
        <div><span class="summary-dot down"></span><strong>{{ count('down') }}</strong><span>Down</span></div>
        <div><span class="summary-dot up"></span><strong>{{ count('up') }}</strong><span>Up</span></div>
        <div><span class="summary-dot pending"></span><strong>{{ count('pending') }}</strong><span>Awaiting data</span></div>
        <div><span class="summary-dot paused"></span><strong>{{ count('paused') }}</strong><span>Paused</span></div>
      </section>

      <section *ngIf="items().length" class="toolbar" aria-label="Monitor controls">
        <label class="search"><span class="sr-only">Search monitors</span><span aria-hidden="true">⌕</span><input [value]="search()" (input)="search.set($any($event.target).value)" placeholder="Search name or URL"></label>
        <label><span class="sr-only">Filter monitors by state</span><select aria-label="Filter monitors by state" [value]="filter()" (change)="filter.set($any($event.target).value)"><option value="all">All states</option><option value="down">Down</option><option value="up">Up</option><option value="pending">Awaiting data</option><option value="paused">Paused</option></select></label>
        <label><span class="sr-only">Sort monitors</span><select aria-label="Sort monitors" [value]="sort()" (change)="sort.set($any($event.target).value)"><option value="attention">Sort: Needs attention</option><option value="name">Sort: Name</option><option value="latency">Sort: Highest latency</option><option value="uptime">Sort: Lowest uptime</option></select></label>
        <div class="view" role="group" aria-label="Display mode"><button type="button" (click)="view.set('table')" [attr.aria-pressed]="view() === 'table'" aria-label="Table view">☷</button><button type="button" (click)="view.set('cards')" [attr.aria-pressed]="view() === 'cards'" aria-label="Card view">▦</button></div>
      </section>

      <app-state *ngIf="!items().length" kind="empty" title="No monitors yet" message="Add your first HTTP or HTTPS endpoint to begin monitoring." action="Add a monitor" (activated)="openForm()" />
      <app-state *ngIf="items().length && !filtered().length" kind="empty" title="No matching monitors" message="Try a different search or status filter." action="Clear filters" (activated)="clearFilters()" />

      <section *ngIf="filtered().length" class="monitor-list" [class.cards]="view() === 'cards'" [attr.aria-label]="filtered().length + ' monitors'">
        <article *ngFor="let monitor of filtered(); trackBy: trackById" [attr.data-status]="statusOf(monitor)">
          <div class="monitor-identity"><span class="health-bar" aria-hidden="true"></span><div><a [routerLink]="['/monitors',monitor.id]">{{ monitor.name }}</a><small>{{ monitor.url }}</small></div></div>
          <div class="health"><app-status [status]="statusOf(monitor)" [label]="statusLabel(monitor)" /><small>{{ healthDescription(monitor) }}</small></div>
          <dl><div><dt>Uptime</dt><dd>{{ summaryFor(monitor.id)?.check_count ? ((summaryFor(monitor.id)?.uptime || 0) | number:'1.2-2') + '%' : '—' }}</dd></div><div><dt>Average</dt><dd>{{ summaryFor(monitor.id)?.check_count ? ((summaryFor(monitor.id)?.average_latency_ms || 0) | number:'1.0-0') + ' ms' : '—' }}</dd></div><div><dt>Schedule</dt><dd>Every {{ monitor.interval_seconds }}s</dd></div></dl>
          <div class="actions">
            <a class="icon-button details-link" [routerLink]="['/monitors',monitor.id]" [attr.aria-label]="'View details for ' + monitor.name">↗</a>
            <button class="icon-button" type="button" (click)="check(monitor)" [disabled]="actionPending() === monitor.id" [attr.aria-label]="'Check ' + monitor.name + ' now'">↻</button>
            <button class="more-button" type="button" (click)="toggleMenu(monitor.id)" [attr.aria-expanded]="openMenu() === monitor.id" [attr.aria-controls]="'actions-' + monitor.id" [attr.aria-label]="'Actions for ' + monitor.name">•••</button>
            <div *ngIf="openMenu() === monitor.id" class="action-menu" [id]="'actions-' + monitor.id">
              <button type="button" (click)="edit(monitor)">Edit</button><button type="button" (click)="toggle(monitor)">{{ monitor.enabled ? 'Pause' : 'Resume' }}</button><button type="button" class="danger" (click)="remove(monitor)">Delete</button>
            </div>
          </div>
        </article>
      </section>
    </ng-container>

    <div class="modal" *ngIf="formOpen()" role="presentation" (keydown.escape)="closeForm()" (keydown.tab)="trapFocus($event)" (click)="backdropClick($event)">
      <form role="dialog" aria-modal="true" aria-labelledby="form-title" aria-describedby="form-help" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-head"><div><p class="eyebrow">Monitor setup</p><h2 id="form-title">{{ editing() ? 'Edit monitor' : 'Add monitor' }}</h2></div><button type="button" (click)="closeForm()" aria-label="Close form">×</button></div>
        <p id="form-help" class="form-help">Pulseboard accepts public HTTP or HTTPS endpoints. Checks run from this server.</p>
        <label for="monitor-name">Name<input id="monitor-name" formControlName="name" autocomplete="off"><small>A short label used throughout the dashboard.</small></label>
        <label for="monitor-url">URL<input id="monitor-url" formControlName="url" type="url" placeholder="https://example.com/health" autocomplete="url"></label>
        <div class="split"><label for="monitor-interval">Interval (seconds)<input id="monitor-interval" formControlName="interval_seconds" type="number"></label><label for="monitor-timeout">Timeout (seconds)<input id="monitor-timeout" formControlName="timeout_seconds" type="number"></label></div>
        <div class="split"><label for="monitor-status">Expected status<input id="monitor-status" formControlName="expected_status" type="number"></label><label for="monitor-keyword">Keyword (optional)<input id="monitor-keyword" formControlName="keyword"></label></div>
        <label class="checkbox"><input formControlName="enabled" type="checkbox"><span>Start monitoring immediately</span></label>
        <p class="form-error" *ngIf="formError()" role="alert">{{ formError() }}</p>
        <footer><button type="button" class="button" (click)="closeForm()">Cancel</button><button class="button primary" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Save monitor' }}</button></footer>
      </form>
    </div>
    <p class="toast" *ngIf="toast()" role="status">{{ toast() }}</p>
  `,
  styles: [`
    .page-heading{display:flex;justify-content:space-between;gap:1rem;align-items:end}.page-heading h2{font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.045em;margin:.25rem 0}.page-heading>div>p:last-child{color:var(--muted);margin:0}.notice{position:relative;margin-top:1rem;padding:.85rem 2.5rem .85rem 1rem;border:1px solid rgba(242,189,92,.4);background:rgba(242,189,92,.08);border-radius:.65rem;color:#e7d4a5;font-size:.82rem}.notice.action-error{border-color:rgba(255,111,125,.45);background:rgba(255,111,125,.08);color:#ffc4ca}.notice button{position:absolute;right:.65rem;top:.45rem;background:transparent;border:0;font-size:1.25rem}
    .summary{display:flex;flex-wrap:wrap;gap:1.4rem;margin:1.5rem 0 1rem;padding:.85rem 1rem;background:var(--panel-soft);border:1px solid var(--border);border-radius:.65rem}.summary div{display:flex;align-items:center;gap:.42rem;color:var(--muted);font-size:.75rem}.summary strong{color:var(--text);font-size:.9rem}.summary-dot{width:.45rem;height:.45rem;border-radius:50%}.summary-dot.down{background:var(--danger)}.summary-dot.up{background:var(--success)}.summary-dot.pending{background:var(--warning)}.summary-dot.paused{background:var(--muted)}
    .toolbar{display:flex;gap:.65rem;margin:1rem 0}.toolbar input,.toolbar select{min-height:40px;border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:.5rem;padding:.55rem .7rem}.search{position:relative;display:flex;align-items:center;flex:1;min-width:220px}.search>span{position:absolute;left:.75rem;color:var(--muted)}.search input{width:100%;padding-left:2rem}.toolbar select{color:var(--muted)}.view{display:flex;border:1px solid var(--border);border-radius:.5rem;padding:.15rem}.view button{border:0;background:transparent;color:var(--muted);min-width:36px;border-radius:.35rem}.view button[aria-pressed=true]{background:var(--panel-raised);color:var(--text)}
    .monitor-list{display:grid;border:1px solid var(--border);border-radius:.8rem;overflow:visible;background:var(--panel)}.monitor-list article{position:relative;display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(125px,.65fr) minmax(270px,1fr) auto;align-items:center;gap:1rem;padding:1rem 1.1rem;border-bottom:1px solid var(--border)}.monitor-list article:last-child{border:0}.monitor-list article:hover{background:rgba(30,41,57,.38)}.monitor-identity{display:grid;grid-template-columns:4px minmax(0,1fr);gap:.8rem;align-items:stretch;min-width:0}.health-bar{width:4px;border-radius:5px;background:var(--warning)}article[data-status=up] .health-bar{background:var(--success)}article[data-status=down] .health-bar{background:var(--danger)}article[data-status=paused] .health-bar{background:var(--muted)}.monitor-identity a{font-weight:780;color:var(--text);text-decoration:none}.monitor-identity a:hover{color:var(--accent)}.monitor-identity small,.health small{display:block;color:var(--muted);font-size:.68rem;margin-top:.28rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.health{min-width:0}.monitor-list dl{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:0}.monitor-list dl div{min-width:0}.monitor-list dt{color:var(--muted);font-size:.63rem;text-transform:uppercase;letter-spacing:.05em}.monitor-list dd{margin:.25rem 0 0;font-size:.78rem;font-weight:680}.actions{position:relative;display:flex;gap:.35rem}.icon-button,.more-button{display:grid;place-items:center;width:35px;height:35px;background:var(--panel-raised);border:1px solid var(--border);border-radius:.45rem;color:var(--muted);text-decoration:none}.icon-button:hover,.more-button:hover{color:var(--text);border-color:var(--border-strong)}.action-menu{position:absolute;right:0;top:42px;z-index:5;width:135px;padding:.35rem;background:#1a2331;border:1px solid var(--border-strong);border-radius:.55rem;box-shadow:0 14px 30px rgba(0,0,0,.35)}.action-menu button{display:block;width:100%;border:0;background:transparent;text-align:left;padding:.55rem .65rem;border-radius:.35rem}.action-menu button:hover{background:#243044}.action-menu .danger{color:#ffc4ca}
    .monitor-list.cards{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;border:0;background:transparent}.monitor-list.cards article{display:grid;grid-template-columns:1fr auto;align-items:start;border:1px solid var(--border);border-radius:.8rem;background:var(--panel)}.monitor-list.cards .health{grid-column:1/-1}.monitor-list.cards dl{grid-column:1/-1;width:100%;padding-top:.8rem;border-top:1px solid var(--border)}.monitor-list.cards .actions{position:absolute;right:1rem;top:1rem}.monitor-list.cards .action-menu{top:42px}
    .modal{position:fixed;inset:0;background:rgba(3,6,10,.8);display:grid;place-items:center;padding:1rem;z-index:30;backdrop-filter:blur(4px)}.modal form{background:var(--panel);border:1px solid var(--border-strong);border-radius:.85rem;padding:1.35rem;width:min(620px,100%);max-height:calc(100vh - 2rem);overflow:auto;display:grid;gap:1rem;box-shadow:0 30px 80px rgba(0,0,0,.5)}.form-head{display:flex;justify-content:space-between;align-items:start}.form-head h2{margin:.3rem 0 0}.form-head button{border:0;background:transparent;color:var(--muted);font-size:1.5rem}.form-help{color:var(--muted);font-size:.82rem;margin:0}.modal label{display:grid;gap:.4rem;color:var(--text);font-size:.78rem;font-weight:680}.modal label small{color:var(--muted);font-weight:400}.modal input{width:100%;border:1px solid var(--border);background:var(--panel-soft);color:var(--text);border-radius:.5rem;padding:.65rem .75rem}.split{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.checkbox{display:flex!important;align-items:center}.checkbox input{width:auto}.modal footer{display:flex;justify-content:flex-end;gap:.6rem;padding-top:.5rem;border-top:1px solid var(--border)}.form-error{color:#ffc4ca;margin:0}.toast{position:fixed;right:1rem;bottom:1rem;z-index:40;background:#15372d;border:1px solid var(--success);padding:.85rem 1rem;border-radius:.6rem;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    @media(max-width:1000px){.monitor-list article{grid-template-columns:minmax(200px,1fr) minmax(120px,.55fr) auto}.monitor-list dl{grid-column:1/-1;grid-row:2}.actions{grid-column:3;grid-row:1}}
    @media(max-width:700px){.page-heading{align-items:stretch;flex-direction:column}.page-heading .primary{width:max-content}.toolbar{flex-wrap:wrap}.search{flex-basis:100%}.toolbar label:not(.search){flex:1}.toolbar select{width:100%}.summary{gap:.8rem;justify-content:space-between}.summary div{display:grid;grid-template-columns:auto auto}.summary div span:last-child{grid-column:1/-1}.monitor-list{border:0;background:transparent;gap:.8rem}.monitor-list article{grid-template-columns:1fr auto;gap:.8rem;border:1px solid var(--border)!important;border-radius:.7rem;background:var(--panel);padding:.9rem}.health{grid-column:1/-1}.monitor-list dl{grid-template-columns:repeat(3,1fr);grid-column:1/-1;grid-row:auto;padding-top:.7rem;border-top:1px solid var(--border)}.actions{position:absolute;right:.8rem;top:.8rem;grid-column:auto;grid-row:auto}.details-link{display:none}.split{grid-template-columns:1fr}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonitorsComponent {
  private readonly api = inject(MonitorApiService);
  private readonly fb = inject(FormBuilder);
  readonly items = signal<Monitor[]>([]);
  readonly summaries = signal<Record<string, MonitorSummary>>({});
  readonly loading = signal(true);
  readonly error = signal('');
  readonly telemetryUnavailable = signal(false);
  readonly actionError = signal('');
  readonly search = signal('');
  readonly filter = signal('all');
  readonly sort = signal<SortMode>('attention');
  readonly view = signal<'table' | 'cards'>('table');
  readonly formOpen = signal(false);
  readonly editing = signal<Monitor | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly toast = signal('');
  readonly openMenu = signal('');
  readonly actionPending = signal('');
  private returnFocus?: HTMLElement;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    url: ['', [Validators.required]],
    interval_seconds: [60, [Validators.min(30)]],
    timeout_seconds: [5, [Validators.min(1), Validators.max(30)]],
    expected_status: [200, [Validators.min(100), Validators.max(599)]],
    keyword: [''], enabled: [true]
  });

  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.items().filter(monitor => (this.filter() === 'all' || this.statusOf(monitor) === this.filter()) && `${monitor.name} ${monitor.url}`.toLocaleLowerCase().includes(query)).sort((a, b) => this.compare(a, b));
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set(''); this.telemetryUnavailable.set(false);
    forkJoin({
      monitors: this.api.list(),
      overview: this.api.overview('24h').pipe(catchError(() => { this.telemetryUnavailable.set(true); return of(null); }))
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: result => {
        this.items.set(result.monitors);
        this.summaries.set(Object.fromEntries((result.overview?.monitors || []).map(item => [item.monitor.id, item])));
      },
      error: () => this.error.set('The backend could not load monitor configuration. Check that the service and database are available.')
    });
  }

  summaryFor(id: string): MonitorSummary | undefined { return this.summaries()[id]; }
  statusOf(monitor: Monitor): MonitorStatus { if (!monitor.enabled) return 'paused'; return this.summaryFor(monitor.id)?.status || 'pending'; }
  statusLabel(monitor: Monitor): string { return this.statusOf(monitor) === 'pending' ? 'Awaiting data' : this.statusOf(monitor); }
  healthDescription(monitor: Monitor): string { const value = this.summaryFor(monitor.id); return value?.check_count ? `${value.check_count} checks in 24h` : monitor.enabled ? 'No checks in 24h' : 'Checks are stopped'; }
  count(status: MonitorStatus): number { return this.items().filter(item => this.statusOf(item) === status).length; }
  clearFilters(): void { this.search.set(''); this.filter.set('all'); }
  trackById(_: number, monitor: Monitor): string { return monitor.id; }
  toggleMenu(id: string): void { this.openMenu.set(this.openMenu() === id ? '' : id); }

  openForm(): void {
    this.returnFocus = document.activeElement as HTMLElement;
    this.editing.set(null); this.formError.set('');
    this.form.reset({ name: '', url: '', interval_seconds: 60, timeout_seconds: 5, expected_status: 200, keyword: '', enabled: true });
    this.formOpen.set(true); setTimeout(() => document.getElementById('monitor-name')?.focus());
  }
  edit(monitor: Monitor): void {
    this.returnFocus = document.activeElement as HTMLElement;
    this.editing.set(monitor); this.formError.set(''); this.form.reset(monitor); this.openMenu.set(''); this.formOpen.set(true);
    setTimeout(() => document.getElementById('monitor-name')?.focus());
  }
  closeForm(): void { this.formOpen.set(false); setTimeout(() => this.returnFocus?.focus()); }
  backdropClick(event: MouseEvent): void { if (event.target === event.currentTarget) this.closeForm(); }
  trapFocus(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const dialog = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[role="dialog"]');
    const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]') ?? []);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (keyboardEvent.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!keyboardEvent.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true); this.formError.set('');
    const request = this.editing() ? this.api.update(this.editing()!.id, this.form.getRawValue()) : this.api.create(this.form.getRawValue());
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.closeForm(); this.notify('Monitor saved.'); this.load(); },
      error: () => this.formError.set('The monitor could not be saved. Review the values and confirm the URL is public and unique.')
    });
  }
  toggle(monitor: Monitor): void {
    this.beginAction(monitor);
    this.api.update(monitor.id, { ...monitor, enabled: !monitor.enabled }).pipe(finalize(() => this.actionPending.set(''))).subscribe({
      next: value => { this.items.update(items => items.map(item => item.id === value.id ? value : item)); this.notify(value.enabled ? 'Monitor resumed.' : 'Monitor paused.'); },
      error: () => this.failAction(`Pulseboard could not ${monitor.enabled ? 'pause' : 'resume'} ${monitor.name}.`)
    });
  }
  check(monitor: Monitor): void {
    this.beginAction(monitor);
    this.api.check(monitor.id).pipe(finalize(() => this.actionPending.set(''))).subscribe({
      next: () => { this.notify(`Checked ${monitor.name}.`); this.load(); },
      error: () => this.failAction(`The manual check for ${monitor.name} did not complete.`)
    });
  }
  remove(monitor: Monitor): void {
    this.openMenu.set('');
    if (!confirm(`Delete ${monitor.name}? Its history will also be removed.`)) return;
    this.beginAction(monitor);
    this.api.delete(monitor.id).pipe(finalize(() => this.actionPending.set(''))).subscribe({
      next: () => { this.items.update(items => items.filter(item => item.id !== monitor.id)); this.notify('Monitor deleted.'); },
      error: () => this.failAction(`Pulseboard could not delete ${monitor.name}.`)
    });
  }
  private beginAction(monitor: Monitor): void { this.openMenu.set(''); this.actionError.set(''); this.actionPending.set(monitor.id); }
  private failAction(message: string): void { this.actionError.set(message); }
  private notify(value: string): void { this.toast.set(value); setTimeout(() => this.toast.set(''), 3000); }
  private compare(a: Monitor, b: Monitor): number {
    const left = this.summaryFor(a.id); const right = this.summaryFor(b.id);
    switch (this.sort()) {
      case 'name': return a.name.localeCompare(b.name);
      case 'latency': return (right?.average_latency_ms || -1) - (left?.average_latency_ms || -1) || a.name.localeCompare(b.name);
      case 'uptime': return (left?.uptime ?? 101) - (right?.uptime ?? 101) || a.name.localeCompare(b.name);
      default: return this.statusRank(this.statusOf(a)) - this.statusRank(this.statusOf(b)) || a.name.localeCompare(b.name);
    }
  }
  private statusRank(status: MonitorStatus): number { return { down: 0, pending: 1, up: 2, paused: 3 }[status]; }
}
