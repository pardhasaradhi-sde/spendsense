import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--muted)]">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <div className="w-10 h-10 bg-black rounded-sm flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-sm font-black tracking-tighter">SS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SpendSense</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">Financial intelligence, simplified.</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "shadow-none",
              card: "shadow-none border border-[var(--border)] rounded",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
            },
          }}
        />
      </div>
    </div>
  );
}
