import { inject, Injectable, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { I18nService } from '../i18n';

type PickerLabels = { header: string; camera: string; gallery: string; cancel: string };

const LABELS: Record<string, PickerLabels> = {
  es: { header: 'Añadir foto', camera: 'Cámara', gallery: 'Galería', cancel: 'Cancelar' },
  fr: { header: 'Ajouter photo', camera: 'Appareil photo', gallery: 'Galerie', cancel: 'Annuler' },
};

@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly i18n = inject(I18nService);

  readonly showPicker = signal(false);
  readonly labels = signal(LABELS['es']);
  private resolve: ((source: CameraSource | null) => void) | null = null;

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

  private promptSource(): Promise<CameraSource | null> {
    this.labels.set(LABELS[this.i18n.currentLang()]);
    this.showPicker.set(true);
    return new Promise(resolve => { this.resolve = resolve; });
  }

  pick(source: CameraSource | null): void {
    this.showPicker.set(false);
    this.resolve?.(source);
    this.resolve = null;
  }
}
