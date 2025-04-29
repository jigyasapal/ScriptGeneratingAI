'use client';

import type { ChangeEvent, FormEvent } from 'react';
import React, { useState, useTransition, useRef, useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Loader2, Play, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';

export default function Home() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);

  // Function to stop audio playback and cleanup
  const stopAudioPlayback = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsReading(false);
    utteranceRef.current = null; // Clear ref when stopping
  };

  // Cleanup speech synthesis on component unmount
  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop audio if script changes or component unmounts
  useEffect(() => {
    stopAudioPlayback();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.script]); // Dependency on state.script ensures playback stops if a new script is generated

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    stopAudioPlayback(); // Stop any ongoing playback before generating new script
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
        description: 'Text-to-speech is not supported, or no script available.',
      });
      return;
    }

    if (isReading) {
      stopAudioPlayback();
    } else {
      // Start reading
      try {
        // --- Initialize Speech Synthesis ---
        const utterance = new SpeechSynthesisUtterance(state.script);
        utteranceRef.current = utterance; // Store utterance ref

        // Attempt to select a suitable voice (example: English, non-local)
        const voices = speechSynthesis.getVoices();
        // Ensure voices are loaded (sometimes they load async)
        if (voices.length === 0) {
             // Wait for voices to load - common issue
            speechSynthesis.onvoiceschanged = () => {
                handleReadAloud(); // Retry after voices load
                speechSynthesis.onvoiceschanged = null; // Remove listener after first call
            };
            return; // Exit for now, will retry
        }

        let preferredVoice = voices.find(voice => voice.lang.startsWith('en') && !voice.localService);
        if (!preferredVoice) {
           preferredVoice = voices.find(voice => voice.lang.startsWith('en')); // Fallback to any English voice
        }
        if(preferredVoice) {
            utterance.voice = preferredVoice;
            console.log(`Using voice: ${preferredVoice.name} (${preferredVoice.lang})`);
        } else {
            console.warn("Could not find a preferred English voice.");
        }

        // Adjust pitch and rate for a more podcast-like feel (optional)
        // utterance.pitch = 1.1; // Slightly higher pitch
        // utterance.rate = 0.95; // Slightly slower rate

        utterance.onstart = () => {
            console.log('Speech started.');
            setIsReading(true);
        };

        utterance.onend = () => {
          console.log('Speech has finished.');
          stopAudioPlayback(); // Cleanup when speech ends naturally
        };

        utterance.onerror = (event) => {
          console.error('SpeechSynthesisUtterance.onerror', event.error);
          toast({
            variant: 'destructive',
            title: 'Speech Error',
            description: `Could not read the script aloud: ${event.error || 'Unknown error'}`,
          });
          stopAudioPlayback(); // Cleanup on error
        };

        // Start speech
        speechSynthesis.speak(utterance);
        // Note: setIsReading(true) is now called in onstart handler

      } catch (error) {
        console.error('Error setting up speech synthesis:', error);
        toast({
          variant: 'destructive',
          title: 'Speech Setup Error',
          description: 'Failed to initialize text-to-speech.',
        });
        stopAudioPlayback(); // Cleanup if setup fails
      }
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
                  className="min-h-[300px] text-base bg-secondary" // Removed whitespace-pre-wrap from here, added it to component definition
                  aria-label="Generated podcast script"
                />
                <div className="absolute top-2 right-2 flex space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleReadAloud}
                    aria-label={isReading ? "Stop reading script" : "Read script aloud"}
                    disabled={isLoading} // Only disable if loading
                    title={isReading ? "Stop Playback" : "Read Aloud"}
                  >
                    {isReading ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleCopy}
                    aria-label="Copy script to clipboard"
                    disabled={isLoading}
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
