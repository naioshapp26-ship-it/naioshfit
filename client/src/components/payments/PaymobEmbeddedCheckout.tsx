import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PaymobEmbeddedCheckoutProps {
  clientSecret: string;
  publicKey: string;
  baseUrl?: string | null;
  checkoutUrl?: string | null;
}

const DEFAULT_PAYMOB_BASE_URL = 'https://accept.paymob.com';

export const PaymobEmbeddedCheckout = ({
  clientSecret,
  publicKey,
  baseUrl,
  checkoutUrl,
}: PaymobEmbeddedCheckoutProps) => {
  const [error, setError] = useState<string | null>(null);

  const resolvedCheckoutUrl = useMemo(() => {
    if (checkoutUrl) return checkoutUrl;
    const normalizedBase = (baseUrl || DEFAULT_PAYMOB_BASE_URL).replace(/\/$/, '');
    if (!clientSecret || !publicKey) return null;
    return `${normalizedBase}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
  }, [checkoutUrl, baseUrl, clientSecret, publicKey]);

  useEffect(() => {
    if (!resolvedCheckoutUrl) {
      setError('Unable to load Paymob checkout. Please try again.');
    } else {
      setError(null);
    }
  }, [resolvedCheckoutUrl]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <iframe
      title="Paymob Checkout"
      src={resolvedCheckoutUrl || ''}
      className="w-full min-h-[720px] rounded-lg border"
      allow="payment"
    />
  );
};

export default PaymobEmbeddedCheckout;
