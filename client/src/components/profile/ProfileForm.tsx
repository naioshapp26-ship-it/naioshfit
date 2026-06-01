
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

// Profile form schema with validation
const profileFormSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters" }),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters" }),
  // email removed
  phoneNumber: z.string().optional(),
  whatsappWithCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  gender: z.string().optional(),
  religion: z.string().optional(),
  height: z.number().min(50, { message: "Height must be at least 50 cm" }).max(300, { message: "Height must be less than 300 cm" }).optional(),
  weight: z.number().min(30, { message: "Weight must be at least 30 kg" }).max(500, { message: "Weight must be less than 500 kg" }).optional(),
  goalWeight: z.number().min(30, { message: "Goal weight must be at least 30 kg" }).max(500, { message: "Goal weight must be less than 500 kg" }).optional(),
  age: z.number().min(13, { message: "Age must be at least 13" }).max(120, { message: "Age must be less than 120" }).optional(),
  activityLevel: z.string().optional(),
  fitnessGoal: z.string().optional(),
  shoulderWidth: z.number().optional(),
  chestWidth: z.number().optional(),
  waistWidth: z.number().optional(),
  hipWidth: z.number().optional(),
  hasInbody: z.boolean().optional(),
  trainingLevel: z.string().optional(),
  trainingDaysPerWeek: z.number().optional(),
  preferredWorkoutTime: z.string().optional(),
  preferredProgram: z.string().optional(),
  medicalHistory: z.boolean().optional(),
  medicalHistoryDetails: z.string().optional(),
  workIntensity: z.string().optional(),
  workoutLocation: z.string().optional(),
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
  previousTrainer: z.boolean().optional(),
  dailyRoutine: z.string().optional(),
  exerciseHistory: z.string().optional(),
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
  howFoundUs: z.string().optional(),
  preferredCoachName: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const ProfileForm: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  // Set default values from user
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
  // email removed
      phoneNumber: user?.phoneNumber || "",
      whatsappWithCode: user?.whatsappWithCode || "",
      city: user?.city || "",
      country: user?.country || "",
      gender: user?.gender || "",
      religion: user?.religion || "",
      height: user?.height || undefined,
      weight: user?.weight || undefined,
      goalWeight: user?.goalWeight || undefined,
      age: user?.age || undefined,
      activityLevel: user?.activityLevel || "",
      fitnessGoal: user?.fitnessGoal || "",
      shoulderWidth: user?.shoulderWidth || undefined,
      chestWidth: user?.chestWidth || undefined,
      waistWidth: user?.waistWidth || undefined,
      hipWidth: user?.hipWidth || undefined,
      hasInbody: user?.hasInbody || false,
      trainingLevel: user?.trainingLevel || "",
      trainingDaysPerWeek: user?.trainingDaysPerWeek || undefined,
      preferredWorkoutTime: user?.preferredWorkoutTime || "",
      preferredProgram: user?.preferredProgram || "",
      medicalHistory: user?.medicalHistory || false,
      medicalHistoryDetails: user?.medicalHistoryDetails || "",
      workIntensity: user?.workIntensity || "",
      workoutLocation: user?.workoutLocation || "",
      dailyMeals: user?.dailyMeals || undefined,
      preferredCarbs: user?.preferredCarbs || "",
      preferredProteins: user?.preferredProteins || "",
      preferredLegumes: user?.preferredLegumes || "",
      preferredVegetables: user?.preferredVegetables || "",
      preferredDairy: user?.preferredDairy || "",
      preferredFats: user?.preferredFats || "",
      preferredFruits: user?.preferredFruits || "",
      hasAllergies: user?.hasAllergies || false,
      allergyDetails: user?.allergyDetails || "",
      wantsSupplements: user?.wantsSupplements || false,
      previousTrainer: user?.previousTrainer || false,
      dailyRoutine: user?.dailyRoutine || "",
      exerciseHistory: user?.exerciseHistory || "",
      wakeUpTime: user?.wakeUpTime || "",
      breakfastTime: user?.breakfastTime || "",
      breakfastDetails: user?.breakfastDetails || "",
      lunchTime: user?.lunchTime || "",
      lunchDetails: user?.lunchDetails || "",
      dinnerTime: user?.dinnerTime || "",
      dinnerDetails: user?.dinnerDetails || "",
      lunchHasProtein: user?.lunchHasProtein || true,
      workType: user?.workType || "",
      workHours: user?.workHours || "",
      hasKitchenScale: user?.hasKitchenScale || false,
      howFoundUs: user?.howFoundUs || "",
      preferredCoachName: user?.preferredCoachName || "",
      bio: user?.bio || "",
    }
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      await updateUser(data);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully"
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Email removed */}

                <FormField
                  control={form.control}
                  name="whatsappWithCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="Enter your WhatsApp number"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
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
                      <FormLabel>Religion</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select religion" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="muslim">Muslim</SelectItem>
                          <SelectItem value="christian">Christian</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Physical Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Physical Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (cm)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Weight (kg)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="goalWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Weight (kg)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shoulderWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shoulder Width (cm)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chestWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chest Width (cm)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="waistWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waist Width (cm)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hipWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hip Width (cm)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hasInbody"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Has InBody Scan</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Fitness Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Fitness Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="activityLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Activity Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select activity level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sedentary">Sedentary (little or no exercise)</SelectItem>
                          <SelectItem value="light">Light (exercise 1-3 days/week)</SelectItem>
                          <SelectItem value="moderate">Moderate (exercise 3-5 days/week)</SelectItem>
                          <SelectItem value="active">Active (exercise 6-7 days/week)</SelectItem>
                          <SelectItem value="very active">Very Active (intense exercise daily)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fitnessGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fitness Goal</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fitness goal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weight_loss">Weight Loss</SelectItem>
                          <SelectItem value="weight_gain">Weight Gain</SelectItem>
                          <SelectItem value="bulking">Bulking</SelectItem>
                          <SelectItem value="cutting">Cutting</SelectItem>
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
                      <FormLabel>Training Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select training level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trainingDaysPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Training Days Per Week</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="7"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredWorkoutTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Workout Time</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select workout time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="midday">Midday</SelectItem>
                          <SelectItem value="evening">Evening</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredProgram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Program</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select program" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bro_split">Bro Split</SelectItem>
                          <SelectItem value="push_pull_legs">Push Pull Legs</SelectItem>
                          <SelectItem value="upper_lower">Upper/Lower</SelectItem>
                          <SelectItem value="random">Random</SelectItem>
                          <SelectItem value="dont_know">Don't Know</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workIntensity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Intensity</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select intensity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Health Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Health Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="medicalHistory"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Has Medical History</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hasAllergies"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Has Allergies</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="medicalHistoryDetails"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>Medical History Details</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allergyDetails"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>Allergy Details</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Nutrition Preferences */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Nutrition Preferences</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dailyMeals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Meals</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select number of meals" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="3">3 meals</SelectItem>
                          <SelectItem value="4">4 meals</SelectItem>
                          <SelectItem value="5">5 meals</SelectItem>
                          <SelectItem value="6">6 meals</SelectItem>
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
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Wants Supplements</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredCarbs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred types of carbohydrates (multiple selection allowed)</FormLabel>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {[
                          { value: "rice", label: "Rice" },
                          { value: "potatoes", label: "Potatoes" },
                          { value: "sweet_potato", label: "Sweet potato" },
                          { value: "pasta", label: "Pasta" },
                          { value: "oats", label: "Oats" },
                          { value: "quinoa", label: "Quinoa" },
                          { value: "brown_toast", label: "Brown Toast" },
                          { value: "none", label: "لا افضل اي منهم" }
                        ].map((option) => {
                          const selectedValues = field.value ? field.value.split(', ') : [];
                          const isSelected = selectedValues.includes(option.value);
                          
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`carbs-${option.value}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                  if (e.target.checked) {
                                    if (option.value === 'none') {
                                      field.onChange('none');
                                    } else {
                                      const newValues = currentValues.filter(v => v !== 'none').concat(option.value);
                                      field.onChange(newValues.join(', '));
                                    }
                                  } else {
                                    const newValues = currentValues.filter(v => v !== option.value);
                                    field.onChange(newValues.join(', '));
                                  }
                                }}
                              />
                              <label htmlFor={`carbs-${option.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {option.label}
                              </label>
                            </div>
                          );
                        })}
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
                      <FormLabel>Preferred types of protein (multiple selection allowed)</FormLabel>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {[
                          { value: "meat", label: "Meat" },
                          { value: "chicken", label: "Chicken" },
                          { value: "fish", label: "Fish" },
                          { value: "tuna", label: "Tuna" },
                          { value: "salmon", label: "Salmon" },
                          { value: "beef_liver", label: "Beef liver" },
                          { value: "chicken_liver", label: "Chicken liver" },
                          { value: "egg", label: "Egg" },
                          { value: "none", label: "لا افضل اي منهم" }
                        ].map((option) => {
                          const selectedValues = field.value ? field.value.split(', ') : [];
                          const isSelected = selectedValues.includes(option.value);
                          
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`proteins-${option.value}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                  if (e.target.checked) {
                                    if (option.value === 'none') {
                                      field.onChange('none');
                                    } else {
                                      const newValues = currentValues.filter(v => v !== 'none').concat(option.value);
                                      field.onChange(newValues.join(', '));
                                    }
                                  } else {
                                    const newValues = currentValues.filter(v => v !== option.value);
                                    field.onChange(newValues.join(', '));
                                  }
                                }}
                              />
                              <label htmlFor={`proteins-${option.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {option.label}
                              </label>
                            </div>
                          );
                        })}
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
                      <FormLabel>Preferred types of legumes (multiple selection allowed)</FormLabel>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {[
                          { value: "foul", label: "Foul" },
                          { value: "corn", label: "Corn" },
                          { value: "chickpeas", label: "Chickpeas" },
                          { value: "white_beans", label: "White beans" },
                          { value: "red_beans", label: "Red beans" },
                          { value: "peas", label: "Peas" },
                          { value: "none", label: "لا افضل اي منهم" }
                        ].map((option) => {
                          const selectedValues = field.value ? field.value.split(', ') : [];
                          const isSelected = selectedValues.includes(option.value);
                          
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`legumes-${option.value}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                  if (e.target.checked) {
                                    if (option.value === 'none') {
                                      field.onChange('none');
                                    } else {
                                      const newValues = currentValues.filter(v => v !== 'none').concat(option.value);
                                      field.onChange(newValues.join(', '));
                                    }
                                  } else {
                                    const newValues = currentValues.filter(v => v !== option.value);
                                    field.onChange(newValues.join(', '));
                                  }
                                }}
                              />
                              <label htmlFor={`legumes-${option.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {option.label}
                              </label>
                            </div>
                          );
                        })}
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
                      <FormLabel>Preferred types of vegetables (multiple selection allowed)</FormLabel>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {[
                          { value: "green_beans", label: "Green beans" },
                          { value: "okra", label: "Okra" },
                          { value: "broccoli", label: "Broccoli" },
                          { value: "zucchini", label: "Zucchini" },
                          { value: "lettuce", label: "Lettuce" },
                          { value: "spinach", label: "Spinach" },
                          { value: "none", label: "لا افضل اي منهم" }
                        ].map((option) => {
                          const selectedValues = field.value ? field.value.split(', ') : [];
                          const isSelected = selectedValues.includes(option.value);
                          
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`vegetables-${option.value}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                  if (e.target.checked) {
                                    if (option.value === 'none') {
                                      field.onChange('none');
                                    } else {
                                      const newValues = currentValues.filter(v => v !== 'none').concat(option.value);
                                      field.onChange(newValues.join(', '));
                                    }
                                  } else {
                                    const newValues = currentValues.filter(v => v !== option.value);
                                    field.onChange(newValues.join(', '));
                                  }
                                }}
                              />
                              <label htmlFor={`vegetables-${option.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {option.label}
                              </label>
                            </div>
                          );
                        })}
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
                      <FormLabel>Preferred types of dairy (multiple selection allowed)</FormLabel>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {[
                          { value: "milk", label: "Milk" },
                          { value: "yogurt", label: "Yogurt" },
                          { value: "cottage_cheese", label: "Cottage cheese" },
                          { value: "cheddar", label: "Cheddar" },
                          { value: "mozzarella", label: "Mozzarella" },
                          { value: "none", label: "لا افضل اي منهم" }
                        ].map((option) => {
                          const selectedValues = field.value ? field.value.split(', ') : [];
                          const isSelected = selectedValues.includes(option.value);
                          
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`dairy-${option.value}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                  if (e.target.checked) {
                                    if (option.value === 'none') {
                                      field.onChange('none');
                                    } else {
                                      const newValues = currentValues.filter(v => v !== 'none').concat(option.value);
                                      field.onChange(newValues.join(', '));
                                    }
                                  } else {
                                    const newValues = currentValues.filter(v => v !== option.value);
                                    field.onChange(newValues.join(', '));
                                  }
                                }}
                              />
                              <label htmlFor={`dairy-${option.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {option.label}
                              </label>
                            </div>
                          );
                        })}
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
                      <FormLabel>Preferred types of fats (multiple selection allowed)</FormLabel>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {[
                          { value: "olive_oil", label: "Olive oil" },
                          { value: "coconut_oil", label: "Coconut oil" },
                          { value: "butter", label: "Butter" },
                          { value: "nuts", label: "Nuts" },
                          { value: "avocado", label: "Avocado" },
                          { value: "peanut_butter", label: "Peanut butter" },
                          { value: "none", label: "لا افضل اي منهم" }
                        ].map((option) => {
                          const selectedValues = field.value ? field.value.split(', ') : [];
                          const isSelected = selectedValues.includes(option.value);
                          
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`fats-${option.value}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                  if (e.target.checked) {
                                    if (option.value === 'none') {
                                      field.onChange('none');
                                    } else {
                                      const newValues = currentValues.filter(v => v !== 'none').concat(option.value);
                                      field.onChange(newValues.join(', '));
                                    }
                                  } else {
                                    const newValues = currentValues.filter(v => v !== option.value);
                                    field.onChange(newValues.join(', '));
                                  }
                                }}
                              />
                              <label htmlFor={`fats-${option.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {option.label}
                              </label>
                            </div>
                          );
                        })}
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
                      <FormLabel>Preferred types of fruits (multiple selection allowed)</FormLabel>
                      <div className="grid grid-cols-2 gap-2 p-4 border rounded-md">
                        {[
                          { value: "banana", label: "Banana" },
                          { value: "apple", label: "Apple" },
                          { value: "strawberry", label: "Strawberry" },
                          { value: "watermelon", label: "Watermelon" },
                          { value: "orange", label: "Orange" },
                          { value: "none", label: "لا افضل اي منهم" }
                        ].map((option) => {
                          const selectedValues = field.value ? field.value.split(', ') : [];
                          const isSelected = selectedValues.includes(option.value);
                          
                          return (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`fruits-${option.value}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentValues = field.value ? field.value.split(', ').filter(v => v) : [];
                                  if (e.target.checked) {
                                    if (option.value === 'none') {
                                      field.onChange('none');
                                    } else {
                                      const newValues = currentValues.filter(v => v !== 'none').concat(option.value);
                                      field.onChange(newValues.join(', '));
                                    }
                                  } else {
                                    const newValues = currentValues.filter(v => v !== option.value);
                                    field.onChange(newValues.join(', '));
                                  }
                                }}
                              />
                              <label htmlFor={`fruits-${option.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {option.label}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Daily Routine */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Daily Routine</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="wakeUpTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wake Up Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
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
                      <FormLabel>Breakfast Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
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
                      <FormLabel>Lunch Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dinnerTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dinner Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
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
                      <FormLabel>Breakfast Details</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
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
                      <FormLabel>Lunch Details</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
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
                      <FormLabel>Dinner Details</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lunchHasProtein"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Lunch Has Protein</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Work Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Work Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="workType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Type</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Work Hours</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hasKitchenScale"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Has Kitchen Scale</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="previousTrainer"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Had Previous Trainer</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="dailyRoutine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Routine</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exerciseHistory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exercise History</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="howFoundUs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How Did You Find Us?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredCoachName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Coach Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ProfileForm;
