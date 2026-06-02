import { Injectable } from '@angular/core';
import dayjs from 'dayjs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

import {
  AppState,
  ImportErrorRow,
  MappingItem,
  ProductAliasMapping,
  createEmptyAppState,
} from '../models';

type SheetRow = Record<string, unknown>;

const SYSTEM_SHEETS = {
  meta: 'meta',
  inbounds: 'inbounds',
  outbounds: 'outbounds',
  mappings: 'mappings',
} as const;

@Injectable({ providedIn: 'root' })
export class ExcelIoService {
  async loadSystemWorkbook(file: File): Promise<AppState> {
    const buffer = await file.arrayBuffer();
    return this.parseSystemWorkbook(buffer);
  }

  parseSystemWorkbook(buffer: ArrayBuffer): AppState {
    const workbook = XLSX.read(buffer, { type: 'array' });

    const metaRows = this.#readRows(workbook, SYSTEM_SHEETS.meta);
    const inboundRows = this.#readRows(workbook, SYSTEM_SHEETS.inbounds);
    const outboundRows = this.#readRows(workbook, SYSTEM_SHEETS.outbounds);
    const mappingRows = this.#readRows(workbook, SYSTEM_SHEETS.mappings);
    const base = createEmptyAppState();

    return {
      ...base,
      meta: this.#parseMeta(metaRows),
      settings: this.#parseSettings(metaRows),
      inbounds: this.#parseInbounds(inboundRows),
      outbounds: this.#parseOutbounds(outboundRows),
      mappings: this.#parseMappings(mappingRows),
    };
  }

  exportSystemWorkbook(state: AppState): Blob {
    const workbook = this.#buildSystemWorkbook(state);
    const data = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    return new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  downloadSystemWorkbook(state: AppState, filename?: string): void {
    const safeName = this.#safeName(state.meta.datasetName || 'inventory');
    const defaultFileName = `${safeName}-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
    const blob = this.exportSystemWorkbook(state);

    saveAs(blob, filename ?? defaultFileName);
  }

  downloadImportErrors(errors: ImportErrorRow[], filename?: string): void {
    const workbook = XLSX.utils.book_new();
    const rows = errors.map((error) => ({
      rowNumber: error.rowNumber,
      type: error.type,
      field: error.field,
      reason: error.reason,
      raw: JSON.stringify(error.raw),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'import_errors');

    const data = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    saveAs(
      new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename ?? `import-errors-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`,
    );
  }

  #buildSystemWorkbook(state: AppState): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();

    const metaRows = [
      {
        datasetName: state.meta.datasetName,
        loadedAt: state.meta.loadedAt ?? '',
        lastSavedAt: state.meta.lastSavedAt ?? '',
        defaultLowStockThreshold: state.settings.defaultLowStockThreshold,
      },
    ];

    const inboundRows = state.inbounds.map((record) => ({
      id: record.id,
      productName: record.productName,
      productStyle: record.productStyle,
      quantity: record.quantity,
      importedAt: record.importedAt,
    }));

    const outboundRows = state.outbounds.map((record) => ({
      id: record.id,
      productName: record.productName,
      productStyle: record.productStyle,
      quantity: record.quantity,
      recipientName: record.recipientName,
      importedAt: record.importedAt,
    }));

    this.#appendSheet(workbook, SYSTEM_SHEETS.meta, metaRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.inbounds, inboundRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.outbounds, outboundRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.mappings, this.#flattenMappings(state.mappings));

    return workbook;
  }

  #appendSheet(workbook: XLSX.WorkBook, sheetName: string, rows: SheetRow[]): void {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  #flattenMappings(mappings: ProductAliasMapping[]): SheetRow[] {
    const rows: SheetRow[] = [];

    for (const mapping of mappings) {
      if (mapping.items.length === 0) {
        rows.push({
          id: mapping.id,
          sourceProductName: mapping.sourceProductName,
          sourceProductStyle: mapping.sourceProductStyle,
          targetProductName: '',
          targetProductStyle: '',
          quantity: '',
          updatedAt: mapping.updatedAt,
        });
        continue;
      }

      for (const item of mapping.items) {
        rows.push({
          id: mapping.id,
          sourceProductName: mapping.sourceProductName,
          sourceProductStyle: mapping.sourceProductStyle,
          targetProductName: item.productName,
          targetProductStyle: item.productStyle,
          quantity: item.quantity,
          updatedAt: mapping.updatedAt,
        });
      }
    }

    return rows;
  }

  #readRows(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return [];
    }

    return XLSX.utils.sheet_to_json<SheetRow>(worksheet, {
      defval: '',
      raw: true,
    });
  }

  #parseMeta(rows: SheetRow[]): AppState['meta'] {
    const first = rows[0] ?? {};
    const datasetName = this.#toOptionalString(first['datasetName']) ?? 'Imported dataset';

    return {
      datasetName,
      loadedAt: this.#toIsoOrNull(first['loadedAt']),
      lastSavedAt: this.#toIsoOrNull(first['lastSavedAt']),
    };
  }

  #parseSettings(rows: SheetRow[]): AppState['settings'] {
    const base = createEmptyAppState().settings;
    const first = rows[0] ?? {};
    const defaultLowStockThreshold = this.#toNumberOrDefault(
      first['defaultLowStockThreshold'],
      base.defaultLowStockThreshold,
    );

    return {
      defaultLowStockThreshold: Number.isFinite(defaultLowStockThreshold)
        ? Math.max(0, Math.floor(defaultLowStockThreshold))
        : base.defaultLowStockThreshold,
    };
  }

  #parseInbounds(rows: SheetRow[]): AppState['inbounds'] {
    const records: AppState['inbounds'] = [];

    for (const row of rows) {
      const id = this.#toOptionalString(row['id']);
      const productName = this.#toOptionalString(row['productName']);
      const productStyle = this.#toOptionalString(row['productStyle']);
      const quantity = this.#toPositiveInteger(row['quantity']);
      const importedAt = this.#toIsoOrNull(row['importedAt']);

      if (!id || !productName || !productStyle || quantity === null || !importedAt) {
        continue;
      }

      records.push({
        id,
        productName,
        productStyle,
        quantity,
        importedAt,
      });
    }

    return records;
  }

  #parseOutbounds(rows: SheetRow[]): AppState['outbounds'] {
    const records: AppState['outbounds'] = [];

    for (const row of rows) {
      const id = this.#toOptionalString(row['id']);
      const productName = this.#toOptionalString(row['productName']);
      const productStyle = this.#toString(row['productStyle']);
      const quantity = this.#toPositiveInteger(row['quantity']);
      const recipientName = this.#toOptionalString(row['recipientName']);
      const importedAt = this.#toIsoOrNull(row['importedAt']);

      if (!id || !productName || quantity === null || !recipientName || !importedAt) {
        continue;
      }

      records.push({
        id,
        productName,
        productStyle,
        quantity,
        recipientName,
        importedAt,
      });
    }

    return records;
  }

  #parseMappings(rows: SheetRow[]): ProductAliasMapping[] {
    const map = new Map<string, ProductAliasMapping>();

    for (const row of rows) {
      const id = this.#toOptionalString(row['id']);
      const sourceProductName = this.#toOptionalString(row['sourceProductName']);
      const sourceProductStyle = this.#toString(row['sourceProductStyle']);

      if (!id || !sourceProductName) {
        continue;
      }

      const existing = map.get(id);

      if (!existing) {
        map.set(id, {
          id,
          sourceProductName,
          sourceProductStyle,
          items: this.#parseMappingItem(row),
          updatedAt: this.#toIsoOrNull(row['updatedAt']) ?? new Date().toISOString(),
        });
        continue;
      }

      existing.items.push(...this.#parseMappingItem(row));
    }

    return [...map.values()].map((mapping) => ({
      ...mapping,
      items: this.#dedupeMappingItems(mapping.items),
    }));
  }

  #parseMappingItem(row: SheetRow): MappingItem[] {
    const productName = this.#toOptionalString(row['targetProductName']);
    const productStyle = this.#toOptionalString(row['targetProductStyle']);
    const quantity = this.#toPositiveInteger(row['quantity']);

    if (!productName || !productStyle || quantity === null) {
      return [];
    }

    return [
      {
        productName,
        productStyle,
        quantity,
      },
    ];
  }

  #dedupeMappingItems(items: MappingItem[]): MappingItem[] {
    const map = new Map<string, MappingItem>();

    for (const item of items) {
      const key = this.#recordKey(item.productName, item.productStyle);
      const current = map.get(key);
      map.set(key, {
        productName: item.productName,
        productStyle: item.productStyle,
        quantity: (current?.quantity ?? 0) + item.quantity,
      });
    }

    return [...map.values()];
  }

  #toOptionalString(value: unknown): string | undefined {
    const normalized = this.#toString(value);
    return normalized.length > 0 ? normalized : undefined;
  }

  #toString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  #toNumberOrDefault(value: unknown, fallback: number): number {
    const parsed = this.#toOptionalNumber(value);
    return parsed ?? fallback;
  }

  #toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const parsed = Number(String(value).trim().replaceAll(',', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  #toPositiveInteger(value: unknown): number | null {
    const parsed = this.#toOptionalNumber(value);

    if (parsed === null || parsed <= 0) {
      return null;
    }

    const quantity = Math.floor(parsed);
    return quantity > 0 ? quantity : null;
  }

  #toIsoOrNull(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const date = new Date(
          Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S)),
        );
        return date.toISOString();
      }
    }

    const parsed = dayjs(String(value).trim());
    return parsed.isValid() ? parsed.toISOString() : null;
  }

  #recordKey(productName: string, productStyle: string): string {
    return `${productName.trim()}\u0000${productStyle.trim()}`;
  }

  #safeName(value: string): string {
    const replaced = value.trim().replace(/[^a-zA-Z0-9-_]+/g, '-');
    return replaced.length > 0 ? replaced : 'inventory';
  }
}
