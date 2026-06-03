import { Component, input, output } from '@angular/core';

import { Dropzone } from '../../../components/dropzone/dropzone';

@Component({
  selector: 'outbound-upload-card',
  imports: [Dropzone],
  templateUrl: './outbound-upload-card.html',
})
export class OutboundUploadCard {
  readonly busy = input(false);

  readonly fileSelected = output<File>();
}
