import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmbeddedCheckoutProps {
  clientSecret: string;
  publishableKey: string;
  onComplete?: () => void;
}

export const EmbeddedCheckout = ({ clientSecret, publishableKey, onComplete }: EmbeddedCheckoutProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let embeddedCheckout: { destroy: () => void } | null = null;

    const mountCheckout = async () => {
      try {
        const stripe = await loadStripe(publishableKey);
        if (!stripe) {
          throw new Error('Stripe initialization failed');
        }

        embeddedCheckout = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete,
        });

        if (!isMounted || !containerRef.current) {
          return;
        }

        embeddedCheckout.mount(containerRef.current);
      } catch (err) {
        if (isMounted) {
          setError('Unable to load payment form. Please try again.');
        }
      }
    };

    mountCheckout();

    return () => {
      isMounted = false;
      if (embeddedCheckout) {
        embeddedCheckout.destroy();
      }
    };
  }, [clientSecret, publishableKey, onComplete]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return <div ref={containerRef} />;
};

export default EmbeddedCheckout;
