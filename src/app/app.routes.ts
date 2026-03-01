import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { RoutePage } from './pages/route/route';
import { CollectionPage } from './pages/collection/collection';
import { MyMissionsPage } from './pages/my-missions/my-missions';
import { LevelPage } from './pages/level/level';
import { FriendsPage } from './pages/friends/friends';
import { LoginPage } from './pages/login/login';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: HomePage, canActivate: [authGuard] },
  { path: 'login', component: LoginPage },
  { path: 'route', component: RoutePage, canActivate: [authGuard] },
  { path: 'collection', component: CollectionPage, canActivate: [authGuard] },
  { path: 'my-missions', component: MyMissionsPage, canActivate: [authGuard] },
  { path: 'my-level', component: LevelPage, canActivate: [authGuard] },
  { path: 'friends', component: FriendsPage, canActivate: [authGuard] },
];
