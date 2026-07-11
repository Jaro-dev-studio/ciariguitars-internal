"use server";

import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import type { Permissions } from "@/config/permissions";

// ============================================
// PROJECTS
// ============================================

export async function getProjects() {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: projects, error: null };
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { data: null, error: "Failed to fetch projects" };
  }
}

export async function getProject(id: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      return { data: null, error: "Project not found" };
    }

    return { data: project, error: null };
  } catch (error) {
    console.error("Error fetching project:", error);
    return { data: null, error: "Failed to fetch project" };
  }
}

// ============================================
// USERS
// ============================================

export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { data: null, error: "Failed to fetch users" };
  }
}

export async function getAssignableUsers() {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "MEMBER"] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { email: "asc" },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return { data: null, error: "Failed to fetch assignable users" };
  }
}

// ============================================
// TASKS
// ============================================

export async function getTasks() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        blockedByTasks: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        attachments: {
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            size: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: tasks, error: null };
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return { data: null, error: "Failed to fetch tasks" };
  }
}

export async function getTask(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        blockedByTasks: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        attachments: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (!task) {
      return { data: null, error: "Task not found" };
    }

    return { data: task, error: null };
  } catch (error) {
    console.error("Error fetching task:", error);
    return { data: null, error: "Failed to fetch task" };
  }
}

export async function getTasksByProject(projectId: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        blockedByTasks: {
          select: { id: true, name: true, status: true },
        },
        attachments: {
          select: { id: true, name: true, url: true, type: true, size: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: tasks, error: null };
  } catch (error) {
    console.error("Error fetching tasks by project:", error);
    return { data: null, error: "Failed to fetch tasks" };
  }
}

// ============================================
// RECURRING TASKS
// ============================================

export async function getRecurringTasks() {
  try {
    const recurringTasks = await prisma.recurringTask.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: recurringTasks, error: null };
  } catch (error) {
    console.error("Error fetching recurring tasks:", error);
    return { data: null, error: "Failed to fetch recurring tasks" };
  }
}

export async function getRecurringTask(id: string) {
  try {
    const recurringTask = await prisma.recurringTask.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    if (!recurringTask) {
      return { data: null, error: "Recurring task not found" };
    }

    return { data: recurringTask, error: null };
  } catch (error) {
    console.error("Error fetching recurring task:", error);
    return { data: null, error: "Failed to fetch recurring task" };
  }
}

// ============================================
// PERMISSIONS
// ============================================

export async function fetchUserPermissions(userId: string): Promise<{
  data: Permissions | null;
  error: string | null;
}> {
  try {
    const permissions = await getUserPermissions(userId);
    return { data: permissions, error: null };
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return { data: null, error: "Failed to fetch permissions" };
  }
}

// ============================================
// INTEGRATION DASHBOARD
// ============================================

export async function fetchDashboardData() {
  try {
    console.log("[Dashboard] Fetching dashboard overview data...");
    
    const [
      inventoryItems,
      recentSyncs,
      alerts,
      integrations,
      productionOrders,
    ] = await Promise.all([
      prisma.inventoryItem.findMany({
        select: {
          id: true,
          category: true,
          isReadyToShip: true,
          katanaQty: true,
        },
      }).catch(() => []),
      prisma.syncLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          inventoryItem: {
            select: { sku: true, name: true },
          },
        },
      }).catch(() => []),
      prisma.alert.findMany({
        where: { isDismissed: false },
        take: 5,
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
      prisma.integrationConnection.findMany().catch(() => []),
      prisma.productionOrder.findMany({
        where: { status: { not: "CANCELLED" } },
      }).catch(() => []),
    ]);

    console.log("[Dashboard] Processing metrics...");

    const finishedGoods = inventoryItems.filter(i => i.category === "FINISHED_GOOD").length;
    const rawMaterials = inventoryItems.filter(i => i.category === "RAW_MATERIAL").length;
    const readyToShip = inventoryItems.filter(i => i.isReadyToShip).length;
    const lowStock = inventoryItems.filter(i => i.katanaQty < 5).length;

    const activeOrders = productionOrders.filter(o => o.status === "IN_PROGRESS").length;
    const completedToday = productionOrders.filter(o => {
      if (!o.completedAt) return false;
      const today = new Date();
      return o.completedAt.toDateString() === today.toDateString();
    }).length;
    const onHold = productionOrders.filter(o => o.status === "ON_HOLD").length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const syncedToday = recentSyncs.filter(s => s.createdAt >= today).length;
    const pendingCount = recentSyncs.filter(s => s.status === "PENDING").length;
    const errorCount = recentSyncs.filter(s => s.status === "FAILED").length;

    const platforms = ["KATANA", "REVERB", "SHOPIFY", "SHIPSTATION", "MANAGEMARKETS", "SHOPFLOW"];
    const integrationStatus = platforms.map(platform => {
      const conn = integrations.find(i => i.platform === platform);
      return {
        platform: platform.charAt(0) + platform.slice(1).toLowerCase(),
        status: conn?.isActive ? "connected" : "disconnected",
        lastSync: conn?.lastSyncAt ? formatTimeAgo(conn.lastSyncAt) : null,
      };
    });

    const data = {
      integrationStatus,
      metrics: {
        totalSkus: inventoryItems.length,
        syncedToday,
        pendingSync: pendingCount,
        errorCount,
      },
      recentSyncs: recentSyncs.map(s => ({
        id: s.id,
        type: formatSyncType(s.syncType),
        platform: s.platform.charAt(0) + s.platform.slice(1).toLowerCase(),
        status: s.status,
        createdAt: formatTimeAgo(s.createdAt),
        itemCount: 1,
      })),
      alerts: alerts.map(a => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        createdAt: formatTimeAgo(a.createdAt),
      })),
      inventoryOverview: {
        finishedGoods,
        rawMaterials,
        lowStock,
        readyToShip,
      },
      productionStats: {
        activeOrders,
        completedToday,
        onHold,
      },
    };

    console.log("[Dashboard] Data fetched successfully");
    return { data, error: null };
  } catch (error) {
    console.error("[Dashboard] Error fetching dashboard data:", error);
    return { data: null, error: "Failed to fetch dashboard data" };
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

function formatSyncType(type: string): string {
  const map: Record<string, string> = {
    INVENTORY_QUANTITY: "Inventory Quantity",
    INVENTORY_COST: "Cost Sync",
    PRODUCTION_CONSUMPTION: "Production Consumption",
    ORDER_SYNC: "Order Sync",
    SKU_MAPPING: "SKU Mapping",
    LISTING_UPDATE: "Listing Update",
  };
  return map[type] || type;
}

// ============================================
// INVENTORY
// ============================================

export async function fetchInventoryItems() {
  try {
    console.log("[Inventory] Fetching inventory items...");
    
    const items = await prisma.inventoryItem.findMany({
      include: {
        skuMappings: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log("[Inventory] Fetched", items.length, "items");
    return { data: items, error: null };
  } catch (error) {
    console.error("[Inventory] Error fetching inventory items:", error);
    return { data: null, error: "Failed to fetch inventory items" };
  }
}

export async function fetchInventoryItem(id: string) {
  try {
    console.log("[Inventory] Fetching inventory item:", id);
    
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        skuMappings: true,
        syncLogs: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        consumptions: {
          take: 10,
          orderBy: { consumedAt: "desc" },
          include: {
            productionOrder: {
              select: { orderNumber: true, productName: true },
            },
          },
        },
      },
    });

    if (!item) {
      return { data: null, error: "Item not found" };
    }

    return { data: item, error: null };
  } catch (error) {
    console.error("[Inventory] Error fetching inventory item:", error);
    return { data: null, error: "Failed to fetch inventory item" };
  }
}

// ============================================
// SKU MAPPINGS
// ============================================

export async function fetchSKUMappings() {
  try {
    console.log("[SKU Mapping] Fetching SKU mappings...");
    
    const mappings = await prisma.sKUMapping.findMany({
      include: {
        inventoryItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log("[SKU Mapping] Fetched", mappings.length, "mappings");
    return { data: mappings, error: null };
  } catch (error) {
    console.error("[SKU Mapping] Error fetching SKU mappings:", error);
    return { data: null, error: "Failed to fetch SKU mappings" };
  }
}

// ============================================
// SYNC LOGS
// ============================================

export async function fetchSyncLogs(filters?: {
  syncType?: string;
  platform?: string;
  status?: string;
  limit?: number;
}) {
  try {
    console.log("[Sync Logs] Fetching sync logs with filters:", filters);
    
    const where: any = {};
    if (filters?.syncType) where.syncType = filters.syncType;
    if (filters?.platform) where.platform = filters.platform;
    if (filters?.status) where.status = filters.status;

    const logs = await prisma.syncLog.findMany({
      where,
      take: filters?.limit || 100,
      include: {
        inventoryItem: {
          select: { sku: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("[Sync Logs] Fetched", logs.length, "logs");
    return { data: logs, error: null };
  } catch (error) {
    console.error("[Sync Logs] Error fetching sync logs:", error);
    return { data: null, error: "Failed to fetch sync logs" };
  }
}

// ============================================
// ALERTS
// ============================================

export async function fetchAlerts(showDismissed = false, take = 200) {
  try {
    console.log("[Alerts] Fetching alerts...");
    
    const alerts = await prisma.alert.findMany({
      where: showDismissed ? {} : { isDismissed: false },
      orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
      take,
    });

    console.log("[Alerts] Fetched", alerts.length, "alerts");
    return { data: alerts, error: null };
  } catch (error) {
    console.error("[Alerts] Error fetching alerts:", error);
    return { data: null, error: "Failed to fetch alerts" };
  }
}

// ============================================
// INTEGRATIONS
// ============================================

export async function fetchIntegrations() {
  try {
    console.log("[Integrations] Fetching integration connections...");
    
    const connections = await prisma.integrationConnection.findMany({
      orderBy: { platform: "asc" },
    });

    console.log("[Integrations] Fetched", connections.length, "connections");
    return { data: connections, error: null };
  } catch (error) {
    console.error("[Integrations] Error fetching integrations:", error);
    return { data: null, error: "Failed to fetch integrations" };
  }
}

// ============================================
// PRODUCTION ORDERS
// ============================================

export async function fetchProductionOrders(status?: string) {
  try {
    console.log("[Production] Fetching production orders...");
    
    const where: any = {};
    if (status) where.status = status;

    const orders = await prisma.productionOrder.findMany({
      where,
      include: {
        consumptions: {
          include: {
            inventoryItem: {
              select: { sku: true, name: true },
            },
          },
        },
        timers: {
          orderBy: { startedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("[Production] Fetched", orders.length, "orders");
    return { data: orders, error: null };
  } catch (error) {
    console.error("[Production] Error fetching production orders:", error);
    return { data: null, error: "Failed to fetch production orders" };
  }
}

export async function fetchProductionOrder(id: string) {
  try {
    console.log("[Production] Fetching production order:", id);
    
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        consumptions: {
          include: {
            inventoryItem: true,
          },
        },
        timers: {
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!order) {
      return { data: null, error: "Production order not found" };
    }

    return { data: order, error: null };
  } catch (error) {
    console.error("[Production] Error fetching production order:", error);
    return { data: null, error: "Failed to fetch production order" };
  }
}

// ============================================
// SHIPPING
// ============================================

export async function fetchShippingCarriers() {
  try {
    console.log("[Shipping] Fetching shipping carriers...");
    
    const carriers = await prisma.shippingCarrier.findMany({
      include: {
        services: true,
      },
      orderBy: { name: "asc" },
    });

    console.log("[Shipping] Fetched", carriers.length, "carriers");
    return { data: carriers, error: null };
  } catch (error) {
    console.error("[Shipping] Error fetching shipping carriers:", error);
    return { data: null, error: "Failed to fetch shipping carriers" };
  }
}

// ============================================
// SYNC CONFIGURATION
// ============================================

export async function fetchSyncConfigurations() {
  try {
    console.log("[Sync Config] Fetching sync configurations...");
    
    const configs = await prisma.syncConfiguration.findMany({
      orderBy: { syncType: "asc" },
    });

    console.log("[Sync Config] Fetched", configs.length, "configurations");
    return { data: configs, error: null };
  } catch (error) {
    console.error("[Sync Config] Error fetching sync configurations:", error);
    return { data: null, error: "Failed to fetch sync configurations" };
  }
}
