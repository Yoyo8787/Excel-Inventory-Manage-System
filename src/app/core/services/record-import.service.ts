import { Injectable } from '@angular/core';
import { nanoid } from 'nanoid';
import * as XLSX from 'xlsx';

import {
  ImportErrorRow,
  ImportJobResult,
  InboundRecord,
  OutboundRecord,
} from '../models';
import {
  NormalizedRecordRowCandidate,
  ValidatedInboundRow,
  ValidatedOutboundRow,
  ValidationService,
} from './validation.service';

export interface InboundImportOutput {
  records: InboundRecord[];
  result: ImportJobResult;
}

export interface OutboundImportOutput {
  records: OutboundRecord[];
  result: ImportJobResult;
}

@Injectable({ providedIn: 'root' })
export class RecordImportService {
  constructor(private readonly validationService: ValidationService) {}

  async importInboundFromFile(file: File): Promise<InboundImportOutput> {
    const buffer = await file.arrayBuffer();
    return this.importInboundFromBuffer(buffer);
  }

  async importOutboundFromFile(file: File): Promise<OutboundImportOutput> {
    const buffer = await file.arrayBuffer();
    return this.importOutboundFromBuffer(buffer);
  }

  importInboundFromBuffer(buffer: ArrayBuffer): InboundImportOutput {
    const rows = this.#readFirstSheet(buffer, 'inbound');
    const sheetError = this.#sheetError(rows, 'inbound');
    if (sheetError) {
      return this.#emptyInboundResult([sheetError]);
    }

    const importedAt = new Date().toISOString();
    const validRows: ValidatedInboundRow[] = [];
    const errors: ImportErrorRow[] = [];

    rows.forEach((rawRow, index) => {
      const candidate = this.#parseRow(rawRow, index + 2, 'inbound');
      const result = this.validationService.validateInboundRow(candidate);
      if (result.success) {
        validRows.push(result.data);
        return;
      }
      errors.push(...result.errors);
    });

    const records = validRows.map((row) => ({
      id: nanoid(12),
      productName: row.productName.trim(),
      productStyle: row.productStyle.trim(),
      quantity: row.quantity,
      importedAt,
    }));

    return {
      records,
      result: {
        type: 'inbound',
        importedCount: records.length,
        errorCount: errors.length,
        errors,
      },
    };
  }

  importOutboundFromBuffer(buffer: ArrayBuffer): OutboundImportOutput {
    const rows = this.#readFirstSheet(buffer, 'outbound');
    const sheetError = this.#sheetError(rows, 'outbound');
    if (sheetError) {
      return this.#emptyOutboundResult([sheetError]);
    }

    const importedAt = new Date().toISOString();
    const validRows: ValidatedOutboundRow[] = [];
    const errors: ImportErrorRow[] = [];

    rows.forEach((rawRow, index) => {
      const candidate = this.#parseRow(rawRow, index + 2, 'outbound');
      const result = this.validationService.validateOutboundRow(candidate);
      if (result.success) {
        validRows.push(result.data);
        return;
      }
      errors.push(...result.errors);
    });

    const records = validRows.map((row) => ({
      id: nanoid(12),
      productName: row.productName.trim(),
      productStyle: row.productStyle.trim(),
      quantity: row.quantity,
      recipientName: row.recipientName.trim(),
      importedAt,
    }));

    return {
      records,
      result: {
        type: 'outbound',
        importedCount: records.length,
        errorCount: errors.length,
        errors,
      },
    };
  }

  #readFirstSheet(buffer: ArrayBuffer, type: 'inbound' | 'outbound'): Record<string, unknown>[] {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return [
        {
          __errorType: type,
          __errorReason: '找不到任何工作表',
        },
      ];
    }

    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
    });
  }

  #parseRow(
    rawRow: Record<string, unknown>,
    rowNumber: number,
    type: 'inbound' | 'outbound',
  ): NormalizedRecordRowCandidate {
    const fields = this.#buildFieldLookup(rawRow);

    return {
      rowNumber,
      type,
      productName: this.#pickValue(fields, ['商品名稱', '品名', 'productName']),
      productStyle: this.#pickValue(fields, ['商品款式', '款式', 'productStyle']),
      quantity: this.#pickValue(fields, ['數量', 'quantity']),
      recipientName: this.#pickValue(fields, ['收件人名稱', '收件人', 'recipientName']),
      raw: rawRow,
    };
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

  #normalizeHeader(input: string): string {
    return input
      .replace(/\uFEFF/g, '')
      .replace(/[\s\u3000]+/g, '')
      .replace(/[()（）:：\-_/]/g, '')
      .toLowerCase();
  }

  #sheetError(
    rows: Record<string, unknown>[],
    type: 'inbound' | 'outbound',
  ): ImportErrorRow | null {
    const first = rows[0];
    if (!first?.['__errorReason']) {
      return null;
    }

    return {
      rowNumber: 0,
      type,
      field: 'sheet',
      reason: String(first['__errorReason']),
      raw: {},
    };
  }

  #emptyInboundResult(errors: ImportErrorRow[]): InboundImportOutput {
    return {
      records: [],
      result: {
        type: 'inbound',
        importedCount: 0,
        errorCount: errors.length,
        errors,
      },
    };
  }

  #emptyOutboundResult(errors: ImportErrorRow[]): OutboundImportOutput {
    return {
      records: [],
      result: {
        type: 'outbound',
        importedCount: 0,
        errorCount: errors.length,
        errors,
      },
    };
  }
}
