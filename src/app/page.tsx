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
import { Copy, Loader2, Music, Play, Square, VolumeX } from 'lucide-react'; // Removed Settings2 and Popover imports
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';

export default function Home() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>(undefined);
  const [areVoicesLoaded, setAreVoicesLoaded] = useState(false);
  const [isMusicLoaded, setIsMusicLoaded] = useState(false); // Track music loading status

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
            const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
            setAvailableVoices(englishVoices);
            setAreVoicesLoaded(true);
            if (!selectedVoiceURI && englishVoices.length > 0) {
                let defaultVoice = englishVoices.find(v => v.name.includes('Google') && v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices.find(v => v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices[0];
                setSelectedVoiceURI(defaultVoice.voiceURI);
                console.log("Default voice set to:", defaultVoice?.name);
            }
            console.log('Voices loaded:', englishVoices.length);
        } else {
             console.log("Waiting for voices to load...");
        }
    };

    populateVoiceList();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    return () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            speechSynthesis.onvoiceschanged = null;
        }
    };
  }, []); // Run only once on mount

  // --- Background Music Loading Effect ---
  useEffect(() => {
    let isMounted = true;
    const loadMusic = async () => {
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
         console.warn('Web Audio API is not supported in this browser.');
         toast({ variant: "destructive", title: "Audio Warning", description: "Background music may not work in this browser." });
         return;
      }

      try {
        console.log('Fetching background music (/background-music.mp3)...');
        // Add cache-busting query param? might not be needed if server handles it
        const response = await fetch('/background-music.mp3');
        if (!response.ok) {
            console.error(`Music file fetch failed: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to fetch music file (${response.status}). Ensure 'public/background-music.mp3' exists.`);
        }
         // Check content type? response.headers.get('content-type')?.includes('audio/mpeg')
        const arrayBuffer = await response.arrayBuffer();

         if (!isMounted) return; // Avoid processing if component unmounted

        // Create or resume the main audio context *here* if possible, or ensure it's ready before decoding
         if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
             if (AudioContext) {
                 audioContextRef.current = new AudioContext();
            } else {
                 throw new Error("Web Audio API not available.");
            }
        }
         if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        console.log('Decoding audio data...');
        // Use the persistent audio context for decoding
        audioContextRef.current.decodeAudioData(arrayBuffer)
          .then(buffer => {
            if (isMounted) {
              audioBufferRef.current = buffer;
              setIsMusicLoaded(true); // Set music loaded state
              console.log('Background music loaded and decoded successfully.');
            }
          })
          .catch(decodeError => {
             console.error('Error decoding audio data:', decodeError);
             if (isMounted) {
                 toast({
                   variant: 'destructive',
                   title: 'Audio Decode Error',
                   description: `Failed to decode background music: ${decodeError.message}. File might be corrupted or unsupported.`,
                 });
             }
          });

      } catch (error) {
         if(isMounted){
            console.error('Error loading background music:', error);
            toast({
              variant: 'destructive',
              title: 'Audio Load Error',
              description: `Failed to load background music: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
            setIsMusicLoaded(false); // Ensure state reflects failure
            audioBufferRef.current = null;
         }
      }
    };

    loadMusic();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log('Cleaning up audio resources (on unmount)...');
      stopAudioPlayback(); // Stop any ongoing playback
      // Close the audio context only when the component truly unmounts
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(err => console.error("Error closing AudioContext:", err));
          audioContextRef.current = null;
          console.log("AudioContext closed.");
      }
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // Function to stop audio playback and cleanup associated nodes
  const stopAudioPlayback = () => {
    let stopped = false;
    // Stop Speech Synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      speechSynthesis.cancel();
      console.log('Speech synthesis cancelled.');
      stopped = true;
    }
     utteranceRef.current = null; // Clear utterance ref

    // Stop Web Audio Music Source Node
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect(); // Disconnect from gain node
        console.log('Background music source stopped and disconnected.');
      } catch (error) {
        // Ignore errors like "Cannot call stop more than once"
        if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
            console.warn('Error during audio source stop/disconnect:', error);
        }
      }
      audioSourceRef.current = null;
      stopped = true;
    }
     // Disconnect Gain Node from destination
     if (gainNodeRef.current) {
        gainNodeRef.current.disconnect(); // Disconnect from context destination
        gainNodeRef.current = null; // Clear gain node ref
        console.log('Gain node disconnected.');
     }

    if (stopped) {
        setIsReading(false); // Update state only if something was actually stopped
    }
  };


  // Stop audio if script changes or keyword changes
  useEffect(() => {
    stopAudioPlayback();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.script]);


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
    if (isReading) {
      console.log('Stopping playback...');
      stopAudioPlayback();
      return; // Exit early if stopping
    }

    // --- Start Reading ---
    if (!state.script) {
      toast({ variant: 'destructive', title: 'Error', description: 'No script available to read.' });
      return;
    }
    if (!('speechSynthesis' in window) || (!window.AudioContext && !(window as any).webkitAudioContext)) {
      toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Audio playback (TTS or background music) is not fully supported in this browser.' });
      return;
    }
    if (!isMusicLoaded && audioBufferRef.current === null) {
        toast({ variant: 'destructive', title: 'Audio Not Ready', description: 'Background music is still loading or failed to load. Please wait or try refreshing.' });
        // Optionally try to load music again here? Or just inform the user.
        return;
    }
     if (!areVoicesLoaded) {
         toast({ variant: 'destructive', title: 'Voices Not Ready', description: 'Text-to-speech voices are still loading. Please wait a moment.' });
         return;
     }

    console.log('Starting playback...');
    setIsReading(true); // Set reading state immediately

    try {
      // 1. --- Ensure Audio Context is Running ---
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        console.log('Recreating AudioContext...');
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if(!AudioContext) throw new Error("Web Audio API not supported");
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === 'suspended') {
          console.log('Resuming suspended AudioContext...');
          await audioContextRef.current.resume();
      }

      // 2. --- Setup and Start Background Music ---
      if (audioBufferRef.current) { // Only proceed if buffer is loaded
          // Cleanup previous nodes if they exist (redundant safety check)
          if (audioSourceRef.current) {
              try { audioSourceRef.current.stop(); audioSourceRef.current.disconnect(); } catch (e) { /* ignore */ }
              audioSourceRef.current = null;
          }
          if (gainNodeRef.current) {
              gainNodeRef.current.disconnect();
              gainNodeRef.current = null;
          }

          // Create new nodes
           if (!audioContextRef.current) throw new Error("AudioContext lost before node creation"); // Should not happen
          audioSourceRef.current = audioContextRef.current.createBufferSource();
          audioSourceRef.current.buffer = audioBufferRef.current;
          audioSourceRef.current.loop = true;

          gainNodeRef.current = audioContextRef.current.createGain();
          // Set initial volume based on mute state
          gainNodeRef.current.gain.setValueAtTime(isMusicMuted ? 0 : 0.25, audioContextRef.current.currentTime); // Lower default volume

          // Connect nodes: Source -> Gain -> Destination
          audioSourceRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);

          console.log('Starting background music...');
          audioSourceRef.current.start(0); // Start playback now
      } else {
          console.warn("Music buffer not available, skipping music playback.");
          // Optionally inform user music won't play
          // toast({ title: "Music Warning", description: "Background music could not be played." });
      }

      // 3. --- Setup and Start Speech Synthesis ---
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
        // setIsReading(true); // Already set at the beginning
      };

      utterance.onend = () => {
        console.log('Speech finished.');
        // Don't stop music here automatically, let the user control it.
        // If music should stop, call stopAudioPlayback() here.
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
        stopAudioPlayback(); // Cleanup on speech error
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
      stopAudioPlayback(); // Ensure cleanup happens on any error
      setIsReading(false); // Explicitly reset state on error
    }
  };


  const handleToggleMusicMute = () => {
    if (!gainNodeRef.current || !audioContextRef.current) {
        console.warn("Cannot toggle mute: Gain node or AudioContext not available.");
        // Optionally inform user if music isn't playing?
        return;
    }

    const newMuteState = !isMusicMuted;
    setIsMusicMuted(newMuteState);

    // Use setTargetAtTime for smooth volume transition
    const targetVolume = newMuteState ? 0 : 0.25; // Consistent with initial volume
    const transitionTime = 0.05; // Short fade duration
    gainNodeRef.current.gain.setTargetAtTime(targetVolume, audioContextRef.current.currentTime, transitionTime);

    console.log(`Music ${newMuteState ? 'muted' : 'unmuted'}. Target volume: ${targetVolume}`);
  };


  const handleVoiceChange = (value: string) => {
      setSelectedVoiceURI(value);
      console.log("Voice selected:", value);
      // Stop playback if it's currently running with the old voice
      if (isReading) {
          stopAudioPlayback();
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
                    value={selectedVoiceURI}
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
                                {voice.name} ({voice.lang}) {voice.localService ? '' : ''} {/* Simplified label */}
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
                     aria-label={isReading ? "Stop reading script" : "Read script aloud with background music"}
                     // Disable if music/voices not ready, or if generating
                     disabled={isLoading || !areVoicesLoaded || !isMusicLoaded}
                     title={isReading ? "Stop Playback" : "Read Aloud with Music"}
                   >
                     {isReading ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                   </Button>

                   {/* Mute Button - Only enable when reading */}
                   <Button
                     variant="ghost"
                     size="icon"
                     className="text-foreground hover:bg-accent/20 disabled:opacity-50"
                     onClick={handleToggleMusicMute}
                     aria-label={isMusicMuted ? "Unmute background music" : "Mute background music"}
                     disabled={!isReading} // Only allow mute/unmute while actively reading
                     title={isMusicMuted ? "Unmute Music" : "Mute Music"}
                   >
                     {isMusicMuted ? <VolumeX className="h-5 w-5" /> : <Music className="h-5 w-5" />}
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
