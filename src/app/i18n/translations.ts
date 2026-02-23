export interface Translations {
  app: {
    subtitle: string;
  };
  home: {
    title: string;
    description: string;
    startRoute: string;
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
    alreadyCollected: string;
    foundIt: string;
    error: string;
    loadingMessages: string[];
  };
  collection: {
    back: string;
    title: string;
    loading: string;
    emptyLine1: string;
    emptyLine2: string;
  };
}

export type Lang = 'es' | 'fr';
