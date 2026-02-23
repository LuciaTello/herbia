import { Translations } from './translations';

export const FR: Translations = {
  app: {
    subtitle: 'Votre compagnon de découverte des plantes',
  },
  home: {
    title: 'Découvrez les plantes de votre chemin',
    description:
      'Dites-nous où vous partez et où vous allez, et nous vous suggérerons des plantes que vous pourrez trouver en chemin.',
    startRoute: 'Commencer un itinéraire',
    myCollection: 'Ma collection',
  },
  route: {
    back: "Retour à l'accueil",
    title: 'Nouvel itinéraire',
    originLabel: 'Origine',
    originPlaceholder: 'Ex : Saint-Jean-de-Luz',
    destinationLabel: 'Destination',
    destinationPlaceholder: 'Ex : Bayonne',
    searching: 'Recherche en cours...',
    search: 'Chercher des plantes',
    loadingHint:
      'La première recherche peut prendre ~30s (le serveur fait la sieste)',
    resultsTitle: 'Plantes sur votre chemin',
    alreadyCollected: 'Déjà dans votre collection',
    foundIt: 'Je l\'ai trouvée !',
    error: 'Erreur lors de la recherche. Vérifiez que le serveur est démarré.',
    loadingMessages: [
      'On interroge les botanistes du chemin...',
      'Exploration parmi les buissons et les fougères...',
      'Consultation de l\'encyclopédie de la flore...',
      'Fouille parmi les racines...',
      'On demande conseil aux abeilles...',
      'Feuilletage de l\'herbier secret...',
      'Arrosage des graines de connaissance...',
      'En attendant que les résultats fleurissent...',
      'Préparation d\'une salade de données botaniques...',
      'Déchiffrage du langage des fleurs...',
    ],
  },
  collection: {
    back: "Retour à l'accueil",
    title: 'Ma collection',
    loading: 'Ouverture de votre herbier...',
    emptyLine1: "Vous n'avez encore trouvé aucune plante.",
    emptyLine2: 'Partez en itinéraire et commencez à chercher !',
  },
};
