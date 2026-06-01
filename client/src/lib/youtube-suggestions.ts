/**
 * Utility to generate YouTube search URLs for exercise suggestions
 */

export interface YouTubeVideoSuggestion {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  source: 'youtube';
}

/**
 * Generate YouTube search URL for an exercise name
 */
export function getYouTubeSearchUrl(exerciseName: string): string {
  const query = encodeURIComponent(`${exerciseName} exercise tutorial`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

/**
 * Generate YouTube suggestions for an exercise
 * Since we don't have a YouTube API key, we'll generate intelligent search URLs
 */
export function generateYouTubeSuggestions(exerciseName: string): YouTubeVideoSuggestion[] {
  // Clean up exercise name
  const cleanName = exerciseName
    .replace(/\s*-\s*\d+x\d+.*$/i, '') // Remove rep/set info like "- 3x10"
    .replace(/\s*\(\d+\s*(kg|lbs)\)/gi, '') // Remove weight info
    .trim();

  // Generate multiple search variations
  const searchVariations = [
    `${cleanName} proper form`,
    `${cleanName} tutorial`,
    `${cleanName} how to`,
  ];

  return searchVariations.map((query, index) => ({
    id: `yt-${index}-${Date.now()}`,
    title: query,
    url: getYouTubeSearchUrl(cleanName),
    thumbnailUrl: '', // No thumbnail without API
    source: 'youtube' as const,
  }));
}

/**
 * Extract exercise names from a workout plan
 */
export function extractExerciseNames(workoutPlan: any): string[] {
  const exercises = new Set<string>();

  try {
    if (workoutPlan?.weeklySchedule?.workouts) {
      for (const workout of workoutPlan.weeklySchedule.workouts) {
        if (Array.isArray(workout.exercises)) {
          for (const exercise of workout.exercises) {
            const exerciseName = typeof exercise === 'string' 
              ? exercise.split('-')[0].trim() 
              : exercise?.name?.trim();
            
            if (exerciseName) {
              exercises.add(exerciseName);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting exercise names:', error);
  }

  return Array.from(exercises);
}
