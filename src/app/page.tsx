'use client';

import type { ChangeEvent, FormEvent } from 'react';
import React, { useState, useTransition, useRef, useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Loader2, Play, Square } from 'lucide-react'; // Added Play and Square icons
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';

export default function Home() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false); // State for text-to-speech
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null); // Ref to store utterance

  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);

  // Cleanup speech synthesis on component unmount or when script changes
  useEffect(() => {
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        setIsReading(false);
      }
    };
  }, [state.script]); // Depend on script change to stop previous reading

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Stop any ongoing speech synthesis before generating new script
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setIsReading(false);
    }
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  const handleCopy = () => {
    if (state.script) {
      navigator.clipboard.writeText(state.script)
        .then(() => {
          toast({
            title: 'Success!',
            description: 'Script copied to clipboard.',
          });
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to copy script.',
          });
        });
    }
  };

  const handleReadAloud = () => {
    if (!state.script || !('speechSynthesis' in window)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Text-to-speech is not supported or no script available.',
      });
      return;
    }

    if (isReading) {
      // Stop reading
      speechSynthesis.cancel();
      setIsReading(false);
    } else {
      // Start reading
      // Ensure previous utterance is stopped if any state mismatch occurred
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(state.script);
      utteranceRef.current = utterance; // Store utterance in ref

      utterance.onend = () => {
        setIsReading(false);
        utteranceRef.current = null; // Clear ref on end
        console.log('Speech has finished.');
      };

      utterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        setIsReading(false);
        utteranceRef.current = null; // Clear ref on error
        toast({
          variant: 'destructive',
          title: 'Speech Error',
          description: 'Could not read the script aloud.',
        });
      };

      speechSynthesis.speak(utterance);
      setIsReading(true);
    }
  };

  const isLoading = isPending || isFormPending;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-background">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Podcast Pilot</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter a keyword and let AI generate your next podcast script.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyword" className="font-semibold">Keyword</Label>
              <Input
                id="keyword"
                name="keyword"
                placeholder="e.g., Artificial Intelligence, Travel Tips"
                value={keyword}
                onChange={handleInputChange}
                required
                className="text-base"
                disabled={isLoading}
              />
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            </div>
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              disabled={isLoading || !keyword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Script'
              )}
            </Button>
          </form>

          {state.script && (
            <div className="mt-6 space-y-2">
              <Label htmlFor="script" className="font-semibold">Generated Script</Label>
              <div className="relative">
                <Textarea
                  id="script"
                  value={state.script}
                  readOnly
                  className="min-h-[300px] text-base leading-relaxed bg-secondary"
                  aria-label="Generated podcast script"
                />
                <div className="absolute top-2 right-2 flex space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleReadAloud}
                    aria-label={isReading ? "Stop reading script" : "Read script aloud"}
                    disabled={isLoading} // Disable while generating
                  >
                    {isReading ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleCopy}
                    aria-label="Copy script to clipboard"
                    disabled={isLoading} // Disable while generating
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-center">
          Powered by AI
        </CardFooter>
      </Card>
    </main>
  );
}
