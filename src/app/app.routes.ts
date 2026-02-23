import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { RoutePage } from './pages/route/route';
import { CollectionPage } from './pages/collection/collection';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'route', component: RoutePage },
  { path: 'collection', component: CollectionPage },
];
