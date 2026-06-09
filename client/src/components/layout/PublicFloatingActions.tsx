import React from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { ArrowLeft, ArrowRight, ArrowUp, Heart, MessageCircle, Plus, Rocket } from "lucide-react";

const PublicFloatingActions: React.FC = () => {
  const { language } = useLanguage();
  const [, navigate] = useLocation();
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const handleScrollToFooter = () => {
    const footerElement = document.querySelector("footer");
    if (footerElement) {
      footerElement.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/home");
  };

  const BackIcon = language === "ar" ? ArrowRight : ArrowLeft;

  const fabActions = [
    { icon: Rocket, label: "Rent SaaS", onClick: () => navigate("/saas") },
    { icon: Plus, label: "Sign up", onClick: () => navigate("/signup") },
    { icon: Heart, label: "Blog", onClick: () => navigate("/blog") },
    { icon: MessageCircle, label: "Footer", onClick: handleScrollToFooter },
    { icon: ArrowUp, label: "Top", onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { icon: BackIcon, label: "Back", onClick: handleBack },
  ];

  const sideClass = language === "ar" ? "left-3 md:left-5" : "right-3 md:right-5";
  const enterClass = language === "ar"
    ? (isVisible ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0")
    : (isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0");

  return (
    <div
      className={`fixed ${sideClass} top-1/2 -translate-y-1/2 z-[55] flex flex-col gap-3 ${enterClass} transition-all duration-500 ease-out`}
      aria-label="Public quick actions"
    >
      {fabActions.map((action) => (
        <button
          key={action.label}
          type="button"
          aria-label={action.label}
          title={action.label}
          onClick={action.onClick}
          className="h-10 w-10 md:h-14 md:w-14 rounded-full bg-gradient-to-br from-red-900 via-red-800 to-red-700 text-white shadow-[0_10px_25px_rgba(0,0,0,0.28)] transition-all duration-300 hover:scale-105 hover:shadow-[0_16px_32px_rgba(0,0,0,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/80"
        >
          <action.icon className="mx-auto h-4 w-4 md:h-6 md:w-6" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
};

export default PublicFloatingActions;