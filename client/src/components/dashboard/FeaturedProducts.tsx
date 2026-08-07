import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, StarHalf } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  // Helper to render stars based on rating
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} className="text-yellow-400 h-3 w-3 fill-current" />);
    }
    
    // Add half star if needed
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" className="text-yellow-400 h-3 w-3 fill-current" />);
    }
    
    // Add empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="text-yellow-400 h-3 w-3" />);
    }
    
    return stars;
  };

  return (
    <Card className="overflow-hidden h-full">
      <div className="h-40 overflow-hidden">
        <img
          src={product.imageUrl || '/placeholder-image.jpg'}
          alt={product.name}
          className="w-full h-32 object-cover rounded-t-lg"
        />
      </div>
      <CardContent className="p-4">
        <h4 className="font-medium mb-1">{product.name}</h4>
        <div className="flex items-center mb-2">
          <div className="flex">
            {renderStars(product.rating || 0)}
          </div>
          <span className="text-xs text-gray-500 ml-1">
            {product.rating?.toFixed(1)} ({product.reviewCount})
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">${product.price.toFixed(2)}</span>
          <Button size="sm">Add to Cart</Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface FeaturedProductsProps {
  products?: Product[];
  loading?: boolean;
}

const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ 
  products, 
  loading = false 
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse h-[280px]">
            <div className="h-40 bg-gray-200"></div>
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
              <div className="flex justify-between">
                <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Use default products if none provided
  const defaultProducts: Product[] = [
    {
      id: 1,
      name: "Premium Protein Powder",
      description: "High-quality protein powder with 24g of protein per serving.",
      price: 39.99,
      imageUrl: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?w=600&h=400&fit=crop",
      category: "supplements",
      rating: 4.5,
      reviewCount: 120,
      stock: 50
    },
    {
      id: 2,
      name: "Resistance Bands Set",
      description: "Complete set of resistance bands for home workouts.",
      price: 24.99,
      imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop",
      category: "equipment",
      rating: 4.0,
      reviewCount: 85,
      stock: 30
    },
    {
      id: 3,
      name: "Smart Fitness Tracker",
      description: "Advanced fitness tracker that monitors heart rate, steps, and sleep.",
      price: 89.99,
      imageUrl: "https://images.unsplash.com/photo-1575311373937-040b8e1fd93b?w=600&h=400&fit=crop",
      category: "electronics",
      rating: 5.0,
      reviewCount: 42,
      stock: 15
    },
    {
      id: 4,
      name: "Premium Yoga Mat",
      description: "Eco-friendly, non-slip yoga mat. Perfect for yoga and pilates.",
      price: 34.99,
      imageUrl: "https://images.unsplash.com/photo-1603988363607-e1e4a66962c6?w=600&h=400&fit=crop",
      category: "equipment",
      rating: 4.5,
      reviewCount: 110,
      stock: 25
    }
  ];

  const displayProducts = products || defaultProducts;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {displayProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};

export default FeaturedProducts;
