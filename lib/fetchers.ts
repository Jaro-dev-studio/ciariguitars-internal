"use server";

import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import type { Permissions } from "@/config/permissions";
import {
  normalisePageSize,
  type SyncLogFilters,
  type SyncRunFilters,
} from "@/config/sync-logs";
import type { ShopFlowEventFilters } from "@/config/shopflow-events";
import type {
  IntegrationPlatform,
  Prisma,
  SyncRunStatus,
  SyncSource,
  SyncStatus,
  SyncType,
} from "@prisma/client";

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

function rangeToDate(range?: string): Date | null {
  const hours: Record<string, number> = { "1h": 1, "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
  const window = hours[range ?? ""];
  if (!window) return null;
  return new Date(Date.now() - window * 60 * 60 * 1000);
}

/**
 * Builds the Prisma filter shared by the log list, its total count and its
 * status breakdown, so all three always describe the same set of rows.
 *
 * The table holds over a million rows, so every query is expected to lean on
 * the `createdAt` index: callers pass a bounded range unless the user has
 * explicitly asked for "all time".
 */
function buildSyncLogWhere(filters: SyncLogFilters) {
  const where: Prisma.SyncLogWhereInput = {};

  if (filters.syncType && filters.syncType !== "all") {
    where.syncType = filters.syncType as SyncType;
  }
  if (filters.platform && filters.platform !== "all") {
    where.platform = filters.platform as IntegrationPlatform;
  }
  if (filters.status && filters.status !== "all") {
    where.status = filters.status as SyncStatus;
  }
  if (filters.source && filters.source !== "all") {
    where.source = filters.source as SyncSource;
  }
  if (filters.runId) {
    where.runId = filters.runId;
  }
  if (filters.dryRun === "true" || filters.dryRun === "false") {
    where.dryRun = filters.dryRun === "true";
  }

  const since = rangeToDate(filters.range);
  if (since) {
    where.createdAt = { gte: since };
  }

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { details: { contains: search, mode: "insensitive" } },
      { errorMessage: { contains: search, mode: "insensitive" } },
      { inventoryItem: { sku: { contains: search, mode: "insensitive" } } },
      { inventoryItem: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function fetchSyncLogs(filters: SyncLogFilters = {}) {
  try {
    console.log("[Sync Logs] Building query from filters:", filters);

    const pageSize = normalisePageSize(filters.pageSize);
    const requestedPage = Math.max(1, Math.floor(filters.page || 1));

    const where = buildSyncLogWhere(filters);

    // The status breakdown already visits every matching row, so its totals
    // double as the row count - a separate count() would scan the table twice.
    console.log("[Sync Logs] Counting matching rows by status...");
    const grouped = await prisma.syncLog.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const statusCounts = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp so a stale page number from the URL still returns rows.
    const page = Math.min(requestedPage, totalPages);

    console.log(`[Sync Logs] Fetching page ${page}/${totalPages} (${pageSize} per page)...`);
    const logs = await prisma.syncLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        inventoryItem: { select: { sku: true, name: true } },
        run: { select: { id: true, trigger: true, source: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`[Sync Logs] Fetched ${logs.length} of ${total} matching logs`);
    return {
      data: { logs, total, page, pageSize, totalPages, statusCounts },
      error: null,
    };
  } catch (error) {
    console.error("[Sync Logs] Error fetching sync logs:", error);
    return { data: null, error: "Failed to fetch sync logs" };
  }
}

// ============================================
// SHOP FLOW EVENTS
// ============================================

/**
 * Everything the Shop Flow receiver captures is stored as a SyncLog row
 * against this platform, so the platform alone identifies a delivery - no
 * event type filter, which would hide any new kind of payload Shop Flow starts
 * sending.
 */
const SHOPFLOW_PLATFORM = "SHOPFLOW" as IntegrationPlatform;

function buildShopFlowEventWhere(filters: ShopFlowEventFilters) {
  const where: Prisma.SyncLogWhereInput = { platform: SHOPFLOW_PLATFORM };

  if (filters.status && filters.status !== "all") {
    where.status = filters.status as SyncStatus;
  }

  const since = rangeToDate(filters.range);
  if (since) {
    where.createdAt = { gte: since };
  }

  // The payload itself is a Json column and cannot be searched portably, but
  // the receiver copies any identifiers it recognised into `details`, so that
  // is what a serial or order number search matches against.
  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { details: { contains: search, mode: "insensitive" } },
      { errorMessage: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

/**
 * Lists the payloads posted to `/api/webhooks/shopflow`, newest first, plus
 * the unfiltered totals the page header needs so those counters stay stable
 * while the user narrows the table.
 */
export async function fetchShopFlowEvents(filters: ShopFlowEventFilters = {}) {
  try {
    console.log("[ShopFlow Events] Building query from filters:", filters);

    const pageSize = normalisePageSize(filters.pageSize);
    const requestedPage = Math.max(1, Math.floor(filters.page || 1));
    const where = buildShopFlowEventWhere(filters);

    console.log("[ShopFlow Events] Counting matching deliveries by status...");
    const grouped = await prisma.syncLog.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const statusCounts = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp so a stale page number from the URL still returns rows.
    const page = Math.min(requestedPage, totalPages);

    console.log(
      `[ShopFlow Events] Fetching page ${page}/${totalPages} (${pageSize} per page)...`
    );
    const events = await prisma.syncLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        details: true,
        errorMessage: true,
        newValue: true,
        createdAt: true,
        runId: true,
        run: { select: { trigger: true, triggeredBy: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("[ShopFlow Events] Loading lifetime delivery totals...");
    const [allTimeTotal, last24hTotal, latest] = await Promise.all([
      prisma.syncLog.count({ where: { platform: SHOPFLOW_PLATFORM } }),
      prisma.syncLog.count({
        where: {
          platform: SHOPFLOW_PLATFORM,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.syncLog.findFirst({
        where: { platform: SHOPFLOW_PLATFORM },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    console.log(
      `[ShopFlow Events] Fetched ${events.length} of ${total} matching deliveries`
    );
    return {
      data: {
        events,
        total,
        page,
        pageSize,
        totalPages,
        statusCounts,
        allTimeTotal,
        last24hTotal,
        lastReceivedAt: latest?.createdAt ?? null,
      },
      error: null,
    };
  } catch (error) {
    console.error("[ShopFlow Events] Error fetching Shop Flow events:", error);
    return { data: null, error: "Failed to fetch Shop Flow events" };
  }
}

// ============================================
// SYNC RUNS
// ============================================

/**
 * Lists executions of crons, webhooks and manual actions. Each row is one
 * trigger firing, with the number of sync log entries it produced so a run can
 * be drilled into from the logs tab.
 */
export async function fetchSyncRuns(filters: SyncRunFilters = {}) {
  try {
    console.log("[Sync Runs] Fetching runs with filters:", filters);

    const pageSize = normalisePageSize(filters.pageSize);
    const requestedPage = Math.max(1, Math.floor(filters.page || 1));

    const where: Prisma.SyncRunWhereInput = {};
    if (filters.source && filters.source !== "all") {
      where.source = filters.source as SyncSource;
    }
    if (filters.trigger && filters.trigger !== "all") {
      where.trigger = filters.trigger;
    }
    if (filters.status && filters.status !== "all") {
      where.status = filters.status as SyncRunStatus;
    }
    const since = rangeToDate(filters.range);
    if (since) {
      where.startedAt = { gte: since };
    }

    const total = await prisma.syncRun.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);

    const [runs, triggers] = await Promise.all([
      prisma.syncRun.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { logs: true } } },
        orderBy: { startedAt: "desc" },
      }),
      // Powers the trigger dropdown without hardcoding the list in the UI.
      prisma.syncRun.groupBy({ by: ["trigger"], _count: { _all: true } }),
    ]);

    console.log(`[Sync Runs] Fetched ${runs.length} of ${total} runs`);
    return {
      data: {
        runs,
        total,
        page,
        pageSize,
        totalPages,
        triggers: triggers.map((t) => t.trigger).sort(),
      },
      error: null,
    };
  } catch (error) {
    console.error("[Sync Runs] Error fetching sync runs:", error);
    return { data: null, error: "Failed to fetch sync runs" };
  }
}

/** Loads a single run so the logs tab can show what it was scoped to. */
export async function fetchSyncRunById(runId: string) {
  try {
    console.log("[Sync Runs] Fetching run", runId);
    const run = await prisma.syncRun.findUnique({
      where: { id: runId },
      include: { _count: { select: { logs: true } } },
    });
    return { data: run, error: null };
  } catch (error) {
    console.error("[Sync Runs] Error fetching run:", error);
    return { data: null, error: "Failed to fetch run" };
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
