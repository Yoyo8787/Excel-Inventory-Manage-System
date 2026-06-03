import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { nanoid } from 'nanoid';

import type { ProductAliasMapping, ProductKey, UnmatchedOutbound } from '../../core/models';

export interface MappingDialogData {
  inventoryItems: ProductKey[];
  unmatchedOutbounds: UnmatchedOutbound[];
  prefillSource?: ProductKey;
}

@Component({
  selector: 'app-mapping-dialog',
  imports: [ReactiveFormsModule],
  template: `
    <div class="w-140 max-w-[92vw] overflow-hidden rounded-(--r-lg) bg-surface">
      <div class="cls-stripe h-1">
        <span class="blue"></span><span class="green"></span><span class="ochre"></span
        ><span class="ink"></span>
      </div>
      <div class="px-7 pb-6 pt-6.5">
        <div class="eyebrow mb-1.5">MAPPING · 出貨別名 → 標準品項</div>
        <h2 class="display-title mapping-dialog-title">新增出貨配對</h2>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <datalist id="mapping-product-names">
            @for (name of productNames; track name) {
              <option [value]="name"></option>
            }
          </datalist>
          <datalist id="mapping-product-styles">
            @for (style of productStyles; track style) {
              <option [value]="style"></option>
            }
          </datalist>

          <div class="grid-2 gap-6">
            <label>
              <span class="label">出貨商品名稱 *</span>
              <input
                formControlName="sourceProductName"
                list="mapping-product-names"
                type="text"
                placeholder="匯入出貨顯示的商品名稱"
              />
            </label>

            <label>
              <span class="label">出貨商品款式</span>
              <input
                formControlName="sourceProductStyle"
                list="mapping-product-styles"
                type="text"
                placeholder="可空白"
              />
            </label>
          </div>

          @if (unmatchedSources.length > 0) {
            <div class="mb-0.5 mt-3">
              <div class="eyebrow mb-2">待配對出貨</div>
              <div class="flex max-h-30 flex-wrap gap-1.5 overflow-auto">
                @for (source of unmatchedSources; track source.key) {
                  <button
                    type="button"
                    class="btn btn-sm text-[11px]"
                    (click)="prefillSource(source)"
                  >
                    {{ source.productName }} / {{ source.productStyle || '空白' }}
                  </button>
                }
              </div>
            </div>
          }

          <div class="divider-ornament mb-3 mt-4.5">
            <span>扣庫目標 · TARGETS</span>
          </div>

          <div formArrayName="items">
            @for (group of itemsArray.controls; track $index; let i = $index) {
              <div
                [formGroupName]="i"
                class="grid-3 mb-2.5 items-end gap-4"
              >
                <label>
                  <span class="label">標準商品名稱 *</span>
                  <input
                    formControlName="productName"
                    list="mapping-product-names"
                    type="text"
                    placeholder="進貨品項名稱"
                  />
                </label>
                <label>
                  <span class="label">標準商品款式 *</span>
                  <input
                    formControlName="productStyle"
                    list="mapping-product-styles"
                    type="text"
                    placeholder="進貨品項款式"
                  />
                </label>
                <div class="flex items-end gap-1.5">
                  <label class="flex-1">
                    <span class="label">倍率 *</span>
                    <input formControlName="quantity" type="number" min="1" step="1" />
                  </label>
                  @if (itemsArray.length > 1) {
                    <button type="button" class="btn btn-ghost btn-icon" (click)="removeItem(i)">
                      <span class="mat-icon sm">close</span>
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <button
            type="button"
            class="btn btn-ghost btn-sm dashed-action"
            (click)="addItem()"
          >
            <span class="mat-icon sm">add</span>新增扣庫目標
          </button>

          <div class="mt-5 flex justify-end gap-2 border-t border-outline pt-4">
            <button type="button" class="btn btn-ghost" (click)="dialogRef.close(null)">
              取消
            </button>
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid">
              建立配對
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class MappingDialog {
  readonly dialogRef = inject(MatDialogRef<MappingDialog>);
  readonly data = inject<MappingDialogData>(MAT_DIALOG_DATA);
  readonly #fb = inject(FormBuilder);

  readonly productNames = [
    ...new Set(this.data.inventoryItems.map((item) => item.productName)),
  ].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  readonly productStyles = [
    ...new Set(this.data.inventoryItems.map((item) => item.productStyle)),
  ].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  readonly unmatchedSources = this.#uniqueUnmatchedSources();

  readonly form = this.#fb.group({
    sourceProductName: [this.data.prefillSource?.productName ?? '', Validators.required],
    sourceProductStyle: [this.data.prefillSource?.productStyle ?? ''],
    items: this.#fb.array([this.#createItem()]),
  });

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  addItem(): void {
    this.itemsArray.push(this.#createItem());
  }

  removeItem(index: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  prefillSource(source: ProductKey): void {
    this.form.patchValue({
      sourceProductName: source.productName,
      sourceProductStyle: source.productStyle,
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const mapping: ProductAliasMapping = {
      id: nanoid(12),
      sourceProductName: value.sourceProductName!.trim(),
      sourceProductStyle: (value.sourceProductStyle ?? '').trim(),
      items: (value.items ?? []).map((item) => ({
        productName: item.productName!.trim(),
        productStyle: item.productStyle!.trim(),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      })),
      updatedAt: new Date().toISOString(),
    };

    this.dialogRef.close(mapping);
  }

  #createItem() {
    return this.#fb.group({
      productName: ['', Validators.required],
      productStyle: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }

  #uniqueUnmatchedSources(): Array<ProductKey & { key: string }> {
    const seen = new Set<string>();
    const result: Array<ProductKey & { key: string }> = [];

    for (const item of this.data.unmatchedOutbounds) {
      const key = `${item.productName}\u0000${item.productStyle}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({
        key,
        productName: item.productName,
        productStyle: item.productStyle,
      });
    }

    return result;
  }
}
