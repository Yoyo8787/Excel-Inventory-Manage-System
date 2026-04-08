import { Injectable } from '@angular/core';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { nanoid } from 'nanoid';
import * as XLSX from 'xlsx';

import {
  AppState,
  DuplicateOrderPolicy,
  ImportErrorRow,
  ImportJobResult,
  MappingItem,
  Order,
  OrderBusinessStatus,
  OrderLine,
  PlatformProductMapping,
  PlatformType,
  PlatFormTypes,
  UnmatchedProduct,
} from '../models';
import {
  NormalizedOrderRowCandidate,
  ValidationService,
  ValidatedOrderRow,
} from './validation.service';

dayjs.extend(customParseFormat);

export interface OrderImportOutput {
  orders: Order[];
  unmatchedProducts: UnmatchedProduct[];
  result: ImportJobResult;
}

interface PlatformHeaderSignature {
  platform: PlatformType;
  minimumUniqueMatches: number;
  uniqueHeaderGroups: string[][];
}

const PLATFORM_HEADER_SIGNATURES: PlatformHeaderSignature[] = [
  {
    platform: PlatFormTypes.A,
    minimumUniqueMatches: 4,
    uniqueHeaderGroups: [
      ['Paid Date'],
      ['付款者姓名'],
      ['付款者電話'],
      ['Customer Note'],
      ['電子信箱'],
      ['付款方式'],
    ],
  },
  {
    platform: PlatFormTypes.B,
    minimumUniqueMatches: 4,
    uniqueHeaderGroups: [
      ['收件人姓名(寄海外請填寫英文)'],
      ['收件人手機'],
      ['收件地址寄海外請填寫英文'],
      ['縣市寄海外請填英文'],
      ['帳單名字'],
      ['帳單電話'],
    ],
  },
  {
    platform: PlatFormTypes.C,
    minimumUniqueMatches: 4,
    uniqueHeaderGroups: [
      ['收件人名稱'],
      ['會員名稱'],
      ['會員手機號碼'],
      ['會員資料備註'],
      ['付款時間'],
      ['出貨時間'],
      ['購買人名稱'],
      ['購買人電話'],
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class OrderImportService {
  constructor(private readonly validationService: ValidationService) {}

  async importFromFile(
    file: File,
    platform: PlatformType,
    currentState: AppState,
    duplicatePolicy: DuplicateOrderPolicy = 'skip',
  ): Promise<OrderImportOutput> {
    const buffer = await file.arrayBuffer();
    return this.importFromBuffer(buffer, platform, currentState, duplicatePolicy);
  }

  importFromBuffer(
    buffer: ArrayBuffer,
    platform: PlatformType,
    currentState: AppState,
    duplicatePolicy: DuplicateOrderPolicy = 'skip',
  ): OrderImportOutput {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return this.#emptyResult([
        {
          rowNumber: 0,
          platform,
          field: 'sheet',
          reason: '找不到任何工作表',
          raw: {},
        },
      ]);
    }

    const sheet = workbook.Sheets[sheetName];
    const headerRow = this.#readHeaderRow(sheet);
    const headerError = this.#validatePlatformHeaders(platform, headerRow);

    if (headerError) {
      return this.#emptyResult([headerError]);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
    });

    const { validRows, errors } = this.#validateRows(platform, rawRows);

    return this.#buildOrders(validRows, errors, currentState, duplicatePolicy);
  }

  #validateRows(
    platform: PlatformType,
    rows: Record<string, unknown>[],
  ): { validRows: ValidatedOrderRow[]; errors: ImportErrorRow[] } {
    const validRows: ValidatedOrderRow[] = [];
    const errors: ImportErrorRow[] = [];

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const candidate = this.#parseRow(platform, rawRow, rowNumber);
      const validationResult = this.validationService.validateOrderImportRow(candidate);

      if (validationResult.success) {
        validRows.push(validationResult.data);
        return;
      }

      errors.push(...validationResult.errors);
    });

    return { validRows, errors };
  }

  #buildOrders(
    validRows: ValidatedOrderRow[],
    errors: ImportErrorRow[],
    currentState: AppState,
    duplicatePolicy: DuplicateOrderPolicy,
  ): OrderImportOutput {
    const groupedByOrder = this.#groupRowsByOrderNo(validRows);
    const existingOrderNos = new Set(currentState.orders.map((order) => order.orderNo));

    const orders: Order[] = [];
    const unmatchedProducts: UnmatchedProduct[] = [];
    let duplicateCount = 0;

    for (const rows of groupedByOrder.values()) {
      const orderNo = rows[0]?.orderNo;
      if (!orderNo) {
        continue;
      }

      if (duplicatePolicy === 'skip' && existingOrderNos.has(orderNo)) {
        duplicateCount += 1;
        continue;
      }

      const order = this.#buildOrder(rows, currentState.mappings);
      orders.push(order);
      existingOrderNos.add(orderNo);

      for (const line of order.lines) {
        if (line.isMatched) {
          continue;
        }

        unmatchedProducts.push({
          platform: order.platform,
          platformProductName: line.platformProductName,
          orderNo: order.orderNo,
          orderLineId: line.lineId,
          quantity: line.quantity,
          detectedAt: order.importedAt,
        });
      }
    }

    return {
      orders,
      unmatchedProducts,
      result: {
        importedCount: orders.length,
        duplicateCount,
        errorCount: errors.length,
        errors,
      },
    };
  }

  #buildOrder(rows: ValidatedOrderRow[], mappings: PlatformProductMapping[]): Order {
    const first = rows[0]!;
    const importedAt = new Date().toISOString();

    const lines: OrderLine[] = rows.map((row) => {
      const mappedItems = this.#findMappedItems(mappings, row.platform, row.productName);

      return {
        lineId: nanoid(12),
        platformProductName: row.productName,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
        subtotal: row.subtotal,
        mappedItems,
        isMatched: mappedItems.length > 0,
      };
    });

    return {
      id: nanoid(12),
      platform: first.platform,
      orderNo: first.orderNo,
      orderDate: first.orderDate,
      statusRaw: first.statusRaw,
      status: first.status,
      customerName: first.customerName,
      customerPhone: first.customerPhone,
      amountTotal: this.#resolveOrderAmount(first, rows),
      address: first.address,
      note: first.note,
      lines,
      importedAt,
    };
  }

  #resolveOrderAmount(first: ValidatedOrderRow, rows: ValidatedOrderRow[]): number | undefined {
    if (typeof first.amountTotal === 'number') {
      return first.amountTotal;
    }

    const subtotalRows = rows.filter((row) => typeof row.subtotal === 'number');
    if (subtotalRows.length === 0) {
      return undefined;
    }

    return subtotalRows.reduce((sum, row) => sum + (row.subtotal ?? 0), 0);
  }

  #findMappedItems(
    mappings: PlatformProductMapping[],
    platform: PlatformType,
    platformProductName: string,
  ): MappingItem[] {
    const normalizedName = platformProductName.trim().toLowerCase();

    const match = mappings.find(
      (mapping) =>
        mapping.platform === platform &&
        mapping.platformProductName.trim().toLowerCase() === normalizedName,
    );

    if (!match || match.items.length === 0) {
      return [];
    }

    return match.items.map((item) => ({ ...item }));
  }

  #groupRowsByOrderNo(rows: ValidatedOrderRow[]): Map<string, ValidatedOrderRow[]> {
    const groups = new Map<string, ValidatedOrderRow[]>();

    for (const row of rows) {
      const list = groups.get(row.orderNo) ?? [];
      list.push(row);
      groups.set(row.orderNo, list);
    }

    return groups;
  }

  #parseRow(
    platform: PlatformType,
    rawRow: Record<string, unknown>,
    rowNumber: number,
  ): NormalizedOrderRowCandidate {
    const fieldLookup = this.#buildFieldLookup(rawRow);

    const rowDate = this.#parseDate(this.#pickValue(fieldLookup, this.#dateAliases(platform)));

    const statusRaw = this.#toText(this.#pickValue(fieldLookup, this.#statusAliases(platform)));

    const parsedQuantity = this.#parseNumber(this.#pickValue(fieldLookup, ['數量', 'quantity']));

    return {
      rowNumber,
      platform,
      orderNo: this.#pickValue(fieldLookup, ['訂單編號']),
      orderDate: rowDate ?? '',
      statusRaw,
      status: this.#normalizeBusinessStatus(statusRaw),
      productName: this.#pickValue(fieldLookup, ['品名', '商品名稱']),
      quantity: parsedQuantity,
      amountTotal: this.#parseNumber(this.#pickValue(fieldLookup, ['金額', '總額', '總計'])),
      unitPrice: this.#parseNumber(this.#pickValue(fieldLookup, ['商品售價', '單價'])),
      subtotal: this.#parseNumber(this.#pickValue(fieldLookup, ['小計'])),
      customerName: this.#pickValue(fieldLookup, this.#customerNameAliases(platform)),
      customerPhone: this.#pickValue(fieldLookup, this.#customerPhoneAliases(platform)),
      address: this.#buildAddress(platform, fieldLookup),
      note: this.#pickValue(fieldLookup, this.#noteAliases(platform)),
      raw: rawRow,
    };
  }

  #buildAddress(platform: PlatformType, fieldLookup: Map<string, unknown>): string | undefined {
    const directAliases =
      platform === PlatFormTypes.A
        ? ['地址']
        : platform === PlatFormTypes.B
          ? ['收件地址寄海外請填寫英文']
          : ['收件地址', '地址'];
    const direct = this.#toText(this.#pickValue(fieldLookup, directAliases));

    if (direct.length > 0) {
      return direct;
    }

    if (platform === PlatFormTypes.A) {
      const city = this.#toText(this.#pickValue(fieldLookup, ['縣市']));
      const district = this.#toText(this.#pickValue(fieldLookup, ['鄉鎮市區']));
      const address = this.#toText(this.#pickValue(fieldLookup, ['地址']));

      const merged = [city, district, address].filter((value) => value.length > 0).join(' ');
      return merged.length > 0 ? merged : undefined;
    }

    if (platform === PlatFormTypes.B) {
      const city = this.#toText(this.#pickValue(fieldLookup, ['縣市', '縣市寄海外請填英文']));
      const district = this.#toText(
        this.#pickValue(fieldLookup, ['鄉鎮市區', '郵遞區號寄海外請填寫英文']),
      );
      const address = this.#toText(this.#pickValue(fieldLookup, ['收件地址寄海外請填寫英文']));

      const merged = [city, district, address].filter((value) => value.length > 0).join(' ');
      return merged.length > 0 ? merged : undefined;
    }

    return undefined;
  }

  #readHeaderRow(sheet: XLSX.WorkSheet): string[] {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    const headerRow = rows.find((row) => row.some((cell) => this.#toText(cell).length > 0)) ?? [];

    return headerRow
      .map((cell) => this.#toText(cell))
      .filter((header) => header.length > 0);
  }

  #buildFieldLookup(rawRow: Record<string, unknown>): Map<string, unknown> {
    const lookup = new Map<string, unknown>();

    for (const [key, value] of Object.entries(rawRow)) {
      lookup.set(this.#normalizeHeader(key), value);
    }

    return lookup;
  }

  #pickValue(fieldLookup: Map<string, unknown>, aliases: string[]): unknown {
    for (const alias of aliases) {
      const value = fieldLookup.get(this.#normalizeHeader(alias));
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  #validatePlatformHeaders(
    selectedPlatform: PlatformType,
    headers: string[],
  ): ImportErrorRow | null {
    const signatureMatches = PLATFORM_HEADER_SIGNATURES.map((signature) => ({
      signature,
      matchedHeaders: signature.uniqueHeaderGroups
        .map((group) => group.find((header) => this.#hasHeader(headers, header)))
        .filter((header): header is string => Boolean(header)),
    }));
    const matchedSignatures = signatureMatches.filter(
      ({ signature, matchedHeaders }) => matchedHeaders.length >= signature.minimumUniqueMatches,
    );
    const selectedMatch = signatureMatches.find(
      ({ signature }) => signature.platform === selectedPlatform,
    );

    if (matchedSignatures.length > 1) {
      const platforms = matchedSignatures.map(({ signature }) => signature.platform).join('、');

      return this.#createHeaderError(
        selectedPlatform,
        headers,
        `標題列同時命中多個平台格式（${platforms}），請確認匯入檔案沒有混用不同平台欄位。`,
      );
    }

    if (
      matchedSignatures.length === 1 &&
      matchedSignatures[0]!.signature.platform !== selectedPlatform
    ) {
      const detectedPlatform = matchedSignatures[0]!.signature.platform;

      return this.#createHeaderError(
        selectedPlatform,
        headers,
        `目前選擇的是「${selectedPlatform}」，但這份檔案的欄位格式判定為「${detectedPlatform}」。請切換正確平台後再匯入。`,
      );
    }

    if (selectedMatch && matchedSignatures.length === 1) {
      return null;
    }

    const missingHeaders = this.#missingSignatureHeaders(selectedPlatform, headers);
    const expectedHeaders = missingHeaders.length > 0 ? missingHeaders : this.#expectedSignatureHeaders(selectedPlatform);

    return this.#createHeaderError(
      selectedPlatform,
      headers,
      `無法辨識為「${selectedPlatform}」匯入格式，缺少關鍵欄位：${expectedHeaders.join('、')}。`,
    );
  }

  #createHeaderError(
    platform: PlatformType,
    headers: string[],
    reason: string,
  ): ImportErrorRow {
    return {
      rowNumber: 1,
      platform,
      field: 'header',
      reason,
      raw: {
        headers: headers.join(' | '),
      },
    };
  }

  #missingSignatureHeaders(platform: PlatformType, headers: string[]): string[] {
    const signature = PLATFORM_HEADER_SIGNATURES.find((item) => item.platform === platform);

    if (!signature) {
      return [];
    }

    return signature.uniqueHeaderGroups
      .filter((group) => !group.some((header) => this.#hasHeader(headers, header)))
      .map((group) => group[0]!)
      .slice(0, 4);
  }

  #expectedSignatureHeaders(platform: PlatformType): string[] {
    const signature = PLATFORM_HEADER_SIGNATURES.find((item) => item.platform === platform);

    if (!signature) {
      return [];
    }

    return signature.uniqueHeaderGroups.map((group) => group[0]!).slice(0, 4);
  }

  #hasHeader(headers: string[], target: string): boolean {
    const normalizedTarget = this.#normalizeHeader(target);

    return headers.some((header) => this.#normalizeHeader(header) === normalizedTarget);
  }

  #dateAliases(platform: PlatformType): string[] {
    switch (platform) {
      case PlatFormTypes.A:
        return ['Paid Date', '訂單日期'];
      case PlatFormTypes.B:
        return ['訂單付款日期', '日期'];
      case PlatFormTypes.C:
        return ['付款時間', '出貨時間', '時間'];
      default:
        return ['日期'];
    }
  }

  #statusAliases(platform: PlatformType): string[] {
    switch (platform) {
      case PlatFormTypes.A:
        return ['訂單狀態'];
      case PlatFormTypes.B:
        return ['狀態'];
      case PlatFormTypes.C:
        return ['訂單狀態', '出貨狀態'];
      default:
        return ['訂單狀態'];
    }
  }

  #customerNameAliases(platform: PlatformType): string[] {
    switch (platform) {
      case PlatFormTypes.A:
        return ['付款者姓名'];
      case PlatFormTypes.B:
        return ['收件人姓名(寄海外請填寫英文)', '帳單名字'];
      case PlatFormTypes.C:
        return ['收件人名稱', '會員名稱', '購買人名稱'];
      default:
        return ['收件人'];
    }
  }

  #customerPhoneAliases(platform: PlatformType): string[] {
    switch (platform) {
      case PlatFormTypes.A:
        return ['付款者電話'];
      case PlatFormTypes.B:
        return ['收件人手機', '帳單電話'];
      case PlatFormTypes.C:
        return ['會員手機號碼', '購買人電話', '收件人電話'];
      default:
        return ['收件人電話'];
    }
  }

  #noteAliases(platform: PlatformType): string[] {
    switch (platform) {
      case PlatFormTypes.A:
        return ['Customer Note'];
      case PlatFormTypes.B:
        return ['訂單備註', '備註'];
      case PlatFormTypes.C:
        return ['會員資料備註', '備註'];
      default:
        return ['備註'];
    }
  }

  #normalizeHeader(input: string): string {
    return input
      .replace(/\uFEFF/g, '')
      .replace(/[\s\u3000]+/g, '')
      .replace(/[()（）:：\-_/]/g, '')
      .toLowerCase();
  }

  #toText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  #parseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    const normalized = String(value).trim().replaceAll(',', '');
    if (normalized.length === 0) {
      return undefined;
    }

    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  #parseDate(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return new Date(
          Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S)),
        ).toISOString();
      }
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    const knownFormats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY-MM-DD',
      'YYYY/MM/DD',
      'MM/DD/YYYY',
      'DD/MM/YYYY',
      'YYYY.M.D',
      'YYYY年MM月DD日',
    ];

    for (const format of knownFormats) {
      const parsed = dayjs(text, format, true);
      if (parsed.isValid()) {
        return parsed.toISOString();
      }
    }

    const fallback = dayjs(text);
    return fallback.isValid() ? fallback.toISOString() : null;
  }

  #normalizeBusinessStatus(rawStatus: string): OrderBusinessStatus {
    const normalized = rawStatus.trim().toLowerCase();

    if (normalized.includes('換貨保留') || normalized.includes('exchange_reserved')) {
      return 'exchange_reserved';
    }

    if (
      normalized.includes('取消') ||
      normalized.includes('cancelled') ||
      normalized.includes('canceled') ||
      normalized.includes('作廢')
    ) {
      return 'cancelled';
    }

    if (
      normalized.includes('退貨') ||
      normalized.includes('returned') ||
      normalized.includes('refund')
    ) {
      return 'returned';
    }

    if (
      normalized.includes('重寄') ||
      normalized.includes('補寄') ||
      normalized.includes('resend')
    ) {
      return 'resend';
    }

    if (
      normalized.includes('出貨') ||
      normalized.includes('已寄') ||
      normalized.includes('配送') ||
      normalized.includes('shipped') ||
      normalized.includes('delivered') ||
      normalized.includes('完成')
    ) {
      return 'shipped';
    }

    return 'normal';
  }

  #emptyResult(errors: ImportErrorRow[]): OrderImportOutput {
    return {
      orders: [],
      unmatchedProducts: [],
      result: {
        importedCount: 0,
        duplicateCount: 0,
        errorCount: errors.length,
        errors,
      },
    };
  }
}
