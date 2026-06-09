import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { isSuperAdminRole } from "@shared/roleAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, DollarSign, Users, AlertTriangle, ArrowLeft } from "lucide-react";

export default function SuperAdminDashboardPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === "ar";

  const { data: revenue } = useQuery({
    queryKey: ["saas-revenue-summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/saas/revenue-summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isSuperAdminRole(user?.role),
  });

  if (!user || !isSuperAdminRole(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir={isRTL ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
            <p>{isRTL ? "صلاحيات Super Admin مطلوبة" : "Super Admin access required"}</p>
            <Link href="/admin"><Button>{isRTL ? "الإدارة" : "Admin Panel"}</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Super Admin</h1>
            <p className="text-zinc-400">{isRTL ? "إدارة جميع المستأجرين والإيرادات" : "Manage all tenants & revenue"}</p>
          </div>
          <Link href="/admin">
            <Button variant="outline" className="gap-2 border-zinc-700">
              <ArrowLeft className="h-4 w-4" />
              {isRTL ? "لوحة الإدارة" : "Admin Panel"}
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {[
            { icon: Building2, label: isRTL ? "مستأجرون نشطون" : "Active Tenants", value: revenue?.activeTenants ?? "—" },
            { icon: DollarSign, label: isRTL ? "إجمالي الإيرادات" : "Total Revenue", value: revenue ? `$${(revenue.totalRevenueCents / 100).toFixed(0)}` : "—" },
            { icon: Users, label: isRTL ? "بانتظار الدفع" : "Pending Payment", value: revenue?.pendingTenants ?? "—" },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm text-zinc-400">{item.label}</CardTitle>
                  <item.icon className="h-4 w-4 text-red-400" />
                </CardHeader>
                <CardContent><p className="text-3xl font-bold">{item.value}</p></CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader><CardTitle>{isRTL ? "إدارة المستأجرين" : "Tenant Management"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-zinc-400 text-sm">
              {isRTL
                ? "استخدم لوحة Tenant Ops لإيقاف/تفعيل المستأجرين وترقية الخطط."
                : "Use Tenant Ops panel to suspend/activate tenants and upgrade plans."}
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/tenant"><Button className="bg-[#8B0000] hover:bg-[#6d0000]">{isRTL ? "Tenant Ops" : "Tenant Ops"}</Button></Link>
              <Link href="/saas"><Button variant="outline" className="border-zinc-700">{isRTL ? "تسجيل مستأجر" : "New Tenant Signup"}</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
