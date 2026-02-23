import { Translations } from './translations';

export const ES: Translations = {
  app: {
    subtitle: 'Tu compañera de descubrimiento de plantas',
  },
  home: {
    title: 'Descubre las plantas de tu camino',
    description:
      'Dinos donde empiezas y a donde vas, y te sugeriremos plantas que puedes encontrar por el camino.',
    startRoute: 'Empezar una ruta',
    myCollection: 'Mi colección',
  },
  route: {
    back: 'Volver al inicio',
    title: 'Nueva ruta',
    originLabel: 'Origen',
    originPlaceholder: 'Ej: Irún',
    destinationLabel: 'Destino',
    destinationPlaceholder: 'Ej: Bayona',
    searching: 'Buscando...',
    search: 'Buscar plantas',
    loadingHint:
      'La primera búsqueda puede tardar ~30s (el servidor duerme la siesta)',
    resultsTitle: 'Plantas en tu camino',
    alreadyCollected: 'Ya en tu colección',
    foundIt: '¡La he encontrado!',
    error: 'Error al buscar plantas. Verifica que el servidor está arrancado.',
    loadingMessages: [
      'Preguntando a los botánicos del camino...',
      'Explorando entre arbustos y helechos...',
      'Consultando la enciclopedia de la flora...',
      'Rebuscando entre las raíces...',
      'Pidiendo consejo a las abejas...',
      'Hojeando el herbario secreto...',
      'Regando las semillas de conocimiento...',
      'Esperando a que florezcan los resultados...',
      'Cocinando una ensalada de datos botánicos...',
      'Descifrando el lenguaje de las flores...',
    ],
  },
  collection: {
    back: 'Volver al inicio',
    title: 'Mi colección',
    loading: 'Abriendo tu herbario...',
    emptyLine1: 'Todavía no has encontrado ninguna planta.',
    emptyLine2: '¡Ve a una ruta y empieza a buscar!',
  },
};
