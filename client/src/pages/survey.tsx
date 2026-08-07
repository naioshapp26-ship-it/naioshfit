import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";

interface SurveyFormData {
  firstName: string;
  lastName: string;
  dietSatisfaction: string;
  exerciseSatisfaction: string;
  supportSatisfaction: string;
  hasImprovement: string;
  suggestions: string;
  hasDifficulties: string;
  difficultiesDetails: string;
  favoritePart: string;
  howDidYouHear: string;
  hasAppProblems: string;
  appProblemsDetails: string;
  mostUsedFeature: string;
  featureRequest: string;
}

export default function Survey() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState<SurveyFormData>({
    firstName: "",
    lastName: "",
    dietSatisfaction: "",
    exerciseSatisfaction: "",
    supportSatisfaction: "",
    hasImprovement: "",
    suggestions: "",
    hasDifficulties: "",
    difficultiesDetails: "",
    favoritePart: "",
    howDidYouHear: "",
    hasAppProblems: "",
    appProblemsDetails: "",
    mostUsedFeature: "",
    featureRequest: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SurveyFormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SurveyFormData, string>> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "الاسم الأول مطلوب";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "اسم العائلة مطلوب";
    }
    if (!formData.dietSatisfaction) {
      newErrors.dietSatisfaction = "هذا السؤال مطلوب";
    }
    if (!formData.exerciseSatisfaction) {
      newErrors.exerciseSatisfaction = "هذا السؤال مطلوب";
    }
    if (!formData.supportSatisfaction) {
      newErrors.supportSatisfaction = "هذا السؤال مطلوب";
    }
    if (!formData.hasImprovement) {
      newErrors.hasImprovement = "هذا السؤال مطلوب";
    }
    if (!formData.hasDifficulties) {
      newErrors.hasDifficulties = "هذا السؤال مطلوب";
    }
    if (formData.hasDifficulties === "yes" && !formData.difficultiesDetails.trim()) {
      newErrors.difficultiesDetails = "يرجى توضيح الصعوبات التي واجهتها";
    }
    if (!formData.howDidYouHear) {
      newErrors.howDidYouHear = "هذا السؤال مطلوب";
    }
    if (!formData.hasAppProblems) {
      newErrors.hasAppProblems = "هذا السؤال مطلوب";
    }
    if (formData.hasAppProblems === "yes" && !formData.appProblemsDetails.trim()) {
      newErrors.appProblemsDetails = "يرجى توضيح المشكلة";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitSurveyMutation = useMutation({
    mutationFn: async (data: SurveyFormData) => {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("فشل إرسال الاستبيان");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "تم الإرسال بنجاح",
        description: "شكراً لك على مشاركة رأيك معنا!",
      });
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إرسال الاستبيان",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      submitSurveyMutation.mutate(formData);
    } else {
      toast({
        title: "خطأ في النموذج",
        description: "الرجاء ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
    }
  };

  const satisfactionOptions = [
    { value: "excellent", label: "ممتاز" },
    { value: "very_good", label: "جيد جدًا" },
    { value: "good", label: "جيد" },
    { value: "acceptable", label: "مقبول" },
    { value: "poor", label: "سيئ" },
  ];

  const yesNoOptions = [
    { value: "yes", label: "نعم" },
    { value: "no", label: "لا" },
  ];

  const sourceOptions = [
    { value: "facebook", label: "فيسبوك" },
    { value: "instagram", label: "انستجرام" },
    { value: "youtube", label: "يوتيوب" },
    { value: "tiktok", label: "تيك توك" },
  ];

  if (submitted) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">شكراً لك!</CardTitle>
            <CardDescription className="text-lg">
              تم إرسال ردودك بنجاح. نقدر وقتك وملاحظاتك القيمة!
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">استبيان رضا العملاء</CardTitle>
          <CardDescription>
            نحن نقدر رأيك ونسعى دائماً للتحسين. يرجى أخذ بضع دقائق لملء هذا الاستبيان.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Section */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName">
                  الاسم الأول <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={errors.firstName ? "border-red-500" : ""}
                  dir="auto"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName">
                  اسم العائلة <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={errors.lastName ? "border-red-500" : ""}
                  dir="auto"
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Satisfaction Ratings */}
            <div className="space-y-6">
              {/* Diet Satisfaction */}
              <div className="space-y-3">
                <Label>
                  مدى رضاك عن النظام الغذائي <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.dietSatisfaction}
                  onValueChange={(value) => setFormData({ ...formData, dietSatisfaction: value })}
                  className={errors.dietSatisfaction ? "border border-red-500 rounded-md p-3" : ""}
                >
                  {satisfactionOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={option.value} id={`diet-${option.value}`} />
                      <Label htmlFor={`diet-${option.value}`} className="cursor-pointer font-normal">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {errors.dietSatisfaction && (
                  <p className="text-red-500 text-sm">{errors.dietSatisfaction}</p>
                )}
              </div>

              {/* Exercise Satisfaction */}
              <div className="space-y-3">
                <Label>
                  مدى رضاك عن نظام التمرين <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.exerciseSatisfaction}
                  onValueChange={(value) => setFormData({ ...formData, exerciseSatisfaction: value })}
                  className={errors.exerciseSatisfaction ? "border border-red-500 rounded-md p-3" : ""}
                >
                  {satisfactionOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={option.value} id={`exercise-${option.value}`} />
                      <Label htmlFor={`exercise-${option.value}`} className="cursor-pointer font-normal">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {errors.exerciseSatisfaction && (
                  <p className="text-red-500 text-sm">{errors.exerciseSatisfaction}</p>
                )}
              </div>

              {/* Support Satisfaction */}
              <div className="space-y-3">
                <Label>
                  مدى رضاك عن المتابعة والدعم <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.supportSatisfaction}
                  onValueChange={(value) => setFormData({ ...formData, supportSatisfaction: value })}
                  className={errors.supportSatisfaction ? "border border-red-500 rounded-md p-3" : ""}
                >
                  {satisfactionOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={option.value} id={`support-${option.value}`} />
                      <Label htmlFor={`support-${option.value}`} className="cursor-pointer font-normal">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {errors.supportSatisfaction && (
                  <p className="text-red-500 text-sm">{errors.supportSatisfaction}</p>
                )}
              </div>
            </div>

            {/* Improvement */}
            <div className="space-y-3">
              <Label>
                هل لاحظت أي تحسن في نتائجك الرياضية حتى الآن؟ <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={formData.hasImprovement}
                onValueChange={(value) => setFormData({ ...formData, hasImprovement: value })}
                className={errors.hasImprovement ? "border border-red-500 rounded-md p-3" : ""}
              >
                {yesNoOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value={option.value} id={`improvement-${option.value}`} />
                    <Label htmlFor={`improvement-${option.value}`} className="cursor-pointer font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.hasImprovement && (
                <p className="text-red-500 text-sm">{errors.hasImprovement}</p>
              )}
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <Label htmlFor="suggestions">
                عشان إحنا بنحب نطور من نفسنا ونسمع رأيكم، إيه اقتراحاتك للتطور والتحسين في النظام الغذائي أو التمرين أو المتابعة؟
              </Label>
              <Textarea
                id="suggestions"
                value={formData.suggestions}
                onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
                rows={4}
                placeholder="اكتب اقتراحاتك هنا..."
                dir="auto"
              />
            </div>

            {/* Difficulties */}
            <div className="space-y-3">
              <Label>
                هل واجهت أي صعوبات في اتباع النظام الغذائي أو التمرين؟ <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={formData.hasDifficulties}
                onValueChange={(value) => setFormData({ ...formData, hasDifficulties: value })}
                className={errors.hasDifficulties ? "border border-red-500 rounded-md p-3" : ""}
              >
                {yesNoOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value={option.value} id={`difficulties-${option.value}`} />
                    <Label htmlFor={`difficulties-${option.value}`} className="cursor-pointer font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.hasDifficulties && (
                <p className="text-red-500 text-sm">{errors.hasDifficulties}</p>
              )}
            </div>

            {/* Difficulties Details - Conditional */}
            {formData.hasDifficulties === "yes" && (
              <div className="space-y-2">
                <Label htmlFor="difficultiesDetails">
                  يرجى توضيح الصعوبات التي واجهتها <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="difficultiesDetails"
                  value={formData.difficultiesDetails}
                  onChange={(e) => setFormData({ ...formData, difficultiesDetails: e.target.value })}
                  className={errors.difficultiesDetails ? "border-red-500" : ""}
                  rows={4}
                  placeholder="اكتب الصعوبات التي واجهتها هنا..."
                  dir="auto"
                />
                {errors.difficultiesDetails && (
                  <p className="text-red-500 text-sm mt-1">{errors.difficultiesDetails}</p>
                )}
              </div>
            )}

            {/* Favorite Part */}
            <div className="space-y-2">
              <Label htmlFor="favoritePart">
                إيه أكتر حاجة عجبتك في البرنامج لحد دلوقتي؟
              </Label>
              <Textarea
                id="favoritePart"
                value={formData.favoritePart}
                onChange={(e) => setFormData({ ...formData, favoritePart: e.target.value })}
                rows={4}
                placeholder="اكتب رأيك هنا..."
                dir="auto"
              />
            </div>

            {/* How did you hear about us */}
            <div className="space-y-3">
              <Label>
                كيف سمعت عنا؟ <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={formData.howDidYouHear}
                onValueChange={(value) => setFormData({ ...formData, howDidYouHear: value })}
                className={errors.howDidYouHear ? "border border-red-500 rounded-md p-3" : ""}
              >
                {sourceOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value={option.value} id={`source-${option.value}`} />
                    <Label htmlFor={`source-${option.value}`} className="cursor-pointer font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.howDidYouHear && (
                <p className="text-red-500 text-sm">{errors.howDidYouHear}</p>
              )}
            </div>

            {/* App Problems */}
            <div className="space-y-3">
              <Label>
                هل واجهت أي مشاكل أثناء استخدام التطبيق؟ <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={formData.hasAppProblems}
                onValueChange={(value) => setFormData({ ...formData, hasAppProblems: value })}
                className={errors.hasAppProblems ? "border border-red-500 rounded-md p-3" : ""}
              >
                {yesNoOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value={option.value} id={`app-problems-${option.value}`} />
                    <Label htmlFor={`app-problems-${option.value}`} className="cursor-pointer font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.hasAppProblems && (
                <p className="text-red-500 text-sm">{errors.hasAppProblems}</p>
              )}
            </div>

            {/* App Problems Details - Conditional */}
            {formData.hasAppProblems === "yes" && (
              <div className="space-y-2">
                <Label htmlFor="appProblemsDetails">
                  ما هي المشكلة؟ <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="appProblemsDetails"
                  value={formData.appProblemsDetails}
                  onChange={(e) => setFormData({ ...formData, appProblemsDetails: e.target.value })}
                  className={errors.appProblemsDetails ? "border-red-500" : ""}
                  rows={4}
                  placeholder="اكتب المشكلة التي واجهتها هنا..."
                  dir="auto"
                />
                {errors.appProblemsDetails && (
                  <p className="text-red-500 text-sm mt-1">{errors.appProblemsDetails}</p>
                )}
              </div>
            )}

            {/* Most Used Feature */}
            <div className="space-y-2">
              <Label htmlFor="mostUsedFeature">
                ما هى أكثر خاصية تستخدمها في التطبيق؟
              </Label>
              <Textarea
                id="mostUsedFeature"
                value={formData.mostUsedFeature}
                onChange={(e) => setFormData({ ...formData, mostUsedFeature: e.target.value })}
                rows={4}
                placeholder="اكتب أكثر خاصية تستخدمها هنا..."
                dir="auto"
              />
            </div>

            {/* Feature Request */}
            <div className="space-y-2">
              <Label htmlFor="featureRequest">
                هل هناك خاصية تتمنى إضافتها أو تحسينها؟
              </Label>
              <Textarea
                id="featureRequest"
                value={formData.featureRequest}
                onChange={(e) => setFormData({ ...formData, featureRequest: e.target.value })}
                rows={4}
                placeholder="اكتب اقتراحاتك هنا..."
                dir="auto"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={submitSurveyMutation.isPending}
              >
                {submitSurveyMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  "إرسال الاستبيان"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
