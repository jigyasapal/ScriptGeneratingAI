'use client';

import type {ChangeEvent, FormEvent} from 'react';
import React, {useState, useTransition, useRef, useActionState, useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Copy, Loader2, Music, Play, Square, VolumeX} from 'lucide-react';
import {useToast} from '@/hooks/use-toast';
import {generateScriptAction, type GenerateScriptActionState} from './actions';

export default function Home() {
  const {toast} = useToast();
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false); // State for muting music

  // Refs for Web Audio API
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null); // Ref for volume control

  // Refs for Speech Synthesis
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const initialState: GenerateScriptActionState = {};
  const [state, formAction, isFormPending] = useActionState(generateScriptAction, initialState);

  // Load background music on component mount
  useEffect(() => {
    const loadMusic = async () => {
      try {
        // Check if AudioContext is supported
        if (!window.AudioContext && !window.webkitAudioContext) {
           console.warn('Web Audio API is not supported in this browser.');
           toast({ variant: "destructive", title: "Audio Error", description: "Background music requires a modern browser." });
           return;
        }
        // Use existing context or create one - moved context creation to handleReadAloud interaction
        // const AudioContext = window.AudioContext || window.webkitAudioContext;
        // audioContextRef.current = new AudioContext(); // Create context here if needed universally

        // Ensure you have a `public/background-music.mp3` file.
        console.log('Fetching background music...');
        const response = await fetch('/background-music.mp3');
        if (!response.ok) {
            // Log the actual status text for more details
            console.error(`Music file fetch failed: ${response.status} ${response.statusText}`);
            throw new Error(`Music file not found or fetch failed (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Create a *temporary* context just for decoding, as the main one should be created on user interaction
        const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Decoding audio data...');
        audioBufferRef.current = await tempAudioContext.decodeAudioData(arrayBuffer);
        await tempAudioContext.close(); // Close the temporary context
        console.log('Background music loaded successfully.');

      } catch (error) {
        console.error('Error loading background music:', error);
        toast({
          variant: 'destructive',
          title: 'Audio Load Error',
          description: `Failed to load background music: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        audioBufferRef.current = null; // Ensure buffer is null on error
      }
    };

    loadMusic();

    // Cleanup audio resources on unmount
    return () => {
      console.log('Cleaning up audio resources...');
      // Stop any active playback
      stopAudioPlayback();
      // Close the main AudioContext if it exists
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
        audioSourceRef.current.disconnect(); // Disconnect the node
        console.log('Background music stopped and disconnected.');
      } catch (error) {
        // Ignore errors like "cannot call stop more than once" or if context is already closed
        console.warn('Ignoring error during audio source stop/disconnect:', error);
      }
      audioSourceRef.current = null;
    }
    // Don't close the context here, reuse it
    // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    //   audioContextRef.current.close().catch(console.error);
    //   audioContextRef.current = null;
    // }
    setIsReading(false); // Update state after stopping everything
  };


  // Stop audio if script changes
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
        // Create AudioContext on user interaction if needed
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          console.log('Creating new AudioContext...');
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if(!AudioContext) throw new Error("Web Audio API not supported");
          audioContextRef.current = new AudioContext();
        }
        // Resume context if suspended (required by browser autoplay policies)
        if (audioContextRef.current.state === 'suspended') {
            console.log('Resuming suspended AudioContext...');
            await audioContextRef.current.resume();
        }

        // Check if music buffer is loaded
        if (!audioBufferRef.current) {
          toast({ variant: 'destructive', title: 'Audio Error', description: 'Background music buffer not loaded yet. Please wait or try refreshing.' });
          console.warn('Audio buffer is not loaded.');
           // Don't proceed with music playback if buffer isn't ready
        } else {
            // Ensure previous source is stopped and disconnected before creating a new one
            if (audioSourceRef.current) {
                try {
                    audioSourceRef.current.stop();
                    audioSourceRef.current.disconnect();
                 } catch (e) { console.warn("Error stopping previous audio source:", e)}
                 audioSourceRef.current = null;
            }
             if (gainNodeRef.current) {
                 gainNodeRef.current.disconnect();
                 gainNodeRef.current = null;
            }


            // Create Audio Source and Gain Node
            console.log('Setting up audio source and gain node...');
            if (!audioContextRef.current) throw new Error("AudioContext lost"); // Should not happen, but check
            audioSourceRef.current = audioContextRef.current.createBufferSource();
            audioSourceRef.current.buffer = audioBufferRef.current;
            audioSourceRef.current.loop = true; // Loop the background music

            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.setValueAtTime(isMusicMuted ? 0 : 0.3, audioContextRef.current.currentTime); // Start with initial volume (lower for background)

            // Connect nodes: Source -> Gain -> Destination (speakers)
            audioSourceRef.current.connect(gainNodeRef.current);
            gainNodeRef.current.connect(audioContextRef.current.destination);

            // Start music playback
            console.log('Starting background music...');
            audioSourceRef.current.start(0); // Start immediately
        }

      } catch (error) {
        console.error('Error setting up Web Audio:', error);
        toast({ variant: 'destructive', title: 'Audio Setup Error', description: `Failed to initialize background music: ${error instanceof Error ? error.message : 'Unknown error'}` });
        stopAudioPlayback(); // Cleanup on error
        return; // Don't proceed if audio setup fails
      }

      // 2. --- Initialize Speech Synthesis ---
      try {
        console.log('Setting up speech synthesis...');
        // Cancel any previous speech
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(state.script);
        utteranceRef.current = utterance; // Store utterance ref

        // Get available voices
        const voices = speechSynthesis.getVoices();
         // If voices are not loaded yet, wait for them (async loading issue)
        if (voices.length === 0 && 'onvoiceschanged' in speechSynthesis) {
            console.log('Voices not loaded yet, waiting for onvoiceschanged event...');
            speechSynthesis.onvoiceschanged = () => {
                console.log('Voices loaded, retrying read aloud...');
                // Remove listener *before* retrying to avoid infinite loop on some browsers
                speechSynthesis.onvoiceschanged = null;
                handleReadAloud(); // Retry after voices load
            };
            // Need to clean up audio if we exit here temporarily
            if(audioSourceRef.current) {
                 try {
                     audioSourceRef.current.stop();
                     audioSourceRef.current.disconnect();
                 } catch (e) { console.warn("Error stopping audio source while waiting for voices:", e); }
                 audioSourceRef.current = null;
            }
            return; // Exit for now, will retry
        }


        // Attempt to select a suitable voice (example: English, non-local)
        let preferredVoice = voices.find(voice => voice.lang.startsWith('en') && !voice.localService && voice.name.includes('Google')); // Prioritize Google voices
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('en') && !voice.localService); // Then other non-local English
        if (!preferredVoice) preferredVoice = voices.find(voice => voice.lang.startsWith('en')); // Fallback to any English voice

        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log(`Using voice: ${preferredVoice.name} (${preferredVoice.lang})`);
        } else {
          console.warn('Could not find a preferred English voice. Using default.');
        }

        // Adjust pitch and rate for a more podcast-like feel (optional)
        // utterance.pitch = 1.1; // Slightly higher pitch
        // utterance.rate = 0.95; // Slightly slower rate

        // Event Handlers for Speech Synthesis
        utterance.onstart = () => {
          console.log('Speech started.');
          setIsReading(true); // Set reading state *after* speech actually starts
        };

        utterance.onend = () => {
          console.log('Speech finished.');
          // Keep music playing - user stops manually.
          setIsReading(false); // Only mark speech as finished
          utteranceRef.current = null;
          // If you want music to stop when speech ends, uncomment:
          // stopAudioPlayback();
        };

        utterance.onerror = (event) => {
          console.error('SpeechSynthesisUtterance.onerror', event.error);
          toast({
            variant: 'destructive',
            title: 'Speech Error',
            description: `Could not read the script aloud: ${event.error || 'Unknown error'}`,
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
        stopAudioPlayback(); // Cleanup if setup fails
      }
    }
  };

  const handleToggleMusicMute = () => {
    if (!gainNodeRef.current || !audioContextRef.current) return;

    const newMuteState = !isMusicMuted;
    setIsMusicMuted(newMuteState);

    // Set gain to 0 if muted, or back to 0.3 if unmuted
    const targetVolume = newMuteState ? 0 : 0.3;
    // Use setTargetAtTime for a smoother transition (optional)
    gainNodeRef.current.gain.setTargetAtTime(targetVolume, audioContextRef.current.currentTime, 0.01); // Quick fade
    // Or set immediately: gainNodeRef.current.gain.setValueAtTime(targetVolume, audioContextRef.current.currentTime);

    console.log(`Music ${newMuteState ? 'muted' : 'unmuted'}`);
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
                  className="min-h-[300px] text-base bg-secondary"
                  aria-label="Generated podcast script"
                />
                <div className="absolute top-2 right-2 flex space-x-1">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleReadAloud}
                    aria-label={isReading ? "Stop reading script" : "Read script aloud with background music"}
                    disabled={isLoading} // Only disable if generating
                    title={isReading ? "Stop Playback" : "Read Aloud with Music"}
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
