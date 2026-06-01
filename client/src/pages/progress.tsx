import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { dateStringForToday, formatInAppTz, parseDateStringInAppTz } from '@/lib/timezone';
import { Progress, DailyStats } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { ArrowLeft, ArrowRight, TrendingUp, Activity, Weight, Calendar } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import AnimatedBackground from "@/components/layout/AnimatedBackground";

// Form schema for progress tracking
const progressSchema = z.object({
  weight: z.number().min(20).max(500).optional(),
  notes: z.string().optional(),
});

type ProgressFormValues = z.infer<typeof progressSchema>;

const ProgressPage = () => {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 7),
    end: new Date(),
  });
  const [selectedDate, setSelectedDate] = useState(dateStringForToday());
  const { toast } = useToast();

  const form = useForm<ProgressFormValues>({
    resolver: zodResolver(progressSchema),
    defaultValues: {
      weight: undefined,
      notes: "",
    },
  });

  // Fetch progress data for charts
  const { data: progressData, isLoading: isLoadingProgress } = useQuery<Progress[]>({
    queryKey: ['/api/progress', { 
      startDate: parseDateStringInAppTz(formatInAppTz(dateRange.start, 'yyyy-MM-dd')).toISOString(),
      endDate: parseDateStringInAppTz(formatInAppTz(dateRange.end, 'yyyy-MM-dd')).toISOString()
    }],
  });

  // Fetch progress for selected date
  const { data: selectedDateProgress, isLoading: isLoadingSelectedDateProgress } = useQuery<Progress>({
  queryKey: ['/api/progress', { date: parseDateStringInAppTz(selectedDate).toISOString() }],
  });

  // Update form when selectedDateProgress data changes
  useEffect(() => {
    if (selectedDateProgress) {
      form.reset({
        weight: selectedDateProgress.weight || undefined,
        notes: selectedDateProgress.notes || "",
      });
    }
  }, [selectedDateProgress, form]);

  // Fetch stats data for the period
  const { data: statsData, isLoading: isLoadingStats } = useQuery<DailyStats[]>({
    queryKey: ['/api/daily-stats', { 
      startDate: parseDateStringInAppTz(formatInAppTz(dateRange.start, 'yyyy-MM-dd')).toISOString(),
      endDate: parseDateStringInAppTz(formatInAppTz(dateRange.end, 'yyyy-MM-dd')).toISOString()
    }],
  });

  const moveDateRange = (direction: 'prev' | 'next') => {
    const days = Math.floor((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000));
  const today = new Date();
    
    if (direction === 'prev') {
      setDateRange({
        start: subDays(dateRange.start, days),
        end: subDays(dateRange.end, days),
      });
    } else {
      const newEnd = addDays(dateRange.end, days);
      // Don't go beyond today
      if (newEnd > today) {
        setDateRange({
          start: subDays(today, days),
          end: today,
        });
      } else {
        setDateRange({
          start: addDays(dateRange.start, days),
          end: newEnd,
        });
      }
    }
  };

  const onSubmit = async (values: ProgressFormValues) => {
    try {
      console.log('Submitting progress values:', values);
      console.log('Selected date progress exists:', !!selectedDateProgress);
      console.log('Selected date progress data:', selectedDateProgress);
      
      const payload = {
        ...values,
  date: parseDateStringInAppTz(selectedDate).toISOString(),
      };
      
      if (selectedDateProgress && 'id' in selectedDateProgress) {
        console.log('Updating existing progress with ID:', selectedDateProgress.id);
        await apiRequest('PATCH', `/api/progress/${selectedDateProgress.id}`, payload);
        toast({
          title: t("progressUpdated"),
          description: t("progressUpdatedSuccess"),
        });
      } else {
        console.log('Creating new progress entry');
        await apiRequest('POST', '/api/progress', payload);
        toast({
          title: t("progressRecorded"),
          description: t("progressRecordedSuccess"),
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/progress'] });
    } catch (error) {
      console.error("Error submitting progress:", error);
      toast({
        title: t("error"),
        description: t("failedToSaveProgress"),
        variant: "destructive",
      });
    }
  };

  // Format data for charts
  const formatChartData = () => {
    if (!progressData) return [];
    
    // Sort data by date first to ensure correct chronological order
    const sortedData = [...progressData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedData.map(p => ({
  date: formatInAppTz(new Date(p.date), 'MMM dd'),
      weight: p.weight,
    }));
  };

  const formatNutritionData = () => {
    if (!statsData) return [];
    
    // Handle case where statsData might be a single object instead of array
    const dataArray = Array.isArray(statsData) ? statsData : [statsData];
    
    // Sort nutrition data by date as well
    const sortedData = [...dataArray].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedData.map(s => ({
  date: formatInAppTz(new Date(s.date), 'MMM dd'),
      calories: s.calories,
      protein: s.protein,
      carbs: s.carbs,
      fat: s.fat,
    }));
  };

  const chartData = formatChartData();
  const nutritionData = formatNutritionData();

  return (
    <section className="p-4 md:p-6 lg:p-8 relative min-h-screen">
      <AnimatedBackground />
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">{t("progressTracking")}</h2>
          <p className="text-gray-600">{t("monitorFitnessJourney")}</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center">
          <div className="flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded-md p-2"
            />
          </div>
        </div>
      </div>

      {/* Selected Date Progress Entry */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              {t("progressFor")}: {formatInAppTz(parseDateStringInAppTz(selectedDate), 'MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("weightKg")}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="0.0"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("notes")}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t("notesPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" disabled={isLoadingSelectedDateProgress}>
                  {selectedDateProgress ? t("updateProgress") : t("saveProgress")}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">{t("progressCharts")}</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => moveDateRange('prev')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {formatInAppTz(dateRange.start, 'MMM dd')} - {formatInAppTz(dateRange.end, 'MMM dd')}
            </span>
            <Button variant="outline" size="sm" onClick={() => moveDateRange('next')}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="fitness" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fitness">{t("fitnessMetrics")}</TabsTrigger>
            <TabsTrigger value="nutrition">{t("nutritionTrends")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="fitness" className="space-y-6">
            {/* Weight Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Weight className="mr-2 h-5 w-5" />
                  {t("weightProgress")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>


          </TabsContent>
          
          <TabsContent value="nutrition" className="space-y-6">
            {/* Nutrition Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  {t("nutritionTrends")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={nutritionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="calories" stroke="#8884d8" name={t("calories")} />
                    <Line type="monotone" dataKey="protein" stroke="#82ca9d" name={t("proteinG")} />
                    <Line type="monotone" dataKey="carbs" stroke="#ffc658" name={t("carbsG")} />
                    <Line type="monotone" dataKey="fat" stroke="#ff7300" name={t("fatG")} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />
    </section>
  );
};

export default ProgressPage;