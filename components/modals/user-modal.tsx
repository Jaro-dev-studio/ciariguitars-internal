"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser } from "@/lib/actions";
import { Loader2 } from "lucide-react";
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

const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  roleId: z.string().min(1, "Role is required"),
  projectId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { user: any; generatedPassword: string }) => void;
  projects: Project[];
  roles: RoleData[];
}

export function UserModal({ isOpen, onClose, onSuccess, projects, roles }: UserModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      roleId: roles[0]?.id || "",
      projectId: undefined,
    },
  });

  const selectedRoleId = useWatch({
    control: form.control,
    name: "roleId",
  });

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isViewerRole = selectedRole?.name === "Viewer";

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);
    try {
      const role = roles.find((r) => r.id === data.roleId);
      const legacyRole = role?.name.toUpperCase() as UserRole;
      const validLegacy = ["ADMIN", "MEMBER", "VIEWER"].includes(legacyRole) ? legacyRole : "VIEWER" as UserRole;

      const result = await createUser({
        email: data.email,
        role: validLegacy,
        roleId: data.roleId,
      });

      if (result.error) {
        form.setError("email", { message: result.error });
        return;
      }

      if (result.data) {
        onSuccess(result.data);
        form.reset();
        onClose();
      }
    } catch (error) {
      console.error("Error creating user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleRoleChange = (value: string) => {
    form.setValue("roleId", value);
    const role = roles.find((r) => r.id === value);
    if (role?.name !== "Viewer") {
      form.setValue("projectId", undefined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={handleRoleChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                          {role.description ? ` - ${role.description}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isViewerRole && (
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    {projects.length === 0 ? (
                      <p className="text-sm text-warning-600">
                        No projects available. Create a project first before adding viewer users.
                      </p>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <p className="text-sm text-secondary-500">
              A password will be automatically generated for this user.
            </p>

            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={isLoading || (isViewerRole && projects.length === 0)} 
                className="relative flex-1"
              >
                <span className={isLoading ? "opacity-0" : ""}>
                  Create User
                </span>
                {isLoading && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-4 animate-spin" />
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
