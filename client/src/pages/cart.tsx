import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Trash2, Minus, Plus, ChevronRight, CreditCard } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { Link, useLocation } from 'wouter';
import EmbeddedCheckout from '@/components/payments/EmbeddedCheckout';
import PayPalEmbeddedCheckout from '@/components/payments/PayPalEmbeddedCheckout';
import PaymobEmbeddedCheckout from '@/components/payments/PaymobEmbeddedCheckout';

const CartPage: React.FC = () => {
  const { cart, isLoading, updateCartItem, removeFromCart, clearCart, checkout, checkoutPending } = useCart();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [shippingDetails, setShippingDetails] = useState({
    address: '',
    city: '',
    country: '',
    phone: '',
    notes: '',
  });
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [checkoutPublishableKey, setCheckoutPublishableKey] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<number | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal' | 'paymob'>('stripe');
  const [stripeConfigured, setStripeConfigured] = useState(true);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paymobConfigured, setPaymobConfigured] = useState(false);
  const [paymobPublicKey, setPaymobPublicKey] = useState<string | null>(null);
  const [paymobBaseUrl, setPaymobBaseUrl] = useState<string | null>(null);
  const [paymobCheckoutUrl, setPaymobCheckoutUrl] = useState<string | null>(null);

  const hasItems = useMemo(() => (cart?.items?.length ?? 0) > 0, [cart]);
  const isStripeCheckoutActive = Boolean(checkoutClientSecret && checkoutPublishableKey);
  const isPayPalCheckoutActive = Boolean(paypalClientId && paypalOrderId);
  const isPaymobCheckoutActive = Boolean(checkoutClientSecret && paymobPublicKey);
  const isCheckoutActive = isStripeCheckoutActive || isPayPalCheckoutActive || isPaymobCheckoutActive;

  useEffect(() => {
    const loadGatewayStatus = async () => {
      try {
        const [stripeStatus, paypalStatus, paymobStatus] = await Promise.all([
          fetch('/api/stripe/status', { credentials: 'include' }).then((res) => res.json()),
          fetch('/api/paypal/status', { credentials: 'include' }).then((res) => res.json()),
          fetch('/api/paymob/status', { credentials: 'include' }).then((res) => res.json()),
        ]);
        setStripeConfigured(Boolean(stripeStatus?.configured));
        setPaypalConfigured(Boolean(paypalStatus?.configured));
        setPaymobConfigured(Boolean(paymobStatus?.configured));
        if (!stripeStatus?.configured && paypalStatus?.configured) {
          setPaymentProvider('paypal');
        } else if (!stripeStatus?.configured && !paypalStatus?.configured && paymobStatus?.configured) {
          setPaymentProvider('paymob');
        }
      } catch (error) {
        setStripeConfigured(true);
        setPaypalConfigured(false);
        setPaymobConfigured(false);
      }
    };

    loadGatewayStatus();
  }, []);

  useEffect(() => {
    setCheckoutClientSecret(null);
    setCheckoutPublishableKey(null);
    setPaypalClientId(null);
    setPaypalOrderId(null);
    setPaymobPublicKey(null);
    setPaymobBaseUrl(null);
    setPaymobCheckoutUrl(null);
  }, [paymentProvider]);

  const handleQuantityChange = async (productId: number, currentQuantity: number, delta: number, maxStock: number) => {
    const nextQuantity = currentQuantity + delta;
    if (nextQuantity < 0) return;
    if (nextQuantity === 0) {
      await handleRemove(productId);
      return;
    }
    if (nextQuantity > maxStock) {
      toast({
        title: t('stockLimitReached') || 'Stock limit reached',
        description: t('maxAvailableQuantity')?.replace('{stock}', String(maxStock)) || `Only ${maxStock} items available`,
        variant: 'destructive',
      });
      return;
    }
    try {
      await updateCartItem({ productId, quantity: nextQuantity });
    } catch (error) {
      toast({
        title: t('cartUpdateFailed') || 'Unable to update cart',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (productId: number) => {
    try {
      await removeFromCart(productId);
    } catch (error) {
      toast({
        title: t('cartUpdateFailed') || 'Unable to update cart',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
    } catch (error) {
      toast({
        title: t('cartUpdateFailed') || 'Unable to update cart',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (field: keyof typeof shippingDetails, value: string) => {
    setShippingDetails((prev) => ({ ...prev, [field]: value }));
  };

  const isCheckoutDisabled = !hasItems
    || !shippingDetails.address
    || !shippingDetails.city
    || !shippingDetails.country
    || !shippingDetails.phone
    || (paymentProvider === 'stripe' && !stripeConfigured)
    || (paymentProvider === 'paypal' && !paypalConfigured)
    || (paymentProvider === 'paymob' && !paymobConfigured);

  const fetchPublishableKey = async () => {
    const response = await fetch('/api/stripe/publishable-key', { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Failed to load payment configuration');
    }
    return payload.publishableKey as string;
  };

  const fetchPayPalClientId = async () => {
    const response = await fetch('/api/paypal/client-id', { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Failed to load PayPal configuration');
    }
    return payload.clientId as string;
  };

  const fetchPaymobConfig = async () => {
    const response = await fetch('/api/paymob/config', { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Failed to load Paymob configuration');
    }
    return {
      publicKey: payload.publicKey as string,
      baseUrl: payload.baseUrl as string | null,
    };
  };

  const handleCheckout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCheckoutDisabled || !cart?.items?.length) {
      toast({
        title: t('cartMissingInfo') || 'Missing information',
        description: t('completeCheckoutFields') || 'Please complete your shipping details before checking out',
        variant: 'destructive',
      });
      return;
    }

    try {
      const session = await checkout({
        shippingAddress: shippingDetails.address,
        shippingCity: shippingDetails.city,
        shippingCountry: shippingDetails.country,
        shippingPhone: shippingDetails.phone,
        notes: shippingDetails.notes || undefined,
        paymentMethod: 'card',
        paymentProvider,
      });
      toast({
        title: t('processingPayment') || 'Processing payment',
        description: t('processingPayment') || 'Processing your payment session',
      });
      setShippingDetails({ address: '', city: '', country: '', phone: '', notes: '' });

      const resolvedProvider = session?.paymentProvider || paymentProvider;

      if (resolvedProvider === 'stripe' && session?.clientSecret) {
        const stripeKey = await fetchPublishableKey();
        setCheckoutPublishableKey(stripeKey);
        setCheckoutClientSecret(session.clientSecret);
        setCheckoutOrderId(session.orderId);
        return;
      }

      if (resolvedProvider === 'paypal' && session?.sessionId) {
        const paypalId = await fetchPayPalClientId();
        setPaypalClientId(paypalId);
        setPaypalOrderId(session.sessionId);
        setCheckoutOrderId(session.orderId);
        return;
      }

      if (resolvedProvider === 'paymob' && session?.clientSecret) {
        const paymobConfig = await fetchPaymobConfig();
        setPaymobPublicKey(paymobConfig.publicKey);
        setPaymobBaseUrl(paymobConfig.baseUrl);
        setPaymobCheckoutUrl(session.checkoutUrl);
        setCheckoutClientSecret(session.clientSecret);
        setCheckoutOrderId(session.orderId);
        return;
      }

      if (session?.checkoutUrl) {
        window.location.href = session.checkoutUrl;
        return;
      }

      navigate('/orders');
    } catch (error) {
      toast({
        title: t('checkoutFailed') || 'Checkout failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <section className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            {t('cart') || 'Shopping Cart'}
          </h2>
          <p className="text-gray-600">
            {hasItems ? (t('itemsInCart') || 'Review your selected products and proceed to checkout') : (t('cartEmptyDescription') || 'Your cart is empty. Start shopping to add items.')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/store">
            <Button variant="outline" className="flex items-center">
              {t('continueShopping') || 'Continue Shopping'}
            </Button>
          </Link>
          {hasItems && (
            <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={handleClearCart}>
              {t('clearCart') || 'Clear Cart'}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-500">{t('loadingCart') || 'Loading your cart...'}</p>
        </div>
      ) : !hasItems && !isCheckoutActive ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('cartEmpty') || 'Your cart is empty'}</h3>
            <p className="text-gray-500 mb-6">{t('cartEmptyCta') || 'Browse the store and add products to your cart.'}</p>
            <Link href="/store">
              <Button>
                {t('visitStore') || 'Visit Store'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-6 ${hasItems ? 'lg:grid-cols-[2fr,1fr]' : 'lg:grid-cols-[1fr]'}`}>
          {hasItems && (
            <div className="space-y-4">
              {cart?.items.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-40 h-40 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-gray-400 text-sm">{t('noImage') || 'No image'}</div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold">{item.product.name}</h3>
                          <p className="text-sm text-gray-500">{item.product.description}</p>
                        </div>
                        <Badge variant="secondary" className="capitalize">
                          {item.product.category}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => handleQuantityChange(item.productId, item.quantity, -1, item.product.stock)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center font-semibold">{item.quantity}</span>
                          <Button variant="outline" size="icon" onClick={() => handleQuantityChange(item.productId, item.quantity, 1, item.product.stock)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-gray-500">{t('availableUnits')?.replace('{stock}', String(item.product.stock)) || `${item.product.stock} in stock`}</span>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-sm text-gray-500">{t('priceEach') || 'Price'}: {item.product.price.toFixed(2)} {cart?.currency}</p>
                          <p className="text-xl font-semibold">{item.lineTotal.toFixed(2)} {cart?.currency}</p>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRemove(item.productId)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('remove') || 'Remove'}
                        </Button>
                        <Link href={`/product/${item.productId}`}>
                          <Button variant="link" size="sm" className="text-primary flex items-center">
                            {t('viewDetails') || 'View details'}
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {hasItems && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('orderSummary') || 'Order Summary'}</CardTitle>
                  <CardDescription>{t('orderSummaryDescription') || 'Review your totals and enter your shipping details'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t('items') || 'Items'} ({cart?.itemCount || 0})</span>
                    <span>{cart?.subtotal.toFixed(2)} {cart?.currency}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t('shipping') || 'Shipping'}</span>
                    <span>{t('calculatedAtCheckout') || 'Calculated at checkout'}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t">
                    <span>{t('orderTotal') || 'Total'}</span>
                    <span>{cart?.subtotal.toFixed(2)} {cart?.currency}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasItems && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('shippingDetails') || 'Shipping Details'}</CardTitle>
                  <CardDescription>{t('shippingDetailsDescription') || 'We use this information to deliver your products'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleCheckout}>
                    <div className="space-y-2">
                      <Label htmlFor="address">{t('shippingAddress') || 'Address'}</Label>
                      <Input id="address" value={shippingDetails.address} onChange={(e) => handleInputChange('address', e.target.value)} placeholder={t('addressPlaceholder') || '123 Fitness Street'} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">{t('city') || 'City'}</Label>
                        <Input id="city" value={shippingDetails.city} onChange={(e) => handleInputChange('city', e.target.value)} placeholder={t('cityPlaceholder') || 'Cairo'} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">{t('country') || 'Country'}</Label>
                        <Input id="country" value={shippingDetails.country} onChange={(e) => handleInputChange('country', e.target.value)} placeholder={t('countryPlaceholder') || 'Egypt'} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t('phoneNumber') || 'Phone number'}</Label>
                      <Input id="phone" value={shippingDetails.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="(+20) 12 345 6789" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">{t('orderNotes') || 'Order notes (optional)'}</Label>
                      <Textarea id="notes" value={shippingDetails.notes} onChange={(e) => handleInputChange('notes', e.target.value)} rows={3} placeholder={t('orderNotesPlaceholder') || 'Delivery instructions or additional details'} />
                    </div>

                    <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-600 space-y-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-gray-500" />
                        <span>Secure checkout powered by the configured payment gateway.</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'stripe' ? 'border-primary bg-white text-primary' : 'border-gray-200 bg-white text-gray-600'}`}
                          onClick={() => setPaymentProvider('stripe')}
                          disabled={!stripeConfigured}
                        >
                          {t('payWithStripe') || 'Pay with Stripe'}
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'paypal' ? 'border-primary bg-white text-primary' : 'border-gray-200 bg-white text-gray-600'}`}
                          onClick={() => setPaymentProvider('paypal')}
                          disabled={!paypalConfigured}
                        >
                          {t('payWithPayPal') || 'Pay with PayPal'}
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'paymob' ? 'border-primary bg-white text-primary' : 'border-gray-200 bg-white text-gray-600'}`}
                          onClick={() => setPaymentProvider('paymob')}
                          disabled={!paymobConfigured}
                        >
                          {t('payWithPaymob') || 'Pay with Paymob'}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isCheckoutDisabled || checkoutPending}>
                      {checkoutPending ? (t('processingPayment') || 'Processing...') : (t('placeOrder') || 'Place Order')}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {isStripeCheckoutActive && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('billingAndSubscription') || 'Payment'}</CardTitle>
                  <CardDescription>{t('poweredByStripe') || 'Powered by Stripe'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <EmbeddedCheckout
                    clientSecret={checkoutClientSecret}
                    publishableKey={checkoutPublishableKey}
                    onComplete={() => {
                      toast({
                        title: t('paymentSuccess') || 'Payment successful',
                        description: t('paymentSuccessDescription') || 'Your order is being processed.',
                      });
                      navigate('/orders');
                    }}
                  />
                  {checkoutOrderId && (
                    <p className="mt-4 text-xs text-gray-500">
                      {t('orderNumber') || 'Order #'} {checkoutOrderId}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {isPayPalCheckoutActive && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('billingAndSubscription') || 'Payment'}</CardTitle>
                  <CardDescription>{t('poweredByPayPal') || 'Powered by PayPal'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <PayPalEmbeddedCheckout
                    clientId={paypalClientId as string}
                    currency={cart?.currency || 'USD'}
                    mode="order"
                    orderId={paypalOrderId}
                    onApprove={async () => {
                      if (!paypalOrderId) return;
                      await fetch(`/api/paypal/orders/${paypalOrderId}/capture`, {
                        method: 'POST',
                        credentials: 'include',
                      });
                      toast({
                        title: t('paymentSuccess') || 'Payment successful',
                        description: t('paymentSuccessDescription') || 'Your order is being processed.',
                      });
                      navigate('/orders');
                    }}
                  />
                  {checkoutOrderId && (
                    <p className="mt-4 text-xs text-gray-500">
                      {t('orderNumber') || 'Order #'} {checkoutOrderId}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            {isPaymobCheckoutActive && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('billingAndSubscription') || 'Payment'}</CardTitle>
                  <CardDescription>{t('poweredByPaymob') || 'Powered by Paymob'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <PaymobEmbeddedCheckout
                    clientSecret={checkoutClientSecret as string}
                    publicKey={paymobPublicKey as string}
                    baseUrl={paymobBaseUrl}
                    checkoutUrl={paymobCheckoutUrl}
                  />
                  {checkoutOrderId && (
                    <p className="mt-4 text-xs text-gray-500">
                      {t('orderNumber') || 'Order #'} {checkoutOrderId}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default CartPage;
