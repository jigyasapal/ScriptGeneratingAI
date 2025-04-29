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
import { Copy, Loader2, Music, Play, Square, VolumeX, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Import Popover

export default function Home() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false); // State for muting music
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>(undefined);
  const [areVoicesLoaded, setAreVoicesLoaded] = useState(false); // Track voice loading

  // Refs for Web Audio API
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null); // Ref for volume control

  // Refs for Speech Synthesis
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);

  // --- Voice Loading Effect ---
  useEffect(() => {
    const populateVoiceList = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          console.warn('Speech Synthesis not supported.');
          return;
        }
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            // Filter for potentially higher quality / non-local voices if desired
            const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
            setAvailableVoices(englishVoices);
            setAreVoicesLoaded(true);
            // Set a default voice if none selected
            if (!selectedVoiceURI && englishVoices.length > 0) {
                 // Try to find a suitable default (e.g., Google US English)
                let defaultVoice = englishVoices.find(v => v.name.includes('Google') && v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices.find(v => v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices[0]; // Fallback to the first English voice
                setSelectedVoiceURI(defaultVoice.voiceURI);
                console.log("Default voice set to:", defaultVoice.name);
            }
            console.log('Voices loaded:', englishVoices.length);
        }
    };

    // Check immediately
    populateVoiceList();

    // Check again when voices change (important for some browsers)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    // Cleanup
    return () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            speechSynthesis.onvoiceschanged = null;
        }
    };
  }, [selectedVoiceURI]); // Rerun if selectedVoiceURI changes? No, only on mount.

  // --- Background Music Loading Effect ---
  useEffect(() => {
    const loadMusic = async () => {
      try {
        if (!window.AudioContext && !(window as any).webkitAudioContext) {
           console.warn('Web Audio API is not supported in this browser.');
           toast({ variant: "destructive", title: "Audio Error", description: "Background music requires a modern browser." });
           return;
        }

        console.log('Fetching background music...');
        const response = await fetch('/background-music.mp3');
        if (!response.ok) {
            console.error(`Music file fetch failed: ${response.status} ${response.statusText}`);
            throw new Error(`Music file not found or fetch failed (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();

        const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('Decoding audio data...');
        audioBufferRef.current = await tempAudioContext.decodeAudioData(arrayBuffer);
        await tempAudioContext.close();
        console.log('Background music loaded successfully.');

      } catch (error) {
        console.error('Error loading background music:', error);
        toast({
          variant: 'destructive',
          title: 'Audio Load Error',
          description: `Failed to load background music: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        audioBufferRef.current = null;
      }
    };

    loadMusic();

    // Cleanup audio resources on unmount
    return () => {
      console.log('Cleaning up audio resources...');
      stopAudioPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // Function to stop audio playback and cleanup
  const stopAudioPlayback = () => {
    // Stop Speech Synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      speechSynthesis.cancel();
      console.log('Speech synthesis cancelled.');
    }
     utteranceRef.current = null;

    // Stop Web Audio Music
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        console.log('Background music stopped and disconnected.');
      } catch (error) {
        console.warn('Ignoring error during audio source stop/disconnect:', error);
      }
      audioSourceRef.current = null;
    }
     if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
     }
    setIsReading(false); // Update state after stopping everything
  };


  // Stop audio if script changes
  useEffect(() => {
    stopAudioPlayback();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.script]); // Dependency on state.script


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

 const handleReadAloud = async () => {
    if (!state.script) {
      toast({ variant: 'destructive', title: 'Error', description: 'No script available to read.' });
      return;
    }
    if (!('speechSynthesis' in window) || !('AudioContext' in window || 'webkitAudioContext' in window)) {
      toast({ variant: 'destructive', title: 'Error', description: 'Audio playback (TTS or background music) is not fully supported in this browser.' });
      return;
    }

    if (isReading) {
      // --- Stop Reading ---
      console.log('Stopping playback...');
      stopAudioPlayback();
    } else {
      // --- Start Reading ---
      console.log('Starting playback...');

      // 1. --- Initialize Web Audio API for Music (if not already) ---
      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          console.log('Creating new AudioContext...');
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if(!AudioContext) throw new Error("Web Audio API not supported");
          audioContextRef.current = new AudioContext();
        }
        if (audioContextRef.current.state === 'suspended') {
            console.log('Resuming suspended AudioContext...');
            await audioContextRef.current.resume();
        }

        if (!audioBufferRef.current) {
          toast({ variant: 'destructive', title: 'Audio Error', description: 'Background music buffer not loaded yet. Please wait or try refreshing.' });
          console.warn('Audio buffer is not loaded.');
        } else {
            if (audioSourceRef.current) {
                try { audioSourceRef.current.stop(); audioSourceRef.current.disconnect(); } catch (e) { console.warn("Error stopping previous audio source:", e)}
                 audioSourceRef.current = null;
            }
             if (gainNodeRef.current) {
                 gainNodeRef.current.disconnect(); gainNodeRef.current = null;
            }

            console.log('Setting up audio source and gain node...');
            if (!audioContextRef.current) throw new Error("AudioContext lost");
            audioSourceRef.current = audioContextRef.current.createBufferSource();
            audioSourceRef.current.buffer = audioBufferRef.current;
            audioSourceRef.current.loop = true;

            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.setValueAtTime(isMusicMuted ? 0 : 0.3, audioContextRef.current.currentTime);

            audioSourceRef.current.connect(gainNodeRef.current);
            gainNodeRef.current.connect(audioContextRef.current.destination);

            console.log('Starting background music...');
            audioSourceRef.current.start(0);
        }

      } catch (error) {
        console.error('Error setting up Web Audio:', error);
        toast({ variant: 'destructive', title: 'Audio Setup Error', description: `Failed to initialize background music: ${error instanceof Error ? error.message : 'Unknown error'}` });
        stopAudioPlayback();
        return;
      }

      // 2. --- Initialize Speech Synthesis ---
      try {
        console.log('Setting up speech synthesis...');
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(state.script);
        utteranceRef.current = utterance;

        // Set the selected voice
        const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log(`Using selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
        } else if (availableVoices.length > 0 && !selectedVoiceURI) {
             // Fallback to the previously set default if selection is somehow lost
             const defaultVoice = availableVoices.find(v => v.name.includes('Google') && v.lang === 'en-US') || availableVoices.find(v => v.lang === 'en-US') || availableVoices[0];
             if(defaultVoice) {
                utterance.voice = defaultVoice;
                console.warn('Selected voice not found, falling back to default:', defaultVoice.name);
             } else {
                 console.warn('Could not find any suitable English voice. Using browser default.');
             }
        } else {
          console.warn('No specific voice selected or available. Using browser default.');
        }


        // Event Handlers for Speech Synthesis
        utterance.onstart = () => {
          console.log('Speech started.');
          setIsReading(true);
        };

        utterance.onend = () => {
          console.log('Speech finished.');
          setIsReading(false);
          utteranceRef.current = null;
          // Optional: stop music when speech ends
          // stopAudioPlayback();
        };

        utterance.onerror = (event) => {
          // Log the specific error object if available
          const errorMsg = event.error || 'Unknown speech error';
          console.error('SpeechSynthesisUtterance.onerror:', errorMsg, event);
          toast({
            variant: 'destructive',
            title: 'Speech Error',
            description: `Could not read the script aloud: ${errorMsg}`,
          });
          stopAudioPlayback(); // Cleanup on speech error
        };

        // Start speech
        console.log('Speaking utterance...');
        speechSynthesis.speak(utterance);

      } catch (error) {
        console.error('Error setting up speech synthesis:', error);
        toast({
          variant: 'destructive',
          title: 'Speech Setup Error',
          description: `Failed to initialize text-to-speech: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        stopAudioPlayback();
      }
    }
  };

  const handleToggleMusicMute = () => {
    if (!gainNodeRef.current || !audioContextRef.current) return;

    const newMuteState = !isMusicMuted;
    setIsMusicMuted(newMuteState);

    const targetVolume = newMuteState ? 0 : 0.3;
    gainNodeRef.current.gain.setTargetAtTime(targetVolume, audioContextRef.current.currentTime, 0.01);

    console.log(`Music ${newMuteState ? 'muted' : 'unmuted'}`);
  };

  const handleVoiceChange = (value: string) => {
      setSelectedVoiceURI(value);
      console.log("Voice selected:", value);
      // Stop playback if it's currently running with the old voice
      if (isReading) {
          stopAudioPlayback();
          // Maybe automatically start reading with the new voice?
          // setTimeout(handleReadAloud, 100); // Small delay
      }
  };


  const isLoading = isPending || isFormPending;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-background">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Podcast Pilot</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter a keyword, choose a voice, and let AI generate & read your podcast script.
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
             {/* Voice Selection Dropdown */}
             <div className="space-y-2">
                <Label htmlFor="voice-select" className="font-semibold">Voice</Label>
                <Select
                    value={selectedVoiceURI}
                    onValueChange={handleVoiceChange}
                    disabled={!areVoicesLoaded || availableVoices.length === 0 || isLoading}
                    name="voice-select" // Added name for potential form handling
                    // id="voice-select" // Redundant if label htmlFor points to it
                >
                    <SelectTrigger id="voice-select" className="w-full" aria-label="Select reading voice">
                        <SelectValue placeholder={areVoicesLoaded ? "Select a voice..." : "Loading voices..."} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableVoices.length > 0 ? (
                            availableVoices.map((voice) => (
                            <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                                {voice.name} ({voice.lang}) {voice.localService ? '(Local)' : ''}
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
                  className="min-h-[300px] text-base bg-secondary"
                  aria-label="Generated podcast script"
                />
                {/* Action Buttons */}
                 <div className="absolute top-2 right-2 flex space-x-1">

                   {/* Mute Button */}
                   <Button
                     variant="ghost"
                     size="icon"
                     className="text-muted-foreground hover:text-foreground"
                     onClick={handleToggleMusicMute}
                     aria-label={isMusicMuted ? "Unmute background music" : "Mute background music"}
                     disabled={!isReading} // Only allow mute/unmute while playing
                     title={isMusicMuted ? "Unmute Music" : "Mute Music"}
                   >
                     {isMusicMuted ? <VolumeX className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                   </Button>

                   {/* Read Aloud / Stop Button */}
                   <Button
                     variant="ghost"
                     size="icon"
                     className="text-muted-foreground hover:text-foreground"
                     onClick={handleReadAloud}
                     aria-label={isReading ? "Stop reading script" : "Read script aloud with background music"}
                     disabled={isLoading || !areVoicesLoaded} // Disable if loading script or voices
                     title={isReading ? "Stop Playback" : "Read Aloud with Music"}
                   >
                     {isReading ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                   </Button>

                    {/* Copy Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={handleCopy}
                        aria-label="Copy script to clipboard"
                        disabled={isLoading}
                        title="Copy Script"
                    >
                        <Copy className="h-4 w-4" />
                    </Button>

                    {/* Settings/Voice Popover - Optional */}
                     {/*
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" title="Playback Settings">
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                <h4 className="font-medium leading-none">Playback Settings</h4>
                                <p className="text-sm text-muted-foreground">
                                    Adjust voice and other settings.
                                </p>
                                </div>
                                <div className="grid gap-2">
                                     <Label htmlFor="voice-popover-select">Voice</Label>
                                     <Select
                                        value={selectedVoiceURI}
                                        onValueChange={handleVoiceChange}
                                        disabled={!areVoicesLoaded || availableVoices.length === 0 || isLoading}
                                    >
                                        <SelectTrigger id="voice-popover-select" className="w-full">
                                            <SelectValue placeholder={areVoicesLoaded ? "Select a voice..." : "Loading voices..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                             {availableVoices.length > 0 ? (
                                                availableVoices.map((voice) => (
                                                <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                                                    {voice.name} ({voice.lang}) {voice.localService ? '(Local)' : ''}
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

                            </div>
                        </PopoverContent>
                     </Popover>
                    */}

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
