import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { RoutePage } from './pages/route/route';
import { CollectionPage } from './pages/collection/collection';
import { TrekDetailPage } from './pages/trek-detail/trek-detail';
import { MyTreksPage } from './pages/my-treks/my-treks';
import { LevelPage } from './pages/level/level';
import { FriendsPage } from './pages/friends/friends';
import { ProfilePage } from './pages/profile/profile';
import { LoginPage } from './pages/login/login';
import { TutorialsPage } from './pages/tutorials/tutorials';
import { ChallengesPage } from './pages/challenges/challenges';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', component: HomePage, canActivate: [authGuard] },
  { path: 'login', component: LoginPage },
  { path: 'route', component: RoutePage, canActivate: [authGuard] },
  { path: 'collection', component: CollectionPage, canActivate: [authGuard] },
  { path: 'my-treks/:id', component: TrekDetailPage, canActivate: [authGuard] },
  { path: 'my-treks', component: MyTreksPage, canActivate: [authGuard] },
  { path: 'my-level', component: LevelPage, canActivate: [authGuard] },
  { path: 'friends', component: FriendsPage, canActivate: [authGuard] },
  { path: 'profile', component: ProfilePage, canActivate: [authGuard] },
  { path: 'tutorials', component: TutorialsPage, canActivate: [authGuard] },
  { path: 'challenges', component: ChallengesPage, canActivate: [authGuard] },
];
