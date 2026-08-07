import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function GuestModeBanner() {
  const [, navigate] = useLocation();

  return (
    <div className="sticky top-0 z-50 w-full bg-red-900 text-white border-b border-red-800">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" dir="rtl">
        <p className="text-sm font-medium">أنت الآن تتصفح الموقع كزائر</p>
        <Button
          size="sm"
          className="bg-white text-red-900 hover:bg-red-100"
          onClick={() => navigate("/signup")}
        >
          إنشاء حساب للاستمرار
        </Button>
      </div>
    </div>
  );
}
