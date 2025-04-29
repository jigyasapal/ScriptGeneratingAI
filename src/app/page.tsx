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

  // Refs for Web Audio API
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null); // Cache decoded audio buffer

  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);

  // Function to stop audio playback and cleanup
  const stopAudioPlayback = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    if (musicSourceRef.current) {
      try {
        musicSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped or context closed
      }
      musicSourceRef.current.disconnect();
      musicSourceRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error); // Close context
      audioContextRef.current = null;
    }
    setIsReading(false);
    utteranceRef.current = null;
  };

  // Load background music
  useEffect(() => {
    const loadMusic = async () => {
      try {
        // NOTE: Replace with an actual path to your music file
        // We cannot add binary files, so this is a placeholder path.
        // Ensure you have a `public/background-music.mp3` file.
        const response = await fetch('/background-music.mp3');
        if (!response.ok) throw new Error('Music file not found');
        const arrayBuffer = await response.arrayBuffer();
        const tempAudioContext = new AudioContext(); // Use temporary context for decoding
        audioBufferRef.current = await tempAudioContext.decodeAudioData(arrayBuffer);
        tempAudioContext.close(); // Close temporary context
        console.log('Background music loaded successfully.');
      } catch (error) {
        console.error('Failed to load background music:', error);
        // Optionally notify user that music won't play
        // toast({ variant: 'destructive', title: 'Audio Error', description: 'Could not load background music.' });
      }
    };
    loadMusic();

    // Cleanup function
    return () => {
      stopAudioPlayback(); // Ensure everything stops on unmount
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Load music once on mount

  // Stop audio if script changes
  useEffect(() => {
    stopAudioPlayback();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.script]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    stopAudioPlayback(); // Stop any ongoing playback
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
    if (!state.script || !('speechSynthesis' in window) || !('AudioContext' in window)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Text-to-speech or Web Audio is not supported, or no script available.',
      });
      return;
    }

    if (isReading) {
      stopAudioPlayback();
    } else {
      // Start reading
      try {
        // --- Initialize Audio Context and Nodes ---
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioContext();
        }
        const audioCtx = audioContextRef.current;

        // Create Gain Node for volume control
        gainNodeRef.current = audioCtx.createGain();
        gainNodeRef.current.gain.setValueAtTime(0.15, audioCtx.currentTime); // Lower volume for background music
        gainNodeRef.current.connect(audioCtx.destination);

        // Create and play music source if buffer is loaded
        if (audioBufferRef.current) {
          musicSourceRef.current = audioCtx.createBufferSource();
          musicSourceRef.current.buffer = audioBufferRef.current;
          musicSourceRef.current.loop = true;
          musicSourceRef.current.connect(gainNodeRef.current);
          musicSourceRef.current.start(0);
        } else {
          console.warn('Audio buffer not ready, music will not play.');
          // Optionally inform user music isn't ready
        }

        // --- Initialize Speech Synthesis ---
        const utterance = new SpeechSynthesisUtterance(state.script);
        utteranceRef.current = utterance;

        // Attempt to select a suitable voice (example: English, non-local)
        const voices = speechSynthesis.getVoices();
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


        utterance.onend = () => {
          console.log('Speech has finished.');
          stopAudioPlayback(); // Stop music and cleanup when speech ends naturally
        };

        utterance.onerror = (event) => {
          console.error('SpeechSynthesisUtterance.onerror', event.error);
          toast({
            variant: 'destructive',
            title: 'Speech Error',
            description: `Could not read the script aloud: ${event.error}`,
          });
          stopAudioPlayback(); // Stop music and cleanup on error
        };

        // Start speech
        speechSynthesis.speak(utterance);
        setIsReading(true);

      } catch (error) {
        console.error('Error setting up audio playback:', error);
        toast({
          variant: 'destructive',
          title: 'Audio Setup Error',
          description: 'Failed to initialize audio playback.',
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
                  className="min-h-[300px] text-base leading-relaxed bg-secondary whitespace-pre-wrap" // Added whitespace-pre-wrap
                  aria-label="Generated podcast script"
                />
                <div className="absolute top-2 right-2 flex space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleReadAloud}
                    aria-label={isReading ? "Stop reading script" : "Read script aloud"}
                    disabled={isLoading || (!audioBufferRef.current && !isReading)} // Disable if music isn't loaded (unless already playing)
                    title={!audioBufferRef.current ? "Background music loading..." : (isReading ? "Stop Playback" : "Play with Music")}
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
