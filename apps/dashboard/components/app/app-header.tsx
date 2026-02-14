import Link from "next/link";
import { IconBug, IconSettings, IconBook } from "@tabler/icons-react";
import { UserNav } from "./user-nav";

type AppHeaderProps = {
  orgName: string;
  plan: string;
  email: string;
  userName?: string | null;
};

export function AppHeader({ orgName, plan, email, userName }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold text-slate-900"
          >
            <IconBug className="size-5 text-primary" />
            QuickBugs
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-700">{orgName}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {plan}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/docs"
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Docs"
          >
            <IconBook className="size-[18px]" />
          </Link>
          <Link
            href="/settings"
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <IconSettings className="size-[18px]" />
          </Link>
          <UserNav email={email} name={userName} />
        </div>
      </div>
    </header>
  );
}
