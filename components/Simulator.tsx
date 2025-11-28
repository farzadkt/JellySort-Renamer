
import React, { useState, useEffect } from 'react';
import { simulateRenaming } from '../services/geminiService';
import { SimulationResult, ScriptMode } from '../types';
import { Play, Loader2, FolderOpen, FileVideo, AlertCircle, Clapperboard, Tv, CheckSquare, Square, Check, RefreshCw, Pencil } from 'lucide-react';

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
  const [template, setTemplate] = useState('{ShowName} - S{season:02}E{episode:02}');
  const [inputFiles, setInputFiles] = useState(DEFAULT_SERIES_FILES);
  const [results, setResults] = useState<SimResultWithState[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update defaults when mode changes
  useEffect(() => {
    if (mode === 'series') {
      setBaseName('Solar Opposites');
      setTemplate('{ShowName} - S{season:02}E{episode:02}');
      setInputFiles(DEFAULT_SERIES_FILES);
    } else {
      setBaseName('D:\\Downloads'); // Movies often scan a generic download folder
      setTemplate('{Title} ({Year})');
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
      // NOTE: We pass the template to the AI to simulate how the Python script uses it
      const data = await simulateRenaming(baseName, filenames, mode);
      
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
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
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
            />
          </div>
          
           <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>Naming Template</span>
              <Pencil size={12} className="text-slate-500"/>
            </label>
            <input
              type="text"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-emerald-400 font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="{ShowName} - S{s:02}E{e:02}"
            />
            <p className="text-[10px] text-slate-500 mt-1">Available: &#123;ShowName&#125;, &#123;s&#125;, &#123;e&#125;</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Paste Filenames</label>
            <textarea
              value={inputFiles}
              onChange={(e) => setInputFiles(e.target.value)}
              className="w-full h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition-all"
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
            <span>Preview Sort</span>
          </button>
        </div>

        {/* Results Section */}
        <div className="md:col-span-2 flex flex-col h-[500px]">
           {/* Toolbar */}
           {results && (
             <div className="mb-0 flex items-center justify-between bg-[#252526] p-2 rounded-t-xl border border-[#3e3e42] border-b-0">
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
                     className="flex items-center space-x-1 px-3 py-1 bg-[#0e639c] hover:bg-[#1177bb] disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold rounded shadow transition-all"
                   >
                     <RefreshCw size={12} className={selectedCount > 0 ? "" : "opacity-50"} />
                     <span>Apply Selected</span>
                   </button>
                </div>
             </div>
           )}

           <div className={`bg-[#1e1e1e] border border-[#3e3e42] p-0 overflow-hidden flex flex-col flex-1 ${results ? 'rounded-b-xl' : 'rounded-xl'}`}>
             {!results ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                 {error ? (
                    <>
                      <AlertCircle size={48} className="text-red-500" />
                      <p className="text-red-400">{error}</p>
                    </>
                 ) : (
                    <>
                      <div className="bg-[#2d2d30] p-4 rounded-full">
                        <FolderOpen size={48} strokeWidth={1.5} />
                      </div>
                      <p>Preview List Empty</p>
                    </>
                 )}
               </div>
             ) : (
               <div className="overflow-y-auto h-full scrollbar-thin scrollbar-thumb-[#424242] scrollbar-track-[#1e1e1e]">
                 <table className="w-full text-left border-collapse text-sm">
                   <thead className="bg-[#252526] sticky top-0 z-10 text-[#cccccc]">
                     <tr>
                       <th className="p-2 border-b border-[#3e3e42] w-10 text-center">#</th>
                       <th className="p-2 border-b border-[#3e3e42] w-8"></th>
                       <th className="p-2 border-b border-[#3e3e42] font-normal">Original Name</th>
                       <th className="p-2 border-b border-[#3e3e42] font-normal">New Name / Folder</th>
                       <th className="p-2 border-b border-[#3e3e42] font-normal w-24">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#2d2d30] text-[#cccccc]">
                     {results.map((item, idx) => (
                       <tr key={idx} className={`transition-colors ${item.selected ? 'bg-[#37373d]' : 'hover:bg-[#2a2d2e]'}`}>
                         <td className="p-2 text-center text-xs text-slate-500 font-mono">{idx + 1}</td>
                         <td className="p-2 text-center">
                            {item.renamed ? (
                               <div className="flex justify-center text-emerald-500">
                                   <Check size={16} />
                               </div>
                            ) : (
                                item.isValid && (
                                  <button onClick={() => toggleSelection(idx)} className="text-slate-400 hover:text-white">
                                    {item.selected ? <CheckSquare size={16} className="text-[#007acc]" /> : <Square size={16} />}
                                  </button>
                                )
                            )}
                         </td>
                         <td className={`p-2 font-mono text-xs break-all max-w-[200px] ${item.renamed ? 'opacity-40 line-through' : ''}`}>
                           {item.originalName}
                         </td>
                         <td className="p-2 align-top">
                           {item.isValid ? (
                             <div className={`space-y-1 ${item.renamed ? 'opacity-50' : ''}`}>
                               <div className="flex items-center text-[#ce9178] text-xs font-mono">
                                 {item.newName}
                               </div>
                               <div className="flex items-center text-[#569cd6] text-xs">
                                 <FolderOpen size={10} className="mr-1" />
                                 {item.targetFolder}
                               </div>
                             </div>
                           ) : (
                             <span className="text-xs text-slate-500 italic">{item.reason || "No match"}</span>
                           )}
                         </td>
                         <td className="p-2 align-top text-xs">
                            {item.renamed ? (
                                <span className="text-emerald-500">Done</span>
                            ) : item.isValid ? (
                                <span className="text-[#007acc]">Pending</span>
                            ) : (
                                <span className="text-red-400">Error</span>
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
