import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({selector:'app-root',standalone:true,imports:[NgIf,RouterLink,RouterLinkActive,RouterOutlet],template:`
<a class="skip-link" href="#main-content">Skip to content</a>
<div class="app-shell" [class.sidebar-collapsed]="collapsed()">
  <aside class="sidebar" aria-label="Primary navigation">
    <div class="brand"><span class="brand-mark" aria-hidden="true">P</span><span class="brand-copy"><strong>Pulseboard</strong><small>Observability</small></span></div>
    <nav>
      <a routerLink="/overview" routerLinkActive="active"><span aria-hidden="true">◫</span><span class="nav-copy">Overview</span></a>
      <a routerLink="/monitors" routerLinkActive="active"><span aria-hidden="true">◎</span><span class="nav-copy">Monitors</span></a>
      <a routerLink="/incidents" routerLinkActive="active"><span aria-hidden="true">△</span><span class="nav-copy">Incidents</span></a>
      <a routerLink="/about" routerLinkActive="active"><span aria-hidden="true">⚙</span><span class="nav-copy">Settings & About</span></a>
    </nav>
    <button class="collapse" type="button" (click)="collapsed.set(!collapsed())" [attr.aria-label]="collapsed()?'Expand sidebar':'Collapse sidebar'">⇤</button>
  </aside>
  <section class="workspace">
    <header class="topbar"><button class="mobile-menu" type="button" (click)="mobileOpen.set(!mobileOpen())" aria-label="Toggle navigation">☰</button><div><p class="breadcrumb">Pulseboard / {{ pageTitle() }}</p><h1>{{ pageTitle() }}</h1></div><span class="environment"><i></i> Local environment</span></header>
    <div *ngIf="mobileOpen()" class="mobile-nav"><a routerLink="/overview" (click)="mobileOpen.set(false)">Overview</a><a routerLink="/monitors" (click)="mobileOpen.set(false)">Monitors</a><a routerLink="/incidents" (click)="mobileOpen.set(false)">Incidents</a><a routerLink="/about" (click)="mobileOpen.set(false)">About</a></div>
    <main id="main-content" tabindex="-1"><router-outlet /></main>
  </section>
</div>`,styles:[`
.app-shell{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.sidebar{position:sticky;top:0;height:100vh;padding:1.25rem;background:#10131d;border-right:1px solid var(--border);display:flex;flex-direction:column}.brand{display:flex;align-items:center;gap:.75rem;padding:.25rem .35rem 1.75rem}.brand-mark{display:grid;place-items:center;width:2.1rem;height:2.1rem;border-radius:.65rem;background:linear-gradient(135deg,var(--accent),#22d3ee);font-weight:900;color:#07111d}.brand-copy{display:grid}.brand-copy small{color:var(--muted);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}.sidebar nav{display:grid;gap:.35rem}.sidebar nav a{display:flex;align-items:center;gap:.8rem;padding:.75rem;border-radius:.6rem;color:var(--muted);text-decoration:none;font-weight:650}.sidebar nav a:hover,.sidebar nav a.active{color:var(--text);background:#1a2030}.sidebar nav a.active{box-shadow:inset 3px 0 var(--accent)}.collapse{margin-top:auto;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:.5rem;padding:.6rem}.workspace{min-width:0}.topbar{min-height:82px;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 2rem;border-bottom:1px solid var(--border);background:rgba(12,15,24,.85);backdrop-filter:blur(16px);position:sticky;top:0;z-index:5}.topbar h1{font-size:1.2rem;margin:.15rem 0 0}.breadcrumb{margin:0;color:var(--muted);font-size:.75rem}.environment{color:var(--muted);font-size:.8rem}.environment i{display:inline-block;width:.5rem;height:.5rem;background:var(--success);border-radius:50%;margin-right:.4rem}.mobile-menu,.mobile-nav{display:none}main{padding:1.5rem 2rem;max-width:1500px;width:100%;margin:0 auto}.sidebar-collapsed{grid-template-columns:74px 1fr}.sidebar-collapsed .brand-copy,.sidebar-collapsed .nav-copy{display:none}.skip-link{position:fixed;top:-4rem;left:1rem;z-index:100;background:white;color:black;padding:.7rem}.skip-link:focus{top:1rem}
@media(max-width:760px){.app-shell{display:block}.sidebar{display:none}.topbar{padding:1rem}.mobile-menu{display:inline-grid;background:#1a2030;border:1px solid var(--border);color:var(--text);padding:.6rem;border-radius:.5rem}.environment{display:none}.mobile-nav{display:grid;position:sticky;top:82px;z-index:4;background:#10131d;padding:.5rem 1rem;border-bottom:1px solid var(--border)}.mobile-nav a{color:var(--text);padding:.75rem;text-decoration:none}main{padding:1rem}}
`],changeDetection:ChangeDetectionStrategy.OnPush})
export class AppComponent{readonly collapsed=signal(false);readonly mobileOpen=signal(false);readonly pageTitle=signal('Overview');constructor(router:Router){router.events.pipe(filter((event):event is NavigationEnd=>event instanceof NavigationEnd)).subscribe(event=>{const segment=event.urlAfterRedirects.split('/')[1]||'overview';this.pageTitle.set(segment==='about'?'Settings & About':segment.charAt(0).toUpperCase()+segment.slice(1));});}}
