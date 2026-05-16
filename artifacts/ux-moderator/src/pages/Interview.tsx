import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useGetSession,
  useSubmitSessionTurn,
  useEndSession,
  getGetSessionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PhoneOff, Sparkles, Mic, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    if (!startRef.current) startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/* ── Speech-recognition shims ────────────────────────────── */
interface SRResult { 0: { transcript: string }; isFinal: boolean }
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRLike {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => SRLike;
function getSR(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ── Language detection & voice picking ───────────────────── */
const LANG_DETECT: Array<{ words: string[]; code: string }> = [
  { words: ["tamil", "தமிழ்", "tamizh"], code: "ta-IN" },
  { words: ["telugu", "తెలుగు"], code: "te-IN" },
  { words: ["marathi", "मराठी"], code: "mr-IN" },
  { words: ["bengali", "bangla", "বাংলা"], code: "bn-IN" },
  { words: ["gujarati", "ગુજરાતી"], code: "gu-IN" },
  { words: ["kannada", "ಕನ್ನಡ"], code: "kn-IN" },
  { words: ["malayalam", "മലയാളം"], code: "ml-IN" },
  { words: ["punjabi", "ਪੰਜਾਬੀ"], code: "pa-IN" },
  { words: ["urdu", "اردو"], code: "ur-IN" },
  { words: ["russian", "русский"], code: "ru-RU" },
  { words: ["dutch", "nederlands"], code: "nl-NL" },
  { words: ["turkish", "türkçe", "turkce"], code: "tr-TR" },
  { words: ["indonesian", "bahasa indonesia"], code: "id-ID" },
  { words: ["hindi","हिंदी","हिन्दी","hindi mein","hindi me"],          code: "hi-IN" },
  { words: ["english","अंग्रेज़ी","angrezi"],                           code: "en-US" },
  { words: ["french","français","francais"],                            code: "fr-FR" },
  { words: ["spanish","español","espanol"],                             code: "es-ES" },
  { words: ["german","deutsch"],                                        code: "de-DE" },
  { words: ["japanese","日本語"],                                        code: "ja-JP" },
  { words: ["chinese","mandarin","普通话","中文"],                       code: "zh-CN" },
  { words: ["korean","한국어"],                                          code: "ko-KR" },
  { words: ["portuguese","português"],                                   code: "pt-BR" },
  { words: ["italian","italiano"],                                       code: "it-IT" },
  { words: ["arabic","عربي","عربية"],                                   code: "ar-SA" },
];

const REQUEST_RE = /\b(speak|change|switch|talk|use|please|can you|could you|बोलो|बोलिए|बात करो|में बोलो|में बात|mein|me bolo)\b/i;

function detectLangChange(text: string): string | null {
  if (!REQUEST_RE.test(text) && !/\blanguage\b/i.test(text)) return null;
  const lower = text.toLowerCase();
  for (const { words, code } of LANG_DETECT) {
    if (words.some((w) => lower.includes(w.toLowerCase()))) return code;
  }
  return null;
}

/**
 * Auto-detect language from the Unicode script used in recognized text.
 * Works for Hindi (Devanagari), Arabic, CJK, Korean, and Latin (English).
 * Returns null if the text is too short or ambiguous.
 */
function detectLangFromScript(text: string): string | null {
  const chars = text.replace(/[\s\d\p{P}]/gu, "");
  if (chars.length < 4) return null;
  const n = chars.length;
  const devanagari = (chars.match(/[\u0900-\u097F]/g) ?? []).length;
  const bengali    = (chars.match(/[\u0980-\u09FF]/g) ?? []).length;
  const gurmukhi   = (chars.match(/[\u0A00-\u0A7F]/g) ?? []).length;
  const gujarati   = (chars.match(/[\u0A80-\u0AFF]/g) ?? []).length;
  const tamil      = (chars.match(/[\u0B80-\u0BFF]/g) ?? []).length;
  const telugu     = (chars.match(/[\u0C00-\u0C7F]/g) ?? []).length;
  const kannada    = (chars.match(/[\u0C80-\u0CFF]/g) ?? []).length;
  const malayalam  = (chars.match(/[\u0D00-\u0D7F]/g) ?? []).length;
  const arabic     = (chars.match(/[\u0600-\u06FF]/g) ?? []).length;
  const cyrillic   = (chars.match(/[\u0400-\u04FF]/g) ?? []).length;
  const hangul     = (chars.match(/[\uAC00-\uD7AF]/g) ?? []).length;
  const cjk        = (chars.match(/[\u4E00-\u9FFF\u3040-\u30FF]/g) ?? []).length;
  const latin      = (chars.match(/[a-zA-Z]/g) ?? []).length;
  if (devanagari / n > 0.25) return "hi-IN";
  if (bengali    / n > 0.25) return "bn-IN";
  if (gurmukhi   / n > 0.25) return "pa-IN";
  if (gujarati   / n > 0.25) return "gu-IN";
  if (tamil      / n > 0.25) return "ta-IN";
  if (telugu     / n > 0.25) return "te-IN";
  if (kannada    / n > 0.25) return "kn-IN";
  if (malayalam  / n > 0.25) return "ml-IN";
  if (arabic     / n > 0.25) return "ar-SA";
  if (cyrillic   / n > 0.25) return "ru-RU";
  if (hangul     / n > 0.25) return "ko-KR";
  if (cjk        / n > 0.25) return "zh-CN";
  if (latin      / n > 0.50) return "en-US";
  return null;
}

/**
 * Detects whether a voice uses online neural synthesis.
 * Chrome labels these "Google …", Edge labels them "… Online (Natural) …".
 * Non-local voices are also online/neural on most platforms.
 */
function isNeural(v: SpeechSynthesisVoice): boolean {
  return (
    /^google\s/i.test(v.name) ||
    /online|natural|neural|premium|enhanced|plus/i.test(v.name) ||
    !v.localService
  );
}

/** Heuristic female detector across Google/Microsoft/Apple naming conventions */
function isFemale(v: SpeechSynthesisVoice): boolean {
  return /female|woman|aria|jenny|emma|zira|sonia|karen|samantha|veena|lekha|mahina|swara|ava|moira|fiona|tessa|nova|shimmer/i.test(v.name);
}

/**
 * Priority ladder:
 *   1. Neural + exact lang + female
 *   2. Neural + exact lang
 *   3. Neural + base lang + female
 *   4. Neural + base lang
 *   5. Exact lang + female (non-neural)
 *   6. Exact lang
 *   7. Base lang
 *   8. First available
 */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const base = lang.split("-")[0];
  const exact = (v: SpeechSynthesisVoice) => v.lang === lang;
  const broad = (v: SpeechSynthesisVoice) => v.lang.startsWith(base);

  return voices.find(v => exact(v) && isNeural(v) && isFemale(v))
    ?? voices.find(v => exact(v) && isNeural(v))
    ?? voices.find(v => broad(v) && isNeural(v) && isFemale(v))
    ?? voices.find(v => broad(v) && isNeural(v))
    ?? voices.find(v => exact(v) && isFemale(v))
    ?? voices.find(v => exact(v))
    ?? voices.find(v => broad(v))
    ?? voices[0]
    ?? null;
}

/**
 * Strip / replace everything that makes a TTS engine stall, speak oddly, or
 * vocalise a symbol name ("asterisk", "hash sign", etc.).
 *
 * Pass 1 – structural replacements (keep speech rhythm natural)
 *   em/en dash → ", "   ellipsis → ". "   curly quotes → straight
 * Pass 2 – markdown stripping (bold, italic, code, headings, lists)
 * Pass 3 – Unicode whitelist via \p{L}/\p{N}
 *   Keep ONLY: Unicode letters (any script), digits, whitespace, and the
 *   minimal punctuation a TTS engine needs: . , ! ? ; : ' " - ( ) ।
 *   Everything else — emojis, symbols, arrows, math, bullets, brackets,
 *   @#$%^&*~`|<>{}\[] — is replaced with a space.
 * Pass 4 – collapse runs of whitespace/commas left behind.
 */
function sanitizeForTTS(text: string): string {
  return text
    // ── Pass 1: structural replacements ──────────────────────────────────
    .replace(/[—–]/g, ", ")
    .replace(/…/g, ". ")
    .replace(/[""]/g, '"')
    .replace(/[''‛]/g, "'")
    // ── Pass 2: strip markdown formatting ────────────────────────────────
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")   // **bold** / *italic*
    .replace(/_{1,2}([^_\n]+)_{1,2}/g,   "$1")    // __bold__ / _italic_
    .replace(/`[^`]*`/g,                  "")      // `inline code`
    .replace(/^#{1,6}\s+/gm,             "")       // # headings
    .replace(/^[-*+]\s+/gm,              "")       // - bullet lists
    .replace(/^\d+\.\s+/gm,              "")       // 1. numbered lists
    // ── Pass 3: remove everything that is not speakable ──────────────────
    // Allowed: Unicode letters (\p{L}), combining marks (\p{M} — Devanagari
    // matras/virama, Arabic harakat, etc.), digits, whitespace, and minimal
    // sentence punctuation.  \p{M} MUST be included or Indic/Arabic scripts
    // lose their vowel marks and the TTS reads bare consonants letter-by-letter.
    .replace(/[^\p{L}\p{M}\p{N}\s.,!?;:'"()\-।]/gu, " ")
    // ── Pass 4: tidy up ──────────────────────────────────────────────────
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(,\s*){2,}/g, ", ")
    .trim();
}

/**
 * Split text into sentences so each is spoken with natural inter-sentence pauses.
 * Handles English (.!?), Hindi (।), and other scripts.
 */
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?।‼⁉]+[.!?।‼⁉]*\s*/g) ?? [text];
  // Discard fragments that contain no letters (e.g. a lone "!" or "?").
  // \p{L} matches any Unicode letter so Hindi, Arabic, CJK, etc. all pass.
  return parts.map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));
}

const LANG_LABEL: Record<string, string> = {
  "ta-IN": "தமிழ்", "te-IN": "తెలుగు", "mr-IN": "मराठी", "bn-IN": "বাংলা",
  "gu-IN": "ગુજરાતી", "kn-IN": "ಕನ್ನಡ", "ml-IN": "മലയാളം", "pa-IN": "ਪੰਜਾਬੀ",
  "ur-IN": "اردو", "ru-RU": "Русский", "nl-NL": "Nederlands", "tr-TR": "Türkçe", "id-ID": "Indonesia",
  "en-US": "English", "en-IN": "English (IN)", "hi-IN": "हिंदी",
  "fr-FR": "Français", "es-ES": "Español", "de-DE": "Deutsch",
  "ja-JP": "日本語", "zh-CN": "中文", "ko-KR": "한국어",
  "pt-BR": "Português", "it-IT": "Italiano", "ar-SA": "العربية",
};

/* ── Types ────────────────────────────────────────────────── */
type Phase = "idle" | "speaking" | "listening" | "thinking" | "done";
const SILENCE_MS = 2200;

/* ── Soundwave bar configs ────────────────────────────────── */
const BARS = [
  { h: "30%", delay: "0ms",  dur: "0.55s" },
  { h: "80%", delay: "60ms", dur: "0.70s" },
  { h: "100%",delay: "30ms", dur: "0.45s" },
  { h: "65%", delay: "90ms", dur: "0.65s" },
  { h: "90%", delay: "15ms", dur: "0.50s" },
  { h: "55%", delay: "75ms", dur: "0.75s" },
  { h: "75%", delay: "45ms", dur: "0.60s" },
];

/* ── Jarvis-style animated orb ────────────────────────────── */
const ORB_CFG: Record<Phase, {
  primary: string; secondary: string; glowRgb: string;
  dur: [string, string, string, string];
}> = {
  idle:      { primary: "#6366f1", secondary: "#a5b4fc", glowRgb: "79,70,229",    dur: ["22s","15s","10s","32s"] },
  speaking:  { primary: "#0ea5e9", secondary: "#7dd3fc", glowRgb: "14,165,233",   dur: ["5s", "3.5s","2.5s","7s"] },
  listening: { primary: "#10b981", secondary: "#6ee7b7", glowRgb: "16,185,129",   dur: ["11s","7s",  "5s",  "14s"] },
  thinking:  { primary: "#f59e0b", secondary: "#fcd34d", glowRgb: "245,158,11",   dur: ["8s", "5.5s","3.5s","10s"] },
  done:      { primary: "#6b7280", secondary: "#9ca3af", glowRgb: "107,114,128",  dur: ["30s","20s", "14s", "40s"] },
};

function JarvisOrb({ phase, size = 360 }: { phase: Phase; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const { primary, secondary, glowRgb, dur } = ORB_CFG[phase];

  const gradId = `cg${phase}`;
  const fGlowId = `fg${phase}`;
  const fCoreId = `fc${phase}`;

  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">

      {/* Outer atmosphere blur */}
      <div
        className="absolute inset-[-20%] rounded-full transition-all duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(circle, rgba(${glowRgb},0.22) 0%, transparent 70%)`,
          filter: "blur(24px)",
        }}
      />

      {/* Wave ping rings — speaking */}
      {phase === "speaking" && <>
        <div className="absolute inset-[17%] rounded-full border border-sky-400/45 animate-ping" />
        <div className="absolute inset-[9%] rounded-full border border-sky-300/22 animate-ping"
          style={{ animationDelay: "450ms" }} />
      </>}

      {/* Wave ping ring — listening */}
      {phase === "listening" && (
        <div className="absolute inset-[14%] rounded-full border border-emerald-400/40 animate-ping"
          style={{ animationDelay: "250ms" }} />
      )}

      {/* Thinking pulse glow */}
      {phase === "thinking" && (
        <div className="absolute inset-[20%] rounded-full animate-pulse"
          style={{ background: `radial-gradient(circle, rgba(${glowRgb},0.15) 0%, transparent 70%)` }} />
      )}

      {/* SVG: rings + core sphere */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 w-full h-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Core sphere gradient — changes per phase */}
          <radialGradient id={gradId} cx="40%" cy="35%" r="60%">
            <stop offset="0%"   stopColor={secondary} stopOpacity="0.30" />
            <stop offset="30%"  stopColor="#1a1742"   stopOpacity="0.92" />
            <stop offset="100%" stopColor="#06060f"   stopOpacity="1"    />
          </radialGradient>

          {/* Sphere outer glow filter */}
          <filter id={fGlowId} x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Center point glow filter */}
          <filter id={fCoreId} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── Ring 1: outermost, slowest, broken dashes ── */}
        <circle cx={cx} cy={cy} r={size * 0.445}
          fill="none" stroke={primary} strokeWidth="1" strokeOpacity="0.30"
          strokeDasharray="38 9 20 13 58 10 14 9" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur={dur[0]} repeatCount="indefinite" />
        </circle>

        {/* ── Ring 2: mid-outer, reverse, more visible ── */}
        <circle cx={cx} cy={cy} r={size * 0.365}
          fill="none" stroke={primary} strokeWidth="1.5" strokeOpacity="0.50"
          strokeDasharray="28 7 65 9 22 6" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate"
            from={`360 ${cx} ${cy}`} to={`0 ${cx} ${cy}`} dur={dur[1]} repeatCount="indefinite" />
        </circle>

        {/* ── Ring 3: inner, forward, fine dashes ── */}
        <circle cx={cx} cy={cy} r={size * 0.285}
          fill="none" stroke={secondary} strokeWidth="1" strokeOpacity="0.60"
          strokeDasharray="42 9 14 9" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur={dur[2]} repeatCount="indefinite" />
        </circle>

        {/* ── Core sphere ── */}
        <circle cx={cx} cy={cy} r={size * 0.215}
          fill={`url(#${gradId})`}
          stroke={primary} strokeWidth="1.3" strokeOpacity="0.80"
          filter={`url(#${fGlowId})`} />

        {/* ── Inner detail ring (reverse) ── */}
        <circle cx={cx} cy={cy} r={size * 0.135}
          fill="none" stroke={secondary} strokeWidth="0.6"
          strokeOpacity="0.40" strokeDasharray="7 5">
          <animateTransform attributeName="transform" type="rotate"
            from={`360 ${cx} ${cy}`} to={`0 ${cx} ${cy}`} dur={dur[3]} repeatCount="indefinite" />
        </circle>

        {/* ── Sphere highlight (subtle) ── */}
        <ellipse cx={cx - size * 0.055} cy={cy - size * 0.065}
          rx={size * 0.065} ry={size * 0.048}
          fill={secondary} fillOpacity="0.18" />

        {/* ── Center energy core ── */}
        <circle cx={cx} cy={cy} r={size * 0.042}
          fill={primary} fillOpacity="0.30" filter={`url(#${fCoreId})`} />
        <circle cx={cx} cy={cy} r={size * 0.018}
          fill={secondary} fillOpacity="0.95" filter={`url(#${fCoreId})`} />
      </svg>

      {/* Soundwave bars — inside the core when speaking */}
      {phase === "speaking" && (
        <div
          className="absolute flex items-end justify-center gap-[3px] pointer-events-none"
          style={{ top: "57%", left: "50%", transform: "translate(-50%, 0)", height: "26px" }}
        >
          {BARS.map((bar, i) => (
            <span
              key={i}
              className="rounded-full origin-bottom"
              style={{
                width: "2.5px",
                height: bar.h,
                backgroundColor: secondary,
                opacity: 0.88,
                animation: `soundbar ${bar.dur} ${bar.delay} ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {/* Thinking dots — center of core */}
      {phase === "thinking" && (
        <div className="absolute flex items-center gap-1.5 pointer-events-none"
          style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-amber-300/80 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Component ────────────────────────────────────────────── */
export default function Interview({ sessionId }: { sessionId: string }) {
  const [, navigate]  = useLocation();
  const qc            = useQueryClient();
  const sessionQ      = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) },
  });
  const submitMut     = useSubmitSessionTurn();
  const endMut        = useEndSession();

  const [phase, setPhase]         = useState<Phase>("idle");
  const [caption, setCaption]     = useState("");
  const [partial, setPartial]     = useState("");
  const [started, setStarted]     = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [voiceLang, setVoiceLang]       = useState("en-US");
  const [voiceName, setVoiceName]       = useState("");
  const [isVoiceNeural, setIsVoiceNeural] = useState(false);

  const voicesRef       = useRef<SpeechSynthesisVoice[]>([]);
  const voiceLangRef    = useRef("en-US");
  const recognitionRef  = useRef<SRLike | null>(null);
  const bargeInRef      = useRef<SRLike | null>(null);
  const isSpeakingRef   = useRef(false);
  const spokenIdsRef    = useRef<Set<string>>(new Set());
  const speakQueueRef   = useRef<Promise<void>>(Promise.resolve());
  const finalTextRef    = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef     = useRef(false);
  const endedRef          = useRef(false);
  const phaseRef          = useRef<Phase>("idle");
  // Tracks the sanitised text the AI is currently speaking — used for echo detection in barge-in
  const currentSpeechRef  = useRef("");

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { voiceLangRef.current = voiceLang; }, [voiceLang]);

  /* ── Pre-load TTS voices ────────────────────────────────── */
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) voicesRef.current = v;
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    // Chrome lazy-loads its online neural voices (Google हिन्दी etc.) after a
    // short delay — poll a few times to ensure they're captured before the
    // first utterance.
    const t1 = setTimeout(load, 400);
    const t2 = setTimeout(load, 1200);
    const t3 = setTimeout(load, 2800);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  const study     = sessionQ.data?.study;
  const session   = sessionQ.data?.session;
  const transcript = sessionQ.data?.transcript ?? [];

  /* ── Stop listening ──────────────────────────────────────── */
  const stopListening = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    recognitionRef.current = null;
  };

  /* ── Barge-in helpers ────────────────────────────────────── */
  const stopBargeIn = () => {
    try { bargeInRef.current?.abort(); } catch { /* noop */ }
    bargeInRef.current = null;
  };

  /**
   * Returns true if the recognised text is likely the AI's own voice echoing
   * back through the microphone. We compare meaningful words (length > 3) from
   * the barge-in result against the sanitised text being spoken; >40% overlap
   * is treated as echo and discarded.
   */
  const isBargeInEcho = (bargeText: string): boolean => {
    const speech = currentSpeechRef.current;
    if (!speech || !bargeText) return false;
    const speakWords = new Set(
      speech.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    );
    if (speakWords.size === 0) return false;
    const bargeWords = bargeText.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (bargeWords.length === 0) return false;
    const matches = bargeWords.filter((w) => speakWords.has(w)).length;
    return matches / bargeWords.length > 0.4;
  };

  const startBargeIn = () => {
    if (endedRef.current) return;
    const SR = getSR(); if (!SR) return;
    stopBargeIn();
    const rec = new SR();
    // Grace period: ignore any result within the first 1 500 ms of each
    // speech turn — this absorbs echo onset and room reverb.
    const graceUntil = Date.now() + 1_500;
    rec.continuous = false; rec.interimResults = false; rec.lang = voiceLangRef.current;
    rec.onstart = null;
    rec.onresult = (e) => {
      if (!isSpeakingRef.current) return;
      // Still within grace period — discard (likely echo of AI's own voice)
      if (Date.now() < graceUntil) return;
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript.trim() + " ";
      }
      text = text.trim();
      if (text.length < 2) return;
      // Echo filter: ignore if the recognised text closely matches what the AI is saying
      if (isBargeInEcho(text)) return;
      // Genuine participant speech — cut the AI off and switch to listening
      isSpeakingRef.current = false;
      bargeInRef.current = null;
      window.speechSynthesis.cancel();
      finalTextRef.current = text;
      setPartial("");
      startListening(true);
    };
    rec.onerror = () => { /* ignore noise */ };
    rec.onend = () => {
      if (isSpeakingRef.current) setTimeout(() => { if (isSpeakingRef.current) startBargeIn(); }, 250);
    };
    bargeInRef.current = rec;
    try { rec.start(); } catch { /* noop */ }
  };

  /* ── Start listening ─────────────────────────────────────── */
  const startListening = (preserveText = false) => {
    if (endedRef.current) return;
    const SR = getSR(); if (!SR) return;
    stopListening();
    if (!preserveText) {
      finalTextRef.current = "";
      setPartial("");
    }

    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = voiceLangRef.current;
    rec.onstart  = () => setPhase("listening");
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalTextRef.current += (finalTextRef.current ? " " : "") + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      setPartial(interim);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if ((finalTextRef.current + " " + interim).trim()) {
        silenceTimerRef.current = setTimeout(submitParticipantTurn, SILENCE_MS);
      }
    };
    rec.onerror = (e: unknown) => {
      const err = (e as { error?: string })?.error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        setPermissionDenied(true); setPhase("idle");
      }
    };
    rec.onend = () => {
      if (endedRef.current || submittingRef.current) return;
      if (phaseRef.current === "listening") {
        setTimeout(() => {
          if (!endedRef.current && !submittingRef.current && phaseRef.current === "listening")
            startListening();
        }, 300);
      }
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  };

  /* ── Text-to-speech ─────────────────────────────────────── */
  const speakText = useCallback(async (text: string): Promise<void> => {
    const responseLang = detectLangFromScript(text);
    if (responseLang && responseLang !== voiceLangRef.current) {
      setVoiceLang(responseLang);
      voiceLangRef.current = responseLang;
    }
    if (endedRef.current) return;
    // Ensure mic is fully off before we start speaking — prevents the
    // recognition engine from picking up speaker audio as participant input.
    stopListening();
    stopBargeIn();
    setPhase("speaking");
    isSpeakingRef.current = true;
    currentSpeechRef.current = sanitizeForTTS(text);
    // Barge-in is intentionally disabled: running speech recognition while
    // TTS is playing causes the mic to pick up the AI's own voice and submit
    // it as the participant's answer.  The mic opens only after speech ends.

    const lang = voiceLangRef.current;

    // Refresh voice list right before speaking — catches Chrome online voices
    // (e.g. "Google हिन्दी") that are lazy-loaded after initial page render.
    const freshVoices = window.speechSynthesis.getVoices();
    if (freshVoices.length > 0) voicesRef.current = freshVoices;

    const voice  = pickVoice(voicesRef.current, lang);
    const neural = voice ? isNeural(voice) : false;
    if (voice) setVoiceName(voice.name);
    setIsVoiceNeural(neural);

    const synth     = window.speechSynthesis;
    const sentences = splitSentences(sanitizeForTTS(text));

    // Chrome race condition: cancel() fires onerror("interrupted") on any pending
    // utterance, which can resolve a sentence promise before speech starts.
    // A short delay after cancel() prevents the stale event from leaking into
    // the next utterance.
    synth.cancel();
    await new Promise<void>((r) => setTimeout(r, 80));

    const speakOne = (sentence: string) =>
      new Promise<void>((resolve) => {
        // Skip if barge-in or end already happened
        if (!isSpeakingRef.current || endedRef.current) { resolve(); return; }

        const utt    = new SpeechSynthesisUtterance(sentence);
        // Neural voices: natural conversational pace.
        // Non-neural (basic/local) voices: slower rate + lower pitch reduces
        // the robotic feel somewhat — especially noticeable for Hindi "Lekha".
        utt.rate     = neural ? 0.88 : 0.80;
        utt.pitch    = neural ? 1.0  : 0.90;
        utt.volume   = 1.0;
        utt.lang     = lang;
        if (voice) utt.voice = voice;

        // Chrome stall bug workaround (synthesis stops after ~15 s without this)
        const keepAlive = setInterval(() => {
          if (!synth.speaking) { clearInterval(keepAlive); return; }
          synth.pause(); synth.resume();
        }, 13_000);

        utt.onend = () => { clearInterval(keepAlive); resolve(); };
        // onerror with "interrupted" is expected when synth.cancel() fires (barge-in).
        // Resolve in all cases; the loop will check isSpeakingRef to decide whether
        // to continue.
        utt.onerror = () => { clearInterval(keepAlive); resolve(); };
        synth.speak(utt);
      });

    for (let i = 0; i < sentences.length; i++) {
      if (!isSpeakingRef.current || endedRef.current) break;
      await speakOne(sentences[i]);
      // Short natural gap between sentences (skip after the last)
      if (isSpeakingRef.current && i < sentences.length - 1) {
        await new Promise<void>((r) => setTimeout(r, 180));
      }
    }

    // Speech ended naturally — mark as done
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
    }
    // Wait for speaker audio tail to die out before allowing mic input.
    // Without this delay the recognition engine captures speaker echo on the
    // first few words of the participant's turn.
    await new Promise<void>((r) => setTimeout(r, 500));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Queue AI speech turns ───────────────────────────────── */
  const enqueueSpeak = useCallback((text: string, id: string): Promise<void> => {
    const next = speakQueueRef.current.then(async () => {
      if (endedRef.current) return;
      setCaption(text);
      await speakText(text);
      spokenIdsRef.current.add(id);
    });
    speakQueueRef.current = next;
    return next;
  }, [speakText]);

  /* ── Drive conversation loop ─────────────────────────────── */
  useEffect(() => {
    if (!started || endedRef.current) return;
    const unspoken = transcript.filter(
      (t) => t.speaker === "ai" && !spokenIdsRef.current.has(t.id),
    );
    if (unspoken.length === 0) return;
    let chain = speakQueueRef.current;
    for (const t of unspoken) chain = enqueueSpeak(t.text, t.id);
    chain.then(() => {
      if (endedRef.current) return;
      if (session?.status === "completed") { setPhase("done"); return; }
      if (!submittingRef.current && phaseRef.current !== "thinking" && phaseRef.current !== "listening") startListening();
    });
  }, [started, transcript.length, session?.status, enqueueSpeak]);

  /* ── Submit participant turn ─────────────────────────────── */
  const submitParticipantTurn = () => {
    const text = finalTextRef.current.trim();
    if (!text || submittingRef.current || endedRef.current) return;

    // 1) Explicit request ("speak in Hindi", "switch to English", etc.)
    const explicitLang = detectLangChange(text);
    // 2) Auto-detect from the Unicode script of the recognised text
    //    e.g. Devanagari chars → hi-IN, Latin chars → en-US
    const scriptLang   = !explicitLang ? detectLangFromScript(text) : null;
    const autoLang     = scriptLang === "en-US" && voiceLangRef.current !== "en-US" ? null : scriptLang;
    const newLang      = explicitLang ?? autoLang;
    if (newLang && newLang !== voiceLangRef.current) {
      setVoiceLang(newLang);
      voiceLangRef.current = newLang;
    }

    submittingRef.current = true;
    stopListening();
    setPhase("thinking");
    setPartial("");
    submitMut.mutate(
      { sessionId, data: { participantText: text, preferredLanguage: newLang ?? voiceLangRef.current } },
      {
        onSuccess: () => {
          submittingRef.current = false;
          finalTextRef.current = "";
          qc.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
        },
        onError: () => {
          submittingRef.current = false;
          toast.error("Could not send your response. Please try speaking again.");
          if (!endedRef.current) startListening();
        },
      },
    );
  };

  /* ── End session ─────────────────────────────────────────── */
  const endSession = () => {
    endedRef.current = true;
    isSpeakingRef.current = false;
    stopListening();
    stopBargeIn();
    window.speechSynthesis.cancel();
    setPhase("done");
    endMut.mutate({ sessionId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
        navigate(`/sessions/${sessionId}`);
      },
    });
  };

  /* ── Cleanup ─────────────────────────────────────────────── */
  useEffect(() => () => {
    endedRef.current = true;
    isSpeakingRef.current = false;
    stopListening();
    stopBargeIn();
    window.speechSynthesis.cancel();
  }, []);

  /* ── Render ──────────────────────────────────────────────── */
  const isCompleted = session?.status === "completed" || phase === "done";
  const elapsed     = useElapsedTimer(started && !isCompleted);
  const hasSR       = !!getSR();

  const phaseLabel: Record<Phase, string> = {
    idle:      "Ready",
    speaking:  "Speaking",
    listening: "Listening",
    thinking:  "Thinking",
    done:      "Complete",
  };

  const phaseChipCls: Record<Phase, string> = {
    idle:      "bg-stone-700/60 text-stone-300",
    speaking:  "bg-sky-500/20 text-sky-300",
    listening: "bg-emerald-500/20 text-emerald-300",
    thinking:  "bg-amber-500/20 text-amber-300",
    done:      "bg-stone-700/60 text-stone-300",
  };

  const dotCls: Record<Phase, string> = {
    idle:      "bg-stone-600",
    speaking:  "animate-pulse bg-sky-400",
    listening: "animate-pulse bg-emerald-400",
    thinking:  "animate-pulse bg-amber-400",
    done:      "bg-stone-600",
  };

  if (sessionQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-stone-950 text-stone-300">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
          Loading session…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden flex-col bg-[#06060f] text-stone-100">

      {/* ── Top bar ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-100 leading-tight">
              {study?.title ?? "Live interview"}
            </div>
            <div className="text-[10px] text-stone-500 uppercase tracking-widest">Insightly · AI Moderator</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {started && !isCompleted && (
            <>
              <div className="flex items-center gap-1.5 rounded-full border border-stone-700/80 bg-stone-900/60 px-3 py-1.5 text-xs font-mono text-stone-300">
                <Timer className="h-3 w-3 text-stone-500" />
                {elapsed}
              </div>
              <div
                className="flex items-center gap-1.5 rounded-full border border-indigo-700/50 bg-indigo-950/60 px-3 py-1.5 text-[11px] font-medium text-indigo-300"
                title={voiceName ? `${voiceName}${isVoiceNeural ? " · Neural" : " · Basic — use Chrome or Edge for natural Hindi"}` : "Default voice"}
              >
                {LANG_LABEL[voiceLang] ?? voiceLang}
                {voiceName && (
                  isVoiceNeural
                    ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    : <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </div>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={endSession}
            className="rounded-full border border-rose-800/50 bg-rose-950/50 text-rose-300 hover:bg-rose-900/60 hover:text-rose-100 h-8 px-4 text-xs"
          >
            <PhoneOff className="mr-1.5 h-3 w-3" /> End
          </Button>
        </div>
      </header>

      {/* ── Center: orb ── */}
      <div className="flex flex-1 min-h-0 items-center justify-center px-6 py-4">
        {isCompleted ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-900/30 ring-2 ring-emerald-500/40">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-xl font-medium text-stone-100">Interview complete</p>
            <p className="mt-2 text-sm text-stone-400">Thank you for your time.</p>
            <Button
              onClick={() => navigate(`/sessions/${sessionId}`)}
              className="mt-6 bg-white text-stone-900 hover:bg-stone-100"
            >
              View transcript
            </Button>
          </div>
        ) : !started ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="h-[min(320px,calc(100svh-300px))] w-[min(320px,calc(100svh-300px))] max-w-full">
              <JarvisOrb phase="idle" />
            </div>
            <div className="flex flex-col items-center gap-4">
              <p className="max-w-sm text-sm text-stone-400">
                Your AI moderator is ready. The interview is conducted entirely by voice.
              </p>
              <Button
                onClick={() => setStarted(true)}
                className="gap-2 rounded-full bg-indigo-600 px-8 py-5 text-base font-medium text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/40"
              >
                <Mic className="h-4 w-4" /> Begin interview
              </Button>
              {!hasSR && (
                <p className="text-xs text-amber-300">
                  Voice input needs Chrome or Edge.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[min(440px,calc(100svh-180px))] w-[min(440px,calc(100svh-180px))] max-w-full">
            <JarvisOrb phase={phase} />
          </div>
        )}
      </div>

      {/* ── Bottom bar: caption + status ── */}
      {started && !isCompleted && (
        <footer className="shrink-0 border-t border-white/5 bg-black/30 px-8 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            {/* Status chip */}
            <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 ${phaseChipCls[phase]}`}>
              <span className={`h-1.5 w-1.5 rounded-full transition-all ${dotCls[phase]}`} />
              {phaseLabel[phase]}
            </div>

            {/* Caption */}
            <div className="min-h-[1.75rem] flex-1 text-sm leading-relaxed text-stone-300">
              {phase === "listening" && partial ? (
                <span className="italic text-stone-400">{partial}</span>
              ) : phase === "thinking" ? (
                <span className="flex items-center gap-2 text-stone-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing your response…
                </span>
              ) : caption ? (
                caption
              ) : (
                <span className="text-stone-600">Waiting…</span>
              )}
            </div>
          </div>

          {permissionDenied && (
            <p className="mt-2 text-center text-xs text-rose-300">
              Microphone access was blocked — click the lock icon in your address bar to allow it, then reload.
            </p>
          )}
        </footer>
      )}
    </div>
  );
}
