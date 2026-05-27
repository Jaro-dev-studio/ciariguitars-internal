"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Plus, MoreHorizontal, Trash2, Key, Shield, Users as UsersIcon, Building2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserModal } from "@/components/modals/user-modal";
import { deleteUser, updateUserRole, resetUserPassword, getImpersonationPassword, addProjectMember } from "@/lib/actions";
import { UserRole } from "@prisma/client";

interface Project {
  id: string;
  name: string;
}

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  projects: { project: Project }[];
  createdAt: Date;
  updatedAt: Date;
}

interface UsersClientProps {
  users: UserData[];
  currentUserId: string;
  projects: Project[];
  roles: RoleData[];
}

export function UsersClient({ users: initialUsers, currentUserId, projects, roles }: UsersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [passwordDialog, setPasswordDialog] = useState<{
    isOpen: boolean;
    password: string;
    email: string;
  }>({ isOpen: false, password: "", email: "" });
  const [copied, setCopied] = useState(false);
  const [projectLinkDialog, setProjectLinkDialog] = useState<{
    isOpen: boolean;
    userId: string;
    selectedProjectId: string;
  }>({ isOpen: false, userId: "", selectedProjectId: "" });
  const router = useRouter();

  const handleCreateUser = () => {
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserId) {
      alert("You cannot delete your own account");
      return;
    }

    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(userId);
    try {
      const result = await deleteUser(userId);
      if (result.error) {
        alert(result.error);
        return;
      }

      setUsers(users.filter((u) => u.id !== userId));
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    if (userId === currentUserId) {
      alert("You cannot change your own role");
      return;
    }

    const selectedRole = roles.find((r) => r.id === roleId);
    if (!selectedRole) return;

    const legacyRole = selectedRole.name.toUpperCase() as UserRole;
    const validLegacy = ["ADMIN", "MEMBER", "VIEWER"].includes(legacyRole) ? legacyRole : "VIEWER" as UserRole;

    if (selectedRole.name === "Viewer") {
      if (projects.length === 0) {
        alert("No projects available. Create a project first.");
        return;
      }
      setProjectLinkDialog({
        isOpen: true,
        userId,
        selectedProjectId: projects[0]?.id || "",
      });
      return;
    }

    try {
      const result = await updateUserRole(userId, validLegacy, roleId);
      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.data) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, ...result.data } : u)));
      }
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  const handleProjectLinkConfirm = async () => {
    const { userId, selectedProjectId } = projectLinkDialog;
    
    if (!selectedProjectId) {
      alert("Please select a project");
      return;
    }

    const viewerRole = roles.find((r) => r.name === "Viewer");

    try {
      const roleResult = await updateUserRole(userId, "VIEWER", viewerRole?.id);
      if (roleResult.error) {
        alert(roleResult.error);
        return;
      }

      const memberResult = await addProjectMember(selectedProjectId, userId);
      if (memberResult.error) {
        alert(memberResult.error);
        return;
      }

      if (roleResult.data) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, ...roleResult.data } : u)));
      }
      setProjectLinkDialog({ isOpen: false, userId: "", selectedProjectId: "" });
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to reset the password for ${email}?`)) {
      return;
    }

    try {
      const result = await resetUserPassword(userId);
      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.data?.newPassword) {
        setPasswordDialog({
          isOpen: true,
          password: result.data.newPassword,
          email: email,
        });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
    }
  };

  const handleModalSuccess = (data: { user: UserData; generatedPassword: string }) => {
    setUsers([data.user, ...users]);
    setPasswordDialog({
      isOpen: true,
      password: data.generatedPassword,
      email: data.user.email,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignInAs = async (email: string) => {
    try {
      const result = await getImpersonationPassword();
      if (result.error) {
        alert(result.error);
        return;
      }

      if (!result.data?.password) {
        alert("Unable to get impersonation password");
        return;
      }

      await signIn("credentials", {
        email,
        password: result.data.password,
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      console.error("Error signing in as user:", error);
      alert("Failed to sign in as user");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Users</h1>
          <p className="text-secondary-600">Manage users and their roles</p>
        </div>
        <Button onClick={handleCreateUser} size="sm" className="sm:size-default">
          <Plus className="mr-2 size-4" />
          New User
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="p-8 text-center">
          <UsersIcon className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No users yet</h3>
          <p className="mt-2 text-secondary-600">Get started by creating your first user</p>
          <Button onClick={handleCreateUser} className="mt-4">
            <Plus className="mr-2 size-4" />
            Create User
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary-500 text-sm font-medium text-white">
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-secondary-900">{user.email}</p>
                          {user.id === currentUserId && (
                            <span className="text-xs text-secondary-500">(You)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.id === currentUserId ? (
                        <Badge variant="outline">{user.role}</Badge>
                      ) : (
                        <Select
                          value={roles.find((r) => r.name.toUpperCase() === user.role)?.id || ""}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                                {role.isSystem ? "" : " (Custom)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      {user.id !== currentUserId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.role !== "ADMIN" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleSignInAs(user.email)}
                                >
                                  <LogIn className="mr-2 size-4" />
                                  Sign in as
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleResetPassword(user.id, user.email)}
                            >
                              <Key className="mr-2 size-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={isDeleting === user.id}
                              className="text-danger-600 focus:text-danger-600"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        projects={projects}
        roles={roles}
      />

      {/* Password Dialog */}
      <Dialog open={passwordDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setPasswordDialog({ ...passwordDialog, isOpen: false });
          setCopied(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-primary-500" />
              Generated Password
            </DialogTitle>
            <DialogDescription>
              Save this password - it will only be shown once. Share it securely with the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium text-secondary-700">Email</p>
              <p className="text-secondary-900">{passwordDialog.email}</p>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-secondary-700">Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-secondary-100 px-3 py-2 font-mono text-sm">
                  {passwordDialog.password}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(passwordDialog.password)}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPasswordDialog({ ...passwordDialog, isOpen: false })}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Link Dialog */}
      <Dialog 
        open={projectLinkDialog.isOpen} 
        onOpenChange={(open) => !open && setProjectLinkDialog({ isOpen: false, userId: "", selectedProjectId: "" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary-500" />
              Link to Project
            </DialogTitle>
            <DialogDescription>
              Select a project to link this user to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={projectLinkDialog.selectedProjectId}
              onValueChange={(value) => setProjectLinkDialog({ ...projectLinkDialog, selectedProjectId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleProjectLinkConfirm}>
              Confirm
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setProjectLinkDialog({ isOpen: false, userId: "", selectedProjectId: "" })}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
