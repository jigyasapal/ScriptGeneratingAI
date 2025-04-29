
'use client';

import type { ChangeEvent, FormEvent } from 'react';
import React, { useState, useTransition, useRef, useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider"; // Import Slider
import { Copy, Loader2, Play, Square, Volume2, VolumeX } from 'lucide-react'; // Added Volume icons
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';
import type { ScriptLength } from '@/ai/flows/podcast-script-generation';

export default function Home() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [selectedLength, setSelectedLength] = useState<ScriptLength>('medium');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>(undefined);
  const [areVoicesLoaded, setAreVoicesLoaded] = useState(false);
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState<number>(0.1); // Initial low volume
  const [fontSize, setFontSize] = useState<number>(16); // Initial font size in pixels

  // Refs for Audio and Speech Synthesis
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const musicSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainNodeRef = useRef<GainNode | null>(null);


  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);


   // --- Web Audio API Initialization ---
   const initializeAudioContext = () => {
     if (typeof window !== 'undefined' && !audioContextRef.current && 'AudioContext' in window) {
        try {
             audioContextRef.current = new AudioContext();
             musicGainNodeRef.current = audioContextRef.current.createGain();
             musicGainNodeRef.current.gain.setValueAtTime(backgroundMusicVolume, audioContextRef.current.currentTime);
             musicGainNodeRef.current.connect(audioContextRef.current.destination);
             console.log('AudioContext initialized and GainNode created.');
        } catch (error) {
             console.error("Error creating AudioContext:", error);
             toast({ variant: "destructive", title: "Audio Error", description: "Could not initialize audio playback features." });
        }
     } else if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
         // Attempt to resume if suspended (often due to user interaction requirement)
         audioContextRef.current.resume().then(() => {
             console.log('AudioContext resumed.');
         }).catch(err => console.error('Failed to resume AudioContext:', err));
     }
   };

    // --- Load Background Music Effect ---
    useEffect(() => {
        const loadMusic = async () => {
            // Initialize AC here, as it's needed for decoding.
            // It's better to initialize earlier, perhaps on first interaction.
            if (!audioContextRef.current) {
                 console.log("AudioContext not yet initialized, deferring music load slightly.");
                // We might need a button press or similar to initialize AC robustly.
                // For now, let's assume it might get initialized by other means or try here.
                 initializeAudioContext();
                 if (!audioContextRef.current) {
                     console.warn("Could not initialize AudioContext for music loading.");
                     return; // Can't proceed without AC
                 }
             }
             // Ensure AC is running
            if (audioContextRef.current.state === 'suspended') {
                 await audioContextRef.current.resume();
            }

            if (!audioBufferRef.current) { // Only load if not already loaded
                 console.log("Attempting to load background music...");
                try {
                    // IMPORTANT: Ensure you have a `public/background-music.mp3` file.
                    // You can find royalty-free music online.
                    const response = await fetch('/background-music.mp3');
                    if (!response.ok) {
                        console.error(`Music file fetch failed: ${response.status} ${response.statusText}`);
                        throw new Error(`Failed to fetch music file (${response.status}). Ensure 'public/background-music.mp3' exists.`);
                    }
                     // Check content type? response.headers.get('content-type')?.includes('audio/mpeg')
                    const arrayBuffer = await response.arrayBuffer();
                    console.log("Music file fetched, decoding...");

                     // Use the persistent AudioContext for decoding
                    audioBufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer);
                    console.log('Background music loaded and decoded successfully.');
                    // No need to play it here, just load.
                } catch (error) {
                    console.error('Error loading background music:', error);
                    // Don't crash the app, just inform the user.
                    toast({
                         variant: 'destructive',
                         title: 'Music Load Failed',
                         description: `Could not load background music. ${error instanceof Error ? error.message : ''}`,
                     });
                    audioBufferRef.current = null; // Ensure it's null if loading failed
                }
             }
        };

        loadMusic();
        // No cleanup needed here unless we were auto-playing
    }, [toast]); // Re-run if toast changes (though unlikely)

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
            // Set default voice only if one hasn't been selected yet and voices are available
            if (!selectedVoiceURI && englishVoices.length > 0) {
                let defaultVoice = englishVoices.find(v => v.name.includes('Google') && v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices.find(v => v.lang === 'en-US');
                if (!defaultVoice) defaultVoice = englishVoices.find(v => v.default); // Check browser default flag
                if (!defaultVoice) defaultVoice = englishVoices[0]; // Fallback
                if (defaultVoice) {
                  setSelectedVoiceURI(defaultVoice.voiceURI);
                  console.log("Default voice set to:", defaultVoice?.name);
                } else {
                  console.warn("Could not find a suitable default English voice.");
                }
            }
        } else {
             console.log("Waiting for voices to load...");
        }
    };

    populateVoiceList();
    // Event listener for voices changing
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof speechSynthesis.onvoiceschanged !== 'undefined') {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Fallback check if onvoiceschanged isn't fired initially
      const voiceCheckInterval = setInterval(() => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            populateVoiceList();
            clearInterval(voiceCheckInterval);
        }
      }, 250);
       return () => clearInterval(voiceCheckInterval);
    }

    return () => {
        // Cleanup: remove listener and stop any speech/music
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof speechSynthesis.onvoiceschanged !== 'undefined') {
            speechSynthesis.onvoiceschanged = null;
        }
        stopSpeechPlayback();
        stopBackgroundMusic(); // Ensure music stops on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // Function to stop speech synthesis
  const stopSpeechPlayback = () => {
    let stopped = false;
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      speechSynthesis.cancel();
      console.log('Speech synthesis cancelled.');
      stopped = true;
    }
    utteranceRef.current = null; // Clear utterance ref

    if (stopped) {
        setIsReading(false); // Update state only if something was actually stopped
        // Don't stop music here, only when Stop button is explicitly pressed or playback naturally ends
    }
  };

  // Function to stop background music
  const stopBackgroundMusic = () => {
      if (musicSourceNodeRef.current) {
          try {
             musicSourceNodeRef.current.stop();
             console.log('Background music stopped.');
          } catch (error) {
              // May throw if already stopped or not started
              console.warn("Couldn't stop music node (may already be stopped):", error);
          }
          musicSourceNodeRef.current.disconnect(); // Disconnect to allow garbage collection
          musicSourceNodeRef.current = null;
      }
  };

  // Stop audio/speech if script changes
  useEffect(() => {
    stopSpeechPlayback();
    stopBackgroundMusic();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.script]);

  // Restore form fields on error
   useEffect(() => {
        if (state.error && state.submittedKeyword) {
            setKeyword(state.submittedKeyword);
        }
        if (state.error && state.submittedLength) {
            setSelectedLength(state.submittedLength);
        }
   }, [state.error, state.submittedKeyword, state.submittedLength]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  const handleLengthChange = (value: string) => {
    if (value === 'short' || value === 'medium' || value === 'long') {
      setSelectedLength(value as ScriptLength);
    } else {
        setSelectedLength('medium');
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Initialize AC on user interaction if not already done
    initializeAudioContext();
    stopSpeechPlayback();
    stopBackgroundMusic();
    const formData = new FormData(event.currentTarget);
    formData.set('length', selectedLength);
    startTransition(() => {
      formAction(formData);
    });
  };

  const handleCopy = () => {
    if (state.script) {
      navigator.clipboard.writeText(state.script)
        .then(() => {
          toast({ title: 'Success!', description: 'Script copied to clipboard.' });
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to copy script.' });
        });
    }
  };

  // Combined Play/Stop Handler
 const handlePlaybackToggle = async () => {
    // Initialize AC on user interaction if not already done
    initializeAudioContext();

    if (isReading) {
      console.log('Stopping playback...');
      stopSpeechPlayback();
      stopBackgroundMusic(); // Stop music when speech stops
      setIsReading(false);
      return;
    }

    // --- Start Reading ---
    if (!state.script) {
      toast({ variant: 'destructive', title: 'Error', description: 'No script available to read.' });
      return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Text-to-speech is not supported.' });
      return;
    }
     if (!areVoicesLoaded) {
         toast({ variant: 'warning', title: 'Voices Loading', description: 'Please wait a moment for voices to load.' });
         return;
     }
     if (!selectedVoiceURI) {
        toast({ variant: 'destructive', title: 'Voice Not Selected', description: 'Please select a voice first.' });
        return;
     }
     // Ensure AudioContext is ready
     if (!audioContextRef.current || audioContextRef.current.state !== 'running') {
         if (audioContextRef.current?.state === 'suspended') {
             try {
                await audioContextRef.current.resume();
                console.log('AudioContext resumed for playback.');
             } catch (err) {
                 toast({ variant: 'destructive', title: 'Audio Error', description: 'Could not resume audio. Please interact with the page (e.g., click again).' });
                 return;
             }
         } else {
             toast({ variant: 'destructive', title: 'Audio Error', description: 'Audio system not ready. Please try again.' });
             return;
         }
     }

    console.log('Starting playback...');
    setIsReading(true); // Set reading state

    try {
      // --- Start Background Music ---
       if (audioBufferRef.current && musicGainNodeRef.current && audioContextRef.current) {
           // Stop any previous music instance
           stopBackgroundMusic();

           musicSourceNodeRef.current = audioContextRef.current.createBufferSource();
           musicSourceNodeRef.current.buffer = audioBufferRef.current;
           musicSourceNodeRef.current.loop = true; // Loop the music

           // Connect source to gain, gain to destination
           musicSourceNodeRef.current.connect(musicGainNodeRef.current);
           // Gain node is already connected to destination in initializeAudioContext

           musicSourceNodeRef.current.start();
           console.log('Background music started.');
       } else if (!audioBufferRef.current) {
           console.warn("Background music buffer not loaded, playback will start without music.");
       } else {
           console.error("Cannot play music: AudioContext or GainNode missing.");
       }


      // --- Setup and Start Speech Synthesis ---
      if (speechSynthesis.speaking || speechSynthesis.pending) {
          speechSynthesis.cancel(); // Cancel previous
          await new Promise(resolve => setTimeout(resolve, 50)); // Short delay
      }

      const utterance = new SpeechSynthesisUtterance(state.script);
      utteranceRef.current = utterance;

      const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
      if (selectedVoice) {
          utterance.voice = selectedVoice;
      } else {
        console.warn(`Selected voice URI "${selectedVoiceURI}" not found. Using default.`);
      }

      // Event Handlers
      utterance.onstart = () => {
        console.log('Speech started.');
        setIsReading(true); // Ensure state is true
      };

      utterance.onend = () => {
        console.log('Speech finished.');
        stopBackgroundMusic(); // Stop music when speech ends naturally
        setIsReading(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        const errorMsg = event.error || 'Unknown speech error';
        console.error('SpeechSynthesisUtterance.onerror:', errorMsg, event);
        toast({
          variant: 'destructive',
          title: 'Speech Error',
          description: `Could not read the script. Error: ${errorMsg}. Try a different voice?`,
        });
        stopBackgroundMusic(); // Stop music on speech error
        setIsReading(false);
        utteranceRef.current = null;
      };

      // Start speech
      speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('Error during playback toggle:', error);
      toast({
        variant: 'destructive',
        title: 'Playback Error',
        description: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      stopBackgroundMusic(); // Stop music on general error
      stopSpeechPlayback(); // Also ensure speech state is reset
    }
  };


  const handleVoiceChange = (value: string) => {
      setSelectedVoiceURI(value);
      console.log("Voice selected:", value);
      // Stop playback if running with the old voice
      if (isReading) {
          stopSpeechPlayback();
          stopBackgroundMusic();
      }
  };

  // Handler for background music volume change
   const handleVolumeChange = (value: number[]) => {
     const newVolume = value[0];
     setBackgroundMusicVolume(newVolume);
     if (musicGainNodeRef.current && audioContextRef.current) {
       // Smoothly ramp the volume change
       musicGainNodeRef.current.gain.linearRampToValueAtTime(
           newVolume,
           audioContextRef.current.currentTime + 0.1 // Ramp over 0.1 seconds
       );
     }
   };

   // Handler for font size change
   const handleFontSizeChange = (value: number[]) => {
       setFontSize(value[0]);
   };


  const isLoading = isPending || isFormPending;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-background">
      <Card className="w-full max-w-2xl shadow-lg rounded-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold text-center text-foreground">Podcast Pilot</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Generate, read, and customize your podcast script.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6"> {/* Increased space */}
            {/* Keyword Input */}
            <div className="space-y-2">
              <Label htmlFor="keyword" className="font-semibold text-foreground">Keyword</Label>
              <Input
                id="keyword"
                name="keyword"
                placeholder="e.g., Benefits of Meditation, Future of Space Travel"
                value={keyword}
                onChange={handleInputChange}
                required
                className="text-base rounded-md shadow-sm"
                disabled={isLoading}
                aria-label="Podcast topic keyword"
              />
              {state.error && state.submittedKeyword === keyword && !state.script && <p className="text-sm text-destructive font-medium">{state.error}</p>}
            </div>

            {/* Settings Row (Length, Voice, Volume, Font Size) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Length Selection */}
                <div className="space-y-2">
                <Label htmlFor="length-select" className="font-semibold text-foreground">Script Length</Label>
                <Select value={selectedLength} onValueChange={handleLengthChange} disabled={isLoading} name="length">
                    <SelectTrigger id="length-select" className="w-full rounded-md shadow-sm" aria-label="Select script length">
                    <SelectValue placeholder="Select length..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-md shadow-lg">
                    <SelectItem value="short" className="cursor-pointer">Short (~1-2 min)</SelectItem>
                    <SelectItem value="medium" className="cursor-pointer">Medium (~3-5 min)</SelectItem>
                    <SelectItem value="long" className="cursor-pointer">Long (~6-8 min)</SelectItem>
                    </SelectContent>
                </Select>
                </div>

                {/* Voice Selection Dropdown */}
                <div className="space-y-2">
                    <Label htmlFor="voice-select" className="font-semibold text-foreground">Voice</Label>
                    <Select value={selectedVoiceURI || ""} onValueChange={handleVoiceChange} disabled={!areVoicesLoaded || availableVoices.length === 0 || isLoading} name="voice-select">
                        <SelectTrigger id="voice-select" className="w-full rounded-md shadow-sm" aria-label="Select reading voice">
                            <SelectValue placeholder={areVoicesLoaded && availableVoices.length > 0 ? "Select a voice..." : (areVoicesLoaded ? "No English voices" : "Loading voices...")} />
                        </SelectTrigger>
                        <SelectContent className="rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {availableVoices.length > 0 ? (
                                availableVoices.map((voice) => (
                                <SelectItem key={voice.voiceURI} value={voice.voiceURI} className="cursor-pointer">
                                    {voice.name} ({voice.lang}) {voice.default ? '[Default]' : ''}
                                </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="loading" disabled>
                                {areVoicesLoaded ? "No English voices" : "Loading..."}
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Background Music Volume Slider */}
                <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="volume-slider" className="font-semibold text-foreground flex items-center">
                       {backgroundMusicVolume > 0 ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />} Music Vol.
                    </Label>
                    <Slider
                        id="volume-slider"
                        min={0}
                        max={0.5} // Limit max volume to avoid overpowering speech
                        step={0.01}
                        value={[backgroundMusicVolume]}
                        onValueChange={handleVolumeChange}
                        disabled={isLoading || !audioBufferRef.current} // Disable if music not loaded
                        className="w-full"
                        aria-label="Background music volume"
                    />
                </div>

                 {/* Font Size Slider */}
                 <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="fontsize-slider" className="font-semibold text-foreground">Script Font Size</Label>
                    <Slider
                        id="fontsize-slider"
                        min={12} // Min font size
                        max={24} // Max font size
                        step={1}
                        value={[fontSize]}
                        onValueChange={handleFontSizeChange}
                        disabled={isLoading}
                        className="w-full"
                        aria-label="Script font size"
                    />
                </div>
            </div>


            {/* Generate Button */}
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md shadow-md transition-all duration-200 ease-in-out transform hover:scale-105"
              disabled={isLoading || !keyword.trim()}
              aria-label="Generate podcast script"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                'Generate Script'
              )}
            </Button>
          </form>

          {/* Script Display Area */}
          {state.script && ( // Show script area if script exists, even if there was a prior error message shown above
            <div className="mt-6 space-y-2">
              <Label htmlFor="script" className="font-semibold text-foreground">Generated Script</Label>
              <div className="relative">
                <Textarea
                  id="script"
                  value={state.script}
                  readOnly
                  className="min-h-[300px] bg-secondary rounded-md shadow-inner p-4 leading-relaxed"
                  style={{ fontSize: `${fontSize}px` }} // Apply dynamic font size
                  aria-label="Generated podcast script"
                />
                 {/* Action Buttons Overlay */}
                 <div className="absolute top-2 right-2 flex items-center space-x-1 bg-background/70 backdrop-blur-sm p-1 rounded-md shadow">
                    {/* Play/Stop Button */}
                   <Button
                     variant="ghost"
                     size="icon"
                     className="text-foreground hover:bg-accent/20 disabled:opacity-50"
                     onClick={handlePlaybackToggle}
                     aria-label={isReading ? "Stop reading script" : "Read script aloud"}
                     disabled={isLoading || !areVoicesLoaded || availableVoices.length === 0 || !selectedVoiceURI || !state.script}
                     title={isReading ? "Stop Playback" : "Play with Music"}
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
                        disabled={isLoading || !state.script}
                        title="Copy Script"
                    >
                        <Copy className="h-5 w-5" />
                    </Button>
                 </div>
              </div>
            </div>
          )}
           {/* Show error related to script generation *after* the potential script display */}
           {state.error && !state.script && <p className="mt-4 text-center text-sm text-destructive font-medium">{state.error}</p>}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-center pt-4">
          Powered by Generative AI
        </CardFooter>
      </Card>
    </main>
  );
}


    