import { Routes } from '@angular/router';
export const routes:Routes=[
  {path:'overview',loadComponent:()=>import('./pages/overview.component').then(m=>m.OverviewComponent)},
  {path:'monitors',loadComponent:()=>import('./pages/monitors.component').then(m=>m.MonitorsComponent)},
  {path:'monitors/:id',loadComponent:()=>import('./pages/monitor-detail.component').then(m=>m.MonitorDetailComponent)},
  {path:'incidents',loadComponent:()=>import('./pages/incidents.component').then(m=>m.IncidentsComponent)},
  {path:'about',loadComponent:()=>import('./pages/about.component').then(m=>m.AboutComponent)},
  {path:'',pathMatch:'full',redirectTo:'overview'},
  {path:'**',redirectTo:'overview'}
];
