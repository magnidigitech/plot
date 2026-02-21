"use client";

import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { InteractiveSVGMap } from "@/components/InteractiveSVGMap";
import { Slider } from "@/components/ui/slider";
import { Plot } from "@/lib/types";
import { Menu, Search, FilterX } from "lucide-react";

export default function Home() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ plot: Plot, x: number, y: number } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [areaRange, setAreaRange] = useState<[number, number]>([0, 10000]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
  const [facingFilter, setFacingFilter] = useState("ALL");

  // Dynamic Bounds Calculation
  const bounds = useMemo(() => {
    const validPlots = plots.filter(p => p.status !== 'ROAD');
    if (validPlots.length === 0) return { minArea: 0, maxArea: 10000, minPrice: 0, maxPrice: 500000 };

    const areas = validPlots.map(p => p.area_sqyds);
    const minA = Math.min(...areas);
    const maxA = Math.max(...areas);

    const publicPrices = validPlots
      .filter(p => p.show_price_publicly && (p.price_per_sqyd || 0) > 0)
      .map(p => p.price_per_sqyd as number);

    const minP = publicPrices.length > 0 ? Math.min(...publicPrices) : 0;
    const maxP = publicPrices.length > 0 ? Math.max(...publicPrices) : 500000;

    return {
      minArea: minA > 100 ? minA - 100 : 0,
      maxArea: maxA + 100,
      minPrice: minP > 100 ? minP - 100 : 0,
      maxPrice: maxP + 100
    };
  }, [plots]);

  // Update ranges when bounds change (first load)
  useEffect(() => {
    if (plots.length > 0) {
      setAreaRange([bounds.minArea, bounds.maxArea]);
      setPriceRange([bounds.minPrice, bounds.maxPrice]);
    }
  }, [bounds]);

  useEffect(() => {
    async function fetchPlots() {
      try {
        const res = await fetch("/api/save-plots");
        if (!res.ok) throw new Error("Failed to load plots");
        const data = await res.json();
        setPlots(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlots();
  }, []);

  const filteredPlots = useMemo(() => {
    return plots.filter((plot) => {
      // Always include roads in the map array so they render, we will filter them from the UI instead
      if (plot.status === 'ROAD') return true;

      // Safety check as requested
      const matchesSearch = (plot.plotNumber || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesSize = plot.area_sqyds >= areaRange[0] && plot.area_sqyds <= areaRange[1];

      const price = plot.price_per_sqyd || 0;
      const isPriceVisible = plot.show_price_publicly;

      // If filtering by price, only show plots with visible prices matching the range
      const matchesPrice = isPriceVisible
        ? (price >= priceRange[0] && price <= priceRange[1])
        : (priceRange[0] === bounds.minPrice && priceRange[1] === bounds.maxPrice); // Show all if price filter is untouched

      const matchesFacing =
        facingFilter === "ALL" || plot.facing === facingFilter;

      return matchesSearch && matchesSize && matchesPrice && matchesFacing;
    });
  }, [plots, searchQuery, areaRange, priceRange, facingFilter, bounds]);

  const sortedAndFiltered = [...filteredPlots].sort((a, b) =>
    (a.plotNumber || "").localeCompare(b.plotNumber || "")
  );

  const plotStats = useMemo(() => {
    const validPlots = sortedAndFiltered.filter(p => p.status !== 'ROAD');
    const stats = { avail: 0, sold: 0, hold: 0, total: validPlots.length };
    validPlots.forEach(p => {
      if (p.status === 'AVAILABLE') stats.avail++;
      if (p.status === 'SOLD') stats.sold++;
      if (p.status === 'HOLD') stats.hold++;
    });
    return stats;
  }, [sortedAndFiltered]);

  return (
    <main className="flex h-screen w-full bg-white overflow-hidden text-gray-900 font-sans">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center px-4 justify-between shadow-sm">
        <h1 className="font-bold text-lg">MagniPlots</h1>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Aarna Estate"
      >
        <div className="space-y-8 pb-10">

          {/* Filtering Section */}
          <div className="space-y-5 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Filter Overview</h3>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plot number..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              />
            </div>

            {/* Size Range Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600 uppercase">Area (sq.yd)</label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{areaRange[0]} - {areaRange[1]}</span>
              </div>
              <Slider
                min={bounds.minArea}
                max={bounds.maxArea}
                step={1}
                value={[areaRange[0], areaRange[1]]}
                onValueChange={(val) => setAreaRange([val[0], val[1]])}
              />
            </div>

            {/* Price Range Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600 uppercase">Price / sq.yd</label>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}</span>
              </div>
              <Slider
                min={bounds.minPrice}
                max={bounds.maxPrice}
                step={1}
                value={[priceRange[0], priceRange[1]]}
                onValueChange={(val) => setPriceRange([val[0], val[1]])}
              />
              <p className="text-[10px] text-gray-400 italic mt-1 leading-tight">
                * Plots without public pricing are hidden when filtering by price.
              </p>
            </div>

            {/* Facing */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Facing Direction</label>
              <select
                value={facingFilter}
                onChange={(e) => setFacingFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              >
                <option value="ALL">All Directions</option>
                <option value="East">East</option>
                <option value="West">West</option>
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="North-East">North-East</option>
              </select>
            </div>

            {/* Reset Filters */}
            <button
              onClick={() => {
                setSearchQuery("");
                setAreaRange([bounds.minArea, bounds.maxArea]);
                setPriceRange([bounds.minPrice, bounds.maxPrice]);
                setFacingFilter("ALL");
                setSelectedPlot(null);
                setSelectedSignature(null);
              }}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors w-full justify-center py-2 border border-gray-200 rounded-lg pt-2 mt-2"
            >
              <FilterX className="w-3 h-3" /> Reset Filters
            </button>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-gray-50 border border-gray-100 p-2 rounded-lg text-center flex flex-col justify-center">
              <span className="text-[10px] font-bold text-green-600 uppercase">Avail</span>
              <span className="text-lg font-black text-gray-800">{plotStats.avail}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-2 rounded-lg text-center flex flex-col justify-center">
              <span className="text-[10px] font-bold text-red-600 uppercase">Sold</span>
              <span className="text-lg font-black text-gray-800">{plotStats.sold}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-2 rounded-lg text-center flex flex-col justify-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Total</span>
              <span className="text-lg font-black text-gray-800">{plotStats.total}</span>
            </div>
          </div>

          {/* List of Plots */}
          <div className="mt-4 flex flex-col gap-1 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin scrollbar-thumb-gray-200">
            {sortedAndFiltered.filter(p => p.status !== 'ROAD').map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedSignature(p.signature);
                  setSelectedPlot(p);
                }}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${p.status === 'AVAILABLE' ? 'bg-green-500' : p.status === 'SOLD' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <span className="font-bold text-sm text-gray-800">Plot {p.plotNumber}</span>
                </div>
                <span className="text-xs text-gray-500 font-semibold">{p.area_sqyds} sq.yd</span>
              </button>
            ))}
            {sortedAndFiltered.filter(p => p.status !== 'ROAD').length === 0 && (
              <div className="text-center text-sm text-gray-400 py-4">No plots match your filters.</div>
            )}
          </div>

        </div>
      </Sidebar>

      <div className="flex-1 h-full pt-16 md:pt-0 relative bg-gray-100">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-20">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-500">Loading map...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-20">
            <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 max-w-sm text-center">
              <p className="font-bold mb-2">Error Loading Map</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <InteractiveSVGMap
            svgUrl="/layoutdemo.svg"
            plots={sortedAndFiltered}
            selectedPlotId={selectedPlot?.id || null}
            onPlotSelect={(signature, plot) => {
              setSelectedSignature(signature);
              setSelectedPlot(plot as Plot || null);
            }}
            onPlotHover={(e, signature, plot) => {
              if (plot && plot.status !== 'ROAD') {
                setHoverPos({ plot, x: e.clientX, y: e.clientY });
              } else {
                setHoverPos(null);
              }
            }}
          />
        )}

        {/* Floating Tooltip */}
        {hoverPos && (
          <div
            className="fixed z-50 pointer-events-none bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-2xl border border-gray-200 transform -translate-x-1/2 -translate-y-[calc(100%+20px)] transition-opacity duration-75 animate-in fade-in"
            style={{ left: hoverPos.x, top: hoverPos.y }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${hoverPos.plot.status === 'AVAILABLE' ? 'bg-green-500' : hoverPos.plot.status === 'SOLD' ? 'bg-red-500' : 'bg-yellow-500'}`} />
              <p className="font-extrabold text-gray-900 text-sm">Plot {hoverPos.plot.plotNumber}</p>
            </div>
            <div className="flex flex-col gap-1 text-xs text-gray-600">
              <p>Status: <span className="font-bold text-gray-800">{hoverPos.plot.status}</span></p>
              <p>Area: <span className="font-bold text-gray-800">{hoverPos.plot.area_sqyds} sq.yds</span></p>
              {hoverPos.plot.price_per_sqyd && hoverPos.plot.show_price_publicly !== false && <p>Price: <span className="font-bold text-gray-800">₹{hoverPos.plot.price_per_sqyd}/yd</span></p>}
              {hoverPos.plot.facing && <p>Facing: <span className="font-bold text-gray-800">{hoverPos.plot.facing}</span></p>}
            </div>
          </div>
        )}

      </div>

      {/* Selected Plot Modal */}
      {selectedPlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedPlot(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-black text-gray-900">
                  Plot {selectedPlot.plotNumber}
                </h3>
                <span className={`px-3 py-1 text-xs font-bold tracking-wide rounded-full ${selectedPlot.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                  selectedPlot.status === 'SOLD' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                  {selectedPlot.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm mb-6">
                <div className="flex flex-col bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-500 text-[10px] font-bold uppercase mb-1">Area</span>
                  <span className="font-bold text-gray-900 text-base">{selectedPlot.area_sqyds} sqyds</span>
                </div>
                <div className="flex flex-col bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-500 text-[10px] font-bold uppercase mb-1">Facing</span>
                  <span className="font-bold text-gray-900 text-base">{selectedPlot.facing || '-'}</span>
                </div>
                <div className="flex flex-col bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-500 text-[10px] font-bold uppercase mb-1">Price</span>
                  <span className="font-bold text-gray-900 text-base">
                    {(selectedPlot.price_per_sqyd && selectedPlot.show_price_publicly !== false) ? `₹${selectedPlot.price_per_sqyd}/yd` : '-'}
                  </span>
                </div>
              </div>

              {(selectedPlot.dim_top || selectedPlot.dim_bottom || selectedPlot.dim_left || selectedPlot.dim_right) && (
                <div className="mb-6">
                  <span className="text-gray-500 text-[10px] font-bold uppercase mb-3 block tracking-widest">Boundary Dimensions</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-md shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-blue-400 uppercase leading-none mb-1">Top</span>
                        <span className="text-sm font-bold text-gray-800">{selectedPlot.dim_top || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-md shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-blue-400 uppercase leading-none mb-1">Bottom</span>
                        <span className="text-sm font-bold text-gray-800">{selectedPlot.dim_bottom || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-md shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-blue-400 uppercase leading-none mb-1">Left</span>
                        <span className="text-sm font-bold text-gray-800">{selectedPlot.dim_left || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-md shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-blue-400 uppercase leading-none mb-1">Right</span>
                        <span className="text-sm font-bold text-gray-800">{selectedPlot.dim_right || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedPlot.show_info_publicly && selectedPlot.contact_number && (
                <div className="flex gap-2 w-full mt-2">
                  <a href={`tel:${selectedPlot.contact_number}`} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-md hover:shadow-lg active:scale-[0.98]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    Call
                  </a>
                  <a href={`https://wa.me/${selectedPlot.contact_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-md hover:shadow-lg active:scale-[0.98]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    WhatsApp
                  </a>
                </div>
              )}

              {(!selectedPlot.show_info_publicly || !selectedPlot.contact_number) && (
                <button onClick={() => setSelectedPlot(null)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 px-4 rounded-xl transition-colors">
                  Close Details
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
