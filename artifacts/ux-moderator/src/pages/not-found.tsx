import { Link } from "wouter";
import { Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#FAFAF9] px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-indigo-200">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-3 text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
