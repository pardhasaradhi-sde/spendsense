import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="w-full bg-[#fcfcfc] px-6 md:px-12 pt-16 pb-8 flex flex-col font-sans text-black border-t border-neutral-200 overflow-hidden">
      
      <div className="flex flex-col lg:flex-row justify-between w-full max-w-[1500px] mx-auto mb-10 gap-16 lg:gap-8">
        
        {/* Left Side: Link Columns */}
        <div className="flex flex-col sm:flex-row gap-16 sm:gap-32 w-full lg:w-auto">
          {/* Socials Column */}
          <div className="flex flex-col gap-6">
            <h4 className="text-[11px] font-bold text-neutral-400 tracking-[0.2em] uppercase mb-2">Socials</h4>
            <Link href="https://github.com/Pardhasaradhi-SDE" target="_blank" className="text-lg md:text-xl font-medium hover:text-neutral-500 transition-colors tracking-tight uppercase">Github</Link>
            <Link href="https://linkedin.com/in/seerapu-pardha-saradhi" target="_blank" className="text-lg md:text-xl font-medium hover:text-neutral-500 transition-colors tracking-tight uppercase">Linkedin</Link>
            <Link href="#" className="text-lg md:text-xl font-medium hover:text-neutral-500 transition-colors tracking-tight uppercase">Twitter</Link>
            <Link href="#" className="text-lg md:text-xl font-medium hover:text-neutral-500 transition-colors tracking-tight uppercase">Instagram</Link>
          </div>

          {/* Competitive Coding Column */}
          <div className="flex flex-col gap-6">
            <h4 className="text-[11px] font-bold text-neutral-400 tracking-[0.2em] uppercase mb-2">Competitive Coding</h4>
            <Link href="#" className="text-lg md:text-xl font-medium hover:text-neutral-500 transition-colors tracking-tight uppercase">Leetcode</Link>
            <Link href="#" className="text-lg md:text-xl font-medium hover:text-neutral-500 transition-colors tracking-tight uppercase">Geeksforgeeks</Link>
            <Link href="#" className="text-lg md:text-xl font-medium hover:text-neutral-500 transition-colors tracking-tight uppercase">Codechef</Link>
          </div>
        </div>

        {/* Right Side: Massive Text and Connect */}
        <div className="flex flex-col items-start lg:items-end w-full lg:w-3/5 overflow-hidden">
           <h4 className="text-[11px] font-bold text-neutral-400 tracking-[0.2em] uppercase mb-6 lg:mb-2">Want to connect?</h4>
           
           {/* The massive SPENDSENSE block replacing LET'S TALK */}
           <div className="flex w-full overflow-hidden items-center justify-start lg:justify-end gap-3 md:gap-6">
             <Image src="/logo.png" alt="SpendSense" width={88} height={88} className="hidden lg:block object-contain shrink-0" />
             <div className="flex-1 lg:flex-none min-w-0 max-w-full overflow-hidden">
               <h1 className="text-[12.5vw] sm:text-[11vw] md:text-[9vw] lg:text-[6vw] xl:text-[7vw] leading-[0.85] font-black tracking-tighter text-black uppercase text-left lg:text-right truncate break-keep">
                 Spendsense
               </h1>
             </div>
           </div>
           
           <a href="mailto:seerapupardhu123@gmail.com" className="mt-8 text-neutral-500 hover:text-black transition-colors text-sm md:text-base font-medium">
             seerapupardhu123@gmail.com
           </a>
        </div>

      </div>

      {/* Bottom Bar: Copyright & Location */}
      <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-[1500px] mx-auto text-[11px] font-bold text-neutral-400 tracking-[0.15em] uppercase gap-6 pt-8 border-t border-neutral-200/60">
        <p>© {new Date().getFullYear()} SEERAPU PARDHA SARADHI</p>
        <p>HYDERABAD, INDIA</p>
      </div>
    </footer>
  );
}
