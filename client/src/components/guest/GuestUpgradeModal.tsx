import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GUEST_UPGRADE_EVENT, GUEST_UPGRADE_MESSAGE } from "@/lib/guest-utils";

export function GuestUpgradeModal() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const handler = () => setOpen(true);

    window.addEventListener(GUEST_UPGRADE_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(GUEST_UPGRADE_EVENT, handler as EventListener);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>للاستفادة الكاملة من المنصة يرجى إنشاء حساب.</DialogTitle>
          <DialogDescription>{GUEST_UPGRADE_MESSAGE}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            className="bg-red-900 hover:bg-red-800"
            onClick={() => {
              setOpen(false);
              navigate("/signup");
            }}
          >
            إنشاء حساب
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              navigate("/auth?mode=login");
            }}
          >
            تسجيل الدخول
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
