import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CoachProduct, AffiliateProduct, Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Search, Star, Package, ShoppingCart } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/hooks/use-auth';
import PublicHeader from '@/components/layout/PublicHeader';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'wouter';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { useGuestRestriction } from '@/hooks/use-guest-restriction';

const Store = () => {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const { user } = useAuth();
  const { isGuest, blockAction } = useGuestRestriction();
  const { toast } = useToast();
  const { cart: cartSummary, addToCart, addToCartPending } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const showPublicHeader = !user;

  // Mutation to record product clicks
  const recordClickMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await fetch('/api/product-clicks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ affiliateProductId: productId })
      });
      if (!response.ok) throw new Error('Failed to record click');
      return response.json();
    }
  });

  // Fetch global products (purchasable products)
  const { data: globalProducts, isLoading: globalProductsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Fetch coach products for the current user's assigned coach
  const { data: coachProducts, isLoading: coachProductsLoading } = useQuery<CoachProduct[]>({
    queryKey: ['/api/my-coach-products'],
  });

  // Fetch affiliate products (active only)
  const { data: affiliateProducts, isLoading: affiliateProductsLoading } = useQuery<AffiliateProduct[]>({
    queryKey: ['/api/affiliate-products'],
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleImageError = (productId: string) => {
    setImageErrors(prev => ({ ...prev, [productId]: true }));
  };

  // Generate thumbnail URL from product URL if no thumbnail is provided
  const getThumbnailUrl = (product: CoachProduct): string | null => {
    if (product.thumbnailUrl) {
      return product.thumbnailUrl;
    }
    
    try {
      const url = new URL(product.url);
      return `https://image.thum.io/get/width/400/crop/600/${encodeURIComponent(product.url)}`;
    } catch (e) {
      return null;
    }
  };

  // Filter products by search term
  const filteredGlobalProducts = globalProducts?.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCoachProducts = coachProducts?.filter(product => 
    product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredAffiliateProducts = affiliateProducts?.filter(product => 
    product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isLoading = globalProductsLoading || coachProductsLoading || affiliateProductsLoading;

  const handleAddProductToCart = async (product: Product) => {
    if (!user) {
      window.location.href = '/auth?mode=login';
      return;
    }

    if (isGuest) {
      blockAction();
      return;
    }

    if (product.stock === 0) {
      toast({
        title: t('outOfStock') || 'Out of stock',
        description: product.name,
        variant: 'destructive',
      });
      return;
    }

    try {
      await addToCart({ productId: product.id, quantity: 1 });
    } catch (error) {
      toast({
        title: t('cartUpdateFailed') || 'Unable to update cart',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const renderGlobalProductCard = (product: Product) => {
    const hasImageError = imageErrors[`product-${product.id}`];
    
    return (
      <Card key={`product-${product.id}`} className={`flex flex-col overflow-hidden hover:shadow-lg transition-shadow ${isRTL ? 'text-right' : ''}`}>
        {product.imageUrl && !hasImageError ? (
          <div className="w-full h-48 overflow-hidden bg-gray-100">
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover"
              onError={() => handleImageError(`product-${product.id}`)}
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-300" />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CardTitle className="text-base line-clamp-2 flex-1">{product.name}</CardTitle>
            <Badge variant="default" className="shrink-0 capitalize">{product.category}</Badge>
          </div>
          <div className={`flex items-center gap-2 mt-2 ${isRTL ? 'justify-end' : ''}`}>
            <span className="text-lg font-bold text-primary">{product.price.toFixed(2)} EGP</span>
            {product.rating && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>{product.rating}</span>
                {product.reviewCount && <span className="text-gray-400">({product.reviewCount})</span>}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {product.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-3">{product.description}</p>
          )}
          <div className={`flex items-center justify-between text-sm text-gray-500 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('stock')}: {product.stock > 0 ? product.stock : t('outOfStock')}</span>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <Button 
              className="w-full"
              disabled={product.stock === 0 || addToCartPending}
              onClick={() => handleAddProductToCart(product)}
            >
              <ShoppingCart className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {product.stock > 0 ? (t('addToCart') || 'Add to Cart') : t('outOfStock')}
            </Button>
            <Link href={`/product/${product.id}`}>
              <Button variant="outline" className="w-full">
                {t('viewDetails') || 'View details'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCoachProductCard = (product: CoachProduct) => {
    const isValidUrl = product.url.startsWith('http://') || product.url.startsWith('https://');
    const hasImageError = imageErrors[`coach-${product.id}`];
    const thumbnailUrl = getThumbnailUrl(product);
    
    return (
      <Card key={`coach-${product.id}`} className={`flex flex-col overflow-hidden hover:shadow-lg transition-shadow ${isRTL ? 'text-right' : ''}`}>
        {thumbnailUrl && !hasImageError ? (
          <div className="w-full h-48 overflow-hidden bg-gray-100">
            <img 
              src={thumbnailUrl} 
              alt={product.title}
              className="w-full h-full object-contain p-2"
              onError={() => handleImageError(`coach-${product.id}`)}
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-300" />
          </div>
        )}
        <CardHeader className="pb-3">
          <CardTitle className="text-base line-clamp-2">{product.title}</CardTitle>
          <Badge variant="outline" className="w-fit mt-1">{t('coachRecommended')}</Badge>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {product.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
          )}
          <Button 
            className="w-full mt-auto"
            onClick={() => {
              if (isValidUrl) {
                recordClickMutation.mutate(product.id);
                window.open(product.url, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={!isValidUrl}
          >
            <ExternalLink className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('viewProduct')}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderAffiliateProductCard = (product: AffiliateProduct) => {
    const isValidUrl = product.url.startsWith('http://') || product.url.startsWith('https://');
    const hasImageError = imageErrors[`affiliate-${product.id}`];
    
    return (
      <Card key={`affiliate-${product.id}`} className={`flex flex-col overflow-hidden hover:shadow-lg transition-shadow ${isRTL ? 'text-right' : ''}`}>
        {product.thumbnailUrl && !hasImageError ? (
          <div className="w-full h-48 overflow-hidden bg-gray-100">
            <img 
              src={product.thumbnailUrl} 
              alt={product.title}
              className="w-full h-full object-contain p-2"
              onError={() => handleImageError(`affiliate-${product.id}`)}
            />
          </div>
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-300" />
          </div>
        )}
        <CardHeader className="pb-3">
          <CardTitle className="text-base line-clamp-2">{product.title}</CardTitle>
          {product.source && (
            <Badge variant="outline" className="capitalize w-fit mt-1">
              {product.source}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {product.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
          )}
          {product.category && (
            <p className="text-xs text-gray-500 mb-3">{t('category')}: {product.category}</p>
          )}
          <Button 
            className="w-full mt-auto"
            onClick={() => {
              if (isValidUrl) {
                recordClickMutation.mutate(product.id);
                window.open(product.url, '_blank', 'noopener,noreferrer');
              }
            }}
            disabled={!isValidUrl}
          >
            <ExternalLink className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('viewProduct')}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <section className={`p-4 md:p-6 lg:p-8 min-h-screen bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {showPublicHeader && (
        <div className="mb-6">
          <PublicHeader
            title={t("store")}
            subtitle={t("storeSubtitle")}
            backButtonClassName="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/60"
            stickyTopClassName="top-[116px]"
          />
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between mb-6">
        <div>
          {user && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800">{t('store')}</h2>
              <p className="text-gray-600">{t('storeSubtitle')}</p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative">
            <Search className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input
              placeholder={t('searchProducts')}
              className={`${isRTL ? 'pr-10' : 'pl-10'} w-full md:w-64`}
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <Link href="/cart">
            <Button variant="outline" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {t('viewCart') || 'View Cart'}
              {cartSummary?.itemCount ? (
                <Badge variant="secondary" className={isRTL ? 'mr-1' : 'ml-1'}>
                  {cartSummary.itemCount}
                </Badge>
              ) : null}
            </Button>
          </Link>
        </div>
      </div>

      {/* Products Display with Tabs */}
      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="grid w-full grid-cols-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsTrigger value="shop">{t('shop')}</TabsTrigger>
          <TabsTrigger value="all">{t('allProducts')}</TabsTrigger>
          <TabsTrigger value="coach">{t('coachProducts')}</TabsTrigger>
          <TabsTrigger value="affiliate">{t('featuredProducts')}</TabsTrigger>
        </TabsList>

        {/* Shop Tab - Global Purchasable Products */}
        <TabsContent value="shop" className="mt-6">
          {globalProductsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
              {[...Array(12)].map((_, i) => (
                <Card key={i}>
                  <div className="h-48 bg-gray-200"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !globalProducts || globalProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg mb-2">{t('noProductsAvailable')}</p>
                  <p className="text-gray-400 text-sm">{t('checkBackLater')}</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredGlobalProducts && filteredGlobalProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
              {filteredGlobalProducts.map(product => renderGlobalProductCard(product))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8">
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t('noProductsMatching').replace('{searchTerm}', searchTerm)}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setSearchTerm('')}>
                    {t('clearSearch')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <div className="h-40 bg-gray-200"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
              {filteredGlobalProducts && filteredGlobalProducts.length > 0 && 
                filteredGlobalProducts.map(product => renderGlobalProductCard(product))}
              {filteredCoachProducts && filteredCoachProducts.length > 0 && 
                filteredCoachProducts.map(product => renderCoachProductCard(product))}
              {filteredAffiliateProducts && filteredAffiliateProducts.length > 0 && 
                filteredAffiliateProducts.map(product => renderAffiliateProductCard(product))}
              {(!filteredGlobalProducts || filteredGlobalProducts.length === 0) &&
               (!filteredCoachProducts || filteredCoachProducts.length === 0) && 
               (!filteredAffiliateProducts || filteredAffiliateProducts.length === 0) && (
                <Card className="col-span-full">
                  <CardContent className="p-8">
                    <div className="text-center py-10 bg-gray-50 rounded-lg">
                      <p className="text-gray-500 text-lg mb-2">{t('noProductsFound')}</p>
                      <p className="text-gray-400 text-sm">
                        {searchTerm ? t('noProductsMatching').replace('{searchTerm}', searchTerm) : t('noProductsAvailable')}
                      </p>
                      {searchTerm && (
                        <Button variant="outline" className="mt-4" onClick={() => setSearchTerm('')}>
                          {t('clearSearch')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="coach" className="mt-6">
          {coachProductsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <div className="h-40 bg-gray-200"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !coachProducts || coachProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-lg mb-2">{t('noCoachProductsAvailable')}</p>
                  <p className="text-gray-400 text-sm">
                    {!coachProducts ? t('noAssignedCoach') : t('noCoachProductsMessage')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : filteredCoachProducts && filteredCoachProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
              {filteredCoachProducts.map(product => renderCoachProductCard(product))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8">
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t('noProductsMatching').replace('{searchTerm}', searchTerm)}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setSearchTerm('')}>
                    {t('clearSearch')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="affiliate" className="mt-6">
          {affiliateProductsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <div className="h-40 bg-gray-200"></div>
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !affiliateProducts || affiliateProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-lg mb-2">{t('noAffiliateProductsAvailable')}</p>
                  <p className="text-gray-400 text-sm">{t('checkBackLater')}</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredAffiliateProducts && filteredAffiliateProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
              {filteredAffiliateProducts.map(product => renderAffiliateProductCard(product))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8">
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t('noProductsMatching').replace('{searchTerm}', searchTerm)}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setSearchTerm('')}>
                    {t('clearSearch')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />
    </section>
  );
};

export default Store;
