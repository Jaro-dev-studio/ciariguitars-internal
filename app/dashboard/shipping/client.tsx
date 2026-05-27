"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Truck,
  Package,
  Globe,
  CheckCircle2,
  Clock,
  DollarSign,
  Settings,
  RefreshCw,
  MapPin,
  Plane,
  Ship,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ShippingClientProps {
  carriers: any[] | null;
  integrations: any[] | null;
  error: string | null;
}

interface Carrier {
  id: string;
  name: string;
  code: string;
  platform: "SHIPSTATION" | "MANAGEMARKETS";
  isActive: boolean;
  isDomestic: boolean;
  isInternational: boolean;
  logoColor: string;
  services: {
    id: string;
    name: string;
    code: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    isActive: boolean;
  }[];
}

const mockCarriers: Carrier[] = [
  {
    id: "1",
    name: "UPS",
    code: "ups",
    platform: "SHIPSTATION",
    isActive: true,
    isDomestic: true,
    isInternational: true,
    logoColor: "#412201",
    services: [
      { id: "1a", name: "UPS Ground", code: "ups_ground", estimatedDaysMin: 3, estimatedDaysMax: 5, isActive: true },
      { id: "1b", name: "UPS 2nd Day Air", code: "ups_2day", estimatedDaysMin: 2, estimatedDaysMax: 2, isActive: true },
      { id: "1c", name: "UPS Next Day Air", code: "ups_nextday", estimatedDaysMin: 1, estimatedDaysMax: 1, isActive: true },
      { id: "1d", name: "UPS Worldwide Express", code: "ups_intl_express", estimatedDaysMin: 3, estimatedDaysMax: 5, isActive: true },
    ],
  },
  {
    id: "2",
    name: "FedEx",
    code: "fedex",
    platform: "SHIPSTATION",
    isActive: true,
    isDomestic: true,
    isInternational: true,
    logoColor: "#4D148C",
    services: [
      { id: "2a", name: "FedEx Ground", code: "fedex_ground", estimatedDaysMin: 3, estimatedDaysMax: 7, isActive: true },
      { id: "2b", name: "FedEx Express Saver", code: "fedex_express_saver", estimatedDaysMin: 3, estimatedDaysMax: 3, isActive: true },
      { id: "2c", name: "FedEx 2Day", code: "fedex_2day", estimatedDaysMin: 2, estimatedDaysMax: 2, isActive: true },
      { id: "2d", name: "FedEx International Priority", code: "fedex_intl_priority", estimatedDaysMin: 2, estimatedDaysMax: 5, isActive: false },
    ],
  },
  {
    id: "3",
    name: "USPS",
    code: "usps",
    platform: "SHIPSTATION",
    isActive: true,
    isDomestic: true,
    isInternational: false,
    logoColor: "#004B87",
    services: [
      { id: "3a", name: "USPS Priority Mail", code: "usps_priority", estimatedDaysMin: 1, estimatedDaysMax: 3, isActive: true },
      { id: "3b", name: "USPS Priority Mail Express", code: "usps_express", estimatedDaysMin: 1, estimatedDaysMax: 2, isActive: true },
      { id: "3c", name: "USPS Parcel Select Ground", code: "usps_ground", estimatedDaysMin: 2, estimatedDaysMax: 8, isActive: false },
    ],
  },
  {
    id: "4",
    name: "DHL Express",
    code: "dhl",
    platform: "MANAGEMARKETS",
    isActive: false,
    isDomestic: false,
    isInternational: true,
    logoColor: "#D40511",
    services: [
      { id: "4a", name: "DHL Express Worldwide", code: "dhl_express", estimatedDaysMin: 2, estimatedDaysMax: 5, isActive: false },
      { id: "4b", name: "DHL Economy Select", code: "dhl_economy", estimatedDaysMin: 5, estimatedDaysMax: 10, isActive: false },
    ],
  },
  {
    id: "5",
    name: "PassportGlobal",
    code: "passport",
    platform: "MANAGEMARKETS",
    isActive: false,
    isDomestic: false,
    isInternational: true,
    logoColor: "#0066CC",
    services: [
      { id: "5a", name: "Passport International Economy", code: "passport_economy", estimatedDaysMin: 7, estimatedDaysMax: 14, isActive: false },
      { id: "5b", name: "Passport International Express", code: "passport_express", estimatedDaysMin: 3, estimatedDaysMax: 7, isActive: false },
    ],
  },
];

function CarrierCard({ carrier }: { carrier: Carrier }) {
  const [isActive, setIsActive] = useState(carrier.isActive);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleToggle = (active: boolean) => {
    setIsActive(active);
    toast.success(active ? "Carrier enabled" : "Carrier disabled", {
      description: carrier.name,
    });
  };

  const handleRefreshRates = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSyncing(false);
    toast.success("Rates refreshed", {
      description: `${carrier.name} shipping rates updated`,
    });
  };

  const activeServices = carrier.services.filter(s => s.isActive).length;

  return (
    <Card className={cn(!isActive && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="flex size-10 items-center justify-center rounded-lg text-white font-bold text-sm"
              style={{ backgroundColor: carrier.logoColor }}
            >
              {carrier.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-base">{carrier.name}</CardTitle>
              <CardDescription className="text-xs">
                via {carrier.platform === "SHIPSTATION" ? "ShipStation" : "ManageMarkets"}
              </CardDescription>
            </div>
          </div>
          <Switch checked={isActive} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {carrier.isDomestic && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="mr-1 size-3" />
              Domestic
            </Badge>
          )}
          {carrier.isInternational && (
            <Badge variant="outline" className="text-xs">
              <Globe className="mr-1 size-3" />
              International
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active Services</span>
            <span className="font-medium">{activeServices}/{carrier.services.length}</span>
          </div>
          <div className="space-y-1">
            {carrier.services.slice(0, 3).map((service) => (
              <div 
                key={service.id} 
                className={cn(
                  "flex items-center justify-between rounded border px-2 py-1 text-xs",
                  service.isActive ? "border-border bg-background" : "border-transparent bg-muted/50 text-muted-foreground"
                )}
              >
                <span>{service.name}</span>
                <span>{service.estimatedDaysMin}-{service.estimatedDaysMax} days</span>
              </div>
            ))}
            {carrier.services.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{carrier.services.length - 3} more services
              </p>
            )}
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          disabled={!isActive || isSyncing}
          onClick={handleRefreshRates}
        >
          {isSyncing ? (
            <RefreshCw className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Refresh Rates
        </Button>
      </CardContent>
    </Card>
  );
}

export function ShippingClient({ carriers, integrations, error }: ShippingClientProps) {
  const carrierData = mockCarriers;

  const domesticCarriers = carrierData.filter(c => c.isDomestic && c.isActive);
  const intlCarriers = carrierData.filter(c => c.isInternational);
  const activeCarriers = carrierData.filter(c => c.isActive);

  const shipStationConnected = true;
  const manageMarketsConnected = false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shipping Options</h1>
          <p className="text-muted-foreground">
            Configure shipping carriers and services for domestic and international orders
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Truck className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCarriers.length}</p>
                <p className="text-xs text-muted-foreground">Active Carriers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <MapPin className="size-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{domesticCarriers.length}</p>
                <p className="text-xs text-muted-foreground">Domestic Carriers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <Globe className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{intlCarriers.filter(c => c.isActive).length}</p>
                <p className="text-xs text-muted-foreground">Int'l Carriers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <Package className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {carrierData.reduce((sum, c) => sum + c.services.filter(s => s.isActive).length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Active Services</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cn(shipStationConnected && "ring-2 ring-accent/20")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {shipStationConnected ? (
                  <CheckCircle2 className="size-5 text-accent" />
                ) : (
                  <Clock className="size-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">ShipStation</p>
                  <p className="text-xs text-muted-foreground">
                    {shipStationConnected ? "Connected - Domestic shipping" : "Not connected"}
                  </p>
                </div>
              </div>
              <Badge variant={shipStationConnected ? "default" : "outline"}>
                {shipStationConnected ? "Active" : "Disconnected"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(!manageMarketsConnected && "border-dashed")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {manageMarketsConnected ? (
                  <CheckCircle2 className="size-5 text-accent" />
                ) : (
                  <Clock className="size-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">ManageMarkets</p>
                  <p className="text-xs text-muted-foreground">
                    {manageMarketsConnected ? "Connected - International shipping" : "Not connected - Int'l shipping disabled"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">Connect</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="domestic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="domestic" className="gap-2">
            <MapPin className="size-4" />
            Domestic (ShipStation)
          </TabsTrigger>
          <TabsTrigger value="international" className="gap-2">
            <Globe className="size-4" />
            International (ManageMarkets)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="domestic">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {carrierData
              .filter(c => c.platform === "SHIPSTATION")
              .map((carrier, index) => (
                <motion.div
                  key={carrier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <CarrierCard carrier={carrier} />
                </motion.div>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="international">
          {manageMarketsConnected ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {carrierData
                .filter(c => c.platform === "MANAGEMARKETS")
                .map((carrier, index) => (
                  <motion.div
                    key={carrier.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <CarrierCard carrier={carrier} />
                  </motion.div>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Globe className="mb-4 size-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">International Shipping Not Configured</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Connect ManageMarkets to enable international shipping carriers and customs management
                </p>
                <Button>
                  <Plane className="mr-2 size-4" />
                  Connect ManageMarkets
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
