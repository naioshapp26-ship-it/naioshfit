import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { FoodItem } from '@shared/schema';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { convertArabicToEnglish, convertEnglishToArabic } from '@/lib/utils';

interface FoodSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (food: FoodItem, quantity: number) => void;
}

const FoodSearchModal: React.FC<FoodSearchModalProps> = ({ open, onClose, onSelect }) => {
  console.log('[FoodSearchModal] Component rendered', { open });
  
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState<number>(100);
  const [servings, setServings] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFoodData, setNewFoodData] = useState({
    name: '',
    nameAr: '',
    brand: '',
    brandAr: '',
    calories: '',
    proteins: '',
    carbs: '',
    fats: '',
    fiber: '',
    servingSize: '',
    servingSizeGrams: '',
    category: '',
  });
  const debounceRef = useRef<NodeJS.Timeout>();
  const currentRequestRef = useRef<AbortController>();
  const aiSearchTriggeredRef = useRef<string>(''); // Track if AI search was triggered for a query

  // Fetch all food items on component mount
  useEffect(() => {
    if (open) {
      fetchAllFoodItems();
    }
  }, [open]);

  // Debounced search effect
  useEffect(() => {
    // Clear previous debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // If search query is empty, show all items immediately
    if (searchQuery.trim() === '') {
      setFilteredItems(foodItems);
      return;
    }

    // Debounce search by 3500ms (3.5 seconds) to wait for user to finish typing
    // This also delays the OpenAI request since it's only triggered after database search
    debounceRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 3500);

    // Cleanup function
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]); // Only depend on searchQuery to prevent re-triggering after AI adds food

  const fetchAllFoodItems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/food-database/items');
      if (!response.ok) throw new Error('Failed to fetch food items');
      const data = await response.json();
      setFoodItems(data);
      setFilteredItems(data);
    } catch (error) {
      console.error('Error fetching food items:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setFilteredItems(foodItems);
      return;
    }
    
    // Cancel previous request if it exists
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    // Create new abort controller for this request
    currentRequestRef.current = new AbortController();
    
    try {
      setLoading(true);
      const response = await fetch(
        `/api/food-database/items?query=${encodeURIComponent(query)}`,
        { signal: currentRequestRef.current.signal }
      );
      
      if (!response.ok) throw new Error('Failed to search food items');
      const data = await response.json();
      setFilteredItems(data);
      
      // If no results found and we haven't already tried AI search for this query, 
      // trigger AI search automatically. We track this to avoid duplicate AI requests
      // for the same search query during the same modal session.
      if (data.length === 0 && aiSearchTriggeredRef.current !== query) {
        aiSearchTriggeredRef.current = query;
        await searchWithAI(query);
      }
    } catch (error) {
      // Don't log abort errors as they are expected
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error searching food items:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const searchWithAI = async (query: string) => {
    try {
      setAiSearching(true);
      
      const response = await fetch('/api/food-database/search-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to search with AI');
      }

      const newFood = await response.json();
      
      // Add the newly created food to the filtered items immediately
      setFilteredItems([newFood]);
      
      // Also add to the full food items list
      setFoodItems(prev => [newFood, ...prev]);
      
      // Show success message
      toast({
        title: t("success") || "Success",
        description: t("foodFoundAndAdded") || "Food item found and added to database!",
      });
      
      // Auto-select the newly found food
      handleSelectFood(newFood);
    } catch (error) {
      console.error('Error searching with AI:', error);
      toast({
        title: t("aiSearchFailed") || "AI Search Failed",
        description: error instanceof Error ? error.message : "Could not find food information. Please try creating it manually.",
        variant: "destructive",
      });
    } finally {
      setAiSearching(false);
    }
  };

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    setQuantity(food.servingSizeGrams);
    setServings(1);
  };

  const handleConfirmSelection = () => {
    console.log('[FoodSearchModal] Confirm selection clicked', { selectedFood: selectedFood?.name, quantity });
    if (selectedFood) {
      console.log('[FoodSearchModal] Calling onSelect');
      onSelect(selectedFood, quantity);
      console.log('[FoodSearchModal] Calling handleClose');
      handleClose();
    }
  };

  const handleCreateFood = async () => {
    try {
      setLoading(true);
      
      // Validate required fields
      if (!newFoodData.name || !newFoodData.calories || !newFoodData.proteins || 
          !newFoodData.carbs || !newFoodData.fats || !newFoodData.fiber ||
          !newFoodData.servingSize || !newFoodData.servingSizeGrams || !newFoodData.category) {
        toast({
          title: t("error") || "Error",
          description: t("pleaseFillAllFields") || "Please fill all required fields",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/food-database/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFoodData.name,
          nameAr: newFoodData.nameAr || null,
          brand: newFoodData.brand || null,
          brandAr: newFoodData.brandAr || null,
          calories: parseFloat(newFoodData.calories),
          proteins: parseFloat(newFoodData.proteins),
          carbs: parseFloat(newFoodData.carbs),
          fats: parseFloat(newFoodData.fats),
          fiber: parseFloat(newFoodData.fiber),
          servingSize: newFoodData.servingSize,
          servingSizeGrams: parseFloat(newFoodData.servingSizeGrams),
          category: newFoodData.category,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create food item');
      }

      const createdFood = await response.json();
      
      // Show success message
      toast({
        title: t("success") || "Success",
        description: t("foodCreatedSuccessfully") || "Food item created successfully",
      });
      
      // Refresh the food list
      fetchAllFoodItems();
      
      // Reset form and hide it
      setNewFoodData({
        name: '',
        nameAr: '',
        brand: '',
        brandAr: '',
        calories: '',
        proteins: '',
        carbs: '',
        fats: '',
        fiber: '',
        servingSize: '',
        servingSizeGrams: '',
        category: '',
      });
      setShowCreateForm(false);
      
      // Auto-select the newly created food
      handleSelectFood(createdFood);
    } catch (error) {
      console.error('Error creating food:', error);
      toast({
        title: t("error") || "Error",
        description: t("errorCreatingFood") || "Error creating food item. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    console.log('[FoodSearchModal] handleClose called');
    // Call onClose first to close the dialog
    console.log('[FoodSearchModal] Calling onClose - modal will close');
    onClose();
    console.log('[FoodSearchModal] onClose completed');
    
    // Clean up after dialog starts closing
    console.log('[FoodSearchModal] Scheduling cleanup');
    setTimeout(() => {
      console.log('[FoodSearchModal] Executing cleanup');
      // Clean up any pending requests and timers
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
      
      setSearchQuery('');
      setSelectedFood(null);
      setQuantity(100);
      setShowCreateForm(false);
      setAiSearching(false);
      aiSearchTriggeredRef.current = '';
      setNewFoodData({
        name: '',
        nameAr: '',
        brand: '',
        brandAr: '',
        calories: '',
        proteins: '',
        carbs: '',
        fats: '',
        fiber: '',
        servingSize: '',
        servingSizeGrams: '',
        category: '',
      });
    }, 0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []);

  const renderFoodItem = (food: FoodItem) => {
    // Always display both English and Arabic names regardless of current language
    const primaryName = food.name;
    const secondaryName = food.nameAr;
    
    return (
      <Card 
        key={food.id} 
        className={`mb-2 cursor-pointer hover:bg-gray-50 ${selectedFood?.id === food.id ? 'border-primary' : ''}`}
        onClick={() => handleSelectFood(food)}
      >
        <CardContent className="p-3">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">{primaryName}</h4>
              {secondaryName && (
                <p className="text-sm text-gray-600 mt-0.5">{secondaryName}</p>
              )}
              <p className="text-sm text-gray-500">{food.servingSize}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{food.calories} cal</p>
              <p className="text-xs text-gray-500">{t("per")} {food.servingSizeGrams}g</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
            <div>
              <span className="text-gray-500">{t("protein")}:</span> {food.proteins}g
            </div>
            <div>
              <span className="text-gray-500">{t("carbs")}:</span> {food.carbs}g
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-gray-500">{t("fat")}:</span> {food.fats}g
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-w-[95vw] max-h-[90vh] h-[90vh] flex flex-col w-full mx-4">
        <DialogHeader>
          <DialogTitle>{t("searchFoodDatabase")}</DialogTitle>
          <DialogDescription>
            {t("browseAllFoods")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchFoods")}
              className="pr-8"
            />
            <Search 
              className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" 
            />
          </div>
        </div>
        
        {showCreateForm && (
          <div className="mb-4 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-medium mb-3">{t("createNewFood") || "Create New Food"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t("name")} *</label>
                <Input
                  value={newFoodData.name}
                  onChange={(e) => setNewFoodData({...newFoodData, name: e.target.value})}
                  placeholder={t("foodName") || "Food name"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("nameArabic")}</label>
                <Input
                  value={newFoodData.nameAr}
                  onChange={(e) => setNewFoodData({...newFoodData, nameAr: e.target.value})}
                  placeholder={t("arabicName") || "Arabic name"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("brand")}</label>
                <Input
                  value={newFoodData.brand}
                  onChange={(e) => setNewFoodData({...newFoodData, brand: e.target.value})}
                  placeholder={t("brandName") || "Brand name"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("brandArabic")}</label>
                <Input
                  value={newFoodData.brandAr}
                  onChange={(e) => setNewFoodData({...newFoodData, brandAr: e.target.value})}
                  placeholder={t("arabicBrand") || "Arabic brand"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("calories")} *</label>
                <Input
                  type="number"
                  value={newFoodData.calories}
                  onChange={(e) => setNewFoodData({...newFoodData, calories: e.target.value})}
                  placeholder="165"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("protein")} (g) *</label>
                <Input
                  type="number"
                  value={newFoodData.proteins}
                  onChange={(e) => setNewFoodData({...newFoodData, proteins: e.target.value})}
                  placeholder="31"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("carbs")} (g) *</label>
                <Input
                  type="number"
                  value={newFoodData.carbs}
                  onChange={(e) => setNewFoodData({...newFoodData, carbs: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("fat")} (g) *</label>
                <Input
                  type="number"
                  value={newFoodData.fats}
                  onChange={(e) => setNewFoodData({...newFoodData, fats: e.target.value})}
                  placeholder="3.6"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("fiber")} (g) *</label>
                <Input
                  type="number"
                  value={newFoodData.fiber}
                  onChange={(e) => setNewFoodData({...newFoodData, fiber: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("servingSize")} *</label>
                <Input
                  value={newFoodData.servingSize}
                  onChange={(e) => setNewFoodData({...newFoodData, servingSize: e.target.value})}
                  placeholder="1 breast (100g)"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("servingSizeGrams")} *</label>
                <Input
                  type="number"
                  value={newFoodData.servingSizeGrams}
                  onChange={(e) => setNewFoodData({...newFoodData, servingSizeGrams: e.target.value})}
                  placeholder="100"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("category")} *</label>
                <Input
                  value={newFoodData.category}
                  onChange={(e) => setNewFoodData({...newFoodData, category: e.target.value})}
                  placeholder="Proteins"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={handleCreateFood} disabled={loading}>
                {loading ? t("saving") || "Saving..." : t("save") || "Save"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-auto">
          <div className="space-y-3">
            {loading || aiSearching ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-gray-500">
                  {aiSearching 
                    ? (t("searchingWithAI") || "Searching with AI...")
                    : t("loading")}
                </p>
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map(food => renderFoodItem(food))
            ) : (
              <p className="text-center py-8 text-gray-500">{t("noData")}</p>
            )}
          </div>
        </div>
        
        {selectedFood && (
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{selectedFood.name}</h4>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFood(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <p className="text-sm mb-1">{t("numberOfServings")}</p>
                <Input
                  type="text"
                  value={language === 'ar' ? convertEnglishToArabic(servings > 0 ? servings.toString() : '') : (servings > 0 ? servings.toString() : '')}
                  onChange={(e) => {
                    const inputValue = language === 'ar' ? convertArabicToEnglish(e.target.value) : e.target.value;
                    const newServings = inputValue === '' ? 0 : Number(inputValue) || 0;
                    setServings(newServings);
                    setQuantity(selectedFood.servingSizeGrams * newServings);
                  }}
                  placeholder={language === 'ar' ? '١' : '1'}
                />
              </div>
              <div>
                <p className="text-sm mb-1">{t("quantityGrams")}</p>
                <Input
                  type="text"
                  value={language === 'ar' ? convertEnglishToArabic(quantity > 0 ? quantity.toString() : '') : (quantity > 0 ? quantity.toString() : '')}
                  onChange={(e) => {
                    const inputValue = language === 'ar' ? convertArabicToEnglish(e.target.value) : e.target.value;
                    const newQuantity = inputValue === '' ? 0 : Number(inputValue) || 0;
                    setQuantity(newQuantity);
                    setServings(newQuantity / selectedFood.servingSizeGrams);
                  }}
                  placeholder={language === 'ar' ? '١٠٠' : '100'}
                />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">{t("calories")}</p>
                <p className="font-semibold">
                  {language === 'ar' ? convertEnglishToArabic(Math.round((selectedFood.calories / selectedFood.servingSizeGrams) * quantity).toString()) : Math.round((selectedFood.calories / selectedFood.servingSizeGrams) * quantity)} {t("cal")}
                </p>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {t("serving")}: {selectedFood.servingSize} ({language === 'ar' ? convertEnglishToArabic(selectedFood.servingSizeGrams.toString()) : selectedFood.servingSizeGrams}{t("grams")})
            </div>
          </div>
        )}
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>{t("cancel")}</Button>
          <Button 
            onClick={handleConfirmSelection} 
            disabled={!selectedFood}
          >
            {t("addToMeal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FoodSearchModal;