const pool = require("../config/db");
const { GLOBAL_ROLES, SHOP_PERMISSIONS } = require("../config/permissions");

// Requires the user to have ONE specific permission (e.g., 'manage_inventory')
const requireShopPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      // verifyToken already put this here for us!
      const shopCode =
        req.user?.shopCode || req.body?.shopCode || req.params?.shopCode;

      if (!shopCode) {
        return res
          .status(400)
          .json({ error: "No shop specified for this action." });
      }

      // 1. Check Global Role
      const { rows: userRows } = await pool.query(
        "SELECT user_role FROM users WHERE id = $1",
        [userId],
      );
      if (!userRows.length)
        return res.status(404).json({ error: "User not found" });
      const globalRole = userRows[0].user_role;

      // 2. Admin Bypass
      if (globalRole === GLOBAL_ROLES.ADMIN) {
        req.shopRole = "Admin";
        return next();
      }

      // 3. Owner Bypass
      if (globalRole === GLOBAL_ROLES.OWNER) {
        const { rows: shopRows } = await pool.query(
          "SELECT owner_id FROM shops WHERE shop_code = $1",
          [shopCode],
        );
        if (shopRows.length && shopRows[0].owner_id === userId) {
          req.shopRole = "Owner";
          return next();
        }
      }

      // 4. Staff Check (Look up their role for this specific shop)
      const { rows: roleRows } = await pool.query(
        `
        SELECT us.role 
        FROM user_shops us
        JOIN shops s ON us.shop_id = s.id
        WHERE us.user_id = $1 AND s.shop_code = $2
      `,
        [userId, shopCode],
      );

      if (!roleRows.length) {
        return res
          .status(403)
          .json({ error: "You do not have access to this shop." });
      }

      const userShopRole = roleRows[0].role;
      const userPermissions = SHOP_PERMISSIONS[userShopRole] || [];

      // 5. Verify Permission
      if (!userPermissions.includes(permission)) {
        return res
          .status(403)
          .json({
            error: `Access denied. Requires '${permission}' permission.`,
          });
      }

      // 6. Attach their shop role so the controller can use it for data scoping
      req.shopRole = userShopRole;
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(500).json({ error: "Server error during authorization" });
    }
  };
};

// Requires the user to have AT LEAST ONE of the listed permissions
// (Useful for shared routes, like viewing sales where Managers see all, but Salesmen see their own)
const requireAnyShopPermission = (permissionsArray) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const shopCode =
        req.user?.shopCode || req.body?.shopCode || req.params?.shopCode;
      if (!shopCode)
        return res.status(400).json({ error: "No shop specified." });

      const { rows: userRows } = await pool.query(
        "SELECT user_role FROM users WHERE id = $1",
        [userId],
      );
      const globalRole = userRows[0]?.user_role;

      if (globalRole === GLOBAL_ROLES.ADMIN) {
        req.shopRole = "Admin";
        return next();
      }

      if (globalRole === GLOBAL_ROLES.OWNER) {
        const { rows: shopRows } = await pool.query(
          "SELECT owner_id FROM shops WHERE shop_code = $1",
          [shopCode],
        );
        if (shopRows.length && shopRows[0].owner_id === userId) {
          req.shopRole = "Owner";
          return next();
        }
      }

      const { rows: roleRows } = await pool.query(
        `
        SELECT us.role FROM user_shops us
        JOIN shops s ON us.shop_id = s.id
        WHERE us.user_id = $1 AND s.shop_code = $2
      `,
        [userId, shopCode],
      );

      if (!roleRows.length)
        return res.status(403).json({ error: "Access denied." });

      const userShopRole = roleRows[0].role;
      const userPermissions = SHOP_PERMISSIONS[userShopRole] || [];

      // Check if they have ANY of the requested permissions
      const hasPermission = permissionsArray.some((p) =>
        userPermissions.includes(p),
      );
      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "Access denied. Insufficient permissions." });
      }

      req.shopRole = userShopRole;
      next();
    } catch (error) {
      res.status(500).json({ error: "Server error during authorization" });
    }
  };
};

// Requires the user to have a specific GLOBAL role (e.g., 'owner' or 'admin')
const requireGlobalRole = (allowedRolesArray) => {
  return async (req, res, next) => {
    try {
      // 🚨 FIX: Safely check for the user ID using optional chaining 
      // This supports both { id: 1 } and { userId: 1 } token structures
      const userId = req.user?.id || req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Invalid token payload: User ID missing.' });
      }
      
      const { rows } = await pool.query('SELECT user_role FROM users WHERE id = $1', [userId]);
      
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'User not found in database' });
      }
      
      const globalRole = rows[0].user_role;

      if (!allowedRolesArray.includes(globalRole)) {
        return res.status(403).json({ error: 'You do not have permission to perform this account-level action.' });
      }

      next();
    } catch (error) {
      console.error('Global Authorization error:', error);
      res.status(500).json({ error: 'Server error during authorization' });
    }
  };
};
module.exports = { requireShopPermission, requireAnyShopPermission ,requireGlobalRole};
