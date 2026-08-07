import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertUserSchema } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from '@/context/BrandingContext';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { normalizeDigitsUniversal } from '@/lib/utils';

// Utility: Split whatsappWithCode into countryCode and whatsappNumber
const splitWhatsappWithCode = (combined: string): { countryCode: string; whatsappNumber: string } => {
  if (!combined) return { countryCode: '+', whatsappNumber: '' };
  const normalized = normalizeDigitsUniversal(combined.trim());
  // Match country code: starts with optional +, then 1-3 digits
  const match = normalized.match(/^(\+?\d{1,3})(.+)$/);
  if (match) {
    const code = match[1].startsWith('+') ? match[1] : `+${match[1]}`;
    const number = match[2].trim();
    return { countryCode: code, whatsappNumber: number };
  }
  // Fallback: assume everything is the number
  return { countryCode: '+', whatsappNumber: normalized };
};

const FALLBACK_COUNTRIES_EN: string[] = [
  'Australia',
  'Bahrain',
  'Canada',
  'Egypt',
  'France',
  'Germany',
  'India',
  'Iraq',
  'Jordan',
  'Kuwait',
  'Lebanon',
  'Morocco',
  'Oman',
  'Qatar',
  'Saudi Arabia',
  'Syria',
  'Tunisia',
  'Turkey',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Yemen',
];

const normalizeCountrySearch = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const buildEnglishCountryOptions = (): string[] => {
  const displayNamesCtor = (Intl as any)?.DisplayNames;
  if (typeof displayNamesCtor !== 'function') {
    return FALLBACK_COUNTRIES_EN;
  }

  const displayNames = new displayNamesCtor(['en'], { type: 'region' });
  const supportedValuesOf = (Intl as any)?.supportedValuesOf;
  let regionCodes: string[] = [];

  if (typeof supportedValuesOf === 'function') {
    try {
      regionCodes = (supportedValuesOf('region') as string[]).filter((code) => /^[A-Z]{2}$/.test(code));
    } catch {
      regionCodes = [];
    }
  }

  if (regionCodes.length === 0) {
    for (let i = 65; i <= 90; i += 1) {
      for (let j = 65; j <= 90; j += 1) {
        regionCodes.push(`${String.fromCharCode(i)}${String.fromCharCode(j)}`);
      }
    }
  }

  const excludedCodes = new Set(['EU', 'EZ', 'UN']);
  const names = regionCodes
    .filter((code) => !excludedCodes.has(code))
    .map((code) => {
      const label = displayNames.of(code);
      return typeof label === 'string' ? label.trim() : '';
    })
    .filter((label) => label.length > 0 && !/^[A-Z]{2}$/.test(label));

  const unique = Array.from(new Set(names));
  unique.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return unique.length > 0 ? unique : FALLBACK_COUNTRIES_EN;
};

const ENGLISH_COUNTRIES = buildEnglishCountryOptions();

const mapIsoToEnglishCountryName = (iso: string, countriesEn: string[]): string | undefined => {
  const code = iso.toUpperCase();
  const displayNamesCtor = (Intl as any)?.DisplayNames;
  if (typeof displayNamesCtor === 'function') {
    const displayNames = new displayNamesCtor(['en'], { type: 'region' });
    const label = displayNames.of(code);
    if (typeof label === 'string' && label.trim()) {
      const normalizedLabel = normalizeCountrySearch(label);
      const found = countriesEn.find((country) => normalizeCountrySearch(country) === normalizedLabel);
      if (found) return found;
    }
  }

  const fallbackMap: Record<string, string> = {
    EG: 'Egypt',
    SA: 'Saudi Arabia',
    JO: 'Jordan',
    AE: 'United Arab Emirates',
    QA: 'Qatar',
    BH: 'Bahrain',
    KW: 'Kuwait',
    OM: 'Oman',
    IQ: 'Iraq',
    SY: 'Syria',
    LB: 'Lebanon',
    MA: 'Morocco',
    DZ: 'Algeria',
    TN: 'Tunisia',
    LY: 'Libya',
    SD: 'Sudan',
    YE: 'Yemen',
    PS: 'Palestine',
    TR: 'Turkey',
    US: 'United States',
    GB: 'United Kingdom',
    FR: 'France',
    DE: 'Germany',
    IT: 'Italy',
    ES: 'Spain',
    CA: 'Canada',
  };

  const fallback = fallbackMap[code];
  if (!fallback) return undefined;

  const normalizedFallback = normalizeCountrySearch(fallback);
  const found = countriesEn.find((country) => normalizeCountrySearch(country) === normalizedFallback);
  return found || fallback;
};

// Extended schema with password confirmation
// NOTE: All validation messages intentionally in Arabic (requirement: show only Arabic errors)
const signUpSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح").min(1, "البريد الإلكتروني مطلوب"),
  password: z.string().min(6, "يجب أن تكون كلمة المرور 6 أحرف على الأقل"),
  passwordConfirm: z.string(),
  pinNumber: z.string()
    .min(1, "رقم التحقق يجب أن يكون 4 أرقام بالضبط")
    .refine((val) => /^\d{4}$/.test(val), {
      message: "رقم التحقق يجب أن يكون 4 أرقام بالضبط"
    }),
  firstName: z.string().min(1, "الاسم الأول مطلوب"),
  lastName: z.string().min(1, "اسم العائلة مطلوب"),
  // Combined whatsapp number with country code (optional now)
  whatsappWithCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().min(1, "الدولة مطلوبة"),
  gender: z.enum(["male", "female"]).optional(),
  religion: z.enum(["muslim", "christian"], { required_error: "الديانة مطلوبة" }),
  age: z.number({
    invalid_type_error: "أدخل عمراً صحيحاً",
  }).min(13, "يجب أن يكون العمر 13 سنة على الأقل").max(120, "يجب ألا يتجاوز العمر 120 سنة").optional(),
  height: z.number({
    invalid_type_error: "أدخل طولاً صحيحاً",
  }).min(50, "يجب أن يكون الطول 50 سم على الأقل").max(300, "يجب ألا يتجاوز الطول 300 سم").optional(),
  weight: z.number({
    invalid_type_error: "أدخل وزناً صحيحاً",
  }).min(30, "يجب أن يكون الوزن 30 كجم على الأقل").max(500, "يجب ألا يتجاوز الوزن 500 كجم").optional(),
  goalWeight: z.number().optional(),
  // Subscription details removed from signup
  shoulderWidth: z.number().optional(),
  chestWidth: z.number().optional(),
  waistWidth: z.number().optional(),
  hipWidth: z.number().optional(),
  hasInbody: z.boolean().optional(),
  fitnessGoal: z.enum(["weight_gain", "weight_loss", "bulking", "cutting"]).optional(),
  trainingLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  trainingDaysPerWeek: z.number().optional(),
  preferredWorkoutTime: z.enum(["morning", "midday", "evening"]).optional(),
  preferredProgram: z.enum(["bro_split", "push_pull_legs", "upper_lower", "random", "dont_know"]).optional(),
  medicalHistory: z.boolean().optional(),
  workIntensity: z.enum(["easy", "moderate", "hard"]).optional(),
  workoutLocation: z.enum(["gym", "home", "both"]).optional(),
  dailyMeals: z.number().optional(),
  preferredCarbs: z.string().optional(),
  preferredProteins: z.string().optional(),
  preferredLegumes: z.string().optional(),
  preferredVegetables: z.string().optional(),
  preferredDairy: z.string().optional(),
  preferredFats: z.string().optional(),
  preferredFruits: z.string().optional(),
  hasAllergies: z.boolean().optional(),
  allergyDetails: z.string().optional(),
  wantsSupplements: z.boolean().optional(),
  supplementPhoto: z.string().optional(),
  previousTrainer: z.boolean().optional(),
  previousTrainerDetails: z.string().optional(),
  dailyRoutine: z.string().optional(),
  exerciseHistory: z.string().optional(),
  exerciseDuration: z.string().optional(),
  wakeUpTime: z.string().optional(),
  breakfastTime: z.string().optional(),
  breakfastDetails: z.string().optional(),
  lunchTime: z.string().optional(),
  lunchDetails: z.string().optional(),
  dinnerTime: z.string().optional(),
  dinnerDetails: z.string().optional(),
  lunchHasProtein: z.boolean().optional(),
  workType: z.string().optional(),
  workHours: z.string().optional(),
  hasKitchenScale: z.boolean().optional(),
  paymentReceipt: z.string().optional(),
  howFoundUs: z.enum(["facebook", "instagram", "youtube", "tiktok", "whatsapp"]).optional(),
  activityLevel: z.string().optional(),
  bio: z.string().optional(),
  role: z.enum(['user', 'coach', 'gym', 'admin', 'visitor']).default('user'),
  frontPhoto: z.string().optional(),
  backPhoto: z.string().optional(),
  sidePhoto: z.string().optional(),
  inbodyDocument: z.string().optional(),
  medicalHistoryDetails: z.string().optional(),
  // carry coach attribution through the form; not sent in request body
  coachIdAttribution: z.number().optional(),
  gymIdAttribution: z.number().optional(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "كلمتا المرور غير متطابقتين",
  path: ["passwordConfirm"],
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpProps {
  onToggleForm: () => void;
  onSuccess?: () => void; // Add onSuccess callback
}

const SignUp: React.FC<SignUpProps> = ({ onToggleForm, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [antiTranslationArmed, setAntiTranslationArmed] = useState(false);
  // Custom text states for food preference 'other' or 'none' descriptions
  const [carbsCustom, setCarbsCustom] = useState("");
  const [proteinsCustom, setProteinsCustom] = useState("");
  const [legumesCustom, setLegumesCustom] = useState("");
  const [vegetablesCustom, setVegetablesCustom] = useState("");
  const [dairyCustom, setDairyCustom] = useState("");
  const [fatsCustom, setFatsCustom] = useState("");
  const [fruitsCustom, setFruitsCustom] = useState("");
  const [emailError, setEmailError] = useState<string>("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string>("");
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const { signup } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { settings: branding } = useBranding();
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);

  // Local component: searchable select content for countries (English labels + search)
  const CountrySelectContent: React.FC<{ options: string[]; rtl?: boolean }>
    = ({ options, rtl }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const normalizedQuery = normalizeCountrySearch(query);
    const filtered = normalizedQuery
      ? options.filter((o) => normalizeCountrySearch(o).includes(normalizedQuery))
      : options;

    const stop = (e: any) => {
      e.stopPropagation();
    };

    return (
      <SelectContent
        className="max-h-80"
      >
        <div
          className={`p-2 sticky top-0 bg-background ${rtl ? 'text-right' : ''}`}
          dir={rtl ? 'rtl' : undefined}
          // Prevent pointer events on the container from bubbling and closing or scrolling content unexpectedly
          onPointerDownCapture={stop}
          onMouseDownCapture={stop}
        >
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country"
            className={`h-8 ${rtl ? 'text-right' : ''}`}
            autoFocus
            // Stop key events so Radix Select doesn't treat them as typeahead for items
            onKeyDownCapture={stop}
            onKeyDown={stop}
            onKeyUpCapture={stop}
            onKeyUp={stop}
            onClick={stop}
            onPointerDown={stop}
          />
        </div>
        <div dir={rtl ? 'rtl' : undefined}>
          {filtered.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground" dir={rtl ? 'rtl' : undefined}>
              No results
            </div>
          )}
        </div>
      </SelectContent>
    );
  };

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
      pinNumber: "",
      firstName: "",
      lastName: "",
      whatsappWithCode: "",
      city: "",
      country: "",
      gender: undefined,
      religion: undefined,
      age: undefined,
      height: undefined,
      weight: undefined,
      goalWeight: undefined,
        // subscription fields removed
      shoulderWidth: undefined,
      chestWidth: undefined,
      waistWidth: undefined,
      hipWidth: undefined,
      hasInbody: false,
      fitnessGoal: undefined,
      trainingLevel: undefined,
      trainingDaysPerWeek: undefined,
      preferredWorkoutTime: undefined,
      preferredProgram: undefined,
      medicalHistory: false,
      workIntensity: undefined,
      workoutLocation: undefined,
      dailyMeals: undefined,
      preferredCarbs: "",
      preferredProteins: "",
      preferredLegumes: "",
      preferredVegetables: "",
      preferredDairy: "",
      preferredFats: "",
      preferredFruits: "",
      hasAllergies: false,
      allergyDetails: "",
      wantsSupplements: false,
  supplementPhoto: "",
      previousTrainer: false,
      previousTrainerDetails: "",
      dailyRoutine: "",
      exerciseHistory: "",
      exerciseDuration: "",
      wakeUpTime: "",
      breakfastTime: "",
      breakfastDetails: "",
      lunchTime: "",
      lunchDetails: "",
      dinnerTime: "",
      dinnerDetails: "",
      lunchHasProtein: undefined,
      workType: "",
      workHours: "",
      hasKitchenScale: false,
      paymentReceipt: "",
      howFoundUs: undefined,
      activityLevel: "",
      bio: "",
      role: "user",
      frontPhoto: "",
      backPhoto: "",
      sidePhoto: "",
      inbodyDocument: "",
      medicalHistoryDetails: "",
      coachIdAttribution: undefined,
      gymIdAttribution: undefined,
    }
  });

  // Check if WhatsApp number already exists (optional now)
  const checkWhatsappExists = async (whatsappWithCode: string) => {
    if (!whatsappWithCode || whatsappWithCode.length < 5) {
      setWhatsappError("");
      return;
    }

    // First check if it starts with a valid country code (1-9)
    if (!/^[1-9]/.test(whatsappWithCode)) {
      setWhatsappError("يجب أن يبدأ الرقم بكود الدولة (مثل: 20 لمصر، 966 للسعودية)");
      return;
    }

    // Check minimum length
    if (whatsappWithCode.length < 8) {
      setWhatsappError("الرقم قصير جداً");
      return;
    }

    // Check maximum length
    if (whatsappWithCode.length > 15) {
      setWhatsappError("الرقم طويل جداً");
      return;
    }

    setCheckingWhatsapp(true);
    try {
      const response = await fetch('/api/check-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ whatsappWithCode }),
      });

      const data = await response.json();
      if (data.exists) {
        setWhatsappError("هذا الرقم مسجل بالفعل");
      } else {
        setWhatsappError("");
      }
    } catch (error) {
      console.error('Error checking WhatsApp:', error);
      // Don't show error to user, just clear the message
      setWhatsappError("");
    } finally {
      setCheckingWhatsapp(false);
    }
  };

  // Check if email already exists
  const checkEmailExists = async (email: string) => {
    if (!email || email.length < 3) {
      setEmailError("");
      return;
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("البريد الإلكتروني غير صحيح");
      return;
    }

    setCheckingEmail(true);
    try {
      const response = await fetch('/api/check-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (data.exists) {
        setEmailError("هذا البريد الإلكتروني مسجل بالفعل");
      } else {
        setEmailError("");
      }
    } catch (error) {
      console.error('Error checking email:', error);
      // Don't show error to user, just clear the message
      setEmailError("");
    } finally {
      setCheckingEmail(false);
    }
  };

  // Debounced Email check
  useEffect(() => {
    const emailValue = form.watch('email');
    const timer = setTimeout(() => {
      if (emailValue) {
        checkEmailExists(emailValue);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [form.watch('email')]);

  // Debounced WhatsApp check
  useEffect(() => {
    const whatsappValue = form.watch('whatsappWithCode');
    const timer = setTimeout(() => {
      if (whatsappValue) {
        checkWhatsappExists(whatsappValue);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [form.watch('whatsappWithCode')]);

  // Parse coachId from URL (prefer coachId over referral if both exist)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const coachIdStr = params.get('coachId');
      const referralStr = params.get('ref');
      let parsed: number | undefined;
      const fromUrl = coachIdStr || referralStr;
      if (fromUrl && /^\d+$/.test(fromUrl)) {
        parsed = parseInt(fromUrl, 10);
      }
      if (!parsed) {
        const storageKeys = ['pendingCoachId', 'referralCoachId'];
        for (const key of storageKeys) {
          const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
          if (saved && /^\d+$/.test(saved)) {
            parsed = parseInt(saved, 10);
            break;
          }
        }
      }
      if (parsed && parsed > 0) {
        form.setValue('coachIdAttribution', parsed as any);
        try {
          localStorage.setItem('pendingCoachId', String(parsed));
          if (!localStorage.getItem('referralCoachId')) {
            localStorage.setItem('referralCoachId', String(parsed));
          }
        } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const gymIdStr = params.get('gymId');
      let parsed: number | undefined;
      if (gymIdStr && /^\d+$/.test(gymIdStr)) parsed = parseInt(gymIdStr, 10);
      if (!parsed) {
        const storageKeys = ['pendingGymId', 'referralGymId'];
        for (const key of storageKeys) {
          const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
          if (saved && /^\d+$/.test(saved)) {
            parsed = parseInt(saved, 10);
            break;
          }
        }
      }
      if (parsed && parsed > 0) {
        form.setValue('gymIdAttribution', parsed as any);
        try {
          localStorage.setItem('pendingGymId', String(parsed));
          if (!localStorage.getItem('referralGymId')) {
            localStorage.setItem('referralGymId', String(parsed));
          }
        } catch {}
      }
    } catch {}
  }, []);

  // Preselect country based on IP (server) using English country names.
  useEffect(() => {
    const current = form.getValues('country');
    if (current && current.trim()) return; // don't override user selection
    // Try server header-based guess (may perform short external IP lookup on server)
    let aborted = false;
    fetch('/api/geo/guess-country', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (aborted || !data) return;
        const code = (data && (data.iso || data.countryCode)) as string | undefined;
        if (code) {
          const name = mapIsoToEnglishCountryName(code, ENGLISH_COUNTRIES);
          if (name) {
            const cur2 = form.getValues('country');
            if (!cur2) form.setValue('country', name, { shouldDirty: false, shouldValidate: false });
          }
        }
      })
      .catch(() => {})
    return () => { aborted = true; };
  }, []);


  // Navigate to next step with validation
  const nextStep = async () => {
    const currentValues = form.getValues();

    // Validate step 1 fields
    if (currentStep === 1) {
  // Step 1 now also collects WhatsApp contact info and optional PIN
  const step1Fields = ['firstName', 'lastName', 'email', 'password', 'passwordConfirm', 'pinNumber', 'role', 'country'];

      if (!currentValues.country?.trim()) {
        form.setError('country', { type: 'manual', message: 'الدولة مطلوبة' });
        toast({
          title: 'بيانات ناقصة',
          description: 'يرجى اختيار الدولة قبل المتابعة',
          variant: 'destructive',
        });
        requestAnimationFrame(() => {
          const el = document.querySelector("[data-field='country']") as HTMLElement | null;
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return;
      }

      const isStep1Valid = await form.trigger(step1Fields as any);
      
      console.log("Step 1 validation result:", isStep1Valid);
      console.log("Current form values:", currentValues);
      console.log("Form errors:", form.formState.errors);

      if (isStep1Valid) {
        // Roles with minimal required fields can submit directly from step 1.
        if (currentValues.role === 'coach' || currentValues.role === 'gym' || currentValues.role === 'admin') {
          console.log("Direct-submit role selected, submitting form...");
          const directSubmitData: Partial<SignUpFormValues> = {
            firstName: currentValues.firstName,
            lastName: currentValues.lastName,
            email: currentValues.email,
            password: currentValues.password,
            passwordConfirm: currentValues.password,
            pinNumber: currentValues.pinNumber,
            country: currentValues.country,
            whatsappWithCode: currentValues.whatsappWithCode || '',
            role: currentValues.role,
            bio: "",
          };
          onSubmit(directSubmitData as SignUpFormValues);
        } else {
          setCurrentStep(2);
        }
      } else {
        console.log("Form validation failed for step 1");
        // Scroll to first invalid field in step 1
        const firstInvalid = step1Fields.find(f => (form.formState.errors as any)[f]);
        if (firstInvalid) {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-field='${firstInvalid}']`) as HTMLElement | null;
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Attempt to focus the actual input inside (Radix components may wrap)
              if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
                el.focus({ preventScroll: true });
              } else {
                const focusable = el.querySelector('input,textarea,select,button,[tabindex]') as HTMLElement | null;
                focusable?.focus({ preventScroll: true });
              }
            }
          });
        }
      }
    } else if (currentStep === 2) {
      const step2Fields = [
        'whatsappNumber', 'city', 'gender', 'religion', 'age',
        'height', 'weight', 'preferredCarbs', 'preferredProteins',
        'preferredLegumes', 'preferredVegetables', 'preferredDairy', 'preferredFats',
        'preferredFruits', 'howFoundUs'
      ];
      // Define which fields are truly required in Step 2 (adjust as business rules evolve)
      const requiredStep2: string[] = [
        'city', 'gender', 'religion', 'age', 'height', 'weight', 'preferredCarbs', 'preferredProteins',
        'preferredLegumes', 'preferredVegetables', 'preferredDairy', 'preferredFats', 'preferredFruits', 'howFoundUs'
      ];

      // Collect missing required fields (tolerate 0 numeric values but disallow empty/undefined)
      const currentValues = form.getValues();
      const missing: string[] = [];
      requiredStep2.forEach(f => {
        const v: any = (currentValues as any)[f];
        const isNumberField = ['age','height','weight'].includes(f);
        if (isNumberField) {
          const num = typeof v === 'number' ? v : parseFloat(v);
            if (isNaN(num)) missing.push(f);
        } else {
          if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
            missing.push(f);
          }
        }
      });

      if (missing.length) {
        // Set manual errors with Arabic required message
        missing.forEach(f => {
          if (!(form.formState.errors as any)[f]) {
            form.setError(f as any, { type: 'manual', message: 'هذا الحقل مطلوب' });
          }
        });
        // Scroll to first missing field
        const firstInvalid = missing[0];
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-field='${firstInvalid}']`) as HTMLElement | null;
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
              el.focus({ preventScroll: true });
            } else {
              const focusable = el.querySelector('input,textarea,select,button,[tabindex]') as HTMLElement | null;
              focusable?.focus({ preventScroll: true });
            }
          }
        });
        return; // Block advancement
      }
      const isStep2Valid = await form.trigger(step2Fields as any);
      
      if (isStep2Valid) {
        setCurrentStep(3);
      } else {
        // Scroll to first invalid field in step 2
        const firstInvalid = step2Fields.find(f => (form.formState.errors as any)[f]);
        if (firstInvalid) {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-field='${firstInvalid}']`) as HTMLElement | null;
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
                el.focus({ preventScroll: true });
              } else {
                const focusable = el.querySelector('input,textarea,select,button,[tabindex]') as HTMLElement | null;
                focusable?.focus({ preventScroll: true });
              }
            }
          });
        }
      }
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    setCurrentStep(Math.max(1, currentStep - 1));
  };

  

  const onSubmit = async (values: SignUpFormValues) => {
    if (!values.country?.trim()) {
      form.setError('country', { type: 'manual', message: 'الدولة مطلوبة' });
      setCurrentStep(1);
      toast({
        title: 'بيانات ناقصة',
        description: 'يرجى اختيار الدولة في الخطوة الأولى قبل إنشاء الحساب',
        variant: 'destructive',
      });
      return;
    }

    // Check if there's an email error before submitting
    if (emailError) {
      toast({
        title: "خطأ",
        description: emailError,
        variant: "destructive",
      });
      return;
    }

    // Check if there's a WhatsApp error before submitting (if whatsapp is provided)
    if (values.whatsappWithCode && whatsappError) {
      toast({
        title: "خطأ",
        description: whatsappError,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      // Remove passwordConfirm before submitting
      const { passwordConfirm, coachIdAttribution, gymIdAttribution, ...userData } = values;
      const submissionPayload = {
        ...userData,
        country: values.country.trim(),
        role: values.role || 'user',
      };
      
      console.log("Submitting user data:", submissionPayload);
      console.log("Selected role:", submissionPayload.role);

      // Try direct fetch instead of going through the auth service
      const referralParams = new URLSearchParams();
      
      // Read coachId from form value OR fallback to localStorage
      let effectiveCoachId = coachIdAttribution;
      if (!effectiveCoachId) {
        const storageKeys = ['pendingCoachId', 'referralCoachId'];
        for (const key of storageKeys) {
          const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
          if (saved && /^\d+$/.test(saved)) {
            effectiveCoachId = parseInt(saved, 10);
            break;
          }
        }
      }
      
      // Read gymId from form value OR fallback to URL/localStorage
      let effectiveGymId = gymIdAttribution;
      if (!effectiveGymId) {
        // Try URL first
        const urlParams = new URLSearchParams(window.location.search);
        const gymIdFromUrl = urlParams.get('gymId');
        if (gymIdFromUrl && /^\d+$/.test(gymIdFromUrl)) {
          effectiveGymId = parseInt(gymIdFromUrl, 10);
        } else {
          // Try localStorage
          const storageKeys = ['pendingGymId', 'referralGymId'];
          for (const key of storageKeys) {
            const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
            if (saved && /^\d+$/.test(saved)) {
              effectiveGymId = parseInt(saved, 10);
              break;
            }
          }
        }
      }
      
      if (typeof effectiveCoachId === 'number' && effectiveCoachId > 0) {
        referralParams.set('coachId', String(effectiveCoachId));
      }
      if (typeof effectiveGymId === 'number' && effectiveGymId > 0) {
        referralParams.set('gymId', String(effectiveGymId));
      }
      const queryString = referralParams.toString();
      
      const response = await fetch(`/api/auth/signup${queryString ? `?${queryString}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionPayload),
        credentials: 'include',
      });

      // Check if the request was successful
      if (!response.ok) {
        let constructedMessage = 'فشل إنشاء الحساب';
        try {
          const errorData = await response.json();
          // Map backend field keys to Arabic labels for user clarity
          const fieldLabelMap: Record<string, string> = {
            firstName: 'الاسم الأول',
            lastName: 'اسم العائلة',
            email: 'البريد الإلكتروني',
            password: 'كلمة المرور',
            whatsappWithCode: 'رقم الواتساب',
            whatsappNumber: 'رقم الواتساب',
            countryCode: 'رمز الدولة',
            city: 'المدينة',
            country: 'الدولة',
            gender: 'النوع',
            religion: 'الديانة',
            height: 'الطول',
            weight: 'الوزن',
            age: 'العمر',
            howFoundUs: 'كيف وصلت إلينا',
            preferredCarbs: 'الكربوهيدرات المفضلة',
            preferredProteins: 'البروتينات المفضلة',
            preferredLegumes: 'البقوليات المفضلة',
            preferredVegetables: 'الخضروات المفضلة',
            preferredDairy: 'منتجات الألبان المفضلة',
            preferredFats: 'الدهون المفضلة',
            preferredFruits: 'الفواكه المفضلة',
          };
          const missingFields: string[] = Array.isArray(errorData.missingFields) ? errorData.missingFields : [];
          const missingArabic = missingFields.map(f => fieldLabelMap[f] || f).join(', ');
          const missing = missingArabic ? `الحقول الناقصة: ${missingArabic}` : '';
          const issues = Array.isArray(errorData.issues) && errorData.issues.length
            ? errorData.issues.map((i: any) => {
                const p = (i.path || '').split('.').pop();
                const arabicPath = fieldLabelMap[p!] || p;
                return `${arabicPath || ''}: ${i.message}`;
              }).join(' | ')
            : '';
          // Translate generic message if present
          let baseMsg = errorData.message;
          if (typeof baseMsg === 'string') {
            const lower = baseMsg.toLowerCase();
            if (lower.includes('validation failed')) baseMsg = 'فشلت عملية التحقق من البيانات';
            if (lower.includes('username already exists') || lower.includes('already in use')) baseMsg = 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل';
            if (lower.includes('email') && lower.includes('exist')) baseMsg = 'البريد الإلكتروني مستخدم بالفعل';
          }
          constructedMessage = [baseMsg, missing, issues].filter(Boolean).join(' - ') || constructedMessage;
        } catch (e) {
          // ignore parse error
        }
        throw new Error(constructedMessage);
      }

  const user = await response.json();
      console.log("User created successfully:", user);
  try { localStorage.removeItem('pendingCoachId'); } catch {}
  try { localStorage.removeItem('pendingGymId'); } catch {}

      // Webhook integration removed for compliance – retain logic for signup flow only

      // Handle coach approval case
      if (user.pendingApproval) {
        toast({
          title: t('accountCreated'),
          description: user.message || t('coachAccountPendingApproval'),
        });
        
        // Don't auto-login coaches, redirect to login page
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        return;
      }

      toast({
        title: t('accountCreated'),
        description: t('welcomeToXTraining'),
      });

      // Store user in localStorage to maintain session
      localStorage.setItem('currentUser', JSON.stringify(user));

      // Redirect to dashboard after successful signup
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);

      // Call onSuccess if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Sign up error:", error);
      const rawMessage = error instanceof Error ? error.message : "There was a problem creating your account. Please try again.";
      let translatedMessage = rawMessage;
      // Normalize to lower for matching
      const lower = rawMessage.toLowerCase();
      if (lower.includes('username already exists')) {
        translatedMessage = 'اسم المستخدم مستخدم بالفعل';
      } else if (lower.includes('validation failed')) {
        translatedMessage = 'فشلت عملية التحقق من البيانات';
      } else if (lower.includes('failed to secure password')) {
        translatedMessage = 'حدث خطأ أثناء تأمين كلمة المرور، حاول مرة أخرى';
      } else if (lower.includes('error logging in after signup')) {
        translatedMessage = 'تم إنشاء الحساب ولكن حدث خطأ أثناء تسجيل الدخول التلقائي';
      }

      // Attempt to extract missing field list and highlight them
      if (rawMessage.includes('Missing:')) {
        const after = rawMessage.split('Missing:')[1];
        if (after) {
          const listPart = after.split('-')[0];
          const fields = listPart.split(',').map(f => f.trim()).filter(Boolean);
          fields.forEach(f => {
            if (form.getFieldState(f as any)) {
              // Force Arabic required message regardless of current language
              form.setError(f as any, { type: 'manual', message: 'مطلوب' });
            }
          });
        }
      }

      toast({
        title: t('signUpFailed'),
        description: translatedMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Anti-translation hardening: enforce translate=no on all descendants & observe unexpected mutations
  useEffect(() => {
    if (!formRef.current) return;
    const root = formRef.current;
    const markAll = () => {
      root.setAttribute('translate', 'no');
      root.querySelectorAll('*').forEach(el => {
        if (!(el as HTMLElement).dataset.allowTranslate) {
          el.setAttribute('translate', 'no');
          el.classList.add('notranslate');
        }
      });
    };
    markAll();
    const observer = new MutationObserver(muts => {
      let suspicious = false;
      for (const m of muts) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          // Heuristic: translators often inject <span> with inline style or class starting with 'gt'
          m.addedNodes.forEach(n => {
            if (n instanceof HTMLElement) {
              if (/(^|\s)gt|notranslate/i.test(n.className) || n.tagName === 'FONT') {
                suspicious = true;
              }
              n.setAttribute('translate', 'no');
              n.classList.add('notranslate');
            }
          });
        } else if (m.type === 'attributes') {
          if (m.attributeName === 'style' && m.target instanceof HTMLElement && /visibility:hidden/.test(m.target.getAttribute('style') || '')) {
            suspicious = true;
          }
        }
      }
      if (suspicious) {
        markAll();
        setAntiTranslationArmed(true);
      }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, [currentStep]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl text-center flex justify-center">
          <img
            src={logoUrl}
            alt="Naiosh Fit Logo"
            className="h-10 w-auto"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = DEFAULT_LOGO_ASSET;
            }}
          />
        </CardTitle>
        <CardDescription className="text-center">
          {currentStep === 1 ? t('createNewAccount') : currentStep === 2 ? `${t('stepOf').replace('{step}', currentStep.toString()).replace('{total}', '3')}: ${t('personalInfo')}` : `${t('stepOf').replace('{step}', currentStep.toString()).replace('{total}', '3')}: ${t('healthTraining')}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* translate=no to prevent browser auto-translate from mutating text nodes and breaking React reconciliation */}
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            translate="no"
            data-no-translate
            key={`signup-step-${currentStep}`}
            ref={formRef}
          >
            {antiTranslationArmed && (
              <div className="text-xs mb-2 p-2 rounded bg-amber-100 text-amber-800" translate="no">
                تم تعطيل الترجمة التلقائية داخل النموذج لحماية الأداء. إذا كانت الترجمة ممكّنة في المتصفح قد تواجه مشاكل.
              </div>
            )}
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('firstName')} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t('enterFirstName')} {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('lastName')} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t('enterLastName')} {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>البريد الإلكتروني *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="example@email.com"
                          {...field}
                          disabled={isLoading}
                          className={emailError ? "border-red-500" : ""}
                          dir="ltr"
                        />
                      </FormControl>
                      {emailError && (
                        <p className="text-xs text-red-500 mt-1" dir="rtl">
                          {emailError}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem data-field="country">
                      <FormLabel>الدولة *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر الدولة' : 'Select country'} />
                          </SelectTrigger>
                        </FormControl>
                        <CountrySelectContent options={ENGLISH_COUNTRIES} />
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsappWithCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('whatsappNumber')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="201234567890 أو 966512345678"
                          {...field}
                          inputMode="tel"
                          onChange={(e) => {
                            const raw = normalizeDigitsUniversal(e.target.value);
                            field.onChange(raw);
                          }}
                          disabled={isLoading}
                          className={whatsappError ? "border-red-500" : ""}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1" dir="rtl">
                        اكتب كود الدولة بدون 00 أو + ثم رقم الواتساب (اختياري)
                        <br />
                        مثال: مصر (20) – المملكة العربية السعودية (966) – الأردن (962) – الإمارات العربية المتحدة (971) – المغرب (212) – الكويت (965) – سوريا (963) – العراق (964)
                      </p>
                      {whatsappError && (
                        <p className="text-xs text-red-500 mt-1" dir="rtl">
                          {whatsappError}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('password')} *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••" 
                            {...field} 
                            disabled={isLoading}
                            className="pl-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            disabled={isLoading}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1" translate="no">{t('passwordFootnote')}</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passwordConfirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('confirmPassword')} *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPasswordConfirm ? "text" : "password"}
                            placeholder="••••••••" 
                            {...field} 
                            disabled={isLoading}
                            className="pl-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            disabled={isLoading}
                          >
                            {showPasswordConfirm ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1" translate="no">{t('passwordFootnote')}</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pinNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pinNumber')} *</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="1234" 
                          {...field} 
                          inputMode="numeric"
                          maxLength={4}
                          onChange={(e) => {
                            const raw = normalizeDigitsUniversal(e.target.value);
                            // Only allow digits and limit to 4 characters
                            const cleaned = raw.replace(/\D/g, '').slice(0, 4);
                            field.onChange(cleaned);
                          }}
                          disabled={isLoading} 
                        />
                      </FormControl>
                      <p className="text-xs text-red-500 mt-1" dir="rtl" translate="no">
                        {t('pinNumberFootnote')}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('iWantToJoinAs')} *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        required
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectYourRole')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">{t('userClient')}</SelectItem>
                          <SelectItem value="coach">{t('coachTrainer')}</SelectItem>
                          <SelectItem value="gym">{t('gymOwner') || 'Gym'}</SelectItem>
                          <SelectItem value="admin">{t('adminRole')}</SelectItem>
                          <SelectItem value="visitor">{t('visitorRole')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.watch('role') === 'admin' && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mt-2" translate="no">
                          {t('adminSignupWarning')}
                        </p>
                      )}
                      {form.watch('role') === 'visitor' && (
                        <p className="text-xs text-muted-foreground mt-2" translate="no">
                          {t('visitorSignupNote')}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  onClick={nextStep}
                  className="w-full"
                  disabled={isLoading}
                >
                  {['coach', 'gym', 'admin'].includes(form.watch('role')) ? t('createAccount') : t('continue')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}

            {/* Step 2: User-specific Information */}
            {currentStep === 2 && ['user', 'visitor'].includes(form.watch('role')) && (
              <>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{t('completeYourProfile')}</h3>
                  <p className="text-sm text-muted-foreground">{t('helpCreatePerfectPlan')}</p>
                </div>

                {/* Contact & Location */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('contactLocation')}</h4>

                  {/* WhatsApp & country code moved to Step 1 */}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('city')} *</FormLabel>
                          <FormControl>
                            <Input placeholder={t('city')} {...field} disabled={isLoading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('gender')} *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectGender')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">{t('male')}</SelectItem>
                              <SelectItem value="female">{t('female')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="religion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>الديانة *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="muslim">مسلم</SelectItem>
                              <SelectItem value="christian">مسيحي</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('age')} *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="25"
                              {...field}
                              onChange={(e) => {
                                const raw = normalizeDigitsUniversal(e.target.value);
                                field.onChange(raw ? parseInt(raw) : undefined);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">يمكنك الكتابة بالأرقام العربية ٠١٢٣٤٥٦٧٨٩ وسنحوّلها تلقائياً إلى 0-9.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Subscription Details removed from signup */}

                {/* Body Measurements */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('bodyMeasurements')}</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('heightCm')} *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="170"
                              {...field}
                              onChange={(e) => {
                                const raw = normalizeDigitsUniversal(e.target.value);
                                field.onChange(raw ? parseFloat(raw) : undefined);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">يمكنك الكتابة بالأرقام العربية ٠١٢٣٤٥٦٧٨٩ وسنحوّلها تلقائياً إلى 0-9.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('currentWeightKg')} *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="70"
                              {...field}
                              onChange={(e) => {
                                const raw = normalizeDigitsUniversal(e.target.value);
                                field.onChange(raw ? parseFloat(raw) : undefined);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">يمكنك الكتابة بالأرقام العربية ٠١٢٣٤٥٦٧٨٩ وسنحوّلها تلقائياً إلى 0-9.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="shoulderWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('shoulderWidthCm')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="40"
                              {...field}
                              onChange={(e) => {
                                const raw = normalizeDigitsUniversal(e.target.value);
                                field.onChange(raw ? parseFloat(raw) : undefined);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">يمكنك الكتابة بالأرقام العربية ٠١٢٣٤٥٦٧٨٩ وسنحوّلها تلقائياً إلى 0-9.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="chestWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('chestWidthCm')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="95"
                              {...field}
                              onChange={(e) => {
                                const raw = normalizeDigitsUniversal(e.target.value);
                                field.onChange(raw ? parseFloat(raw) : undefined);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">اكتب الأرقام باللغة الإنجليزية فقط (0-9) وليس بالأرقام العربية ٠١٢٣٤٥٦٧٨٩</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="waistWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('waistWidthCm')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="80"
                              {...field}
                              onChange={(e) => {
                                const raw = normalizeDigitsUniversal(e.target.value);
                                field.onChange(raw ? parseFloat(raw) : undefined);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">اكتب الأرقام باللغة الإنجليزية فقط (0-9) وليس بالأرقام العربية ٠١٢٣٤٥٦٧٨٩</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hipWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('hipWidthCm')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="95"
                              {...field}
                              onChange={(e) => {
                                const raw = normalizeDigitsUniversal(e.target.value);
                                field.onChange(raw ? parseFloat(raw) : undefined);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">اكتب الأرقام باللغة الإنجليزية فقط (0-9) وليس بالأرقام العربية ٠١٢٣٤٥٦٧٨٩</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Nutrition Preferences */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('nutritionPreferences')}</h4>

                  <FormField
                    control={form.control}
                    name="dailyMeals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('numberOfMealsPerDay')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectNumberOfMeals')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="3">{t('meals3')}</SelectItem>
                            <SelectItem value="4">{t('meals4')}</SelectItem>
                            <SelectItem value="5">{t('meals5')}</SelectItem>
                            <SelectItem value="6">{t('meals6')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredCarbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredCarbohydratesShort')} *</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                          {[
                            { value: "rice", label: t('rice') },
                            { value: "potatoes", label: t('potatoes') },
                            { value: "sweet_potato", label: t('sweetPotato') },
                            { value: "pasta", label: t('pasta') },
                            { value: "oats", label: t('oats') },
                            { value: "quinoa", label: t('quinoa') },
                            { value: "brown_toast", label: t('brownToast') },
                            { value: "other", label: t('other') },
                            { value: "none", label: t('doNotPreferAny') }
                          ].map((option) => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const isSelected = selectedValues.some(v => v === option.value || v.startsWith(option.value + ":"));
                            
                            return (
                              <div key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`carbs-${option.value}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                    if (e.target.checked) {
                                      if (option.value === 'none') {
                                        setCarbsCustom("");
                                        field.onChange('none');
                                      } else if (option.value === 'other') {
                                        // add placeholder token
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        if (!currentValues.find(v => v.startsWith('other'))) currentValues.push('other');
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        currentValues.push(option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    } else {
                                      if (option.value === 'none') {
                                        field.onChange('');
                                      } else if (option.value === 'other') {
                                        setCarbsCustom("");
                                        currentValues = currentValues.filter(v => !v.startsWith('other'));
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`carbs-${option.value}`} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                          {/* Custom input when 'none' or 'other' selected */}
                          {(() => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const hasNone = selectedValues.some(v => v.startsWith('none'));
                            const hasOther = selectedValues.some(v => v.startsWith('other'));
                            if (!hasNone && !hasOther) return null;
                            return (
                              <div className="col-span-2 mt-2">
                                <Input
                                  placeholder={t('enterYourAnswer')}
                                  value={carbsCustom}
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCarbsCustom(val);
                                    if (hasNone) {
                                      field.onChange(val ? `none:${val}` : 'none');
                                    } else if (hasOther) {
                                      field.onChange(val ? `other:${val}` : 'other');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredProteins"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredProteinsShort')} *</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                          {[
                            { value: "meat", label: t('meat') },
                            { value: "chicken", label: t('chicken') },
                            { value: "fish", label: t('fish') },
                            { value: "tuna", label: t('tuna') },
                            { value: "salmon", label: t('salmon') },
                            { value: "beef_liver", label: t('beefLiver') },
                            { value: "chicken_liver", label: t('chickenLiver') },
                            { value: "egg", label: t('egg') },
                            { value: "other", label: t('other') },
                            { value: "none", label: t('doNotPreferAny') }
                          ].map((option) => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const isSelected = selectedValues.some(v => v === option.value || v.startsWith(option.value + ":"));
                            
                            return (
                              <div key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`proteins-${option.value}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                    if (e.target.checked) {
                                      if (option.value === 'none') {
                                        setProteinsCustom("");
                                        field.onChange('none');
                                      } else if (option.value === 'other') {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        if (!currentValues.find(v => v.startsWith('other'))) currentValues.push('other');
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        currentValues.push(option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    } else {
                                      if (option.value === 'none') {
                                        field.onChange('');
                                      } else if (option.value === 'other') {
                                        setProteinsCustom("");
                                        currentValues = currentValues.filter(v => !v.startsWith('other'));
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`proteins-${option.value}`} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                          {(() => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const hasNone = selectedValues.some(v => v.startsWith('none'));
                            const hasOther = selectedValues.some(v => v.startsWith('other'));
                            if (!hasNone && !hasOther) return null;
                            return (
                              <div className="col-span-2 mt-2">
                                <Input
                                  placeholder={t('enterYourAnswer')}
                                  value={proteinsCustom}
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setProteinsCustom(val);
                                    if (hasNone) {
                                      field.onChange(val ? `none:${val}` : 'none');
                                    } else if (hasOther) {
                                      field.onChange(val ? `other:${val}` : 'other');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredLegumes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredLegumesShort')} *</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                          {[
                            { value: "foul", label: t('foul') },
                            { value: "corn", label: t('corn') },
                            { value: "chickpeas", label: t('chickpeas') },
                            { value: "white_beans", label: t('whiteBeans') },
                            { value: "red_beans", label: t('redBeans') },
                            { value: "peas", label: t('peas') },
                            { value: "other", label: t('other') },
                            { value: "none", label: t('doNotPreferAny') }
                          ].map((option) => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const isSelected = selectedValues.some(v => v === option.value || v.startsWith(option.value + ":"));
                            
                            return (
                              <div key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`legumes-${option.value}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                    if (e.target.checked) {
                                      if (option.value === 'none') {
                                        setLegumesCustom("");
                                        field.onChange('none');
                                      } else if (option.value === 'other') {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        if (!currentValues.find(v => v.startsWith('other'))) currentValues.push('other');
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        currentValues.push(option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    } else {
                                      if (option.value === 'none') {
                                        field.onChange('');
                                      } else if (option.value === 'other') {
                                        setLegumesCustom("");
                                        currentValues = currentValues.filter(v => !v.startsWith('other'));
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`legumes-${option.value}`} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                          {(() => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const hasNone = selectedValues.some(v => v.startsWith('none'));
                            const hasOther = selectedValues.some(v => v.startsWith('other'));
                            if (!hasNone && !hasOther) return null;
                            return (
                              <div className="col-span-2 mt-2">
                                <Input
                                  placeholder={t('enterYourAnswer')}
                                  value={legumesCustom}
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLegumesCustom(val);
                                    if (hasNone) {
                                      field.onChange(val ? `none:${val}` : 'none');
                                    } else if (hasOther) {
                                      field.onChange(val ? `other:${val}` : 'other');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredVegetables"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredVegetablesShort')} *</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                          {[
                            { value: "green_beans", label: t('greenBeans') },
                            { value: "okra", label: t('okra') },
                            { value: "broccoli", label: t('broccoli') },
                            { value: "zucchini", label: t('zucchini') },
                            { value: "lettuce", label: t('lettuce') },
                            { value: "spinach", label: t('spinach') },
                            { value: "other", label: t('other') },
                            { value: "none", label: t('doNotPreferAny') }
                          ].map((option) => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const isSelected = selectedValues.some(v => v === option.value || v.startsWith(option.value + ":"));
                            
                            return (
                              <div key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`vegetables-${option.value}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                    if (e.target.checked) {
                                      if (option.value === 'none') {
                                        setVegetablesCustom("");
                                        field.onChange('none');
                                      } else if (option.value === 'other') {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        if (!currentValues.find(v => v.startsWith('other'))) currentValues.push('other');
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        currentValues.push(option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    } else {
                                      if (option.value === 'none') {
                                        field.onChange('');
                                      } else if (option.value === 'other') {
                                        setVegetablesCustom("");
                                        currentValues = currentValues.filter(v => !v.startsWith('other'));
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`vegetables-${option.value}`} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                          {(() => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const hasNone = selectedValues.some(v => v.startsWith('none'));
                            const hasOther = selectedValues.some(v => v.startsWith('other'));
                            if (!hasNone && !hasOther) return null;
                            return (
                              <div className="col-span-2 mt-2">
                                <Input
                                  placeholder={t('enterYourAnswer')}
                                  value={vegetablesCustom}
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setVegetablesCustom(val);
                                    if (hasNone) {
                                      field.onChange(val ? `none:${val}` : 'none');
                                    } else if (hasOther) {
                                      field.onChange(val ? `other:${val}` : 'other');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredDairy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredDairyShort')} *</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                          {[
                            { value: "cottage_cheese", label: t('cottageCheese') },
                            { value: "milk", label: t('milk') },
                            { value: "mozzarella_cheese", label: t('mozzarellaCheese') },
                            { value: "yogurt", label: t('yogurt') },
                            { value: "cheddar_cheese", label: t('cheddarCheese') },
                            { value: "other", label: t('other') },
                            { value: "none", label: t('doNotPreferAny') }
                          ].map((option) => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const isSelected = selectedValues.some(v => v === option.value || v.startsWith(option.value + ":"));
                            
                            return (
                              <div key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`dairy-${option.value}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                    if (e.target.checked) {
                                      if (option.value === 'none') {
                                        setDairyCustom("");
                                        field.onChange('none');
                                      } else if (option.value === 'other') {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        if (!currentValues.find(v => v.startsWith('other'))) currentValues.push('other');
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        currentValues.push(option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    } else {
                                      if (option.value === 'none') {
                                        field.onChange('');
                                      } else if (option.value === 'other') {
                                        setDairyCustom("");
                                        currentValues = currentValues.filter(v => !v.startsWith('other'));
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`dairy-${option.value}`} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                          {(() => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const hasNone = selectedValues.some(v => v.startsWith('none'));
                            const hasOther = selectedValues.some(v => v.startsWith('other'));
                            if (!hasNone && !hasOther) return null;
                            return (
                              <div className="col-span-2 mt-2">
                                <Input
                                  placeholder={t('enterYourAnswer')}
                                  value={dairyCustom}
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDairyCustom(val);
                                    if (hasNone) {
                                      field.onChange(val ? `none:${val}` : 'none');
                                    } else if (hasOther) {
                                      field.onChange(val ? `other:${val}` : 'other');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredFats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredFatsShort')} *</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                          {[
                            { value: "olive_oil", label: t('oliveOil') },
                            { value: "coconut_oil", label: t('coconutOil') },
                            { value: "butter", label: t('butter') },
                            { value: "nuts", label: t('nuts') },
                            { value: "avocado", label: t('avocado') },
                            { value: "peanut_butter", label: t('peanutButter') },
                            { value: "other", label: t('other') },
                            { value: "none", label: t('doNotPreferAny') }
                          ].map((option) => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const isSelected = selectedValues.some(v => v === option.value || v.startsWith(option.value + ":"));
                            
                            return (
                              <div key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`fats-${option.value}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                    if (e.target.checked) {
                                      if (option.value === 'none') {
                                        setFatsCustom("");
                                        field.onChange('none');
                                      } else if (option.value === 'other') {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        if (!currentValues.find(v => v.startsWith('other'))) currentValues.push('other');
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        currentValues.push(option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    } else {
                                      if (option.value === 'none') {
                                        field.onChange('');
                                      } else if (option.value === 'other') {
                                        setFatsCustom("");
                                        currentValues = currentValues.filter(v => !v.startsWith('other'));
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`fats-${option.value}`} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                          {(() => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const hasNone = selectedValues.some(v => v.startsWith('none'));
                            const hasOther = selectedValues.some(v => v.startsWith('other'));
                            if (!hasNone && !hasOther) return null;
                            return (
                              <div className="col-span-2 mt-2">
                                <Input
                                  placeholder={t('enterYourAnswer')}
                                  value={fatsCustom}
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFatsCustom(val);
                                    if (hasNone) {
                                      field.onChange(val ? `none:${val}` : 'none');
                                    } else if (hasOther) {
                                      field.onChange(val ? `other:${val}` : 'other');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredFruits"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredFruitsShort')} *</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                          {[
                            { value: "banana", label: t('banana') },
                            { value: "apple", label: t('apple') },
                            { value: "strawberry", label: t('strawberry') },
                            { value: "watermelon", label: t('watermelon') },
                            { value: "orange", label: t('orange') },
                            { value: "other", label: t('other') },
                            { value: "none", label: t('doNotPreferAny') }
                          ].map((option) => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const isSelected = selectedValues.some(v => v === option.value || v.startsWith(option.value + ":"));
                            
                            return (
                              <div key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`fruits-${option.value}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    let currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                    if (e.target.checked) {
                                      if (option.value === 'none') {
                                        setFruitsCustom("");
                                        field.onChange('none');
                                      } else if (option.value === 'other') {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        if (!currentValues.find(v => v.startsWith('other'))) currentValues.push('other');
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== 'none');
                                        currentValues.push(option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    } else {
                                      if (option.value === 'none') {
                                        field.onChange('');
                                      } else if (option.value === 'other') {
                                        setFruitsCustom("");
                                        currentValues = currentValues.filter(v => !v.startsWith('other'));
                                        field.onChange(currentValues.join(', '));
                                      } else {
                                        currentValues = currentValues.filter(v => v !== option.value);
                                        field.onChange(currentValues.join(', '));
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                <label htmlFor={`fruits-${option.value}`} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            );
                          })}
                          {(() => {
                            const selectedValues = field.value ? field.value.split(', ') : [];
                            const hasNone = selectedValues.some(v => v.startsWith('none'));
                            const hasOther = selectedValues.some(v => v.startsWith('other'));
                            if (!hasNone && !hasOther) return null;
                            return (
                              <div className="col-span-2 mt-2">
                                <Input
                                  placeholder={t('enterYourAnswer')}
                                  value={fruitsCustom}
                                  disabled={isLoading}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFruitsCustom(val);
                                    if (hasNone) {
                                      field.onChange(val ? `none:${val}` : 'none');
                                    } else if (hasOther) {
                                      field.onChange(val ? `other:${val}` : 'other');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hasAllergies"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('doYouHaveAllergies')}</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="true">{t('yes')}</SelectItem>
                              <SelectItem value="false">{t('no')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="wantsSupplements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('doYouWantSupplements')}</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="true">{t('yes')}</SelectItem>
                              <SelectItem value="false">{t('no')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.watch("hasAllergies") && (
                    <FormField
                      control={form.control}
                      name="allergyDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('describeAllergies')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('allergiesPlaceholder')}
                              {...field}
                              disabled={isLoading}
                              rows={2}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Fitness Goals & Training */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('fitnessGoalsTraining')}</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fitnessGoal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fitnessGoal')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectGoal')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="weight_gain">{t('weightGain')}</SelectItem>
                              <SelectItem value="weight_loss">{t('weightLoss')}</SelectItem>
                              <SelectItem value="bulking">{t('bulking')}</SelectItem>
                              <SelectItem value="cutting">{t('cutting')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="trainingLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('trainingLevel')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectLevel')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="beginner">{t('beginner')}</SelectItem>
                              <SelectItem value="intermediate">{t('intermediate')}</SelectItem>
                              <SelectItem value="advanced">{t('advanced')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="trainingDaysPerWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('trainingDaysWeek')}</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">1 يوم</SelectItem>
                              <SelectItem value="2">2 أيام</SelectItem>
                              <SelectItem value="3">3 أيام</SelectItem>
                              <SelectItem value="4">4 أيام</SelectItem>
                              <SelectItem value="5">5 أيام</SelectItem>
                              <SelectItem value="6">6 أيام</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferredWorkoutTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('preferredWorkoutTime')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="morning">{t('afterWakingUp')}</SelectItem>
                              <SelectItem value="midday">{t('midDay')}</SelectItem>
                              <SelectItem value="evening">{t('evening')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="previousTrainer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('previousTrainer')}</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="true">{t('yes')}</SelectItem>
                              <SelectItem value="false">{t('no')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="howFoundUs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('howDidYouFindUs')} *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="facebook">{t('facebook')}</SelectItem>
                              <SelectItem value="instagram">{t('instagram')}</SelectItem>
                              <SelectItem value="youtube">{t('youtube')}</SelectItem>
                              <SelectItem value="tiktok">{t('tiktok')}</SelectItem>
                              <SelectItem value="whatsapp">{t('whatsapp')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="exerciseHistory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('exerciseHistory')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('exerciseHistoryPlaceholder')}
                            {...field}
                            disabled={isLoading}
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('back')}
                  </Button>
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {t('continue')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Health & Training Information */}
            {currentStep === 3 && ['user', 'visitor'].includes(form.watch('role')) && (
              <>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{t('healthTrainingInfo')}</h3>
                  <p className="text-sm text-muted-foreground">{t('helpUnderstandHealth')}</p>
                </div>

                {/* Photos Section */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('photos')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('photoInstructions')}
                  </p>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <FormField
                        control={form.control}
                        name="frontPhoto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('frontPhoto')}</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  field.onChange(file ? file.name : "");
                                }}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <FormField
                        control={form.control}
                        name="backPhoto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('backPhoto')}</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  field.onChange(file ? file.name : "");
                                }}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <FormField
                        control={form.control}
                        name="sidePhoto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('sidePhoto')}</FormLabel>
                            <FormControl>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  field.onChange(file ? file.name : "");
                                }}
                                disabled={isLoading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* InBody Section */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('inbodyMeasurement')}</h4>
                  
                  <FormField
                    control={form.control}
                    name="hasInbody"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('doYouHaveInbody')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">{t('yes')}</SelectItem>
                            <SelectItem value="false">{t('no')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inbodyDocument"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('attachInbodyDocument')}</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              field.onChange(file ? file.name : "");
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Medical History Section */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('medicalHistory')}</h4>
                  
                  <FormField
                    control={form.control}
                    name="medicalHistory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('medicalHistoryQuestion')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">{t('yes')}</SelectItem>
                            <SelectItem value="false">{t('no')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("medicalHistory") && (
                    <FormField
                      control={form.control}
                      name="medicalHistoryDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('describeMedicalHistory')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('medicalHistoryPlaceholder')}
                              {...field}
                              disabled={isLoading}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Work & Activity Section */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('workActivityLevel')}</h4>
                  
                  <FormField
                    control={form.control}
                    name="workIntensity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workNatureQuestion')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الشدة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="easy">{t('easy')}</SelectItem>
                            <SelectItem value="moderate">{t('medium')}</SelectItem>
                            <SelectItem value="hard">{t('hard')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workoutLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workoutLocation')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المكان" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gym">{t('gymLocation')}</SelectItem>
                            <SelectItem value="home">{t('homeLocation')}</SelectItem>
                            <SelectItem value="both">{t('bothLocations')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Workout Program Section */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('workoutPreferences')}</h4>
                  
                  <FormField
                    control={form.control}
                    name="preferredProgram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('preferredWorkoutProgram')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر البرنامج" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bro_split">{t('broSplit')}</SelectItem>
                            <SelectItem value="push_pull_legs">{t('pushPullLegs')}</SelectItem>
                            <SelectItem value="upper_lower">{t('upperLower')}</SelectItem>
                            <SelectItem value="random">{t('randomSystem')}</SelectItem>
                            <SelectItem value="dont_know">{t('dontKnow')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Daily Routine & Lifestyle */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('dailyRoutineLifestyle')}</h4>
                  
                  <FormField
                    control={form.control}
                    name="dailyRoutine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('shareRoutineDetails')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('routinePlaceholder')}
                            {...field}
                            disabled={isLoading}
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="wakeUpTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('wakeUpTime')}</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            onChange={(e) => {
                              // Normalize any Arabic-Indic digits inside the time string
                              const raw = normalizeDigitsUniversal(e.target.value);
                              field.onChange(raw);
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="breakfastTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('breakfastTime')}</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            onChange={(e) => {
                              const raw = normalizeDigitsUniversal(e.target.value);
                              field.onChange(raw);
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="breakfastDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('breakfastType')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('breakfastPlaceholder')}
                            {...field}
                            disabled={isLoading}
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lunchTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('lunchTime')}</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            onChange={(e) => {
                              const raw = normalizeDigitsUniversal(e.target.value);
                              field.onChange(raw);
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lunchDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('lunchType')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('lunchPlaceholder')}
                            {...field}
                            disabled={isLoading}
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lunchHasProtein"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('lunchProteinQuestion')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">{t('yesProteinDaily')}</SelectItem>
                            <SelectItem value="false">{t('noProteinSometimes')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dinnerTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('dinnerTime')}</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            onChange={(e) => {
                              const raw = normalizeDigitsUniversal(e.target.value);
                              field.onChange(raw);
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dinnerDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('dinnerType')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('dinnerPlaceholder')}
                            {...field}
                            disabled={isLoading}
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Work & Equipment */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{t('workEquipment')}</h4>
                  
                  <FormField
                    control={form.control}
                    name="workType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('currentOccupation')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('occupationPlaceholder')}
                            {...field}
                            disabled={isLoading}
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workRoutineDescription')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('workRoutinePlaceholder')}
                            {...field}
                            disabled={isLoading}
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hasKitchenScale"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('hasKitchenScale')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">{t('yes')}</SelectItem>
                            <SelectItem value="false">{t('no')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentReceipt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('attachPaymentReceipt')}</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              field.onChange(file ? file.name : "");
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('back')}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {isLoading ? t('creatingAccount') : t('createAccount')}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{" "}
          <Button variant="link" className="p-0" onClick={onToggleForm}>
            {t('login')}
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
};

export default SignUp;