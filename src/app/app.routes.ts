import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { RoutePage } from './pages/route/route';
import { CollectionPage } from './pages/collection/collection';
import { MyMissionsPage } from './pages/my-missions/my-missions';
import { LoginPage } from './pages/login/login';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: HomePage, canActivate: [authGuard] },
  { path: 'login', component: LoginPage },
  { path: 'route', component: RoutePage, canActivate: [authGuard] },           // Protected
  { path: 'collection', component: CollectionPage, canActivate: [authGuard] }, // Protected
  { path: 'my-missions', component: MyMissionsPage, canActivate: [authGuard] }, // Protected
];
