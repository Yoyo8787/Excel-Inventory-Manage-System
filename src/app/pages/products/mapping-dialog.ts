import { Component, inject } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { nanoid } from 'nanoid';

import type { PlatformProductMapping, PlatformType, Product, UnmatchedProduct } from '../../core/models';
import { PlatFormTypes } from '../../core/models';

export interface MappingDialogData {
  products: Product[];
  unmatchedProducts: UnmatchedProduct[];
  prefillProduct?: Product;
  prefillPlatform?: PlatformType;
  prefillPlatformProductName?: string;
}

@Component({
  selector: 'app-mapping-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div style="width:560px; max-width:92vw; background:var(--surface); border-radius:var(--r-lg); overflow:hidden;">
      <div class="cls-stripe" style="height:5px;">
        <span class="red"></span><span class="ochre"></span><span class="green"></span>
        <span class="blue"></span><span class="ink"></span>
      </div>
      <div style="padding:28px 32px 24px; max-height:80vh; overflow-y:auto;">
        <div class="eyebrow" style="margin-bottom:6px;">MAPPING · PLATFORM → PRODUCT</div>
        <h2 class="display-title" style="font-size:22px; margin:0 0 20px;">新增平台配對</h2>

        <form [formGroup]="form">
          <!-- 平台 -->
          <div style="display:flex; gap:10px; margin-bottom:12px;">
            @for (p of platforms; track p) {
              <button
                type="button"
                class="btn btn-sm"
                [style.background]="form.value.platform === p ? 'var(--mint-600)' : ''"
                [style.color]="form.value.platform === p ? '#fff' : ''"
                [style.borderColor]="form.value.platform === p ? 'var(--mint-600)' : ''"
                (click)="form.get('platform')!.setValue(p)"
              >{{ p }}</button>
            }
          </div>

          <!-- 平台商品名稱 -->
          <label class="field" style="margin-bottom:8px;">
            <span class="label">平台商品名稱 *</span>
            <input formControlName="platformProductName" type="text" placeholder="輸入平台上顯示的商品名稱">
          </label>

          <!-- 未配對建議 -->
          @if (unmatchedSuggestions.length > 0) {
            <div style="margin-bottom:14px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
              <span class="mono" style="font-size:11px; color:var(--ink-muted);">待配對建議：</span>
              @for (s of unmatchedSuggestions; track s) {
                <button
                  type="button"
                  class="tag"
                  style="cursor:pointer;"
                  [style.background]="form.value.platformProductName === s ? 'var(--mint-50)' : ''"
                  [style.borderColor]="form.value.platformProductName === s ? 'var(--mint-300)' : ''"
                  (click)="selectSuggestion(s)"
                >{{ s }}</button>
              }
            </div>
          }

          <!-- 對應實際貨物 -->
          <div class="divider-ornament" style="margin:14px 0 12px;">
            <span class="serif" style="font-size:13px;">⇵ 對應實際貨物</span>
          </div>
          <div class="mono" style="font-size:11px; color:var(--ink-muted); margin-bottom:10px;">
            一個平台商品可對應多個實際貨物，每項可設定各自的消耗數量
          </div>

          <div formArrayName="items" style="display:flex; flex-direction:column; gap:8px; margin-bottom:10px;">
            @for (ctrl of itemControls; track $index; let i = $index) {
              <div [formGroupName]="i" style="display:flex; gap:8px; align-items:flex-end;">
                <label class="field" style="flex:1;">
                  <span class="label">商品 *</span>
                  <select formControlName="productId">
                    <option value="">—— 選擇商品 ——</option>
                    @for (p of data.products; track p.id) {
                      <option [value]="p.id">{{ p.name }}{{ p.sku ? ' (' + p.sku + ')' : '' }}</option>
                    }
                  </select>
                </label>
                <label class="field mono" style="width:90px; flex-shrink:0;">
                  <span class="label">數量 *</span>
                  <input formControlName="quantity" type="number" min="1" placeholder="1">
                </label>
                @if (itemControls.length > 1) {
                  <button
                    class="btn btn-ghost btn-icon"
                    type="button"
                    (click)="removeItem(i)"
                    style="margin-bottom:2px; flex-shrink:0;"
                    title="移除此行"
                  >
                    <span class="mat-icon sm">close</span>
                  </button>
                }
              </div>
            }
          </div>

          <button
            class="btn btn-ghost"
            type="button"
            (click)="addItem()"
            style="width:100%; justify-content:center; border-style:dashed;"
          >
            <span class="mat-icon sm">add</span>新增貨物行
          </button>

          @if (data.products.length === 0) {
            <div style="margin-top:8px; padding:8px 12px; background:var(--warn-soft); border-radius:var(--r-sm); border:1px solid #ebd4b6;">
              <span class="mono" style="font-size:11px; color:var(--warn);">尚無商品資料，請先至商品清單新增實際貨物</span>
            </div>
          }
        </form>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px; border-top:1px solid var(--hairline); padding-top:16px;">
          <button class="btn" type="button" (click)="cancel()">取消</button>
          <button
            class="btn btn-primary"
            type="button"
            (click)="submit()"
            [disabled]="form.invalid"
          >
            <span class="mat-icon sm">link</span>儲存配對
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MappingDialog {
  readonly #fb = inject(FormBuilder);
  readonly #dialogRef = inject(MatDialogRef<MappingDialog>);
  readonly data: MappingDialogData = inject(MAT_DIALOG_DATA);

  readonly platforms = Object.values(PlatFormTypes);

  readonly form = this.#fb.group({
    platform: [this.data.prefillPlatform ?? PlatFormTypes.A, Validators.required],
    platformProductName: [this.data.prefillPlatformProductName ?? '', Validators.required],
    items: this.#fb.array([]),
  });

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get itemControls(): AbstractControl[] {
    return this.itemsArray.controls;
  }

  constructor() {
    this.itemsArray.push(this.#createItem(this.data.prefillProduct?.id));
  }

  #createItem(productId?: string) {
    return this.#fb.group({
      productId: [productId ?? '', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }

  addItem(): void {
    this.itemsArray.push(this.#createItem());
  }

  removeItem(idx: number): void {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(idx);
    }
  }

  selectSuggestion(name: string): void {
    this.form.get('platformProductName')!.setValue(name);
  }

  get unmatchedSuggestions(): string[] {
    const platform = this.form.value.platform;
    return [...new Set(
      this.data.unmatchedProducts
        .filter(u => u.platform === platform)
        .map(u => u.platformProductName)
    )];
  }

  submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const mapping: PlatformProductMapping = {
      id: nanoid(),
      platform: v.platform as PlatformType,
      platformProductName: v.platformProductName!,
      items: (v.items as { productId: string; quantity: number }[]).map(i => ({
        productId: i.productId,
        quantity: +i.quantity,
      })),
      updatedAt: new Date().toISOString(),
    };
    this.#dialogRef.close(mapping);
  }

  cancel(): void {
    this.#dialogRef.close(null);
  }
}
