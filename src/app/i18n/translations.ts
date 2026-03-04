export interface Translations {
  app: {
    subtitle: string;
  };
  nav: {
    profile: string;
    level: string;
    friends: string;
    tutorial: string;
    logout: string;
  };
  home: {
    greeting: (name: string) => string;
    startRoute: string;
    missionSubtitle: string;
    myMissions: string;
    missionsSubtitle: string;
    myCollection: string;
    collectionSubtitle: string;
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
    plantCountLabel: string;
    plantCount5: string;
    plantCount10: string;
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
    pointsEarned: (pts: number) => string;
    sameGenus: (name: string) => string;
    sameFamily: (name: string) => string;
    viewFamily: (name: string) => string;
    summary: (found: number) => string;
    missionComplete: string;
    addPlant: string;
    addingPlant: string;
    myPlantsTitle: string;
    unidentifiedCount: (count: number) => string;
    maxPhotosReached: string;
    alreadyCaptured: string;
    regionLimitReached: string;
    uploadError: string;
    plantAdded: string;
    completeMission: string;
    completed: string;
    activeMissions: string;
    completedMissions: string;
    missionsCount: (n: number) => string;
    noLocationMissions: (n: number) => string;
    allFound: string;
    photoLooksLike: string;
    selectPlant: string;
    noMatchInMission: string;
    matchSpecies: string;
    matchGenus: string;
    matchFamily: string;
    pointsFor: (name: string, pts: number) => string;
    takingPhoto: string;
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
  missionTutorial: {
    titles: string[];
    texts: string[];
    imageLabels: string[];
    next: string;
    done: string;
  };
  level: {
    back: string;
    title: string;
    pointsLabel: string;
    nextLevel: (points: number) => string;
    maxLevel: string;
    levels: { emoji: string; name: string; description: string }[];
  };
  friends: {
    back: string;
    title: string;
    searchPlaceholder: string;
    addFriend: string;
    pending: string;
    accept: string;
    reject: string;
    noFriends: string;
    requestSent: string;
    setUsername: string;
    usernamePlaceholder: string;
    usernameRequired: string;
    save: string;
    alreadyFriends: string;
    remove: string;
    missions: string;
    plants: string;
    noBio: string;
  };
  profile: {
    back: string;
    title: string;
    changePhoto: string;
    usernameLabel: string;
    emailLabel: string;
    bioLabel: string;
    bioPlaceholder: string;
    save: string;
    saved: string;
    emailTaken: string;
    usernameTaken: string;
  };
  familyPopup: {
    title: (name: string) => string;
    loading: string;
    empty: string;
    close: string;
  };
  confirm: {
    cancel: string;
    confirm: string;
    deletePhoto: string;
    deleteMission: string;
    deleteUserPlant: string;
    removePlant: string;
    completeMission: string;
    removeFriend: string;
  };
  tutorials: {
    back: string;
    title: string;
    missions: {
      title: string;
      description: string;
    };
    taxonomy: {
      title: string;
      description: string;
    };
  };
  taxonomyTutorial: {
    titles: string[];
    texts: string[];
    next: string;
    done: string;
  };
}

export type Lang = 'es' | 'fr';
