import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInvite,
  useRespondToInvite,
  useStartSession,
  getGetInviteQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Calendar, ArrowRight, Clock, Bot, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

export default function Invite({ token }: { token: string }) {
  const [, navigate]   = useLocation();
  const qc             = useQueryClient();
  const inviteQ        = useGetInvite(token, { query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) } });
  const respondMut     = useRespondToInvite();
  const startMut       = useStartSession();

  const [name, setName]             = useState("");
  const [chosenSlot, setChosenSlot] = useState<string>("");
  const [suggested, setSuggested]   = useState<string>("");
  const [mode, setMode]             = useState<"choose" | "reschedule" | "decline">("choose");

  if (inviteQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FAFAF9]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-slate-500">Loading your invitation…</p>
        </div>
      </div>
    );
  }
  if (!inviteQ.data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FAFAF9] p-4">
        <Card className="max-w-sm w-full border border-slate-100 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
            <Sparkles className="h-5 w-5 text-rose-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Invite not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            The link may have expired or already been used.
          </p>
        </Card>
      </div>
    );
  }

  const { participant, study } = inviteQ.data;

  const responded =
    participant.status === "accepted" ||
    participant.status === "declined" ||
    participant.status === "rescheduled" ||
    participant.status === "completed";

  const accept = () => {
    if (!chosenSlot) { toast.error("Please pick a time that works for you."); return; }
    respondMut.mutate(
      { token, data: { action: "accept", chosenSlot, name: name || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetInviteQueryKey(token) });
          toast.success("You're booked in. Thank you!");
        },
        onError: () => toast.error("Could not save your response."),
      },
    );
  };

  const decline = () => {
    respondMut.mutate(
      { token, data: { action: "decline", name: name || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetInviteQueryKey(token) });
          toast.success("Thanks for letting us know.");
        },
      },
    );
  };

  const reschedule = () => {
    if (!suggested) { toast.error("Please suggest a time."); return; }
    respondMut.mutate(
      { token, data: { action: "reschedule", suggestedSlot: new Date(suggested).toISOString(), name: name || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetInviteQueryKey(token) });
          toast.success("We'll reach out about your suggested time.");
        },
      },
    );
  };

  const startNow = () => {
    startMut.mutate(
      { data: { studyId: study.id, participantId: participant.id } },
      {
        onSuccess: (res) => navigate(`/interview/${res.session.id}`),
        onError:   ()    => toast.error("Could not start the session."),
      },
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="mx-auto max-w-xl px-5 py-14">

        {/* Brand */}
        <div className="mb-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-indigo-200">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight text-slate-800">Insightly</span>
        </div>

        {/* Study card */}
        <Card className="border border-slate-100 bg-white p-7 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">
            Research invitation
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{study.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{study.goal}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Bot className="h-3 w-3 text-indigo-400" />
              About {study.product}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Clock className="h-3 w-3 text-indigo-400" />
              {study.durationMinutes} minutes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              AI-moderated
            </span>
          </div>
        </Card>

        {/* Response / Start card */}
        {responded ? (
          <Card className="mt-4 border border-slate-100 bg-white p-7 shadow-sm">
            {participant.status === "accepted" ? (
              <div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <p className="font-semibold text-slate-900">
                    You're booked, {participant.name ?? participant.email?.split("@")[0] ?? "there"}!
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  When you're ready, click below to start your AI-moderated interview.
                </p>
                <Button
                  onClick={startNow}
                  disabled={startMut.isPending}
                  className="mt-5 rounded-full bg-indigo-600 px-6 text-white hover:bg-indigo-700"
                >
                  {startMut.isPending ? "Starting…" : <>Begin interview <ArrowRight className="ml-1 h-4 w-4" /></>}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-700">
                Thanks{participant.name ? `, ${participant.name}` : ""}. Your response has been recorded (
                <strong>{participant.status}</strong>).
              </p>
            )}
          </Card>
        ) : (
          <Card className="mt-4 border border-slate-100 bg-white p-7 shadow-sm">
            <div className="mb-6">
              <Label htmlFor="name" className="text-slate-700">Your name <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Kim"
                className="mt-1.5"
              />
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {(["choose", "reschedule", "decline"] as const).map((m) => (
                <ChipButton key={m} active={mode === m} onClick={() => setMode(m)}>
                  {m === "choose" ? "Pick a time" : m === "reschedule" ? "Suggest another time" : "Can't participate"}
                </ChipButton>
              ))}
            </div>

            {mode === "choose" && (
              <div>
                <Label className="mb-3 block text-slate-700">Choose a slot that works for you</Label>
                <RadioGroup value={chosenSlot} onValueChange={setChosenSlot} className="space-y-2">
                  {study.slots.map((s) => (
                    <label
                      key={s}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                        chosenSlot === s
                          ? "border-indigo-300 bg-indigo-50 shadow-sm"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                    >
                      <RadioGroupItem value={s} id={s} />
                      <Calendar className={`h-4 w-4 ${chosenSlot === s ? "text-indigo-500" : "text-slate-400"}`} />
                      <span className="text-sm text-slate-700">{formatDateTime(s)}</span>
                    </label>
                  ))}
                </RadioGroup>
                <Button
                  onClick={accept}
                  disabled={respondMut.isPending}
                  className="mt-5 rounded-full bg-indigo-600 px-6 text-white hover:bg-indigo-700"
                >
                  {respondMut.isPending ? "Saving…" : "Confirm booking"}
                </Button>
              </div>
            )}

            {mode === "reschedule" && (
              <div>
                <Label htmlFor="sug" className="text-slate-700">Suggest a time that works for you</Label>
                <Input
                  id="sug"
                  type="datetime-local"
                  value={suggested}
                  onChange={(e) => setSuggested(e.target.value)}
                  className="mt-1.5"
                />
                <Button
                  onClick={reschedule}
                  disabled={respondMut.isPending}
                  className="mt-5 rounded-full bg-indigo-600 px-6 text-white hover:bg-indigo-700"
                >
                  {respondMut.isPending ? "Sending…" : "Send suggestion"}
                </Button>
              </div>
            )}

            {mode === "decline" && (
              <div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  No worries — we really appreciate you letting us know. Your feedback helps the team plan better.
                </div>
                <Button
                  onClick={decline}
                  disabled={respondMut.isPending}
                  variant="outline"
                  className="mt-4 rounded-full"
                >
                  {respondMut.isPending ? "Declining…" : "Decline politely"}
                </Button>
              </div>
            )}
          </Card>
        )}

        <p className="mt-8 text-center text-[11px] text-slate-400">
          Powered by Insightly · AI-moderated user research
        </p>
      </div>
    </div>
  );
}

function ChipButton({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-4 py-2 text-xs font-medium transition-all " +
        (active
          ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")
      }
    >
      {children}
    </button>
  );
}
