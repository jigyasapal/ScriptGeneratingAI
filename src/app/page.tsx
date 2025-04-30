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
import { Copy, Download, Loader2, Play, Square, AudioWaveform } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateScriptAction, type GenerateScriptActionState } from './actions';
import type { ScriptLength, ConversationTone, Language } from '@/ai/flows/podcast-script-generation'; // Use ConversationTone


// Helper function to create a downloadable text file
const downloadFile = (filename: string, text: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

// Helper to get language name
const getLanguageName = (langCode: Language): string => {
    switch (langCode) {
        case 'en': return 'English';
        case 'hi': return 'Hindi';
        case 'es': return 'Spanish';
        case 'fr': return 'French';
        case 'de': return 'German';
        default: return langCode;
    }
};


export default function Home() {
  const { toast, toasts } = useToast();
  const [keyword, setKeyword] = useState('');
  const [selectedLength, setSelectedLength] = useState<ScriptLength>('medium');
  const [selectedTone, setSelectedTone] = useState<ConversationTone>('conversational'); // Use ConversationTone
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [_isPending, startTransition] = useTransition(); // Renamed to avoid conflict
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>(undefined);
  const [areVoicesLoaded, setAreVoicesLoaded] = useState(false);
  const [fontSize, setFontSize] = useState<number>(16); // Initial font size in pixels

  // Refs for Speech Synthesis
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval

  // Define initialState directly with type
  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);


  // --- Voice Loading Effect ---
   useEffect(() => {
    // Cleanup function
    const cleanup = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof speechSynthesis.onvoiceschanged !== 'undefined') {
            speechSynthesis.onvoiceschanged = null; // Remove listener
        }
        if (voiceCheckIntervalRef.current) {
            clearInterval(voiceCheckIntervalRef.current); // Clear interval
            voiceCheckIntervalRef.current = null;
        }
        stopSpeechPlayback(); // Stop any ongoing speech on cleanup or language change
        console.log("Speech synthesis effect cleanup performed.");
    };

    // Function to attempt loading voices and set up listeners/intervals
    const setupVoices = () => {
        console.log(`Setting up voices for language: ${selectedLanguage} (${getLanguageName(selectedLanguage)})`);
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            populateVoiceList(); // Initial attempt to populate

            // Set up the event listener for voice changes
            speechSynthesis.onvoiceschanged = () => {
                console.log("onvoiceschanged event fired.");
                populateVoiceList();
            };

            // Fallback interval check if voices aren't loaded quickly or `onvoiceschanged` is unreliable
            // Start checking only if voices aren't already loaded after the initial populateVoiceList call
            const voicesNow = speechSynthesis.getVoices();
             if (voicesNow.length === 0 && !voiceCheckIntervalRef.current) {
                startVoiceCheckInterval();
             }
        } else {
            console.warn('Speech Synthesis not supported by this browser.');
            setAreVoicesLoaded(true); // Mark as 'loaded' (but unavailable) to prevent infinite loading state
        }
    };

    cleanup(); // Clean up previous effect first (e.g., listeners for old language)
    setAreVoicesLoaded(false); // Reset loading state when language changes
    setSelectedVoiceURI(undefined); // Clear selected voice for the new language
    setAvailableVoices([]); // Clear available voices list
    setupVoices(); // Set up for the new language

    return cleanup; // Return the cleanup function to be called when component unmounts or language changes again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]); // Re-run only when the selected language changes


  const startVoiceCheckInterval = () => {
        if (voiceCheckIntervalRef.current) {
             console.log("Voice check interval already running.");
             return; // Prevent multiple intervals
        }
        console.log("Starting voice check interval.");
        voiceCheckIntervalRef.current = setInterval(() => {
            const voices = typeof window !== 'undefined' && 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
            if (voices.length > 0) {
                console.log("Voices loaded via interval check.");
                populateVoiceList(); // This will clear the interval
            } else {
                console.log("Still waiting for voices via interval...");
            }
        }, 500); // Check every 500ms
   };


   const populateVoiceList = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            console.warn('Speech Synthesis not supported, cannot populate voices.');
            setAreVoicesLoaded(true); // Avoid infinite loading
             if (voiceCheckIntervalRef.current) {
                 clearInterval(voiceCheckIntervalRef.current); // Clear interval if running
                 voiceCheckIntervalRef.current = null;
             }
            return;
        }

        const voices = speechSynthesis.getVoices();
        console.log(`Populating voices for language: ${selectedLanguage} (${getLanguageName(selectedLanguage)}). Found ${voices.length} total voices.`);


        if (voices.length > 0) {
             console.log(`Available voices raw:`, voices.map(v => `${v.name} (${v.lang}) ${v.default ? '[Default]' : ''}`));

             // Filter voices based on the selected language prefix (e.g., 'en', 'hi', 'es', 'fr', 'de')
             const languagePrefix = selectedLanguage.split('-')[0]; // 'en', 'hi', 'es', 'fr', 'de'
             const filteredVoices = voices.filter(voice => voice.lang.startsWith(languagePrefix));

             console.log(`Found ${filteredVoices.length} voices for prefix "${languagePrefix}" (${getLanguageName(selectedLanguage)})`);
             console.log(`Filtered voices (${getLanguageName(selectedLanguage)}):`, filteredVoices.map(v => `${v.name} (${v.lang}) ${v.default ? '[Default]' : ''}`));


             // Check if the list of voices for the language actually changed
             // This prevents unnecessary state updates and potential re-renders
             const currentAvailableVoiceURIs = availableVoices.map(v => v.voiceURI).sort().join(',');
             const newFilteredVoiceURIs = filteredVoices.map(v => v.voiceURI).sort().join(',');

             if (newFilteredVoiceURIs !== currentAvailableVoiceURIs) {
                  console.log("Updating available voices state for", getLanguageName(selectedLanguage));
                  setAvailableVoices(filteredVoices);
             } else {
                 console.log(`Filtered voice list for ${getLanguageName(selectedLanguage)} hasn't changed, skipping state update.`);
             }

            setAreVoicesLoaded(true);

            // Clear interval if voices are successfully loaded
             if (voiceCheckIntervalRef.current) {
                clearInterval(voiceCheckIntervalRef.current);
                voiceCheckIntervalRef.current = null;
                console.log("Voice check interval cleared.");
            }

            // --- Default Voice Selection Logic ---
            // Only set a default if one isn't already selected OR if the current selection is no longer valid for the new language
            const currentVoiceIsValidForLanguage = selectedVoiceURI && filteredVoices.some(v => v.voiceURI === selectedVoiceURI);

            if (!currentVoiceIsValidForLanguage && filteredVoices.length > 0) {
                 console.log(`Selecting a default voice for ${getLanguageName(selectedLanguage)}.`);
                 let defaultVoice: SpeechSynthesisVoice | undefined;
                 let specificLangTag: string;

                // Determine the most likely specific language tag for default search
                switch (selectedLanguage) {
                    case 'hi': specificLangTag = 'hi-IN'; break;
                    case 'es': specificLangTag = 'es-ES'; break; // Defaulting to Spain Spanish
                    case 'fr': specificLangTag = 'fr-FR'; break; // Defaulting to France French
                    case 'de': specificLangTag = 'de-DE'; break; // Defaulting to Germany German
                    case 'en': specificLangTag = 'en-US'; break; // Defaulting to US English
                    default: specificLangTag = languagePrefix; // Fallback if somehow language is not in the list
                }
                 console.log(`Attempting default voice selection for language "${selectedLanguage}", prioritizing tag "${specificLangTag}" and prefix "${languagePrefix}".`);


                 // --- Prioritization Strategy ---
                 // 1. Voices explicitly marked as default by the browser *for the specific language tag*
                 defaultVoice = filteredVoices.find(v => v.default && v.lang === specificLangTag);
                 if(defaultVoice) console.log("Found browser default for specific lang tag:", defaultVoice.name);

                 // 2. Google voices for the specific language tag (often high quality)
                 if (!defaultVoice) {
                    defaultVoice = filteredVoices.find(v => v.name.includes('Google') && v.lang === specificLangTag);
                    if(defaultVoice) console.log("Found Google voice for specific lang tag:", defaultVoice.name);
                 }
                  // 3. Microsoft voices for the specific language tag
                  if (!defaultVoice) {
                    defaultVoice = filteredVoices.find(v => v.name.includes('Microsoft') && v.lang === specificLangTag);
                    if(defaultVoice) console.log("Found Microsoft voice for specific lang tag:", defaultVoice.name);
                 }
                 // 4. Other voices for the specific language tag
                 if (!defaultVoice) {
                    defaultVoice = filteredVoices.find(v => v.lang === specificLangTag);
                    if(defaultVoice) console.log("Found other voice for specific lang tag:", defaultVoice.name);
                 }

                 // --- Broaden Search if Specific Tag Fails ---
                 // 5. Browser default for the broader language prefix (e.g., 'en', 'hi')
                 if (!defaultVoice) {
                    defaultVoice = filteredVoices.find(v => v.default && v.lang.startsWith(languagePrefix));
                     if(defaultVoice) console.log("Found browser default for language prefix:", defaultVoice.name);
                 }
                 // 6. Google voices for the broader language prefix
                 if (!defaultVoice) {
                     defaultVoice = filteredVoices.find(v => v.name.includes('Google') && v.lang.startsWith(languagePrefix));
                     if(defaultVoice) console.log("Found Google voice for language prefix:", defaultVoice.name);
                 }
                 // 7. Microsoft voices for the broader language prefix
                  if (!defaultVoice) {
                     defaultVoice = filteredVoices.find(v => v.name.includes('Microsoft') && v.lang.startsWith(languagePrefix));
                     if(defaultVoice) console.log("Found Microsoft voice for language prefix:", defaultVoice.name);
                 }

                 // 8. Any remaining voice for the language prefix (absolute fallback)
                  if (!defaultVoice) {
                      defaultVoice = filteredVoices[0];
                       if(defaultVoice) console.log("Using first available voice as fallback:", defaultVoice.name);
                  }


                if (defaultVoice) {
                    setSelectedVoiceURI(defaultVoice.voiceURI);
                    console.log(`Default voice for "${selectedLanguage}" (${getLanguageName(selectedLanguage)}) set to: ${defaultVoice.name} (${defaultVoice.lang}), URI: ${defaultVoice.voiceURI}`);
                } else {
                    // This case should be rare if filteredVoices.length > 0
                    setSelectedVoiceURI(undefined);
                    console.warn(`Could not find any default voice candidate for language "${selectedLanguage}" (${getLanguageName(selectedLanguage)}), even though voices exist.`);
                }
            } else if (currentVoiceIsValidForLanguage) {
                 console.log(`Keeping currently selected valid voice for ${getLanguageName(selectedLanguage)}:`, availableVoices.find(v => v.voiceURI === selectedVoiceURI)?.name);
            } else if (filteredVoices.length === 0) {
                 setSelectedVoiceURI(undefined); // Clear selection if no voices available
                 console.warn(`No voices available for language "${selectedLanguage}" (${getLanguageName(selectedLanguage)}).`);
                 const toastId = `no-voices-available-${selectedLanguage}`;
                 // Avoid showing duplicate toasts
                  if (!toasts.some(t => t.id === toastId)) {
                     toast({
                          id: toastId,
                          variant: 'warning',
                          title: 'No Voices Found',
                          description: `No voices installed on your system/browser for ${getLanguageName(selectedLanguage)}. Playback unavailable.`,
                     });
                 }
            }
        } else {
            console.log("Voices array is still empty, waiting for onvoiceschanged or interval...");
            setAreVoicesLoaded(false); // Keep showing loading state
            // Ensure interval is running if voices aren't loaded yet and it's not already running
             if (typeof window !== 'undefined' && 'speechSynthesis' in window && !voiceCheckIntervalRef.current) {
                 startVoiceCheckInterval();
             }
        }
    };


  // Function to stop speech synthesis
  const stopSpeechPlayback = () => {
    let stopped = false;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            console.log('Calling speechSynthesis.cancel().');
            window.speechSynthesis.cancel();
            stopped = true;
        } else {
            console.log('Speech synthesis not speaking or pending, no need to cancel.');
        }
    } else {
         console.log('Speech synthesis not supported or available, cannot stop.');
    }
     // Always clear the utterance ref after attempting to stop or if it wasn't running
    if (utteranceRef.current) {
        // Explicitly remove event listeners to prevent memory leaks, especially on errors/interruptions
        utteranceRef.current.onstart = null;
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current = null;
        console.log('Utterance reference cleared.');
    }


    // Update state *after* operations, only if it needs changing
    if (isReading) {
        console.log('Setting isReading state to false.');
        setIsReading(false);
    } else if (stopped) {
        // If we issued a cancel but the state was already false, log it.
        console.log('Issued cancel, but isReading was already false.');
    }
  };


  // Restore form fields on error
   useEffect(() => {
        const prevState = state as GenerateScriptActionState;

        if (prevState.error && prevState.submittedKeyword !== undefined) {
            setKeyword(prevState.submittedKeyword);
        }
        if (prevState.error && prevState.submittedLength !== undefined) {
            setSelectedLength(prevState.submittedLength);
        }
         if (prevState.error && prevState.submittedTone !== undefined) {
            setSelectedTone(prevState.submittedTone);
        }
         if (prevState.error && prevState.submittedLanguage !== undefined) {
             const lang = prevState.submittedLanguage;
             // Include new languages in the check
             if (['en', 'hi', 'es', 'fr', 'de'].includes(lang)) {
               setSelectedLanguage(lang);
             }
         }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [state.error, state.submittedKeyword, state.submittedLength, state.submittedTone, state.submittedLanguage]);


  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  };

  const handleLengthChange = (value: string) => {
    const validLengths: ScriptLength[] = ['short', 'medium', 'long', 'hour'];
    if (validLengths.includes(value as ScriptLength)) {
      setSelectedLength(value as ScriptLength);
    } else {
        console.warn(`Invalid length value received: ${value}. Defaulting to 'medium'.`);
        setSelectedLength('medium'); // Default fallback
    }
  };

   const handleToneChange = (value: string) => {
    // Use the updated ConversationTone enum
    const validTones: ConversationTone[] = [
        'neutral', 'conversational', 'calm', 'friendly', 'professional',
        'enthusiastic', 'informative', 'humorous', 'empathetic', 'upbeat'
    ];
    if (validTones.includes(value as ConversationTone)) {
        setSelectedTone(value as ConversationTone);
    } else {
         console.warn(`Invalid tone value received: ${value}. Defaulting to 'conversational'.`);
        setSelectedTone('conversational');
    }
   };

   const handleLanguageChange = (value: string) => {
     // Include new languages
     const validLanguages: Language[] = ['en', 'hi', 'es', 'fr', 'de'];
     if (validLanguages.includes(value as Language)) {
         console.log(`Language changed to: ${value} (${getLanguageName(value as Language)})`);
         setSelectedLanguage(value as Language);
         // Stop playback immediately when language changes
         stopSpeechPlayback();
         // The useEffect hook listening to selectedLanguage handles voice list updates
     } else {
          console.warn(`Invalid language value received: ${value}. Defaulting to 'en'.`);
         setSelectedLanguage('en');
     }
   };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    stopSpeechPlayback(); // Ensure any ongoing speech is stopped before generating new script
    const formData = new FormData(event.currentTarget);
    // Make sure 'length', 'tone', and 'language' are explicitly set from state
    formData.set('length', selectedLength);
    formData.set('tone', selectedTone);
    formData.set('language', selectedLanguage);
    console.log('Submitting form with FormData:', Object.fromEntries(formData.entries()));
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

  // Placeholder for Audio Download
  const handleDownloadAudio = () => {
    if (!state.script) {
      toast({ variant: 'destructive', title: 'Error', description: 'No script available to generate audio.' });
      return;
    }
    if (!selectedVoiceURI) {
        const toastId = 'audio-download-no-voice';
         if (!toasts.some(t => t.id === toastId)) { // Check if toast is already active
            toast({
                id: toastId,
                variant: 'destructive',
                title: 'Voice Not Selected',
                description: `Please select a voice for ${getLanguageName(selectedLanguage)} to download the audio.`,
            });
        }
        return;
    }

    const toastId = 'audio-download-unavailable';
    if (!toasts.some(t => t.id === toastId)) { // Check if toast is already active
        toast({
        id: toastId,
        variant: 'warning',
        title: 'Audio Download Unavailable',
        description: 'Direct audio download requires a backend Text-to-Speech service. This feature is not implemented.',
        duration: 5000,
        });
    }
  };


  // Combined Play/Stop Handler
 const handlePlaybackToggle = async () => {
    console.log("handlePlaybackToggle called. isReading:", isReading);

    // --- Stop Reading ---
    if (isReading) {
      console.log('Stopping playback...');
      stopSpeechPlayback();
      return;
    }

    // --- Start Reading ---
    console.log("Attempting to start playback...");

    // Pre-checks
    if (!state.script) {
      console.error('No script available to read.');
      toast({ variant: 'destructive', title: 'Error', description: 'No script available to read.' });
      return;
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
       console.error('Speech Synthesis not supported.');
      toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Text-to-speech is not supported by your browser.' });
      return;
    }
     if (!areVoicesLoaded) {
         console.warn('Voices not loaded yet.');
         const toastId = 'voices-loading-playback';
         if (!toasts.some(t => t.id === toastId)) {
             toast({ id: toastId, variant: 'warning', title: 'Voices Loading', description: 'Please wait a moment for voices to load before playing.' });
         }
         return;
     }
     if (availableVoices.length === 0) {
          console.error(`No voices available for the selected language (${selectedLanguage} - ${getLanguageName(selectedLanguage)}).`);
           const toastId = 'no-voices-playback-error';
            if (!toasts.some(t => t.id === toastId)) {
                toast({ id: toastId, variant: 'destructive', title: 'No Voices Found', description: `Cannot play script. No voices found for ${getLanguageName(selectedLanguage)}.` });
            }
          return;
     }
     if (!selectedVoiceURI) {
          console.error('No voice selected.');
          const toastId = 'no-voice-selected-playback-error';
          if (!toasts.some(t => t.id === toastId)) { // Check if toast is already active
             toast({ id: toastId, variant: 'destructive', title: 'Voice Not Selected', description: `Please select a voice for ${getLanguageName(selectedLanguage)} first.` });
          }
        return;
     }

    console.log('Proceeding with speech synthesis setup...');

    try {
      // --- Ensure Clean State ---
      // Cancel any existing speech VERY explicitly before starting new utterance
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          console.log("Speech synthesis is speaking or pending. Cancelling previous utterance.");
          stopSpeechPlayback(); // Use our robust stop function

          // Wait a brief moment to allow the cancel command to process.
          // This is sometimes necessary, especially if called rapidly.
          await new Promise(resolve => setTimeout(resolve, 150));

           // Double-check cancellation worked
           if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
               console.warn("Cancellation might not have completed immediately. Waiting slightly longer.");
               await new Promise(resolve => setTimeout(resolve, 300)); // Longer wait
               if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                   console.error("FATAL: Failed to cancel previous speech synthesis. Playback aborted.");
                   toast({ variant: 'destructive', title: 'Playback Error', description: 'Could not stop the previous speech. Please try again.' });
                   setIsReading(false); // Ensure state is correct
                   utteranceRef.current = null;
                   return; // Abort playback attempt
               }
               console.log("Cancellation confirmed after extra wait.");
           } else {
                console.log("Cancellation confirmed.");
           }
      } else {
           console.log("Speech synthesis idle, proceeding.");
      }


      // --- Create and Configure Utterance ---
      const utterance = new SpeechSynthesisUtterance(state.script);
      utteranceRef.current = utterance; // Store the reference immediately

      const selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceURI);
      let specificLangTag: string;

      // Determine the specific language tag to set on the utterance, crucial for correct pronunciation
      switch (selectedLanguage) {
        case 'hi': specificLangTag = 'hi-IN'; break;
        case 'es': specificLangTag = 'es-ES'; break; // Or another locale like es-MX if preferred
        case 'fr': specificLangTag = 'fr-FR'; break;
        case 'de': specificLangTag = 'de-DE'; break;
        case 'en': specificLangTag = 'en-US'; break; // Or en-GB etc.
        default: specificLangTag = selectedLanguage; // Fallback to the base code
      }

      if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang; // Use the voice's specific language tag (e.g., 'hi-IN', 'en-US')
          console.log(`Using voice: ${selectedVoice.name} (${selectedVoice.lang}), URI: ${selectedVoice.voiceURI}`);
      } else {
        // This *shouldn't* happen if selectedVoiceURI is valid, but handle defensively
        console.warn(`Selected voice URI "${selectedVoiceURI}" not found in the current available voices list for ${selectedLanguage}. Attempting to use browser default based on language tag: ${specificLangTag}.`);
         utterance.lang = specificLangTag; // Set the determined specific language tag as a hint
        const toastId = 'voice-not-found-playback-warning';
         if (!toasts.some(t => t.id === toastId)) { // Check if toast is already active
            toast({
                id: toastId,
                variant: 'warning',
                title: 'Voice Not Found',
                description: `Selected voice was unavailable. Attempting to use a default voice for ${specificLangTag}. Playback quality may vary.`,
            });
         }
      }
       // **Crucial**: Ensure utterance.lang is set correctly even if a specific voice was found.
       // Some browsers might still need the explicit lang tag on the utterance itself.
       // Use the more specific tag determined earlier.
       if (utterance.lang !== specificLangTag) {
           console.log(`Overriding utterance lang from voice default (${utterance.lang}) to specific tag ${specificLangTag} for better compatibility.`);
           utterance.lang = specificLangTag;
       }


      // Set standard properties (optional, defaults are usually 1)
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1; // Ensure volume is max

      console.log('Utterance configured:', {
        textLength: utterance.text.length,
        lang: utterance.lang, // Log the final language tag set
        voiceName: utterance.voice?.name,
        rate: utterance.rate,
        pitch: utterance.pitch,
        volume: utterance.volume,
      });

      // --- Event Handlers ---
      utterance.onstart = () => {
        console.log('Speech playback started successfully.');
        setIsReading(true);
      };

      utterance.onend = () => {
        console.log('Speech playback finished naturally.');
        setIsReading(false);
        utteranceRef.current = null; // Clear ref *only* on natural end
      };

      utterance.onerror = (event) => {
        // More detailed error logging
        const errorMsg = event.error || 'Unknown speech error';
        console.error('SpeechSynthesisUtterance.onerror:', errorMsg, event);
        console.error('Utterance details on error:', {
             textSnippet: utterance.text.substring(0, 100) + "...",
             lang: utterance.lang,
             voiceName: utterance.voice?.name,
             voiceURI: utterance.voice?.voiceURI,
        });

        let description = `Could not read the script. `;
        let title = 'Speech Error';
        let variant: "destructive" | "warning" = "destructive";

        switch (errorMsg) {
            case 'interrupted':
                title = 'Speech Interrupted';
                description = `Playback was interrupted. This might be expected if you clicked Stop, generated a new script, or changed settings.`;
                variant = "warning";
                console.warn("Speech interrupted. This is often expected.");
                // State should already be handled by stopSpeechPlayback if triggered manually
                if (isReading) setIsReading(false); // Ensure consistency if interrupted externally
                break;
            case 'synthesis-failed':
                description += `The speech engine failed to synthesize the text. The selected voice might be incompatible, corrupted, or unable to process the script for the language '${utterance.lang}'. Try another voice.`;
                break;
            case 'audio-busy':
                description += `The audio output device is busy. Close other audio applications and try again.`;
                break;
            case 'audio-hardware':
                description += `There's an issue with your audio hardware. Check your speakers/headphones.`;
                break;
            case 'network':
                title = 'Network Error';
                description += `A network error occurred, possibly while trying to load a cloud-based voice. Check your internet connection.`;
                variant = "warning";
                break;
            case 'language-unavailable':
                description += `The language '${utterance.lang}' is not supported by the selected voice or speech engine. Please ensure you have voices installed for ${getLanguageName(selectedLanguage)}.`;
                break;
            case 'voice-unavailable':
                description += `The selected voice '${utterance.voice?.name}' is unavailable or invalid. Please select another voice.`;
                break;
             case 'text-toolong':
                 description += `The script is too long for the speech synthesis engine to process at once. Try generating a shorter script.`;
                 break;
             case 'invalid-argument':
                 description += `An invalid argument was provided to the speech synthesis engine. The script might contain unsupported characters for the selected voice/language.`;
                 break;
            default:
                description += `An unknown error occurred (${errorMsg}). Please try again or select a different voice.`;
        }

        // Show toast, avoiding duplicates for the same error type
        const toastId = `speech-error-${errorMsg}-${utterance.lang}`; // Include lang in ID for specificity
         if (!toasts.some(t => t.id === toastId)) { // Check if toast is already active
             toast({
               id: toastId,
               variant: variant,
               title: title,
               description: description,
               duration: errorMsg === 'interrupted' ? 3000 : 7000, // Shorter duration for interruption info
             });
         }

        // Ensure state is cleaned up on error
        if (isReading) {
           setIsReading(false);
        }
        utteranceRef.current = null; // Clear ref on error
      };

      // --- Start speech ---
      console.log("Calling window.speechSynthesis.speak() with utterance...");
      window.speechSynthesis.speak(utterance);
      // NOTE: speak() is asynchronous. The 'onstart' event marks the actual beginning.

    } catch (error) {
      console.error('Error within handlePlaybackToggle try-catch block:', error);
      const toastId = 'playback-toggle-catch-error';
       if (!toasts.some(t => t.id === toastId)) { // Check if toast is already active
             toast({
               id: toastId,
               variant: 'destructive',
               title: 'Unexpected Playback Error',
               description: `An unexpected error occurred while trying to play the script: ${error instanceof Error ? error.message : 'Unknown error'}`,
             });
       }
      // Ensure cleanup happens even if the try block fails before speak()
      stopSpeechPlayback();
    }
  };


  const handleVoiceChange = (value: string) => {
       // Check if the selected value is a valid voice URI from the current list
       const selected = availableVoices.find(v => v.voiceURI === value);
       if (selected) {
          setSelectedVoiceURI(value);
          console.log("Voice selected:", selected.name, `(${selected.lang}), URI: ${value}`);
          // Stop playback immediately if running with the old voice
          if (isReading) {
              console.log("Stopping playback due to voice change.");
              stopSpeechPlayback(); // Use the centralized stop function
          }
       } else if (value === "" || value === "loading" || value === "no-voices") {
           // Handle placeholder/disabled selections gracefully
            console.log(`Placeholder item selected in voice dropdown: ${value}`);
            setSelectedVoiceURI(undefined); // Clear selection if a placeholder was chosen
             if (isReading) {
               stopSpeechPlayback(); // Stop if reading
             }
       } else {
           // Handle cases where the selected value might be stale or invalid
           console.warn(`Attempted to select a voice URI (${value}) that is not currently available or valid for language ${selectedLanguage}. Clearing selection.`);
           setSelectedVoiceURI(undefined); // Clear selection
           if (isReading) {
               stopSpeechPlayback(); // Stop if reading
           }
           toast({ variant: 'warning', title: 'Voice Issue', description: 'The previously selected voice is no longer available. Please choose another.' });
       }
  };

   // Handler for font size change
   const handleFontSizeChange = (value: number[]) => {
        if (value && value.length > 0 && typeof value[0] === 'number') {
            const newSize = Math.max(10, Math.min(32, value[0])); // Clamp font size
             setFontSize(newSize);
        }
   };


  const isLoading = _isPending || isFormPending;

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
               {/* Show keyword-specific validation errors from server action */}
               {state.error && !state.script && state.submittedKeyword === keyword && state.error.toLowerCase().includes('keyword') && (
                <p className="text-sm text-destructive font-medium">{state.error}</p>
              )}
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
                            <SelectItem value="es" className="cursor-pointer">Spanish (Español)</SelectItem>
                            <SelectItem value="fr" className="cursor-pointer">French (Français)</SelectItem>
                            <SelectItem value="de" className="cursor-pointer">German (Deutsch)</SelectItem>
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
                            <SelectItem value="hour" className="cursor-pointer">Hour (~45-60 min)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                 {/* Tone Selection */}
                 <div className="space-y-2">
                    <Label htmlFor="tone-select" className="font-semibold text-foreground">Conversation Tone</Label>
                    <Select value={selectedTone} onValueChange={handleToneChange} disabled={isLoading} name="tone">
                        <SelectTrigger id="tone-select" className="w-full rounded-md shadow-sm" aria-label="Select script tone">
                        <SelectValue placeholder="Select tone..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-md shadow-lg">
                            {/* Updated Tone Options */}
                            <SelectItem value="conversational" className="cursor-pointer">Conversational</SelectItem>
                            <SelectItem value="calm" className="cursor-pointer">Calm</SelectItem>
                            <SelectItem value="friendly" className="cursor-pointer">Friendly</SelectItem>
                            <SelectItem value="professional" className="cursor-pointer">Professional</SelectItem>
                            <SelectItem value="enthusiastic" className="cursor-pointer">Enthusiastic</SelectItem>
                            <SelectItem value="informative" className="cursor-pointer">Informative</SelectItem>
                            <SelectItem value="humorous" className="cursor-pointer">Humorous</SelectItem>
                            <SelectItem value="empathetic" className="cursor-pointer">Empathetic</SelectItem>
                            <SelectItem value="upbeat" className="cursor-pointer">Upbeat</SelectItem>
                            <SelectItem value="neutral" className="cursor-pointer">Neutral</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Voice Selection Dropdown */}
                <div className="space-y-2">
                    <Label htmlFor="voice-select" className="font-semibold text-foreground">Voice</Label>
                    <Select
                         value={selectedVoiceURI || ""} // Use empty string if undefined to match SelectItem value
                         onValueChange={handleVoiceChange}
                         // Disable if voices are loading OR no voices are available OR the main form is submitting
                         disabled={!areVoicesLoaded || availableVoices.length === 0 || isLoading}
                         name="voice-select"
                     >
                        <SelectTrigger id="voice-select" className="w-full rounded-md shadow-sm" aria-label="Select reading voice">
                             {/* Dynamic placeholder based on loading state and availability */}
                            <SelectValue placeholder={
                                !areVoicesLoaded ? "Loading voices..." :
                                availableVoices.length > 0 ? "Select a voice..." :
                                `No ${getLanguageName(selectedLanguage)} voices found`
                            } />
                        </SelectTrigger>
                        <SelectContent className="rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {!areVoicesLoaded ? (
                                <SelectItem value="loading" disabled className="text-muted-foreground">Loading...</SelectItem>
                            ) : availableVoices.length > 0 ? (
                                // Map through available voices
                                availableVoices.map((voice) => (
                                    <SelectItem key={voice.voiceURI} value={voice.voiceURI} className="cursor-pointer">
                                        {voice.name} ({voice.lang}) {voice.default ? '[Default]' : ''}
                                    </SelectItem>
                                ))
                            ) : (
                                // Display if no voices found for the language
                                <SelectItem value="no-voices" disabled className="text-destructive">
                                    No {getLanguageName(selectedLanguage)} voices found
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                     {/* Helper text below dropdown */}
                     {!areVoicesLoaded && <p className="text-xs text-muted-foreground pt-1">Loading available voices...</p>}
                     {areVoicesLoaded && availableVoices.length === 0 && (
                         <p className="text-xs text-destructive pt-1">
                             No voices found for {getLanguageName(selectedLanguage)} in your browser/OS. Playback unavailable.
                         </p>
                     )}
                </div>


                 {/* Font Size Slider - Spanning full width */}
                 <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label htmlFor="fontsize-slider" className="font-semibold text-foreground">Script Font Size ({fontSize}px)</Label>
                    <Slider
                        id="fontsize-slider"
                        min={10} // Min font size
                        max={32} // Max font size
                        step={1}
                        value={[fontSize]}
                        onValueChange={handleFontSizeChange}
                        disabled={isLoading}
                        className="w-full cursor-pointer"
                        aria-label="Adjust script font size"
                    />
                </div>
            </div>


            {/* Generate Button */}
            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] focus:scale-[1.02] focus:ring-2 focus:ring-ring focus:ring-offset-2"
              disabled={isLoading || !keyword.trim()}
              aria-label="Generate podcast script based on current settings"
              aria-live="polite" // Announce changes in loading state
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Generating...</>
              ) : (
                'Generate Script'
              )}
            </Button>
             {/* Display general errors from server action if script wasn't generated */}
             {state.error && !state.script && (
                 <div className="mt-2 text-sm text-destructive font-medium text-center p-2 bg-destructive/10 rounded-md border border-destructive/30">
                    <p role="alert">{state.error}</p>
                 </div>
             )}
          </form>

          {/* Script Display Area - Only show if script exists */}
          {state.script && (
            <div className="mt-8 space-y-2">
              <Label htmlFor="script-output" className="text-lg font-semibold text-foreground">Generated Script</Label>
              <div className="relative group/script-area"> {/* Added group name */}
                <Textarea
                  id="script-output" // Changed ID for clarity
                  value={state.script}
                  readOnly
                  // Apply font size and line height dynamically
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
                  // Use Tailwind classes for base styling
                  className="min-h-[250px] bg-secondary rounded-md shadow-inner p-4 text-base w-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  aria-label="Generated podcast script text"
                  aria-live="polite" // Announce script updates
                />
                 {/* Action Buttons Overlay */}
                 <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 bg-background/70 backdrop-blur-sm p-1 rounded-md shadow transition-opacity opacity-100 md:opacity-0 md:group-hover/script-area:opacity-100 focus-within:opacity-100">
                    {/* Play/Stop Button */}
                   <Button
                     variant="ghost"
                     size="icon"
                     className="text-foreground hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                     onClick={handlePlaybackToggle}
                     aria-label={isReading ? "Stop reading script" : "Read script aloud"}
                     // Disable conditions: form loading, voices not loaded, no voices for lang, no voice selected, no script text
                     disabled={isLoading || !areVoicesLoaded || availableVoices.length === 0 || !selectedVoiceURI || !state.script}
                     title={isReading ? "Stop Playback" : (isLoading ? "Generating..." : (!state.script ? "No script" : (!areVoicesLoaded ? "Voices loading..." : (availableVoices.length === 0 ? `No ${getLanguageName(selectedLanguage)} voices` : (!selectedVoiceURI ? "Select voice" : "Read Aloud")))))} // Detailed title
                     aria-live="polite" // Announce reading state changes
                   >
                     {isReading ? <Square className="h-5 w-5" aria-hidden="true"/> : <Play className="h-5 w-5" aria-hidden="true"/>}
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
                        <Copy className="h-5 w-5" aria-hidden="true"/>
                    </Button>
                     {/* Download Text Button */}
                     <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground hover:bg-accent/20 disabled:opacity-50"
                        onClick={handleDownload}
                        aria-label="Download script as text file"
                        disabled={isLoading || !state.script}
                        title="Download Script (.txt)"
                      >
                        <Download className="h-5 w-5" aria-hidden="true"/>
                     </Button>
                     {/* Download Audio Button (Placeholder/Disabled) */}
                     <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleDownloadAudio}
                        aria-label="Download script as audio file (Feature not available)"
                        // Disable audio download if no script or no voice selected, or generally unavailable
                        disabled={isLoading || !state.script || !selectedVoiceURI || !areVoicesLoaded || availableVoices.length === 0}
                        title="Download Audio (Feature Unavailable)"
                      >
                        <AudioWaveform className="h-5 w-5" aria-hidden="true"/>
                     </Button>
                 </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-center pt-4 border-t mt-4">
          Powered by Generative AI & Browser Speech Synthesis
        </CardFooter>
      </Card>
    </main>
  );
}

    