import { Component, input, output } from '@angular/core';

import { Dropzone } from '../../../components/dropzone/dropzone';
import type { InboundImportSummary } from '../import.types';

@Component({
  selector: 'inbound-upload-card',
  imports: [Dropzone],
  templateUrl: './inbound-upload-card.html',
})
export class InboundUploadCard {
  readonly busy = input(false);
  readonly summary = input.required<InboundImportSummary>();

  readonly fileSelected = output<File>();
}
