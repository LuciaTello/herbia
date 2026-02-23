import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { RoutePage } from './pages/route/route';
import { CollectionPage } from './pages/collection/collection';
import { MyTreksPage } from './pages/my-treks/my-treks';
import { LoginPage } from './pages/login/login';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'login', component: LoginPage },
  { path: 'route', component: RoutePage, canActivate: [authGuard] },           // Protected
  { path: 'collection', component: CollectionPage, canActivate: [authGuard] }, // Protected
  { path: 'my-treks', component: MyTreksPage, canActivate: [authGuard] },     // Protected
];
