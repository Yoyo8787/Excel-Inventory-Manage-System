# Excel-based Order & Inventory Manager (Frontend Only)

純前端的訂單與庫存管理工具，資料透過 Excel 匯入與匯出，不使用後端 API 或資料庫。

## 目前狀態

- 目前程式碼仍是 Angular 樣板專案。
- 本 README 作為後續實作的單一規格來源（single source of truth）。
- 先完成規格，再依章節逐步拆分與實作。

## 專案目標

建立可在單一頁面中完成下列流程的系統：

1. 開啟網站
2. 載入系統資料庫 Excel 或建立空白資料
3. 匯入平台訂單 Excel（平台 A / 平台 B / 平台 C）
4. 手動新增進貨
5. 管理平台商品名稱與主商品配對
6. 查看儀表板、庫存與訂單資訊
7. 關閉網站前下載 Excel 保存

## 技術與限制

### 技術棧

- Angular
- TypeScript
- TailwindCSS
- Angular Material

### NPM 套件（必用）

- UI: `@angular/material`, `@angular/cdk`
- Excel: `xlsx`
- 驗證: `zod`
- 日期: `dayjs`
- ID: `nanoid`
- 下載: `file-saver`

### 系統限制

- Single Page Application
- 靜態部署
- 不使用後端 API
- 不使用 Angular Router
- 所有資料僅存於瀏覽器記憶體
- 重新整理頁面即清空資料

## 資料保存與 Dirty State

### 保存原則

- 系統資料只存在記憶體。
- 使用者必須手動匯出 Excel 保存。
- UI 必須明確顯示：
  - 是否已載入資料
  - 是否有未保存變更

### Dirty State 觸發條件

以下操作發生時，`dirty = true`：

- 匯入訂單
- 新增進貨
- 編輯商品
- 編輯商品配對
- 刪除資料
- 建立新資料

以下操作可清除 dirty：

- 成功匯出資料庫 Excel 後，`dirty = false`

### 離開頁面防呆

當 `dirty = true` 時，若使用者：

- 關閉分頁
- 重新整理
- 導航離站

需觸發瀏覽器 `beforeunload` 警告。

## 系統流程（E2E）

1. 初始化（空白資料 / 載入資料庫）
2. 匯入平台訂單（A/B）
3. 驗證 + 正規化 + 去重
4. 建立未配對清單
5. 進貨管理與商品配對維護
6. 即時重算庫存
7. 檢視儀表板與清單
8. 匯出資料庫 Excel / 錯誤報告 Excel

## Public Types 設計（規格）

> 下列為核心 domain model，後續實作時需對應到 `src/app/core/models`。

```ts
export type Id = string;
export type ProductId = Id;
export type OrderId = Id;
export type MappingId = Id;
export type InboundId = Id;

export type PlatformType = 'A' | 'B';
export type DuplicateOrderPolicy = 'skip';

export type InventoryDirection = 'deduct' | 'restock' | 'ignore';
export type OrderBusinessStatus =
  | 'normal'
  | 'shipped'
  | 'cancelled'
  | 'returned'
  | 'resend'
  | 'exchange_reserved'; // v1 保留，不進庫存計算

export interface SystemMeta {
  datasetName: string;
  loadedAt: string | null;
  lastSavedAt: string | null;
  version: 'v1';
}

export interface AppSettings {
  defaultLowStockThreshold: number;
}

export interface DirtyState {
  isDirty: boolean;
  reasons: string[];
}

export interface Product {
  id: ProductId;
  name: string;
  lowStockThreshold: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MappingItem {
  productId: ProductId;
  quantity: number;
}

export interface PlatformProductMapping {
  id: MappingId;
  platform: PlatformType;
  platformProductName: string;
  items: MappingItem[]; // 支援 1 對多
  updatedAt: string;
}

export interface OrderLine {
  lineId: Id;
  platformProductName: string;
  unitPrice?: number;
  quantity: number;
  subtotal?: number;
  mappedItems: MappingItem[];
  isMatched: boolean;
}

export interface Order {
  id: OrderId;
  platform: PlatformType;
  orderNo: string;
  orderDate: string;
  statusRaw: string;
  status: OrderBusinessStatus;
  customerName?: string;
  customerPhone?: string;
  amountTotal?: number;
  address?: string;
  note?: string;
  lines: OrderLine[];
  importedAt: string;
}

export interface InboundRecord {
  id: InboundId;
  productId: ProductId;
  quantity: number;
  inboundDate: string;
  note?: string;
  createdAt: string;
}

// Calculated
export interface UnmatchedProduct {
  platform: PlatformType;
  platformProductName: string;
  orderNo: string;
  orderLineId: Id;
  quantity: number;
  detectedAt: string;
}

export interface ImportErrorRow {
  rowNumber: number;
  platform: PlatformType;
  orderNo?: string;
  field: string;
  reason: string;
  raw: Record<string, unknown>;
}

export interface ImportJobResult {
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: ImportErrorRow[];
}

export interface InventoryMovement {
  productId: ProductId;
  direction: InventoryDirection;
  quantity: number;
  source: 'inbound' | 'order';
  sourceId: string;
}

// Calculated
export interface InventorySnapshot {
  productId: ProductId;
  productName: string;
  inboundTotal: number;
  deductedTotal: number;
  restockedTotal: number;
  onHand: number;
  isLowStock: boolean;
}

export interface AppState {
  meta: SystemMeta;
  settings: AppSettings;
  dirty: DirtyState;
  products: Product[];
  mappings: PlatformProductMapping[];
  orders: Order[];
  inbounds: InboundRecord[];
  unmatchedProducts: UnmatchedProduct[];
  lastImportResult: ImportJobResult | null;
}
```

## Excel Workbook Schema（規格）

### 系統資料庫匯出（Workbook）

建議固定 Sheet：

- `meta`
- `products`
- `mappings`
- `orders`
- `order_lines`
- `inbounds`

欄位原則：

- 第一列為欄位名稱
- 日期欄位一律輸出 ISO 字串
- ID 欄位一律保留（供重載一致性）
- `meta.defaultLowStockThreshold` 保存新增商品的全域安全庫存預設值

### 匯入來源（訂單）

- 平台 A (好蒔光) ：
  訂單編號 | Paid Date 訂單狀態 付款方式 訂單日期 付款者姓名 付款者電話 電子信箱 收件人 收件人電話 收件郵遞區號 縣市 鄉鎮市區 地址 品名 數量 金額 Customer Note

- 平台 B (仙姑)：以 Spec 指定欄位為準
  訂單編號 日期 狀態 總計 數量 商品名稱 付款方式 付款方式子類別 綠界交易序號 訂單付款日期 開立對象 發票抬頭 統一編號 載具編號 發票號碼 綠界發票開立時間 帳單名字 帳單 Email 帳單電話 收件人姓名(寄海外請填寫英文) 收件人手機 郵遞區號(寄海外請填寫英文) 國家名稱(寄海外請填英文) 縣市(寄海外請填英文) 收件地址(寄海外請填寫英文) 第一人(:姓名/農曆出生年月日建生或瑞生/居住地址: 第二人:姓名/農曆出生年月日建生或瑞生/居住地址: 負責人:姓名/農曆出生年月日建生或瑞生/公司地址: Line帳號上名稱 訂單備註

- 平台 C (綠崎)：以 Spec 指定欄位為準
  時間 付款時間 取消時間 訂單狀態 訂單編號 會員名稱 Email 會員手機號碼 會員資料備註 收件人名稱 收件人電話 收件人地址 收件人國家 購買人名稱 購買人電話 商品名稱 商品款式 商品售價 商品定價 數量 小計 VIP折扣 優惠券名稱 優惠券序號 優惠券金額 免運券金額 分潤人名稱 運費 總額 出貨時間 出貨狀態 備註

## 匯入驗證與規則

### 最低必要欄位

缺任一欄位則該列不可匯入：

- 訂單編號
- 商品名稱
- 數量
- 訂單狀態
- 日期（或時間）

### 格式檢查

- 數量必須為數字(整數)
- 金額必須為數字(整數)（若欄位存在）
- 日期必須可解析
- 商品名稱不可為空字串

### 重複訂單策略

- 若 `orderNo` 已存在，預設 `DuplicateOrderPolicy = 'skip'`

### 匯入結果

匯入完成需輸出摘要：

- 成功筆數
- 重複筆數
- 錯誤筆數

並提供：

- 錯誤清單（畫面）
- 錯誤報告 Excel（下載）

## 商品配對規則

- 一個平台商品名稱可對應一個主商品
- 一個平台商品名稱可對應多個主商品（組合包）
- 未配對商品列入 `unmatchedProducts`
- 未配對商品不參與庫存扣減

## 進貨管理規則

### 必填

- 商品
- 數量
- 日期

### 選填

- 備註

## 庫存計算規則

### 主公式

`庫存 = 進貨總量 - 訂單扣減 + 取消/退貨回補`

### 狀態對應

- `normal` -> 扣庫存
- `shipped` -> 扣庫存
- `cancelled` -> 回補庫存
- `returned` -> 回補庫存
- `resend` -> 扣庫存
- `exchange_reserved` -> v1 保留（不開放操作，不進計算）

## 儀表板指標

- 商品總數
- 庫存總量
- 今日訂單數
- 低庫存商品數
- 未配對商品數

## Component 規劃（無 Router）

- `AppShellComponent`
  - 主頁框架、版面區塊切換、全域狀態顯示
- `TopActionBarComponent`
  - 建立空白、載入資料庫、匯入訂單、匯出資料庫、dirty 提示
- `DashboardPanelComponent`
  - 顯示 5 個 KPI 指標
- `OrderImportPanelComponent`
  - 平台選擇、檔案上傳、匯入摘要、錯誤下載
- `OrderFormPanelComponent`
  - 單一訂單輸入
- `ProductManagerPanelComponent`
  - 商品 CRUD、低庫存門檻設定
- `MappingManagerPanelComponent`
  - 平台商品名稱對主商品配對維護
- `InboundManagerPanelComponent`
  - 進貨新增/檢視
- `InventoryPanelComponent`
  - 庫存快照列表
- `OrderListPanelComponent`
  - 訂單與訂單明細檢視
- `UnmatchedPanelComponent`
  - 未配對商品清單與導向配對
- `ImportResultDialogComponent`
  - 顯示匯入摘要與錯誤項目

## Service 規劃

- `StoreService`
  - 使用 Angular signals 管理 `AppState`
- `ExcelIoService`
  - `xlsx` 讀寫 workbook，`file-saver` 下載
- `OrderImportService`
  - 平台 A/B/C row 正規化成 `Order` / `OrderLine`
- `ValidationService`
  - `zod` schema 驗證與錯誤彙整
- `InventoryService`
  - 計算 `InventorySnapshot`
- `DirtyStateService`
  - dirty 觸發與清除策略
- `BeforeUnloadGuardService`
  - 綁定/解除 `beforeunload`

## 功能範圍

### In Scope（需實作）

- 建立空白資料
- 載入資料庫 Excel
- 匯入平台訂單
- 商品管理
- 進貨管理
- 商品配對管理
- 庫存檢視
- 訂單檢視
- 匯出資料庫 Excel
- 匯出報表/錯誤報告 Excel

### Out of Scope（不實作）

- 登入
- 多人協作
- 權限管理
- 後端 API
- 多倉庫
- 複雜庫存流程
- 調整單
- 語系切換
- 時區設定
- Angular Router
- 離線儲存
- 換貨流程（v1 保留）

## 驗收測試情境

### 匯入測試

- 平台 A/B/C 各 1 份正常檔可成功匯入
- 缺必填欄位可正確記錯並排除
- 數字/日期格式錯誤可正確記錯並排除
- 重複訂單會跳過且摘要統計正確

### 庫存測試

- 一般/出貨狀態會扣庫存
- 取消/退貨會回補庫存
- 未配對商品不扣庫存
- 新增進貨後庫存即時更新

### 狀態測試

- 任一資料編輯行為可觸發 dirty
- 成功匯出後 dirty 會清除
- dirty=true 時關閉/重整會有警告提示

### 匯出測試

- 可匯出資料庫 Excel 且可重新載入
- 可匯出錯誤報告 Excel（含列號、欄位、原因）

## 開發拆分順序（後續實作 Roadmap）

1. Core model + store
   - 建立 `AppState` 與核心 types
   - 建立 `StoreService`（signals）
2. Excel I/O
   - 載入/匯出系統資料庫 workbook
3. Order import pipeline
   - 平台 A/B/C parser -> zod 驗證 -> 去重 -> 匯入結果
4. Mapping 與 unmatched
   - 配對維護、未配對清單、重算訂單明細映射
5. Inventory engine
   - movement 計算與 snapshot 聚合
6. UI panels
   - 依 component 規劃串接 service 與 store
7. Dirty/beforeunload
   - 全域未保存提示與離站防呆
8. Test coverage
   - 匯入、庫存、dirty、匯出完整情境

## 開發指令

```bash
npm install
npm start
npm run build
npm test
```
