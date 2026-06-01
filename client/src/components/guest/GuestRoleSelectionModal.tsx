import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { GuestPreviewRole } from "@/lib/guest-utils";

interface GuestRoleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuestRoleSelectionModal({ open, onOpenChange }: GuestRoleSelectionModalProps) {
  const { enterGuestMode } = useAuth();

  const handleSelect = async (role: GuestPreviewRole) => {
    await enterGuestMode(role);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>اختر تجربتك</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold">تجربة المتدرب</h3>
            <DialogDescription>
              استكشف الدورات والتغذية والتمارين بشكل تجريبي قبل إنشاء حساب.
            </DialogDescription>
            <Button className="bg-red-900 hover:bg-red-800" onClick={() => handleSelect("user")}>
              الدخول كمتدرب
            </Button>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold">تجربة المدرب</h3>
            <DialogDescription>
              شاهد لوحة المدرب وإدارة المحتوى في وضع استكشافي بميزات مقيدة.
            </DialogDescription>
            <Button className="bg-red-900 hover:bg-red-800" onClick={() => handleSelect("coach")}>
              الدخول كمدرب
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
