'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, ArrowRight, TrendingUp, Maximize2 } from 'lucide-react';
import { AuditItem } from '../app/page';

// --- PROPS ---
interface BentoGridProps {
    slideIndex: number;
    data: AuditItem;
    url: string;
    imageString: string;
    device: 'desktop' | 'mobile'; // <--- NEW PROP
    onCardClick: (id: string) => void;
}

const BentoGrid = ({ slideIndex, data, url, imageString, device, onCardClick }: BentoGridProps) => {
    return (
        <div className="relative w-full bg-fuchsia-800/15 max-w-7xl mx-auto p-4 rounded-[40px] h-auto font-sans">
            <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-2 gap-6 h-[75vh]">

                {/* 1. SCORE */}
                <CardWrapper id="score" slideIndex={slideIndex} colSpan="md:col-span-3" rowSpan="md:row-span-1" onClick={onCardClick}>
                    <ScoreContent data={data} />
                </CardWrapper>

                {/* 2. ANALYSIS */}
                <CardWrapper id="analysis" slideIndex={slideIndex} colSpan="md:col-span-9" rowSpan="md:row-span-1" onClick={onCardClick}>
                    <AnalysisContent data={data} />
                </CardWrapper>

                {/* 3. FIX */}
                <CardWrapper id="fix" slideIndex={slideIndex} colSpan="md:col-span-5" rowSpan="md:row-span-1" onClick={onCardClick} isDark>
                    <FixContent data={data} />
                </CardWrapper>

                {/* 4. IMAGE - Passing device prop here */}
                <CardWrapper id="image" slideIndex={slideIndex} colSpan="md:col-span-4" rowSpan="md:row-span-1" onClick={onCardClick} isImage>
                    <ImageContent
                        data={data}
                        url={url}
                        imageString={imageString}
                        device={device} // <--- Pass device
                    />
                </CardWrapper>

                {/* 5. IMPACT */}
                <CardWrapper id="impact" slideIndex={slideIndex} colSpan="md:col-span-3" rowSpan="md:row-span-1" onClick={onCardClick}>
                    <ImpactContent data={data} />
                </CardWrapper>

            </div>
        </div>
    );
};

// --- HELPER COMPONENTS ---

export const CardWrapper = ({ id, slideIndex, colSpan, rowSpan, children, onClick, isImage, isDark }: any) => {
    const uniqueId = `${id}-${slideIndex}`;

    return (
        <motion.div
            layoutId={uniqueId}
            onClick={() => onClick(uniqueId)}
            className={`${colSpan} ${rowSpan} relative group cursor-pointer`}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
            <div className="absolute inset-0 rounded-[32px] border border-white/5 group-hover:border-orange-500/30 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] transition-all duration-300 pointer-events-none z-20" />

            <div className={`w-full h-full rounded-[32px] overflow-hidden relative 
                ${isImage ? 'bg-black' : isDark ? 'bg-gradient-to-br from-[#111] to-[#050505]' : 'bg-[#0f0f0f]'} 
                ${isImage ? '' : 'p-6 md:p-8 flex flex-col'}
             `}>
                {children}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                    <Maximize2 size={16} className="text-white/40" />
                </div>
            </div>
        </motion.div>
    );
};

// --- CONTENT COMPONENTS ---

export const ScoreContent = ({ expanded = false, data }: { expanded?: boolean, data: AuditItem }) => (
    <div className="h-full flex flex-col justify-between">
        <div className="flex justify-between items-start">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">UX Score</span>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full border border-orange-500/20 text-orange-500 bg-orange-500/5 uppercase">
                {data.level}
            </span>
        </div>
        <div className="mt-2 flex-1 flex flex-col justify-center">
            <h2 className={`${expanded ? 'text-[7rem]' : 'text-[5rem]'} leading-none font-black text-white tracking-tighter`}>
                {data.score}<span className="text-2xl text-zinc-600 font-medium tracking-normal">/100</span>
            </h2>
        </div>
        <div className="w-full space-y-3">
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.score}%` }}
                    transition={{ duration: 1, delay: 0.5, ease: "circOut" }}
                    className="h-full bg-orange-500 rounded-full shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                />
            </div>
            {expanded && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-zinc-400 text-xs mt-2 font-medium tracking-wide">
                    Score based on weighted heuristics.
                </motion.p>
            )}
        </div>
    </div>
);

export const AnalysisContent = ({ expanded = false, data }: { expanded?: boolean, data: AuditItem }) => (
    <div className="h-full flex gap-6 relative">
        <div className="w-1.5 h-full bg-orange-500/50 rounded-full shrink-0" />
        <div className="flex flex-col flex-1">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-1.5 bg-orange-500/10 rounded border border-orange-500/20">
                    <AlertTriangle size={16} className="text-orange-500" />
                </div>
                <span className="text-zinc-200 font-bold text-sm uppercase tracking-wide">Analysis & Friction</span>
            </div>
            <ul className="space-y-4">
                {data.analysis.map((point, i) => (
                    <li key={i} className={`text-zinc-400 ${expanded ? 'text-lg' : 'text-sm line-clamp-2'} leading-relaxed`}>
                        {(!expanded && i > 1) ? null : <span className="flex gap-2"><span className="text-orange-500/50 mt-1">•</span> {point}</span>}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

export const FixContent = ({ expanded = false, data }: { expanded?: boolean, data: AuditItem }) => (
    <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-6">
            <Zap size={18} className="text-emerald-400 fill-emerald-400/20" />
            <span className="text-emerald-100 font-bold text-sm uppercase tracking-wider">The Solution</span>
        </div>
        <div className={`space-y-4 ${expanded ? '' : 'flex-1'}`}>
            {data.fix.map((point, i) => (
                <div key={i} className={`flex gap-4 group/item ${(!expanded && i > 1) ? 'hidden' : ''}`}>
                    <div className="shrink-0 mt-1.5 w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover/item:border-emerald-500/50 transition-colors">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    </div>
                    <p className={`text-zinc-300 ${expanded ? 'text-lg' : 'text-xs line-clamp-2'} leading-relaxed font-light`}>{point}</p>
                </div>
            ))}
        </div>
        {!expanded && <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500"><span>2 Steps to fix</span><ArrowRight size={14} /></div>}
    </div>
);

// --- UPDATED IMAGE CONTENT TO HANDLE DEVICE LAYOUT ---

export const ImageContent = ({
    expanded = false,
    data,
    url,
    imageString,
    device
}: {
    expanded?: boolean,
    data: AuditItem,
    url: string,
    imageString: string,
    device: 'desktop' | 'mobile' // Prop received here
}) => {

    // Determine the viewport image style based on device setting
    const isMobile = device === 'mobile';

    return (
        <div className="w-full h-full relative group flex flex-col">
            {/* 1. Browser Toolbar (Expanded Only) */}
            {expanded && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full bg-[#1a1a1a] border-b border-white/10 p-3 flex items-center gap-4 px-6">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    </div>
                    <div className="flex-1 max-w-lg bg-white/5 border border-white/5 rounded-md py-1 px-3 text-[10px] text-zinc-500 font-mono truncate">
                        {url}/audit/{device}/view-{data.imageIndex + 1}
                    </div>
                </motion.div>
            )}

            {/* 2. Image Container */}
            <div className={`flex-1 relative h-full ${expanded ? 'min-h-[50vh]' : 'min-h-50'} overflow-hidden`}>

                {/* LOGIC: 
                   - If Expanded: Always contain (so we see full scroll).
                   - If Desktop Card: Object Cover (fills the rectangle).
                   - If Mobile Card: Object Contain (centers the tall phone UI).
                */}
                <Image
                    src={imageString}
                    alt={`Audit Section ${data.section}`}
                    fill
                    className={`transition-all duration-700 ease-in-out 
                        ${expanded
                            ? 'object-contain bg-zinc-950 p-4'
                            : isMobile
                                ? 'object-contain bg-[#050505] p-2' // Mobile: Center the tall image
                                : 'object-cover object-top opacity-80 group-hover:opacity-100' // Desktop: Fill the card
                        }
                    `}
                    priority
                />

                {/* 3. Viewport Badge (Grid View Only) */}
                {!expanded && (
                    <div className="absolute top-6 left-6 z-20">
                        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl">
                            <div className={`w-2 h-2 rounded-full ${isMobile ? 'bg-purple-500 shadow-purple-500/50' : 'bg-blue-500 shadow-blue-500/50'} animate-pulse shadow-[0_0_8px]`} />
                            <span className="text-white text-[10px] font-bold uppercase tracking-widest">
                                {isMobile ? 'Mobile View' : 'Desktop View'}
                            </span>
                        </div>
                    </div>
                )}

                {/* 4. Scan Line Animation (Expanded Only) */}
                {expanded && (
                    <motion.div
                        initial={{ top: "-10%" }}
                        animate={{ top: "110%" }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-30 pointer-events-none"
                    />
                )}
            </div>
        </div>
    );
}

export const ImpactContent = ({ expanded = false, data }: { expanded?: boolean, data: AuditItem }) => (
    <div className="h-full flex flex-col relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-green-500/5 rounded-full blur-3xl" />
        <div className="flex items-center gap-2 mb-4 text-green-400"><TrendingUp size={16} /><span className="font-bold text-xs uppercase tracking-wider">Projected Impact</span></div>
        <div className="flex-1"><p className={`text-zinc-200 ${expanded ? 'text-3xl leading-tight' : 'text-lg leading-snug line-clamp-4'} font-medium`}>"{data.impact}"</p></div>
        {!expanded && <div className="mt-4 flex items-center gap-2"><span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20">+15% Conversion</span></div>}
    </div>
);

export default BentoGrid;