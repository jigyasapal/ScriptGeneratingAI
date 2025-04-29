'use client';

import type { ChangeEvent, FormEvent } from 'react';
import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Play, Square } from 'lucide-react'; // Removed Music, VolumeX
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';

export default function Home() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>(undefined);
  const [areVoicesLoaded, setAreVoicesLoaded] = useState(false);

  // Refs for Speech Synthesis
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);

  // --- Voice Loading Effect ---
  useEffect(() => {
    const populateVoiceList = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          console.warn('Speech Synthesis not supported.');
          toast({ variant: "destructive", title: "Audio Warning", description: "Text-to-speech may not work in this browser." });
          return;
        }
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
            setAvailableVoices(englishVoices);
            setAreVoicesLoaded(true);
            // Set default voice only if one hasn't been selected yet and voices are available
            if (!selectedVoiceURI && englishVoices.length > 0) {
                let defaultVoice = englishVoices.find(v => v.name.includes('Google') && v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices.find(v => v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices[0]; // Fallback to the first English voice
                if (defaultVoice) { // Ensure a voice was found before setting
                  setSelectedVoiceURI(defaultVoice.voiceURI);
                   console.log("Default voice set to:", defaultVoice?.name);
                } else {
                    console.warn("Could not find a suitable default English voice.");
                }
            }
            console.log('English voices loaded:', englishVoices.length);
        } else {
             console.log("Waiting for voices to load...");
        }
    };

    populateVoiceList();
    // Check if speechSynthesis is supported before adding the event listener
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof speechSynthesis.onvoiceschanged !== 'undefined') {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    return () => {
        // Check if speechSynthesis is supported before removing the event listener
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof speechSynthesis.onvoiceschanged !== 'undefined') {
            speechSynthesis.onvoiceschanged = null;
        }
    };
  }, [selectedVoiceURI]); // Rerun if selectedVoiceURI changes (relevant for initial load)


  // Function to stop speech synthesis
  const stopSpeechPlayback = () => {
    let stopped = false;
    // Stop Speech Synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      speechSynthesis.cancel();
      console.log('Speech synthesis cancelled.');
      stopped = true;
    }
     utteranceRef.current = null; // Clear utterance ref

    if (stopped) {
        setIsReading(false); // Update state only if something was actually stopped
    }
  };


  // Stop audio if script changes or keyword changes
  useEffect(() => {
    stopSpeechPlayback();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.script]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    stopSpeechPlayback(); // Stop any ongoing playback before generating new script
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

 const handleReadAloud = async () => {
    if (isReading) {
      console.log('Stopping speech playback...');
      stopSpeechPlayback();
      return; // Exit early if stopping
    }

    // --- Start Reading ---
    if (!state.script) {
      toast({ variant: 'destructive', title: 'Error', description: 'No script available to read.' });
      return;
    }
    if (!('speechSynthesis' in window)) {
      toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Text-to-speech is not supported in this browser.' });
      return;
    }
     if (!areVoicesLoaded) {
         toast({ variant: 'destructive', title: 'Voices Not Ready', description: 'Text-to-speech voices are still loading. Please wait a moment.' });
         return;
     }
     if (!selectedVoiceURI) {
        toast({ variant: 'destructive', title: 'Voice Not Selected', description: 'Please select a voice first.' });
        return;
     }

    console.log('Starting speech playback...');
    setIsReading(true); // Set reading state immediately

    try {

      // --- Setup and Start Speech Synthesis ---
      if (speechSynthesis.speaking) {
          console.warn("Speech synthesis was already active, cancelling previous utterance.");
          speechSynthesis.cancel(); // Cancel any previous speech
      }

      const utterance = new SpeechSynthesisUtterance(state.script);
      utteranceRef.current = utterance; // Store ref

      // Set the selected voice
      const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
      if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log(`Using selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        // Fallback logic if needed (e.g., first English voice or browser default)
        const fallbackVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
        if(fallbackVoice){
            utterance.voice = fallbackVoice;
            console.warn(`Selected voice URI "${selectedVoiceURI}" not found. Falling back to: ${fallbackVoice.name}`);
        } else {
            console.warn('No suitable English voice found. Using browser default.');
        }
      }

      // Event Handlers for Speech Synthesis
      utterance.onstart = () => {
        console.log('Speech started.');
      };

      utterance.onend = () => {
        console.log('Speech finished.');
        setIsReading(false); // Reset reading state
        utteranceRef.current = null; // Clear utterance ref
      };

      utterance.onerror = (event) => {
        const errorMsg = event.error || 'Unknown speech error';
        console.error('SpeechSynthesisUtterance.onerror:', errorMsg, event);
        toast({
          variant: 'destructive',
          title: 'Speech Error',
          description: `Could not read the script aloud: ${errorMsg}`,
        });
        stopSpeechPlayback(); // Cleanup on speech error
      };

      // Start speech
      console.log('Speaking utterance...');
      speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('Error during handleReadAloud:', error);
      toast({
        variant: 'destructive',
        title: 'Playback Error',
        description: `An error occurred trying to play audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      stopSpeechPlayback(); // Ensure cleanup happens on any error
      setIsReading(false); // Explicitly reset state on error
    }
  };


  const handleVoiceChange = (value: string) => {
      setSelectedVoiceURI(value);
      console.log("Voice selected:", value);
      // Stop playback if it's currently running with the old voice
      if (isReading) {
          stopSpeechPlayback();
          // Decide if you want to automatically start reading with the new voice.
          // Using a small delay might be necessary for the system to be ready.
          // setTimeout(handleReadAloud, 150);
      }
  };


  const isLoading = isPending || isFormPending;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-background">
      <Card className="w-full max-w-2xl shadow-lg rounded-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold text-center text-foreground">Podcast Pilot</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter a keyword, choose a voice, and let AI generate & read your podcast script.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyword" className="font-semibold text-foreground">Keyword</Label>
              <Input
                id="keyword"
                name="keyword"
                placeholder="e.g., Benefits of Meditation, Future of Space Travel"
                value={keyword}
                onChange={handleInputChange}
                required
                className="text-base rounded-md shadow-sm" // Added shadow
                disabled={isLoading}
                aria-label="Podcast topic keyword"
              />
              {state.error && !isLoading && <p className="text-sm text-destructive font-medium">{state.error}</p>}
            </div>

             {/* Voice Selection Dropdown */}
             <div className="space-y-2">
                <Label htmlFor="voice-select" className="font-semibold text-foreground">Voice</Label>
                <Select
                    value={selectedVoiceURI || ""} // Ensure value is never undefined for Select
                    onValueChange={handleVoiceChange}
                    disabled={!areVoicesLoaded || availableVoices.length === 0 || isLoading}
                    name="voice-select"
                >
                    <SelectTrigger
                        id="voice-select"
                        className="w-full rounded-md shadow-sm" // Added shadow
                        aria-label="Select reading voice"
                    >
                        <SelectValue placeholder={areVoicesLoaded && availableVoices.length > 0 ? "Select a voice..." : (areVoicesLoaded ? "No English voices found" : "Loading voices...")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-md shadow-lg">
                        {availableVoices.length > 0 ? (
                            availableVoices.map((voice) => (
                            <SelectItem key={voice.voiceURI} value={voice.voiceURI} className="cursor-pointer">
                                {voice.name} ({voice.lang})
                            </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="loading" disabled>
                            {areVoicesLoaded ? "No English voices found" : "Loading voices..."}
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
             </div>
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md shadow-md transition-all duration-200 ease-in-out transform hover:scale-105" // Enhanced styling
              disabled={isLoading || !keyword.trim()} // Disable if keyword is empty/whitespace
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

          {state.script && !state.error && ( // Only show script area if script exists and no generation error
            <div className="mt-6 space-y-2">
              <Label htmlFor="script" className="font-semibold text-foreground">Generated Script</Label>
              <div className="relative">
                <Textarea
                  id="script"
                  value={state.script}
                  readOnly
                  className="min-h-[300px] text-base bg-secondary rounded-md shadow-inner p-4 leading-relaxed" // Improved styling
                  aria-label="Generated podcast script"
                />
                 {/* Action Buttons Overlay */}
                 <div className="absolute top-2 right-2 flex items-center space-x-1 bg-background/70 backdrop-blur-sm p-1 rounded-md shadow">

                   {/* Read Aloud / Stop Button */}
                   <Button
                     variant="ghost"
                     size="icon"
                     className="text-foreground hover:bg-accent/20 disabled:opacity-50"
                     onClick={handleReadAloud}
                     aria-label={isReading ? "Stop reading script" : "Read script aloud"}
                     // Disable if voices not ready, or if generating, or no voice selected
                     disabled={isLoading || !areVoicesLoaded || availableVoices.length === 0 || !selectedVoiceURI}
                     title={isReading ? "Stop Playback" : "Read Aloud"}
                   >
                     {isReading ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                   </Button>

                    {/* Copy Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground hover:bg-accent/20 disabled:opacity-50"
                        onClick={handleCopy}
                        aria-label="Copy script to clipboard"
                        disabled={isLoading} // Disable if generating
                        title="Copy Script"
                    >
                        <Copy className="h-5 w-5" />
                    </Button>
                 </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-center pt-4">
          Powered by Generative AI
        </CardFooter>
      </Card>
    </main>
  );
}
