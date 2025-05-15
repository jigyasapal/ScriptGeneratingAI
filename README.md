# Podcast Pilot

This is a Next.js application built in Firebase Studio that allows you to generate podcast scripts using AI, listen to them with text-to-speech, and customize various aspects of the script and playback.
This Next.js application uses Genkit and the Google AI plugin to generate podcast scripts based on user-provided keywords, length, tone, and language preferences. It leverages the browser's built-in Speech Synthesis API for text-to-speech playback and offers options to customize the voice and font size.

# Working
AI-Powered Script Generation (Genkit & Google AI):
Genkit orchestrates the AI flow, taking user inputs and feeding them to the Google AI model (Gemini).
A prompt is defined to instruct the AI model on how to generate a podcast script, emphasizing a natural, human-like tone. The prompt includes the keyword, desired script length, tone, and language.
The Google AI model generates a script based on the prompt.
The generated script is validated against a schema to ensure it conforms to the expected format.

User Interface (Next.js & Shadcn UI):
Next.js provides the full-stack framework for building the user interface.
The UI includes input fields for the keyword, and dropdowns to select the desired script length, tone, and language.
A "Generate Script" button triggers the script generation process.
The generated script is displayed in a textarea element.
Controls are provided to play the script using text-to-speech, copy the script to the clipboard, and download the script as a text file.

Text-to-Speech Playback (Web Speech API):
The browser's built-in Speech Synthesis API is used to read the generated script aloud.
Users can select a voice from the available voices on their system.
The application handles voice selection, language settings, and error conditions.
Playback can be started and stopped using a play/stop button.

Form Handling (Server Actions):
Next.js Server Actions are used to handle form submissions and interact with the Genkit AI flow.
The generateScriptAction function validates the user inputs and calls the generatePodcastScript function from the AI flow.
The action returns the generated script or any error messages to the client.

State Management (React Hooks):
useState is used to manage the input field values, selected script length, tone, language, voice, and font size.
useTransition is used to manage the loading state during script generation.
useRef is used to store references to the audio context and audio buffer.
useActionState is used to manage the form state and handle server action responses.

Styling (Tailwind CSS):
Tailwind CSS is used to style the user interface components.
Custom CSS variables are defined to control the color scheme and other visual aspects of the application.


