"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, Trash2, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createRole, updateRole, deleteRole } from "@/lib/actions";
import {
  PERMISSION_RESOURCES,
  PERMISSION_PAGES,
  PERMISSION_FEATURES,
  CRUD_ACTIONS,
  type Permissions,
  type ResourcePermissions,
  createEmptyPermissions,
} from "@/config/permissions";

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permissions;
  _count: { users: number };
  createdAt: Date;
  updatedAt: Date;
}

interface RolesClientProps {
  roles: RoleData[];
}

function PermissionsEditor({
  permissions,
  onChange,
  disabled,
}: {
  permissions: Permissions;
  onChange: (permissions: Permissions) => void;
  disabled?: boolean;
}) {
  const handleResourceChange = (
    resourceKey: string,
    action: string,
    checked: boolean
  ) => {
    const updated = { ...permissions };
    updated.resources = { ...updated.resources };
    updated.resources[resourceKey] = {
      ...updated.resources[resourceKey],
      [action]: checked,
    };
    onChange(updated);
  };

  const handlePageChange = (pageKey: string, checked: boolean) => {
    const updated = { ...permissions };
    updated.pages = { ...updated.pages, [pageKey]: checked };
    onChange(updated);
  };

  const handleFeatureChange = (featureKey: string, checked: boolean) => {
    const updated = { ...permissions };
    updated.features = { ...updated.features, [featureKey]: checked };
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 text-sm font-medium text-secondary-900">
          Resource Permissions (CRUD)
        </h4>
        <div className="overflow-x-auto rounded-lg border border-secondary-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary-200 bg-secondary-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                  Resource
                </th>
                {CRUD_ACTIONS.map((action) => (
                  <th
                    key={action}
                    className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-secondary-500"
                  >
                    {action}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-200">
              {PERMISSION_RESOURCES.map((resource) => (
                <tr key={resource.key} className="hover:bg-secondary-50/50">
                  <td className="px-4 py-2.5 text-sm font-medium text-secondary-900">
                    {resource.label}
                  </td>
                  {CRUD_ACTIONS.map((action) => (
                    <td key={action} className="px-4 py-2.5 text-center">
                      <Checkbox
                        checked={
                          permissions.resources[resource.key]?.[action] ?? false
                        }
                        onCheckedChange={(checked) =>
                          handleResourceChange(
                            resource.key,
                            action,
                            checked === true
                          )
                        }
                        disabled={disabled}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-medium text-secondary-900">
          Page Access
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {PERMISSION_PAGES.map((page) => (
            <label
              key={page.key}
              className="flex items-center gap-2 rounded-lg border border-secondary-200 px-3 py-2.5 text-sm"
            >
              <Checkbox
                checked={permissions.pages[page.key] ?? false}
                onCheckedChange={(checked) =>
                  handlePageChange(page.key, checked === true)
                }
                disabled={disabled}
              />
              <span className="text-secondary-900">{page.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-medium text-secondary-900">
          Feature Access
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {PERMISSION_FEATURES.map((feature) => (
            <label
              key={feature.key}
              className="flex items-center gap-2 rounded-lg border border-secondary-200 px-3 py-2.5 text-sm"
            >
              <Checkbox
                checked={permissions.features[feature.key] ?? false}
                onCheckedChange={(checked) =>
                  handleFeatureChange(feature.key, checked === true)
                }
                disabled={disabled}
              />
              <span className="text-secondary-900">{feature.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RolesClient({ roles: initialRoles }: RolesClientProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id || "");
  const [editedPermissions, setEditedPermissions] =
    useState<Record<string, Permissions>>(() => {
      const map: Record<string, Permissions> = {};
      for (const role of initialRoles) {
        map[role.id] = role.permissions;
      }
      return map;
    });
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<Permissions>(
    createEmptyPermissions()
  );
  const router = useRouter();

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isAdminRole = selectedRole?.name === "Admin" && selectedRole?.isSystem;
  const hasChanges =
    selectedRole &&
    JSON.stringify(editedPermissions[selectedRoleId]) !==
      JSON.stringify(selectedRole.permissions);

  const handleSave = async () => {
    if (!selectedRole || !hasChanges) return;
    setIsSaving(true);
    try {
      const result = await updateRole(selectedRole.id, {
        permissions: editedPermissions[selectedRoleId],
      });
      if (result.error) {
        alert(result.error);
        return;
      }
      setRoles(
        roles.map((r) =>
          r.id === selectedRoleId
            ? { ...r, permissions: editedPermissions[selectedRoleId] }
            : r
        )
      );
      router.refresh();
    } catch (error) {
      console.error("Error saving role:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedRole) {
      setEditedPermissions((prev) => ({
        ...prev,
        [selectedRoleId]: selectedRole.permissions,
      }));
    }
  };

  const handleCreate = async () => {
    if (!newRoleName.trim()) return;
    setIsSaving(true);
    try {
      const result = await createRole({
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
        permissions: newRolePermissions,
      });
      if (result.error) {
        alert(result.error);
        return;
      }
      setIsCreateOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
      setNewRolePermissions(createEmptyPermissions());
      router.refresh();
    } catch (error) {
      console.error("Error creating role:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole || selectedRole.isSystem) return;
    if (
      !confirm(
        `Are you sure you want to delete the "${selectedRole.name}" role?`
      )
    )
      return;

    try {
      const result = await deleteRole(selectedRole.id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Roles & Permissions
          </h1>
          <p className="text-secondary-600">
            Manage roles and their granular permissions
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} size="sm">
          <Plus className="mr-2 size-4" />
          New Role
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-1">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                selectedRoleId === role.id
                  ? "border-primary bg-primary/5"
                  : "border-secondary-200 hover:border-secondary-300"
              }`}
            >
              <Shield className="size-4 shrink-0 text-secondary-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-secondary-900">
                    {role.name}
                  </span>
                  {role.isSystem && (
                    <Badge variant="outline" className="text-xs">
                      System
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-secondary-500">
                  <Users className="size-3" />
                  <span>
                    {role._count.users} user{role._count.users !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <Card className="p-6 lg:col-span-3">
          {selectedRole ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-secondary-900">
                      {selectedRole.name}
                    </h2>
                    {selectedRole.isSystem && (
                      <Badge variant="outline">System</Badge>
                    )}
                  </div>
                  {selectedRole.description && (
                    <p className="mt-1 text-sm text-secondary-600">
                      {selectedRole.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!selectedRole.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
                      className="text-danger-600"
                    >
                      <Trash2 className="mr-1 size-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {isAdminRole ? (
                <div className="flex items-center gap-2 rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-600">
                  <Lock className="size-4" />
                  The Admin system role always has full permissions.
                </div>
              ) : (
                <>
                  <PermissionsEditor
                    permissions={
                      editedPermissions[selectedRoleId] ??
                      selectedRole.permissions
                    }
                    onChange={(perms) =>
                      setEditedPermissions((prev) => ({
                        ...prev,
                        [selectedRoleId]: perms,
                      }))
                    }
                  />

                  {hasChanges && (
                    <div className="flex items-center justify-end gap-2 border-t border-secondary-200 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                      >
                        Discard
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-secondary-500">
              Select a role to view and edit its permissions
            </div>
          )}
        </Card>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Define a new role with custom permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">
                Name
              </label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Project Manager"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">
                Description
              </label>
              <Textarea
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <PermissionsEditor
              permissions={newRolePermissions}
              onChange={setNewRolePermissions}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !newRoleName.trim()}
            >
              {isSaving ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
