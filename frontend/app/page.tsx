"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, ClerkLoading } from "@clerk/nextjs";
import Footer from "@/components/footer";

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(4px)" }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, type: "spring", bounce: 0.5 }}
        className="flex items-center gap-4"
      >
        <Image src="/logo.png" alt="SpendSense" width={88} height={88} className="object-contain shrink-0" />
        <motion.span 
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 0.8, delay: 0.4, ease: "circOut" }}
          className="text-5xl font-black text-white tracking-tighter"
        >
          SpendSense
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

export default function LandingPage() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <div className="min-h-screen bg-[#f3f4f6] p-3 md:p-6 font-sans text-neutral-900 overflow-x-hidden selection:bg-neutral-200 scroll-smooth flex flex-col items-center">
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      {/* ── Main App Container (Matching Finseer shape) ── */}
      <div className="w-full max-w-[1400px] bg-white rounded-[2.5rem] overflow-hidden relative shadow-sm min-h-[95vh] flex flex-col items-center">
        
        {/* Subtle Background Grid/Mesh resembling dashboard neatness */}
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at center, #000 1px, transparent 1px)`,
            backgroundSize: `40px 40px`,
          }}
        />
        
        {/* Soft elegant top glow */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80%] h-[500px] bg-gradient-to-b from-neutral-100 to-transparent blur-3xl rounded-[100%] pointer-events-none" />

        {/* ── Sticky Header Wrapper ── */}
        <div className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-lg border-b border-neutral-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] pt-6 pb-4 px-8 mb-8">
          <header className="flex items-center justify-between w-full">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded flex items-center justify-center overflow-hidden">
                <Image src="/logo.png" alt="SpendSense" width={40} height={40} className="object-contain" />
              </div>
              <span className="text-xl font-bold tracking-tight">SpendSense</span>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1 bg-neutral-100/80 border border-neutral-200 rounded-full px-2 py-1.5">
              <a href="#home" className="px-5 py-2 rounded-full hover:bg-white text-sm font-semibold transition-colors">Home</a>
              <a href="#features" className="px-5 py-2 rounded-full hover:bg-white text-sm font-medium transition-colors text-neutral-600">Features</a>
              <a href="#showcase" className="px-5 py-2 rounded-full hover:bg-white text-sm font-medium transition-colors text-neutral-600">Showcase</a>
            </nav>

            {/* Auth/Dashboard CTA */}
            <div className="flex items-center gap-3">
              <ClerkLoading>
                <div className="w-20 h-8 rounded-full bg-neutral-100 animate-pulse" />
              </ClerkLoading>
              <SignedOut>
                <Link href="/sign-in" className="text-sm font-semibold text-neutral-700 hover:text-black transition-colors px-4 py-2">
                  Log in
                </Link>
                <Link href="/sign-up" className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all">
                  Sign Up
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all shadow-md shadow-black/10">
                  Dashboard
                </Link>
              </SignedIn>
            </div>
          </header>
        </div>

        {/* ── Hero Content ── */}
        <main id="home" className="relative z-10 w-full flex flex-col items-center text-center px-4 pt-20 pb-0">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 bg-neutral-100/80 border border-neutral-200 rounded-full pl-1 pr-4 py-1 mb-8"
          >
            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">Fastest Way</span>
            <span className="text-sm font-medium text-neutral-600 tracking-wide">Manage Your Finances</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-[5.5rem] font-bold tracking-tight max-w-5xl leading-[1.05] mb-6"
          >
            Take Control of Your 
 <br className="hidden md:block"/> Money Effortlessly.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-neutral-500 max-w-2xl mb-10"
          >
           SpendSense helps you track expenses, automate insights, and understand your finances — all inside one clean, secure dashboard.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-6 mb-20"
          >
            <Link href="/sign-up" className="flex items-center gap-3 bg-white border border-neutral-200 shadow-sm pl-6 pr-2 py-2 rounded-full hover:shadow-md transition-all hover:-translate-y-0.5 group">
              <span className="font-bold text-sm">Get Started Free</span>
              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
            
            <button className="flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-black transition-colors group">
              <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                <Play size={16} fill="currentColor" />
              </div>
              Watch Demo
            </button>
          </motion.div>

          {/* ── Mockup / Dashboard Image Float ── */}
          <motion.div 
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, type: "spring", bounce: 0.4 }}
            className="w-full max-w-5xl mx-auto px-6 relative"
          >
            {/* The glassy outer browser chrome frame */}
            <div className="w-full rounded-t-[2rem] bg-neutral-100/50 backdrop-blur-md border border-neutral-200 border-b-0 p-4 pb-0 shadow-2xl shadow-black/5 overflow-hidden">
              <div className="flex items-center gap-2 mb-4 px-2 opacity-50">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
              </div>
              {/* The actual dashboard screenshot filling the rest */}
              <div className="relative w-full aspect-[16/10] rounded-t-xl overflow-hidden border border-neutral-200 border-b-0 bg-white">
                <Image 
                  src="/landing/dashboard.png" 
                  alt="SpendSense Dashboard" 
                  fill 
                  className="object-cover object-top"
                  priority
                />
              </div>
            </div>
          </motion.div>

        </main>

        {/* ── Features Section ── */}
        <section id="features" className="relative z-10 w-full px-6 py-32 bg-white flex flex-col items-center scroll-mt-32">
          <div className="text-center max-w-2xl mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Everything you need</h2>
            <p className="text-neutral-500 text-lg">Powerful features wrapped in an elegant interface. Manage your money without the headache.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
            {[
              { title: "Intelligent AI Insights", desc: "Our AI analyzes your spending patterns and highlights smarter ways to save.", icon: "✨" },
              { title: "Smart Categorization", desc: "Every transaction is categorized automatically — no manual sorting required.", icon: "📊" },
              { title: "Receipt Scanning", desc: "Scan receipts in seconds. We extract the details instantly.", icon: "📸" },
              { title: "Custom Budgets", desc: "Set limits for different categories. Get notified before you go over budget.", icon: "🎯" },
              { title: "Recurring Tracker", desc: "Never miss a subscription. Track subscriptions and recurring payments effortlessly.", icon: "🔄" },
              { title: "Bank-grade Security", desc: "Your financial data stays encrypted and private. Always.", icon: "🔒" },
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-neutral-50 rounded-3xl p-8 border border-neutral-100 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm border border-neutral-100 mb-6">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-neutral-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Product Showcase (Bento Grid Style) ── */}
        <section id="showcase" className="relative z-10 w-full px-6 py-20 bg-neutral-100 rounded-[3rem] max-w-[95%] mx-auto mb-20 overflow-hidden scroll-mt-32">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Complete Control</h2>
            <p className="text-neutral-500 md:text-lg">Manage multiple accounts from one unified dashboard.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[1200px] mx-auto">
            {/* Card 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-[2rem] pt-8 md:pt-12 px-8 md:px-12 border border-neutral-200 shadow-sm flex flex-col justify-between overflow-hidden"
            >
              <div className="mb-12">
                <h3 className="text-[1.75rem] font-bold mb-3 text-black">Premium Accounts</h3>
                <p className="text-neutral-500 text-lg leading-relaxed max-w-sm">Treat your multiple bank accounts like a premium deck. Track separate balances effortlessly.</p>
              </div>
              <div className="relative w-full aspect-[4/3] sm:aspect-video lg:aspect-[4/3] rounded-t-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.05)] border border-neutral-100 border-b-0">
                <Image src="/landing/accounts.png" alt="Accounts" fill className="object-cover object-left-top" />
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[2rem] pt-8 md:pt-12 px-8 md:px-12 border border-neutral-200 shadow-sm flex flex-col justify-between overflow-hidden"
            >
              <div className="mb-12">
                <h3 className="text-[1.75rem] font-bold mb-3 text-black">Seamless Transactions</h3>
                <p className="text-neutral-500 text-lg leading-relaxed max-w-sm">Log and track every transaction with clarity and precision. Categorize on the fly and manage cash flow.</p>
              </div>
              <div className="relative w-full aspect-[4/3] sm:aspect-video lg:aspect-[4/3] rounded-t-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.05)] border border-neutral-100 border-b-0">
                <Image src="/landing/transactions.png" alt="Transactions" fill className="object-cover object-left-top" />
              </div>
            </motion.div>

            {/* Card 3 (Full Width Export) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[2rem] pt-8 md:pt-12 px-8 md:px-12 lg:pr-0 pb-0 border border-neutral-200 shadow-sm flex flex-col lg:flex-row lg:col-span-2 overflow-hidden gap-8 md:gap-12"
            >
              <div className="mb-8 lg:mb-12 lg:w-1/3 flex flex-col justify-center">
                <h3 className="text-[1.75rem] font-bold mb-3 text-black">Powerful Export Options</h3>
                <p className="text-neutral-500 text-lg leading-relaxed">Export or email your transaction history as a PDF or spreadsheet in seconds.</p>
              </div>
              <div className="relative w-full lg:w-2/3 aspect-[4/3] lg:aspect-auto lg:h-[400px] lg:mt-12 rounded-t-2xl lg:rounded-tr-none lg:rounded-tl-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.05)] border border-neutral-100 border-b-0 lg:border-r-0 lg:border-l lg:border-t">
                <Image src="/landing/export.png" alt="Export" fill className="object-cover object-left-top" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative z-10 w-full px-6 py-32 flex flex-col items-center text-center">
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 max-w-3xl">
            Ready to organize your financial life?
          </h2>
          <p className="text-xl text-neutral-500 mb-10 max-w-2xl">
            Start organizing your finances today.
Set up your first budget in under 60 seconds.
          </p>
          <ClerkLoading>
            <div className="w-48 h-12 rounded-full bg-neutral-200 animate-pulse" />
          </ClerkLoading>
          <SignedOut>
            <Link href="/sign-up" className="bg-black text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20">
              Start Your Free Journey
            </Link>
           
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="bg-black text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20">
              Go To Dashboard
            </Link>
          </SignedIn>
        </section>
      </div>

      {/* ── Personal Portfolio Style Footer ── */}
      <Footer />
    </div>
  );
}
