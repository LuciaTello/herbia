# Plan — Mode hors connexion interactif (v2)

## Principe

- **Pas de bascule automatique** — l'app ne change jamais de mode toute seule
- Le mode est piloté uniquement par l'utilisatrice
- `ConnectivityService.online()` sert uniquement à détecter l'absence de réseau pour proposer la bascule, pas à changer le comportement

---

## Les deux façons de passer en mode offline

### A. Depuis la nav bar (home)
Icône WiFi dans la barre nav du bas — visible en permanence, affiche le mode courant.
Tap → bascule immédiatement.

### B. Popup automatique quand une photo échoue
Si l'utilisatrice prend une photo et que `identifyAll` échoue (pas de réseau), au lieu de juste afficher une erreur, on ouvre une popup :

```
┌────────────────────────────────────┐
│  Pas de connexion                  │
│                                    │
│  Active le mode hors connexion     │
│  pour continuer à photographier.   │
│  Les photos seront envoyées plus   │
│  tard.                             │
│                                    │
│  [ Activer mode hors connexion ]   │
│  [ Annuler ]                       │
└────────────────────────────────────┘
```

Si l'utilisatrice accepte :
1. Mode offline activé
2. La photo qui vient d'échouer est gardée en queue (elle y est déjà via `enqueue`)
3. Feedback "Photo enregistrée"

---

## Sortir du mode offline

Uniquement via le toggle dans la nav bar.

Quand l'utilisatrice repasse online :
- Si `pendingCount > 0` → naviguer vers `/sync`
- Si `pendingCount === 0` → juste désactiver le mode

---

## Comportement en mode offline

Quand `manualOfflineMode === true` :

**Prise de photo (`takePhoto`)** :
```
→ resizeImage(raw)
→ offlineQueue.enqueue(trekId, file)
→ resultOverlay = "Photo enregistrée"
→ return (pas d'appel réseau du tout)
```

**Tout le reste de l'app** : lecture seule (balades déjà chargées depuis le cache, consultation normale).

---

## Architecture

### `ConnectivityService`

```ts
readonly online = signal(navigator.onLine); // détection réseau (info only)
readonly manualOfflineMode = signal(false);  // seul pilote du comportement
readonly isOffline = computed(() => this.manualOfflineMode());

async initManualMode(): Promise<void>  // charge depuis Preferences au démarrage
async setManualOffline(value: boolean): Promise<void>  // toggle + persist
```

`online()` continue d'écouter les events navigateur mais **n'affecte plus rien automatiquement**.

---

### `OfflineQueueService`

Modifications :
- Supprimer l'effect auto-sync (plus de bascule automatique)
- Ajouter `readonly queue = signal<QueuedPhoto[]>([])` — liste exposée pour l'écran sync
- Ajouter `async refreshQueue(): Promise<void>` — recharge `queue` depuis IDB
- Ajouter `async loadFile(filename: string): Promise<File>` — lit depuis Filesystem, retourne un File
- Garder `syncAll()` mais ne plus l'appeler automatiquement (appelé uniquement depuis l'écran sync)

---

### `trek-detail.ts` — modifier `takePhoto()`

```ts
async takePhoto(): Promise<void> {
  let raw: File;
  try { raw = await this.cameraService.takePhoto(); }
  catch { return; }

  try {
    const file = await resizeImage(raw);
    const photoUrl = URL.createObjectURL(file);
    const queueId = await this.offlineQueue.enqueue(this.trekId, file);

    // Mode offline : skip réseau, juste enregistrer
    if (this.connectivity.isOffline()) {
      this.resultOverlay.set({ name: this.i18n.t().offline.photoQueued, points: 0, type: 'noMatch', photoUrl });
      return;
    }

    this.identifying.set(true);
    try {
      const result = await this.trekService.identifyAll(this.trekId, file);
      await this.offlineQueue.dequeue(queueId);
      // ... suite du flow normal
    } catch {
      // Erreur réseau → proposer de passer en mode offline
      this.pendingOfflineQueueId.set(queueId);
      this.showOfflinePrompt.set(true);
    } finally {
      this.identifying.set(false);
    }
  } catch {
    this.resultOverlay.set({ name: this.i18n.t().myTreks.uploadError, points: 0, type: 'noMatch' });
  }
}
```

Nouveaux signals dans `trek-detail.ts` :
- `showOfflinePrompt = signal(false)` — affiche la popup "passer offline ?"
- `pendingOfflineQueueId = signal<number | null>(null)` — l'id en queue de la photo qui a échoué

Méthode `acceptOfflineMode()` :
```ts
async acceptOfflineMode(): Promise<void> {
  this.showOfflinePrompt.set(false);
  await this.connectivity.setManualOffline(true);
  // La photo est déjà en queue — juste montrer le feedback
  this.resultOverlay.set({ name: this.i18n.t().offline.photoQueued, points: 0, type: 'noMatch' });
}
```

---

### Nav bar — toggle dans `home.html`

Remplacer (ou ajouter) un des boutons nav par un indicateur offline, ou ajouter l'icône à côté du label "Amies" ou en dehors de la nav, dans le header de la home.

Option retenue : **5e zone dans la nav** ou icône dans le coin de la nav.

Deux états visuels :
- Online : icône WiFi grise (couleur normale nav)
- Offline : icône WiFi barré, colorée (vert ou orange vif) + petit label "hors connexion"

```html
<button class="nav-offline-toggle" (click)="toggleOfflineMode()">
  @if (connectivity.manualOfflineMode()) {
    <!-- WiFi barré SVG, couleur active -->
  } @else {
    <!-- WiFi SVG, couleur normale -->
  }
  <span>{{ connectivity.manualOfflineMode() ? i18n.t().nav.offline : i18n.t().nav.online }}</span>
</button>
```

---

### Écran sync `/sync`

Identique au plan v1, avec ces précisions :

**Accès** : uniquement depuis le toggle home nav quand `pendingCount > 0`.

**Pas de "Retour" avant d'avoir tout traité** (ou confirmation pour quitter).

**Flow photo par photo** :
```
Pour chaque photo sélectionnée :
  1. Charger File depuis Filesystem
  2. Créer blob URL → afficher thumbnail + "Photo X/N · [nom balade]"
  3. Appeler identifyAll(trekId, file) avec spinner
  4. Résultat → overlay (même style trek-detail) :
     - Match unique : bouton "Ajouter (+X pts)" + "Ignorer"
     - Plusieurs matches : liste de choix
     - No match : bouton "Ajouter à ma collection" + "Ignorer"
  5. Selon choix user : uploadPlantPhoto() ou addUserPlant() ou skip
  6. dequeue(id) → photo suivante
Fin : afficher récap → bouton "Retour"
```

---

## Fichiers à modifier / créer

| Fichier | Action |
|---------|--------|
| `services/connectivity.service.ts` | Ajouter manualOfflineMode, isOffline, setManualOffline, initManualMode — supprimer auto-behavior |
| `services/offline-queue.service.ts` | Ajouter queue signal, refreshQueue, loadFile — supprimer effect auto-sync |
| `pages/trek-detail/trek-detail.ts` | Modifier takePhoto(), ajouter showOfflinePrompt, acceptOfflineMode |
| `pages/trek-detail/trek-detail.html` | Ajouter popup "passer offline ?" |
| `pages/home/home.ts` | Injecter ConnectivityService + OfflineQueueService, méthode toggleOfflineMode |
| `pages/home/home.html` | Ajouter toggle dans nav bar |
| `pages/home/home.css` | Style toggle nav offline |
| `pages/sync/sync.ts` | NOUVEAU |
| `pages/sync/sync.html` | NOUVEAU |
| `pages/sync/sync.css` | NOUVEAU |
| `app.routes.ts` | Ajouter route /sync |
| `app.config.ts` | Ajouter initManualMode dans APP_INITIALIZER |
| `i18n/translations.ts` + fr.ts + es.ts | Nouvelles clés |

---

## i18n nouvelles clés

```ts
offline: {
  // existant
  banner: string;
  photoQueued: string;
  syncing: (n: number) => string;
  syncDone: (n: number) => string;
  syncFailed: (n: number) => string;
  // nouveau
  promptTitle: string;       // "Pas de connexion"
  promptMessage: string;     // "Active le mode hors connexion pour continuer..."
  promptConfirm: string;     // "Activer mode hors connexion"
};
nav: {
  // existant
  profile, level, friends, tutorial
  // nouveau
  offline: string;           // "Hors connexion"
  online: string;            // "En ligne"
};
sync: {
  title: string;
  subtitle: (n: number) => string;
  syncButton: (n: number) => string;
  progress: (current: number, total: number) => string;
  identifying: string;
  addMatch: (points: number) => string;
  addToCollection: string;
  skip: string;
  doneTitle: string;
  doneSummary: (added: number, skipped: number) => string;
  backToTreks: string;
  networkError: string;
  noPhotos: string;
};
```

---

## Ordre d'implémentation

1. `ConnectivityService` (mode manuel, persist, init)
2. `app.config.ts` (init au démarrage)
3. `OfflineQueueService` (queue signal, loadFile, supprimer auto-sync)
4. i18n (toutes les clés)
5. `trek-detail` (takePhoto + popup offline)
6. Nav bar home (toggle)
7. Page `/sync` (écran complet)
8. Route
