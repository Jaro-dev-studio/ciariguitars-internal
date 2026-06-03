import {
  type Permissions,
  type CrudAction,
  PERMISSION_PAGES,
  DEFAULT_ADMIN_PERMISSIONS,
} from "@/config/permissions";

// Every user is an admin with full access. The permission API surface is kept
// so existing call sites keep working, but all checks resolve to "allowed".

export async function getUserPermissions(_userId: string): Promise<Permissions> {
  return DEFAULT_ADMIN_PERMISSIONS;
}

export function hasResourcePermission(
  _permissions: Permissions,
  _resource: string,
  _action: CrudAction
): boolean {
  return true;
}

export function hasPageAccess(_permissions: Permissions, _pageKey: string): boolean {
  return true;
}

export function hasFeatureAccess(_permissions: Permissions, _featureKey: string): boolean {
  return true;
}

export async function requirePermission(
  _userId: string,
  _resource: string,
  _action: CrudAction
): Promise<{ allowed: true; permissions: Permissions } | { allowed: false; error: string }> {
  return { allowed: true, permissions: DEFAULT_ADMIN_PERMISSIONS };
}

export function getPageAccessPaths(permissions: Permissions): string[] {
  const paths: string[] = [];
  for (const page of PERMISSION_PAGES) {
    if (permissions.pages[page.key]) {
      paths.push(page.path);
    }
  }
  return paths;
}

export function getFeatureAccessKeys(permissions: Permissions): string[] {
  return Object.entries(permissions.features)
    .filter(([, value]) => value)
    .map(([key]) => key);
}
