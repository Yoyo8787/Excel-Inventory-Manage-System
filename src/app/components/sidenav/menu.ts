interface MenuItem {
  label: string;
  icon: string;
  route: string;
}
export const MenuItem = [
  { label: '控制面板', icon: 'dashboard', route: 'dashboard' },
  { label: '出貨匯入', icon: 'upload', route: 'orders' },
  { label: '手動出貨', icon: 'edit', route: 'manual-order' },
  { label: '庫存配對', icon: 'inventory', route: 'products' },
  { label: '進貨作業', icon: 'shopping_cart', route: 'import' },
  { label: '系統設定', icon: 'settings', route: 'settings' },
];
export const Routes = MenuItem.map((item) => item.route);
