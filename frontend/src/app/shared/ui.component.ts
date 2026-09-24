import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-status',
  standalone: true,
  template: `<span class="status" [attr.data-status]="status"><i aria-hidden="true"></i>{{ label || status }}</span>`,
  styles: [`
    .status{display:inline-flex;align-items:center;gap:.45rem;width:max-content;font-size:.78rem;text-transform:capitalize;font-weight:780;line-height:1}
    .status i{width:.5rem;height:.5rem;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 12%,transparent)}
    .status[data-status=up]{color:var(--success)}.status[data-status=down]{color:var(--danger)}.status[data-status=paused]{color:var(--muted)}.status[data-status=pending]{color:var(--warning)}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusComponent {
  @Input() status = 'pending';
  @Input() label = '';
}

@Component({
  selector: 'app-state',
  standalone: true,
  imports: [NgIf],
  template: `
    <section class="state" [attr.data-kind]="kind" [attr.role]="kind === 'error' ? 'alert' : 'status'">
      <div class="state-icon" aria-hidden="true">{{ icon }}</div>
      <div class="skeleton" *ngIf="kind === 'loading'" aria-hidden="true"><i></i><i></i><i></i></div>
      <h2>{{ title }}</h2><p>{{ message }}</p>
      <button *ngIf="action" type="button" (click)="activated.emit()">{{ action }}</button>
    </section>
  `,
  styles: [`
    .state{border:1px solid var(--border);border-radius:.8rem;background:var(--panel);padding:2.5rem 1.5rem;text-align:center}.state-icon{width:2.5rem;height:2.5rem;display:grid;place-items:center;margin:0 auto .8rem;border-radius:50%;background:var(--panel-raised);color:var(--muted);font-weight:900}.state h2{font-size:1.05rem;margin:.4rem 0}.state p{max-width:34rem;margin:.45rem auto 0;color:var(--muted);line-height:1.5}.state[data-kind=error]{border-color:rgba(255,111,125,.5)}.state[data-kind=error] .state-icon{color:var(--danger);background:rgba(255,111,125,.1)}
    .skeleton{display:flex;gap:.35rem;justify-content:center;margin:.25rem auto .8rem}.skeleton i{display:block;width:.45rem;height:.45rem;border-radius:50%;background:var(--accent);animation:pulse 1s infinite alternate}.skeleton i:nth-child(2){animation-delay:.2s}.skeleton i:nth-child(3){animation-delay:.4s}.state button{margin-top:1rem;background:var(--accent);color:#06131b;border:0;border-radius:.5rem;padding:.65rem 1rem;font-weight:800}@keyframes pulse{to{opacity:.25;transform:translateY(-3px)}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StateComponent {
  @Input() kind: 'loading' | 'empty' | 'error' = 'empty';
  @Input() title = '';
  @Input() message = '';
  @Input() action = '';
  @Output() activated = new EventEmitter<void>();
  get icon(): string { return this.kind === 'error' ? '!' : this.kind === 'empty' ? '—' : ''; }
}

@Component({
  selector: 'app-time-range',
  standalone: true,
  template: `<fieldset><legend class="sr-only">Time range</legend>@for(option of options;track option){<button type="button" [attr.aria-pressed]="value === option" (click)="changed.emit(option)">{{ option }}</button>}</fieldset>`,
  styles: [`fieldset{display:flex;border:1px solid var(--border);border-radius:.55rem;padding:.2rem;margin:0;background:var(--panel-soft)}button{border:0;background:transparent;color:var(--muted);padding:.45rem .7rem;border-radius:.38rem;font-size:.78rem;font-weight:700}button[aria-pressed=true]{background:var(--panel-raised);color:var(--text);box-shadow:0 1px 5px rgba(0,0,0,.25)}`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeRangeComponent {
  @Input() value = '24h';
  @Output() changed = new EventEmitter<string>();
  options = ['24h', '7d', '30d'];
}
