import { Injectable } from '@angular/core';
import { z } from 'zod';

import { ImportErrorRow, ImportRecordType } from '../models';

export interface NormalizedRecordRowCandidate {
  rowNumber: number;
  type: ImportRecordType;
  productName: unknown;
  quantity: unknown;
  productStyle?: unknown;
  recipientName?: unknown;
  raw: Record<string, unknown>;
}

export interface ValidatedInboundRow {
  rowNumber: number;
  productName: string;
  productStyle: string;
  quantity: number;
  raw: Record<string, unknown>;
}

export interface ValidatedOutboundRow {
  rowNumber: number;
  productName: string;
  productStyle: string;
  quantity: number;
  recipientName: string;
  raw: Record<string, unknown>;
}

const inboundRowSchema = z.object({
  productName: z.string().trim().min(1, '商品名稱不可為空'),
  productStyle: z.string().trim().min(1, '商品款式不可為空'),
  quantity: z.number().int('數量必須為整數').positive('數量必須大於 0'),
});

const outboundRowSchema = z.object({
  productName: z.string().trim().min(1, '商品名稱不可為空'),
  productStyle: z.string().trim(),
  quantity: z.number().int('數量必須為整數').positive('數量必須大於 0'),
  recipientName: z.string().trim().min(1, '收件人名稱不可為空'),
});

@Injectable({ providedIn: 'root' })
export class ValidationService {
  validateInboundRow(
    candidate: NormalizedRecordRowCandidate
  ):
    | { success: true; data: ValidatedInboundRow }
    | { success: false; errors: ImportErrorRow[] } {
    const parsed = inboundRowSchema.safeParse({
      productName: this.#toRequiredString(candidate.productName),
      productStyle: this.#toRequiredString(candidate.productStyle),
      quantity: this.#toNumber(candidate.quantity),
    });

    if (!parsed.success) {
      return this.#validationErrors(candidate, parsed.error.issues);
    }

    return {
      success: true,
      data: {
        rowNumber: candidate.rowNumber,
        raw: candidate.raw,
        ...parsed.data
      }
    };
  }

  validateOutboundRow(
    candidate: NormalizedRecordRowCandidate
  ):
    | { success: true; data: ValidatedOutboundRow }
    | { success: false; errors: ImportErrorRow[] } {
    const parsed = outboundRowSchema.safeParse({
      productName: this.#toRequiredString(candidate.productName),
      productStyle: this.#toOptionalString(candidate.productStyle) ?? '',
      quantity: this.#toNumber(candidate.quantity),
      recipientName: this.#toRequiredString(candidate.recipientName),
    });

    if (!parsed.success) {
      return this.#validationErrors(candidate, parsed.error.issues);
    }

    return {
      success: true,
      data: {
        rowNumber: candidate.rowNumber,
        raw: candidate.raw,
        ...parsed.data,
      },
    };
  }

  #validationErrors(
    candidate: NormalizedRecordRowCandidate,
    issues: z.ZodIssue[],
  ): { success: false; errors: ImportErrorRow[] } {
    return {
      success: false,
      errors: issues.map((issue) => ({
        rowNumber: candidate.rowNumber,
        type: candidate.type,
        field: issue.path[0]?.toString() ?? 'row',
        reason: issue.message,
        raw: candidate.raw,
      })),
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
