import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { nanoid } from 'nanoid';

import type { Product } from '../../core/models';

@Component({
  selector: 'app-add-product-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div style="width:480px; max-width:92vw; background:var(--surface); border-radius:var(--r-lg); overflow:hidden;">
      <div class="cls-stripe" style="height:5px;">
        <span class="red"></span><span class="ochre"></span><span class="green"></span>
        <span class="blue"></span><span class="ink"></span>
      </div>
      <div style="padding:28px 32px 24px;">
        <div class="eyebrow" style="margin-bottom:6px;">PRODUCT · NEW ITEM</div>
        <h2 class="display-title" style="font-size:22px; margin:0 0 20px;">新增商品</h2>

        <form [formGroup]="form" style="display:flex; flex-direction:column; gap:12px;">
          <label class="field">
            <span class="label">品名 *</span>
            <input formControlName="name" type="text" placeholder="商品名稱">
          </label>
          <label class="field mono">
            <span class="label">SKU</span>
            <input formControlName="sku" type="text" placeholder="選填">
          </label>
          <label class="field">
            <span class="label">安全庫存量</span>
            <input formControlName="lowStockThreshold" type="number" min="0" placeholder="0">
          </label>
          <label class="field">
            <span class="label">備註</span>
            <input formControlName="note" type="text" placeholder="選填">
          </label>
        </form>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:24px; border-top:1px solid var(--hairline); padding-top:16px;">
          <button class="btn" type="button" (click)="cancel()">取消</button>
          <button class="btn btn-primary" type="button" (click)="submit()" [disabled]="form.invalid">
            <span class="mat-icon sm">add</span>新增
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AddProductDialog {
  readonly #fb = inject(FormBuilder);
  readonly #dialogRef = inject(MatDialogRef<AddProductDialog>);

  readonly form = this.#fb.group({
    name: ['', Validators.required],
    sku: [''],
    lowStockThreshold: [0, [Validators.required, Validators.min(0)]],
    note: [''],
  });

  submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const now = new Date().toISOString();
    const product: Product = {
      id: nanoid(),
      name: v.name!,
      sku: v.sku || undefined,
      lowStockThreshold: v.lowStockThreshold ?? 0,
      note: v.note || undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.#dialogRef.close(product);
  }

  cancel(): void {
    this.#dialogRef.close(null);
  }
}
