import prisma from "@/lib/prisma";
import {
  type Permissions,
  type ResourceKey,
  type CrudAction,
  type PageKey,
  type FeatureKey,
  PERMISSION_PAGES,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  DEFAULT_VIEWER_PERMISSIONS,
  createEmptyPermissions,
} from "@/config/permissions";

function mergePermissions(base: Permissions, override: Partial<Permissions>): Permissions {
  const merged: Permissions = JSON.parse(JSON.stringify(base));

  if (override.resources) {
    for (const [key, value] of Object.entries(override.resources)) {
      if (value && merged.resources[key]) {
        merged.resources[key] = { ...merged.resources[key], ...value };
      } else if (value) {
        merged.resources[key] = value;
      }
    }
  }

  if (override.pages) {
    for (const [key, value] of Object.entries(override.pages)) {
      if (typeof value === "boolean") {
        merged.pages[key] = value;
      }
    }
  }

  if (override.features) {
    for (const [key, value] of Object.entries(override.features)) {
      if (typeof value === "boolean") {
        merged.features[key] = value;
      }
    }
  }

  return merged;
}

function getDefaultPermissionsForRole(role: string): Permissions {
  switch (role) {
    case "ADMIN":
      return DEFAULT_ADMIN_PERMISSIONS;
    case "MEMBER":
      return DEFAULT_MEMBER_PERMISSIONS;
    case "VIEWER":
      return DEFAULT_VIEWER_PERMISSIONS;
    default:
      return createEmptyPermissions();
  }
}

export async function getUserPermissions(userId: string): Promise<Permissions> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customRole: true,
      permissionOverride: true,
    },
  });

  if (!user) {
    return createEmptyPermissions();
  }

  let basePermissions: Permissions;

  if (user.customRole) {
    basePermissions = user.customRole.permissions as unknown as Permissions;
  } else {
    basePermissions = getDefaultPermissionsForRole(user.role);
  }

  if (user.permissionOverride) {
    return mergePermissions(basePermissions, user.permissionOverride.permissions as unknown as Partial<Permissions>);
  }

  return basePermissions;
}

export function hasResourcePermission(
  permissions: Permissions,
  resource: ResourceKey,
  action: CrudAction
): boolean {
  return permissions.resources[resource]?.[action] ?? false;
}

export function hasPageAccess(permissions: Permissions, pageKey: PageKey): boolean {
  return permissions.pages[pageKey] ?? false;
}

export function hasFeatureAccess(permissions: Permissions, featureKey: FeatureKey): boolean {
  return permissions.features[featureKey] ?? false;
}

export async function requirePermission(
  userId: string,
  resource: ResourceKey,
  action: CrudAction
): Promise<{ allowed: true; permissions: Permissions } | { allowed: false; error: string }> {
  const permissions = await getUserPermissions(userId);
  if (!hasResourcePermission(permissions, resource, action)) {
    return { allowed: false, error: `You don't have permission to ${action} ${resource}` };
  }
  return { allowed: true, permissions };
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
