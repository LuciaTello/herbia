export interface Translations {
  app: {
    subtitle: string;
    logout: string;
  };
  home: {
    title: string;
    description: string;
    startRoute: string;
    myTreks: string;
    myCollection: string;
  };
  route: {
    back: string;
    title: string;
    originLabel: string;
    originPlaceholder: string;
    destinationLabel: string;
    destinationPlaceholder: string;
    searching: string;
    search: string;
    loadingHint: string;
    resultsTitle: string;
    startTrek: string;
    saving: string;
    tooFar: string;
    error: string;
    dailyLimitReached: string;
    loadingMessages: string[];
  };
  myTreks: {
    back: string;
    title: string;
    loading: string;
    emptyLine1: string;
    emptyLine2: string;
    found: string;
    markFound: string;
    addPhoto: string;
    uploading: string;
    myPhotos: string;
    identifying: string;
    identifyMatch: (name: string, score: number) => string;
    identifyNoMatch: (name: string, score: number) => string;
    identifyUnknown: string;
    identifyUpload: string;
    identifyCancel: string;
    identifyUploadAnyway: string;
    summary: (total: number, found: number) => string;
    addPlant: string;
    addingPlant: string;
    myPlantsTitle: string;
    unidentifiedCount: (count: number) => string;
    maxPhotosReached: string;
    plantAdded: string;
  };
  collection: {
    back: string;
    title: string;
    loading: string;
    emptyLine1: string;
    emptyLine2: string;
    unidentifiedTitle: string;
    mapTitle: string;
    plantsCount: (n: number) => string;
    noLocation: string;
    noLocationCount: (n: number) => string;
    regionsTitle: string;
    allRegions: string;
  };
  rarity: {
    common: string;
    rare: string;
    veryRare: string;
  };
  login: {
    loginTitle: string;
    registerTitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    loginButton: string;
    registerButton: string;
    submitting: string;
    hasAccount: string;
    switchToLogin: string;
    noAccount: string;
    switchToRegister: string;
    genericError: string;
  };
}

export type Lang = 'es' | 'fr';
