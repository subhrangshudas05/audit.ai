'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { ChevronDown, Check, Loader2, Monitor, Smartphone } from 'lucide-react';
import AuditSwiper from '@/components/AuditSwiper';
import { stat } from 'fs';

// 1. Define the Master Ease globally to ensure sync
const editorialEase = [0.32, 0.72, 0, 1] as const;

export interface AuditItem {
  imageIndex: number;
  section: string;
  score: number;
  level: "Critical" | "Needs Improvement" | "Optimal";
  analysis: string[];
  fix: string[];
  impact: string;
  // We will assume the image path comes from the backend or we construct it
}

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [url, setUrl] = useState('');

  const [auditData, setAuditData] = useState<AuditItem[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Auto-detect device on mount
  useEffect(() => {
    const checkDevice = () => {
      setDevice(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);


  // --- YOUR TEST EFFECT (Kept for your debugging) ---
  // useEffect(() => {
  //   const completeTimer = setTimeout(() => {
  //     setStatus('complete');
  //     // const idleTimer = setTimeout(() => {
  //     //   setStatus('idle');
  //     // }, 4000);
  //     // return () => clearTimeout(idleTimer);
  //   }, 3000);
  //   return () => clearTimeout(completeTimer);
  // }, []);
  // ------------------------------------------------

  const AUDIT_MESSAGES = [
    "Bypassing bot detection...",
    "Simulating human scroll patterns...",
    "Capturing high-res viewports...",
    "Analyzing visual hierarchy...",
    "Gemini is identifying friction points...",
    "Finalizing the 'Roast' report..."
  ];

  const MODES = [
    { id: 'fast', label: 'Fast', desc: 'Quick scan for static sites', delay: 400 },
    { id: 'moderate', label: 'Moderate', desc: 'Balanced scan', delay: 800 },
    { id: 'heavy', label: 'Heavy', desc: 'Thorough scan', delay: 1600 }
  ];

  const [selectedMode, setSelectedMode] = useState(MODES[1]);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [scannedDevice, setScannedDevice] = useState<'desktop' | 'mobile'>('desktop');

  const handleScan = async () => {
    setIsModeOpen(false);
    if (!url) return;

    const successSound = new Audio('/done.mp3');

    abortControllerRef.current = new AbortController();

    const slectedDevice = device;

    setStatus('scanning');
    setAuditData([]);

    let messageIndex = 0;
    setLoadingMessage(AUDIT_MESSAGES[0]);
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % AUDIT_MESSAGES.length;
      setLoadingMessage(AUDIT_MESSAGES[messageIndex]);
    }, 3500);

    try {
      const response = await fetch('/api/puppeteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          delay: selectedMode.delay,
          device: slectedDevice
        }),
        signal: abortControllerRef.current.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Puppeteer failed');

      clearInterval(messageInterval);
      setLoadingMessage('Analysis Complete!');

      setAuditData(data.audit);     
      setScannedDevice(data.device);
      setScreenshots(data.screenshots);

      await new Promise(r => setTimeout(r, 600));

      setStatus('complete');
      successSound.play().catch(err => console.log("Audio playback blocked:", err));
      toast.success('Audit Report Generated!');

    } catch (error: any) {
      clearInterval(messageInterval);
      if (error.name !== 'AbortError') {
        toast.error('Scan Failed', { description: error.message });
        setStatus('idle');
      }
    } finally {
      setLoadingMessage('');
    }
  };

  const stopScanning = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setStatus('idle');
    toast.error('Scan Terminated');
  };

  const resetScan = () => {
    setStatus('idle');
    setUrl('');
    setAuditData([]);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isModeOpen]);

  // Auto-scroll logic
  useEffect(() => {
    if (status === 'complete') {
      const timer = setTimeout(() => {
        if (resultsRef.current) {
          const yOffset = resultsRef.current.getBoundingClientRect().top;
          const targetY = yOffset + window.scrollY ;
          animate(window.scrollY, targetY, {
            type: "tween",
            duration: 1.2,
            delay: 0,
            ease: editorialEase,
            onUpdate: (latest) => window.scrollTo(0, latest),
          });
        }
      }, 600);
      return () => clearTimeout(timer);
    }

    // FIX: SCROLL BACK TO TOP ON RESET
    if (status === 'idle') {
      animate(window.scrollY, 0, {
        type: "tween",
        duration: 0.8, // Match your UI transition duration
        ease: editorialEase,
        onUpdate: (latest) => window.scrollTo(0, latest),
      });
    }
  }, [status]);

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-indigo-500/30 pb-12">

      {/* Background Ambience */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full flex flex-col items-center">

        {/* --- INPUT SECTION --- */}
        <motion.div
          layout="position"
          transition={{ duration: 0.8, ease: editorialEase, delay: 0.2 }}
          className={`
            relative z-50 flex flex-col items-center w-full max-w-3xl px-4 mx-auto
            ${status === 'complete' ? 'h-20 ' : ''}
            ${status === 'idle' || status === 'scanning' ? 'mt-[35vh]' : 'mt-12 mb-8'} 
          `}
        >

          {/* HEADLINE (Unchanged) */}
          <AnimatePresence mode="popLayout">
            {status !== 'complete' && (
              <motion.div
                key="headline"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  // y: -40,
                  position: "absolute", // ⭐ prevents layout squash
                  transition: { duration: 0.8, ease: editorialEase }
                }}
                transition={{ duration: 0.8, ease: editorialEase }}
                className="text-center mb-8 w-full"
              >
                <h1 className="text-4xl md:text-6xl pb-2 font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                  Is your website <br className="hidden md:block" /> killing your business?
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          {/* INPUT BAR CONTAINER */}
          <motion.div
            layout="position"
            animate={{ scale: status === 'complete' ? 0.9 : 1 }}
            transition={{ duration: 0.8, ease: editorialEase, delay: status === 'complete' ? 0.2 : 0 }}
            className="relative w-full group"
          >

            {/* 1. THE GLOW (Unchanged) */}
            <div className={`
                absolute -inset-1 rounded-full blur-lg opacity-40 transition duration-500
                bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500
                group-hover:opacity-60 group-hover:blur-[20px] group-hover:duration-200
                ${status === 'scanning' ? 'animate-pulse opacity-80' : ''}
            `} />

            {/* 2. THE BAR ITSELF */}
            <div className="relative flex items-center bg-[#0a0a0a] border border-white/10 rounded-full p-2 shadow-2xl">

              {/* SCAN BEAM LAYER (Unchanged) */}
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none z-0">
                {status === 'scanning' && (
                  <motion.div
                    initial={{ left: '-20%' }}
                    animate={{ left: '120%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent -skew-x-12 z-0"
                  />
                )}
              </div>

              {/* DROPDOWN TOGGLE (Unchanged) */}
              <div ref={dropdownRef} className="relative ml-4 z-20">
                <button
                  onClick={() => status !== 'scanning' && setIsModeOpen(!isModeOpen)}
                  className="flex items-center space-x-2 px-3 py-1 hover:bg-white/5 rounded-lg transition-all group"
                  disabled={status === 'scanning'}
                >
                  <span className="text-sm font-medium text-white/70 group-hover:text-white">{selectedMode.label}</span>
                  <motion.span animate={{ rotate: isModeOpen ? 180 : 0 }}>
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isModeOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-4 w-72 bg-[#161616] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden"
                    >
                      {MODES.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => { setSelectedMode(mode); setIsModeOpen(false); }}
                          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{mode.label}</p>
                            <p className="text-xs text-white/40">{mode.desc}</p>
                          </div>
                          {selectedMode.id === mode.id && <Check className="w-4 h-4 text-indigo-500" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* TEXT INPUT (Unchanged) */}
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && status !== 'scanning' && handleScan()}
                placeholder="Paste your URL here..."
                disabled={status === 'scanning'}
                className="relative z-10 flex-1 bg-transparent border-none outline-none text-white placeholder-white/20 px-6 h-12 text-[15px] font-light tracking-wide min-w-0"
              />

              {/* --- NEW: DEVICE TOGGLE --- */}
              <div className="relative z-10 flex items-center bg-white/5 rounded-full p-1 border border-white/5 mr-3 h-10">
                {['desktop', 'mobile'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDevice(d as 'desktop' | 'mobile')}
                    disabled={status === 'scanning'}
                    className="relative w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-50"
                  >
                    {device === d && (
                      <motion.div
                        layoutId="device-active"
                        className="absolute inset-0 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    {d === 'desktop' ? (
                      <Monitor className={`w-4 h-4 relative z-10 transition-colors duration-200 ${device === 'desktop' ? 'text-black' : 'text-zinc-400 hover:text-white'}`} />
                    ) : (
                      <Smartphone className={`w-4 h-4 relative z-10 transition-colors duration-200 ${device === 'mobile' ? 'text-black' : 'text-zinc-400 hover:text-white'}`} />
                    )}
                  </button>
                ))}
              </div>

              {/* ACTION BUTTON (Unchanged) */}
              <div className="relative z-10">
                {status === 'scanning' ? (
                  <button onClick={stopScanning} className="ml-2 h-12 w-12 flex items-center justify-center bg-white/10 rounded-full hover:bg-red-500/20 group transition-all">
                    <div className="h-3 w-3 bg-white rounded-sm group-hover:bg-red-500 transition-colors" />
                  </button>
                ) : (
                  <button
                    onClick={handleScan}
                    disabled={!url}
                    className="ml-2 px-8 h-12 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === 'idle' ? 'Scan' : 'Rescan'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* STATUS / FOOTER (Unchanged) */}
          <div className="relative w-full h-12 mt-8 flex justify-center items-center">
            <AnimatePresence mode="wait">
              {status === 'scanning' && loadingMessage && (
                <div className="absolute inset-0 flex justify-center items-center">
                  <StatusMessage message={loadingMessage} />
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {status !== 'complete' && status !== 'scanning' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute text-sm text-white/20 tracking-widest uppercase"
                >
                  Powered by Gemini
                </motion.p>
              )}
            </AnimatePresence>
          </div>

        </motion.div>


        {/* --- RESULTS SECTION --- */}
        <AnimatePresence>
          {status === 'complete' && (
            <motion.div
              ref={resultsRef}
              key="results"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              // FIX 4: Smoother exit that travels UP slightly (y: -20) to match the bar moving down
              exit={{ opacity: 0, y: 20, transition: { duration: 0.8, ease: editorialEase } }}
              transition={{ duration: 0.8, delay: status === 'complete' ? 0.2 : 0, ease: editorialEase }}
              className="w-full relative  z-10 bg-fuchsia-300/0"
            >
              <AuditSwiper
                data={auditData}
                url={url}
                images={screenshots}
                device={scannedDevice}
              />
              <div className="flex justify-center">
                <button
                  onClick={resetScan}
                  className="group absolute bottom-10 right-8  px-8 py-3 rounded-full overflow-hidden transition-all duration-300 active:scale-95"
                >
                  <div className="absolute inset-0 border border-white/10 bg-white/5 rounded-full transition-colors group-hover:bg-white/10 group-hover:border-white/20" />
                  <span className="relative z-10 text-white/40 group-hover:text-white/80 transition-colors text-sm font-medium tracking-wide">
                    Scan another URL
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}

function StatusMessage({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center space-x-3 mt-8"
    >
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
          />
        ))}
      </div>
      <span className="text-sm font-medium tracking-widest text-white/50 uppercase italic">
        {message}
      </span>
    </motion.div>
  );
}