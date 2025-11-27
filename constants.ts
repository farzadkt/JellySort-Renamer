
export const PYTHON_SCRIPT_TEMPLATE = `import os
import re
import shutil
import sys
import time
import json
import datetime
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

# --- CONFIGURATION & CONSTANTS ---
DEFAULT_CONFIG = {
    "VIDEO_EXTENSIONS": ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.mpg', '.mpeg', '.iso'],
    "SUBTITLE_EXTENSIONS": ['.srt', '.sub', '.idx', '.ass', '.vtt'],
    "CONFLICT_ACTION": "skip",  # options: skip, overwrite, rename
    "DRY_RUN": False
}

ILLEGAL_CHARS = r'[<>:"/\\\\|?*]'

# --- LOGGING & GUI HELPERS ---
class Logger:
    def __init__(self, text_widget):
        self.widget = text_widget

    def log(self, message, color="black"):
        if not self.widget: 
            print(message)
            return
        
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.widget.configure(state='normal')
        self.widget.insert(tk.END, f"[{timestamp}] ", "timestamp")
        self.widget.insert(tk.END, message + "\\n", color)
        self.widget.see(tk.END)
        self.widget.configure(state='disabled')

# --- MANIFEST / UNDO SYSTEM ---
class ManifestManager:
    def __init__(self, root_folder):
        self.root = root_folder
        self.backup_dir = os.path.join(root_folder, ".jellysort_backups")

    def create_manifest(self, operations):
        """
        operations: list of dicts {'src': path, 'dst': path}
        """
        if not operations: return None
        
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.json"
        filepath = os.path.join(self.backup_dir, filename)

        data = {
            "timestamp": timestamp,
            "root": self.root,
            "operations": operations
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        
        return filepath

    @staticmethod
    def load_manifest(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

# --- CORE LOGIC ---
class OrganizerLogic:
    def __init__(self, logger, config):
        self.logger = logger
        self.config = config
        self.pending_ops = [] # List of {'src', 'dst', 'type'}

    def sanitize_name(self, name):
        return re.sub(ILLEGAL_CHARS, '', name).strip()

    def get_unique_filename(self, target_path):
        """ Handles conflict by appending (1), (2) etc. """
        if not os.path.exists(target_path):
            return target_path
        
        base, ext = os.path.splitext(target_path)
        counter = 1
        while os.path.exists(f"{base} ({counter}){ext}"):
            counter += 1
        return f"{base} ({counter}){ext}"

    def plan_move(self, src, dst_folder, new_filename):
        dst_path = os.path.join(dst_folder, new_filename)
        
        # Conflict handling
        if os.path.exists(dst_path):
            action = self.config["CONFLICT_ACTION"]
            if os.path.abspath(src) == os.path.abspath(dst_path):
                return # Same file
            
            if action == "skip":
                self.logger.log(f"Skipping (Exists): {os.path.basename(src)}", "orange")
                return
            elif action == "overwrite":
                pass # Proceed, will overwrite
            elif action == "rename":
                dst_path = self.get_unique_filename(dst_path)
        
        self.pending_ops.append({
            "src": src,
            "dst": dst_path,
            "type": "video"
        })

        # Handle Sidecar Files (Subtitles, etc)
        self.plan_sidecars(src, dst_folder, new_filename)

    def plan_sidecars(self, video_src, dst_folder, video_new_name):
        src_dir = os.path.dirname(video_src)
        src_basename = os.path.splitext(os.path.basename(video_src))[0]
        
        # Video new name without extension
        dst_basename = os.path.splitext(video_new_name)[0]

        # Scan folder for matching starts
        try:
            for f in os.listdir(src_dir):
                if f == os.path.basename(video_src): continue
                
                # Check if it starts with the video name
                if f.startswith(src_basename):
                    # Check extension
                    _, ext = os.path.splitext(f)
                    if ext.lower() in self.config["SUBTITLE_EXTENSIONS"]:
                        # Extract suffix (e.g. ".en.srt" or just ".srt")
                        # If filename was "Movie.mkv" and sub is "Movie.en.srt", suffix is ".en.srt"
                        # Be careful if src_basename is "Movie"
                        suffix = f[len(src_basename):]
                        
                        new_sub_name = dst_basename + suffix
                        new_sub_path = os.path.join(dst_folder, new_sub_name)
                        
                        self.pending_ops.append({
                            "src": os.path.join(src_dir, f),
                            "dst": new_sub_path,
                            "type": "subtitle"
                        })
        except Exception as e:
            self.logger.log(f"Error scanning subtitles: {e}", "red")

    def execute_ops(self):
        if not self.pending_ops:
            self.logger.log("No changes detected.", "blue")
            return

        # 1. Create Manifest
        # Assuming all ops are in the same root mostly, but lets verify
        # We pick the root of the first op for storage location
        first_root = os.path.dirname(os.path.dirname(self.pending_ops[0]['src']))
        manifest_mgr = ManifestManager(first_root)
        
        if not self.config["DRY_RUN"]:
            manifest_path = manifest_mgr.create_manifest(self.pending_ops)
            if manifest_path:
                self.logger.log(f"Backup manifest created: {os.path.basename(manifest_path)}", "green")

        # 2. Execute
        success_count = 0
        for op in self.pending_ops:
            src, dst = op['src'], op['dst']
            
            try:
                if self.config["DRY_RUN"]:
                    self.logger.log(f"[DRY RUN] Move: {os.path.basename(src)} -> {dst}", "blue")
                else:
                    # Create dirs
                    target_dir = os.path.dirname(dst)
                    if not os.path.exists(target_dir):
                        os.makedirs(target_dir)
                    
                    # Overwrite check done in plan_move, but robust shutil.move handles basic overwrite
                    if os.path.exists(dst) and self.config["CONFLICT_ACTION"] == "overwrite":
                        os.remove(dst)
                        
                    shutil.move(src, dst)
                    self.logger.log(f"Moved: {os.path.basename(src)}", "green")
                success_count += 1
            except Exception as e:
                self.logger.log(f"Failed to move {os.path.basename(src)}: {e}", "red")

        self.logger.log(f"Processing Complete. {success_count} files processed.", "black")
        self.pending_ops.clear()

class SeriesLogic(OrganizerLogic):
    def run(self, root_path):
        root_path = os.path.abspath(root_path)
        folder_name = os.path.basename(root_path)
        
        # Clean Show Name
        show_name = re.sub(r'\\(\\d{4}\\)', '', folder_name)
        show_name = show_name.replace('.', ' ').replace('_', ' ')
        show_name = ' '.join(show_name.split()).title()
        show_name = self.sanitize_name(show_name)

        self.logger.log(f"Scanning Series: {show_name}...", "blue")
        
        for current_root, dirs, files in os.walk(root_path):
            # Skip backup folders
            if ".jellysort_backups" in current_root: continue

            for filename in files:
                name, ext = os.path.splitext(filename)
                if ext.lower() not in self.config["VIDEO_EXTENSIONS"]: continue

                # Match Patterns
                season, episode = None, None
                
                # Pattern 1: S01E01
                m = re.search(r'[Ss](\\d{1,2})[\\.\\s-]?[Ee](\\d{1,3})', filename, re.IGNORECASE)
                if m:
                    season, episode = int(m.group(1)), int(m.group(2))
                else:
                    # Pattern 2: 1x01
                    m = re.search(r'(\\d{1,2})[xX](\\d{1,3})', filename)
                    if m:
                        season, episode = int(m.group(1)), int(m.group(2))
                    else:
                        # Pattern 3: 101 (exclude years)
                        m = re.search(r'(?<!\\d)(\\d{1,2})(\\d{2})(?!\\d)', filename)
                        if m:
                            s, e = int(m.group(1)), int(m.group(2))
                            if not (1900 <= int(f"{s}{e}") <= 2030):
                                season, episode = s, e

                if season is not None:
                    new_name = f"{show_name} - S{season:02d}E{episode:02d}{ext}"
                    folder_name = f"Season {season:02d}"
                    self.plan_move(
                        os.path.join(current_root, filename),
                        os.path.join(root_path, folder_name),
                        new_name
                    )

        self.execute_ops()

class MovieLogic(OrganizerLogic):
    def run(self, root_path):
        self.logger.log(f"Scanning Movies in: {root_path}...", "blue")
        
        for current_root, dirs, files in os.walk(root_path):
            if ".jellysort_backups" in current_root: continue

            for filename in files:
                name, ext = os.path.splitext(filename)
                if ext.lower() not in self.config["VIDEO_EXTENSIONS"]: continue

                # Match "Title (Year)" or "Title.Year"
                # Look for Year
                m = re.search(r'^(.*?)[\\.\\s\\(\\)\\[\\]\\-_]+(19\\d{2}|20\\d{2})', name)
                if m:
                    raw_title = m.group(1)
                    year = m.group(2)
                    
                    title = raw_title.replace('.', ' ').strip()
                    title = self.sanitize_name(title)
                    
                    if title:
                        new_folder = f"{title} ({year})"
                        new_name = f"{title} ({year}){ext}"
                        
                        self.plan_move(
                            os.path.join(current_root, filename),
                            os.path.join(root_path, "Movies", new_folder),
                            new_name
                        )
        
        self.execute_ops()

# --- GUI APPLICATION ---
class JellySortApp:
    def __init__(self, root):
        self.root = root
        self.root.title("JellySort Manager")
        self.root.geometry("700x600")
        
        self.config = DEFAULT_CONFIG.copy()
        
        # Styling
        style = ttk.Style()
        style.theme_use('clam')
        
        self.create_widgets()

    def create_widgets(self):
        # Notebook (Tabs)
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(expand=True, fill='both', padx=10, pady=5)
        
        # Tab 1: Organize
        self.tab_org = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_org, text=' Organize ')
        self.build_organize_tab(self.tab_org)
        
        # Tab 2: Settings
        self.tab_set = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_set, text=' Settings ')
        self.build_settings_tab(self.tab_set)

        # Tab 3: Undo / Restore
        self.tab_undo = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_undo, text=' Undo / Restore ')
        self.build_undo_tab(self.tab_undo)

        # Logger (Bottom)
        lbl_log = ttk.Label(self.root, text="Activity Log:")
        lbl_log.pack(anchor='w', padx=10, pady=(5,0))
        
        self.log_widget = scrolledtext.ScrolledText(self.root, height=10, state='disabled')
        self.log_widget.pack(fill='x', padx=10, pady=5)
        self.log_widget.tag_config("timestamp", foreground="gray")
        self.log_widget.tag_config("green", foreground="green")
        self.log_widget.tag_config("red", foreground="red")
        self.log_widget.tag_config("blue", foreground="blue")
        self.log_widget.tag_config("orange", foreground="#FFA500")

        self.logger = Logger(self.log_widget)

    def build_organize_tab(self, parent):
        frame = ttk.Frame(parent, padding=20)
        frame.pack(fill='both', expand=True)

        # Mode Selection
        lbl = ttk.Label(frame, text="Select Mode:")
        lbl.pack(anchor='w')
        
        self.mode_var = tk.StringVar(value="series")
        rb1 = ttk.Radiobutton(frame, text="TV Series (Organize by Season)", variable=self.mode_var, value="series")
        rb1.pack(anchor='w', pady=2)
        rb2 = ttk.Radiobutton(frame, text="Movies (Folder per Movie)", variable=self.mode_var, value="movies")
        rb2.pack(anchor='w', pady=2)

        # Path Selection
        ttk.Separator(frame, orient='horizontal').pack(fill='x', pady=15)
        
        btn_browse = ttk.Button(frame, text="Select Folder to Organize", command=self.browse_folder)
        btn_browse.pack(fill='x', pady=5)

        self.lbl_path = ttk.Label(frame, text="No folder selected", foreground="gray")
        self.lbl_path.pack(pady=5)

        # Actions
        ttk.Separator(frame, orient='horizontal').pack(fill='x', pady=15)
        
        self.chk_dry_run = tk.BooleanVar(value=False)
        ttk.Checkbutton(frame, text="Dry Run (Simulate only)", variable=self.chk_dry_run).pack(anchor='w')

        btn_run = ttk.Button(frame, text="START PROCESSING", command=self.run_process)
        btn_run.pack(fill='x', pady=20)

    def build_settings_tab(self, parent):
        frame = ttk.Frame(parent, padding=20)
        frame.pack(fill='both', expand=True)
        
        lbl = ttk.Label(frame, text="Conflict Action (Target file exists):")
        lbl.pack(anchor='w')
        
        self.conflict_var = tk.StringVar(value="skip")
        modes = [("Skip", "skip"), ("Overwrite", "overwrite"), ("Rename (Append Number)", "rename")]
        for text, val in modes:
            ttk.Radiobutton(frame, text=text, variable=self.conflict_var, value=val).pack(anchor='w')

    def build_undo_tab(self, parent):
        frame = ttk.Frame(parent, padding=20)
        frame.pack(fill='both', expand=True)

        lbl = ttk.Label(frame, text="Select a Backup Manifest (.json) to undo changes:")
        lbl.pack(anchor='w', pady=10)

        btn_browse_manifest = ttk.Button(frame, text="Load Manifest File", command=self.load_undo_manifest)
        btn_browse_manifest.pack(fill='x')

    def browse_folder(self):
        d = filedialog.askdirectory()
        if d:
            self.lbl_path.config(text=d, foreground="black")
            self.selected_path = d

    def run_process(self):
        if not hasattr(self, 'selected_path'):
            messagebox.showerror("Error", "Please select a folder first.")
            return

        mode = self.mode_var.get()
        self.config["DRY_RUN"] = self.chk_dry_run.get()
        self.config["CONFLICT_ACTION"] = self.conflict_var.get()

        self.logger.log(f"Starting {mode.upper()} organization...", "black")
        
        # Run in thread to keep GUI responsive
        t = threading.Thread(target=self.process_thread, args=(mode, self.selected_path))
        t.start()

    def process_thread(self, mode, path):
        logic_cls = SeriesLogic if mode == "series" else MovieLogic
        logic = logic_cls(self.logger, self.config)
        try:
            logic.run(path)
        except Exception as e:
            self.logger.log(f"Critical Error: {e}", "red")

    def load_undo_manifest(self):
        f = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
        if not f: return
        
        try:
            data = ManifestManager.load_manifest(f)
            ops = data.get("operations", [])
            
            if not ops:
                messagebox.showinfo("Info", "Manifest is empty.")
                return

            confirm = messagebox.askyesno("Confirm Undo", f"Undo {len(ops)} operations from {data['timestamp']}?")
            if not confirm: return

            self.logger.log(f"Restoring from {os.path.basename(f)}...", "orange")
            
            count = 0
            # Reverse operations for undo
            for op in reversed(ops):
                src, dst = op['src'], op['dst']
                if os.path.exists(dst):
                    try:
                        # Ensure src dir exists
                        if not os.path.exists(os.path.dirname(src)):
                            os.makedirs(os.path.dirname(src))
                        
                        shutil.move(dst, src)
                        self.logger.log(f"Restored: {os.path.basename(src)}", "green")
                        count += 1
                    except Exception as e:
                        self.logger.log(f"Failed to restore {os.path.basename(dst)}: {e}", "red")
                else:
                    self.logger.log(f"File missing for restore: {os.path.basename(dst)}", "red")

            self.logger.log(f"Undo complete. {count} files restored.", "blue")

        except Exception as e:
            messagebox.showerror("Error", f"Failed to load manifest: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = JellySortApp(root)
    root.mainloop()
`;
