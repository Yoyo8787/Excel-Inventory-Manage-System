import { StoreService } from './store.service';
import type { InboundRecord, OutboundRecord, ProductAliasMapping } from '../models';

const inbound = (
  id: string,
  productName: string,
  productStyle: string,
  quantity: number,
  importedAt = '2026-05-25T08:00:00.000Z',
): InboundRecord => ({ id, productName, productStyle, quantity, importedAt });

const outbound = (
  id: string,
  productName: string,
  productStyle: string,
  quantity: number,
  importedAt = '2026-05-25T09:00:00.000Z',
): OutboundRecord => ({
  id,
  productName,
  productStyle,
  quantity,
  recipientName: '王小明',
  importedAt,
});

describe('StoreService inventory behavior', () => {
  let store: StoreService;

  beforeEach(() => {
    store = new StoreService();
    store.createNewDataset('test');
  });

  it('deducts outbound quantity when product name and style match inbound records', () => {
    store.applyInboundImport({
      records: [inbound('in-1', '護身符', '紅', 10)],
      result: { type: 'inbound', importedCount: 1, errorCount: 0, errors: [] },
    });
    store.applyOutboundImport({
      records: [outbound('out-1', '護身符', '紅', 3)],
      result: { type: 'outbound', importedCount: 1, errorCount: 0, errors: [] },
    });

    expect(store.inventorySnapshots()[0]).toMatchObject({
      productName: '護身符',
      productStyle: '紅',
      inboundTotal: 10,
      deductedTotal: 3,
      onHand: 7,
    });
    expect(store.unmatchedOutbounds()).toHaveLength(0);
  });

  it('leaves blank-style outbounds unmatched and does not deduct inventory', () => {
    store.applyInboundImport({
      records: [inbound('in-1', '護身符', '紅', 10)],
      result: { type: 'inbound', importedCount: 1, errorCount: 0, errors: [] },
    });
    store.applyOutboundImport({
      records: [outbound('out-1', '護身符', '', 3)],
      result: { type: 'outbound', importedCount: 1, errorCount: 0, errors: [] },
    });

    expect(store.inventorySnapshots()[0].deductedTotal).toBe(0);
    expect(store.unmatchedOutbounds()).toHaveLength(1);
  });

  it('retroactively applies one-to-many outbound mappings with quantity multipliers', () => {
    store.applyInboundImport({
      records: [
        inbound('in-1', '平安符', '紅', 10),
        inbound('in-2', '御守袋', '藍', 10),
      ],
      result: { type: 'inbound', importedCount: 2, errorCount: 0, errors: [] },
    });
    store.applyOutboundImport({
      records: [outbound('out-1', '新年禮盒', 'A', 2)],
      result: { type: 'outbound', importedCount: 1, errorCount: 0, errors: [] },
    });

    expect(store.unmatchedOutbounds()).toHaveLength(1);

    const mapping: ProductAliasMapping = {
      id: 'map-1',
      sourceProductName: '新年禮盒',
      sourceProductStyle: 'A',
      items: [
        { productName: '平安符', productStyle: '紅', quantity: 1 },
        { productName: '御守袋', productStyle: '藍', quantity: 2 },
      ],
      updatedAt: '2026-05-25T10:00:00.000Z',
    };
    store.addMapping(mapping);

    const byStyle = new Map(store.inventorySnapshots().map((item) => [item.productStyle, item]));
    expect(byStyle.get('紅')?.deductedTotal).toBe(2);
    expect(byStyle.get('藍')?.deductedTotal).toBe(4);
    expect(store.unmatchedOutbounds()).toHaveLength(0);
  });

  it('does not apply outbound alias mappings to inbound records', () => {
    store.addMapping({
      id: 'map-1',
      sourceProductName: '新年禮盒',
      sourceProductStyle: 'A',
      items: [{ productName: '平安符', productStyle: '紅', quantity: 1 }],
      updatedAt: '2026-05-25T10:00:00.000Z',
    });
    store.applyInboundImport({
      records: [inbound('in-1', '新年禮盒', 'A', 5)],
      result: { type: 'inbound', importedCount: 1, errorCount: 0, errors: [] },
    });

    expect(store.inventorySnapshots()).toEqual([
      expect.objectContaining({
        productName: '新年禮盒',
        productStyle: 'A',
        inboundTotal: 5,
        deductedTotal: 0,
      }),
    ]);
  });

  it('removes complete batches by importedAt and recalculates inventory', () => {
    store.applyInboundImport({
      records: [
        inbound('in-1', '護身符', '紅', 10, '2026-05-25T08:00:00.000Z'),
        inbound('in-2', '護身符', '紅', 5, '2026-05-25T08:00:00.000Z'),
      ],
      result: { type: 'inbound', importedCount: 2, errorCount: 0, errors: [] },
    });
    store.applyOutboundImport({
      records: [outbound('out-1', '護身符', '紅', 4, '2026-05-25T09:00:00.000Z')],
      result: { type: 'outbound', importedCount: 1, errorCount: 0, errors: [] },
    });

    expect(store.inventorySnapshots()[0].onHand).toBe(11);
    store.removeInboundBatch('2026-05-25T08:00:00.000Z');
    expect(store.inventorySnapshots()).toEqual([]);
    expect(store.unmatchedOutbounds()).toHaveLength(1);

    store.removeOutboundBatch('2026-05-25T09:00:00.000Z');
    expect(store.inventorySnapshots()).toEqual([]);
  });
});
