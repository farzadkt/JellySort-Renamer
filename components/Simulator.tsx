
import React, { useState, useEffect } from 'react';
import { simulateRenaming } from '../services/geminiService';
import { SimulationResult, ScriptMode } from '../types';
import { Play, Loader2, FolderOpen, FileVideo, AlertCircle, Clapperboard, Tv, CheckSquare, Square, Check, RefreshCw } from 'lucide-react';

const DEFAULT_SERIES_FILES = `Solar.Opposites.S04E01.1080p.WEB-DL.SuccessfulCrab.Farsi.Sub.Film2Media.mkv
Solar.Opposites.102.720p.mkv
S04E03 - The Betrayal.mp4
Season 4 Episode 4.avi
Invalid_File_No_Number.txt`;

const DEFAULT_MOVIE_FILES = `One.Battle.After.Another.2025 dubbed.mkv
Inception.2010.1080p.BluRay.x264.mkv
The.Matrix.Resurrections.2021.WEBRip.mp4
Batman2022.mkv
My.Home.Video.NoYear.mp4`;

// Extended type for local state management
interface SimResultWithState extends SimulationResult {
  selected: boolean;
  renamed: boolean;
}

const Simulator: React.FC = () => {
  const [mode, setMode] = useState<ScriptMode>('series');
  const [baseName, setBaseName] = useState('Solar Opposites');
  const [inputFiles, setInputFiles] = useState(DEFAULT_SERIES_FILES);
  const [results, setResults] = useState<SimResultWithState[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update defaults when mode changes
  useEffect(() => {
    if (mode === 'series') {
      setBaseName('Solar Opposites');
      setInputFiles(DEFAULT_SERIES_FILES);
    } else {
      setBaseName('D:\\Downloads'); // Movies often scan a generic download folder
      setInputFiles(DEFAULT_MOVIE_FILES);
    }
    setResults(null);
  }, [mode]);

  const handleSimulate = async () => {
    if (!inputFiles.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const filenames = inputFiles.split('\n').map(s => s.trim()).filter(Boolean);

    try {
      const data = await simulateRenaming(baseName, filenames, mode);
      // Map response to local state with selection default true for valid items
      const resultsWithState = data.map(item => ({
        ...item,
        selected: item.isValid,
        renamed: false
      }));
      setResults(resultsWithState);
    } catch (err) {
      setError("Failed to generate simulation. Please check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (index: number) => {
    if (!results) return;
    const newResults = [...results];
    newResults[index].selected = !newResults[index].selected;
    setResults(newResults);
  };

  const toggleSelectAll = () => {
    if (!results) return;
    const allSelected = results.every(r => r.selected || !r.isValid);
    const newResults = results.map(r => ({
      ...r,
      selected: r.isValid ? !allSelected : false
    }));
    setResults(newResults);
  };

  const handleBatchRename = () => {
    if (!results) return;
    const newResults = results.map(r => ({
      ...r,
      renamed: r.selected ? true : r.renamed,
      selected: r.selected ? false : r.selected // Unselect after processing
    }));
    setResults(newResults);
  };

  const selectedCount = results?.filter(r => r.selected).length || 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Mode Toggle */}
      <div className="flex justify-center mb-6">
        <div className="bg-slate-800 p-1 rounded-lg inline-flex border border-slate-700">
          <button
            onClick={() => setMode('series')}
            className={`flex items-center space-x-2 px-6 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'series' 
                ? 'bg-emerald-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Tv size={16} />
            <span>TV Series</span>
          </button>
          <button
            onClick={() => setMode('movies')}
            className={`flex items-center space-x-2 px-6 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'movies' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Clapperboard size={16} />
            <span>Movies</span>
          </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {mode === 'series' ? 'Series Name (Root Folder)' : 'Source Folder Name'}
            </label>
            <input
              type="text"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder={mode === 'series' ? "e.g. The Office" : "e.g. D:\\Films"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Paste Filenames</label>
            <textarea
              value={inputFiles}
              onChange={(e) => setInputFiles(e.target.value)}
              className="w-full h-64 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all"
              placeholder="Paste list of files here..."
            />
          </div>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-semibold shadow-lg transition-all flex items-center justify-center space-x-2 ${
              mode === 'series' 
                ? 'bg-emerald-600 hover:bg-emerald-500' 
                : 'bg-blue-600 hover:bg-blue-500'
            } disabled:bg-slate-700 disabled:text-slate-500`}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            <span>{loading ? 'Analyzing...' : 'Simulate Sort'}</span>
          </button>
        </div>

        {/* Results Section */}
        <div className="md:col-span-2 flex flex-col h-[450px]">
           {/* Toolbar */}
           {results && (
             <div className="mb-2 flex items-center justify-between bg-slate-800 p-2 rounded-t-xl border border-slate-700 border-b-0">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center space-x-2 px-2 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <CheckSquare size={14} />
                  <span>Toggle All</span>
                </button>
                <div className="flex items-center space-x-3">
                   <span className="text-xs text-slate-500">{selectedCount} items selected</span>
                   <button 
                     onClick={handleBatchRename}
                     disabled={selectedCount === 0}
                     className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold rounded shadow transition-all"
                   >
                     <RefreshCw size={12} className={selectedCount > 0 ? "" : "opacity-50"} />
                     <span>Batch Rename Selected</span>
                   </button>
                </div>
             </div>
           )}

           <div className={`bg-slate-800/50 border border-slate-700 p-1 overflow-hidden flex flex-col flex-1 ${results ? 'rounded-b-xl' : 'rounded-xl'}`}>
             {!results ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                 {error ? (
                    <>
                      <AlertCircle size={48} className="text-red-500" />
                      <p className="text-red-400">{error}</p>
                    </>
                 ) : (
                    <>
                      <FolderOpen size={48} strokeWidth={1} />
                      <p>Enter filenames and click Simulate to preview changes.</p>
                    </>
                 )}
               </div>
             ) : (
               <div className="overflow-y-auto h-full scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                 <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-800 sticky top-0 z-10">
                     <tr>
                       <th className="p-3 w-10"></th>
                       <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                       <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Original</th>
                       <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">New Structure</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-700">
                     {results.map((item, idx) => (
                       <tr key={idx} className={`transition-colors ${item.selected ? 'bg-emerald-900/10' : 'hover:bg-slate-700/30'}`}>
                         <td className="p-3 text-center">
                            {item.renamed ? (
                               <div className="flex justify-center text-emerald-500">
                                   <Check size={16} />
                               </div>
                            ) : (
                                item.isValid && (
                                  <button onClick={() => toggleSelection(idx)} className="text-slate-400 hover:text-white">
                                    {item.selected ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} />}
                                  </button>
                                )
                            )}
                         </td>
                         <td className="p-3 align-top">
                           {item.renamed ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500 text-white shadow-sm">
                               PROCESSED
                             </span>
                           ) : item.isValid ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-emerald-400 border border-emerald-800/30">
                               Ready
                             </span>
                           ) : (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-800">
                               Ignored
                             </span>
                           )}
                         </td>
                         <td className={`p-3 text-sm font-mono break-all max-w-[150px] ${item.renamed ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                           {item.originalName}
                         </td>
                         <td className="p-3 align-top">
                           {item.isValid ? (
                             <div className={`space-y-1 ${item.renamed ? 'opacity-50' : ''}`}>
                               <div className="flex items-center text-emerald-300 text-sm font-medium">
                                 <FolderOpen size={14} className="mr-1.5 text-amber-400" />
                                 {item.targetFolder}
                               </div>
                               <div className="flex items-center text-slate-200 text-sm font-mono pl-5">
                                 <span className="text-slate-500 mr-1">└</span>
                                 <FileVideo size={14} className="mr-1.5 text-blue-400" />
                                 {item.newName}
                               </div>
                               {mode === 'movies' && item.year && (
                                 <div className="pl-5 text-xs text-slate-500">Year detected: {item.year}</div>
                               )}
                             </div>
                           ) : (
                             <span className="text-xs text-slate-500 italic">{item.reason || "No pattern match"}</span>
                           )}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Simulator;
