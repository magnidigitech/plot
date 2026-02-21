"use client";

import React, { useEffect, useState, useMemo } from 'react';
import parse, { DOMNode, Element, attributesToProps } from 'html-react-parser';
import { Plot } from '@/lib/types';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Compass, Navigation } from 'lucide-react';

interface InteractiveSVGMapProps {
    svgUrl: string;
    plots: Plot[];
    selectedPlotId: number | null;
    onPlotSelect: (plotSignature: string, defaultPlot?: Partial<Plot>) => void;
    onPlotHover?: (e: React.MouseEvent, plotSignature: string | null, plot: Plot | null) => void;
    isAdminRoute?: boolean;
}

export function InteractiveSVGMap({
    svgUrl,
    plots,
    selectedPlotId,
    onPlotSelect,
    onPlotHover,
    isAdminRoute = false
}: InteractiveSVGMapProps) {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [rotation, setRotation] = useState(0);
    const [isRotating, setIsRotating] = useState(false);

    // Touch Rotation Logic
    const [touchStartAngle, setTouchStartAngle] = useState<number | null>(null);
    const [initialRotation, setInitialRotation] = useState(0);

    const getAngle = (touches: React.TouchList) => {
        if (touches.length < 2) return null;
        const touch1 = touches[0];
        const touch2 = touches[1];
        return Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX) * (180 / Math.PI);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const angle = getAngle(e.touches);
            if (angle !== null) {
                setTouchStartAngle(angle);
                setInitialRotation(rotation);
            }
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStartAngle !== null) {
            const currentAngle = getAngle(e.touches);
            if (currentAngle !== null) {
                const diff = currentAngle - touchStartAngle;
                setRotation((initialRotation + diff) % 360);
            }
        }
    };

    const handleTouchEnd = () => {
        setTouchStartAngle(null);
    };

    const handleReset = () => {
        setRotation(0);
    };

    // Fetch the raw SVG file
    useEffect(() => {
        async function fetchSVG() {
            try {
                const res = await fetch(svgUrl);
                const text = await res.text();
                setSvgContent(text);
            } catch (err) {
                console.error("Failed to load SVG:", err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchSVG();
    }, [svgUrl]);

    // Fast lookup dictionary for mapped plots based on unique signature
    const plotDict = useMemo(() => {
        const dict: Record<string, Plot> = {};
        plots.forEach(p => {
            dict[p.signature] = p;
        });
        return dict;
    }, [plots]);

    if (isLoading) {
        return <div className="w-full h-full flex items-center justify-center bg-gray-50 animate-pulse text-gray-500">Loading Map Engine...</div>;
    }

    if (!svgContent) {
        return <div className="w-full h-full flex items-center justify-center text-red-500">Failed to load Blueprint SVG.</div>;
    }

    // Function to generate a highly unique signature from an SVG node's attributes
    // e.g., finding the x, y, width, height, or coordinate points
    const generateSignature = (domNode: Element): string | null => {
        const attrs = domNode.attribs;
        if (!attrs) return null;

        if (domNode.name === 'rect') {
            return `rect-${attrs.x}-${attrs.y}-${attrs.width}-${attrs.height}`;
        }
        if (domNode.name === 'polygon') {
            // Trim and format poly points to ensure consistency
            const pts = attrs.points?.replace(/\s+/g, '-').replace(/,/g, '_');
            return `poly-${pts}`;
        }
        if (domNode.name === 'path') {
            // Take the first 30 chars of the path d attribute to avoid massive strings
            return `path-${attrs.d?.substring(0, 30).replace(/\s+/g, '-')}`;
        }
        if (domNode.name === 'circle') {
            return `circle-${attrs.cx}-${attrs.cy}-${attrs.r}`;
        }
        return null;
    };

    const getFillColor = (status: string, isSelected: boolean) => {
        if (isSelected) return "rgba(59, 130, 246, 0.6)"; // Blue
        switch (status) {
            case "AVAILABLE": return "rgba(34, 197, 94, 0.4)"; // Green
            case "SOLD": return "rgba(239, 68, 68, 0.6)"; // Red
            case "HOLD": return "rgba(234, 179, 8, 0.5)"; // Yellow
            case "ROAD": return "rgba(0, 0, 0, 0.2)"; // Light gray/black for roads
            default: return "transparent";
        }
    };

    const getCentroid = (domNode: Element) => {
        const attrs = domNode.attribs;
        if (!attrs) return { x: 0, y: 0 };

        if (domNode.name === 'rect') {
            const x = parseFloat(attrs.x || '0');
            const y = parseFloat(attrs.y || '0');
            const w = parseFloat(attrs.width || '0');
            const h = parseFloat(attrs.height || '0');
            return { x: x + w / 2, y: y + h / 2 };
        }
        if (domNode.name === 'polygon') {
            const pts = attrs.points?.split(/[\s,]+/).filter(Boolean).map(Number);
            if (pts && pts.length >= 2) {
                let sumX = 0, sumY = 0, count = 0;
                for (let i = 0; i < pts.length; i += 2) {
                    sumX += pts[i];
                    sumY += (pts[i + 1] || 0);
                    count++;
                }
                return { x: sumX / count, y: sumY / count };
            }
        }
        return { x: 0, y: 0 };
    };

    // The Parser Options where the magic happens
    const options = {
        replace: (domNode: DOMNode) => {
            if (domNode instanceof Element && domNode.attribs) {
                // We only care about actual drawn shapes that COULD be a plot
                if (['rect', 'polygon', 'path', 'circle'].includes(domNode.name)) {

                    const signature = generateSignature(domNode);
                    if (!signature) return domNode;

                    // Exclude massive background rectangles (heuristics: huge area)
                    const isHugeRect = domNode.name === 'rect' &&
                        Number(domNode.attribs.width || 0) > 2000;
                    if (isHugeRect) return domNode;

                    const mappedPlot = plotDict[signature];
                    const isSelected = mappedPlot?.id === selectedPlotId;

                    // Native stroke is defined by the SVG, we just manipulate fill and interactions
                    const status = mappedPlot ? mappedPlot.status : null;
                    const isNewUnsaved = mappedPlot && mappedPlot.id < 0;

                    let fillColor;
                    if (isSelected) {
                        fillColor = "rgba(59, 130, 246, 0.6)"; // Blue
                    } else if (status && !isNewUnsaved) {
                        fillColor = getFillColor(status, false);
                    } else {
                        fillColor = isAdminRoute ? "rgba(0,0,0,0.05)" : "transparent";
                    }

                    const extraProps = {
                        ...attributesToProps(domNode.attribs),
                        style: {
                            ...attributesToProps(domNode.attribs).style,
                            fill: fillColor,
                            cursor: status === 'ROAD' ? 'default' : 'pointer',
                            transition: 'all 0.2s ease',
                            strokeWidth: isSelected ? '8' : domNode.attribs['stroke-width'] || '2',
                            stroke: isSelected ? '#2563eb' : domNode.attribs.stroke || '#000',
                            pointerEvents: status === 'ROAD' && !isAdminRoute ? 'none' : 'auto'
                        },
                        className: status === 'ROAD' ? '' : 'hover:brightness-90',
                        onClick: (e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (mappedPlot) {
                                // Existing plot
                                onPlotSelect(signature, mappedPlot);
                            } else if (isAdminRoute) {
                                // Tell parent it's a completely new unmapped element so admin can create it
                                onPlotSelect(signature, { signature });
                            }
                        },
                        onMouseEnter: (e: React.MouseEvent) => {
                            if (onPlotHover && mappedPlot) {
                                onPlotHover(e, signature, mappedPlot);
                            }
                        },
                        onMouseLeave: (e: React.MouseEvent) => {
                            if (onPlotHover) {
                                onPlotHover(e, null, null);
                            }
                        }
                    };

                    const children = domNode.children && domNode.children.length > 0
                        ? domNode.children.map((child, index) => {
                            if (child.type === 'text') return child.data;
                            return undefined;
                        }).filter(Boolean)
                        : null;

                    const shapeElement = React.createElement(
                        domNode.name,
                        extraProps,
                        children
                    );

                    // Add Overlay Labels
                    const isRoad = status === 'ROAD';
                    const centroid = getCentroid(domNode);
                    let overlay = null;

                    if (mappedPlot) {
                        if (isRoad && !isNewUnsaved) {
                            overlay = (
                                <text x={centroid.x} y={centroid.y} fill="#4b5563" fontSize="80" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" pointerEvents="none" style={{ letterSpacing: '2px', textTransform: 'uppercase' }}>
                                    {mappedPlot.plotNumber}
                                </text>
                            );
                        } else if (!isNewUnsaved) {
                            overlay = (
                                <g pointerEvents="none">
                                    <circle cx={centroid.x} cy={centroid.y} r="160" fill="white" className="drop-shadow-lg" />
                                    <text x={centroid.x} y={centroid.y - 30} fill="black" fontSize="72" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                                        {mappedPlot.plotNumber}
                                    </text>
                                    <line x1={centroid.x - 70} y1={centroid.y + 15} x2={centroid.x + 70} y2={centroid.y + 15} stroke="#cbd5e1" strokeWidth="4" />
                                    <text x={centroid.x} y={centroid.y + 60} fill="#64748b" fontSize="40" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                                        {mappedPlot.area_sqyds}
                                    </text>

                                    {/* 4-Sided Dimensions */}
                                    {mappedPlot.dim_top && (
                                        <text x={centroid.x} y={centroid.y - 220} fill="#1e293b" fontSize="56" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" className="drop-shadow-sm">
                                            {mappedPlot.dim_top}
                                        </text>
                                    )}
                                    {mappedPlot.dim_bottom && (
                                        <text x={centroid.x} y={centroid.y + 220} fill="#1e293b" fontSize="56" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" className="drop-shadow-sm">
                                            {mappedPlot.dim_bottom}
                                        </text>
                                    )}
                                    {mappedPlot.dim_left && (
                                        <text x={centroid.x - 220} y={centroid.y} fill="#1e293b" fontSize="56" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 ${centroid.x - 220} ${centroid.y})`} className="drop-shadow-sm">
                                            {mappedPlot.dim_left}
                                        </text>
                                    )}
                                    {mappedPlot.dim_right && (
                                        <text x={centroid.x + 220} y={centroid.y} fill="#1e293b" fontSize="56" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(90 ${centroid.x + 220} ${centroid.y})`} className="drop-shadow-sm">
                                            {mappedPlot.dim_right}
                                        </text>
                                    )}

                                </g>
                            );
                        }
                    }

                    if (overlay) {
                        return (
                            <g key={signature}>
                                {shapeElement}
                                {overlay}
                            </g>
                        );
                    }

                    return shapeElement;
                }
            }
        }
    };

    return (
        <div className="relative w-full h-full bg-[#fcfcfc] overflow-hidden">
            <TransformWrapper
                initialScale={0.5}
                minScale={0.1}
                maxScale={8}
                centerOnInit={true}
                limitToBounds={false}
                wheel={{ step: 0.05 }} // Smoother zoom
                zoomAnimation={{ animationType: "easeOut" }}
                doubleClick={{ disabled: true }}
            >
                {({ zoomIn, zoomOut, resetTransform, centerView }) => (
                    <>
                        {/* Control Panel - Centered on mobile, Right-aligned on desktop */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 md:top-4 md:bottom-auto z-50 flex flex-row md:flex-col items-center gap-2 md:gap-3">
                            {/* Compass Reset Button */}
                            <button
                                onClick={handleReset}
                                className="bg-white/95 backdrop-blur p-2 md:p-3 rounded-full shadow-xl border border-gray-200 transition-all active:scale-90"
                                title="Reset Orientation"
                            >
                                <Compass
                                    className="w-5 h-5 md:w-6 md:h-6 text-blue-600 transition-transform duration-300 ease-out"
                                    style={{ transform: `rotate(${-rotation}deg)` }}
                                />
                            </button>

                            {/* Main Controls - Flat/Horizontal on Mobile */}
                            <div className="flex flex-row md:flex-col gap-1 md:gap-2 bg-white/95 backdrop-blur p-1 md:p-2 rounded-full md:rounded-2xl shadow-xl border border-gray-200 items-center">
                                <button onClick={() => zoomIn(0.2, 200)} className="p-2 md:p-2.5 hover:bg-gray-100 rounded-full md:rounded-xl transition-colors" title="Zoom In">
                                    <ZoomIn className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                                </button>
                                <button onClick={() => zoomOut(0.2, 200)} className="p-2 md:p-2.5 hover:bg-gray-100 rounded-full md:rounded-xl transition-colors" title="Zoom Out">
                                    <ZoomOut className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                                </button>
                                <button onClick={() => {
                                    resetTransform(200);
                                    handleReset();
                                    setTimeout(() => {
                                        if (centerView) centerView(0.5, 200);
                                    }, 50);
                                }} className="p-2 md:p-2.5 hover:bg-gray-100 rounded-full md:rounded-xl transition-colors" title="Reset View">
                                    <Maximize className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                                </button>

                                <div className="hidden md:block w-px md:w-full h-full md:h-px bg-gray-100 mx-1 my-1" />

                                {/* Rotation Slider (Desktop only) */}
                                <div className="hidden md:flex flex-col items-center py-2 gap-2">
                                    <div className="relative h-24 w-1 bg-gray-100 rounded-full overflow-hidden">
                                        <input
                                            type="range"
                                            min="0"
                                            max="360"
                                            value={rotation}
                                            onChange={(e) => setRotation(Number(e.target.value))}
                                            className="absolute inset-0 w-24 origin-center -rotate-90 opacity-0 cursor-pointer"
                                            style={{ left: '-11px', top: '12px' }}
                                        />
                                        <div
                                            className="absolute bottom-0 w-full bg-blue-500 rounded-full transition-all"
                                            style={{ height: `${(rotation / 360) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400">{Math.round(rotation)}°</span>
                                </div>

                                {/* Mobile Quick Rotate (Optional, but icons are already small) */}
                                <button
                                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                    className="p-2 md:p-2.5 hover:bg-gray-100 rounded-full md:rounded-xl transition-colors md:hidden"
                                    title="Quick Rotate"
                                >
                                    <RotateCcw className="w-4 h-4 md:w-5 md:h-5 text-gray-700" />
                                </button>
                            </div>
                        </div>

                        <TransformComponent
                            wrapperClass="!w-full !h-full"
                            contentClass="flex items-center justify-center"
                        >
                            {/* The Parsed Interactive SVG */}
                            <div
                                className="flex items-center justify-center select-none transition-transform duration-300 ease-out"
                                style={{ transform: `rotate(${rotation}deg)` }}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                {parse(svgContent, options)}
                            </div>
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>
        </div>
    );
}
