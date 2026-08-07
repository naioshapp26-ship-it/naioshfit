import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Calendar, ShoppingBag } from 'lucide-react';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import { Link } from 'wouter';
import { useLanguage } from '@/context/LanguageContext';

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  subtotal: number;
  productImageUrl?: string | null;
}

interface Order {
  id: number;
  userId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  currency?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  shippingCity?: string | null;
  shippingCountry?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

const Orders = () => {
  const { t } = useLanguage();
  
  // Fetch orders from API
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPaymentMethod = (method?: string) => {
    switch (method) {
      case 'cash_on_delivery':
      case 'cash':
      case 'cod':
        return 'Cash';
      case 'card':
      default:
        return 'Card';
    }
  };

  if (isLoading) {
    return (
      <section className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
            <Package className="w-6 h-6 mr-2" />
            {t('myOrders')}
          </h2>
          <p className="text-gray-600">{t('trackPurchaseHistory')}</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Badge variant="outline" className="text-sm">
            {orders?.length || 0} {orders?.length === 1 ? t('orderSingular') : t('ordersPlural')}
          </Badge>
        </div>
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ShoppingBag className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noOrdersYet')}</h3>
            <p className="text-gray-500 mb-6">
              {t('noOrdersMessage')}
            </p>
            <Link href="/store">
              <Button>
                {t('browseStore')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const items = order.items ?? [];
            const currency = order.currency || 'EGP';
            const totalAmount = Number.isFinite(order.total) ? order.total : 0;
            const paymentStatus = order.paymentStatus || 'pending';
            const paymentMethod = formatPaymentMethod(order.paymentMethod);
            const shippingLabel = [order.shippingCity, order.shippingCountry].filter(Boolean).join(', ');
            return (
              <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{t('orderNumber')}{order.id}</CardTitle>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status === 'pending' ? t('orderPending') :
                         order.status === 'processing' ? t('orderProcessing') :
                         order.status === 'shipped' ? t('orderShipped') :
                         order.status === 'delivered' ? t('orderDelivered') :
                         order.status === 'cancelled' ? t('orderCancelled') : order.status}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{paymentMethod === 'Cash' ? t('paymentCash') : t('paymentCard')}</Badge>
                        <Badge className={getPaymentStatusColor(paymentStatus)}>
                          {paymentStatus === 'paid' ? t('paymentPaid') :
                           paymentStatus === 'failed' ? t('paymentFailed') :
                           paymentStatus === 'refunded' ? t('paymentRefunded') : paymentStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-lg font-semibold mt-2">
                      {totalAmount.toFixed(2)} {currency}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.productName}</h4>
                        <p className="text-sm text-gray-500">
                          {t('orderQuantity')}: {item.quantity} × {item.productPrice.toFixed(2)} {currency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {item.subtotal?.toFixed(2) || (item.productPrice * item.quantity).toFixed(2)} {currency}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    {items.length} {items.length === 1 ? t('orderItem') : t('orderItems')}
                    {shippingLabel && (
                      <span className="block text-xs text-gray-400">
                        {t('orderShipping')}: {shippingLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-semibold">
                    {t('total')}: {totalAmount.toFixed(2)} {currency}
                  </div>
                </div>
              </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />
    </section>
  );
};

export default Orders;