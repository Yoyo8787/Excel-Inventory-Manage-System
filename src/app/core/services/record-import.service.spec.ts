import * as XLSX from 'xlsx';

import { RecordImportService } from './record-import.service';
import { ValidationService } from './validation.service';

function workbookBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Sheet1');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

describe('RecordImportService', () => {
  let service: RecordImportService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T08:00:00.000Z'));
    service = new RecordImportService(new ValidationService());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('imports outbound rows with blank product style as unmatched-ready records', () => {
    const output = service.importOutboundFromBuffer(workbookBuffer([
      { 商品名稱: '護身符', 商品款式: '', 數量: 2, 收件人名稱: '王小明' },
    ]));

    expect(output.result).toMatchObject({ importedCount: 1, errorCount: 0 });
    expect(output.records[0]).toMatchObject({
      productName: '護身符',
      productStyle: '',
      quantity: 2,
      recipientName: '王小明',
      importedAt: '2026-05-25T08:00:00.000Z',
    });
  });

  it('rejects inbound rows without product style', () => {
    const output = service.importInboundFromBuffer(workbookBuffer([
      { 商品名稱: '護身符', 商品款式: '', 數量: 2 },
    ]));

    expect(output.records).toEqual([]);
    expect(output.result.errorCount).toBe(1);
    expect(output.result.errors[0]).toMatchObject({
      type: 'inbound',
      field: 'productStyle',
      reason: '商品款式不可為空',
    });
  });

  it('rejects outbound rows without recipient or a positive integer quantity', () => {
    const output = service.importOutboundFromBuffer(workbookBuffer([
      { 商品名稱: '護身符', 商品款式: '紅', 數量: 0, 收件人名稱: '' },
    ]));

    expect(output.records).toEqual([]);
    expect(output.result.errorCount).toBe(2);
    expect(output.result.errors.map((error) => error.field).sort()).toEqual([
      'quantity',
      'recipientName',
    ]);
  });

  it('keeps all rows in one import on the same importedAt batch timestamp', () => {
    const output = service.importOutboundFromBuffer(workbookBuffer([
      { 商品名稱: '護身符', 商品款式: '紅', 數量: 1, 收件人名稱: '王小明' },
      { 商品名稱: '護身符', 商品款式: '藍', 數量: 3, 收件人名稱: '林小美' },
    ]));

    expect(output.records).toHaveLength(2);
    expect(new Set(output.records.map((record) => record.importedAt))).toEqual(
      new Set(['2026-05-25T08:00:00.000Z']),
    );
  });

  it('does not dedupe repeated imports', () => {
    const buffer = workbookBuffer([
      { 商品名稱: '護身符', 商品款式: '紅', 數量: 1, 收件人名稱: '王小明' },
    ]);

    const first = service.importOutboundFromBuffer(buffer);
    const second = service.importOutboundFromBuffer(buffer);

    expect(first.result.importedCount).toBe(1);
    expect(second.result.importedCount).toBe(1);
  });
});
