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
    error: string;
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
  };
  collection: {
    back: string;
    title: string;
    loading: string;
    emptyLine1: string;
    emptyLine2: string;
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
