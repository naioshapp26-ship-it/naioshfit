import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { Eye, EyeOff, Save } from 'lucide-react';

interface AiFeatureSettings {
  apiKey?: string;
  model?: string;
  assistantId?: string;
  promptId?: string;
  promptVersion?: string;
}

interface AiSettings {
  plans?: AiFeatureSettings;
  chat?: AiFeatureSettings;
  foodSearch?: AiFeatureSettings;
}

interface AiSettingsResponse {
  settings: AiSettings;
  configured: {
    plans: boolean;
    chat: boolean;
    foodSearch: boolean;
  };
}

export default function AiSettingsAdmin() {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [plansApiKey, setPlansApiKey] = useState('');
  const [plansModel, setPlansModel] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [planModels, setPlanModels] = useState<string[]>([]);
  const [loadingPlanModels, setLoadingPlanModels] = useState(false);

  const [chatApiKey, setChatApiKey] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [chatModels, setChatModels] = useState<string[]>([]);
  const [loadingChatModels, setLoadingChatModels] = useState(false);

  const [foodApiKey, setFoodApiKey] = useState('');
  const [foodModel, setFoodModel] = useState('');
  const [foodPromptId, setFoodPromptId] = useState('');
  const [foodPromptVersion, setFoodPromptVersion] = useState('');
  const [foodModels, setFoodModels] = useState<string[]>([]);
  const [loadingFoodModels, setLoadingFoodModels] = useState(false);

  const [showPlansKey, setShowPlansKey] = useState(false);
  const [showChatKey, setShowChatKey] = useState(false);
  const [showFoodKey, setShowFoodKey] = useState(false);

  const { data, isLoading } = useQuery<AiSettingsResponse>({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/ai-settings', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 403) throw new Error(t('adminAccessRequired') || 'Admin access required');
        throw new Error(t('failedToFetchSettings') || 'Failed to fetch AI settings');
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (!data?.settings) return;
    const plans = data.settings.plans || {};
    const chat = data.settings.chat || {};
    const foodSearch = data.settings.foodSearch || {};

    setPlansApiKey(plans.apiKey || '');
    setPlansModel(plans.model || '');
    setAssistantId(plans.assistantId || '');
    setPlanModels((prev) => (plans.model && !prev.includes(plans.model) ? [plans.model, ...prev] : prev));

    setChatApiKey(chat.apiKey || '');
    setChatModel(chat.model || '');
    setChatModels((prev) => (chat.model && !prev.includes(chat.model) ? [chat.model, ...prev] : prev));

    setFoodApiKey(foodSearch.apiKey || '');
    setFoodModel(foodSearch.model || '');
    setFoodPromptId(foodSearch.promptId || '');
    setFoodPromptVersion(foodSearch.promptVersion || '');
    setFoodModels((prev) => (foodSearch.model && !prev.includes(foodSearch.model) ? [foodSearch.model, ...prev] : prev));
  }, [data]);

  const loadModels = async (
    apiKey: string,
    setModels: React.Dispatch<React.SetStateAction<string[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!apiKey.trim()) {
      toast({
        title: t('error') || 'Error',
        description: t('aiSettingsApiKeyRequired') || 'API key is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/ai-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || t('aiSettingsModelsLoadFailed') || 'Failed to load models');
      }
      const result = await response.json();
      const models = Array.isArray(result?.models) ? result.models : [];
      setModels(models);
    } catch (error: any) {
      toast({
        title: t('error') || 'Error',
        description: error?.message || t('aiSettingsModelsLoadFailed') || 'Failed to load models',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: AiSettings) => {
      const response = await fetch('/api/admin/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || 'Failed to save AI settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast({
        title: t('settingsSaved') || 'Settings saved',
        description: t('aiSettingsUpdated') || 'AI settings updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('error') || 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      plans: {
        apiKey: plansApiKey,
        model: plansModel,
        assistantId,
      },
      chat: {
        apiKey: chatApiKey,
        model: chatModel,
      },
      foodSearch: {
        apiKey: foodApiKey,
        model: foodModel,
        promptId: foodPromptId,
        promptVersion: foodPromptVersion,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t('aiSettings') || 'AI Settings'}</CardTitle>
              <CardDescription>
                {t('aiSettingsSubtitle') || 'Configure OpenAI keys for plan generation, chat, and food search.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {data?.configured?.plans && <Badge variant="secondary">{t('aiSettingsPlansSection') || 'Plan Generation'}</Badge>}
              {data?.configured?.chat && <Badge variant="secondary">{t('aiSettingsChatSection') || 'AI Chat'}</Badge>}
              {data?.configured?.foodSearch && <Badge variant="secondary">{t('aiSettingsFoodSection') || 'Food Search'}</Badge>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('aiSettingsOpenAiOnly') || 'These settings apply to OpenAI only.'}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('aiSettingsPlansSection') || 'Plan Generation'}</h3>
              {data?.configured?.plans ? <Badge>{t('aiSettingsConfigured') || 'Configured'}</Badge> : <Badge variant="outline">{t('aiSettingsNotConfigured') || 'Not Configured'}</Badge>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('aiSettingsApiKeyLabel') || 'API Key'}</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPlansKey ? 'text' : 'password'}
                    value={plansApiKey}
                    onChange={(e) => setPlansApiKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPlansKey((prev) => !prev)}
                  >
                    {showPlansKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('aiSettingsModelLabel') || 'Model'}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => loadModels(plansApiKey, setPlanModels, setLoadingPlanModels)}
                    disabled={loadingPlanModels || plansApiKey.trim().length === 0}
                  >
                    {loadingPlanModels ? (t('aiSettingsLoadingModels') || 'Loading models...') : (t('aiSettingsLoadModels') || 'Load models')}
                  </Button>
                </div>
                <Select value={plansModel} onValueChange={setPlansModel} disabled={loadingPlanModels}>
                  <SelectTrigger>
                    <SelectValue placeholder={planModels.length ? (t('aiSettingsModelLabel') || 'Model') : (t('aiSettingsLoadModels') || 'Load models')} />
                  </SelectTrigger>
                  <SelectContent>
                    {planModels.length === 0 ? (
                      <SelectItem value="__no_models__" disabled>
                        {t('aiSettingsNoModels') || 'No models loaded. Click Load models.'}
                      </SelectItem>
                    ) : (
                      planModels.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('aiSettingsAssistantIdLabel') || 'Assistant ID'}</Label>
                <Input value={assistantId} onChange={(e) => setAssistantId(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('aiSettingsChatSection') || 'AI Chat'}</h3>
              {data?.configured?.chat ? <Badge>{t('aiSettingsConfigured') || 'Configured'}</Badge> : <Badge variant="outline">{t('aiSettingsNotConfigured') || 'Not Configured'}</Badge>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('aiSettingsApiKeyLabel') || 'API Key'}</Label>
                <div className="flex gap-2">
                  <Input
                    type={showChatKey ? 'text' : 'password'}
                    value={chatApiKey}
                    onChange={(e) => setChatApiKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowChatKey((prev) => !prev)}
                  >
                    {showChatKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('aiSettingsModelLabel') || 'Model'}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => loadModels(chatApiKey, setChatModels, setLoadingChatModels)}
                    disabled={loadingChatModels || chatApiKey.trim().length === 0}
                  >
                    {loadingChatModels ? (t('aiSettingsLoadingModels') || 'Loading models...') : (t('aiSettingsLoadModels') || 'Load models')}
                  </Button>
                </div>
                <Select value={chatModel} onValueChange={setChatModel} disabled={loadingChatModels}>
                  <SelectTrigger>
                    <SelectValue placeholder={chatModels.length ? (t('aiSettingsModelLabel') || 'Model') : (t('aiSettingsLoadModels') || 'Load models')} />
                  </SelectTrigger>
                  <SelectContent>
                    {chatModels.length === 0 ? (
                      <SelectItem value="__no_models__" disabled>
                        {t('aiSettingsNoModels') || 'No models loaded. Click Load models.'}
                      </SelectItem>
                    ) : (
                      chatModels.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('aiSettingsFoodSection') || 'Food Search'}</h3>
              {data?.configured?.foodSearch ? <Badge>{t('aiSettingsConfigured') || 'Configured'}</Badge> : <Badge variant="outline">{t('aiSettingsNotConfigured') || 'Not Configured'}</Badge>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('aiSettingsApiKeyLabel') || 'API Key'}</Label>
                <div className="flex gap-2">
                  <Input
                    type={showFoodKey ? 'text' : 'password'}
                    value={foodApiKey}
                    onChange={(e) => setFoodApiKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowFoodKey((prev) => !prev)}
                  >
                    {showFoodKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('aiSettingsModelLabel') || 'Model'}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => loadModels(foodApiKey, setFoodModels, setLoadingFoodModels)}
                    disabled={loadingFoodModels || foodApiKey.trim().length === 0}
                  >
                    {loadingFoodModels ? (t('aiSettingsLoadingModels') || 'Loading models...') : (t('aiSettingsLoadModels') || 'Load models')}
                  </Button>
                </div>
                <Select value={foodModel} onValueChange={setFoodModel} disabled={loadingFoodModels}>
                  <SelectTrigger>
                    <SelectValue placeholder={foodModels.length ? (t('aiSettingsModelLabel') || 'Model') : (t('aiSettingsLoadModels') || 'Load models')} />
                  </SelectTrigger>
                  <SelectContent>
                    {foodModels.length === 0 ? (
                      <SelectItem value="__no_models__" disabled>
                        {t('aiSettingsNoModels') || 'No models loaded. Click Load models.'}
                      </SelectItem>
                    ) : (
                      foodModels.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('aiSettingsPromptIdLabel') || 'Prompt ID'}</Label>
                <Input value={foodPromptId} onChange={(e) => setFoodPromptId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('aiSettingsPromptVersionLabel') || 'Prompt Version'}</Label>
                <Input value={foodPromptVersion} onChange={(e) => setFoodPromptVersion(e.target.value)} />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateSettingsMutation.isPending || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {updateSettingsMutation.isPending ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
