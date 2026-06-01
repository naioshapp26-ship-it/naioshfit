import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, Link, useLocation } from 'wouter';
import { Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Star, Package, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import PublicHeader from '@/components/layout/PublicHeader';

const ProductDetail = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute('/product/:id');
  const productId = params?.id ? parseInt(params.id) : null;
  const [quantity, setQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);
  const { addToCart, addToCartPending } = useCart();
  const showPublicHeader = !user;

  // Fetch product details
  const { data: product, isLoading } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !!productId,
  });

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && product && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = async (redirectAfter?: boolean) => {
    if (!product || product.stock === 0) {
      return;
    }

    if (!user) {
      toast({
        title: t('loginRequired') || 'Login Required',
        description: t('loginToMakeOrderMessage') || 'Please log in to make an order',
        variant: 'destructive',
      });
      window.location.href = `/auth?returnTo=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    try {
      await addToCart({ productId: product.id, quantity });
      toast({
        title: t('addedToCart') || 'Added to cart',
        description: product.name,
      });
      setQuantity(1);
      if (redirectAfter) {
        navigate('/cart');
      }
    } catch (error) {
      toast({
        title: t('cartUpdateFailed') || 'Unable to update cart',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  if (!productId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-600">{t('invalidProductId') || 'Invalid product ID'}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/store">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToStore') || 'Back to Store'}
          </Button>
        </Link>
        <p className="text-center text-gray-600">{t('productNotFound') || 'Product not found'}</p>
      </div>
    );
  }

  const getThumbnailUrl = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.includes('youtube.com') || imageUrl.includes('youtu.be')) {
      const videoId = imageUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
    }
    return imageUrl;
  };

  const thumbnailUrl = getThumbnailUrl(product.imageUrl);
  const isOutOfStock = product.stock === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 via-gray-100 to-white">
      <div className="container mx-auto px-4 py-8">
      {showPublicHeader ? (
        <div className="mb-6">
          <PublicHeader
            title={product.name}
            subtitle={product.description || undefined}
            backHref="/store"
            backLabel={t('backToStore')}
          />
        </div>
      ) : (
        <Link href="/store">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToStore') || 'Back to Store'}
          </Button>
        </Link>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            {thumbnailUrl && !imageError ? (
              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                <img 
                  src={thumbnailUrl} 
                  alt={product.name}
                  className="w-full h-full object-contain p-4"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                <Package className="h-32 w-32 text-gray-300" />
              </div>
            )}
          </Card>
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <Badge variant="default" className="text-sm capitalize">{product.category}</Badge>
            </div>
            
            {product.description && (
              <p className="text-gray-600 mb-4">{product.description}</p>
            )}

            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl font-bold text-primary">{product.price.toFixed(2)} EGP</span>
              {product.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{product.rating}</span>
                  {product.reviewCount && (
                    <span className="text-gray-500">({product.reviewCount} {t('reviews') || 'reviews'})</span>
                  )}
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 text-lg">
                <span className="font-medium">{t('stock')}:</span>
                {isOutOfStock ? (
                  <Badge variant="destructive">{t('outOfStock')}</Badge>
                ) : (
                  <Badge variant="secondary">{product.stock} {t('available') || 'available'}</Badge>
                )}
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('orderNow') || 'Order Now'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">{t('quantity') || 'Quantity'}</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1 || isOutOfStock}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={product.stock}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 1 && val <= product.stock) {
                        setQuantity(val);
                      }
                    }}
                    className="w-20 text-center"
                    disabled={isOutOfStock}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= product.stock || isOutOfStock}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-lg font-medium">{t('orderTotal') || 'Total'}:</span>
                <span className="text-2xl font-bold text-primary">
                  {(product.price * quantity).toFixed(2)} EGP
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleAddToCart(false)}
                  disabled={isOutOfStock || addToCartPending}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {addToCartPending ? (t('processing') || 'Processing...') : t('addToCart') || 'Add to Cart'}
                </Button>
                <Button
                  className="w-full"
                  size="lg"
                  variant="outline"
                  onClick={() => handleAddToCart(true)}
                  disabled={isOutOfStock || addToCartPending}
                >
                  {t('checkout') || 'Checkout'}
                </Button>
              </div>

              <p className="text-sm text-gray-500 text-center">
                {t('secureCheckout') || 'Secure checkout · Free shipping on orders over 500 EGP'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ProductDetail;
