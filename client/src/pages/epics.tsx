import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { epicUIConfigs, platformStats } from "@/data/epics";
import {
  BookOpenCheck,
  CheckCircle2,
  Globe2,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const EpicCard = () => {
  const guidePath = "docs/EPIC_IMPLEMENTATION_GUIDE.md";

  return (
    <Card className="bg-white border shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge>Epics A-L</Badge>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              UI Components Blueprint
            </Badge>
          </div>
          <CardTitle className="text-2xl">Enterprise Fitness Platform UI</CardTitle>
          <p className="text-sm text-muted-foreground">
            Unified UI shells for all 12 epics. Database foundation, API routes, and migrations are
            ready (0020-0031). This page concentrates the UI layer tasks with ready-to-wire
            components.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-emerald-600 text-sm font-medium">
          <CheckCircle2 className="h-5 w-5" />
          Database & API foundation complete
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">UI scope</p>
            <p className="text-sm text-muted-foreground">12 epics / 4-5 UI surfaces each</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <BookOpenCheck className="h-5 w-5 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold">Reference</p>
            <p className="text-sm text-muted-foreground">{guidePath}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Globe2 className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold">Bilingual ready</p>
            <p className="text-sm text-muted-foreground">Arabic & English labels planned</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold">Security posture</p>
            <p className="text-sm text-muted-foreground">RBAC + tenant isolation + audit trails</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StatGrid = () => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    {platformStats.map((stat) => (
      <Card key={stat.label} className="border bg-white">
        <CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground tracking-wide">{stat.label}</p>
          <p className="text-2xl font-bold mt-1">{stat.value}</p>
          <p className="text-sm text-muted-foreground">{stat.detail}</p>
        </CardContent>
      </Card>
    ))}
  </div>
);

const EpicsBoard = () => (
  <div className="grid gap-4 xl:grid-cols-2">
    {epicUIConfigs.map((epic) => (
      <Card key={epic.key} className="border bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-semibold">
                Epic {epic.key}
              </Badge>
              <Badge className="bg-blue-100 text-blue-800">{epic.pillar}</Badge>
              <Badge variant="outline" className="text-emerald-700 border-emerald-200">
                {epic.status}
              </Badge>
            </div>
            <div className="min-w-[160px]">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>UI readiness</span>
                <span className="font-semibold text-gray-800">{epic.readiness}%</span>
              </div>
              <Progress value={epic.readiness} className="h-2" />
            </div>
          </div>
          <CardTitle className="text-xl">{epic.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{epic.summary}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Primary UI surfaces</p>
            <div className="flex flex-wrap gap-2">
              {epic.uiComponents.map((item) => (
                <Badge key={item} variant="outline" className="bg-slate-50">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Feature hooks</p>
            <ScrollArea className="h-20">
              <div className="space-y-2 pr-2">
                {epic.highlights.map((highlight) => (
                  <div key={highlight} className="flex items-start gap-2 text-sm text-slate-700">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const ComplianceStrip = () => (
  <Card className="border bg-white">
    <CardContent className="p-4 flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">Multi-tenant isolation</p>
          <p className="text-xs text-muted-foreground">Tenant_id enforced across 67 tables</p>
        </div>
      </div>
      <Separator orientation="vertical" className="hidden md:block h-10" />
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold">Security ready</p>
          <p className="text-xs text-muted-foreground">Encryption, audit trails, GDPR compliance</p>
        </div>
      </div>
      <Separator orientation="vertical" className="hidden md:block h-10" />
      <div className="flex items-center gap-2">
        <Globe2 className="h-5 w-5 text-amber-600" />
        <div>
          <p className="text-sm font-semibold">Bilingual</p>
          <p className="text-xs text-muted-foreground">Arabic & English strings planned in UI</p>
        </div>
      </div>
      <Separator orientation="vertical" className="hidden md:block h-10" />
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-indigo-600" />
        <div>
          <p className="text-sm font-semibold">Docs linked</p>
          <p className="text-xs text-muted-foreground">Use {guidePath} as blueprint</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const EpicsPage: React.FC = () => {
  return (
    <div className="space-y-6 p-4 lg:p-8 bg-slate-50">
      <EpicCard />
      <StatGrid />
      <ComplianceStrip />
      <EpicsBoard />
    </div>
  );
};

export default EpicsPage;
