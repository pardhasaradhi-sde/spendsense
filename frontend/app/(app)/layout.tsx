import Sidebar from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex flex-col flex-1 min-h-screen bg-[#f8fafc] md:ml-[var(--sidebar-width)] transition-[margin-left] duration-300 ease-in-out w-full w-max-[100vw] overflow-x-hidden">
        {/* Adds small padding-top on mobile for FAB, normal padding on desktop */}
        <main className="flex-1 p-4 pt-6 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
