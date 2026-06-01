import React, { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardStatProps {
  title: string;
  value: string | number;
  description?: string;
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  trend?: number;
  footer?: ReactNode;
  className?: string;
}

export const DashboardStat: React.FC<DashboardStatProps> = ({
  title,
  value,
  description,
  icon,
  iconBgColor,
  iconColor,
  trend,
  footer,
  className
}) => {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h3 className="text-2xl font-bold">{value}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={cn("p-2 rounded-full", iconBgColor)}>
            <span className={cn("h-5 w-5", iconColor)}>{icon}</span>
          </div>
        </div>
        
        {trend !== undefined && (
          <div className="mt-3">
            <div className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {trend > 0 ? `↑ ${trend}%` : trend < 0 ? `↓ ${Math.abs(trend)}%` : `${trend}%`}
              <span className="text-muted-foreground ml-1">from last week</span>
            </div>
          </div>
        )}
        
        {footer && <div className="mt-4">{footer}</div>}
      </CardContent>
    </Card>
  );
};

export default DashboardStat;
