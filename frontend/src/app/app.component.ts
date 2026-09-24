import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#main-content">Skip to content</a>
    <div class="app-shell" [class.sidebar-collapsed]="collapsed()">
      <aside class="sidebar" aria-label="Primary navigation">
        <a class="brand" routerLink="/overview" aria-label="Pulseboard overview">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="brand-copy"><strong>Pulseboard</strong><small>Website monitoring</small></span>
        </a>
        <nav aria-label="Main menu">
          <a routerLink="/overview" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">⌂</span><span class="nav-copy">Overview</span></a>
          <a routerLink="/monitors" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">◉</span><span class="nav-copy">Monitors</span></a>
          <a routerLink="/incidents" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">!</span><span class="nav-copy">Incidents</span></a>
          <a routerLink="/about" routerLinkActive="active"><span class="nav-icon" aria-hidden="true">i</span><span class="nav-copy">About</span></a>
        </nav>
        <div class="sidebar-footer">
          <span class="environment"><i aria-hidden="true"></i><span class="nav-copy">Local environment</span></span>
          <button class="collapse" type="button" (click)="collapsed.set(!collapsed())" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"><span aria-hidden="true">{{ collapsed() ? '→' : '←' }}</span></button>
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <button class="mobile-menu" type="button" (click)="mobileOpen.set(!mobileOpen())" [attr.aria-expanded]="mobileOpen()" aria-controls="mobile-navigation" aria-label="Toggle navigation">☰</button>
          <div><p class="breadcrumb">Pulseboard <span>/</span> {{ pageTitle() }}</p><h1>{{ pageTitle() }}</h1></div>
          <a class="topbar-action" routerLink="/monitors">View monitors <span aria-hidden="true">→</span></a>
        </header>
        <nav *ngIf="mobileOpen()" id="mobile-navigation" class="mobile-nav" aria-label="Mobile navigation">
          <a routerLink="/overview" routerLinkActive="active" (click)="mobileOpen.set(false)">Overview</a>
          <a routerLink="/monitors" routerLinkActive="active" (click)="mobileOpen.set(false)">Monitors</a>
          <a routerLink="/incidents" routerLinkActive="active" (click)="mobileOpen.set(false)">Incidents</a>
          <a routerLink="/about" routerLinkActive="active" (click)="mobileOpen.set(false)">About</a>
        </nav>
        <main id="main-content" tabindex="-1"><router-outlet /></main>
      </section>
    </div>
  `,
  styles: [`
    .app-shell{min-height:100vh;display:grid;grid-template-columns:248px minmax(0,1fr)}
    .sidebar{position:sticky;top:0;height:100vh;padding:1.35rem 1rem;background:rgba(10,14,22,.96);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:10}
    .brand{display:flex;align-items:center;gap:.8rem;padding:.2rem .45rem 2rem;color:var(--text);text-decoration:none}
    .brand-mark{display:flex;align-items:end;justify-content:center;gap:3px;width:2.35rem;height:2.35rem;padding:.55rem;border-radius:.7rem;background:linear-gradient(145deg,#1c5c78,#10384e);border:1px solid #2b718f;box-shadow:0 8px 24px rgba(25,142,185,.15)}
    .brand-mark i{display:block;width:3px;border-radius:3px;background:var(--accent)}.brand-mark i:nth-child(1){height:7px}.brand-mark i:nth-child(2){height:14px}.brand-mark i:nth-child(3){height:10px}
    .brand-copy{display:grid;line-height:1.15}.brand-copy strong{font-size:1.05rem;letter-spacing:-.02em}.brand-copy small{color:var(--muted);font-size:.68rem;letter-spacing:.05em;margin-top:.25rem}
    .sidebar nav{display:grid;gap:.3rem}.sidebar nav a{display:flex;align-items:center;gap:.8rem;min-height:44px;padding:.65rem .7rem;border-radius:.55rem;color:var(--muted);text-decoration:none;font-weight:650;transition:background .15s,color .15s}
    .sidebar nav a:hover{color:var(--text);background:var(--panel)}.sidebar nav a.active{color:#d9f5ff;background:linear-gradient(90deg,rgba(55,182,226,.18),rgba(55,182,226,.05));box-shadow:inset 3px 0 var(--accent)}
    .nav-icon{display:grid;place-items:center;width:1.35rem;height:1.35rem;font-weight:850}
    .sidebar-footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.8rem .35rem 0;border-top:1px solid var(--border)}
    .environment{display:flex;align-items:center;gap:.55rem;color:var(--muted);font-size:.75rem}.environment i{width:.5rem;height:.5rem;background:var(--success);border-radius:50%;box-shadow:0 0 0 4px rgba(70,211,145,.09)}
    .collapse{display:grid;place-items:center;width:2rem;height:2rem;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:.45rem;cursor:pointer}
    .workspace{min-width:0}.topbar{min-height:80px;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 2.25rem;border-bottom:1px solid var(--border);background:rgba(11,15,23,.84);backdrop-filter:blur(18px);position:sticky;top:0;z-index:8}
    .topbar h1{font-size:1.12rem;margin:.2rem 0 0;letter-spacing:-.02em}.breadcrumb{margin:0;color:var(--muted);font-size:.72rem}.breadcrumb span{padding:0 .3rem;color:var(--border-strong)}
    .topbar-action{color:var(--muted);font-size:.8rem;text-decoration:none}.topbar-action:hover{color:var(--text)}
    .mobile-menu,.mobile-nav{display:none}main{padding:2rem 2.25rem 3rem;max-width:1440px;width:100%;margin:0 auto}.sidebar-collapsed{grid-template-columns:76px minmax(0,1fr)}.sidebar-collapsed .brand-copy,.sidebar-collapsed .nav-copy,.sidebar-collapsed .environment{display:none}.sidebar-collapsed .brand{padding-inline:.15rem}.sidebar-collapsed .sidebar nav a{justify-content:center}.sidebar-collapsed .sidebar-footer{justify-content:center}
    .skip-link{position:fixed;top:-5rem;left:1rem;z-index:100;background:#fff;color:#081018;padding:.7rem 1rem;border-radius:.4rem}.skip-link:focus{top:1rem}
    @media(max-width:760px){.app-shell{display:block}.sidebar{display:none}.topbar{min-height:72px;padding:.8rem 1rem}.mobile-menu{display:inline-grid;place-items:center;background:var(--panel);border:1px solid var(--border);color:var(--text);padding:.55rem .7rem;border-radius:.5rem}.topbar-action{display:none}.mobile-nav{display:grid;position:sticky;top:72px;z-index:7;background:#0d121c;padding:.5rem 1rem;border-bottom:1px solid var(--border);box-shadow:0 12px 30px rgba(0,0,0,.3)}.mobile-nav a{color:var(--muted);padding:.75rem;text-decoration:none;border-radius:.4rem}.mobile-nav a.active{color:var(--text);background:var(--panel)}main{padding:1.25rem 1rem 2rem}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly pageTitle = signal('Overview');

  constructor(router: Router) {
    router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
      const segment = event.urlAfterRedirects.split('/')[1] || 'overview';
      this.pageTitle.set(segment === 'about' ? 'About Pulseboard' : segment.charAt(0).toUpperCase() + segment.slice(1));
      this.mobileOpen.set(false);
    });
  }
}
