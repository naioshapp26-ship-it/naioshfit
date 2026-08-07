import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequiredLabel, RequiredMark } from '@/components/ui/required-mark';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DumbbellIcon, Calendar, Activity, Clock, Plus, CheckCircle, Trophy, Star, Video, Target, TrendingUp, Play, Users } from 'lucide-react';
import VideoPlayer from "@/components/ui/video-player";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays as dfnsAddDays } from 'date-fns';
import { ar as arLocale, enUS } from 'date-fns/locale';
import { formatInAppTz, dateStringForToday, parseDateStringInAppTz, formatInAppTzWithOptions } from '@/lib/timezone';
import { Badge } from '@/components/ui/badge';
import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '@/components/ui/swipeable-tabs';
import { User, UserWorkout, Workout } from '@shared/schema';
import { WorkoutParser } from '@shared/workoutParser';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import AnimatedBackground from "@/components/layout/AnimatedBackground";

// Small utility: add days to a yyyy-MM-dd string (respecting app timezone utils)
const addDaysToDateStr = (dateStr: string, delta: number) => {
  const base = parseDateStringInAppTz(dateStr);
  const next = dfnsAddDays(base, delta);
  return formatInAppTz(next, 'yyyy-MM-dd');
};

// Component to display a single exercise video
const ExerciseVideo: React.FC<{ exerciseName: string }> = ({ exerciseName }) => {
  const [youtubeVideo, setYoutubeVideo] = useState<{
    videoId: string | null;
    title: string;
    embedUrl: string | null;
    searchUrl?: string;
  } | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // Auto-fetch YouTube video on mount
  useEffect(() => {
    const fetchYoutubeVideo = async () => {
      setIsLoadingVideo(true);
      try {
        // Clean exercise name: remove rep/set info, weight info, bullets, etc.
        const cleanExerciseName = exerciseName
          .replace(/^[-•·*]\s*/, '') // Remove leading bullets
          .replace(/\s*-\s*\d+\s*sets?\s*x\s*\d+\s*reps?.*$/i, '') // Remove "- 3 sets x 12 reps"
          .replace(/\s*\(\d+\s*(kg|lbs)\)/gi, '') // Remove weight info
          .replace(/\s*-\s*\d+x\d+.*$/i, '') // Remove "- 2x8-12"
          .replace(/\b\d+\s*x\s*\d+\b/gi, '') // Remove standalone "3x10"
          .replace(/\b\d+\s*(min|minutes|s|sec|seconds)\b/gi, '') // Remove time units
          .trim();
        
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(cleanExerciseName + ' tutorial')}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setYoutubeVideo(data);
        }
      } catch (error) {
        console.error('Error fetching YouTube video:', error);
      } finally {
        setIsLoadingVideo(false);
      }
    };

    fetchYoutubeVideo();
  }, [exerciseName]);

  if (isLoadingVideo) {
    return (
      <div className="mt-2 p-3 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Loading video...</span>
        </div>
      </div>
    );
  }

  if (youtubeVideo?.embedUrl) {
    return (
      <div className="mt-2 bg-white rounded-lg overflow-hidden border border-gray-200">
        <div className="relative aspect-video w-full" style={{ minHeight: '200px' }}>
          <iframe
            src={`${youtubeVideo.embedUrl}${youtubeVideo.embedUrl.includes('?') ? '&' : '?'}fs=1&playsinline=1`}
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title={youtubeVideo.title}
            style={{ border: 0 }}
          ></iframe>
        </div>
        <div className="p-2 bg-gray-50">
          <p className="text-xs text-gray-600 truncate">
            {youtubeVideo.title}
          </p>
        </div>
      </div>
    );
  }

  if (youtubeVideo?.searchUrl) {
    return (
      <div className="mt-2 p-3 bg-gray-100 rounded-lg">
        <Button 
          variant="outline" 
          size="sm"
          className="w-full"
          onClick={() => window.open(youtubeVideo.searchUrl, '_blank')}
        >
          <Play className="h-3 w-3 mr-2" />
          Search YouTube
        </Button>
      </div>
    );
  }

  return null;
};

// Component to display videos from content library that match workout names via tags
// With YouTube fallback suggestions when no coach videos are available
const WorkoutVideos: React.FC<{ workoutName: string; userId?: number; coachId?: number }> = ({ workoutName, userId, coachId }) => {
  const { t, language } = useLanguage();
  const startWorkoutLabel = t('startWorkout') || (language === 'ar' ? 'ابدأ التمرين' : 'Start Workout');
  const [youtubeVideo, setYoutubeVideo] = useState<{
    videoId: string | null;
    title: string;
    embedUrl: string | null;
    searchUrl?: string;
  } | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const { data: coachVideos = [] } = useQuery({
    queryKey: ['/api/content-library', 'workout', workoutName, coachId],
    queryFn: async () => {
      const response = await fetch(`/api/content-library?type=video`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      const allVideos = await response.json();

      // Server already filters by coach and visibility, just filter by tags/title match

      // Utilities
  const normalizeSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();
      const toVariants = (name: string) => {
        const base = name
          .toLowerCase()
          .trim()
          .normalize('NFKC')
          .replace(/[•·]/g, '')
          .replace(/[\u2010-\u2015]/g, '-')
          .replace(/[_]+/g, ' ');
        const forms = [
          base,
          base.replace(/&/g, ' and '),
          base.replace(/&/g, ' '),
          base.replace(/[\/]/g, ' '),
        ];
        const out: string[] = [];
        for (const f of forms) {
          const cleaned = normalizeSpaces(
            f
              .replace(/\bworkout\b/gi, '')
              .replace(/\b\d+\s*(min|minutes|hour|hours|sec|seconds)\b/gi, '')
              .replace(/[^a-z0-9\s-]/g, '')
          );
          if (!cleaned) continue;
          const hyphen = cleaned.replace(/\s+/g, '-').replace(/-+/g, '-');
          const spaced = cleaned.replace(/-+/g, '-').replace(/[-_]/g, ' ');
          const noAnd = cleaned.replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim();
          const noAndHyphen = noAnd.replace(/\s+/g, '-');
          out.push(cleaned, hyphen, spaced, noAnd, noAndHyphen);
        }
        return new Set(out.filter(Boolean));
      };

  // Build candidate exact tag values with smart variants
  const candidateTags = toVariants(workoutName);

      // Filter videos by tag/title match - server already filtered by coach and visibility
      return allVideos.filter((video: any) => {
        const rawTags = Array.isArray(video.tags)
          ? video.tags
          : (typeof video.tags === 'string'
              ? video.tags.split(',')
              : []);
        const videoTags: string[] = rawTags
          .map((t: string) => String(t ?? '')
            .toLowerCase()
            .replace(/^\s*["'`]+|["'`]+\s*$/g, '') // strip surrounding quotes/backticks
            .trim())
          .filter(Boolean);

        // Exact tag match against any candidate (hyphenated or spaced variants)
        const tagMatch = videoTags.some((tag) => {
          // Normalize unicode dashes in tags and create multiple variants
          const base = (tag || '')
            .toLowerCase()
            .replace(/[\u2010-\u2015]/g, '-')
            .trim();
          const tagSpaced = base.replace(/[-_]+/g, ' ').trim();
          const tagHyphen = tagSpaced.replace(/\s+/g, '-');
          return (
            candidateTags.has(base) ||
            candidateTags.has(tagSpaced) ||
            candidateTags.has(tagHyphen)
          );
        });
        if (tagMatch) return true;

        // Fallback: match by normalized title variants if tags are missing or not exact
        const title = String(video.title || '');
        if (!title) return false;
        const titleVariants = toVariants(title);
        const titleMatch = Array.from(titleVariants).some(v => candidateTags.has(v));
        return titleMatch;
      });
    },
    enabled: !!coachId
  });

  // Fetch YouTube video when button is clicked
  const fetchYoutubeVideo = async () => {
    setIsLoadingVideo(true);
    try {
      const cleanExerciseName = workoutName
        .replace(/\s*-\s*\d+x\d+.*$/i, '')
        .replace(/\s*\(\d+\s*(kg|lbs)\)/gi, '')
        .trim();
      
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(cleanExerciseName + ' tutorial')}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setYoutubeVideo(data);
        setShowVideo(true);
      }
    } catch (error) {
      console.error('Error fetching YouTube video:', error);
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // Generate YouTube fallback if no coach videos found
  const hasCoachVideos = coachVideos.length > 0;

  // Don't show anything if user has a coach assigned (whether or not they have videos)
  if (coachId) {
    return null;
  }
  
  // Only show YouTube suggestions for users with no assigned coach
  if (!coachId && !hasCoachVideos) {
    // Continue to render YouTube fallback below
  } else {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
      <h4 className="text-lg font-medium mb-3 flex items-center gap-2 text-blue-600">
        <Video className="h-5 w-5" />
        {startWorkoutLabel}
      </h4>
      
      {!showVideo ? (
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="destructive" className="bg-red-600">YouTube</Badge>
            <span className="text-sm text-gray-600">
              Click to load video for this workout
            </span>
          </div>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={fetchYoutubeVideo}
            disabled={isLoadingVideo}
          >
            {isLoadingVideo ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Loading...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Load Workout Video
              </>
            )}
          </Button>
        </div>
      ) : youtubeVideo?.embedUrl ? (
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="relative aspect-video w-full" style={{ minHeight: '200px' }}>
            <iframe
              src={`${youtubeVideo.embedUrl}${youtubeVideo.embedUrl.includes('?') ? '&' : '?'}fs=1&playsinline=1`}
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              title={youtubeVideo.title}
              style={{ border: 0 }}
            ></iframe>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {youtubeVideo.title}
          </p>
        </div>
      ) : youtubeVideo?.searchUrl ? (
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-3">
            Unable to automatically load video. Click below to search YouTube:
          </p>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open(youtubeVideo.searchUrl, '_blank')}
          >
            <Play className="h-4 w-4 mr-2" />
            Search YouTube: "{workoutName}"
          </Button>
        </div>
      ) : null}
    </div>
  );
};

// Component to display video tutorials for specific exercises
const ExerciseVideoTutorial: React.FC<{ exerciseName: string }> = ({ exerciseName }) => {
  // Fetch content library videos that match this exercise
  const { data: videoTutorials = [] } = useQuery({
    queryKey: ['/api/content-library', 'exercise', exerciseName],
    queryFn: async () => {
      const response = await fetch(`/api/content-library`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
  const allVideos = await response.json();

      // Helper utils
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const normalizeSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();
      const normalizeWord = (w: string) => {
        let x = w.toLowerCase().trim();
        // singularize simple plurals
        if (/sses$/.test(x)) x = x.slice(0, -2); // presses -> press
        else if (/(ches|shes|xes|zes)$/.test(x)) x = x.slice(0, -2); // matches -> match, dishes -> dish
        else if (/ies$/.test(x)) x = x.slice(0, -3) + 'y'; // flies -> fly
        else if (/s$/.test(x) && x.length > 3) x = x.slice(0, -1); // triceps -> tricep, rows -> row
        // common exercise term normalizations
        const map: Record<string,string> = {
          triceps: 'tricep', tricep: 'tricep', biceps: 'bicep', bicep: 'bicep',
          delts: 'delt', deltoids: 'delt', deltoid: 'delt',
          lats: 'lat', calves: 'calf', quads: 'quad', hamstrings: 'hamstring', glutes: 'glute', abs: 'ab',
          kickbacks: 'kickback', rows: 'row', raises: 'raise', presses: 'press'
        };
        return map[x] || x;
      };
      const tokensFrom = (text: string) => {
        return text
          .toLowerCase()
          .replace(/[-_]/g, ' ')
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .map(normalizeWord)
          .filter(t => t && !['and','with','on','the','for','of','to','a','an'].includes(t));
      };
      const synonyms: Record<string,string[]> = {
        chest: ['bench','pec'],
        bench: ['chest','pec'],
        pec: ['chest','bench'],
        tricep: ['triceps'],
        bicep: ['biceps'],
        lat: ['lats'],
        delt: ['deltoid','delts'],
        hamstring: ['hamstrings'],
        quad: ['quads','quadriceps'],
        calf: ['calves'],
        kickback: ['kickbacks']
      };
      const tokenIn = (needle: string, haystack: Set<string>) => {
        if (haystack.has(needle)) return true;
        const syns = synonyms[needle] || [];
        return syns.some(s => haystack.has(normalizeWord(s)));
      };

      // Normalize and clean the exercise name (handle bullets, unicode dashes, reps/rest patterns)
      const raw = exerciseName
        .normalize('NFKC')
        .replace(/[•·]/g, '') // bullets
        .replace(/[\u2010-\u2015]/g, '-') // various unicode dashes to hyphen
        .trim();

      let cleanExerciseName = raw
        .replace(/^[-*]\s*/, '') // leading simple bullets if any
        // Remove patterns like "- 2x8-12" or "– 3x10-15"
        .replace(/\s*[–-]\s*\d+\s*x\s*\d+(\s*[–-]\s*\d+)?/gi, '')
        // Remove standalone 2x10 or 2x10-12 if not caught
        .replace(/\b\d+\s*x\s*\d+(\s*[–-]\s*\d+)?\b/gi, '')
        // Remove patterns with time units merged or spaced, e.g., "1x3min", "3min", "60s", "45 sec"
        .replace(/\b\d+\s*x\s*\d+\s*(?:min|minutes|s|sec|seconds)\b/gi, '')
        .replace(/\b\d+(?:\s*)(?:min|minutes|s|sec|seconds)\b/gi, '')
        // Remove rest info like "– Rest: 60s" or "- Rest 90s"
        .replace(/\s*[–-]?\s*rest[:\s]+\d+\s*(s|sec|seconds|m|min|minutes)?/gi, '')
        // Remove any trailing separators
        .replace(/[\-:]+\s*$/g, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      // Build candidate tag/name variants using smart variants and singular forms
      const toVariants = (name: string) => {
        const base = name
          .toLowerCase()
          .trim()
          .normalize('NFKC')
          .replace(/[•·]/g, '')
          .replace(/[\u2010-\u2015]/g, '-')
          .replace(/[_]+/g, ' ');
        const forms = [
          base,
          base.replace(/&/g, ' and '),
          base.replace(/&/g, ' '),
          base.replace(/[\\/]/g, ' '),
        ];
        const out: string[] = [];
        for (const f of forms) {
          const cleaned = normalizeSpaces(
            f
              .replace(/\bworkout\b/gi, '')
              .replace(/\b\d+\s*(min|minutes|hour|hours|sec|seconds)\b/gi, '')
              .replace(/[^a-z0-9\s-]/g, '')
          );
          if (!cleaned) continue;
          const hyphen = cleaned.replace(/\s+/g, '-').replace(/-+/g, '-');
          const spaced = cleaned.replace(/-+/g, '-').replace(/[-_]/g, ' ');
          const noAnd = cleaned.replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim();
          const noAndHyphen = noAnd.replace(/\s+/g, '-');
          out.push(cleaned, hyphen, spaced, noAnd, noAndHyphen);
        }
        return new Set(out.filter(Boolean));
      };

  const baseVariants = toVariants(cleanExerciseName);
  // Include exact single-token as a strong candidate for one-word exercises (e.g., 'plank')
  const singleWord = cleanExerciseName.split(/\s+/).filter(Boolean)[0] || '';
      const singular = cleanExerciseName.replace(/\b(\w+?)(?:es|s)\b$/, '$1');
      const singularVariants = toVariants(singular);
      const candidateTags = new Set<string>([
        ...Array.from(baseVariants),
        ...Array.from(singularVariants)
      ]);
      if (singleWord) candidateTags.add(singleWord);

      // Filter videos based on tag match; if not, fallback to title variants; require video type=video
      return allVideos.filter((video: any) => {
        const vtype = String(video.type || '').toLowerCase();
        if (vtype !== 'video') return false;

        const rawTags = Array.isArray(video.tags)
          ? video.tags
          : (typeof video.tags === 'string'
              ? video.tags.split(',')
              : []);
        const videoTags: string[] = rawTags
          .map((t: string) => t?.toLowerCase?.().trim())
          .filter(Boolean);

        const tagMatch = videoTags.some((tag) => {
          const base = (tag || '')
            .toLowerCase()
            .replace(/[\u2010-\u2015]/g, '-')
            .trim();
          const tagSpaced = base.replace(/[-_]+/g, ' ').trim();
          const tagHyphen = tagSpaced.replace(/\s+/g, '-');
          return (
            candidateTags.has(base) ||
            candidateTags.has(tagSpaced) ||
            candidateTags.has(tagHyphen)
          );
        });
        if (tagMatch) return true;

        // Fallback: match by normalized title variants if tags are missing or not exact
        const title = String(video.title || '');
        if (!title) return false;
        const titleVariants = toVariants(title);
        return Array.from(titleVariants).some(v => candidateTags.has(v));
      });
    }
  });

  if (videoTutorials.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
      <h5 className="text-sm font-medium mb-2 flex items-center gap-2 text-blue-600">
        <Video className="h-3 w-3" />
        Video Tutorial for {exerciseName}
      </h5>
      <div className="grid gap-3">
        {videoTutorials.map((video: any) => (
          <VideoPlayer
            key={video.id}
            url={video.url}
            title={video.title}
            thumbnailUrl={video.thumbnailUrl}
            className="w-full"
          />
        ))}
      </div>
    </div>
  );
};

// Component to display exercise history (last 5 completed sets)
const ExerciseHistory: React.FC<{ exerciseName: string }> = ({ exerciseName }) => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'ar' ? arLocale : enUS;

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['/api/exercise-history', exerciseName],
    queryFn: async () => {
      const response = await fetch(`/api/exercise-history/${encodeURIComponent(exerciseName)}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="mt-2 p-2 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2 text-xs text-blue-600">
          <TrendingUp className="h-3 w-3 animate-pulse" />
          <span>Loading history...</span>
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return null; // Don't show anything if there's no history
  }

  // Group sets by date and combine reps/weights
  const groupedByDate = history.reduce((acc: any, set: any) => {
    const dateKey = formatInAppTz(new Date(set.completedAt), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = {
        date: set.completedAt,
        sets: []
      };
    }
    acc[dateKey].sets.push({
      reps: set.reps,
      weight: set.weight
    });
    return acc;
  }, {});

  // Convert to array and take only the latest 5 date entries
  const groupedHistory = Object.values(groupedByDate)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
      <h5 className="text-xs font-medium mb-2 flex items-center gap-2 text-blue-700">
        <TrendingUp className="h-3 w-3" />
        {t('recentHistory') || 'Recent History'}
      </h5>
      <div className="space-y-1.5">
        {groupedHistory.map((entry: any, index: number) => (
          <div 
            key={index}
            className="bg-white rounded px-3 py-2 border border-blue-100"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <span className="text-xs text-gray-500 font-medium">
                {formatInAppTzWithOptions(new Date(entry.date), 'MMM d, yyyy', { locale: dateLocale as any })}
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                {entry.sets.map((set: any, setIndex: number) => (
                  <div key={setIndex} className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded">
                    {set.reps !== null && (
                      <span className="font-medium text-gray-700">
                        {set.reps} {t('reps') || 'reps'}
                      </span>
                    )}
                    {set.reps !== null && set.weight !== null && (
                      <span className="text-gray-400">×</span>
                    )}
                    {set.weight !== null && (
                      <span className="font-medium text-gray-700">
                        {set.weight} {t('kg') || 'kg'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Workouts: React.FC = () => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'ar' ? arLocale : enUS;
  const startWorkoutLabel = t('startWorkout') || (language === 'ar' ? 'ابدأ التمرين' : 'Start Workout');

  const buildWorkoutSessionSaveError = async (response: Response): Promise<string> => {
    let serverMessage = '';
    try {
      const body = await response.json();
      if (body && typeof body.message === 'string') {
        serverMessage = body.message;
      }
    } catch {
      // Ignore JSON parse failures and use fallbacks.
    }

    if (response.status === 402) {
      return serverMessage || (language === 'ar'
        ? 'لا يوجد رصيد كافٍ لإكمال هذا التمرين.'
        : 'You do not have enough credit balance to complete this workout.');
    }

    return serverMessage || (t('failedToSaveWorkout') || 'Failed to save workout session');
  };

  // Simple focus text localization for Arabic using keyword-based mapping
  const translateFocus = (focus: string): string => {
    if (!focus) return focus;
    if (language !== 'ar') return focus;
    // Keyword-based replacements with case-insensitive and safe word boundaries
    let out = focus;
    const repl: Array<[RegExp, string]> = [
      [/upper[-\s]?body/gi, 'الجزء العلوي من الجسم'],
      [/lower[-\s]?body/gi, 'الجزء السفلي من الجسم'],
      [/\bpush\b/gi, 'دفع'],
      [/\bpull\b/gi, 'سحب'],
      [/\blegs?\b/gi, 'الساقين'],
      [/\bposterior chain\b/gi, 'السلسلة الخلفية'],
      [/\bstrength\b/gi, 'القوة'],
      [/\bhypertrophy\b/gi, 'التضخيم العضلي'],
      [/\bendurance\b/gi, 'التحمل'],
      [/\bmobility\b/gi, 'المرونة'],
      [/\bcardio\b/gi, 'الكارديو'],
      [/full[-\s]?body/gi, 'شامل للجسم'],
      [/\bmuscles?\b/gi, 'العضلات'],
      [/\bgain\s+muscle\b/gi, 'بناء العضلات'],
      [/\bbuild\s+muscle\b/gi, 'بناء العضلات'],
      [/\bfat\s*loss\b/gi, 'حرق الدهون'],
      [/\bweight\s*loss\b/gi, 'إنقاص الوزن'],
      [/\bcutting\b/gi, 'التنشيف'],
      [/\bbulking\b/gi, 'التضخيم'],
      [/\bmaintenance\b/gi, 'الثبات'],
      [/\brest\b/gi, 'راحة'],
      [/\bupper\b/gi, 'علوي'],
      [/\blower\b/gi, 'سفلي'],
      [/\band\b/gi, 'و'],
      [/\s*&\s*/g, ' و '],
    ];
    for (const [rgx, ar] of repl) {
      out = out.replace(rgx, ar);
    }
    return out;
  };

  const localizeDay = (day: string) => {
    const key = day?.toLowerCase?.();
    switch (key) {
      case 'monday': return t('monday');
      case 'tuesday': return t('tuesday');
      case 'wednesday': return t('wednesday');
      case 'thursday': return t('thursday');
      case 'friday': return t('friday');
      case 'saturday': return t('saturday');
      case 'sunday': return t('sunday');
      default: return day;
    }
  };

  const localizeWorkoutType = (type: string) => {
    const norm = (type || '').toLowerCase();
    // Common compound labels
    if (norm.includes('full body')) return t('fullBody');
    if (norm.includes('cardio')) return t('cardio');
    if (norm.includes('strength')) return t('strength');
    // Splits and body parts
    if (norm.includes('upper')) return language === 'ar' ? 'علوي' : 'Upper';
    if (norm.includes('lower')) return language === 'ar' ? 'سفلي' : 'Lower';
    if (norm.includes('push')) return language === 'ar' ? 'دفع' : 'Push';
    if (norm.includes('pull')) return language === 'ar' ? 'سحب' : 'Pull';
    if (norm === 'leg' || norm.includes('legs')) return language === 'ar' ? 'الساقين' : 'Legs';
    if (norm.includes('rest')) return language === 'ar' ? 'راحة' : 'Rest';
    if (norm.includes('chest')) return language === 'ar' ? 'صدر' : 'Chest';
    if (norm.includes('back')) return language === 'ar' ? 'ظهر' : 'Back';
    if (norm.includes('shoulder')) return language === 'ar' ? 'أكتاف' : 'Shoulders';
    if (norm.includes('arm')) return language === 'ar' ? 'ذراعين' : 'Arms';
    if (norm.includes('core')) return language === 'ar' ? 'العضلات الأساسية' : 'Core';
    if (norm.includes('abs')) return language === 'ar' ? 'البطن' : 'Abs';
    if (norm.includes('glute')) return language === 'ar' ? 'الألوية' : 'Glutes';
    if (norm.includes('quad')) return language === 'ar' ? 'الفخذ الأمامي' : 'Quads';
    if (norm.includes('hamstring')) return language === 'ar' ? 'أوتار الركبة' : 'Hamstrings';
    if (norm.includes('calf')) return language === 'ar' ? 'السمانة' : 'Calves';
    return type;
  };

  // Map selected date to plan day number (Day 1, Day 2, ... based on weeklySchedule order)
  const getSelectedDayNumber = () => {
    const plan = userPlan?.weeklySchedule as any;
    const workouts = plan?.workouts as any[] | undefined;
    if (!workouts || workouts.length === 0) return null;
    const englishDay = formatInAppTz(parseDateStringInAppTz(selectedDate), 'EEEE');
    const idx = workouts.findIndex(w => (w?.day || '').toLowerCase() === englishDay.toLowerCase());
    return idx >= 0 ? idx + 1 : null;
  };
  
  // Get user ID from localStorage (same pattern as profile page)
  const [userId, setUserId] = useState<number | null>(() => {
    const savedUserJson = localStorage.getItem('currentUser');
    if (savedUserJson) {
      const savedUser = JSON.parse(savedUserJson);
      return savedUser.id;
    }
    return null;
  });

  // Fetch user data using the same pattern as profile page
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Error fetching user: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!userId,
    retry: false,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(dateStringForToday());
  // Allow starting any workout from the weekly schedule (manual override)
  const [manualWorkout, setManualWorkout] = useState<any | null>(null);
  const [exerciseLog, setExerciseLog] = useState<any[]>([]);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const [completionStats, setCompletionStats] = useState<{
    totalSets: number;
    completedSets: number;
    percentage: number;
  } | null>(null);
  const [showWorkoutVideos, setShowWorkoutVideos] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [logForm, setLogForm] = useState({
    workoutName: '',
    workoutType: 'strength',
    duration: 45,
    notes: ''
  });
  // Coach assign workout panel state
  const [showCoachAssignDialog, setShowCoachAssignDialog] = useState(false);
  const [coachTraineeId, setCoachTraineeId] = useState<string>('');
  const [assignCoachFilterId, setAssignCoachFilterId] = useState<string>('');
  const isWorkoutPlatformAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [coachWorkoutTitle, setCoachWorkoutTitle] = useState('');
  const [coachWorkoutFocus, setCoachWorkoutFocus] = useState('');
  const [coachWorkoutText, setCoachWorkoutText] = useState('');
  const [viewWorkoutPlan, setViewWorkoutPlan] = useState<any | null>(null);
  const [editingWorkoutPlan, setEditingWorkoutPlan] = useState<any | null>(null);

  const resetCoachAssignDialog = () => {
    setShowCoachAssignDialog(false);
    setEditingWorkoutPlan(null);
    setCoachTraineeId('');
    setAssignCoachFilterId('');
    setCoachWorkoutTitle('');
    setCoachWorkoutFocus('');
    setCoachWorkoutText('');
  };

  const scheduleToText = (schedule: any) => {
    const workouts = Array.isArray(schedule?.workouts) ? schedule.workouts : [];
    if (workouts.length === 0) return '';

    return workouts
      .map((workout: any, index: number) => {
        const dayLabel = (workout?.day && String(workout.day).trim()) || `Day ${index + 1}`;
        const exercises = Array.isArray(workout?.exercises)
          ? workout.exercises.map((exercise: any) => String(exercise ?? '').trim()).filter(Boolean)
          : [];
        return [dayLabel, ...exercises].join('\n');
      })
      .join('\n\n');
  };

  const buildWeeklyScheduleFromText = (workoutText: string, focus?: string) => {
    let weeklySchedule = WorkoutParser.parseWeeklySchedule(workoutText, {
      focus: focus || 'Custom workout schedule',
    });

    if (!weeklySchedule.workouts || weeklySchedule.workouts.length === 0) {
      const rawLines = workoutText
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (rawLines.length === 0) {
        return {
          focus: focus || 'Custom workout schedule',
          workouts: [],
        };
      }

      weeklySchedule = {
        focus: focus || 'Custom workout schedule',
        workouts: [{
          day: 'Day 1',
          type: 'Full Body',
          duration: `${Math.ceil(rawLines.length * 4)} min`,
          exercises: rawLines,
          notes: '',
        }],
      };
    }

    return weeklySchedule;
  };

  const openCreateCoachAssignDialog = () => {
    setEditingWorkoutPlan(null);
    setCoachTraineeId('');
    setCoachWorkoutTitle('');
    setCoachWorkoutFocus('');
    setCoachWorkoutText('');
    setShowCoachAssignDialog(true);
  };

  const openEditCoachAssignDialog = (plan: any) => {
    setEditingWorkoutPlan(plan);
    setCoachTraineeId(String(plan.user_id ?? plan.userId ?? ''));
    setCoachWorkoutTitle(plan.title ?? '');
    setCoachWorkoutFocus(plan.weeklySchedule?.focus ?? plan.weekly_focus ?? '');
    setCoachWorkoutText(scheduleToText(plan.weeklySchedule));
    setShowCoachAssignDialog(true);
  };

  // Date handling (UTC+3)
  const currentDayName = formatInAppTzWithOptions(
    parseDateStringInAppTz(selectedDate),
    'EEEE',
    { locale: dateLocale as any }
  );

  // Fetch available workouts
  const { data: availableWorkouts = [] } = useQuery<Workout[]>({
    queryKey: ['/api/workouts'],
    enabled: !!user
  });

  // Fetch user's scheduled workouts
  const { data: userWorkouts = [] } = useQuery<UserWorkout[]>({
    queryKey: ['/api/user-workouts'],
    enabled: !!user
  });

  // Fetch workout sessions (completed workouts)
  const { data: workoutSessions = [] } = useQuery<any[]>({
    queryKey: ['/api/workout-sessions'],
    enabled: !!user
  });

  // Fetch user's personalized plan from coach/admin (explicit fetch with credentials + user header)
  const { data: userPlan } = useQuery<any>({
    queryKey: ["/api/user-plans", { latest: true }, userId],
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (userId) headers["x-user-id"] = String(userId);
      const res = await fetch(`/api/user-plans?latest=true`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) return null;
      return res.json();
    }
  });

  // Complete workout mutation
  const completeWorkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/workout-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const message = await buildWorkoutSessionSaveError(response);
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-sessions'] });
      
      // Calculate stats for completion display
      const totalSets = exerciseLog.reduce((acc, exercise) => acc + exercise.sets.length, 0);
      const completedSets = exerciseLog.reduce((acc, exercise) => 
        acc + exercise.sets.filter((set: any) => set.completed).length, 0
      );
      const percentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
      
      setCompletionStats({ totalSets, completedSets, percentage });
      setWorkoutCompleted(true);
      
      // Clear exercise log after a delay
      setTimeout(() => {
        setExerciseLog([]);
        setWorkoutCompleted(false);
        setCompletionStats(null);
      }, 5000);
      
      toast({
        title: t("workoutCompleted"),
        description: t("workoutCompletedDesc").replace('{completedSets}', completedSets.toString()).replace('{totalSets}', totalSets.toString()).replace('{percentage}', percentage.toString()),
        duration: 5000,
      });
    },
    onError: (error: any) => {
      console.error('Error saving workout session:', error);
      toast({
        title: t("error"),
        description: error?.message || t("failedToSaveWorkout"),
        variant: "destructive",
      });
    }
  });

  // Fetch coaches (admin assigning on behalf of a coach)
  const { data: assignCoaches = [] } = useQuery<any[]>({
    queryKey: ['/api/coaches'],
    enabled: isWorkoutPlatformAdmin,
    queryFn: async () => {
      const res = await fetch('/api/coaches', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch coach's trainees (only for coaches/admins)
  const coachContextId = isWorkoutPlatformAdmin ? assignCoachFilterId : String(user?.id ?? '');
  const { data: myTrainees = [] } = useQuery<any[]>({
    queryKey: ['/api/coach/my-users', coachContextId],
    enabled: !!coachContextId && (user?.role === 'coach' || isWorkoutPlatformAdmin),
    queryFn: async () => {
      const url = isWorkoutPlatformAdmin && assignCoachFilterId
        ? `/api/coach/my-users?coachId=${assignCoachFilterId}`
        : '/api/coach/my-users';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch all plans assigned by this coach
  const { data: assignedWorkoutPlans = [], refetch: refetchAssignedWorkouts } = useQuery<any[]>({
    queryKey: ['/api/coach/assigned-plans', 'workout'],
    enabled: user?.role === 'coach' || user?.role === 'admin' || user?.role === 'super_admin',
    queryFn: async () => {
      const res = await fetch('/api/coach/assigned-plans', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      // Filter to plans that have a weeklySchedule (workout plans)
      return data.filter((p: any) => p.weeklySchedule && p.weeklySchedule.workouts?.length > 0);
    },
  });

  // Delete assigned plan
  const deleteAssignedPlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const res = await fetch(`/api/user-plans/${planId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to delete plan'); }
    },
    onSuccess: () => { refetchAssignedWorkouts(); toast({ title: t('success'), description: t('planDeleted') || 'Plan deleted.' }); },
    onError: (e: any) => toast({ title: t('error'), description: e.message, variant: 'destructive' }),
  });

  // Log a manual workout session
  const logWorkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/workout-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const message = await buildWorkoutSessionSaveError(response);
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-sessions'] });
      setShowLogDialog(false);
      setLogForm({ workoutName: '', workoutType: 'strength', duration: 45, notes: '' });
      toast({ title: t('workoutLogged') });
    },
    onError: (error: any) => {
      toast({ title: t('error'), description: error?.message || t('failedToSaveWorkout'), variant: 'destructive' });
    }
  });

  // Coach: assign workout plan to a trainee via quick-add
  const coachAssignWorkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/quick-add-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to assign workout plan');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      refetchAssignedWorkouts();
      resetCoachAssignDialog();
      toast({ title: t('success'), description: t('workoutPlanCreatedSuccess') });
    },
    onError: (err: any) => {
      toast({ title: t('error'), description: err.message || t('failedToCreateWorkout'), variant: 'destructive' });
    },
  });

  const coachUpdateWorkoutMutation = useMutation({
    mutationFn: async ({ planId, data }: { planId: number; data: any }) => {
      const response = await fetch(`/api/user-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update workout plan');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      refetchAssignedWorkouts();
      resetCoachAssignDialog();
      toast({ title: t('success'), description: t('planUpdated') || 'Plan updated successfully.' });
    },
    onError: (err: any) => {
      toast({ title: t('error'), description: err.message || 'Failed to update workout plan', variant: 'destructive' });
    },
  });

  // Get current workout for the selected date
  const getCurrentWorkout = () => {
    const currentDayName = formatInAppTz(parseDateStringInAppTz(selectedDate), 'EEEE');
    
    // First try to use saved weeklySchedule from database (same logic as admin dashboard)
    let workoutPlan = userPlan?.weeklySchedule;
    
    // Only use saved schedule from coach/admin
    // No automatic plan generation
    
    if (workoutPlan && workoutPlan.workouts) {
      // Find workout for the current day from the personalized plan
      const todayWorkout = workoutPlan.workouts.find((workout: any) => 
        workout.day === currentDayName
      );
      
      if (todayWorkout) {
        // Find a matching workout from available workouts based on type
        let matchingWorkout = null;
        
        // Try to match by workout type/name
        if (todayWorkout.type.includes('HIIT')) {
          matchingWorkout = availableWorkouts.find(w => w.name.includes('HIIT'));
        } else if (todayWorkout.type.includes('Strength')) {
          matchingWorkout = availableWorkouts.find(w => w.name.includes('Strength'));
        } else if (todayWorkout.type.includes('Cardio')) {
          matchingWorkout = availableWorkouts.find(w => w.name.includes('Cardio'));
        }
        
        // If we found a matching workout, use it; otherwise create a temporary one
        if (matchingWorkout) {
          return {
            ...matchingWorkout,
            name: todayWorkout.type,
            description: `${localizeWorkoutType(todayWorkout.type)} ${t('workoutFor')} ${currentDayName}`,
            exercises: todayWorkout.exercises ? todayWorkout.exercises.join('\n') : matchingWorkout.exercises
          };
        } else {
          // Create a workout object that matches the expected format but with null ID (for generated workouts)
          return {
            id: null, // Use null for generated workouts that shouldn't be saved to DB
            name: todayWorkout.type,
            description: `${localizeWorkoutType(todayWorkout.type)} ${t('workoutFor')} ${currentDayName}`,
            duration: parseInt(todayWorkout.duration.replace(' min', '')),
            type: todayWorkout.type.toLowerCase().includes('cardio') ? 'cardio' : 
                  todayWorkout.type.toLowerCase().includes('strength') ? 'strength' : 'other',
            exercises: todayWorkout.exercises ? todayWorkout.exercises.join('\n') : '',
            difficulty: 'intermediate'
          };
        }
      }
    }
    
    return null;
  };

  const currentWorkout = getCurrentWorkout();
  // If a user selects a workout from Weekly Schedule, use it instead of the current day workout
  // Show workout details only when user explicitly selects a workout from Weekly Schedule
  const workoutToShow = manualWorkout;

  // Initialize exercise log for a workout
  const initializeExerciseLog = (workout: any) => {
    if (!workout?.exercises) return;
    
    const exercises = workout.exercises.split('\n').filter((ex: string) => ex.trim());
    const log = exercises.map((exercise: string) => ({
      exerciseName: exercise.trim(),
      sets: Array(3).fill(null).map(() => ({
        reps: null as number | null,
        weight: null as number | null,
        duration: 0,
        completed: false
      }))
    }));
    
    setExerciseLog(log);
  };

  // Save completed workout
  const saveWorkoutSession = () => {
    const usedWorkout = workoutToShow;
    if (!usedWorkout || !user) return;

    // Calculate workout stats
    const totalSets = exerciseLog.reduce((acc, exercise) => acc + exercise.sets.length, 0);
    const completedSets = exerciseLog.reduce((acc, exercise) => 
      acc + exercise.sets.filter((set: any) => set.completed).length, 0
    );
    
    const completionPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    const sessionData = {
      userId: user.id,
      workoutId: usedWorkout.id,
      workoutName: usedWorkout.name || `${usedWorkout.type} Workout`,
      workoutType: usedWorkout.type || 'regular',
      duration: usedWorkout.duration || 30,
      totalSets,
      completedSets,
      exercises: exerciseLog,
      notes: `Completed ${usedWorkout.name} on ${formatInAppTz(parseDateStringInAppTz(selectedDate), 'EEEE, MMMM d, yyyy')} - ${completionPercentage}% completion`,
      // Persist the chosen calendar date for this session
      completedAt: parseDateStringInAppTz(selectedDate)
    };

    console.log('Saving workout session:', sessionData);
    completeWorkoutMutation.mutate(sessionData);
  };

  // Check if workout is completed for selected date
  const isWorkoutCompleted = (date: string, wk?: any) => {
    const selected = wk || workoutToShow;
    return workoutSessions.some((session: any) => {
      const sessionDate = formatInAppTz(new Date(session.completedAt), 'yyyy-MM-dd');
      // If workout has an id, compare by id; otherwise fall back to name match
      return sessionDate === date && (selected?.id ? session.workoutId === selected.id : session.workoutName === selected?.name);
    });
  };

  // Reset completion state when date changes
  useEffect(() => {
    setWorkoutCompleted(false);
    setCompletionStats(null);
    setExerciseLog([]);
  }, [selectedDate]);

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Please log in to view your workouts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Swipe to change day on the whole page header area (closure-based, no hooks)
  const daySwipe = (() => {
    let startX: number | null = null;
    let startY: number | null = null;
    const threshold = 50;
    const isFormElement = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };
    return {
      onTouchStart: (e: React.TouchEvent) => {
        if (isFormElement(e.target)) return;
        startX = e.touches[0]?.clientX ?? null;
        startY = e.touches[0]?.clientY ?? null;
      },
      onTouchEnd: (e: React.TouchEvent) => {
        if (isFormElement(e.target)) return;
        if (startX == null) return;
        const endX = e.changedTouches[0]?.clientX ?? startX;
        const endY = e.changedTouches[0]?.clientY ?? startY ?? 0;
        const dx = endX - startX;
        const dy = startY == null ? 0 : endY - startY;
        const isHorizontal = Math.abs(dx) > threshold && Math.abs(Math.abs(dx) - Math.abs(dy)) > 5 && Math.abs(dx) > Math.abs(dy) * 1.5;
        if (isHorizontal) {
          // Don't change day during an active workout to avoid losing progress
          if (exerciseLog.length === 0) {
            setSelectedDate((d) => addDaysToDateStr(d, dx < 0 ? 1 : -1));
          }
        }
        startX = null;
        startY = null;
      }
    };
  })();

  return (
    <section className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 relative min-h-screen">
      <AnimatedBackground />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('workouts')}</h1>
          <p className="text-muted-foreground">{t('trackFitnessJourney')}</p>
        </div>
        <Button onClick={() => setShowLogDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('logWorkout')}
        </Button>
      </div>

      {/* Coach Tools: Trainee Workout Plan Assignment (only for coaches/admins) */}
      {(user?.role === 'coach' || user?.role === 'admin' || user?.role === 'super_admin') && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <DumbbellIcon className="h-5 w-5 text-blue-600" />
                {t('coachTraineeTools')}
              </div>
              <Button size="sm" onClick={openCreateCoachAssignDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t('assignWorkoutPlan')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {assignedWorkoutPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">{t('noAssignedWorkoutPlans') || 'No workout plans assigned yet.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">{t('trainee') || 'Trainee'}</th>
                      <th className="pb-2 pr-3 font-medium">{t('planTitle') || 'Plan'}</th>
                      <th className="pb-2 pr-3 font-medium hidden sm:table-cell">{t('weeklyFocus') || 'Focus'}</th>
                      <th className="pb-2 pr-3 font-medium hidden sm:table-cell">{t('days') || 'Days'}</th>
                      <th className="pb-2 pr-3 font-medium hidden md:table-cell">{t('created') || 'Created'}</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedWorkoutPlans.map((plan: any) => (
                      <tr key={plan.id} className="border-b last:border-0 hover:bg-blue-50/60">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="font-medium truncate max-w-[100px]">
                              {plan.trainee_first_name && plan.trainee_last_name
                                ? `${plan.trainee_first_name} ${plan.trainee_last_name}`
                                : plan.trainee_username || `User #${plan.user_id ?? plan.userId}`}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="truncate max-w-[120px] block">{plan.title}</span>
                        </td>
                        <td className="py-2 pr-3 hidden sm:table-cell text-muted-foreground">
                          {plan.weeklySchedule?.focus || plan.weekly_focus || '—'}
                        </td>
                        <td className="py-2 pr-3 hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1">
                            <DumbbellIcon className="h-3.5 w-3.5 text-blue-500" />
                            {plan.weeklySchedule?.workouts?.length ?? 0}d
                          </span>
                        </td>
                        <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground text-xs">
                          {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewWorkoutPlan(plan)}
                              className="h-7 px-2 text-xs"
                            >
                              {t('view') || 'View'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditCoachAssignDialog(plan)}
                              className="h-7 px-2 text-xs"
                            >
                              {t('edit') || 'Edit'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteAssignedPlanMutation.mutate(plan.id)}
                              disabled={deleteAssignedPlanMutation.isPending}
                              className="h-7 px-2 text-xs"
                            >
                              {t('delete') || 'Delete'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 border-t border-blue-200/70 pt-2 text-xs text-muted-foreground">
              {language === 'ar' ? (
                <p>
                  للحصول على تحكم كامل انتقل إلى{' '}
                  <a href="/coach" className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">coach</a>
                </p>
              ) : (
                <p>
                  For Full Control Go to{' '}
                  <a href="/coach" className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">Coach</a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date Selection */}
  <Card className="overflow-hidden" {...daySwipe}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Calendar className="h-5 w-5" />
            {t('workoutCalendar')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, -1))} aria-label="Previous day">
              ‹
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md text-base"
            />
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, 1))} aria-label="Next day">
              ›
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2 truncate">
            {t('selected')} {(() => {
              const n = getSelectedDayNumber();
              const dayLabel = n ? `${t('day')} ${n}` : formatInAppTzWithOptions(parseDateStringInAppTz(selectedDate), 'EEEE', { locale: dateLocale as any });
              const dateLabel = formatInAppTzWithOptions(parseDateStringInAppTz(selectedDate), 'MMMM d, yyyy', { locale: dateLocale as any });
              return `${dayLabel}, ${dateLabel}`;
            })()}
          </p>
          {/* Swipe gesture hint intentionally minimal to avoid localization needs */}
        </CardContent>
      </Card>

  {/* Workout details (only after selecting Start from Weekly Schedule) */}
  {workoutToShow ? (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DumbbellIcon className="h-5 w-5" />
                  {manualWorkout
                    ? `${t('workoutFor')} ${(() => { const n = getSelectedDayNumber(); const dayPart = n ? `${t('day')} ${n}` : formatInAppTzWithOptions(parseDateStringInAppTz(selectedDate), 'EEEE', { locale: dateLocale as any }); const datePart = formatInAppTzWithOptions(parseDateStringInAppTz(selectedDate), 'MMMM d', { locale: dateLocale as any }); return `${dayPart}, ${datePart}`; })()}`
                    : (selectedDate === dateStringForToday() 
                      ? `${t("todaysWorkout")} (${(() => { const n = getSelectedDayNumber(); return n ? `${t('day')} ${n}` : currentDayName; })()})`
                      : `${t("workoutFor")} ${(() => { const n = getSelectedDayNumber(); const dayPart = n ? `${t('day')} ${n}` : formatInAppTzWithOptions(parseDateStringInAppTz(selectedDate), 'EEEE', { locale: dateLocale as any }); const datePart = formatInAppTzWithOptions(parseDateStringInAppTz(selectedDate), 'MMMM d', { locale: dateLocale as any }); return `${dayPart}, ${datePart}`; })()}`)
                  }
                </div>
                {isWorkoutCompleted(selectedDate, workoutToShow) && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('completed')}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {(() => {
                  const n = getSelectedDayNumber();
                  if (!workoutToShow?.description) return null;
                  if (!n) return workoutToShow.description;
                  // Replace 'for <day>' and '(from <day>)' segments with Day N
                  return workoutToShow.description
                    .replace(/(for)\s+[^,]+$/i, `$1 ${t('day')} ${n}`)
                    .replace(/\(\s*from\s+[^)]+\)/i, `(${t('from') || 'from'} ${t('day')} ${n})`);
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exerciseLog.length === 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{workoutToShow.duration} {t('minutes')}</span>
                    </div>
                    <Badge variant="secondary">{workoutToShow.type}</Badge>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{t('exercises')}:</h4>
                      {!user?.coachId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowWorkoutVideos(!showWorkoutVideos)}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          {showWorkoutVideos ? t('hideVideos') : startWorkoutLabel}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(typeof workoutToShow.exercises === 'string' ? workoutToShow.exercises.split('\n') : []).filter((ex: string) => ex.trim()).map((exercise: string, index: number) => (
                        <div key={index} className="border-l-2 border-gray-200 pl-3">
                          <p className="text-sm text-gray-700 font-medium">• {exercise.trim()}</p>
                          <ExerciseVideoTutorial exerciseName={exercise.trim()} />
                          {showWorkoutVideos && (
                            <ExerciseVideo exerciseName={exercise.trim()} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {((workoutToShow as any)?.workoutTips) && (
                    <div>
                      <h4 className="font-medium mb-2">{t('trainingGuidelines')}:</h4>
                      <div className="space-y-1">
                        {String((workoutToShow as any).workoutTips)
                          .split('\n')
                          .filter((tip: string) => tip.trim())
                          .map((tip: string, index: number) => (
                            <p key={index} className="text-sm text-gray-600">• {tip.trim()}</p>
                          ))}
                      </div>
                    </div>
                  )}



                  <div className="flex justify-center mt-6">
                    <Button 
                      onClick={() => initializeExerciseLog(workoutToShow)}
                      className="w-full max-w-md bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-6 text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      size="lg"
                    >
                      <DumbbellIcon className="h-5 w-5 mr-2" />
                      {t('startWorkout')}
                    </Button>
                  </div>
                </div>
              ) : workoutCompleted && completionStats ? (
                <div className="text-center py-8 space-y-6">
                  <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <Trophy className="h-10 w-10 text-green-600" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold text-green-600 mb-2">{t('workoutCompleted')}</h3>
                    <p className="text-gray-600 mb-4">{t('progressSaved')}</p>
                    
                    <div className="flex justify-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{completionStats.completedSets}</div>
                        <div className="text-gray-500">{t('sets')} {t('completed')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{completionStats.percentage}%</div>
                        <div className="text-gray-500">{t('completion')}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{workoutToShow.duration}{t('minutesShort') || 'min'}</div>
                        <div className="text-gray-500">{t('duration')}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center gap-2">
                    {Array.from({ length: Math.min(5, Math.floor(completionStats.percentage / 20)) }).map((_, i) => (
                      <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  
                  <p className="text-sm text-gray-500">{t('progressSaved')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Progress Indicator */}
                  {(() => {
                    const totalSets = exerciseLog.reduce((acc, exercise) => acc + exercise.sets.length, 0);
                    const completedSets = exerciseLog.reduce((acc, exercise) => 
                      acc + exercise.sets.filter((set: any) => set.completed).length, 0
                    );
                    const progressPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
                    
                    return (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium text-blue-700">{t('workoutProgress')}</h4>
                          <span className="text-sm font-medium text-blue-600">
                            {completedSets}/{totalSets} {t('sets')} ({progressPercentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })()}

                  {exerciseLog.map((exerciseData, exerciseIndex) => {
                    const swipe = (() => {
                      let startX: number | null = null;
                      let startY: number | null = null;
                      const threshold = 50;
                      const isFormElement = (el: EventTarget | null) => {
                        if (!(el instanceof HTMLElement)) return false;
                        const tag = el.tagName.toLowerCase();
                        return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
                      };
                      return {
                        onTouchStart: (e: React.TouchEvent) => {
                          if (isFormElement(e.target)) return;
                          startX = e.touches[0]?.clientX ?? null;
                          startY = e.touches[0]?.clientY ?? null;
                        },
                        onTouchEnd: (e: React.TouchEvent) => {
                          if (isFormElement(e.target)) return;
                          if (startX == null) return;
                          const endX = e.changedTouches[0]?.clientX ?? startX;
                          const endY = e.changedTouches[0]?.clientY ?? startY ?? 0;
                          const dx = endX - startX;
                          const dy = startY == null ? 0 : endY - startY;
                          const isHorizontal = Math.abs(dx) > threshold && Math.abs(Math.abs(dx) - Math.abs(dy)) > 5 && Math.abs(dx) > Math.abs(dy) * 1.5;
                          if (isHorizontal) {
                            if (dx < 0) {
                              const next = Math.min(exerciseLog.length - 1, exerciseIndex + 1);
                              document.getElementById(`exercise-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            } else {
                              const prev = Math.max(0, exerciseIndex - 1);
                              document.getElementById(`exercise-${prev}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }
                          startX = null;
                          startY = null;
                        }
                      };
                    })();
                    return (
                      <div key={exerciseIndex} id={`exercise-${exerciseIndex}`} className="p-4 bg-gray-50 rounded-lg transition-all duration-300" {...swipe}>
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-medium mb-3 flex-1">{exerciseData.exerciseName}</h4>
                          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{exerciseIndex + 1}/{exerciseLog.length}</span>
                          </div>
                        </div>

                        {/* Exercise Video Tutorial */}
                        <ExerciseVideoTutorial exerciseName={exerciseData.exerciseName} />

                        {/* Exercise History */}
                        <ExerciseHistory exerciseName={exerciseData.exerciseName} />

                        <div className="space-y-2 mt-4">
                          {exerciseData.sets.map((set: any, setIndex: number) => (
                            <div
                              key={setIndex}
                              className={`p-2 rounded border transition-all duration-300 ${
                                set.completed
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className={`grid grid-cols-2 gap-3 items-center sm:flex sm:items-center sm:gap-4 ${language === 'ar' ? 'sm:flex-row-reverse' : ''}`}>
                                <span className="col-span-2 sm:col-span-1 text-sm font-medium">
                                  {t('set')} {setIndex + 1}
                                </span>

                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs whitespace-nowrap">{t('reps')}:</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    placeholder=""
                                    className="w-full max-w-[110px] h-11 sm:h-8 px-2 border rounded text-sm bg-white transition-colors text-center"
                                    value={set.reps ?? ''}
                                    onChange={(e) => {
                                      const newLog = [...exerciseLog];
                                      newLog[exerciseIndex].sets[setIndex].reps = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                      setExerciseLog(newLog);
                                    }}
                                  />
                                </div>

                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs whitespace-nowrap">{t('exerciseWeight')}:</span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.5"
                                    placeholder=""
                                    className="w-full max-w-[120px] h-11 sm:h-8 px-2 border rounded text-sm bg-white transition-colors text-center"
                                    value={set.weight ?? ''}
                                    onChange={(e) => {
                                      const newLog = [...exerciseLog];
                                      newLog[exerciseIndex].sets[setIndex].weight = e.target.value === '' ? null : parseFloat(e.target.value);
                                      setExerciseLog(newLog);
                                    }}
                                  />
                                  <span className="text-xs text-gray-500">{t('kg') || 'kg'}</span>
                                </div>

                                <div className={`col-span-2 flex items-center gap-2 ${language === 'ar' ? 'sm:mr-auto' : 'sm:ml-auto'}`}>
                                  <input
                                    type="checkbox"
                                    checked={set.completed}
                                    onChange={() => {
                                      const newLog = [...exerciseLog];
                                      newLog[exerciseIndex].sets[setIndex].completed = !set.completed;
                                      setExerciseLog(newLog);
                                    }}
                                    className="w-5 h-5 sm:w-4 sm:h-4 accent-green-600"
                                  />
                                  <span className={`text-xs transition-colors ${set.completed ? 'text-green-600 font-medium' : ''}`}>
                                    {set.completed ? `✓ ${t('done')}` : t('done')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Swipe hints */}
                        <div className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
                          ← {t('previous') || 'Prev'} · {t('next') || 'Next'} →
                        </div>
                      </div>
                    );
                  })}

                  {/* Sticky bottom action on mobile */}
                  <div className="h-16 sm:h-0"></div>
                  <div className="fixed bottom-3 left-3 right-3 sm:static sm:mt-0 sm:bottom-auto sm:left-auto sm:right-auto">
                    <Button 
                      onClick={saveWorkoutSession} 
                      className="w-full bg-green-600 hover:bg-green-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                      disabled={completeWorkoutMutation.isPending}
                    >
                      {completeWorkoutMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {t('saving')}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {t('completeWorkout')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Your Personalized Workout Plan */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t("personalizedWorkoutPlan")}
            </CardTitle>
            <CardDescription>
              {t('customizedByCoach')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              // Use saved weeklySchedule from database created by coach/admin
              let plan = userPlan?.weeklySchedule;
              let daysPerWeek = userPlan?.goals?.workoutDays || 0;
              let actualUser = user;
              let trainingGuidelines: string[] = [];
              
              // Only use plans created by coach/admin
              if (!plan || !plan.workouts || !Array.isArray(plan.workouts)) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="h-12 w-12 mx-auto mb-4 opacity-50 flex items-center justify-center">
                      <span className="text-2xl">🏋️</span>
                    </div>
                    <p className="text-lg font-medium mb-2">{t('noWorkoutPlanAssigned')}</p>
                    <p>{t('coachWillCreatePlan')}</p>
                  </div>
                );
              }
              
              // For coach-created schedules, generate default training guidelines
              trainingGuidelines = [
                "Rest 48-72 hours between intense sessions",
                "Stay hydrated throughout your workout",
                "Focus on proper form over speed",
                "Listen to your body and adjust intensity as needed"
              ];

              return (
                <div className="space-y-6">
                  {/* Plan Overview */}
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">{t('yourPlanFocus') || 'Your Plan Focus'}</h4>
                    <p className="text-sm text-muted-foreground">{translateFocus(String(plan.focus || ''))}</p>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {daysPerWeek} {t('daysPerWeek') || 'days/week'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-4 w-4" />
                        {actualUser.fitnessGoal}
                      </span>
                    </div>
                    {/* Brief weekly days summary */}
                    {Array.isArray(plan.workouts) && plan.workouts.length > 0 && (
                      <div className="mt-4 grid gap-1 text-sm text-muted-foreground">
                        {plan.workouts.map((w: any, idx: number) => {
                          const label = w?.type || w?.day || '';
                          // Prefer localized type; fallback to day label
                          const typeOrDay = label
                            ? localizeWorkoutType(String(label))
                            : (w?.day ? localizeDay(String(w.day)) : '');
                          return (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{t('day')} {idx + 1}</span>
                              <span className="truncate max-w-[70%] text-right">{typeOrDay || '-'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Weekly Schedule */}
                  <div>
                    <h4 className="font-semibold mb-3">{t("weeklySchedule")}</h4>
                    <div className="space-y-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
                      {plan.workouts.map((workout: any, index: number) => {
                        const typeStr = String(workout.type || '').toLowerCase();
                        const isRest = /(^|\b)rest(\b|$)/i.test(typeStr) || /راحة/.test(typeStr) || /(^|\b)off(\b|$)/i.test(typeStr);
                        
                        return (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg min-w-[260px] snap-start">
                            <div className="flex justify-between items-center mb-3">
                              <div>
                                <span className="font-medium">{t('day')} {index + 1}</span>
                                <div className="text-sm text-muted-foreground">{localizeWorkoutType(workout.type)}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">{workout.duration}</span>
                                {!isRest && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const tempWorkout = {
                                        id: null,
                                        name: workout.type,
                                        description: `${localizeWorkoutType(workout.type)} ${t('workout') || 'workout'} (${t('from') || 'from'} ${t('day')} ${index + 1})`,
                                        duration: parseInt(String(workout.duration).replace(/\D+/g, '')) || 30,
                                        type: workout.type.toLowerCase().includes('cardio') ? 'cardio' : (workout.type.toLowerCase().includes('strength') ? 'strength' : 'other'),
                                        exercises: Array.isArray(workout.exercises) ? workout.exercises.join('\n') : (workout.exercises || ''),
                                        difficulty: 'intermediate'
                                      };
                                      setManualWorkout(tempWorkout);
                                      setExerciseLog([]);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                  >
                                    {t('chooseThisWorkout')}
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              {workout.exercises?.map((exercise: string, exerciseIndex: number) => (
                                <div key={exerciseIndex} className="flex items-start gap-2">
                                  <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                                  <span>{exercise}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
      
      {/* Workout History */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('workoutHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workoutSessions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{t('noWorkoutHistoryYet')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...workoutSessions]
                  .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                  .slice(0, 20)
                  .map((session: any) => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{session.workoutName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatInAppTzWithOptions(new Date(session.completedAt), 'EEEE, MMMM d yyyy', { locale: dateLocale as any })}
                          {session.duration ? ` · ${session.duration} ${t('minutes')}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {session.completedSets != null && session.totalSets != null && session.totalSets > 0 && (
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {session.completedSets}/{session.totalSets} sets
                          </Badge>
                        )}
                        <Badge variant="secondary" className="capitalize text-xs">{session.workoutType || 'workout'}</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />

      {/* Coach Assign Workout Dialog */}
      {(user?.role === 'coach' || user?.role === 'admin' || user?.role === 'super_admin') && (
        <Dialog
          open={showCoachAssignDialog}
          onOpenChange={(open) => {
            if (!open) {
              resetCoachAssignDialog();
              return;
            }
            setShowCoachAssignDialog(true);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DumbbellIcon className="h-5 w-5" />
                {editingWorkoutPlan ? (t('edit') || 'Edit') : t('assignWorkoutPlan')}
              </DialogTitle>
              <DialogDescription>{t('quickAddWeeklyWorkoutDesc')}</DialogDescription>
              <p className="text-xs text-muted-foreground">{t('requiredFieldsMarked')}</p>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {isWorkoutPlatformAdmin && (
                <div className="space-y-2">
                  <RequiredLabel>{t('selectCoach')}</RequiredLabel>
                  <Select
                    value={assignCoachFilterId}
                    onValueChange={(value) => {
                      setAssignCoachFilterId(value);
                      setCoachTraineeId('');
                    }}
                    disabled={!!editingWorkoutPlan}
                  >
                    <SelectTrigger><SelectValue placeholder={t('selectCoachPlaceholder')} /></SelectTrigger>
                    <SelectContent>
                      {assignCoaches.map((coach: any) => (
                        <SelectItem key={coach.id} value={String(coach.id)}>
                          {coach.firstName} {coach.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <RequiredLabel>{t('selectTrainee')}</RequiredLabel>
                <Select
                  value={coachTraineeId}
                  onValueChange={setCoachTraineeId}
                  disabled={!!editingWorkoutPlan || (isWorkoutPlatformAdmin && !assignCoachFilterId)}
                >
                  <SelectTrigger><SelectValue placeholder={t('selectTrainee')} /></SelectTrigger>
                  <SelectContent>
                    {myTrainees.map((tr: any) => (
                      <SelectItem key={tr.id} value={String(tr.id)}>
                        {tr.firstName} {tr.lastName} ({tr.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {coachContextId && myTrainees.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('noTraineesAssignedToCoach')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="coachPlanTitle">{t('planTitle')}</Label>
                <Input id="coachPlanTitle" value={coachWorkoutTitle} onChange={e => setCoachWorkoutTitle(e.target.value)} placeholder={t('planTitle')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coachPlanFocus">{t('weeklyFocus')}</Label>
                <Input id="coachPlanFocus" value={coachWorkoutFocus} onChange={e => setCoachWorkoutFocus(e.target.value)} placeholder={t('weeklyFocusPlaceholder')} />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="coachWorkoutText">{t('workoutScheduleText')}</RequiredLabel>
                <Textarea
                  id="coachWorkoutText"
                  value={coachWorkoutText}
                  onChange={e => setCoachWorkoutText(e.target.value)}
                  placeholder={t('workoutScheduleTextPlaceholder')}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">{t('quickAddWeeklyWorkoutTip')}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetCoachAssignDialog}>{t('cancel')}</Button>
              <Button
                disabled={
                  (isWorkoutPlatformAdmin && !assignCoachFilterId) ||
                  !coachTraineeId ||
                  !coachWorkoutText.trim() ||
                  coachAssignWorkoutMutation.isPending ||
                  coachUpdateWorkoutMutation.isPending
                }
                onClick={() => {
                  if (editingWorkoutPlan?.id) {
                    const weeklySchedule = buildWeeklyScheduleFromText(
                      coachWorkoutText.trim(),
                      coachWorkoutFocus.trim() || undefined,
                    );

                    const workoutDays = Array.isArray(weeklySchedule.workouts) ? weeklySchedule.workouts.length : 0;
                    const avgDuration = weeklySchedule.workouts?.[0]?.duration || '45 minutes';

                    coachUpdateWorkoutMutation.mutate({
                      planId: editingWorkoutPlan.id,
                      data: {
                        title: coachWorkoutTitle.trim() || undefined,
                        weeklyFocus: coachWorkoutFocus.trim() || undefined,
                        weeklySchedule,
                        goals: {
                          workoutDays,
                          workoutDuration: avgDuration,
                        },
                      },
                    });
                    return;
                  }

                  coachAssignWorkoutMutation.mutate({
                    userId: parseInt(coachTraineeId),
                    workoutText: coachWorkoutText.trim(),
                    title: coachWorkoutTitle.trim() || undefined,
                    focus: coachWorkoutFocus.trim() || undefined,
                  });
                }}
              >
                {(coachAssignWorkoutMutation.isPending || coachUpdateWorkoutMutation.isPending)
                  ? '...'
                  : (editingWorkoutPlan ? (t('save') || 'Save') : t('assignWorkoutPlan'))}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Assigned Workout Plan Dialog */}
      {(user?.role === 'coach' || user?.role === 'admin' || user?.role === 'super_admin') && (
        <Dialog open={!!viewWorkoutPlan} onOpenChange={(open) => !open && setViewWorkoutPlan(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewWorkoutPlan?.title || (t('planDetails') || 'Plan Details')}</DialogTitle>
              <DialogDescription>
                {viewWorkoutPlan?.weeklySchedule?.focus || viewWorkoutPlan?.weekly_focus || ''}
              </DialogDescription>
            </DialogHeader>

            {viewWorkoutPlan && (
              <div className="space-y-4 py-2 text-sm">
                <div>
                  <p className="font-medium mb-2">{t('weeklySchedule') || 'Weekly Schedule'}</p>
                  {Array.isArray(viewWorkoutPlan.weeklySchedule?.workouts) && viewWorkoutPlan.weeklySchedule.workouts.length > 0 ? (
                    <div className="space-y-3">
                      {viewWorkoutPlan.weeklySchedule.workouts.map((workout: any, idx: number) => (
                        <div key={idx} className="rounded border p-3">
                          <p className="font-medium">{workout.day || `${t('day') || 'Day'} ${idx + 1}`}</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            {workout.type || 'Workout'} • {workout.duration || '—'}
                          </p>
                          {Array.isArray(workout.exercises) && workout.exercises.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                              {workout.exercises.map((exercise: string, exIdx: number) => (
                                <li key={exIdx}>{exercise}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground">—</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewWorkoutPlan(null)}>{t('close') || 'Close'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Log Workout Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DumbbellIcon className="h-5 w-5" />
              {t('logWorkout')}
            </DialogTitle>
            <DialogDescription>{t('requiredFieldsMarked')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="workoutName">{t('workoutName')}</RequiredLabel>
              <Input
                id="workoutName"
                value={logForm.workoutName}
                onChange={e => setLogForm(f => ({ ...f, workoutName: e.target.value }))}
                placeholder={t('workoutName')}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel>{t('workoutType')}</RequiredLabel>
              <Select
                value={logForm.workoutType}
                onValueChange={val => setLogForm(f => ({ ...f, workoutType: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">{t('strength')}</SelectItem>
                  <SelectItem value="cardio">{t('cardio')}</SelectItem>
                  <SelectItem value="flexibility">{t('flexibility')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="duration">{t('duration')} ({t('minutes')})</RequiredLabel>
              <Input
                id="duration"
                type="number"
                min={1}
                value={logForm.duration}
                onChange={e => setLogForm(f => ({ ...f, duration: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logNotes">{t('notes')}</Label>
              <Textarea
                id="logNotes"
                value={logForm.notes}
                onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogDialog(false)}>{t('cancel')}</Button>
            <Button
              disabled={!logForm.workoutName.trim() || logWorkoutMutation.isPending}
              onClick={() => logWorkoutMutation.mutate({
                workoutName: logForm.workoutName.trim(),
                workoutType: logForm.workoutType,
                duration: logForm.duration,
                notes: logForm.notes,
                completedAt: parseDateStringInAppTz(selectedDate)
              })}
            >
              {logWorkoutMutation.isPending ? '...' : t('logWorkout')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Workouts;