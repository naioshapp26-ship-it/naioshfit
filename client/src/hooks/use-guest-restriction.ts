import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { isGuestUser, triggerGuestUpgradePrompt } from "@/lib/guest-utils";

export function useGuestRestriction() {
  const { user } = useAuth();

  const isGuest = useMemo(() => isGuestUser(user), [user]);

  const blockAction = () => {
    triggerGuestUpgradePrompt();
  };

  return {
    isGuest,
    blockAction,
  };
}
