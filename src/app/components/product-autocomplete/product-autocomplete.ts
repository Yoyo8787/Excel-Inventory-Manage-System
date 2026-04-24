import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import type { Product } from '../../core/models';

@Component({
  selector: 'app-product-autocomplete',
  standalone: true,
  imports: [MatAutocompleteModule],
  template: `
    <input
      class="inline-input product-autocomplete-input"
      type="text"
      [placeholder]="placeholder"
      [value]="query()"
      [matAutocomplete]="auto"
      (input)="handleInput($any($event.target).value)"
      (blur)="handleBlur()"
    />

    <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selectProduct($event.option.value)">
      @for (product of filteredProducts(); track product.id) {
        <mat-option [value]="product.id">
          <div class="product-option">
            <span class="product-option-name">{{ product.name }}</span>
            <span class="product-option-id mono">{{ product.id }}</span>
          </div>
        </mat-option>
      }
    </mat-autocomplete>
  `,
})
export class ProductAutocompleteComponent {
  readonly #products = signal<Product[]>([]);
  readonly #productId = signal<string | null>(null);
  readonly query = signal('');

  #isEditing = false;

  @Input() placeholder = '選擇商品';

  @Input()
  set products(value: Product[] | null | undefined) {
    this.#products.set(value ?? []);
    if (!this.#isEditing) {
      this.#syncQueryToProduct(this.#productId());
    }
  }

  @Input()
  set productId(value: string | null | undefined) {
    this.#productId.set(value ?? null);
    if (!this.#isEditing) {
      this.#syncQueryToProduct(value ?? null);
    }
  }

  @Output() readonly productIdChange = new EventEmitter<string | null>();

  readonly filteredProducts = computed(() => {
    const query = this.#normalize(this.query());
    const products = this.#products();

    if (!query) {
      return products.slice(0, 20);
    }

    return products
      .filter(product =>
        this.#normalize(product.name).includes(query) ||
        this.#normalize(product.id).includes(query)
      )
      .slice(0, 20);
  });

  handleInput(value: string): void {
    this.#isEditing = true;
    this.query.set(value);

    const product = this.#findExactProduct(value);
    this.productIdChange.emit(product?.id ?? null);
  }

  handleBlur(): void {
    this.#isEditing = false;
    const product = this.#findExactProduct(this.query());

    if (product) {
      this.#productId.set(product.id);
      this.#syncQueryToProduct(product.id);
      this.productIdChange.emit(product.id);
      return;
    }

    this.#productId.set(null);
    this.query.set('');
    this.productIdChange.emit(null);
  }

  selectProduct(productId: string): void {
    this.#isEditing = false;
    this.#productId.set(productId);
    this.#syncQueryToProduct(productId);
    this.productIdChange.emit(productId);
  }

  #syncQueryToProduct(productId: string | null): void {
    const product = productId ? this.#products().find(p => p.id === productId) : null;
    this.query.set(product?.name ?? '');
  }

  #findExactProduct(value: string): Product | undefined {
    const normalized = this.#normalize(value);
    if (!normalized) return undefined;

    return this.#products().find(product =>
      this.#normalize(product.name) === normalized ||
      this.#normalize(product.id) === normalized
    );
  }

  #normalize(value: string): string {
    return value.trim().toLowerCase();
  }
}
