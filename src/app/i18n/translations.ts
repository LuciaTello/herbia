export interface Translations {
  app: {
    subtitle: string;
    logout: string;
  };
  home: {
    title: string;
    description: string;
    startRoute: string;
    myMissions: string;
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
    routeTab: string;
    zoneTab: string;
    locationLabel: string;
    locationPlaceholder: string;
    searchZone: string;
    zoneResultsTitle: string;
    resultsTitle: string;
    startMission: string;
    saving: string;
    tooFar: string;
    error: string;
    dailyLimitReached: string;
    loadingMessages: string[];
  };
  myMissions: {
    back: string;
    title: string;
    loading: string;
    emptyLine1: string;
    emptyLine2: string;
    found: string;
    foundInMission: (origin: string, destination: string) => string;
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
    identifyAddAsOther: string;
    similarity: (pct: number) => string;
    sameGenus: (name: string) => string;
    sameFamily: (name: string) => string;
    summary: (found: number) => string;
    missionComplete: string;
    addPlant: string;
    addingPlant: string;
    myPlantsTitle: string;
    unidentifiedCount: (count: number) => string;
    maxPhotosReached: string;
    uploadError: string;
    plantAdded: string;
    completeMission: string;
    completed: string;
    activeMissions: string;
    completedMissions: string;
    missionsCount: (n: number) => string;
    noLocationMissions: (n: number) => string;
    allFound: string;
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
  onboarding: {
    titles: string[];
    texts: string[];
    next: string;
    start: string;
    accept: string;
  };
  missionTip: {
    title: string;
    text: string;
    dismiss: string;
  };
}

export type Lang = 'es' | 'fr';
