"use client";

import { useEffect, useRef, useState } from "react";

type VideoQuestion = {
  id: string;
  question: string;
  options: string[] | null;
  correctAnswer: string | null;
  eventTime: number | null;
  isNote: boolean;
};

type VideoLessonProps = {
  lesson: {
    id: string;
    title: string;
    videoId: string | null;
    videoDuration: number | null;
    content: string | null;
  };
  enrollmentId: string;
  questions: VideoQuestion[];
  onSubmitted?: () => void;
};

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getPlayerState: () => number;
};

const POLL_MS = 250;
const TOLERANCE_S = 0.5;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function VideoLessonPlayer({ lesson, enrollmentId, questions, onSubmitted }: VideoLessonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [activeEvent, setActiveEvent] = useState<VideoQuestion | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [videoDuration, setVideoDuration] = useState(lesson.videoDuration ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ scorePct: number; totalQuestions: number } | null>(null);
  const [error, setError] = useState("");

  const lastReportedRef = useRef(0);
  const activeEventRef = useRef<VideoQuestion | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const durationRef = useRef(lesson.videoDuration ?? 0);
  const timedRef = useRef<VideoQuestion[]>([]);

  useEffect(() => {
    activeEventRef.current = activeEvent;
  }, [activeEvent]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const timedQuestions = questions
    .filter((q) => q.eventTime != null && !q.isNote)
    .sort((a, b) => (a.eventTime ?? 0) - (b.eventTime ?? 0));

  timedRef.current = timedQuestions;

  useEffect(() => {
    durationRef.current = videoDuration;
  }, [videoDuration]);

  function reportWatch(sec: number, done?: boolean) {
    const dur = durationRef.current;
    const capped = Math.min(Math.max(0, sec), dur || sec);
    if (done || capped - lastReportedRef.current >= 5) {
      lastReportedRef.current = capped;
      fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "video-watch",
          enrollmentId,
          lessonId: lesson.id,
          watchSeconds: capped,
          completed: done,
        }),
      }).catch(() => undefined);
    }
  }

  function getTriggeredQuestion(currentTime: number): VideoQuestion | null {
    if (activeEventRef.current) return null;
    for (const q of timedRef.current) {
      const qTime = q.eventTime ?? 0;
      const isAnswered = Boolean(answersRef.current[q.id]);
      if (!isAnswered && currentTime >= qTime - TOLERANCE_S) {
        return q;
      }
    }
    return null;
  }

  useEffect(() => {
    if (!lesson.videoId || typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      document.head.appendChild(tag);
    }

    const poll = setInterval(() => {
      if (cancelled) return;
      try {
        if (!playerRef.current || typeof playerRef.current.getCurrentTime !== "function") return;
        const t = playerRef.current.getCurrentTime() ?? 0;
        setWatchSeconds(Math.round(t));
        reportWatch(Math.round(t));

        // Check if a question at this second should trigger
        const qToTrigger = getTriggeredQuestion(t);
        if (qToTrigger) {
          playerRef.current.pauseVideo();
          setActiveEvent(qToTrigger);
        }
      } catch {
        // Player not yet fully initialized
      }
    }, POLL_MS);

    const onApiReady = () => {
      if (cancelled || !container) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const YT = (window as any).YT;
        if (!YT?.Player) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playerRef.current = new YT.Player(container, {
          videoId: lesson.videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: typeof window !== "undefined" ? window.location.origin : undefined },
          events: {
            onReady: () => {
              try {
                const dur = playerRef.current?.getDuration() ?? lesson.videoDuration ?? 0;
                if (dur > 0) setVideoDuration(dur);
              } catch {
                setVideoDuration(lesson.videoDuration ?? 0);
              }
            },
            onStateChange: (e: { data: number }) => {
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (e.data === 1) setIsPlaying(true);
              else if (e.data === 2) setIsPlaying(false);
              else if (e.data === 0) {
                setIsPlaying(false);
                reportWatch(durationRef.current || 99999, true);
              }
            },
          },
        });
      } catch {
        // API init failed
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).YT?.Player !== "undefined") {
      onApiReady();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).onYouTubeIframeAPIReady = onApiReady;
    }

    return () => {
      cancelled = true;
      clearInterval(poll);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).onYouTubeIframeAPIReady = undefined;
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.videoId, lesson.id]);

  function handleAnswerSubmit() {
    if (!activeEvent) return;
    const currentAnswer = answers[activeEvent.id];
    if (!currentAnswer) return;

    // Record answer
    answersRef.current[activeEvent.id] = currentAnswer;
    const answeredCount = Object.keys(answersRef.current).length;
    const allDone = answeredCount >= timedQuestions.length;

    // Close modal & resume video playback
    setActiveEvent(null);
    try {
      playerRef.current?.playVideo();
    } catch {
      // ignore
    }

    // If all questions answered, optionally auto-submit
    if (allDone) {
      handleFinish();
    }
  }

  async function handleFinish() {
    if (timedQuestions.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/lms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "video-submit",
          enrollmentId,
          lessonId: lesson.id,
          answers: timedQuestions.map((q) => ({
            questionId: q.id,
            answerText: answersRef.current[q.id] ?? answers[q.id] ?? "",
          })),
        }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setResult(d.data);
        setSubmitted(true);
        onSubmitted?.();
      } else {
        setError(d.message ?? "Gagal mengirim jawaban");
      }
    } catch {
      setError("Terjadi kesalahan koneksi saat mengirim jawaban");
    } finally {
      setSubmitting(false);
    }
  }

  if (!lesson.videoId) {
    return (
      <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600">
        <p className="font-bold text-slate-900 mb-1">{lesson.title}</p>
        <p className="whitespace-pre-line">{lesson.content || "Tidak ada video untuk materi ini."}</p>
      </div>
    );
  }

  const answeredCount = timedQuestions.filter((q) => Boolean(answers[q.id])).length;
  const watchPct = videoDuration > 0 ? Math.min(100, Math.round((watchSeconds / videoDuration) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Video Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-black shadow-sm">
        <div ref={containerRef} className="w-full aspect-video" />

        {/* Live Cue Points Bar underneath video */}
        {timedQuestions.length > 0 && videoDuration > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-800/80">
            {timedQuestions.map((q) => {
              const posPct = Math.min(100, Math.max(0, ((q.eventTime ?? 0) / videoDuration) * 100));
              const isAnswered = Boolean(answers[q.id]);
              return (
                <div
                  key={q.id}
                  style={{ left: `${posPct}%` }}
                  title={`Soal @ ${formatTime(q.eventTime ?? 0)}: ${q.question}`}
                  className={`absolute -top-1 w-3 h-3 -ml-1.5 rounded-full border-2 border-white shadow transition-transform hover:scale-125 ${
                    isAnswered ? "bg-emerald-500" : "bg-purple-600 animate-pulse"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Progress & Checkpoint Overview */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div className="flex items-center gap-4">
          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <i className="fa-solid fa-play text-blue-600" />
            Waktu: <strong className="font-mono text-slate-800">{formatTime(watchSeconds)}</strong> / {formatTime(videoDuration)} ({watchPct}%)
          </span>
          {timedQuestions.length > 0 && (
            <span className="text-slate-600 flex items-center gap-1.5 font-medium">
              <i className="fa-solid fa-circle-question text-purple-600" />
              Soal: <strong className="text-purple-700">{answeredCount}/{timedQuestions.length} Terjawab</strong>
            </span>
          )}
        </div>

        {timedQuestions.length > 0 && !submitted && (
          <div className="flex items-center gap-1.5">
            {timedQuestions.map((q, idx) => (
              <span
                key={q.id}
                title={`Soal ${idx + 1} @ ${formatTime(q.eventTime ?? 0)}`}
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border transition ${
                  answers[q.id]
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {answers[q.id] ? "✓" : idx + 1}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE TIMED QUESTION MODAL OVERLAY */}
      {activeEvent && !submitted && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-clock" />
                  Detik ke-{activeEvent.eventTime ?? 0} ({formatTime(activeEvent.eventTime ?? 0)})
                </span>
              </div>
              <span className="text-xs font-bold text-slate-400">
                Soal {timedQuestions.findIndex((q) => q.id === activeEvent.id) + 1} dari {timedQuestions.length}
              </span>
            </div>

            <div>
              <h4 className="font-bold text-base text-slate-900 leading-snug">
                {activeEvent.question}
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Video dijeda otomatis. Pilih jawaban yang benar untuk melanjutkan video.
              </p>
            </div>

            <div className="space-y-2.5">
              {(activeEvent.options ?? []).map((opt, idx) => {
                const isSelected = answers[activeEvent.id] === opt;
                const letter = String.fromCharCode(65 + idx);
                return (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3.5 border-2 rounded-2xl cursor-pointer transition text-xs font-medium ${
                      isSelected
                        ? "border-purple-600 bg-purple-50/70 text-purple-950 shadow-sm"
                        : "border-slate-200 hover:border-purple-200 hover:bg-slate-50 text-slate-700 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`active-q-${activeEvent.id}`}
                      checked={isSelected}
                      onChange={() => setAnswers((prev) => ({ ...prev, [activeEvent.id]: opt }))}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-400 w-4">{letter}.</span>
                    <span className="flex-1">{opt}</span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAnswerSubmit}
              disabled={!answers[activeEvent.id]}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl text-xs transition shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-play text-xs" />
              <span>Jawab & Lanjutkan Video</span>
            </button>
          </div>
        </div>
      )}

      {/* Result feedback */}
      {(submitted || result) && result && (
        <div
          className={`p-5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            result.scorePct >= 70
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <i className={`fa-solid ${result.scorePct >= 70 ? "fa-circle-check text-emerald-600 text-xl" : "fa-triangle-exclamation text-red-600 text-xl"}`} />
            <div>
              <div className="text-sm">Skor Materi Video: {result.scorePct}/100</div>
              <div className="text-[11px] font-normal text-slate-600">
                {result.scorePct >= 70 ? "🎉 Selamat! Anda memenuhi standar kelulusan materi ini." : "⚠️ Skor masih di bawah standar kelulusan (70)."}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-600" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
