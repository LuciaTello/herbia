import { Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-confirm-popup',
  templateUrl: './confirm-popup.html',
  styleUrl: './confirm-popup.css',
})
export class ConfirmPopupComponent {
  protected readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
}
