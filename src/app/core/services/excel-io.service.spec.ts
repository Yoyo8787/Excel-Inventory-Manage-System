import { ExcelIoService } from './excel-io.service';
import { createEmptyAppState } from '../models';

describe('ExcelIoService', () => {
  it('round trips the new workbook format', async () => {
    const service = new ExcelIoService();
    const state = {
      ...createEmptyAppState('round-trip'),
      meta: {
        datasetName: 'round-trip',
        loadedAt: '2026-05-25T08:00:00.000Z',
        lastSavedAt: '2026-05-25T09:00:00.000Z',
      },
      settings: {
        defaultLowStockThreshold: 7,
      },
      inbounds: [
        {
          id: 'in-1',
          productName: '平安符',
          productStyle: '紅',
          quantity: 10,
          importedAt: '2026-05-25T08:00:00.000Z',
        },
      ],
      outbounds: [
        {
          id: 'out-1',
          productName: '禮盒',
          productStyle: '',
          quantity: 2,
          recipientName: '王小明',
          importedAt: '2026-05-25T09:00:00.000Z',
        },
      ],
      mappings: [
        {
          id: 'map-1',
          sourceProductName: '禮盒',
          sourceProductStyle: '',
          items: [{ productName: '平安符', productStyle: '紅', quantity: 2 }],
          updatedAt: '2026-05-25T10:00:00.000Z',
        },
      ],
    };

    const blob = service.exportSystemWorkbook(state);
    const loaded = service.parseSystemWorkbook(await blob.arrayBuffer());

    expect(loaded.meta.datasetName).toBe('round-trip');
    expect(loaded.settings.defaultLowStockThreshold).toBe(7);
    expect(loaded.inbounds).toEqual(state.inbounds);
    expect(loaded.outbounds).toEqual(state.outbounds);
    expect(loaded.mappings).toEqual(state.mappings);
  });
});
