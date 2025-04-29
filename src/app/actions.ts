'use server';

import { generatePodcastScript, type GeneratePodcastScriptInput } from '@/ai/flows/podcast-script-generation';
import { z } from 'zod';

const GenerateScriptInputSchema = z.object({
  keyword: z.string().min(1, { message: 'Keyword cannot be empty.' }),
});

export interface GenerateScriptActionState {
  script?: string;
  error?: string;
}

export async function generateScriptAction(
  prevState: GenerateScriptActionState,
  formData: FormData,
): Promise<GenerateScriptActionState> {
  const validatedFields = GenerateScriptInputSchema.safeParse({
    keyword: formData.get('keyword'),
  });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors.keyword?.[0],
    };
  }

  const input: GeneratePodcastScriptInput = {
    keyword: validatedFields.data.keyword,
  };

  try {
    const result = await generatePodcastScript(input);
    return { script: result.script };
  } catch (error) {
    console.error('Error generating podcast script:', error);
    // Return the specific error message from the flow if available, otherwise a generic one.
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate script. Please try again.';
    return { error: errorMessage };
  }
}
