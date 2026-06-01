/**
 * Workout Parser Utility
 * Converts plain text workout descriptions to structured JSON format
 * 
 * Supported formats for weekly schedules:
 * Day 1
 * 1-Exercise Name 3x10
 * 2-Exercise Name 3x20
 * 
 * Day 2
 * 1-Exercise Name 3x15
 * 
 * Also supports:
 * - "Exercise Name 3x10 @ 135lbs"
 * - "Exercise Name 3 sets of 10 reps at 135"
 * - "Exercise Name 3x10 Rest: 60s"
 * - "Exercise Name - 3x10 - Rest: 60s"
 */

export interface ParsedExercise {
  name: string;
  sets: number;
  reps: string;
  rest?: string;
  weight?: string;
}

export interface ParsedWorkout {
  name: string;
  description: string;
  duration: number;
  difficulty: string;
  type: string;
  exercises: ParsedExercise[];
}

export interface DayWorkout {
  day: string;
  type: string;
  duration: string;
  exercises: string[];
  notes: string;
}

export interface WeeklySchedule {
  focus: string;
  workouts: DayWorkout[];
}

export class WorkoutParser {
  /**
   * Parse a single exercise line
   * Examples:
   *   "Bench Press 3x10 @ 135lbs Rest: 60s"
   *   "Squats - 4x8 - Rest: 90s"
   *   "Deadlifts 3 sets of 5 reps at 225lbs"
   *   "1-Bench Press 3x10"
   */
  private static parseExerciseLine(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Remove leading number if present (e.g., "1-Exercise" -> "Exercise")
    let exerciseLine = trimmed.replace(/^\d+[-.)]\s*/, '');

    // Pattern 1: "Exercise Name 3x10 @ 135lbs Rest: 60s" or "Exercise Name - 3x10 - Rest: 60s"
    let match = exerciseLine.match(/^(.+?)\s*-?\s*(\d+)\s*x\s*(\d+(?:-\d+)?)\s*(?:@|at)?\s*(\d+\s*(?:lbs?|kg)?)?\s*(?:-\s*)?(?:Rest:\s*(.+))?$/i);
    
    if (match) {
      const [, name, sets, reps, weight, rest] = match;
      const restValue = rest?.trim() || "60s";
      const weightPart = weight ? ` @ ${weight.trim()}` : "";
      return `${name.trim().replace(/\s*-\s*$/, '')} - ${sets}x${reps}${weightPart} - Rest: ${restValue}`;
    }

    // Pattern 2: "Exercise Name 3 sets of 10 reps at 135 Rest: 60s"
    match = exerciseLine.match(/^(.+?)\s+(\d+)\s*sets?\s+of\s+(\d+(?:-\d+)?)\s*reps?\s*(?:at|@)?\s*(\d+\s*(?:lbs?|kg)?)?\s*(?:Rest:\s*(.+))?$/i);
    
    if (match) {
      const [, name, sets, reps, weight, rest] = match;
      const restValue = rest?.trim() || "60s";
      const weightPart = weight ? ` @ ${weight.trim()}` : "";
      return `${name.trim()} - ${sets}x${reps}${weightPart} - Rest: ${restValue}`;
    }

    // Pattern 3: Simple format "Exercise Name 3x10"
    match = exerciseLine.match(/^(.+?)\s+(\d+)\s*x\s*(\d+(?:-\d+)?)$/i);
    
    if (match) {
      const [, name, sets, reps] = match;
      return `${name.trim()} - ${sets}x${reps} - Rest: 60s`;
    }

    return null;
  }

  /**
   * Parse weekly schedule from plain text
   * 
   * Input example:
   * ```
   * Legs
   * 1-Bench Press 3x10
   * 2-Squats 4x8
   * 
   * Chest & Triceps
   * 1-Deadlifts 3x5
   * 2-Pull-ups 3x10
   * ```
   */
  static parseWeeklySchedule(text: string, options?: {
    focus?: string;
    defaultType?: string;
  }): WeeklySchedule {
    const lines = text.trim().split('\n');
    const workouts: DayWorkout[] = [];
    let currentDay: string | null = null;
    let currentExercises: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Try to parse this line as an exercise
      const parsedExercise = this.parseExerciseLine(line);
      
      if (parsedExercise) {
        // This is a valid exercise line
        currentExercises.push(parsedExercise);
      } else {
        // This line is NOT an exercise, so it must be a day header
        // Save the previous day's workout if exists
        if (currentDay && currentExercises.length > 0) {
          const estimatedDuration = Math.ceil(currentExercises.length * 4);
          workouts.push({
            day: currentDay,
            type: options?.defaultType || "Full Body",
            duration: `${estimatedDuration} min`,
            exercises: [...currentExercises],
            notes: ""
          });
        }
        
        // Start a new day with this line as the title
        currentDay = line;
        currentExercises = [];
      }
    }

    // Don't forget the last day
    if (currentDay && currentExercises.length > 0) {
      const estimatedDuration = Math.ceil(currentExercises.length * 4);
      workouts.push({
        day: currentDay,
        type: options?.defaultType || "Full Body",
        duration: `${estimatedDuration} min`,
        exercises: [...currentExercises],
        notes: ""
      });
    }

    return {
      focus: options?.focus || "Custom weekly workout schedule",
      workouts
    };
  }

  /**
   * Parse plain text workout into structured JSON (single workout)
   * 
   * Input example:
   * ```
   * Bench Press 3x10 @ 135lbs Rest: 90s
   * Squats 4x8 @ 185lbs Rest: 120s
   * Deadlifts 3x5 @ 225lbs Rest: 120s
   * Pull-ups 3x10 Rest: 60s
   * ```
   */
  static parseWorkoutText(text: string, options?: {
    name?: string;
    description?: string;
    difficulty?: string;
    type?: string;
  }): ParsedWorkout {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const exercises: ParsedExercise[] = [];
    
    for (const line of lines) {
      const exercise = this.parseExerciseLine(line);
      if (exercise) {
        // Parse the formatted exercise string back into components
        const match = exercise.match(/^(.+?)\s*-\s*(\d+)x(\d+(?:-\d+)?)\s*(?:@\s*(.+?))?\s*-\s*Rest:\s*(.+)$/);
        if (match) {
          const [, name, sets, reps, weight, rest] = match;
          exercises.push({
            name: name.trim(),
            sets: parseInt(sets),
            reps: reps.trim(),
            rest: rest.trim(),
            ...(weight && { weight: weight.trim() })
          });
        }
      }
    }

    // Estimate duration based on exercises (average 3-5 min per exercise)
    const estimatedDuration = exercises.length > 0 ? Math.ceil(exercises.length * 4) : 30;

    return {
      name: options?.name || `Workout ${new Date().toLocaleDateString()}`,
      description: options?.description || `Custom workout with ${exercises.length} exercises`,
      duration: estimatedDuration,
      difficulty: options?.difficulty || 'intermediate',
      type: options?.type || 'strength',
      exercises: exercises
    };
  }

  /**
   * Convert ParsedExercise format to database format
   * Database expects: {name: string, sets: number, reps: string, rest: string}
   */
  static toDatabaseFormat(parsedWorkout: ParsedWorkout): any {
    return {
      name: parsedWorkout.name,
      description: parsedWorkout.description,
      duration: parsedWorkout.duration,
      difficulty: parsedWorkout.difficulty,
      type: parsedWorkout.type,
      exercises: parsedWorkout.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest || "60s"
      }))
    };
  }
}
