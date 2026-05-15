import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStudy,
  customFetch,
  getGetStudyQueryKey,
  getListStudiesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check, Plus, X, GripVertical } from "lucide-react";
import { toast } from "sonner";

export default function EditStudy({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const studyQ = useGetStudy(id, { query: { enabled: !!id, queryKey: getGetStudyQueryKey(id) } });
  const study = studyQ.data;

  const [title, setTitle]               = useState("");
  const [product, setProduct]           = useState("");
  const [goal, setGoal]                 = useState("");
  const [durationMinutes, setDuration]  = useState(20);
  const [questions, setQuestions]       = useState<string[]>([""]);
  const [saving, setSaving]             = useState(false);
  const [initialized, setInitialized]   = useState(false);

  useEffect(() => {
    if (study && !initialized) {
      setTitle(study.title);
      setProduct(study.product);
      setGoal(study.goal ?? "");
      setDuration(study.durationMinutes);
      setQuestions(study.questions.length > 0 ? study.questions : [""]);
      setInitialized(true);
    }
  }, [study, initialized]);

  const handleSubmit = async () => {
    if (!title.trim() || !product.trim()) {
      toast.error("Study title and product are required.");
      return;
    }
    const cleanQuestions = questions.map((q) => q.trim()).filter(Boolean);
    if (cleanQuestions.length === 0) {
      toast.error("Add at least one interview question.");
      return;
    }
    setSaving(true);
    try {
      await customFetch(`/api/studies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          product: product.trim(),
          goal: goal.trim(),
          durationMinutes,
          questions: cleanQuestions,
        }),
      });
      qc.invalidateQueries({ queryKey: getGetStudyQueryKey(id) });
      qc.invalidateQueries({ queryKey: getListStudiesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast.success("Study updated");
      navigate(`/studies/${id}`);
    } catch {
      toast.error("Could not update study. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (studyQ.isLoading || !initialized) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!study) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-slate-500">Study not found.</p>
        <Link href="/studies" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Back to Studies
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href={`/studies/${id}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Edit study</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{study.title}</h1>
        </div>
      </div>

      <div className="space-y-5">
        <Card className="border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-50 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Study basics</h2>
            <p className="mt-0.5 text-xs text-slate-400">Update the name, product, and research goal.</p>
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
                  onChange={(e) => setDuration(Number(e.target.value))}
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

        <Card className="border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Interview questions</h2>
              <p className="mt-0.5 text-xs text-slate-400">The AI will ask these in order and probe with follow-ups.</p>
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
                    const next = [...questions];
                    next[i] = e.target.value;
                    setQuestions(next);
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

      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(`/studies/${id}`)}
          className="text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-full bg-indigo-600 px-6 text-white hover:bg-indigo-700"
        >
          {saving ? "Saving…" : <><Check className="h-4 w-4" /><span className="ml-1.5">Save changes</span></>}
        </Button>
      </div>
    </div>
  );
}
