interface MenuItem {
  label: string;
  icon: string;
  route: string;
}
export const MenuItem = [
  { label: '控制面板', icon: 'dashboard', route: 'dashboard' },
  { label: '訂單上傳', icon: 'upload', route: 'orders' },
  { label: '手動輸入', icon: 'edit', route: 'manual-order' },
  { label: '商品清單', icon: 'inventory', route: 'products' },
  { label: '進貨作業', icon: 'shopping_cart', route: 'import' },
  { label: '系統設定', icon: 'settings', route: 'settings' },
];
export const Routes = MenuItem.map((item) => item.route);
