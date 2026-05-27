"use client";

import { useState, useEffect } from "react";
import { GlobalAIChatPanel } from "./GlobalAIChatPanel";

export function GlobalAIChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + I to toggle chat
      if ((event.metaKey || event.ctrlKey) && event.key === "i") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to close
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <GlobalAIChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
  );
}
