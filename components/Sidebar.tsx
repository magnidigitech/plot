"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import React from "react";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
    side?: "left" | "right";
}

export function Sidebar({ isOpen, onClose, children, title, side = "left" }: SidebarProps) {
    return (
        <>
            {/* Mobile Overlay Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={cn(
                    "fixed inset-y-0 z-50 w-[340px] bg-white border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none md:relative md:translate-x-0 h-full",
                    side === "left" ? "left-0 border-r" : "right-0 border-l",
                    isOpen ? "translate-x-0" : (side === "left" ? "-translate-x-full" : "translate-x-full")
                )}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 backdrop-blur">
                    <h2 className="text-xl font-bold tracking-tight text-gray-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="md:hidden p-2 rounded-md hover:bg-gray-200 transition-colors text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200">
                    {children}
                </div>
            </aside>
        </>
    );
}
