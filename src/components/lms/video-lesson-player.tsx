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
};

export default function VideoLessonPlayer({ lesson, enrollmentId, questions, onSubmitted }: VideoLessonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [activeEvent, setActiveEvent] = useState<VideoQuestion | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [videoDuration, setVideoDuration] = useState(lesson.videoDuration ?? 0);
  const [completed, setCompleted] = useState(false);
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

  useEffect(() => {
    if (!lesson.videoId || typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.head.appendChild(tag);

    const poll = setInterval(() => {
      if (cancelled) return;
      try {
        const t = playerRef.current?.getCurrentTime() ?? 0;
        setWatchSeconds(Math.round(t));
        reportWatch(Math.round(t));
        const due = timedRef.current.find(
          (q) => (q.eventTime ?? 0) <= Math.floor(t) + 1 && !answersRef.current[q.id] && activeEventRef.current?.id !== q.id
        );
        if (due) {
          setActiveEvent(due);
          playerRef.current?.pauseVideo();
        }
      } catch {
        // player not ready yet
      }
    }, 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).onYouTubeIframeAPIReady = () => {
      if (cancelled || !container) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const YT = (window as any).YT;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playerRef.current = new YT.Player(container, {
          videoId: lesson.videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              try {
                const dur = playerRef.current?.getDuration() ?? lesson.videoDuration ?? 0;
                setVideoDuration(dur);
              } catch {
                setVideoDuration(lesson.videoDuration ?? 0);
              }
            },
            onStateChange: (e: { data: number }) => {
              if (e.data === 0) {
                setCompleted(true);
                reportWatch(videoDuration || 99999, true);
              }
            },
          },
        });
      } catch {
        // API load failed
      }
    };

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

  function handleEventAnswer() {
    if (!activeEvent) return;
    const next = timedQuestions.find((q) => (q.eventTime ?? 0) > (activeEvent.eventTime ?? 0));
    setActiveEvent(next ?? null);
    playerRef.current?.playVideo();
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
          answers: timedQuestions.map((q) => ({ questionId: q.id, answerText: answersRef.current[q.id] ?? "" })),
        }),
      });
      const d = await r.json();
      if (d.status === "success") {
        setResult(d.data);
        setSubmitted(true);
        setCompleted(true);
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

  const watchPct = videoDuration > 0 ? Math.round((watchSeconds / videoDuration) * 100) : 0;

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="w-full aspect-video rounded-2xl border border-slate-200 bg-black" />

      {activeEvent && !submitted && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full uppercase tracking-wider">
                Pertanyaan di {formatTime(activeEvent.eventTime ?? 0)}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {timedQuestions.indexOf(activeEvent) + 1}/{timedQuestions.length}
              </span>
            </div>
            <p className="font-bold text-sm text-slate-900">{activeEvent.question}</p>
            <div className="space-y-2">
              {(activeEvent.options ?? []).map((opt, idx) => (
                <label key={idx} className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 p-3 border border-slate-200 rounded-xl hover:bg-slate-50">
                  <input
                    type="radio"
                    name={`vid-${activeEvent.id}`}
                    checked={answers[activeEvent.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [activeEvent.id]: opt }))}
                    className="accent-purple-600"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleEventAnswer}
              disabled={!answers[activeEvent.id]}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
            >
              {timedQuestions.indexOf(activeEvent) + 1 === timedQuestions.length ? "Jawab & Selesai" : "Lanjutkan Video"}
            </button>
          </div>
        </div>
      )}

      {(submitted || completed) && result && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
          result.scorePct >= 70 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
        }`}>
          <span>Skor Materi Video: {result.scorePct}/100</span>
          <span>{result.scorePct >= 70 ? "🎉 Lulus" : "⚠️ Di Bawah Passing Grade (70)"}</span>
        </div>
      )}

      {error && <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">⚠ {error}</div>}

      {/* Always-visible timed questions so they show even if the video can't autoplay */}
      {!submitted && !result && timedQuestions.length > 0 && (
        <div className="space-y-3">
          <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-clock text-purple-500 text-xs" />
            Pertanyaan Video ({timedQuestions.length})
          </h5>
          <div className="space-y-2">
            {timedQuestions.map((q, qi) => (
              <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                <p className="font-bold text-slate-800 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700 text-[10px] font-bold">
                    @ {formatTime(q.eventTime ?? 0)}
                  </span>
                  <span>{qi + 1}. {q.question}</span>
                </p>
                <div className="space-y-1.5 pl-1">
                  {(q.options ?? []).map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        name={`vid-${q.id}`}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        className="accent-purple-600"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
              <i className="fa-solid fa-eye text-purple-500" /> Ditonton {watchPct}%
            </span>
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting || timedQuestions.some((q) => !answers[q.id])}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-paper-plane text-xs" />
              <span>{submitting ? "Mengirim..." : "Kumpulkan Jawaban"}</span>
            </button>
          </div>
        </div>
      )}

      {!submitted && !result && timedQuestions.length === 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-eye text-purple-500" /> Ditonton {watchPct}%
          </span>
        </div>
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
