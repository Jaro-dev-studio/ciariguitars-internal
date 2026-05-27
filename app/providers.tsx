"use client";

import { Toaster } from "sonner";
import { ModalProvider } from "@/components/modal/provider";
import { CreateTaskModalProvider } from "@/components/modals/create-task-modal-provider";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Toaster/>
      <ModalProvider>
        <CreateTaskModalProvider>
          {children}
        </CreateTaskModalProvider>
      </ModalProvider>
    </SessionProvider>
  );
}
