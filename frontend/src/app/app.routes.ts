import { Routes } from '@angular/router';
import { PlaceholderComponent } from './pages/placeholder.component';
import { OverviewComponent } from './pages/overview.component';
import { MonitorsComponent } from './pages/monitors.component';
export const routes:Routes=[{path:'overview',component:OverviewComponent},{path:'monitors',component:MonitorsComponent},{path:'monitors/:id',component:PlaceholderComponent},{path:'incidents',component:PlaceholderComponent},{path:'about',component:PlaceholderComponent},{path:'',pathMatch:'full',redirectTo:'overview'},{path:'**',redirectTo:'overview'}];
