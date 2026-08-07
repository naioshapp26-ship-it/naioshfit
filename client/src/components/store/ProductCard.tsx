import React from 'react';
import { Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Star, StarHalf } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  // Helper to render star ratings
  const renderStarRating = (rating: number | undefined) => {
    if (!rating) return null;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 text-yellow-400 fill-current" />
        ))}
        
        {/* Half star if needed */}
        {hasHalfStar && <StarHalf className="h-4 w-4 text-yellow-400 fill-current" />}
        
        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-yellow-400" />
        ))}
      </div>
    );
  };

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart(product);
    }
  };

  return (
    <Card className="overflow-hidden h-full">
      <div className="h-40 overflow-hidden">
                <img
          src={product.imageUrl || '/placeholder-image.jpg'}
          alt={product.name}
          className="w-full h-48 object-cover"
        />
      </div>
      <CardContent className="p-4">
        <h4 className="font-medium mb-1">{product.name}</h4>
        <div className="flex items-center mb-2">
          {renderStarRating(product.rating ?? 0)}
          <span className="text-xs text-gray-500 ml-1">
            {product.rating?.toFixed(1)} ({product.reviewCount})
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
        <div className="flex justify-between items-center">
          <span className="font-semibold">${product.price.toFixed(2)}</span>
          <Button size="sm" onClick={handleAddToCart}>Add to Cart</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
