export const PERMISSION_RESOURCES = [
  { key: "inventory", label: "Inventory" },
  { key: "skuMappings", label: "SKU Mappings" },
  { key: "integrations", label: "Integrations" },
  { key: "users", label: "Users" },
] as const;

export const PERMISSION_PAGES = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "skuMapping", label: "SKU Mapping", path: "/dashboard/sku-mapping" },
  { key: "inventorySync", label: "Inventory Sync", path: "/dashboard/inventory-sync" },
  { key: "costSync", label: "Cost Sync", path: "/dashboard/cost-sync" },
  { key: "integrations", label: "Integrations", path: "/dashboard/integrations" },
  { key: "syncLogs", label: "Sync Logs", path: "/dashboard/sync-logs" },
  { key: "debugMappings", label: "Debug Mappings", path: "/dashboard/debug-mappings" },
  { key: "users", label: "Users", path: "/dashboard/users" },
  { key: "profile", label: "Profile", path: "/dashboard/profile" },
] as const;

export const PERMISSION_FEATURES: ReadonlyArray<{ key: string; label: string }> = [];

export const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const;

export type ResourceKey = (typeof PERMISSION_RESOURCES)[number]["key"];
export type PageKey = (typeof PERMISSION_PAGES)[number]["key"];
export type FeatureKey = (typeof PERMISSION_FEATURES)[number]["key"];
export type CrudAction = (typeof CRUD_ACTIONS)[number];

export interface ResourcePermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface Permissions {
  resources: Record<string, ResourcePermissions>;
  pages: Record<string, boolean>;
  features: Record<string, boolean>;
}

function allResources(value: boolean): Record<string, ResourcePermissions> {
  const result: Record<string, ResourcePermissions> = {};
  for (const r of PERMISSION_RESOURCES) {
    result[r.key] = { create: value, read: value, update: value, delete: value };
  }
  return result;
}

function allPages(value: boolean): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const p of PERMISSION_PAGES) {
    result[p.key] = value;
  }
  return result;
}

function allFeatures(value: boolean): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const f of PERMISSION_FEATURES) {
    result[f.key] = value;
  }
  return result;
}

export const DEFAULT_ADMIN_PERMISSIONS: Permissions = {
  resources: allResources(true),
  pages: allPages(true),
  features: allFeatures(true),
};

export const DEFAULT_MEMBER_PERMISSIONS: Permissions = {
  resources: {
    inventory: { create: false, read: true, update: true, delete: false },
    skuMappings: { create: false, read: true, update: false, delete: false },
    production: { create: true, read: true, update: true, delete: false },
    syncLogs: { create: false, read: true, update: false, delete: false },
    integrations: { create: false, read: true, update: false, delete: false },
    shipping: { create: false, read: true, update: false, delete: false },
    users: { create: false, read: false, update: false, delete: false },
    notifications: { create: false, read: false, update: false, delete: false },
  },
  pages: {
    dashboard: true,
    inventorySync: true,
    reverbSync: false,
    production: true,
    skuMapping: false,
    costSync: false,
    integrations: false,
    syncLogs: true,
    salesInventory: true,
    shipping: true,
    users: false,
    notifications: false,
    roles: false,
    profile: true,
  },
  features: {
    aiChat: true,
    manualOverride: false,
    bulkActions: false,
  },
};

export const DEFAULT_VIEWER_PERMISSIONS: Permissions = {
  resources: {
    inventory: { create: false, read: true, update: false, delete: false },
    skuMappings: { create: false, read: true, update: false, delete: false },
    production: { create: false, read: true, update: false, delete: false },
    syncLogs: { create: false, read: true, update: false, delete: false },
    integrations: { create: false, read: false, update: false, delete: false },
    shipping: { create: false, read: true, update: false, delete: false },
    users: { create: false, read: false, update: false, delete: false },
    notifications: { create: false, read: false, update: false, delete: false },
  },
  pages: {
    dashboard: true,
    inventorySync: false,
    reverbSync: false,
    production: false,
    skuMapping: false,
    costSync: false,
    integrations: false,
    syncLogs: false,
    salesInventory: true,
    shipping: false,
    users: false,
    notifications: false,
    roles: false,
    profile: true,
  },
  features: {
    aiChat: false,
    manualOverride: false,
    bulkActions: false,
  },
};

export function createEmptyPermissions(): Permissions {
  return {
    resources: allResources(false),
    pages: allPages(false),
    features: allFeatures(false),
  };
}
