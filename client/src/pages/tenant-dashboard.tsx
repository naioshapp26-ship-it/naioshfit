import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/hooks/use-auth";
import { TENANT_DASHBOARD_NAV } from "@shared/enterpriseSaas";
import {
  Home,
  Activity,
  TrendingUp,
  CreditCard,
  Dumbbell,
  Headphones,
  BarChart3,
  Users,
  Shield,
  Receipt,
  Settings,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Activity,
  TrendingUp,
  CreditCard,
  Dumbbell,
  Headphones,
  BarChart3,
  Users,
  Shield,
  Receipt,
  Settings,
};

export default function TenantDashboardPage() {
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const isRTL = language === "ar";
  const [active, setActive] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeItem = TENANT_DASHBOARD_NAV.find((n) => n.key === active);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex" dir={isRTL ? "rtl" : "ltr"}>
      <aside
        className={`fixed inset-y-0 ${isRTL ? "right-0" : "left-0"} z-50 w-72 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 border-e shadow-xl transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : isRTL ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-xl font-bold text-[#8B0000]">NAIOSH Workspace</h1>
          <p className="text-sm text-zinc-500 truncate">{user?.email}</p>
        </div>
        <nav className="p-3 space-y-1">
          {TENANT_DASHBOARD_NAV.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? Home;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { setActive(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active === item.key
                    ? "bg-[#8B0000] text-white"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {isRTL ? item.labelAr : item.labelEn}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className={`flex-1 ${isRTL ? "lg:mr-72" : "lg:ml-72"}`}>
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen((v) => !v)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h2 className="font-semibold">{isRTL ? activeItem?.labelAr : activeItem?.labelEn}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">{isRTL ? "لوحة NaioshFit" : "NaioshFit App"}</Button>
            </Link>
          </div>
        </header>

        <main className="p-6 max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} key={active}>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              {[
                { label: isRTL ? "المستخدمون النشطون" : "Active Users", value: "128" },
                { label: isRTL ? "الإيرادات الشهرية" : "Monthly Revenue", value: "$12,400" },
                { label: isRTL ? "طلبات الدعم" : "Support Tickets", value: "7" },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-500">{stat.label}</CardTitle></CardHeader>
                  <CardContent><p className="text-3xl font-bold">{stat.value}</p></CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? activeItem?.labelAr : activeItem?.labelEn}</CardTitle>
              </CardHeader>
              <CardContent className="text-zinc-600 dark:text-zinc-400">
                {isRTL
                  ? "مرحباً بك في لوحة تحكم المستأجر. هذا القسم جاهز للربط ببيانات منصتك المعزولة."
                  : "Welcome to your tenant workspace dashboard. This section is ready to connect to your isolated platform data."}
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
