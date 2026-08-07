import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';
import { getFoodPreferenceOptions } from '@/lib/food-preferences';
import type { FoodPreferenceCategory } from '@shared/foodPreferenceOptions';
import {
  FOOD_PREFERENCE_CATEGORY_LABEL_KEYS,
  FOOD_PREFERENCE_CATEGORY_SHORT_LABEL_KEYS,
} from '@shared/foodPreferenceOptions';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useState } from 'react';

interface FoodPreferenceCheckboxGroupProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  category: FoodPreferenceCategory;
  useShortLabel?: boolean;
}

export function FoodPreferenceCheckboxGroup<T extends FieldValues>({
  control,
  name,
  category,
  useShortLabel = false,
}: FoodPreferenceCheckboxGroupProps<T>) {
  const { t } = useLanguage();
  const options = getFoodPreferenceOptions(category);
  const labelKey = useShortLabel
    ? FOOD_PREFERENCE_CATEGORY_SHORT_LABEL_KEYS[category]
    : FOOD_PREFERENCE_CATEGORY_LABEL_KEYS[category];

  const [customText, setCustomText] = useState('');

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedValues = field.value ? String(field.value).split(', ').filter(Boolean) : [];
        const hasNone = selectedValues.some((value) => value.startsWith('none'));
        const hasOther = selectedValues.some((value) => value.startsWith('other'));

        return (
          <FormItem>
            <FormLabel>{t(labelKey as any)}</FormLabel>
            <FormControl>
              <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                {options.map((option) => {
                  const isSelected = selectedValues.some(
                    (value) => value === option.value || value.startsWith(`${option.value}:`),
                  );

                  return (
                    <div key={option.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`${category}-${option.value}`}
                        checked={isSelected}
                        onChange={(e) => {
                          let currentValues = field.value
                            ? String(field.value).split(', ').filter(Boolean)
                            : [];

                          if (e.target.checked) {
                            if (option.value === 'none') {
                              setCustomText('');
                              field.onChange('none');
                              return;
                            }
                            if (option.value === 'other') {
                              currentValues = currentValues.filter((value) => value !== 'none');
                              if (!currentValues.some((value) => value.startsWith('other'))) {
                                currentValues.push('other');
                              }
                              field.onChange(currentValues.join(', '));
                              return;
                            }
                            currentValues = currentValues
                              .filter((value) => value !== 'none' && !value.startsWith('other'))
                              .concat(option.value);
                            field.onChange(currentValues.join(', '));
                            return;
                          }

                          if (option.value === 'none') {
                            setCustomText('');
                            field.onChange('');
                            return;
                          }
                          if (option.value === 'other') {
                            setCustomText('');
                            field.onChange(
                              currentValues.filter((value) => !value.startsWith('other')).join(', '),
                            );
                            return;
                          }

                          field.onChange(
                            currentValues.filter((value) => value !== option.value).join(', '),
                          );
                        }}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`${category}-${option.value}`} className="text-sm">
                        {t(option.labelKey as any)}
                      </label>
                    </div>
                  );
                })}

                {(hasNone || hasOther) && (
                  <div className="col-span-2 mt-2">
                    <Input
                      placeholder={t('enterYourAnswer')}
                      value={customText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomText(val);
                        if (hasNone) {
                          field.onChange(val ? `none:${val}` : 'none');
                        } else if (hasOther) {
                          field.onChange(val ? `other:${val}` : 'other');
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
