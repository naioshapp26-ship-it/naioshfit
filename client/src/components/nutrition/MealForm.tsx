import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertMealSchema } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash, Edit2 } from 'lucide-react';
import FoodSearchModal from './FoodSearchModal';
import { FoodItem } from '@shared/schema';
import { calculateNutrition } from '@shared/foodDatabase';
import { convertArabicToEnglish, convertEnglishToArabic } from '@/lib/utils';
import { datetimeLocalToUtcIso, utcIsoToDatetimeLocal, normalizeMealDateForStorage } from '@/lib/timezone';

// Extend the schema with validation but make it more flexible
const formSchema = insertMealSchema.extend({
  name: z.string().optional().default(""),
  calories: z.coerce.number().min(0).default(0),
  proteins: z.coerce.number().min(0).default(0),
  carbs: z.coerce.number().min(0).default(0),
  fats: z.coerce.number().min(0).default(0),
  fiber: z.coerce.number().optional().default(0),
  date: z.union([z.string().datetime(), z.date()]).default(new Date().toISOString()),
});

type FormValues = z.infer<typeof formSchema>;

interface MealFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<FormValues>;
  isEditing?: boolean;
  mealId?: number;
  onCancel?: () => void;
}

interface MealFoodItem {
  food: FoodItem;
  quantity: number;
  nutrition: {
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
  };
}

const MealForm: React.FC<MealFormProps> = ({
  onSuccess,
  defaultValues,
  isEditing = false,
  mealId,
  onCancel
}) => {
  console.log('[MealForm] Component mounted/rendered', { isEditing, mealId, hasDefaultValues: !!defaultValues });
  
  const isMountedRef = useRef(true);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [isFoodSearchOpen, setIsFoodSearchOpen] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState<MealFoodItem[]>([]);
  const [totalNutrition, setTotalNutrition] = useState({
    calories: 0,
    proteins: 0,
    carbs: 0,
    fats: 0,
    fiber: 0
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: defaultValues?.type || "breakfast",
      calories: 0,
      proteins: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      date: new Date().toISOString(),
      ...defaultValues
    },
    mode: "onChange",
    shouldUnregister: false, // Prevent form from resetting fields on unmount
    shouldUseNativeValidation: false, // Prevent browser validation errors
  });

  // Wrap form context to prevent errors during unmount
  const safeFormContext = React.useMemo(() => {
    const handler = {
      get(target: any, prop: string) {
        // If component is unmounting, return safe no-op functions
        if (!isMountedRef.current && typeof target[prop] === 'function') {
          return () => {};
        }
        return target[prop];
      }
    };
    return new Proxy(form, handler);
  }, [form]);

  // Component unmount tracking
  useEffect(() => {
    console.log('[MealForm] Component mounted, setting up unmount logger');
    isMountedRef.current = true;
    return () => {
      console.log('[MealForm] Component unmounting');
      isMountedRef.current = false;
    };
  }, []);

  // Load existing food items when editing
  useEffect(() => {
    if (isEditing && defaultValues && (defaultValues as any).foodItems) {
      const foodItemsData = (defaultValues as any).foodItems;
      
      if (Array.isArray(foodItemsData) && foodItemsData.length > 0) {
        const loadedFoodItems: MealFoodItem[] = foodItemsData.map((item: any) => ({
          food: {
            id: item.foodId,
            name: item.foodName,
            nameAr: item.foodNameAr,
            calories: item.calories,
            proteins: item.proteins,
            carbs: item.carbs,
            fats: item.fats,
            fiber: item.fiber || 0,
            servingSize: item.servingSize || "1 serving",
            servingSizeGrams: item.servingSizeGrams || item.quantity,
            category: "Unknown"
          },
          quantity: item.quantity,
          nutrition: {
            calories: item.calories,
            proteins: item.proteins,
            carbs: item.carbs,
            fats: item.fats,
            fiber: item.fiber || 0
          }
        }));
        
        setSelectedFoods(loadedFoodItems);
      }
    }
  }, [isEditing, defaultValues]);

  // Update form values when selectedFoods changes
  useEffect(() => {
    if (selectedFoods.length > 0) {
      const totals = calculateTotalNutrition(selectedFoods);
      setTotalNutrition(totals);
      
      // Auto-generate meal name based on foods - show all food names in current language
      const getFoodDisplayName = (food: FoodItem) => {
        return language === 'ar' && food.nameAr ? food.nameAr : food.name;
      };
      
      let mealName;
      if (selectedFoods.length === 1) {
        mealName = getFoodDisplayName(selectedFoods[0].food);
      } else if (selectedFoods.length === 2) {
        const connector = language === 'ar' ? ' و ' : ' & ';
        mealName = `${getFoodDisplayName(selectedFoods[0].food)}${connector}${getFoodDisplayName(selectedFoods[1].food)}`;
      } else if (selectedFoods.length === 3) {
        const connector = language === 'ar' ? ' و ' : ' & ';
        const comma = language === 'ar' ? '، ' : ', ';
        mealName = `${getFoodDisplayName(selectedFoods[0].food)}${comma}${getFoodDisplayName(selectedFoods[1].food)}${connector}${getFoodDisplayName(selectedFoods[2].food)}`;
      } else {
        // For 4+ items, show first 3 and count the rest
        const connector = language === 'ar' ? ' و ' : ' & ';
        const comma = language === 'ar' ? '، ' : ', ';
        const moreText = language === 'ar' ? ` و ${selectedFoods.length - 3} أخرى` : ` & ${selectedFoods.length - 3} more`;
        mealName = `${getFoodDisplayName(selectedFoods[0].food)}${comma}${getFoodDisplayName(selectedFoods[1].food)}${comma}${getFoodDisplayName(selectedFoods[2].food)}${moreText}`;
      }
      
      // Only update meal name if we're not editing (to preserve existing name when editing)
      if (!isEditing) {
        form.setValue('name', mealName);
      }
    } else if (selectedFoods.length === 0 && !isEditing) {
      // Reset values if no foods selected
      form.setValue('name', '');
      form.setValue('calories', 0);
      form.setValue('proteins', 0);
      form.setValue('carbs', 0);
      form.setValue('fats', 0);
      form.setValue('fiber', 0);
    }
  }, [selectedFoods, form, isEditing, language]);

  const calculateTotalNutrition = (foods: MealFoodItem[]): {
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
  } => {
    return foods.reduce((totals, item) => {
      return {
        calories: totals.calories + item.nutrition.calories,
        proteins: +(totals.proteins + item.nutrition.proteins).toFixed(1),
        carbs: +(totals.carbs + item.nutrition.carbs).toFixed(1),
        fats: +(totals.fats + item.nutrition.fats).toFixed(1),
        fiber: +(totals.fiber + item.nutrition.fiber).toFixed(1)
      };
    }, {
      calories: 0,
      proteins: 0,
      carbs: 0,
      fats: 0,
      fiber: 0
    });
  };

  const handleAddFood = (food: FoodItem, quantity: number) => {
    const nutrition = calculateNutrition(food, quantity);
    
    setSelectedFoods(prev => [
      ...prev,
      {
        food,
        quantity,
        nutrition
      }
    ]);
  };

  const handleRemoveFood = (index: number) => {
    setSelectedFoods(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFoodQuantity = (index: number, newQuantity: number) => {
    setSelectedFoods(prev => 
      prev.map((item, i) => {
        if (i === index) {
          // Recalculate nutrition based on new quantity
          const nutrition = calculateNutrition(item.food, newQuantity);
          return {
            ...item,
            quantity: newQuantity,
            nutrition
          };
        }
        return item;
      })
    );
  };

  // This function handles the actual meal submission
  const saveMeal = async () => {
    if (selectedFoods.length === 0) {
      toast({
        title: "No food items",
        description: "Please add at least one food item before saving",
        variant: "destructive",
      });
      return;
    }
    
    // Make sure form has a name value
    if (!form.getValues().name || form.getValues().name.trim() === "") {
      const newName = selectedFoods[0].food.name;
      form.setValue('name', newName);
    }
    
    // Update the form with nutrition values
    form.setValue('calories', totalNutrition.calories);
    form.setValue('proteins', totalNutrition.proteins);
    form.setValue('carbs', totalNutrition.carbs);
    form.setValue('fats', totalNutrition.fats);
    form.setValue('fiber', totalNutrition.fiber || 0);
    
    // Get current form values
    const currentValues = form.getValues();
    
    // Prepare food items data for storage
    const foodItemsData = selectedFoods.map(item => ({
      foodId: item.food.id,
      foodName: item.food.name,
      foodNameAr: item.food.nameAr || null,
      quantity: item.quantity,
      servings: null,
      servingSize: item.food.servingSize,
      servingDescription: null,
      calories: item.nutrition.calories,
      proteins: item.nutrition.proteins,
      carbs: item.nutrition.carbs,
      fats: item.nutrition.fats,
      fiber: item.nutrition.fiber || 0
    }));

    // Create formatted data object for API
    const formattedData = {
      ...currentValues,
      userId: currentValues.userId || 5,
      date: normalizeMealDateForStorage(currentValues.date as string | Date),
      calories: totalNutrition.calories,
      proteins: totalNutrition.proteins,
      carbs: totalNutrition.carbs,
      fats: totalNutrition.fats,
      fiber: totalNutrition.fiber || 0,
      foodItems: foodItemsData // Include the food items data
    };
    
    try {
      console.log('[MealForm] Submitting meal data', { isEditing, mealId, formattedData });
      
      let response;
      if (isEditing && mealId) {
        console.log('[MealForm] Updating existing meal');
        response = await apiRequest("PATCH", `/api/meals/${mealId}`, formattedData);
        if (!response.ok) throw new Error('Failed to update meal');
        
        toast({
          title: t("mealUpdated"),
          description: t("mealUpdatedSuccess"),
        });
      } else {
        console.log('[MealForm] Creating new meal');
        response = await apiRequest("POST", "/api/meals", formattedData);
        console.log('[MealForm] POST response received', { ok: response.ok });
        if (!response.ok) throw new Error('Failed to add meal');
        
        toast({
          title: t("mealAdded"),
          description: t("mealAddedSuccess"),
        });
      }
      
      // Invalidate all meal and daily stats queries
      console.log('[MealForm] Invalidating queries after meal save');
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) &&
            (queryKey[0] === '/api/meals' || queryKey[0] === '/api/daily-stats');
        },
      });
      
      // Call success callback (this will close the dialog and unmount the component)
      // No need to reset form/state as component will unmount
      console.log('[MealForm] About to call onSuccess callback', { hasOnSuccess: !!onSuccess });
      if (onSuccess) {
        console.log('[MealForm] Calling onSuccess callback - dialog will close');
        onSuccess();
        console.log('[MealForm] onSuccess callback completed');
      }
    } catch (error) {
      console.error('[MealForm] Error submitting meal:', error);
      console.error('[MealForm] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save meal. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? t("editMeal") : t("addMeal")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...safeFormContext}>
            <div className="space-y-4">

              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("mealType")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectMealType")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="breakfast">{t("breakfast")}</SelectItem>
                        <SelectItem value="lunch">{t("lunch")}</SelectItem>
                        <SelectItem value="dinner">{t("dinner")}</SelectItem>
                        <SelectItem value="snack">{t("snack")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Food Items Section */}
              <div className="mt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                  <h3 className="font-medium">{t("foodItems")}</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsFoodSearchOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-1" /> {t("addFood")}
                  </Button>
                </div>
                
                {selectedFoods.length > 0 ? (
                  <div className="space-y-3 mb-4">
                    {selectedFoods.map((item, index) => (
                      <div key={index} className="p-4 border rounded-md bg-gray-50 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{language === 'ar' && item.food.nameAr ? item.food.nameAr : item.food.name}</p>
                            <p className="text-xs text-gray-500">{t("servingSize")}: {item.food.servingSize}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRemoveFood(index)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div>
                            <label className="text-xs font-medium text-gray-600">{t("numberOfServings")}</label>
                            <Input
                              type="text"
                              value={language === 'ar' ? convertEnglishToArabic(item.quantity > 0 ? (item.quantity / item.food.servingSizeGrams).toString() : '') : (item.quantity > 0 ? (item.quantity / item.food.servingSizeGrams).toString() : '')}
                              onChange={(e) => {
                                const inputValue = language === 'ar' ? convertArabicToEnglish(e.target.value) : e.target.value;
                                if (inputValue === '') {
                                  handleUpdateFoodQuantity(index, 0);
                                } else {
                                  const servings = Number(inputValue) || 0;
                                  const newQuantity = Math.round(servings * item.food.servingSizeGrams);
                                  handleUpdateFoodQuantity(index, newQuantity);
                                }
                              }}
                              className="h-8 text-sm"
                              placeholder={language === 'ar' ? '١' : '1'}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">{t("quantityGrams")}</label>
                            <Input
                              type="text"
                              value={language === 'ar' ? convertEnglishToArabic(item.quantity > 0 ? item.quantity.toString() : '') : (item.quantity > 0 ? item.quantity.toString() : '')}
                              onChange={(e) => {
                                const inputValue = language === 'ar' ? convertArabicToEnglish(e.target.value) : e.target.value;
                                if (inputValue === '') {
                                  handleUpdateFoodQuantity(index, 0);
                                } else {
                                  const newQuantity = Number(inputValue) || 0;
                                  handleUpdateFoodQuantity(index, newQuantity);
                                }
                              }}
                              className="h-8 text-sm"
                              placeholder={language === 'ar' ? '١٠٠' : '100'}
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500">{t("calories")}</p>
                            <p className="font-semibold text-sm">{Math.round(item.nutrition.calories)} {t("cal")}</p>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 grid grid-cols-3 gap-2">
                          <span>{t("protein")}: {item.nutrition.proteins.toFixed(1)}{t("grams")}</span>
                          <span>{t("carbs")}: {item.nutrition.carbs.toFixed(1)}{t("grams")}</span>
                          <span>{t("fat")}: {item.nutrition.fats.toFixed(1)}{t("grams")}</span>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-4 p-3 border-t border-dashed">
                      <div className="font-medium">{t("totalNutrition")}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-sm">
                        <div>
                          <span className="text-gray-500">{t("calories")}:</span> {totalNutrition.calories}
                        </div>
                        <div>
                          <span className="text-gray-500">{t("protein")}:</span> {totalNutrition.proteins}{t("grams")}
                        </div>
                        <div>
                          <span className="text-gray-500">{t("carbs")}:</span> {totalNutrition.carbs}{t("grams")}
                        </div>
                        <div>
                          <span className="text-gray-500">{t("fat")}:</span> {totalNutrition.fats}{t("grams")}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed rounded-md p-6 text-center mb-4">
                    <p className="text-gray-500 mb-3">{t("noFoodItemsAdded")}</p>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsFoodSearchOpen(true)}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-1" /> {t("addFoodItem")}
                    </Button>
                  </div>
                )}
              </div>
              
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>{t("dateTime")}</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          value={field.value ? utcIsoToDatetimeLocal(field.value) : ''}
                          onChange={e => {
                            if (e.target.value) {
                              field.onChange(datetimeLocalToUtcIso(e.target.value));
                            } else {
                              field.onChange(new Date().toISOString());
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    console.log('[MealForm] Cancel button clicked');
                    // Call onCancel first to close dialog (component will unmount)
                    if (onCancel) {
                      console.log('[MealForm] Calling onCancel - dialog will close');
                      onCancel();
                      console.log('[MealForm] onCancel completed');
                    }
                    // No need to reset form as component will unmount
                  }}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  {t("cancel")}
                </Button>
                <Button 
                  type="button"
                  disabled={selectedFoods.length === 0}
                  onClick={saveMeal}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {isEditing ? t("update") : t("addMeal")}
                </Button>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>
      
      <FoodSearchModal 
        open={isFoodSearchOpen}
        onClose={() => setIsFoodSearchOpen(false)}
        onSelect={handleAddFood}
      />
    </>
  );
};

export default MealForm;
