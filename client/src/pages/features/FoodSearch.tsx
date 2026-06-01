import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Plus, ChevronDown, ChevronUp, Apple } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { FoodItem } from '@shared/schema';

export default function FoodSearchPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FoodItem[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [loading, setLoading] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFoodData, setNewFoodData] = useState({
    name: '', nameAr: '', brand: '', brandAr: '',
    calories: '', proteins: '', carbs: '', fats: '',
    fiber: '', servingSize: '', servingSizeGrams: '', category: '',
  });

  const debounceRef = useRef<NodeJS.Timeout>();
  const abortRef = useRef<AbortController>();
  const aiTriggeredRef = useRef('');

  // Initial load
  useEffect(() => {
    fetchAll();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) { setFilteredItems(foodItems); return; }
    debounceRef.current = setTimeout(() => performSearch(searchQuery), 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  async function fetchAll() {
    try {
      setLoading(true);
      const res = await fetch('/api/food-database/items');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setFoodItems(data);
      setFilteredItems(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function performSearch(q: string) {
    if (!q.trim()) { setFilteredItems(foodItems); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      setLoading(true);
      const res = await fetch(`/api/food-database/items?query=${encodeURIComponent(q)}`, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setFilteredItems(data);
      // Auto-trigger AI if no results found
      if (data.length === 0 && aiTriggeredRef.current !== q) {
        aiTriggeredRef.current = q;
        searchWithAI(q);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally { setLoading(false); }
  }

  async function searchWithAI(q: string) {
    try {
      setAiSearching(true);
      const res = await fetch('/api/food-database/search-with-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'AI search failed');
      }
      const newFood = await res.json();
      setFilteredItems([newFood]);
      setFoodItems(prev => [newFood, ...prev]);
      toast({ title: t('success'), description: t('foodFoundAndAdded') || 'Food found and added to database!' });
      setSelectedFood(newFood);
      setQuantity(newFood.servingSizeGrams || 100);
    } catch (e: any) {
      toast({
        title: t('aiSearchFailed') || 'AI Search Failed',
        description: e?.message || 'Could not find food. Try adding manually.',
        variant: 'destructive',
      });
    } finally { setAiSearching(false); }
  }

  async function handleCreateFood() {
    const { name, calories, proteins, carbs, fats, fiber, servingSize, servingSizeGrams, category } = newFoodData;
    if (!name || !calories || !proteins || !carbs || !fats || !fiber || !servingSize || !servingSizeGrams || !category) {
      toast({ title: t('error'), description: t('pleaseFillAllFields') || 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/food-database/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (!res.ok) throw new Error('Failed to create food');
      const created = await res.json();
      toast({ title: t('success'), description: t('foodCreatedSuccessfully') || 'Food created!' });
      fetchAll();
      setShowCreateForm(false);
      setNewFoodData({ name:'',nameAr:'',brand:'',brandAr:'',calories:'',proteins:'',carbs:'',fats:'',fiber:'',servingSize:'',servingSizeGrams:'',category:'' });
      setSelectedFood(created);
      setQuantity(created.servingSizeGrams || 100);
    } catch {
      toast({ title: t('error'), description: t('errorCreatingFood') || 'Error creating food', variant: 'destructive' });
    } finally { setLoading(false); }
  }

  const calcNutrient = (val: number, base: number, qty: number) =>
    base > 0 ? Math.round((val / base) * qty * 10) / 10 : 0;

  const isRtl = language === 'ar';

  return (
    <div className={`p-4 lg:p-8 space-y-6 min-h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Apple className="h-6 w-6 text-primary" />
          {t('foodSearchTitle') || 'Food Search'}
        </h1>
        <p className="text-muted-foreground">{t('foodSearchSubtitle') || 'Search the food database or use AI to find nutrition information for any food.'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Search & Results */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                {t('searchFoodDatabase') || 'Search Food Database'}
              </CardTitle>
              <CardDescription>{t('foodSearchHint') || 'Type to search. If not found, AI will automatically look it up.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchFoods') || 'Search foods...'}
                    className="pr-9"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => searchQuery.trim() && searchWithAI(searchQuery)}
                  disabled={aiSearching || !searchQuery.trim()}
                  className="shrink-0 gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('searchWithAI') || 'AI Search'}
                </Button>
              </div>

              {/* AI Searching indicator */}
              {aiSearching && (
                <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
                  <Sparkles className="h-4 w-4" />
                  {t('searchingWithAI') || 'Searching with AI...'}
                </div>
              )}

              {/* Results */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {loading && !aiSearching ? (
                  <div className="py-10 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                  </div>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map(food => (
                    <div
                      key={food.id}
                      onClick={() => { setSelectedFood(food); setQuantity(food.servingSizeGrams || 100); }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-primary/5 ${selectedFood?.id === food.id ? 'border-primary bg-primary/5' : 'bg-white'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{food.name}</p>
                          {food.nameAr && <p className="text-sm text-muted-foreground">{food.nameAr}</p>}
                          {food.brand && <p className="text-xs text-muted-foreground">{food.brand}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{food.servingSize}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <Badge variant="secondary" className="font-semibold">{food.calories} {t('cal') || 'cal'}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">/ {food.servingSizeGrams}g</p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                        <span>{t('protein') || 'Protein'}: <strong>{food.proteins}g</strong></span>
                        <span>{t('carbs') || 'Carbs'}: <strong>{food.carbs}g</strong></span>
                        <span>{t('fat') || 'Fat'}: <strong>{food.fats}g</strong></span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-muted-foreground">
                    <Apple className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('noFoodsFound') || 'No foods found. Try AI search or add manually.'}</p>
                  </div>
                )}
              </div>

              {/* Add food manually */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCreateForm(v => !v)}
                >
                  {showCreateForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {showCreateForm ? (t('hideForm') || 'Hide form') : (t('addFoodManually') || 'Add food manually')}
                  {showCreateForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                {showCreateForm && (
                  <div className="mt-3 p-4 border rounded-lg bg-gray-50 space-y-3">
                    <p className="text-sm font-medium">{t('createNewFood') || 'Create New Food'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'name', label: t('name') + ' *', placeholder: 'Chicken breast' },
                        { key: 'nameAr', label: t('nameArabic') || 'Arabic Name', placeholder: 'صدر دجاج' },
                        { key: 'brand', label: t('brand') || 'Brand', placeholder: '' },
                        { key: 'category', label: t('category') + ' *', placeholder: 'Protein' },
                        { key: 'calories', label: t('calories') + ' *', placeholder: '165', type: 'number' },
                        { key: 'proteins', label: `${t('protein')} (g) *`, placeholder: '31', type: 'number' },
                        { key: 'carbs', label: `${t('carbs')} (g) *`, placeholder: '0', type: 'number' },
                        { key: 'fats', label: `${t('fat')} (g) *`, placeholder: '3.6', type: 'number' },
                        { key: 'fiber', label: `${t('fiber') || 'Fiber'} (g) *`, placeholder: '0', type: 'number' },
                        { key: 'servingSize', label: t('servingSize') + ' *', placeholder: '1 breast (100g)' },
                        { key: 'servingSizeGrams', label: `${t('servingSizeGrams') || 'Serving (g)'} *`, placeholder: '100', type: 'number' },
                      ].map(({ key, label, placeholder, type }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-gray-700">{label}</label>
                          <Input
                            type={type || 'text'}
                            value={(newFoodData as any)[key]}
                            onChange={(e) => setNewFoodData(d => ({ ...d, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="mt-1"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={handleCreateFood} disabled={loading}>
                        {loading ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowCreateForm(false)}>
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Nutrition Detail */}
        <div>
          {selectedFood ? (
            <Card className="sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('nutritionInfo') || 'Nutrition Info'}</CardTitle>
                <CardDescription className="font-medium text-foreground">{selectedFood.name}</CardDescription>
                {selectedFood.nameAr && <p className="text-sm text-muted-foreground">{selectedFood.nameAr}</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">{t('quantityGrams') || 'Quantity (g)'}</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                    className="mt-1"
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('serving') || 'Serving'}: {selectedFood.servingSize} ({selectedFood.servingSizeGrams}g)
                  </p>
                </div>

                {/* Calories */}
                <div className="rounded-lg bg-primary/10 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {calcNutrient(selectedFood.calories, selectedFood.servingSizeGrams, quantity)}
                  </p>
                  <p className="text-sm text-primary/80">{t('calories') || 'Calories'}</p>
                </div>

                {/* Macros */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: t('protein') || 'Protein', value: calcNutrient(selectedFood.proteins, selectedFood.servingSizeGrams, quantity), color: 'bg-blue-100 text-blue-700' },
                    { label: t('carbs') || 'Carbs', value: calcNutrient(selectedFood.carbs, selectedFood.servingSizeGrams, quantity), color: 'bg-yellow-100 text-yellow-700' },
                    { label: t('fat') || 'Fat', value: calcNutrient(selectedFood.fats, selectedFood.servingSizeGrams, quantity), color: 'bg-orange-100 text-orange-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                      <p className="text-lg font-semibold">{value}g</p>
                      <p className="text-xs">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Fiber */}
                {selectedFood.fiber != null && (
                  <div className="flex justify-between text-sm border-t pt-3">
                    <span className="text-muted-foreground">{t('fiber') || 'Fiber'}</span>
                    <span className="font-medium">{calcNutrient(selectedFood.fiber, selectedFood.servingSizeGrams, quantity)}g</span>
                  </div>
                )}

                {/* Category */}
                {selectedFood.category && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('category') || 'Category'}</span>
                    <Badge variant="outline">{selectedFood.category}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="sticky top-4">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Apple className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('selectFoodToSeeNutrition') || 'Select a food to see its nutrition details'}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
