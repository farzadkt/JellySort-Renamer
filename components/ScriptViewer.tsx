import React, { useState } from 'react';
import { Copy, Check, Download, Terminal } from 'lucide-react';
import { PYTHON_SCRIPT_TEMPLATE } from '../constants';

const ScriptViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([PYTHON_SCRIPT_TEMPLATE], { type: 'text/x-python' });
    element.href = URL.createObjectURL(file);
    element.download = "jellysort.py";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl mt-8">
      <div className="bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center space-x-2 text-slate-200">
          <Terminal size={20} className="text-emerald-400" />
          <span className="font-mono font-bold">jellysort.py</span>
          <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded ml-2">Python 3</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
          >
            <Download size={16} />
            <span>Download</span>
          </button>
        </div>
      </div>
      <div className="p-0 overflow-x-auto">
        <pre className="text-sm font-mono leading-relaxed p-4 text-slate-300">
          <code>
            {PYTHON_SCRIPT_TEMPLATE.split('\n').map((line, i) => (
              <div key={i} className="table-row">
                <span className="table-cell select-none text-slate-600 text-right pr-4 w-10">{i + 1}</span>
                <span className="table-cell">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default ScriptViewer;
