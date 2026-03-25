import { CommonModule } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dropzone',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './dropzone.html',
})
export class Dropzone {
  readonly accept = input('*/*');
  readonly hint = input('請選擇要上傳的檔案');
  readonly disabled = input(false);
  readonly containerClass = input('');

  readonly fileSelected = output<File>();
  readonly selectedFileName = signal<string | null>(null);
  readonly isDragOver = signal(false);

  handleFileChange(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    fileInput.value = '';

    this.emitFile(file);
  }

  handleDragOver(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }

    event.preventDefault();
    this.isDragOver.set(true);
  }

  handleDragLeave(): void {
    this.isDragOver.set(false);
  }

  handleDrop(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }

    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    this.emitFile(file);
  }

  private emitFile(file: File | undefined): void {
    if (!file) {
      return;
    }

    this.selectedFileName.set(file.name);
    this.fileSelected.emit(file);
  }
}
