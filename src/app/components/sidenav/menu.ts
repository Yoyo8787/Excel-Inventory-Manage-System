interface MenuItem {
  label: string;
  icon: string;
  route: string;
}
export const MenuItem = [
  { label: '控制面板', icon: 'dashboard', route: 'dashboard' },
  { label: '訂單管理', icon: 'list', route: 'orders' },
  { label: '手動輸入', icon: 'edit', route: 'manual-order' },
  { label: '商品清單', icon: 'inventory', route: 'products' },
  { label: '進貨作業', icon: 'file_upload', route: 'import' },
  { label: '系統設定', icon: 'settings', route: 'settings' },
];
