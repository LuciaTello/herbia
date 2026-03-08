# Flujo completo de subida de foto

Documento detallado paso a paso de todo lo que ocurre cuando un usuario sube una foto de una planta durante un trek.

---

## Paso 1 — El usuario pulsa el boton de camara

**Archivo:** `src/app/pages/trek-detail/trek-detail.html` (lineas 127-145)

```html
@if (trek()!.status !== 'completed') {
  @if (identifying()) {
    <div class="fab-camera identifying">
      <div class="fab-spinner"></div>
    </div>
  } @else if (uploadingPhoto()) {
    <div class="fab-camera identifying">
      <div class="fab-spinner"></div>
    </div>
  } @else {
    <button class="fab-camera" (click)="takePhoto()">
      📷 {{ i18n.t().myTreks.addPhoto }}
      @if (pendingCount() > 0) {
        <span class="fab-badge">{{ pendingCount() }}</span>
      }
    </button>
  }
}
```

- El boton solo aparece si el trek NO esta completado (`status !== 'completed'`)
- Si `identifying()` es true (la IA esta analizando la foto), se muestra un spinner en vez del boton
- Si `uploadingPhoto()` es true (la foto se esta subiendo al servidor), tambien spinner
- Si no, se muestra el boton con el texto "Ajouter une photo" / "Anadir una foto"
- `pendingCount()` muestra un badge con el numero de fotos offline pendientes de sync

Al hacer clic se llama a `takePhoto()`.

---

## Paso 2 — Selector de fuente (camara o galeria)

**Archivo:** `src/app/services/camera.service.ts`

```typescript
async takePhoto(): Promise<File> {
  const source = await this.promptSource();
  if (source === null) throw new Error('cancelled');

  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Base64,
    source,
    quality: 90,
  });

  const byteString = atob(photo.base64String!);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }

  const mime = `image/${photo.format}`;
  return new File([bytes], `photo.${photo.format}`, { type: mime });
}
```

1. `promptSource()` abre un popup personalizado en el HTML del componente:

```html
@if (cameraService.showPicker()) {
  <div class="photo-picker-backdrop" (click)="cameraService.pick(null)">
    <div class="photo-picker" (click)="$event.stopPropagation()">
      <p class="photo-picker-title">{{ cameraService.labels().header }}</p>
      <div class="photo-picker-options">
        <button class="photo-picker-option" (click)="pickSource('camera')">
          <span class="photo-picker-icon">📷</span>
          <span>{{ cameraService.labels().camera }}</span>
        </button>
        <button class="photo-picker-option" (click)="pickSource('gallery')">
          <span class="photo-picker-icon">🖼</span>
          <span>{{ cameraService.labels().gallery }}</span>
        </button>
      </div>
      <button class="photo-picker-cancel" (click)="cameraService.pick(null)">
        {{ cameraService.labels().cancel }}
      </button>
    </div>
  </div>
}
```

2. El usuario elige "Camara" o "Galeria". Si pulsa fuera del popup o "Cancelar", `pick(null)` resuelve la promesa con `null` y se lanza `throw new Error('cancelled')` — que es capturado en `takePhoto()` del componente con un simple `return`.

3. Si elige una fuente, se llama a `Camera.getPhoto()` del plugin `@capacitor/camera`. En Android esto abre la camara nativa o el selector de fotos del sistema.

4. La foto se recibe como base64. Se decodifica byte a byte en un `Uint8Array` y se envuelve en un objeto `File` de JavaScript con el MIME correcto (`image/jpeg` o `image/png`).

---

## Paso 3 — Redimensionado de la imagen

**Archivo:** `src/app/utils/resize-image.ts`

```typescript
const MAX_SIZE = 1600;
const QUALITY = 0.8;

export function resizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Si ya es pequena y pesa menos de 2MB, no hace nada
      if (width <= MAX_SIZE && height <= MAX_SIZE && file.size <= 2 * 1024 * 1024) {
        URL.revokeObjectURL(img.src);
        resolve(file);
        return;
      }

      // Redimensiona manteniendo la proporcion
      if (width > height) {
        if (width > MAX_SIZE) { height = Math.round(height * MAX_SIZE / width); width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width = Math.round(width * MAX_SIZE / height); height = MAX_SIZE; }
      }

      // Dibuja en un canvas redimensionado
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);

      // Exporta como JPEG al 80% de calidad
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Resize failed')); return; }
          resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        QUALITY,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
```

Resumen:
- Si la imagen mide <= 1600px de lado y pesa <= 2MB: se usa tal cual
- Si no: se redimensiona al maximo 1600px en el lado mas largo, y se comprime a JPEG calidad 0.8
- Esto se hace en el navegador con un `<canvas>` invisible

---

## Paso 4 — Verificacion de conectividad

**Archivo:** `src/app/pages/trek-detail/trek-detail.ts` (dentro de `takePhoto()`)

```typescript
async takePhoto(): Promise<void> {
  let raw: File;
  try {
    raw = await this.cameraService.takePhoto();
  } catch {
    return; // Usuario cancelo
  }

  try {
    const file = await resizeImage(raw);

    // --- CHECK OFFLINE ---
    if (!this.connectivity.online()) {
      const photoUrl = URL.createObjectURL(file);
      await this.offlineQueue.enqueue(this.trekId, file);
      this.resultOverlay.set({
        name: this.i18n.t().offline.photoQueued,
        points: 0, type: 'noMatch', photoUrl
      });
      return;
    }
    // ...continua online...
```

- `this.connectivity.online()` es un signal que refleja el estado de red del dispositivo
- Si esta **offline**, la foto se guarda en IndexedDB via `offlineQueue.enqueue()` y se muestra un overlay "Foto en cola"
- Cuando vuelve la conexion, un `effect()` en `OfflineQueueService` detecta el cambio y ejecuta `syncAll()` automaticamente, que re-sube todas las fotos pendientes

---

## Paso 5 — Llamada a PlantNet (identificacion)

**Archivo:** `src/app/pages/trek-detail/trek-detail.ts` (continuacion de `takePhoto()`)

```typescript
    const photoUrl = URL.createObjectURL(file);
    this.pendingFile.set(file);       // Guarda el archivo para la subida posterior
    this.identifyResult.set(null);    // Limpia resultado anterior
    this.identifying.set(true);       // Activa el spinner del FAB

    try {
      const result = await this.trekService.identifyAll(this.trekId, file);
```

### Frontend HTTP

**Archivo:** `src/app/services/trek.service.ts` (lineas 134-140)

```typescript
async identifyAll(trekId: number, file: File): Promise<IdentifyAllResult> {
  const formData = new FormData();
  formData.append('photo', file);
  return firstValueFrom(
    this.http.post<IdentifyAllResult>(`${this.apiUrl}/${trekId}/identify-all`, formData)
  );
}
```

- Crea un `FormData` con el campo `photo` conteniendo el archivo
- Envia `POST /api/treks/{trekId}/identify-all`
- El `authInterceptor` anade automaticamente el header `Authorization: Bearer <token>`

### Interceptor de autenticacion

**Archivo:** `src/app/auth/auth.interceptor.ts`

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  return next(request).pipe(
    tap({
      error: (err) => {
        if (err.status === 401 && token && !req.url.includes('/auth/')) {
          authService.logout();
        }
      },
    })
  );
};
```

- Si hay token, lo anade al header `Authorization`
- Si el servidor responde 401 (token expirado), hace logout automatico

---

## Paso 6 — Backend: middleware de autenticacion

**Archivo:** `server/src/middleware/auth.middleware.ts`

```typescript
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = header.split(' ')[1];
  try {
    const userId = verifyToken(token);
    req.userId = userId;   // Disponible en todos los handlers posteriores
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

Registrado en `server/src/index.ts`:
```typescript
app.use('/api/treks', authMiddleware, trekRouter(prisma));
```

El JWT se verifica con `jsonwebtoken`. Si es valido, `req.userId` se establece con el ID del usuario.

---

## Paso 7 — Backend: endpoint `identify-all`

**Archivo:** `server/src/routes/trek.routes.ts` (lineas 200-316)

### 7.1 — Validacion y carga del trek

```typescript
router.post('/:trekId/identify-all', upload.single('photo'), async (req, res) => {
  const trekId = parseInt(req.params['trekId'] as string);
  const file = req.file;

  // Validar archivo
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    res.status(400).json({ error: 'Only JPEG and PNG' }); return;
  }

  // Cargar trek con sus plantas AI
  const trek = await prisma.trek.findUnique({
    where: { id: trekId },
    include: { plants: { where: { source: 'ai' } } },
  });
  if (!trek || trek.userId !== req.userId!) {
    res.status(404).json({ error: 'Trek not found' }); return;
  }
```

- `multer` con `memoryStorage()` guarda el archivo en RAM (max 5MB)
- Solo acepta `image/jpeg` y `image/png`
- Carga el trek con solo las plantas generadas por la IA (no las descubiertas por el usuario)
- Verifica que el trek pertenece al usuario autenticado

### 7.2 — Llamada a la API de PlantNet

**Archivo:** `server/src/services/plantnet.service.ts` (funcion `callPlantNet`)

```typescript
export async function callPlantNet(buffer: Buffer, mimetype: string): Promise<PlantNetResult[]> {
  const form = new FormData();
  form.append('images', new Blob([buffer], { type: mimetype }), 'photo.jpg');
  form.append('organs', 'auto');

  const response = await fetch(
    `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_API_KEY}&include-related-images=false&nb-results=5&lang=en`,
    { method: 'POST', body: form }
  );
  // ...parsea los resultados...
}
```

- Envia la foto a la API de PlantNet con `organs=auto` (deteccion automatica del organo: hoja, flor, fruto...)
- Pide los 5 mejores resultados
- Devuelve un array de `PlantNetResult` con nombre cientifico, genero, familia, y score de confianza

### 7.3 — Calculo de similaridad para cada planta del trek

**Archivo:** `server/src/services/plantnet.service.ts` (funcion `calculateSimilarity`)

Para cada planta AI del trek, se compara con los resultados de PlantNet:

```
Especie exacta      → 100 puntos base
Sinonimo (iNat API) → 100 puntos base
Genero              →  75 puntos base
Familia             →  40 puntos base
Sin match           →   0 puntos
```

La comparacion es jerarquica:
1. **Especie**: normaliza los nombres cientificos y busca match exacto en TODOS los resultados de PlantNet
2. **Sinonimos**: si no hay match directo, consulta la API de iNaturalist para obtener sinonimos taxonomicos del nombre esperado, y busca esos sinonimos en los resultados de PlantNet
3. **Genero**: si el genero del mejor resultado de PlantNet coincide con el genero esperado
4. **Familia**: si la familia del mejor resultado coincide con la familia esperada

### 7.4 — Multiplicador de rareza

Los puntos base se multiplican por la rareza de la planta:

| Rareza    | Multiplicador | Especie | Genero | Familia |
|-----------|--------------|---------|--------|---------|
| common    | x1           | 100     | 75     | 40      |
| rare      | x2           | 200     | 150    | 80      |
| veryRare  | x3           | 300     | 225    | 120     |

### 7.5 — Verificacion del limite de 5 fotos por especie

```typescript
const speciesPhotoCount = await prisma.plantPhoto.count({
  where: {
    source: 'user',
    plant: {
      scientificName: plant.scientificName,
      trek: { userId: req.userId! }
    },
  },
});
matches.push({
  plantId: plant.id,
  commonName: plant.commonName,
  scientificName: plant.scientificName,
  similarity: sim.similarity * rarityMultiplier(plant.rarity),
  alreadyCaptured: speciesPhotoCount >= 5,  // <-- limite
});
```

Si el usuario ya tiene 5 fotos de esa especie (en todos sus treks), la planta se marca `alreadyCaptured: true`.

### 7.6 — Respuesta

```typescript
matches.sort((a, b) => b.similarity - a.similarity);
res.json({ plantnetResult, matches });
```

El endpoint devuelve:
- `plantnetResult`: info de la identificacion PlantNet (nombre cientifico, comun, genero, familia)
- `matches[]`: array ordenado por similaridad, cada uno con `plantId`, `similarity`, `alreadyCaptured`

---

## Paso 8 — Frontend: decision segun los matches

**Archivo:** `src/app/pages/trek-detail/trek-detail.ts`

```typescript
const result = await this.trekService.identifyAll(this.trekId, file);
const pn = result.plantnetResult;

const available = result.matches.filter(m => !m.alreadyCaptured);

if (available.length === 0) {
  // Caso A: ninguna planta disponible
  await this.addToCollection(file, result, photoUrl, result.matches.length > 0);

} else if (available.length === 1) {
  // Caso B: un solo match -> subir directamente
  await this.confirmUpload(
    available[0].plantId, available[0].similarity,
    available[0].commonName, photoUrl, pn
  );

} else {
  // Caso C: multiples matches -> mostrar popup para elegir
  this.identifyResult.set({ ...result, matches: available });
  URL.revokeObjectURL(photoUrl);
}
```

### Caso A — Ninguna planta disponible

Se llama a `addToCollection()` que sube la foto como planta descubierta por el usuario (fuera del trek). Esto llama a `POST /api/treks/{trekId}/add-plant` con la foto y la info de PlantNet.

### Caso B — Un solo match

Se sube directamente la foto para esa planta. Ve al **Paso 9**.

### Caso C — Multiples matches

Se muestra un popup de seleccion:

```html
@if (identifyResult() && identifyResult()!.matches.length > 1) {
  <div class="match-backdrop" (click)="cancelUpload()">
    <div class="match-dialog" (click)="$event.stopPropagation()">
      <p class="match-title">
        ... <strong>{{ identifyResult()!.plantnetResult.identifiedAs }}</strong>
      </p>
      <p class="match-subtitle">{{ i18n.t().myTreks.selectPlant }}</p>
      @for (match of identifyResult()!.matches; track match.plantId) {
        <button class="match-option" (click)="selectMatch(match)">
          {{ i18n.t().myTreks.pointsFor(match.commonName, match.similarity) }}
        </button>
      }
      <button class="match-cancel" (click)="cancelUpload()">
        {{ i18n.t().confirm.cancel }}
      </button>
    </div>
  </div>
}
```

El usuario elige una planta del popup, y se llama a `selectMatch()` -> `confirmUpload()`.

---

## Paso 9 — `confirmUpload()`: subida de la foto al servidor

**Archivo:** `src/app/pages/trek-detail/trek-detail.ts` (lineas 189-217)

```typescript
async confirmUpload(
  plantId: number,
  similarity: number,
  plantName?: string,
  photoUrl?: string,
  pn?: { identifiedAs: string; commonName: string; genus: string; family: string }
): Promise<void> {
  const file = this.pendingFile();
  if (!file) return;

  this.identifyResult.set(null);     // Cierra el popup de seleccion
  this.uploadingPhoto.set(true);     // Muestra spinner en el FAB

  try {
    const photo = await this.trekService.uploadPlantPhoto(
      plantId, file, similarity,
      pn ? { identifiedAs: pn.identifiedAs, commonName: pn.commonName } : undefined
    );
    // ...manejo de respuesta (Paso 13)...
  } catch (err: any) {
    this.resultOverlay.set({
      name: this.i18n.t().myTreks.uploadError,
      points: 0, type: 'noMatch', photoUrl
    });
  } finally {
    this.uploadingPhoto.set(false);
    this.pendingFile.set(null);
  }
}
```

---

## Paso 10 — Frontend HTTP: `uploadPlantPhoto()`

**Archivo:** `src/app/services/trek.service.ts` (lineas 142-178)

```typescript
async uploadPlantPhoto(
  plantId: number,
  file: File,
  similarity?: number,
  pn?: { identifiedAs?: string; commonName?: string }
): Promise<PlantPhoto & { pointsOnly?: boolean }> {
  const formData = new FormData();
  formData.append('photo', file);
  if (similarity !== undefined) {
    formData.append('similarity', String(similarity));
  }
  if (pn?.identifiedAs) formData.append('identifiedAs', pn.identifiedAs);
  if (pn?.commonName) formData.append('identifiedCommonName', pn.commonName);

  const photo = await firstValueFrom(
    this.http.post<PlantPhoto & { pointsOnly?: boolean }>(
      `${this.apiUrl}/plants/${plantId}/photo`, formData
    )
  );
  // ...actualizacion local (Paso 14)...
}
```

Envia `POST /api/treks/plants/{plantId}/photo` con:
- `photo`: el archivo de imagen
- `similarity`: los puntos calculados (ej: 100, 75, 200...)
- `identifiedAs`: nombre cientifico identificado por PlantNet
- `identifiedCommonName`: nombre comun identificado por PlantNet

---

## Paso 11 — Backend: endpoint de subida de foto

**Archivo:** `server/src/routes/trek.routes.ts` (lineas 371-459)

### 11.1 — Validacion

```typescript
router.post('/plants/:plantId/photo', upload.single('photo'), async (req, res) => {
  const plantId = parseInt(req.params['plantId'] as string);
  const file = req.file;

  if (!file) { res.status(400).json({ error: 'No file' }); return; }
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    res.status(400).json({ error: 'Only JPEG/PNG' }); return;
  }

  // Verificar que la planta existe y pertenece al usuario
  const plant = await prisma.suggestedPlant.findUnique({
    where: { id: plantId },
    include: { trek: { select: { userId: true } } },
  });
  if (!plant || plant.trek.userId !== req.userId!) {
    res.status(404).json({ error: 'Plant not found' }); return;
  }
```

### 11.2 — Marcar la planta como encontrada (cross-trek)

```typescript
  // Si la planta no estaba marcada como encontrada, marcarla
  // Y marcar TODAS las plantas con el mismo nombre cientifico en TODOS los treks del usuario
  if (!plant.found) {
    await prisma.suggestedPlant.updateMany({
      where: {
        scientificName: plant.scientificName,
        trek: { userId: req.userId! },
        found: false,
      },
      data: {
        found: true,
        foundAt: new Date(),
        foundInTrekId: plant.trekId,
      },
    });
  }
```

Esto es importante: si el usuario tiene la misma especie en 3 treks diferentes, al encontrarla en uno se marca como encontrada en todos.

### 11.3 — Calcular similaridad

```typescript
  const similarity = req.body.similarity
    ? parseInt(req.body.similarity as string)
    : plant.pendingSimilarity || 0;
```

Usa la similaridad enviada desde el frontend. Si no hay, usa `pendingSimilarity` (caso offline sync).

### 11.4 — Verificar limite de 5 fotos por especie

```typescript
  const speciesPhotoCount = await prisma.plantPhoto.count({
    where: {
      source: 'user',
      plant: {
        scientificName: plant.scientificName,
        trek: { userId: req.userId! },
      },
    },
  });

  if (speciesPhotoCount >= 5) {
    // Dar puntos pero NO guardar la foto
    if (similarity > 0) {
      await prisma.user.update({
        where: { id: req.userId! },
        data: { points: { increment: similarity } },
      });
      await prisma.suggestedPlant.update({
        where: { id: plantId },
        data: { pendingSimilarity: 0 },
      });
      await checkQuizUnlock(prisma, req.userId!);
    }
    res.json({ pointsOnly: true, similarity });
    return;
  }
```

Si ya tiene 5 fotos de esa especie:
- Suma los puntos igualmente
- Verifica si se desbloquea el quiz
- Devuelve `{ pointsOnly: true }` — el frontend mostrara un mensaje especial
- NO sube la foto a Cloudinary ni crea registro en DB

---

## Paso 12 — Subida a Cloudinary

**Archivo:** `server/src/services/cloudinary.service.ts`

```typescript
export function uploadPhoto(buffer: Buffer, plantId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'herbia/plants',
        public_id: `plant_${plantId}_${Date.now()}`,
        transformation: [
          { width: 1024, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('No result'));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
```

- La foto se sube a la carpeta `herbia/plants` en Cloudinary
- ID publico: `plant_{plantId}_{timestamp}` (unico por foto)
- Transformaciones automaticas:
  - `width: 1024, crop: 'limit'`: maximo 1024px de ancho (no amplia, solo reduce)
  - `quality: 'auto'`: Cloudinary elige la calidad optima
  - `fetch_format: 'auto'`: sirve WebP a navegadores compatibles, JPEG al resto
- Devuelve la URL segura (HTTPS) del CDN de Cloudinary

---

## Paso 13 — Creacion del registro en base de datos y puntos

**Archivo:** `server/src/routes/trek.routes.ts` (continuacion)

```typescript
  // Subir a Cloudinary
  const url = await uploadPhoto(file.buffer, plantId);

  // Crear registro en la tabla plant_photos
  const photo = await prisma.plantPhoto.create({
    data: {
      url,
      source: 'user',
      plantId,
      similarity,
      identifiedAs: req.body.identifiedAs || null,
      identifiedCommonName: req.body.identifiedCommonName || null,
    },
  });

  // Sumar puntos al usuario
  if (similarity > 0) {
    await prisma.user.update({
      where: { id: req.userId! },
      data: { points: { increment: similarity } },
    });

    // Limpiar pendingSimilarity (evita doble asignacion)
    await prisma.suggestedPlant.update({
      where: { id: plantId },
      data: { pendingSimilarity: 0 },
    });

    // Verificar si se desbloquea el quiz
    await checkQuizUnlock(prisma, req.userId!);
  }

  res.status(201).json(photo);
```

Operaciones en orden:
1. **Cloudinary**: sube la imagen y obtiene la URL
2. **plant_photos**: crea un nuevo registro con `source: 'user'`
3. **users.points**: incrementa atomicamente los puntos (ej: +100 por match de especie)
4. **suggested_plants.pendingSimilarity**: se pone a 0 para evitar doble asignacion
5. **Quiz unlock check**: ve al siguiente paso

---

## Paso 14 — Verificacion de desbloqueo del quiz

**Archivo:** `server/src/services/quiz-unlock.service.ts`

```typescript
const QUIZ_UNLOCK_THRESHOLD = 750;

export async function checkQuizUnlock(
  prisma: PrismaClient,
  userId: number
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, quizUnlocked: true },
  });
  if (user && user.points >= QUIZ_UNLOCK_THRESHOLD && !user.quizUnlocked) {
    await prisma.user.update({
      where: { id: userId },
      data: { quizUnlocked: true },
    });
  }
}
```

- Se ejecuta despues de CADA incremento de puntos
- Si el usuario tiene >= 750 puntos y el quiz no estaba desbloqueado, lo desbloquea
- 750 puntos = nivel 2 (umbral definido tanto aqui como en el frontend en `home.ts`)

---

## Paso 15 — Frontend: manejo de la respuesta

**Archivo:** `src/app/pages/trek-detail/trek-detail.ts` (dentro de `confirmUpload()`)

```typescript
  const photo = await this.trekService.uploadPlantPhoto(plantId, file, similarity, pn);

  // Marcar la planta como encontrada en el estado local
  this.trekService.markPlantFoundLocally(plantId);

  if (photo.pointsOnly) {
    // Caso: limite de 5 fotos alcanzado
    if (similarity > 0) this.auth.points.update(p => p + similarity);
    const msg = this.i18n.t().myTreks.maxPhotosReached.replace('{points}', String(similarity));
    this.resultOverlay.set({
      name: msg, points: similarity, type: 'noMatch', photoUrl
    });

  } else {
    // Caso normal: foto guardada
    if (photo.similarity) this.auth.points.update(p => p + photo.similarity!);
    const missionName = plantName || this.treks()
      .flatMap(m => m.plants)
      .find(p => p.id === plantId)?.commonName || '';
    const displayName = pn?.commonName || missionName;
    this.resultOverlay.set({
      name: missionName, points: similarity, type: 'match', photoUrl,
      identifiedAs: pn?.identifiedAs, commonName: displayName,
      genus: pn?.genus, family: pn?.family
    });
    await this.checkAutoComplete();
  }

  // Re-sincronizar el perfil desde el servidor (points, quizUnlocked, etc.)
  if (similarity > 0) this.auth.refreshProfile().catch(() => {});
```

### 15.1 — Actualizacion local del estado en TrekService

**Archivo:** `src/app/services/trek.service.ts` (dentro de `uploadPlantPhoto()`)

```typescript
  // Anadir la foto al signal local para todas las plantas de la misma especie
  const targetPlant = this.treks().flatMap(m => m.plants).find(p => p.id === plantId);
  if (targetPlant) {
    this.treks.update(list =>
      list.map(trek => ({
        ...trek,
        plants: trek.plants.map(p =>
          p.scientificName === targetPlant.scientificName
            ? { ...p, photos: [...p.photos, enrichedPhoto] }
            : p
        ),
      }))
    );
  }
  this.persistCache();  // Guarda en IndexedDB para acceso offline
```

- Actualiza el signal `treks` de forma inmutable (nuevo array)
- Anade la foto a TODAS las plantas con el mismo nombre cientifico (cross-trek)
- Persiste el cache en IndexedDB

### 15.2 — `markPlantFoundLocally()`

```typescript
markPlantFoundLocally(plantId: number): void {
  const target = this.treks().flatMap(m => m.plants).find(p => p.id === plantId);
  if (!target) return;
  this.treks.update(list =>
    list.map(trek => ({
      ...trek,
      plants: trek.plants.map(p =>
        p.scientificName === target.scientificName
          ? { ...p, found: true }
          : p
      ),
    }))
  );
  this.persistCache();
}
```

Marca como `found: true` todas las plantas de la misma especie en el estado local.

### 15.3 — `refreshProfile()`

**Archivo:** `src/app/services/auth.service.ts`

```typescript
async refreshProfile(): Promise<void> {
  const user = await firstValueFrom(
    this.http.get<{
      username: string | null; points: number;
      quizUnlocked: boolean; quizPopupShown: boolean;
      email: string; photoUrl: string | null; bio: string | null
    }>(`${environment.apiUrl}/users/me`)
  );
  this.username.set(user.username);
  this.points.set(user.points);
  this.quizUnlocked.set(user.quizUnlocked);
  this.quizPopupShown.set(user.quizPopupShown);
  this.photoUrl.set(user.photoUrl);
  this.bio.set(user.bio);
  this.email.set(user.email);
}
```

Llama a `GET /api/users/me` y actualiza todos los signals del `AuthService` con los datos reales del servidor. Esto sincroniza:
- Puntos exactos (por si habia discrepancia)
- `quizUnlocked` (por si se acaba de desbloquear)
- `quizPopupShown` (para no mostrar el popup de quiz si ya se mostro)

---

## Paso 16 — Verificacion de auto-completar trek

**Archivo:** `src/app/pages/trek-detail/trek-detail.ts`

```typescript
private async checkAutoComplete(): Promise<void> {
  const trek = this.trek();
  if (!trek || trek.status === 'completed') return;

  const aiPlants = trek.plants.filter(p => p.source !== 'user');
  if (aiPlants.length > 0 && aiPlants.every(p => p.found)) {
    await this.completeTrek();
    this.completedPopup.set(true);
    setTimeout(() => this.completedPopup.set(false), 3500);
  }
}
```

- Filtra solo las plantas generadas por IA (no las descubiertas por el usuario)
- Si TODAS estan marcadas como `found`, completa el trek automaticamente
- Llama a `PATCH /api/treks/{id}/complete` en el backend
- Muestra un popup de felicitacion durante 3.5 segundos

---

## Paso 17 — Overlay de resultado

**Archivo:** `src/app/pages/trek-detail/trek-detail.html` (lineas 166-205)

```html
@if (resultOverlay(); as r) {
  <div class="result-overlay">
    <div class="result-card" [class.match]="r.type === 'match'"
         [class.no-match]="r.type === 'noMatch'">
      @if (r.photoUrl) {
        <img class="result-photo" [src]="r.photoUrl" alt="" />
      }
      @if (r.type === 'match') {
        @if (r.commonName) {
          <p class="result-name">{{ r.commonName }}</p>
        }
        @if (r.identifiedAs) {
          <p class="result-scientific">{{ r.identifiedAs }}</p>
        }
        @if (matchReason(r.points)) {
          <p class="result-reason">{{ matchReason(r.points) }}</p>
        }
        <p class="result-points">+{{ r.points }} pts</p>
      } @else {
        <p class="result-name">{{ r.name }}</p>
      }
      <button class="result-dismiss" (click)="dismissOverlay()">OK</button>
    </div>
  </div>
}
```

El overlay muestra:
- La foto que acaba de sacar el usuario
- El nombre comun de la planta (ej: "Lavanda")
- El nombre cientifico (ej: "Lavandula angustifolia")
- El tipo de match: "Especie exacta!", "Mismo genero", "Misma familia"
- Los puntos ganados (ej: "+100 pts")
- Un boton "OK" para cerrar

La funcion `matchReason()` interpreta los puntos:
```typescript
protected matchReason(points: number): string {
  if (points > 0 && points % 100 === 0) return this.i18n.t().myTreks.matchSpecies;  // 100, 200, 300
  if (points > 0 && points % 75 === 0)  return this.i18n.t().myTreks.matchGenus;    // 75, 150, 225
  if (points > 0 && points % 40 === 0)  return this.i18n.t().myTreks.matchFamily;   // 40, 80, 120
  return '';
}
```

Al pulsar "OK":
```typescript
protected dismissOverlay(): void {
  const r = this.resultOverlay();
  if (r?.photoUrl) URL.revokeObjectURL(r.photoUrl);
  this.resultOverlay.set(null);
}
```

Libera la URL del blob en memoria y cierra el overlay.

---

## Resumen visual del flujo completo

```
USUARIO PULSA 📷
       │
       ▼
CameraService.takePhoto()
  ├─ Popup: Camara o Galeria?
  ├─ @capacitor/camera → foto en base64
  └─ Devuelve File
       │
       ▼
resizeImage(file)
  ├─ Si <= 1600px y <= 2MB → sin cambios
  └─ Si no → canvas → JPEG 0.8 → max 1600px
       │
       ▼
¿Online?
  ├─ NO → IndexedDB queue → overlay "En cola" → FIN
  │        (se sincroniza automaticamente al volver online)
  └─ SI ↓
       │
       ▼
POST /api/treks/{trekId}/identify-all  [FormData: photo]
       │
       ├─ authMiddleware (JWT → req.userId)
       ├─ multer (buffer en RAM, max 5MB)
       ├─ Verificar ownership del trek
       ├─ callPlantNet(buffer) → API PlantNet → resultados
       ├─ Para cada planta AI del trek:
       │    calculateSimilarity() → 100/75/40/0 pts × rareza
       │    Verificar limite 5 fotos → alreadyCaptured?
       └─ Respuesta: { plantnetResult, matches[] }
       │
       ▼
¿Cuantos matches disponibles?
       │
       ├─ 0 → addToCollection() (planta descubierta)
       │
       ├─ 1 → confirmUpload() directamente
       │
       └─ 2+ → Popup de seleccion → usuario elige → confirmUpload()
                │
                ▼
POST /api/treks/plants/{plantId}/photo  [FormData: photo, similarity, ...]
       │
       ├─ Verificar ownership
       ├─ Marcar planta encontrada (cross-trek, todas las del mismo nombre)
       ├─ ¿Ya tiene 5 fotos de esta especie?
       │    ├─ SI → sumar puntos, checkQuizUnlock, return { pointsOnly: true }
       │    └─ NO ↓
       ├─ uploadPhoto(buffer) → Cloudinary → URL segura
       │    (carpeta herbia/plants, max 1024px, quality auto)
       ├─ prisma.plantPhoto.create({ url, source:'user', similarity, ... })
       ├─ prisma.user.update({ points: +similarity })
       ├─ checkQuizUnlock() → si >= 750 pts → quizUnlocked = true
       └─ Respuesta: 201 { id, url, similarity, ... }
       │
       ▼
Frontend recibe respuesta
       │
       ├─ markPlantFoundLocally() → actualiza signal treks
       ├─ auth.points.update() → actualiza puntos localmente
       ├─ Mostrar overlay de resultado (foto + nombre + puntos)
       ├─ checkAutoComplete() → si todas las plantas AI encontradas → completar trek
       └─ auth.refreshProfile() → GET /users/me → sync real del servidor
       │
       ▼
USUARIO VE EL OVERLAY DE RESULTADO
  "Lavandula angustifolia"
  "Especie exacta!"
  "+100 pts"
  [OK]
```

---

## Tablas de base de datos involucradas

| Tabla              | Rol en el flujo                                                    |
|--------------------|--------------------------------------------------------------------|
| `users`            | Puntos, quiz_unlocked, quiz_popup_shown                            |
| `treks`            | Trek del usuario, status (active/completed)                        |
| `suggested_plants` | Plantas del trek, found, found_at, pending_similarity, source      |
| `plant_photos`     | Fotos subidas (user o referencia), URL Cloudinary, similarity      |
| `plants`           | Cache de nombres comunes traducidos para PlantNet                  |

---

## Archivos involucrados

| Archivo                                           | Rol                                            |
|---------------------------------------------------|-------------------------------------------------|
| `src/app/pages/trek-detail/trek-detail.html`      | UI: boton camara, picker, overlay, popup match  |
| `src/app/pages/trek-detail/trek-detail.ts`        | Logica: takePhoto, confirmUpload, checkAutoComplete |
| `src/app/services/camera.service.ts`              | Captura de foto via Capacitor                   |
| `src/app/utils/resize-image.ts`                   | Redimensionado en canvas                        |
| `src/app/services/trek.service.ts`                | HTTP: identifyAll, uploadPlantPhoto             |
| `src/app/services/offline-queue.service.ts`       | Cola offline en IndexedDB                       |
| `src/app/services/connectivity.service.ts`        | Deteccion de red                                |
| `src/app/auth/auth.interceptor.ts`                | JWT en headers, auto-logout 401                 |
| `src/app/services/auth.service.ts`                | Perfil, puntos, quizUnlocked                    |
| `server/src/middleware/auth.middleware.ts`         | Verificacion JWT backend                        |
| `server/src/routes/trek.routes.ts`                | Endpoints identify-all y photo upload           |
| `server/src/services/plantnet.service.ts`         | API PlantNet + calculo similaridad              |
| `server/src/services/cloudinary.service.ts`       | Subida a Cloudinary                             |
| `server/src/services/quiz-unlock.service.ts`      | Logica desbloqueo quiz (>= 750 pts)             |
| `server/prisma/schema.prisma`                     | Esquema de base de datos                        |
