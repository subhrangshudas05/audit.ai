"use client";

import React, { useState, useEffect } from "react"; // Added useEffect
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules"; // Removed Keyboard module
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "swiper/css";
import { AuditItem } from "../app/page";

import BentoGrid, { ScoreContent, AnalysisContent, FixContent, ImageContent, ImpactContent } from "./BentoGrid";

interface AuditSwiperProps {
    data: AuditItem[];
    url: string;
    images: string[];
    device: 'desktop' | 'mobile';
}

export default function AuditSwiper({ data, url, images, device }: AuditSwiperProps) {
    const [swiperInstance, setSwiperInstance] = useState<any>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isBeginning, setIsBeginning] = useState(true);
    const [isEnd, setIsEnd] = useState(false);

    // Global Modal State
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const handleSlideChange = (swiper: any) => {
        setActiveIndex(swiper.activeIndex);
        setIsBeginning(swiper.isBeginning);
        setIsEnd(swiper.isEnd);
    };

    // --- MANUAL KEYBOARD LISTENER ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 1. Don't slide if the modal is open!
            if (selectedId) return;

            // 2. Don't slide if Swiper isn't ready
            if (!swiperInstance) return;

            if (e.key === "ArrowLeft") {
                swiperInstance.slidePrev();
            } else if (e.key === "ArrowRight") {
                swiperInstance.slideNext();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [swiperInstance, selectedId]); // Re-bind if instance or modal state changes

    // --- HELPER ---
    const getActiveItemForModal = () => {
        if (!selectedId) return null;
        const index = parseInt(selectedId.split('-').pop() || '0', 10);
        return data[index];
    };

    const activeModalData = getActiveItemForModal();

    return (
        <section className="relative w-full  min-h-screen flex flex-col items-center justify-center py-10 overflow-hidden">

            {/* --- SWIPER CONTAINER --- */}
            <div className="w-full relative z-10">
                <Swiper
                    modules={[Navigation]} // Removed Keyboard module
                    spaceBetween={24}
                    slidesPerView="auto"
                    centeredSlides={true}
                    loop={false}
                    speed={600}
                    className="w-full !overflow-visible"
                    onSwiper={(swiper) => {
                        setSwiperInstance(swiper);
                        setIsBeginning(swiper.isBeginning);
                        setIsEnd(swiper.isEnd);
                    }}
                    onSlideChange={handleSlideChange}
                >
                    {data.map((auditItem, index) => (
                        <SwiperSlide key={index} className="!w-[90vw] md:!w-[80vw] !max-w-7xl h-auto">
                            <div className={`transition-all duration-500 ${activeIndex === index ? 'scale-100 opacity-100' : 'scale-95 opacity-60 blur-[2px]'}`}>

                                <BentoGrid
                                    slideIndex={index}
                                    data={auditItem}
                                    url={url}
                                    imageString={images[auditItem.imageIndex]}
                                    onCardClick={setSelectedId}
                                    device={device}

                                />

                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {/* --- CUSTOM NAVIGATION BAR --- */}
            <div className="mt-8 flex items-center gap-6 md:gap-8 z-50">

                {/* PREV BUTTON */}
                <div className={`w-12 h-12 flex items-center justify-center transition-opacity duration-300 ${isBeginning ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button
                        onClick={() => swiperInstance?.slidePrev()}
                        className="group relative flex items-center justify-center w-12 h-12 rounded-full border border-white/10 bg-white/5 hover:bg-orange-500 hover:border-orange-500 transition-all duration-300 active:scale-90"
                    >
                        <ChevronLeft className="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" />
                    </button>
                </div>

                {/* PAGINATION DOTS */}
                <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full border border-white/5 backdrop-blur-md">
                    {data.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => swiperInstance?.slideTo(index)}
                            className="relative w-3 h-3 flex items-center justify-center outline-none"
                        >
                            {/* The Background Glow */}
                            {activeIndex === index && (
                                <motion.div
                                    layoutId="active-dot-glow"
                                    className="absolute inset-0 -m-1.5 w-6 h-6 bg-orange-500/20 rounded-full border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                />
                            )}
                            {/* The Dot Itself */}
                            <div className={`rounded-full transition-all duration-300 z-10 ${activeIndex === index ? 'w-2 h-2 bg-orange-500' : 'w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-400'}`} />
                        </button>
                    ))}
                </div>

                {/* NEXT BUTTON */}
                <div className={`w-12 h-12 flex items-center justify-center transition-opacity duration-300 ${isEnd ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button
                        onClick={() => swiperInstance?.slideNext()}
                        className="group relative flex items-center justify-center w-12 h-12 rounded-full border border-white/10 bg-white/5 hover:bg-orange-500 hover:border-orange-500 transition-all duration-300 active:scale-90"
                    >
                        <ChevronRight className="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" />
                    </button>
                </div>

            </div>

            {/* --- GLOBAL MODAL --- */}
            <AnimatePresence>
                {selectedId && activeModalData && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-10">

                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setSelectedId(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />

                        {/* The Modal */}
                        <motion.div
                            layoutId={selectedId}
                            className="w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-[32px] relative z-50 shadow-2xl flex flex-col max-h-[85vh]"
                        >
                            <button
                                onClick={() => setSelectedId(null)}
                                className="absolute -top-12 right-0 md:-right-12 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors pointer-events-auto"
                            >
                                <X size={24} />
                            </button>

                            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="h-full"
                                >

                                    {selectedId.startsWith("score") && (
                                        <ScoreContent expanded data={activeModalData} />
                                    )}

                                    {selectedId.startsWith("analysis") && (
                                        <AnalysisContent expanded data={activeModalData} />
                                    )}

                                    {selectedId.startsWith("fix") && (
                                        <FixContent expanded data={activeModalData} />
                                    )}

                                    {/* IMAGE CONTENT */}
                                    {selectedId.startsWith("image") && (
                                        <ImageContent
                                            expanded
                                            data={activeModalData}
                                            url={url}
                                            imageString={images[activeModalData.imageIndex]}
                                            device={device}
                                        />
                                    )}

                                    {selectedId.startsWith("impact") && (
                                        <ImpactContent expanded data={activeModalData} />
                                    )}
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </section>
    );
}