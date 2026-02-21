"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { InteractiveSVGMap } from "@/components/InteractiveSVGMap";
import { Plot } from "@/lib/types";
import { Menu, Save, Loader2, Lock } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");

    const [plots, setPlots] = useState<Plot[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
    const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
    const [hoverPos, setHoverPos] = useState<{ plot: Plot, x: number, y: number } | null>(null);
    const [plotToDelete, setPlotToDelete] = useState<number | null>(null);

    // Dirty state tracking
    const [dirtyPlotIds, setDirtyPlotIds] = useState<Set<number>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;

        async function fetchPlots() {
            setIsLoading(true);
            try {
                const res = await fetch("/api/save-plots");
                if (res.ok) {
                    const data = await res.json();
                    setPlots(data);
                }
            } finally {
                setIsLoading(false);
            }
        }
        fetchPlots();
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "admin123") {
            setIsAuthenticated(true);
            toast.success("Logged in successfully!");
        } else {
            toast.error("Invalid password - Try again");
        }
    };

    const handlePlotUpdate = (plotId: number, field: keyof Plot, value: any) => {
        setPlots((prev) =>
            prev.map((p) => {
                if (p.id === plotId) {
                    return { ...p, [field]: value };
                }
                return p;
            })
        );
        setDirtyPlotIds((prev) => new Set(prev).add(plotId));
    };

    const handleNewShapeSelect = (signature: string) => {
        const newId = -(Date.now()); // Temporary negative ID
        const newPlot: Plot = {
            id: newId,
            signature: signature,
            plotNumber: `Plot-${Math.floor(Math.random() * 1000)}`,
            status: "AVAILABLE",
            area_sqyds: 0,
            dimensions: "",
            dim_top: "",
            dim_right: "",
            dim_bottom: "",
            dim_left: "",
            facing: "",
            price_per_sqyd: null,
            notes: "",
            contact_role: "",
            contact_name: "",
            contact_number: "",
            show_info_publicly: false,
            show_price_publicly: true,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setPlots(prev => [...prev, newPlot]);
        setSelectedPlotId(newId);
        setSelectedSignature(signature);
        setDirtyPlotIds(prev => new Set(prev).add(newId));
    };

    const saveSelectedPlot = async (plot: Plot) => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/save-plots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(plot),
            });
            if (!res.ok) throw new Error("Failed to save plot");
            const savedPlotsFromApi = await res.json();
            const saved = savedPlotsFromApi[0]; // Upsert returns an array of results

            // Update local state with the saved plot (which now has a real database ID)
            setPlots(prev => prev.map(p => p.id === plot.id ? saved : p));
            if (selectedPlotId === plot.id) {
                setSelectedPlotId(saved.id);
            }

            setDirtyPlotIds((prev) => {
                const next = new Set(prev);
                next.delete(plot.id);
                return next;
            });
            toast.success(`Plot ${saved.plotNumber} saved successfully`);
        } catch (error: any) {
            toast.error(`Error saving: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const clearUnmappedPlot = () => {
        if (selectedPlotId && selectedPlotId < 0) {
            setPlots(prev => prev.filter(p => p.id !== selectedPlotId));
            setSelectedPlotId(null);
            setSelectedSignature(null);
            setDirtyPlotIds(prev => {
                const updated = new Set(prev);
                updated.delete(selectedPlotId);
                return updated;
            });
        }
    };

    const handleDeletePlot = async () => {
        if (!plotToDelete) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/save-plots?id=${plotToDelete}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Failed to delete plot");

            setPlots(prev => prev.filter(p => p.id !== plotToDelete));
            if (selectedPlotId === plotToDelete) {
                setSelectedPlotId(null);
                setSelectedSignature(null);
            }
            setDirtyPlotIds(prev => {
                const updated = new Set(prev);
                updated.delete(plotToDelete);
                return updated;
            });
            setPlotToDelete(null);
            toast.success("Plot deleted and unmapped successfully!");
        } catch (error: any) {
            toast.error(`Error deleting: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <form onSubmit={handleLogin} className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-6">
                    <div className="flex flex-col items-center justify-center space-y-2 mb-2">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                            <Lock className="w-6 h-6 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Login</h2>
                        <p className="text-sm text-gray-500 text-center">Secure access to MagniPlots administration.</p>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-2 w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                            placeholder="Enter admin password"
                        />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors">
                        Login
                    </button>
                </form>
            </div>
        );
    }

    const selectedPlot = plots.find((p) => p.id === selectedPlotId);

    return (
        <main className="flex h-screen w-full bg-white overflow-hidden text-gray-900 font-sans">
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center px-4 justify-between shadow-sm">
                <h1 className="font-bold text-lg text-blue-800">Admin Dashboard</h1>
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 h-full pt-16 md:pt-0 relative bg-gray-100">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm z-20">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <InteractiveSVGMap
                        svgUrl="/layoutdemo.svg"
                        plots={plots}
                        selectedPlotId={selectedPlotId}
                        isAdminRoute={true}
                        onPlotSelect={(signature, defaultPlot) => {
                            setSelectedSignature(signature);
                            if (defaultPlot && defaultPlot.id) {
                                // It's an existing plot
                                setSelectedPlotId(defaultPlot.id);
                            } else {
                                // Just select signature, let user toggle "Map this shape"
                                setSelectedPlotId(null);
                            }

                            if (window.innerWidth < 768) {
                                setSidebarOpen(true);
                            }
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
                            <div className={`w-2.5 h-2.5 rounded-full ${hoverPos.plot.status === 'AVAILABLE' ? 'bg-green-500' : hoverPos.plot.status === 'SOLD' ? 'bg-red-500' : hoverPos.plot.status === 'ROAD' ? 'bg-gray-400' : 'bg-yellow-500'}`} />
                            <p className="font-extrabold text-gray-900 text-sm">Plot {hoverPos.plot.plotNumber}</p>
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-gray-600">
                            <p>Status: <span className="font-bold text-gray-800">{hoverPos.plot.status}</span></p>
                            <p>Area: <span className="font-bold text-gray-800">{hoverPos.plot.area_sqyds} sq.yds</span></p>
                            {hoverPos.plot.price_per_sqyd ? <p>Price: <span className="font-bold text-gray-800">₹{hoverPos.plot.price_per_sqyd}/yd</span></p> : null}
                            <p className="mt-1 font-bold text-blue-600">Click to Edit</p>
                        </div>
                    </div>
                )}
            </div>

            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setSidebarOpen(false)}
                title="Admin Controls"
                side="right"
            >
                <div className="space-y-8 pb-20">
                    <div className="flex flex-col gap-2">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col items-center justify-center text-center">
                            <h3 className="text-sm font-bold text-blue-900 mb-1">Plots Mapped: {plots.filter(p => p.status !== 'ROAD' && p.area_sqyds > 0).length}</h3>
                            <p className="text-xs text-blue-700 font-medium">Click on any plot to map or edit data.</p>
                        </div>
                    </div>

                    {(selectedPlot || selectedSignature) ? (
                        <div className="space-y-6">
                            <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900">
                                    {selectedPlot ? "Editing Plot" : "Unmapped Shape"}
                                </h3>
                                {selectedPlot && (
                                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">ID: {selectedPlot.id > 0 ? selectedPlot.id : 'Unsaved'}</span>
                                )}
                            </div>

                            <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">Map this Shape</p>
                                    <p className="text-xs text-gray-500">{selectedPlot ? "Toggle to unmap and delete" : "Toggle to enable editing"}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={!!selectedPlot}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                if (selectedSignature) handleNewShapeSelect(selectedSignature);
                                            } else {
                                                if (selectedPlot && selectedPlot.id < 0) {
                                                    clearUnmappedPlot();
                                                } else if (selectedPlot && selectedPlot.id > 0) {
                                                    setPlotToDelete(selectedPlot.id);
                                                }
                                            }
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {selectedPlot && (
                                <div className="space-y-4 text-sm font-medium animate-in fade-in slide-in-from-top-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 flex flex-col col-span-2">
                                            <label>Unique Signature</label>
                                            <input
                                                type="text"
                                                value={selectedPlot.signature}
                                                onChange={(e) => handlePlotUpdate(selectedPlot.id, "signature", e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                                disabled={selectedPlot.id > 0} // Can only edit if it's new
                                            />
                                            <span className="text-xs text-gray-500">Cannot be changed after saving.</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label>Plot Number / Name</label>
                                            <input
                                                type="text"
                                                value={selectedPlot.plotNumber}
                                                onChange={(e) => handlePlotUpdate(selectedPlot.id, "plotNumber", e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label>Status</label>
                                            <select
                                                value={selectedPlot.status}
                                                onChange={(e) => handlePlotUpdate(selectedPlot.id, "status", e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                            >
                                                <option value="AVAILABLE">AVAILABLE</option>
                                                <option value="SOLD">SOLD</option>
                                                <option value="HOLD">HOLD</option>
                                                <option value="ROAD">ROAD</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label>Area (sqyds)</label>
                                            <input
                                                type="number"
                                                value={selectedPlot.area_sqyds}
                                                onChange={(e) => handlePlotUpdate(selectedPlot.id, "area_sqyds", parseFloat(e.target.value))}
                                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label>Price / sqyd</label>
                                            <input
                                                type="number"
                                                value={selectedPlot.price_per_sqyd || ""}
                                                onChange={(e) => handlePlotUpdate(selectedPlot.id, "price_per_sqyd", parseFloat(e.target.value) || null)}
                                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 flex flex-col col-span-2">
                                            <label className="text-gray-500 font-bold uppercase text-[10px] tracking-wider mb-1">Boundary Dimensions</label>
                                            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                                <div className="space-y-1 text-xs">
                                                    <label className="text-gray-500 font-semibold">Top</label>
                                                    <input
                                                        type="text"
                                                        value={selectedPlot.dim_top || ""}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "dim_top", e.target.value)}
                                                        className="w-full px-2 py-1.5 border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="e.g. 50'"
                                                    />
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <label className="text-gray-500 font-semibold">Bottom</label>
                                                    <input
                                                        type="text"
                                                        value={selectedPlot.dim_bottom || ""}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "dim_bottom", e.target.value)}
                                                        className="w-full px-2 py-1.5 border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="e.g. 50'"
                                                    />
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <label className="text-gray-500 font-semibold">Left</label>
                                                    <input
                                                        type="text"
                                                        value={selectedPlot.dim_left || ""}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "dim_left", e.target.value)}
                                                        className="w-full px-2 py-1.5 border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="e.g. 30'"
                                                    />
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <label className="text-gray-500 font-semibold">Right</label>
                                                    <input
                                                        type="text"
                                                        value={selectedPlot.dim_right || ""}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "dim_right", e.target.value)}
                                                        className="w-full px-2 py-1.5 border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                        placeholder="e.g. 30'"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label>Facing</label>
                                            <select
                                                value={selectedPlot.facing || ""}
                                                onChange={(e) => handlePlotUpdate(selectedPlot.id, "facing", e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                            >
                                                <option value="">Select...</option>
                                                <option value="East">East</option>
                                                <option value="West">West</option>
                                                <option value="North">North</option>
                                                <option value="South">South</option>
                                                <option value="North-East">North-East</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100 space-y-4">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Contact Information</h4>
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <label>Contact Role</label>
                                                <select
                                                    value={selectedPlot.contact_role || ""}
                                                    onChange={(e) => handlePlotUpdate(selectedPlot.id, "contact_role", e.target.value)}
                                                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                                >
                                                    <option value="">Select Role...</option>
                                                    <option value="Owner">Owner</option>
                                                    <option value="Marketing Person">Marketing Person</option>
                                                    <option value="Site Developer">Site Developer</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label>Name</label>
                                                    <input
                                                        type="text"
                                                        value={selectedPlot.contact_name || ""}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "contact_name", e.target.value)}
                                                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label>Phone</label>
                                                    <input
                                                        type="text"
                                                        value={selectedPlot.contact_number || ""}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "contact_number", e.target.value)}
                                                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 mt-4">
                                                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPlot.show_price_publicly ?? true}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "show_price_publicly", e.target.checked)}
                                                        className="w-5 h-5 text-blue-600 rounded bg-white shadow-sm"
                                                    />
                                                    <span className="text-sm font-semibold text-gray-800">Show Price Publicly</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPlot.show_info_publicly}
                                                        onChange={(e) => handlePlotUpdate(selectedPlot.id, "show_info_publicly", e.target.checked)}
                                                        className="w-5 h-5 text-blue-600 rounded bg-white shadow-sm"
                                                    />
                                                    <span className="text-sm font-semibold text-gray-800">Show Contact Details Publicly</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 pt-4 border-t border-gray-100">
                                        <label>Internal Notes</label>
                                        <textarea
                                            value={selectedPlot.notes || ""}
                                            onChange={(e) => handlePlotUpdate(selectedPlot.id, "notes", e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg bg-gray-50 focus:bg-white min-h-[80px]"
                                            placeholder="Confidential notes about plot or buyer..."
                                        />
                                    </div>

                                    <div className="mt-6 flex flex-col gap-2">
                                        <button
                                            onClick={() => saveSelectedPlot(selectedPlot)}
                                            disabled={!dirtyPlotIds.has(selectedPlot.id) || isSaving}
                                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                            Save Plot Data
                                        </button>

                                        {selectedPlot.id < 0 && (
                                            <button
                                                onClick={clearUnmappedPlot}
                                                className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl shadow hover:bg-gray-200 transition-all mt-2"
                                            >
                                                Clear Unsaved Location
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center py-20 px-6 opacity-60">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2-2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Select a Plot</h3>
                            <p className="text-sm text-gray-500 font-medium">Click on any plot in the map area to reveal its details and edit its properties.</p>
                        </div>
                    )}
                </div>
            </Sidebar>

            {/* Delete Confirmation Modal */}
            {plotToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setPlotToDelete(null)}></div>
                    <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">Unmap & Delete Plot?</h3>
                                    <p className="text-sm text-gray-500 font-medium">This cannot be undone. All data and details associated with this plot location will be permanently removed.</p>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-col gap-2">
                                <button
                                    onClick={handleDeletePlot}
                                    disabled={isSaving}
                                    className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-red-700 disabled:opacity-50 transition-all text-sm"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Yes, Delete Plot
                                </button>
                                <button
                                    onClick={() => setPlotToDelete(null)}
                                    disabled={isSaving}
                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
