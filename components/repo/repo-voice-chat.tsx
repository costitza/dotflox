"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mic, Volume2 } from "lucide-react";

type RepoVoiceChatProps = {
  repoId: Id<"repos">;
};

type ChatTurn = {
  question: string;
  answer: string;
};

export function RepoVoiceChat({ repoId }: RepoVoiceChatProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const repo = useQuery(api.app.getRepo, { repoId });
  const techStack = useQuery(api.app.listTechStackItemsForRepo, { repoId });
  const pullRequests = useQuery(api.app.listPullRequestsForRepo, { repoId });
  const contributorsDetailed = useQuery(
    api.app.listRepoContributorsDetailed,
    { repoId },
  );
  const calls = useQuery(api.app.listCallsForRepo, { repoId });
  const analysisSessions = useQuery(
    api.app.listAnalysisSessionsForRepo,
    { repoId },
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const isContextReady = Boolean(
    repo && techStack && pullRequests && contributorsDetailed && calls && analysisSessions,
  );

  function handleRecordClick() {
    if (!isContextReady || isProcessing) return;

    if (isRecording) {
      // Stop current recording
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      setIsRecording(false);
      return;
    }

    // Start a new recording from the microphone
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          void processAudioBlob(blob);
        };

        recorder.start();
        setIsRecording(true);
      })
      .catch((err) => {
        console.error(err);
        setError(
          "Unable to access microphone. Check browser permissions and try again.",
        );
      });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await processAudioBlob(file);
  }

  async function processAudioBlob(file: Blob | File) {
    if (!repo || !techStack || !pullRequests || !contributorsDetailed || !calls || !analysisSessions) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1) Transcribe audio → text via ElevenLabs /api/listen
      const formData = new FormData();
      formData.set("audio", file);
      formData.set("model", "eleven_multilingual_v2");

      const listenRes = await fetch("/api/listen", {
        method: "POST",
        body: formData,
      });

      if (!listenRes.ok) {
        throw new Error("Failed to transcribe audio question.");
      }

      const listenData = (await listenRes.json()) as { text?: string };
      const questionText = listenData.text?.trim();

      if (!questionText) {
        throw new Error("Transcription did not return any text.");
      }

      setLastQuestion(questionText);

      // 2) Build repo context from Convex data
      const contextLines: string[] = [];
      contextLines.push(`Repository: ${repo.repoOwner}/${repo.repoName}`);
      if (repo.description) {
        contextLines.push(`Description: ${repo.description}`);
      }
      contextLines.push(`Default branch: ${repo.defaultBranch}`);
      contextLines.push(`GitHub URL: ${repo.url}`);

      if (techStack.length > 0) {
        const techSummary = techStack
          .map((item) =>
            item.version ? `${item.name}@${item.version}` : item.name,
          )
          .join(", ");
        contextLines.push(`Tech stack: ${techSummary}`);
      }

      contextLines.push(`Total pull requests tracked: ${pullRequests.length}`);
      contextLines.push(
        `Contributors tracked: ${contributorsDetailed.length}`,
      );
      contextLines.push(`Calls recorded: ${calls.length}`);
      contextLines.push(`Analyses run: ${analysisSessions.length}`);

      let context = contextLines.join("\n");

      if (turns.length > 0) {
        const history = turns
          .map(
            (t, idx) =>
              `Turn ${idx + 1} - Q: ${t.question}\nA: ${t.answer}`,
          )
          .join("\n\n");
        context = `${context}\n\nPrevious conversation:\n${history}`;
      }

      // 3) Ask repo assistant for an answer
      const qaRes = await fetch("/api/repo-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: questionText,
          context,
        }),
      });

      if (!qaRes.ok) {
        throw new Error("Failed to get an answer about this repository.");
      }

      const qaData = (await qaRes.json()) as { answer?: string };
      const answerText =
        qaData.answer?.trim() ?? "I was unable to generate an answer.";

      setLastAnswer(answerText);
      setTurns((prev) => [...prev, { question: questionText, answer: answerText }]);

      // 4) Convert answer to speech and play it
      const speakRes = await fetch("/api/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: answerText }),
      });

      if (!speakRes.ok) {
        throw new Error("Failed to generate spoken answer.");
      }

      const blob = await speakRes.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong processing your question.";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-900">
            Repo voice assistant
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Ask a question about this repository using your voice and listen to
            the answer.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          capture="user"
          className="hidden"
          onChange={handleFileChange}
        />

        <Button
          type="button"
          onClick={handleRecordClick}
          disabled={!isContextReady}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#2563eb] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8] disabled:opacity-60"
        >
          <Mic className="h-4 w-4" />
          {isProcessing
            ? "Processing your question…"
            : !isContextReady
              ? "Loading repo context…"
              : isRecording
                ? "Stop recording"
                : "Hold a conversation"}
        </Button>

        {lastQuestion && (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <p className="font-medium text-slate-800">Last question:</p>
            <p className="mt-0.5">{lastQuestion}</p>
          </div>
        )}

        {lastAnswer && (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[#2563eb]">
              <Volume2 className="h-3 w-3" />
            </div>
            <p className="leading-relaxed">
              <span className="font-medium text-slate-800">Spoken answer:</span>{" "}
              {lastAnswer}
            </p>
          </div>
        )}

        {error && (
          <p className="text-[11px] font-medium text-rose-600">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}


