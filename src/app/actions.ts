'use server';

import {
  generatePodcastScript,
  type GeneratePodcastScriptInput,
  type ScriptLength,
  type ConversationTone, // Import ConversationTone
  type Language,    // Import Language
} from '@/ai/flows/podcast-script-generation';
import {z} from 'genkit';

// Define the schema matching the flow's input, including length, tone, and language
const GenerateScriptInputSchema = z.object({
  keyword: z.string().min(1, {message: 'Keyword cannot be empty.'}),
  length: z.enum(['short', 'medium', 'long', 'hour']).default('medium'), // Add 'hour'
  tone: z.enum([
        'neutral',
        'conversational',
        'calm',
        'friendly',
        'professional',
        'enthusiastic',
        'informative',
        'humorous',
        'empathetic',
        'upbeat'
    ]).default('conversational'), // Updated tone enum
  language: z.enum(['en', 'hi', 'es', 'fr', 'de']).default('en'), // Add es, fr, de
});

export interface GenerateScriptActionState {
  script?: string;
  error?: string;
  submittedKeyword?: string;
  submittedLength?: ScriptLength;
  submittedTone?: ConversationTone; // Use ConversationTone
  submittedLanguage?: Language; // Add submitted language
}

export async function generateScriptAction(
  prevState: GenerateScriptActionState,
  formData: FormData
): Promise<GenerateScriptActionState> {
  const validatedFields = GenerateScriptInputSchema.safeParse({
    keyword: formData.get('keyword'),
    length: (formData.get('length') as ScriptLength) || 'medium',
    tone: (formData.get('tone') as ConversationTone) || 'conversational', // Get tone from form, default if missing
    language: (formData.get('language') as Language) || 'en', // Get language from form, default if missing
  });

  if (!validatedFields.success) {
    // Combine errors if necessary
    const errors = validatedFields.error.flatten().fieldErrors;
    const keywordError = errors.keyword?.[0];
    const lengthError = errors.length?.[0];
    const toneError = errors.tone?.[0];
    const languageError = errors.language?.[0];
    const error = [keywordError, lengthError, toneError, languageError].filter(Boolean).join(' ');
    return {
      error: error || 'Invalid input.', // Fallback error message
      submittedKeyword: formData.get('keyword') as string,
      submittedLength: (formData.get('length') as ScriptLength) || 'medium',
      submittedTone: (formData.get('tone') as ConversationTone) || 'conversational',
      submittedLanguage: (formData.get('language') as Language) || 'en',
    };
  }

  const input: GeneratePodcastScriptInput = {
    keyword: validatedFields.data.keyword,
    length: validatedFields.data.length,
    tone: validatedFields.data.tone, // Pass validated tone
    language: validatedFields.data.language, // Pass validated language
  };

  try {
    console.log(`Calling generatePodcastScript with:`, input);
    const result = await generatePodcastScript(input);
    console.log(`Script generated successfully.`);
    return {
      script: result.script,
      submittedKeyword: input.keyword,
      submittedLength: input.length,
      submittedTone: input.tone,
      submittedLanguage: input.language,
    };
  } catch (error) {
    console.error('Error generating podcast script:', error);
    // Return the specific error message from the flow if available, otherwise a generic one.
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to generate script. Please try again.';
    return {
      error: errorMessage,
      submittedKeyword: input.keyword,
      submittedLength: input.length,
      submittedTone: input.tone,
      submittedLanguage: input.language,
    };
  }
}
