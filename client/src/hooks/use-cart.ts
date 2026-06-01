import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Product } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { triggerGuestUpgradePrompt } from '@/lib/guest-utils';

export interface CartProduct extends Product {}

export interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  lineTotal: number;
  product: CartProduct;
  createdAt: string;
  updatedAt: string;
}

export interface CartResponse {
  items: CartItem[];
  subtotal: number;
  currency: string;
  itemCount: number;
}

export interface CheckoutPayload {
  shippingAddress: string;
  shippingCity: string;
  shippingCountry: string;
  shippingPhone: string;
  notes?: string;
  paymentMethod: 'card' | 'cod';
  paymentProvider?: 'stripe' | 'paypal' | 'paymob';
}

export interface CheckoutResponse {
  orderId: number;
  sessionId: string;
  checkoutUrl: string | null;
  clientSecret: string | null;
  paymentProvider?: 'stripe' | 'paypal' | 'paymob';
}

export const CART_QUERY_KEY = ['/api/cart'];

type AddToCartPayload = { productId: number; quantity?: number };
type UpdateCartPayload = { productId: number; quantity: number };

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = (data as any)?.message || 'Something went wrong';
    throw new Error(message);
  }
  return data as T;
}

export function useCart() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  const assertGuestCanMutate = () => {
    if (typeof window !== 'undefined' && localStorage.getItem('guestUser')) {
      triggerGuestUpgradePrompt();
      throw new Error('Guests cannot perform cart actions');
    }
  };

  const cartQuery = useQuery<CartResponse>({
    queryKey: CART_QUERY_KEY,
  });

  const addMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: AddToCartPayload) => {
      assertGuestCanMutate();
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity }),
      });
      return handleResponse<CartResponse>(response);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CART_QUERY_KEY, data);
      toast({
        title: t('addedToCart') || 'Added to cart',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('cartUpdateFailed') || 'Unable to add to cart',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ productId, quantity }: UpdateCartPayload) => {
      assertGuestCanMutate();
      const response = await fetch(`/api/cart/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quantity }),
      });
      return handleResponse<CartResponse>(response);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CART_QUERY_KEY, data);
      toast({
        title: t('cartUpdated') || 'Cart updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('cartUpdateFailed') || 'Unable to update cart',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: number) => {
      assertGuestCanMutate();
      const response = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return handleResponse<CartResponse>(response);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CART_QUERY_KEY, data);
      toast({
        title: t('itemRemovedFromCart') || 'Item removed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('cartUpdateFailed') || 'Unable to update cart',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      assertGuestCanMutate();
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        credentials: 'include',
      });
      return handleResponse<CartResponse>(response);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(CART_QUERY_KEY, data);
      toast({
        title: t('cartCleared') || 'Cart cleared',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('cartUpdateFailed') || 'Unable to clear cart',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (payload: CheckoutPayload) => {
      assertGuestCanMutate();
      const response = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      return handleResponse<CheckoutResponse>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
    onError: (error: Error) => {
      toast({
        title: t('checkoutFailed') || 'Checkout failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const isMutating = useMemo(() => addMutation.isPending || updateMutation.isPending || removeMutation.isPending || clearMutation.isPending, [addMutation.isPending, updateMutation.isPending, removeMutation.isPending, clearMutation.isPending]);

  return {
    cart: cartQuery.data,
    isLoading: cartQuery.isLoading,
    isError: cartQuery.isError,
    refetchCart: cartQuery.refetch,
    addToCart: (payload: AddToCartPayload) => addMutation.mutateAsync(payload),
    updateCartItem: (payload: UpdateCartPayload) => updateMutation.mutateAsync(payload),
    removeFromCart: (productId: number) => removeMutation.mutateAsync(productId),
    clearCart: () => clearMutation.mutateAsync(),
    checkout: (payload: CheckoutPayload) => checkoutMutation.mutateAsync(payload),
    addToCartPending: addMutation.isPending,
    updateCartPending: updateMutation.isPending,
    checkoutPending: checkoutMutation.isPending,
    isMutating,
  };
}
