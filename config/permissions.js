const GLOBAL_ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
  STAFF: 'staff',
};

const SHOP_ROLES = {
  MANAGER: 'Manager',
  SALESMAN: 'Salesman',
  STOCKIST: 'Stockist',
};

// What each SHOP-level role is allowed to do inside a given shop
const SHOP_PERMISSIONS = {
  [SHOP_ROLES.MANAGER]: [
    'view_financials',
    'view_reports',
    'manage_inventory',
    'manage_employees',
    'create_sale',
    'view_sales',
    'edit_shop_settings',
  ],
  [SHOP_ROLES.SALESMAN]: [
    'create_sale',
    'view_own_sales',
  ],
  [SHOP_ROLES.STOCKIST]: [
    'manage_inventory',
    'view_inventory',
  ],
};

module.exports = { GLOBAL_ROLES, SHOP_ROLES, SHOP_PERMISSIONS };