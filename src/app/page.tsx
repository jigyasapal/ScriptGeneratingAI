
'use client';

import type { ChangeEvent, FormEvent } from 'react';
import React, { useState, useTransition, useRef, useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Copy, Download, Loader2, Play, Square, Volume2, VolumeX } from 'lucide-react'; // Added Download
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';
import type { ScriptLength, EmotionTone, Language } from '@/ai/flows/podcast-script-generation';

// Helper function to create a downloadable file
const downloadFile = (filename: string, text: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};


export default function Home() {
  const { toast, toasts } = useToast(); // Use 'toasts' from useToast
  const [keyword, setKeyword] = useState('');
  const [selectedLength, setSelectedLength] = useState<ScriptLength>('medium');
  const [selectedTone, setSelectedTone] = useState<EmotionTone>('neutral');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>(undefined);
  const [areVoicesLoaded, setAreVoicesLoaded] = useState(false);
  const [fontSize, setFontSize] = useState<number>(16); // Initial font size in pixels

  // Refs for Speech Synthesis
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval


  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);

  // Stop speech if script changes or language changes
  useEffect(() => {
    stopSpeechPlayback();
    // Reset selected voice if language changes
    setSelectedVoiceURI(undefined);
    populateVoiceList(); // Repopulate voices for the new language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.script, selectedLanguage]);


    // --- Voice Loading Effect ---
   useEffect(() => {
    const cleanup = () => {
        // Cleanup: remove listener and stop any speech
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof speechSynthesis.onvoiceschanged !== 'undefined') {
            speechSynthesis.onvoiceschanged = null;
        }
        if (voiceCheckIntervalRef.current) {
            clearInterval(voiceCheckIntervalRef.current);
            voiceCheckIntervalRef.current = null;
        }
        stopSpeechPlayback();
    };

    populateVoiceList(); // Initial attempt

    // Event listener for voices changing
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
         // Always set the listener if supported
        speechSynthesis.onvoiceschanged = populateVoiceList;

        // Fallback check if onvoiceschanged isn't fired initially or reliably
        startVoiceCheckInterval();
    } else {
        console.warn('Speech Synthesis not supported.');
    }

    return cleanup; // Return cleanup function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]); // Re-run when language changes


  const startVoiceCheckInterval = () => {
        if (voiceCheckIntervalRef.current) return; // Prevent multiple intervals
        voiceCheckIntervalRef.current = setInterval(() => {
            const voices = typeof window !== 'undefined' && 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
            if (voices.length > 0) {
                console.log("Voices loaded via interval check.");
                populateVoiceList(); // Call populate list which now handles clearing the interval
            } else {
                console.log("Still waiting for voices via interval...");
            }
        }, 500); // Check every 500ms
   };


   const populateVoiceList = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            console.warn('Speech Synthesis not supported, cannot populate voices.');
            setAreVoicesLoaded(true); // Mark as loaded to avoid infinite loading state
            return;
        }
        const voices = speechSynthesis.getVoices();
         console.log(`Populating voices for language: ${selectedLanguage}. Found ${voices.length} total voices initially.`);


        if (voices.length > 0) {
             console.log(`Available voices:`, voices.map(v => `${v.name} (${v.lang})`));
             // Filter voices based on the selected language prefix (e.g., 'en' or 'hi')
             const languagePrefix = selectedLanguage.split('-')[0]; // 'en' or 'hi'
             const filteredVoices = voices.filter(voice => voice.lang.startsWith(languagePrefix));

             console.log(`Found ${filteredVoices.length} voices for prefix "${languagePrefix}"`);

            setAvailableVoices(filteredVoices);
            setAreVoicesLoaded(true);

            // Clear interval if voices are successfully loaded
             if (voiceCheckIntervalRef.current) {
                clearInterval(voiceCheckIntervalRef.current);
                voiceCheckIntervalRef.current = null;
                console.log("Voice check interval cleared.");
            }


            // Set default voice only if one hasn't been selected or the current one isn't valid for the new language
            const currentVoiceIsValid = selectedVoiceURI && filteredVoices.some(v => v.voiceURI === selectedVoiceURI);
            if ((!selectedVoiceURI || !currentVoiceIsValid) && filteredVoices.length > 0) {
                let defaultVoice: SpeechSynthesisVoice | undefined;
                 // Prioritize language-specific defaults if available (heuristic)
                 if (selectedLanguage === 'en') {
                    defaultVoice = filteredVoices.find(v => v.name.includes('Google') && v.lang.startsWith('en-US'));
                    if (!defaultVoice) defaultVoice = filteredVoices.find(v => v.lang.startsWith('en-US'));
                    if (!defaultVoice) defaultVoice = filteredVoices.find(v => v.default && v.lang.startsWith('en'));
                 } else if (selectedLanguage === 'hi') {
                    defaultVoice = filteredVoices.find(v => v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('google') && v.lang.startsWith('hi'));
                     if (!defaultVoice) defaultVoice = filteredVoices.find(v => v.lang.startsWith('hi-IN'));
                     if (!defaultVoice) defaultVoice = filteredVoices.find(v => v.default && v.lang.startsWith('hi'));
                 }

                 // General fallback
                if (!defaultVoice) defaultVoice = filteredVoices.find(v => v.default); // Check browser default flag for the language
                if (!defaultVoice && filteredVoices.length > 0) defaultVoice = filteredVoices[0]; // Absolute fallback

                if (defaultVoice) {
                    setSelectedVoiceURI(defaultVoice.voiceURI);
                    console.log(`Default voice for "${selectedLanguage}" set to: ${defaultVoice.name} (${defaultVoice.lang})`);
                } else {
                    setSelectedVoiceURI(undefined); // Ensure it's undefined if no suitable voice found
                    console.warn(`Could not find a suitable default voice for language "${selectedLanguage}".`);
                     // Optionally toast if no voices are found at all for the language
                     if (filteredVoices.length === 0) {
                        toast({
                            variant: 'warning',
                            title: 'No Voices Found',
                            description: `Could not find any voices for the selected language (${selectedLanguage}). Playback might not work.`,
                        });
                     }
                }
            } else if (currentVoiceIsValid) {
                 console.log("Keeping currently selected valid voice:", availableVoices.find(v => v.voiceURI === selectedVoiceURI)?.name);
            } else if (filteredVoices.length === 0) {
                 setSelectedVoiceURI(undefined); // Clear selection if no voices available
                 console.warn(`No voices available for language "${selectedLanguage}".`);
                 toast({
                      variant: 'warning',
                      title: 'No Voices Found',
                      description: `No voices installed on your system/browser for ${selectedLanguage}. Playback unavailable.`,
                 });
            }
        } else {
            console.log("Voices array is empty, waiting for onvoiceschanged or interval...");
            setAreVoicesLoaded(false); // Keep showing loading state
            // Ensure interval is running if voices aren't loaded yet
             if (typeof window !== 'undefined' && 'speechSynthesis' in window && !voiceCheckIntervalRef.current) {
                 startVoiceCheckInterval();
             }
        }
    };


  // Function to stop speech synthesis
  const stopSpeechPlayback = () => {
    let stopped = false;
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      console.log('Speech synthesis cancelled.');
      stopped = true;
    }
     // Always clear the ref, even if cancel didn't run (e.g., utterance ended naturally)
    utteranceRef.current = null;

    if (stopped) {
        setIsReading(false); // Update state only if something was actually stopped
    }
  };


  // Restore form fields on error
   useEffect(() => {
        if (state.error && state.submittedKeyword) {
            setKeyword(state.submittedKeyword);
        }
        if (state.error && state.submittedLength) {
            setSelectedLength(state.submittedLength);
        }
         if (state.error && state.submittedTone) {
            setSelectedTone(state.submittedTone);
        }
         if (state.error && state.submittedLanguage) {
            setSelectedLanguage(state.submittedLanguage);
        }
   }, [state.error, state.submittedKeyword, state.submittedLength, state.submittedTone, state.submittedLanguage]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  const handleLengthChange = (value: string) => {
    // Add 'hour' to the list of valid lengths
    if (value === 'short' || value === 'medium' || value === 'long' || value === 'hour') {
      setSelectedLength(value as ScriptLength);
    } else {
        setSelectedLength('medium'); // Default fallback
    }
  };

   const handleToneChange = (value: string) => {
    const validTones: EmotionTone[] = ['neutral', 'happy', 'sad', 'excited', 'formal', 'casual'];
    if (validTones.includes(value as EmotionTone)) {
        setSelectedTone(value as EmotionTone);
    } else {
        setSelectedTone('neutral');
    }
   };

   const handleLanguageChange = (value: string) => {
     const validLanguages: Language[] = ['en', 'hi'];
     if (validLanguages.includes(value as Language)) {
         setSelectedLanguage(value as Language);
         // Stop playback and repopulate voices when language changes
         stopSpeechPlayback();
         setAreVoicesLoaded(false); // Set loading state for voices
         setSelectedVoiceURI(undefined); // Clear selected voice
         // The useEffect hook listening to selectedLanguage will call populateVoiceList
     } else {
         setSelectedLanguage('en');
     }
   };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    stopSpeechPlayback();
    const formData = new FormData(event.currentTarget);
    formData.set('length', selectedLength);
    formData.set('tone', selectedTone);
    formData.set('language', selectedLanguage);
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

  const handleDownload = () => {
    if (state.script && state.submittedKeyword) {
        const filename = `${state.submittedKeyword.replace(/\s+/g, '_')}_${selectedLanguage}_${selectedLength}.txt`;
        downloadFile(filename, state.script);
        toast({ title: 'Success!', description: `Script downloaded as ${filename}` });
    } else if (state.script) {
         downloadFile(`podcast_script_${selectedLanguage}.txt`, state.script);
         toast({ title: 'Success!', description: `Script downloaded as podcast_script_${selectedLanguage}.txt` });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: 'No script available to download.' });
    }
  };


  // Combined Play/Stop Handler
 const handlePlaybackToggle = async () => {

    if (isReading) {
      console.log('Stopping playback...');
      stopSpeechPlayback();
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
          const toastId = 'no-voice-selected-error';
          // Check if this toast is already active
          const isToastActive = toasts.some(t => t.id === toastId && t.open);
          if (!isToastActive) {
             toast({ id: toastId, variant: 'destructive', title: 'Voice Not Selected', description: `Please select a voice for ${selectedLanguage} first, or ensure voices are available.` });
          }
        return;
     }

    console.log('Attempting to start playback...');
    setIsReading(true); // Set reading state optimistically

    try {

      // --- Setup and Start Speech Synthesis ---
       // **CRITICAL**: Cancel any ongoing or pending speech BEFORE creating a new utterance.
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          console.log("Cancelling existing speech before starting new one.");
          window.speechSynthesis.cancel();
          // Adding a small delay might help ensure the queue is fully cleared on some browsers/OSes.
          await new Promise(resolve => setTimeout(resolve, 50));
      }


      const utterance = new SpeechSynthesisUtterance(state.script);
      utteranceRef.current = utterance;

      const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
      if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang; // Explicitly set lang for safety
          console.log(`Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        console.warn(`Selected voice URI "${selectedVoiceURI}" not found among available ${selectedLanguage} voices. Using browser default for the utterance language.`);
        // Attempt to set language anyway, browser might pick a default based on this
        utterance.lang = selectedLanguage === 'hi' ? 'hi-IN' : 'en-US';
         toast({
             variant: 'warning',
             title: 'Voice Not Found',
             description: `Selected voice unavailable. Using a default voice for ${utterance.lang}.`,
         });
      }

       // Log utterance properties right before speaking
       console.log('Utterance properties:', {
         textLength: utterance.text.length,
         lang: utterance.lang,
         voiceName: utterance.voice?.name,
         voiceURI: utterance.voice?.voiceURI,
         rate: utterance.rate,
         pitch: utterance.pitch,
         volume: utterance.volume,
       });


      // Event Handlers
      utterance.onstart = () => {
        console.log('Speech started.');
        setIsReading(true); // Ensure state is true
      };

      utterance.onend = () => {
        console.log('Speech finished naturally.');
        setIsReading(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        // More detailed error logging
        const errorMsg = event.error || 'Unknown speech error';
        console.error('SpeechSynthesisUtterance.onerror:', errorMsg, event);
        console.error('Utterance details on error:', {
             text: utterance.text.substring(0, 100) + "...", // Log beginning of text
             lang: utterance.lang,
             voiceURI: utterance.voice?.voiceURI,
        });

        let description = `Could not read the script. Error: ${errorMsg}.`;
        if (errorMsg === 'interrupted') {
            description = "Playback was interrupted. This might happen if you clicked play/stop quickly or changed settings.";
            console.warn("Speech interrupted, possibly by user action or rapid state changes.");
        } else if (errorMsg === 'synthesis-failed' || errorMsg === 'audio-busy' || errorMsg === 'audio-hardware') {
            description += " There might be an issue with the speech engine or audio output.";
        } else if (errorMsg === 'language-unavailable' || errorMsg === 'voice-unavailable') {
             description += ` The selected voice or language (${utterance.lang}) might not be fully supported. Try another voice?`;
        } else {
            description += " Please try again or select a different voice."
        }


        const toastId = `speech-error-${errorMsg}`;
        const isToastActive = toasts.some(t => t.id === toastId && t.open);
        if (!isToastActive) {
             toast({
               id: toastId,
               variant: 'destructive',
               title: 'Speech Error',
               description: description,
             });
        }

        setIsReading(false);
        utteranceRef.current = null;
      };

      // Start speech
      window.speechSynthesis.speak(utterance);
       console.log("speechSynthesis.speak() called.");

    } catch (error) {
      console.error('Error during playback toggle (catch block):', error);
       const toastId = 'playback-toggle-error';
       const isToastActive = toasts.some(t => t.id === toastId && t.open);
        if (!isToastActive) {
             toast({
               id: toastId,
               variant: 'destructive',
               title: 'Playback Error',
               description: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
             });
        }
      stopSpeechPlayback(); // Ensure speech state is reset
    }
  };


  const handleVoiceChange = (value: string) => {
       const selected = availableVoices.find(v => v.voiceURI === value);
       if (selected) {
          setSelectedVoiceURI(value);
          console.log("Voice selected:", selected.name, `(${selected.lang})`);
          // Stop playback if running with the old voice
          if (isReading) {
              stopSpeechPlayback();
          }
       } else {
           console.warn(`Attempted to select a voice URI (${value}) not in the current list.`);
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
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
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
              {state.error && state.submittedKeyword === keyword && !state.script && <p className="text-sm text-destructive font-medium">{state.error?.split(';')[0]}</p>}
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                {/* Language Selection */}
                <div className="space-y-2">
                    <Label htmlFor="language-select" className="font-semibold text-foreground">Language</Label>
                    <Select value={selectedLanguage} onValueChange={handleLanguageChange} disabled={isLoading} name="language">
                        <SelectTrigger id="language-select" className="w-full rounded-md shadow-sm" aria-label="Select script language">
                            <SelectValue placeholder="Select language..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-md shadow-lg">
                            <SelectItem value="en" className="cursor-pointer">English</SelectItem>
                            <SelectItem value="hi" className="cursor-pointer">Hindi (हिन्दी)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

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
                            <SelectItem value="hour" className="cursor-pointer">Hour (~45-60 min)</SelectItem> {/* Added Hour */}
                        </SelectContent>
                    </Select>
                </div>

                 {/* Tone Selection */}
                 <div className="space-y-2">
                    <Label htmlFor="tone-select" className="font-semibold text-foreground">Emotion Tone</Label>
                    <Select value={selectedTone} onValueChange={handleToneChange} disabled={isLoading} name="tone">
                        <SelectTrigger id="tone-select" className="w-full rounded-md shadow-sm" aria-label="Select script tone">
                        <SelectValue placeholder="Select tone..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-md shadow-lg">
                            <SelectItem value="neutral" className="cursor-pointer">Neutral</SelectItem>
                            <SelectItem value="happy" className="cursor-pointer">Happy</SelectItem>
                            <SelectItem value="sad" className="cursor-pointer">Sad</SelectItem>
                            <SelectItem value="excited" className="cursor-pointer">Excited</SelectItem>
                            <SelectItem value="formal" className="cursor-pointer">Formal</SelectItem>
                            <SelectItem value="casual" className="cursor-pointer">Casual</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Voice Selection Dropdown */}
                <div className="space-y-2">
                    <Label htmlFor="voice-select" className="font-semibold text-foreground">Voice</Label>
                    <Select value={selectedVoiceURI || ""} onValueChange={handleVoiceChange} disabled={!areVoicesLoaded || availableVoices.length === 0 || isLoading} name="voice-select">
                        <SelectTrigger id="voice-select" className="w-full rounded-md shadow-sm" aria-label="Select reading voice">
                            <SelectValue placeholder={!areVoicesLoaded ? "Loading voices..." : (availableVoices.length > 0 ? "Select a voice..." : `No ${selectedLanguage} voices found`)} />
                        </SelectTrigger>
                        <SelectContent className="rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {!areVoicesLoaded ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : availableVoices.length > 0 ? (
                                availableVoices.map((voice) => (
                                <SelectItem key={voice.voiceURI} value={voice.voiceURI} className="cursor-pointer">
                                    {voice.name} ({voice.lang}) {voice.default ? '[Default]' : ''}
                                </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="no-voices" disabled>
                                    No {selectedLanguage} voices found
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                     {!areVoicesLoaded && <p className="text-xs text-muted-foreground">Loading available voices...</p>}
                     {areVoicesLoaded && availableVoices.length === 0 && <p className="text-xs text-destructive">No voices found for {selectedLanguage}. Playback may not work.</p>}
                </div>


                 {/* Font Size Slider - Spanning full width on small screens, half on medium+ */}
                 <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label htmlFor="fontsize-slider" className="font-semibold text-foreground">Script Font Size ({fontSize}px)</Label>
                    <Slider
                        id="fontsize-slider"
                        min={12} // Min font size
                        max={28} // Max font size
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
             {/* Display specific errors related to generation parameters */}
             {state.error && !state.script && (
                 <div className="text-sm text-destructive font-medium space-y-1">
                    {state.error.split(';').map((err, index) => <p key={index}>{err.trim()}</p>)}
                 </div>
             )}
          </form>

          {/* Script Display Area */}
          {state.script && (
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
                        disabled={isLoading || !state.script}
                        title="Copy Script"
                    >
                        <Copy className="h-5 w-5" />
                    </Button>
                     {/* Download Button */}
                     <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground hover:bg-accent/20 disabled:opacity-50"
                        onClick={handleDownload}
                        aria-label="Download script as text file"
                        disabled={isLoading || !state.script}
                        title="Download Script (.txt)"
                      >
                        <Download className="h-5 w-5" />
                     </Button>
                 </div>
              </div>
            </div>
          )}
           {/* Fallback for general errors if script didn't generate */}
           {state.error && !state.script && !state.submittedKeyword && <p className="mt-4 text-center text-sm text-destructive font-medium">{state.error}</p>}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-center pt-4">
          Powered by Generative AI
        </CardFooter>
      </Card>
    </main>
  );
}
