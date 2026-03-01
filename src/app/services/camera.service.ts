import { inject, Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { I18nService } from '../i18n';

const LABELS = {
  es: { header: 'Añadir foto', photo: 'Galería', picture: 'Cámara', cancel: 'Cancelar' },
  fr: { header: 'Ajouter photo', photo: 'Galerie', picture: 'Appareil photo', cancel: 'Annuler' },
} as const;

@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly i18n = inject(I18nService);

  async takePhoto(): Promise<File> {
    const labels = LABELS[this.i18n.currentLang()];
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      quality: 90,
      promptLabelHeader: labels.header,
      promptLabelPhoto: labels.photo,
      promptLabelPicture: labels.picture,
      promptLabelCancel: labels.cancel,
    });

    const byteString = atob(photo.base64String!);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }

    const mime = `image/${photo.format}`;
    return new File([bytes], `photo.${photo.format}`, { type: mime });
  }
}
