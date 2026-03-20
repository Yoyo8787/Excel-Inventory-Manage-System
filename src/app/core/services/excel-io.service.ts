import { Injectable } from '@angular/core';
import dayjs from 'dayjs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

import {
  AppState,
  ImportErrorRow,
  MappingItem,
  Order,
  OrderBusinessStatus,
  OrderLine,
  PlatformProductMapping,
  PlatformType,
  Product,
  createEmptyAppState,
  PlatFormTypes,
} from '../models';

type SheetRow = Record<string, unknown>;

const SYSTEM_SHEETS = {
  meta: 'meta',
  products: 'products',
  mappings: 'mappings',
  orders: 'orders',
  orderLines: 'order_lines',
  inbounds: 'inbounds',
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
    const productRows = this.#readRows(workbook, SYSTEM_SHEETS.products);
    const mappingRows = this.#readRows(workbook, SYSTEM_SHEETS.mappings);
    const orderRows = this.#readRows(workbook, SYSTEM_SHEETS.orders);
    const orderLineRows = this.#readRows(workbook, SYSTEM_SHEETS.orderLines);
    const inboundRows = this.#readRows(workbook, SYSTEM_SHEETS.inbounds);

    const base = createEmptyAppState();

    return {
      ...base,
      meta: this.#parseMeta(metaRows),
      products: this.#parseProducts(productRows),
      mappings: this.#parseMappings(mappingRows),
      orders: this.#parseOrders(orderRows, orderLineRows),
      inbounds: this.#parseInbounds(inboundRows),
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
      platform: error.platform,
      orderNo: error.orderNo ?? '',
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
      },
    ];

    const productRows = state.products.map((product) => ({
      id: product.id,
      sku: product.sku ?? '',
      name: product.name,
      lowStockThreshold: product.lowStockThreshold,
      note: product.note ?? '',
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    const mappingRows = this.#flattenMappings(state.mappings);

    const orderRows = state.orders.map((order) => ({
      id: order.id,
      platform: order.platform,
      orderNo: order.orderNo,
      orderDate: order.orderDate,
      statusRaw: order.statusRaw,
      status: order.status,
      customerName: order.customerName ?? '',
      customerPhone: order.customerPhone ?? '',
      amountTotal: order.amountTotal ?? '',
      address: order.address ?? '',
      note: order.note ?? '',
      importedAt: order.importedAt,
    }));

    const orderLineRows = this.#flattenOrderLines(state.orders);

    const inboundRows = state.inbounds.map((inbound) => ({
      id: inbound.id,
      productId: inbound.productId,
      quantity: inbound.quantity,
      inboundDate: inbound.inboundDate,
      note: inbound.note ?? '',
      createdAt: inbound.createdAt,
    }));

    this.#appendSheet(workbook, SYSTEM_SHEETS.meta, metaRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.products, productRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.mappings, mappingRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.orders, orderRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.orderLines, orderLineRows);
    this.#appendSheet(workbook, SYSTEM_SHEETS.inbounds, inboundRows);

    return workbook;
  }

  #appendSheet(workbook: XLSX.WorkBook, sheetName: string, rows: SheetRow[]): void {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  #flattenMappings(mappings: PlatformProductMapping[]): SheetRow[] {
    const rows: SheetRow[] = [];

    for (const mapping of mappings) {
      if (mapping.items.length === 0) {
        rows.push({
          id: mapping.id,
          platform: mapping.platform,
          platformProductName: mapping.platformProductName,
          productId: '',
          quantity: '',
          updatedAt: mapping.updatedAt,
        });
        continue;
      }

      for (const item of mapping.items) {
        rows.push({
          id: mapping.id,
          platform: mapping.platform,
          platformProductName: mapping.platformProductName,
          productId: item.productId,
          quantity: item.quantity,
          updatedAt: mapping.updatedAt,
        });
      }
    }

    return rows;
  }

  #flattenOrderLines(orders: Order[]): SheetRow[] {
    const rows: SheetRow[] = [];

    for (const order of orders) {
      for (const line of order.lines) {
        rows.push({
          orderId: order.id,
          lineId: line.lineId,
          platformProductName: line.platformProductName,
          unitPrice: line.unitPrice ?? '',
          quantity: line.quantity,
          subtotal: line.subtotal ?? '',
          mappedItemsJson: JSON.stringify(line.mappedItems),
          isMatched: line.isMatched ? 1 : 0,
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

  #parseProducts(rows: SheetRow[]): Product[] {
    const items: Product[] = [];

    for (const row of rows) {
      const id = this.#toOptionalString(row['id']);
      const name = this.#toOptionalString(row['name']);

      if (!id || !name) {
        continue;
      }

      const createdAt = this.#toIsoOrNull(row['createdAt']) ?? new Date().toISOString();
      const updatedAt = this.#toIsoOrNull(row['updatedAt']) ?? createdAt;

      items.push({
        id,
        sku: this.#toOptionalString(row['sku']),
        name,
        lowStockThreshold: this.#toNumberOrDefault(row['lowStockThreshold'], 0),
        note: this.#toOptionalString(row['note']),
        createdAt,
        updatedAt,
      });
    }

    return items;
  }

  #parseMappings(rows: SheetRow[]): PlatformProductMapping[] {
    const map = new Map<string, PlatformProductMapping>();

    for (const row of rows) {
      const id = this.#toOptionalString(row['id']);
      const platform = this.#toPlatform(row['platform']);
      const platformProductName = this.#toOptionalString(row['platformProductName']);

      if (!id || !platform || !platformProductName) {
        continue;
      }

      const key = id;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          id,
          platform,
          platformProductName,
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
    const productId = this.#toOptionalString(row['productId']);
    const quantity = this.#toOptionalNumber(row['quantity']);

    if (!productId || quantity === null) {
      return [];
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return [];
    }

    return [
      {
        productId,
        quantity,
      },
    ];
  }

  #dedupeMappingItems(items: MappingItem[]): MappingItem[] {
    const map = new Map<string, number>();

    for (const item of items) {
      const next = (map.get(item.productId) ?? 0) + item.quantity;
      map.set(item.productId, next);
    }

    return [...map.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }

  #parseOrders(orderRows: SheetRow[], orderLineRows: SheetRow[]): Order[] {
    const orderMap = new Map<string, Order>();

    for (const row of orderRows) {
      const id = this.#toOptionalString(row['id']);
      const platform = this.#toPlatform(row['platform']);
      const orderNo = this.#toOptionalString(row['orderNo']);
      const orderDate = this.#toIsoOrNull(row['orderDate']);
      const statusRaw = this.#toOptionalString(row['statusRaw']);
      const status = this.#toOrderStatus(row['status']);
      const importedAt = this.#toIsoOrNull(row['importedAt']);

      if (!id || !platform || !orderNo || !orderDate || !statusRaw || !status || !importedAt) {
        continue;
      }

      orderMap.set(id, {
        id,
        platform,
        orderNo,
        orderDate,
        statusRaw,
        status,
        customerName: this.#toOptionalString(row['customerName']),
        customerPhone: this.#toOptionalString(row['customerPhone']),
        amountTotal: this.#toOptionalNumber(row['amountTotal']) ?? undefined,
        address: this.#toOptionalString(row['address']),
        note: this.#toOptionalString(row['note']),
        lines: [],
        importedAt,
      });
    }

    for (const row of orderLineRows) {
      const orderId = this.#toOptionalString(row['orderId']);
      const line = this.#parseOrderLine(row);

      if (!orderId || !line) {
        continue;
      }

      const order = orderMap.get(orderId);
      if (!order) {
        continue;
      }

      order.lines.push(line);
    }

    return [...orderMap.values()];
  }

  #parseOrderLine(row: SheetRow): OrderLine | null {
    const lineId = this.#toOptionalString(row['lineId']);
    const platformProductName = this.#toOptionalString(row['platformProductName']);
    const quantity = this.#toOptionalNumber(row['quantity']);

    if (!lineId || !platformProductName || quantity === null || quantity <= 0) {
      return null;
    }

    const mappedItems = this.#parseMappedItems(row['mappedItemsJson']);

    return {
      lineId,
      platformProductName,
      unitPrice: this.#toOptionalNumber(row['unitPrice']) ?? undefined,
      quantity,
      subtotal: this.#toOptionalNumber(row['subtotal']) ?? undefined,
      mappedItems,
      isMatched: this.#toBoolean(row['isMatched']),
    };
  }

  #parseMappedItems(value: unknown): MappingItem[] {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }

          const objectItem = item as Record<string, unknown>;
          const productId = this.#toOptionalString(objectItem['productId']);
          const quantity = this.#toOptionalNumber(objectItem['quantity']);

          if (!productId || quantity === null || quantity <= 0) {
            return null;
          }

          return {
            productId,
            quantity,
          } satisfies MappingItem;
        })
        .filter((item): item is MappingItem => item !== null);
    } catch {
      return [];
    }
  }

  #parseInbounds(rows: SheetRow[]): AppState['inbounds'] {
    const items: AppState['inbounds'] = [];

    for (const row of rows) {
      const id = this.#toOptionalString(row['id']);
      const productId = this.#toOptionalString(row['productId']);
      const quantity = this.#toOptionalNumber(row['quantity']);
      const inboundDate = this.#toIsoOrNull(row['inboundDate']);

      if (!id || !productId || quantity === null || !inboundDate) {
        continue;
      }

      items.push({
        id,
        productId,
        quantity,
        inboundDate,
        note: this.#toOptionalString(row['note']),
        createdAt: this.#toIsoOrNull(row['createdAt']) ?? new Date().toISOString(),
      });
    }

    return items;
  }

  #toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
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

  #toPlatform(value: unknown): PlatformType | null {
    const raw = this.#toOptionalString(value)?.toUpperCase();

    if (raw === PlatFormTypes.A || raw === PlatFormTypes.B || raw === PlatFormTypes.C) {
      return raw;
    }

    return null;
  }

  #toOrderStatus(value: unknown): OrderBusinessStatus | null {
    const raw = this.#toOptionalString(value);

    switch (raw) {
      case 'normal':
      case 'shipped':
      case 'cancelled':
      case 'returned':
      case 'resend':
      case 'exchange_reserved':
        return raw;
      default:
        return null;
    }
  }

  #toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    const normalized = this.#toOptionalString(value)?.toLowerCase();

    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  #safeName(value: string): string {
    const replaced = value.trim().replace(/[^a-zA-Z0-9-_]+/g, '-');
    return replaced.length > 0 ? replaced : 'inventory';
  }
}
