import { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_FOOD_CATEGORIES, mergeFoodCategories } from '@/lib/food-categories';

type FoodCategorySelectProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
};

export function FoodCategorySelect({
  value,
  onChange,
  id,
  disabled,
  className,
}: FoodCategorySelectProps) {
  const { t, language } = useLanguage();
  const [apiCategories, setApiCategories] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/food-database/categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setApiCategories(data.filter((item): item is string => typeof item === 'string'));
        }
      })
      .catch(() => {
        /* fallback to defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => mergeFoodCategories(apiCategories.length > 0 ? apiCategories : DEFAULT_FOOD_CATEGORIES.map((item) => item.value)),
    [apiCategories],
  );

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={t('selectCategory')} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {language === 'ar' ? option.labelAr : option.labelEn}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
