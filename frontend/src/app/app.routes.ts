import { Routes } from '@angular/router';
import { PlaceholderComponent } from './pages/placeholder.component';
export const routes:Routes=[{path:'overview',component:PlaceholderComponent,data:{title:'Overview'}},{path:'monitors',component:PlaceholderComponent},{path:'monitors/:id',component:PlaceholderComponent},{path:'incidents',component:PlaceholderComponent},{path:'about',component:PlaceholderComponent},{path:'',pathMatch:'full',redirectTo:'overview'},{path:'**',redirectTo:'overview'}];
