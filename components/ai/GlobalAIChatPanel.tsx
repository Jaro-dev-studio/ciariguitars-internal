"use client";

import { X, Send, Plus, Trash2, MessageSquare, Loader2, Pencil, Check, Search, Copy, CheckCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Chat {
  id: string;
  title: string;
  lastMessage: string | null;
  updatedAt: string;
  messages?: Message[] | null;
}

interface PendingAction {
  type: "deleteTasks" | "deleteProjects" | "deleteRecurringTasks";
  ids: string[];
  itemNames: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; args: unknown; result: unknown }>;
  pendingAction?: PendingAction;
  actionStatus?: "pending" | "confirmed" | "cancelled";
  createdAt: string;
}

interface StreamStatus {
  message: string;
  activeTools: string[];
}

interface GlobalAIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalAIChatPanel({ isOpen, onClose }: GlobalAIChatPanelProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const hasLoadedChats = useRef(false);

  // Filter chats based on search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter((chat) => {
      // Check title
      if (chat.title.toLowerCase().includes(query)) return true;
      // Check last message
      if (chat.lastMessage?.toLowerCase().includes(query)) return true;
      // Check cached messages content
      const cachedMessages = messagesCache[chat.id];
      if (cachedMessages) {
        return cachedMessages.some((msg) =>
          msg.content.toLowerCase().includes(query)
        );
      }
      return false;
    });
  }, [chats, searchQuery, messagesCache]);

  // Fetch chats once on mount
  const fetchChats = useCallback(async () => {
    try {
      setIsLoadingChats(true);
      const response = await fetch("/api/ai-chat");
      const data = await response.json();
      if (data.data) {
        const loadedChats = data.data as Chat[];
        setChats(loadedChats);

        // Build messages cache from preloaded messages
        const cache: Record<string, Message[]> = {};
        loadedChats.forEach((chat) => {
          if (chat.messages) {
            cache[chat.id] = chat.messages;
          }
        });
        setMessagesCache(cache);

        // Auto-open the last conversation (first in the sorted list)
        if (loadedChats.length > 0) {
          const lastChat = loadedChats[0];
          setActiveChatId(lastChat.id);
          if (lastChat.messages) {
            setMessages(lastChat.messages);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  // Fetch messages for active chat
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/ai-chat/${chatId}`);
      const data = await response.json();
      if (data.data) {
        setMessages(data.data.messages);
        // Add to cache
        setMessagesCache((prev) => ({
          ...prev,
          [chatId]: data.data.messages,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load chats once on component mount
  useEffect(() => {
    if (!hasLoadedChats.current) {
      hasLoadedChats.current = true;
      fetchChats();
    }
  }, [fetchChats]);

  useEffect(() => {
    if (activeChatId) {
      // Check if messages are already in cache
      if (messagesCache[activeChatId]) {
        setMessages(messagesCache[activeChatId]);
      } else {
        fetchMessages(activeChatId);
      }
    } else {
      setMessages([]);
    }
  }, [activeChatId, messagesCache, fetchMessages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Prevent background scroll when panel is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createNewChat = async () => {
    try {
      const response = await fetch("/api/ai-chat", { method: "POST" });
      const data = await response.json();
      if (data.data) {
        setChats((prev) => [{ ...data.data, lastMessage: null, updatedAt: data.data.createdAt }, ...prev]);
        setActiveChatId(data.data.id);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      await fetch(`/api/ai-chat/${chatId}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const startEditingChat = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const saveEditingChat = async () => {
    if (!editingChatId || !editingTitle.trim()) {
      setEditingChatId(null);
      return;
    }

    try {
      await fetch(`/api/ai-chat/${editingChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      setChats((prev) =>
        prev.map((c) =>
          c.id === editingChatId ? { ...c, title: editingTitle.trim() } : c
        )
      );
    } catch (error) {
      console.error("Failed to rename chat:", error);
    } finally {
      setEditingChatId(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditingChat();
    } else if (e.key === "Escape") {
      setEditingChatId(null);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || isSending) return;

    // Create new chat if none selected
    let chatId = activeChatId;
    if (!chatId) {
      try {
        const response = await fetch("/api/ai-chat", { method: "POST" });
        const data = await response.json();
        if (data.data) {
          chatId = data.data.id;
          setChats((prev) => [{ ...data.data, lastMessage: null, updatedAt: data.data.createdAt }, ...prev]);
          setActiveChatId(chatId);
        }
      } catch (error) {
        console.error("Failed to create chat:", error);
        return;
      }
    }

    if (!chatId) return;

    setIsSending(true);
    setStreamingContent("");
    setStreamStatus({ message: "Sending...", activeTools: [] });
    const userMessage = message.trim();
    
    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => {
      const newMessages = [...prev, tempUserMessage];
      // Update cache with user message
      if (chatId) {
        setMessagesCache((cache) => ({
          ...cache,
          [chatId]: newMessages,
        }));
      }
      return newMessages;
    });
    setMessage("");

    try {
      const response = await fetch(`/api/ai-chat/${chatId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let toolCalls: Array<{ name: string; args: unknown; result: unknown }> = [];
      let pendingAction: PendingAction | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              
              switch (event.type) {
                case "status":
                  setStreamStatus((prev) => ({
                    ...prev || { activeTools: [] },
                    message: event.message,
                  }));
                  break;
                case "tool_start":
                  setStreamStatus((prev) => ({
                    message: prev?.message || "Processing...",
                    activeTools: [...(prev?.activeTools || []), event.name],
                  }));
                  break;
                case "tool_end":
                  setStreamStatus((prev) => ({
                    message: prev?.message || "Processing...",
                    activeTools: (prev?.activeTools || []).filter((t) => t !== event.name),
                  }));
                  break;
                case "content":
                  accumulatedContent += event.content;
                  setStreamingContent(accumulatedContent);
                  break;
                case "pending_action":
                  pendingAction = event.action;
                  break;
                case "done":
                  toolCalls = event.toolCalls || [];
                  if (event.title && chatId) {
                    setChats((prev) =>
                      prev.map((c) =>
                        c.id === chatId ? { ...c, title: event.title! } : c
                      )
                    );
                  }
                  break;
                case "error":
                  throw new Error(event.message);
              }
            } catch (parseError) {
              if (parseError instanceof Error && parseError.message !== "Unexpected end of JSON input") {
                throw parseError;
              }
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: accumulatedContent || "I apologize, but I couldn't generate a response.",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        pendingAction,
        actionStatus: pendingAction ? "pending" : undefined,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage];
        if (chatId) {
          setMessagesCache((cache) => ({
            ...cache,
            [chatId]: newMessages,
          }));
        }
        return newMessages;
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, there was an error processing your request. Please try again.",
          createdAt: new Date().toISOString(),
        };
        const newMessages = [...prev, errorMessage];
        // Update cache with error message too
        if (chatId) {
          setMessagesCache((cache) => ({
            ...cache,
            [chatId]: newMessages,
          }));
        }
        return newMessages;
      });
    } finally {
      setIsSending(false);
      setStreamStatus(null);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const formatToolName = (name: string): string => {
    const toolNameMap: Record<string, string> = {
      listTasks: "Searching Tasks",
      listProjects: "Searching Projects",
      listUsers: "Searching Users",
      listRecurringTasks: "Searching Recurring Tasks",
      getStats: "Getting Statistics",
      createTask: "Creating Task",
      createProject: "Creating Project",
      createRecurringTask: "Creating Recurring Task",
      updateTask: "Updating Task",
      updateProject: "Updating Project",
      updateRecurringTask: "Updating Recurring Task",
      deleteTasks: "Preparing Deletion",
      deleteProjects: "Preparing Deletion",
      deleteRecurringTasks: "Preparing Deletion",
    };
    return toolNameMap[name] || name;
  };

  const actionTypeLabels: Record<string, string> = {
    deleteTasks: "tasks",
    deleteProjects: "projects",
    deleteRecurringTasks: "recurring tasks",
  };

  const handleConfirmAction = useCallback(async (messageId: string, action: PendingAction) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "confirmed" as const } : m))
    );

    try {
      const response = await fetch("/api/ai-chat/confirm-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: action.type, ids: action.ids }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Deleted ${data.deletedCount} ${actionTypeLabels[action.type]}`);
      } else {
        toast.error(data.error || "Failed to delete");
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "pending" as const } : m))
        );
      }
    } catch {
      toast.error("Failed to execute deletion");
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "pending" as const } : m))
      );
    }
  }, []);

  const handleCancelAction = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, actionStatus: "cancelled" as const } : m))
    );
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[90%] flex-col overflow-hidden border-l border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-secondary/20 flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-9 items-center justify-center rounded-lg">
              <MessageSquare className="text-primary size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Assistant</h2>
              <p className="text-xs text-muted-foreground">Ask anything about your data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={createNewChat}>
              <Plus className="mr-1.5 size-4" />
              New Chat
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-secondary">
              <X className="size-5" />
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          {/* Chat list sidebar */}
          <div className="bg-secondary/10 flex w-64 shrink-0 flex-col overflow-hidden border-r border-border">
            {/* Search */}
            <div className="border-b border-border p-3">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 z-10 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="focus:ring-primary/20 h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2"
                />
              </div>
            </div>

            {/* Chat list */}
            <ScrollArea className="flex-1 [&>div>div]:!block [&>div>div]:!min-w-0">
              <div className="w-full p-2">
                {isLoadingChats ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredChats.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    {searchQuery ? "No matching chats found" : "No chats yet. Start a new conversation!"}
                  </p>
                ) : (
                  <div className="flex w-full flex-col gap-1">
                    {filteredChats.map((chat) => (
                      <div
                        key={chat.id}
                        className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg p-2.5 text-sm transition-all ${
                          activeChatId === chat.id
                            ? "bg-primary/15 ring-primary/30 text-foreground shadow-sm ring-1"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                        onClick={() => editingChatId !== chat.id && setActiveChatId(chat.id)}
                      >
                        {editingChatId === chat.id ? (
                          <div className="flex min-w-0 flex-1 items-center gap-1">
                            <Input
                              ref={editInputRef}
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onBlur={saveEditingChat}
                              className="h-7 px-2 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEditingChat();
                              }}
                            >
                              <Check className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="truncate" title={chat.title}>
                              {chat.title}
                            </span>
                            <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-secondary-foreground/10 size-6"
                                onClick={(e) => startEditingChat(chat, e)}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteChat(chat.id);
                                }}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat area */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4 [&>div>div]:!block [&>div>div]:!min-w-0">
              {messages.length === 0 && !isLoading && !isSending ? (
                <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
                  <div className="bg-primary/10 flex size-16 items-center justify-center rounded-2xl">
                    <MessageSquare className="text-primary size-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Welcome to AI Assistant</h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Ask me anything about your tasks, clients, funnel metrics, and more. I can help you find information quickly.
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {[
                      "How many tasks are overdue?",
                      "What's our ad spend this month?",
                      "Show blocked tasks",
                      "Recent calls this week",
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="hover:bg-primary/5 hover:border-primary/30"
                        onClick={() => {
                          setMessage(suggestion);
                          inputRef.current?.focus();
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex w-full min-w-0 flex-col gap-6">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex min-w-0 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {/* Message bubble */}
                      <div
                        className={`group/msg max-w-[85%] overflow-hidden rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm shadow-md"
                            : "rounded-bl-sm border border-border bg-card shadow-sm"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <>
                            <div className="prose prose-sm max-w-full break-words dark:prose-invert [&>*]:max-w-full [&_p]:break-words [&_pre]:overflow-x-auto">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {msg.pendingAction && (
                              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                                  <AlertTriangle className="size-4" />
                                  Delete {msg.pendingAction.ids.length} {actionTypeLabels[msg.pendingAction.type]}
                                </div>
                                <ul className="mb-3 ml-1 space-y-0.5">
                                  {msg.pendingAction.itemNames.map((name, i) => (
                                    <li key={i} className="text-xs text-muted-foreground">
                                      &bull; {name}
                                    </li>
                                  ))}
                                </ul>
                                {msg.actionStatus === "pending" && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 text-xs"
                                      onClick={() => handleConfirmAction(msg.id, msg.pendingAction!)}
                                    >
                                      Confirm Delete
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => handleCancelAction(msg.id)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                                {msg.actionStatus === "confirmed" && (
                                  <p className="text-xs font-medium text-success-600">Deleted successfully</p>
                                )}
                                {msg.actionStatus === "cancelled" && (
                                  <p className="text-xs text-muted-foreground">Deletion cancelled</p>
                                )}
                              </div>
                            )}
                            {msg.toolCalls && msg.toolCalls.length > 0 && (
                              <div className="mt-3 border-t border-border/30 pt-2">
                                <p className="text-xs opacity-70">
                                  Used {msg.toolCalls.length} tool{msg.toolCalls.length > 1 ? "s" : ""}:{" "}
                                  {msg.toolCalls.map((tc) => formatToolName(tc.name)).join(", ")}
                                </p>
                              </div>
                            )}
                            <div className="mt-2 flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => copyToClipboard(msg.id, msg.content)}
                              >
                                {copiedMessageId === msg.id ? (
                                  <>
                                    <CheckCheck className="size-3.5" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3.5" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="max-w-full whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] overflow-hidden rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 shadow-sm">
                        {streamingContent ? (
                          <div className="prose prose-sm max-w-full break-words dark:prose-invert [&>*]:max-w-full [&_p]:break-words [&_pre]:overflow-x-auto">
                            <ReactMarkdown>{streamingContent}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Loader2 className="text-primary size-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">
                                {streamStatus?.message || "Thinking..."}
                              </span>
                            </div>
                            {streamStatus?.activeTools && streamStatus.activeTools.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {streamStatus.activeTools.map((tool) => (
                                  <span
                                    key={tool}
                                    className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                                  >
                                    <Loader2 className="size-3 animate-spin" />
                                    {formatToolName(tool)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="bg-secondary/5 border-t border-border p-4">
              <div className="flex gap-3">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about tasks, clients, metrics..."
                  className="focus:ring-primary/20 flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2"
                  rows={1}
                  disabled={isSending}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={isSending || !message.trim()}
                  size="icon"
                  className="size-11 shrink-0 rounded-xl shadow-sm"
                >
                  {isSending ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Send className="size-5" />
                  )}
                </Button>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
