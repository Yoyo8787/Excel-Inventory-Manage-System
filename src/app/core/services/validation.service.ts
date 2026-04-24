import { Injectable } from '@angular/core';
import dayjs from 'dayjs';
import { z } from 'zod';

import { ImportErrorRow, PlatformType } from '../models';

export interface NormalizedOrderRowCandidate {
  rowNumber: number;
  platform: PlatformType;
  orderNo: unknown;
  orderDate: unknown;
  productName: unknown;
  quantity: unknown;
  amountTotal?: unknown;
  unitPrice?: unknown;
  subtotal?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  address?: unknown;
  note?: unknown;
  raw: Record<string, unknown>;
}

export interface ValidatedOrderRow {
  rowNumber: number;
  platform: PlatformType;
  orderNo: string;
  orderDate: string;
  productName: string;
  quantity: number;
  amountTotal?: number;
  unitPrice?: number;
  subtotal?: number;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  note?: string;
  raw: Record<string, unknown>;
}

const normalizedOrderRowSchema = z.object({
  orderNo: z.string().trim().min(1, '訂單編號不可為空'),
  orderDate: z
    .string()
    .trim()
    .min(1, '日期不可為空')
    .refine((value) => dayjs(value).isValid(), '日期格式錯誤'),
  productName: z.string().trim().min(1, '商品名稱不可為空'),
  quantity: z.number().int('數量必須為整數').positive('數量必須大於 0'),
  amountTotal: z.number().finite().optional(),
  unitPrice: z.number().finite().optional(),
  subtotal: z.number().finite().optional(),
  customerName: z.string().trim().min(1).optional(),
  customerPhone: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional()
});

@Injectable({ providedIn: 'root' })
export class ValidationService {
  validateOrderImportRow(
    candidate: NormalizedOrderRowCandidate
  ):
    | { success: true; data: ValidatedOrderRow }
    | { success: false; errors: ImportErrorRow[] } {
    const parsed = normalizedOrderRowSchema.safeParse({
      orderNo: this.#toRequiredString(candidate.orderNo),
      orderDate: this.#toRequiredString(candidate.orderDate),
      productName: this.#toRequiredString(candidate.productName),
      quantity: this.#toNumber(candidate.quantity),
      amountTotal: this.#toOptionalNumber(candidate.amountTotal),
      unitPrice: this.#toOptionalNumber(candidate.unitPrice),
      subtotal: this.#toOptionalNumber(candidate.subtotal),
      customerName: this.#toOptionalString(candidate.customerName),
      customerPhone: this.#toOptionalString(candidate.customerPhone),
      address: this.#toOptionalString(candidate.address),
      note: this.#toOptionalString(candidate.note)
    });

    if (!parsed.success) {
      return {
        success: false,
        errors: parsed.error.issues.map((issue) => ({
          rowNumber: candidate.rowNumber,
          platform: candidate.platform,
          orderNo: this.#toOptionalString(candidate.orderNo),
          field: issue.path[0]?.toString() ?? 'row',
          reason: issue.message,
          raw: candidate.raw
        }))
      };
    }

    return {
      success: true,
      data: {
        rowNumber: candidate.rowNumber,
        platform: candidate.platform,
        raw: candidate.raw,
        ...parsed.data
      }
    };
  }

  #toRequiredString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  #toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const asString = String(value).trim();

    return asString.length > 0 ? asString : undefined;
  }

  #toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const parsed = this.#toNumber(value);

    return parsed;
  }

  #toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().replaceAll(',', '');
      if (normalized.length === 0) {
        return Number.NaN;
      }

      return Number(normalized);
    }

    return Number(value);
  }
}
