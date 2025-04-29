'use server';

import {
  generatePodcastScript,
  type GeneratePodcastScriptInput,
  type ScriptLength,
} from '@/ai/flows/podcast-script-generation';
import {z} from 'genkit';

// Define the schema matching the flow's input, including length
const GenerateScriptInputSchema = z.object({
  keyword: z.string().min(1, {message: 'Keyword cannot be empty.'}),
  length: z.enum(['short', 'medium', 'long']).default('medium'), // Add length with default
});

export interface GenerateScriptActionState {
  script?: string;
  error?: string;
  submittedKeyword?: string;
  submittedLength?: ScriptLength;
}

export async function generateScriptAction(
  prevState: GenerateScriptActionState,
  formData: FormData
): Promise<GenerateScriptActionState> {
  const validatedFields = GenerateScriptInputSchema.safeParse({
    keyword: formData.get('keyword'),
    length: (formData.get('length') as ScriptLength) || 'medium', // Get length from form, default if missing
  });

  if (!validatedFields.success) {
    // Combine keyword and length errors if necessary, though length should have a default
    const keywordError = validatedFields.error.flatten().fieldErrors.keyword?.[0];
    const lengthError = validatedFields.error.flatten().fieldErrors.length?.[0];
    const error = [keywordError, lengthError].filter(Boolean).join(' ');
    return {
      error: error || 'Invalid input.', // Fallback error message
      submittedKeyword: formData.get('keyword') as string,
      submittedLength: (formData.get('length') as ScriptLength) || 'medium',
    };
  }

  const input: GeneratePodcastScriptInput = {
    keyword: validatedFields.data.keyword,
    length: validatedFields.data.length, // Pass validated length
  };

  try {
    console.log(`Calling generatePodcastScript with:`, input);
    const result = await generatePodcastScript(input);
    console.log(`Script generated successfully.`);
    return {
      script: result.script,
      submittedKeyword: input.keyword,
      submittedLength: input.length,
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
    };
  }
}
