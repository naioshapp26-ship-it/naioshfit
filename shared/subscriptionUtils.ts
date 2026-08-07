// Utility function to calculate subscription end date
export function calculateSubscriptionEndDate(
  startDate: Date,
  subscriptionType: string,
): Date {
  const start = new Date(startDate);

  // Extract the number from subscriptionType (e.g., "1.5_months" → 1.5)
  const match = subscriptionType.match(/^(\d+(?:\.\d+)?)(?:_months?)?$/);
  if (!match) {
    throw new Error(`Invalid subscription type: ${subscriptionType}`);
  }

  const months = parseFloat(match[1]);

  // Separate integer months and fractional part
  const wholeMonths = Math.floor(months);
  const fractionalMonths = months - wholeMonths;

  // Add whole months
  const endDate = new Date(start);
  endDate.setMonth(endDate.getMonth() + wholeMonths);

  // Add fractional months (approx by days → 30.44 average days per month)
  if (fractionalMonths > 0) {
    const extraDays = fractionalMonths * 30.44;
    endDate.setDate(endDate.getDate() + Math.round(extraDays));
  }

  return endDate;
}

// Utility function to get subscription duration in readable format
export function getSubscriptionDuration(subscriptionType: string): string {
  const match = subscriptionType.match(/^(\d+(?:\.\d+)?)(?:_months?)?$/);

  if (match) {
    const months = parseFloat(match[1]);
    return `${months} Month${months === 1 ? "" : "s"}`;
  }

  return "Unknown";
}

// Utility function to validate subscription type format
export function isValidSubscriptionType(subscriptionType: string): boolean {
  const match = subscriptionType.match(/^(\d+(?:\.\d+)?)(?:_months?)?$/);
  if (!match) return false;

  const months = parseFloat(match[1]);
  return months > 0 && months <= 120; // Allow up to 120 months (10 years)
}

export function parseSubscriptionType(subscriptionType: string): { duration: number; unit: string } {
  // Handle formats like "1_month", "3_months", "1.5_months", "3.78_months"
  const match = subscriptionType.match(/^(\d+(?:\.\d{1,2})?)_(month|months)$/);
  if (!match) {
    throw new Error(`Invalid subscription type format: ${subscriptionType}`);
  }

  const duration = parseFloat(match[1]);
  const unit = match[2];

  return { duration, unit };
}

// Utility function to check if subscription is suspended (start date after end date)
export function isSubscriptionSuspended(startDate: Date | string | null, endDate: Date | string | null): boolean {
  if (!startDate || !endDate) return false;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return start > end;
}

// Utility function to get subscription status
export function getSubscriptionStatus(
  subscriptionType: string | null,
  startDate: Date | string | null,
  endDate: Date | string | null
): 'active' | 'expired' | 'suspended' | 'none' {
  console.log('getSubscriptionStatus called with:', { subscriptionType, startDate, endDate });
  
  if (!subscriptionType) {
    console.log('No subscription type, returning suspended');
    return 'suspended';
  }
  
  if (!startDate || !endDate) {
    console.log('Missing start or end date, returning suspended');
    return 'suspended';
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  console.log('Parsed dates:', { start, end, now });
  
  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.log('Invalid dates, returning suspended');
    return 'suspended';
  }
  
  // Check if start date is after end date (suspended case)
  if (start > end) {
    console.log('Start date after end date, returning suspended');
    return 'suspended';
  }
  
  // Check if subscription is still active or expired
  // A subscription is active if the current date is between start and end dates (inclusive)
  // OR if it's a valid subscription with proper dates regardless of future start date
  if (end > now) {
    console.log('End date is in future, returning active');
    return 'active';
  } else {
    console.log('End date has passed, returning expired');
    return 'expired';
  }
}