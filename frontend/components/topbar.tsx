"use client";

import Image from "next/image";
import Link from "next/link";

export default function Topbar() {
  return (
    <header className="h-16 flex items-center px-8 border-b border-[var(--border)] bg-white sticky top-0 z-20">
      <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        {/* We use the logo.png we just created/placed in public folder */}
        <div className="w-8 h-8 rounded flex items-center justify-center overflow-hidden">
          <Image src="/logo.png" alt="SpendSense Logo" width={32} height={32} className="object-contain" />
        </div>
        <h1 className="text-[18px] font-black tracking-tighter text-black">
          SpendSense
        </h1>
      </Link>
    </header>
  );
}
