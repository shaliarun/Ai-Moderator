import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateStudy,
  getListStudiesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Plus, GripVertical, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { STUDY_TEMPLATES, type StudyTemplate } from "@/lib/studyTemplates";

function defaultSlot(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setMinutes(0, 0, 0);
  d.setHours(14);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STEPS = [
  { title: "Template",          desc: "Start from a template" },
  { title: "Study basics",      desc: "Name, product, goal" },
  { title: "Interview questions", desc: "What the AI will ask" },
  { title: "Time slots",        desc: "When participants can join" },
];

export default function NewStudy() {
  const [, navigate]           = useLocation();
  const qc                     = useQueryClient();
  const [step, setStep]        = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<StudyTemplate | null>(null);
  const [title, setTitle]      = useState("");
  const [product, setProduct]  = useState("");
  const [goal, setGoal]        = useState("");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [questions, setQuestions] = useState<string[]>([""]);
  const [slots, setSlots]         = useState<string[]>([defaultSlot(2), defaultSlot(3)]);

  const createMut = useCreateStudy();

  const applyTemplate = (t: StudyTemplate) => {
    setSelectedTemplate(t);
    setGoal(t.goal);
    setDurationMinutes(t.durationMinutes);
    setQuestions([...t.questions]);
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
  };

  const canAdvance = () => {
    if (step === 0) return true; // template step is always optional
    if (step === 1) return !!(title.trim() && product.trim() && goal.trim());
    if (step === 2) return questions.some((q) => q.trim());
    return slots.some(Boolean);
  };

  const next = () => {
    if (!canAdvance()) {
      const msgs = [
        "",
        "Please fill in the study title, product, and research goal.",
        "Add at least one interview question.",
        "Add at least one time slot.",
      ];
      toast.error(msgs[step] ?? "Please complete this step.");
      return;
    }
    if (step < 3) { setStep((s) => s + 1); return; }
    submit();
  };

  const submit = () => {
    const cleanQuestions = questions.map((q) => q.trim()).filter(Boolean);
    const cleanSlots     = slots.filter(Boolean).map((s) => new Date(s).toISOString());
    createMut.mutate(
      { data: { title: title.trim(), product: product.trim(), goal: goal.trim(), durationMinutes, questions: cleanQuestions, slots: cleanSlots } },
      {
        onSuccess: (study) => {
          qc.invalidateQueries({ queryKey: getListStudiesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast.success("Study created");
          navigate(`/studies/${study.id}`);
        },
        onError: () => toast.error("Could not create study. Please try again."),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">New study</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900">Plan an interview</h1>
        <p className="mt-2 text-slate-500">
          Define your research goal and the AI moderator will run sessions on your behalf.
        </p>
      </div>

      {/* Progress stepper */}
      <div className="mb-8">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  i < step
                    ? "bg-emerald-500 text-white"
                    : i === step
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                    : "bg-slate-100 text-slate-400"
                }`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="text-center">
                  <div className={`text-[11px] font-semibold ${i === step ? "text-indigo-700" : i < step ? "text-emerald-600" : "text-slate-400"}`}>
                    {s.title}
                  </div>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 mx-2 h-0.5 transition-all ${i < step ? "bg-emerald-300" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 h-1.5 w-full rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden">

        {/* Step 0: Template picker */}
        <div className={`transition-all duration-300 ${step === 0 ? "opacity-100 translate-x-0" : step > 0 ? "opacity-0 -translate-x-8 absolute inset-0 pointer-events-none" : "opacity-0 translate-x-8 absolute inset-0 pointer-events-none"}`}>
          <Card className="border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-900">Start from a template</h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">Pick a research type to pre-fill questions and goals — or skip to start from scratch.</p>
            </div>
            <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-1">
              {STUDY_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t === selectedTemplate ? t : t)}
                  className={`w-full rounded-xl border p-4 text-left transition-all hover:border-indigo-300 hover:shadow-sm ${
                    selectedTemplate?.id === t.id
                      ? "border-indigo-400 bg-indigo-50 shadow-sm"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">{t.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{t.name}</span>
                        {selectedTemplate?.id === t.id && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Selected</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{t.description}</p>
                      <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
                        <span>⏱ {t.durationMinutes} min</span>
                        <span>❓ {t.questions.length} questions</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {selectedTemplate && (
              <div className="border-t border-slate-50 px-6 py-3">
                <button
                  type="button"
                  onClick={clearTemplate}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear selection — start from scratch
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Step 1: Basics */}
        <div className={`transition-all duration-300 ${step === 1 ? "opacity-100 translate-x-0" : step > 1 ? "opacity-0 -translate-x-8 absolute inset-0 pointer-events-none" : "opacity-0 translate-x-8 absolute inset-0 pointer-events-none"}`}>
          <Card className="border border-slate-100 bg-white shadow-sm">
            {selectedTemplate && (
              <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-6 py-3">
                <span className="text-base">{selectedTemplate.icon}</span>
                <span className="text-xs font-medium text-amber-800">
                  Using template: <strong>{selectedTemplate.name}</strong> — goal and questions pre-filled
                </span>
              </div>
            )}
            <div className="border-b border-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Study basics</h2>
              <p className="mt-0.5 text-xs text-slate-400">Give the study a name, describe the product, and state your research goal.</p>
            </div>
            <div className="grid gap-5 p-6">
              <div>
                <Label htmlFor="title">Study title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Onboarding flow research"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="product">Product or app</Label>
                  <Input
                    id="product"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Acme mobile app"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={5}
                    max={240}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="goal">Research goal</Label>
                <Textarea
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={4}
                  placeholder="What do you want to learn? Be specific about the outcomes you need."
                  className="mt-1.5"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Step 2: Questions */}
        <div className={`transition-all duration-300 ${step === 2 ? "opacity-100 translate-x-0" : step > 2 ? "opacity-0 -translate-x-8 absolute inset-0 pointer-events-none" : "opacity-0 translate-x-8 absolute inset-0 pointer-events-none"}`}>
          <Card className="border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Interview questions</h2>
                <p className="mt-0.5 text-xs text-slate-400">The AI will ask these in order and probe with contextual follow-ups.</p>
              </div>
              <button
                type="button"
                onClick={() => setQuestions((q) => [...q, ""])}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add question
              </button>
            </div>
            <div className="space-y-2 p-6">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                  <span className="w-7 shrink-0 text-right text-xs font-semibold text-slate-400">Q{i + 1}</span>
                  <Input
                    value={q}
                    onChange={(e) => {
                      const next = [...questions]; next[i] = e.target.value; setQuestions(next);
                    }}
                    placeholder="Walk me through how you first discovered…"
                  />
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Step 3: Slots */}
        <div className={`transition-all duration-300 ${step === 3 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8 absolute inset-0 pointer-events-none"}`}>
          <Card className="border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Available time slots</h2>
                <p className="mt-0.5 text-xs text-slate-400">Participants will pick from these when they accept their invitation.</p>
              </div>
              <button
                type="button"
                onClick={() => setSlots((s) => [...s, defaultSlot(s.length + 2)])}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add slot
              </button>
            </div>
            <div className="space-y-2 p-6">
              {slots.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={s}
                    onChange={(e) => {
                      const next = [...slots]; next[i] = e.target.value; setSlots(next);
                    }}
                  />
                  {slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              className="text-slate-600"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => navigate("/studies")} className="text-slate-600">
              Cancel
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step === 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { clearTemplate(); setStep(1); }}
              className="text-slate-500"
            >
              Skip template
            </Button>
          )}
          <Button
            type="button"
            onClick={next}
            disabled={createMut.isPending}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-white shadow-md shadow-indigo-300/40 hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg"
          >
            {createMut.isPending
              ? "Creating…"
              : step < 3
              ? <><span>{step === 0 && selectedTemplate ? "Use template" : "Continue"}</span> <ArrowRight className="h-4 w-4" /></>
              : <><Check className="h-4 w-4" /> <span>Create study</span></>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
