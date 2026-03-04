import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { RoutePage } from './pages/route/route';
import { CollectionPage } from './pages/collection/collection';
import { MissionDetailPage } from './pages/mission-detail/mission-detail';
import { MyMissionsPage } from './pages/my-missions/my-missions';
import { LevelPage } from './pages/level/level';
import { FriendsPage } from './pages/friends/friends';
import { ProfilePage } from './pages/profile/profile';
import { LoginPage } from './pages/login/login';
import { TutorialsPage } from './pages/tutorials/tutorials';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: HomePage, canActivate: [authGuard] },
  { path: 'login', component: LoginPage },
  { path: 'route', component: RoutePage, canActivate: [authGuard] },
  { path: 'collection', component: CollectionPage, canActivate: [authGuard] },
  { path: 'my-missions/:id', component: MissionDetailPage, canActivate: [authGuard] },
  { path: 'my-missions', component: MyMissionsPage, canActivate: [authGuard] },
  { path: 'my-level', component: LevelPage, canActivate: [authGuard] },
  { path: 'friends', component: FriendsPage, canActivate: [authGuard] },
  { path: 'profile', component: ProfilePage, canActivate: [authGuard] },
  { path: 'tutorials', component: TutorialsPage, canActivate: [authGuard] },
];
