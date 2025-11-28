
export const PYTHON_SCRIPT_TEMPLATE = `import sys
import os
import re
import shutil
import json
import datetime
from pathlib import Path

# Dependency Check
try:
    from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                                 QPushButton, QLabel, QLineEdit, QTableWidget, QTableWidgetItem, 
                                 QHeaderView, QFileDialog, QTabWidget, QMessageBox, QProgressBar,
                                 QComboBox, QCheckBox, QSplitter, QFrame)
    from PyQt6.QtCore import Qt, QThread, pyqtSignal, QSize
    from PyQt6.QtGui import QColor, QIcon, QFont, QPalette
except ImportError:
    print("CRITICAL ERROR: PyQt6 is not installed.")
    print("Please run: pip install PyQt6")
    input("Press Enter to exit...")
    sys.exit(1)

# --- CONSTANTS ---
APP_NAME = "JellySort Modern"
VERSION = "2.0"
BACKUP_DIR_NAME = ".jellysort_backups"
VIDEO_EXTS = {'.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.mpg', '.mpeg', '.iso'}
SUB_EXTS = {'.srt', '.sub', '.idx', '.ass', '.vtt'}

# --- THEMES & STYLES ---
DARK_STYLESHEET = """
QMainWindow { background-color: #1e1e1e; color: #f0f0f0; }
QWidget { background-color: #1e1e1e; color: #f0f0f0; font-family: 'Segoe UI', sans-serif; font-size: 14px; }
QTableWidget { background-color: #252526; gridline-color: #3e3e42; border: 1px solid #3e3e42; }
QHeaderView::section { background-color: #333337; padding: 4px; border: 1px solid #3e3e42; color: #cccccc; }
QLineEdit { background-color: #3c3c3c; border: 1px solid #555; padding: 5px; color: white; border-radius: 4px; }
QLineEdit:focus { border: 1px solid #007acc; }
QPushButton { background-color: #0e639c; color: white; border: none; padding: 8px 16px; border-radius: 4px; }
QPushButton:hover { background-color: #1177bb; }
QPushButton:pressed { background-color: #094771; }
QPushButton#Secondary { background-color: #3e3e42; }
QPushButton#Secondary:hover { background-color: #4e4e52; }
QProgressBar { border: 1px solid #3e3e42; border-radius: 4px; text-align: center; }
QProgressBar::chunk { background-color: #007acc; }
"""

# --- LOGIC HELPERS ---
class FileScanner:
    def __init__(self, root, mode="Series", template="{ShowName} - S{s:02}E{e:02}"):
        self.root = root
        self.mode = mode
        self.template = template
        self.scan_results = [] # List of dicts

    def clean_name(self, name):
        return re.sub(r'[<>:"/\\\\|?*]', '', name).strip()

    def detect_series(self, filename):
        # Patterns
        patterns = [
            r'[Ss](\\d{1,2})[\\.\\s-]?[Ee](\\d{1,3})', # S01E01
            r'(\\d{1,2})[xX](\\d{1,3})',              # 1x01
        ]
        
        name, ext = os.path.splitext(filename)
        if ext.lower() not in VIDEO_EXTS: return None

        for pat in patterns:
            m = re.search(pat, name)
            if m:
                return int(m.group(1)), int(m.group(2))
        
        # Fallback: 101 (exclude years)
        m = re.search(r'(?<!\\d)(\\d{1,2})(\\d{2})(?!\\d)', name)
        if m:
            s, e = int(m.group(1)), int(m.group(2))
            if not (1900 <= int(f"{s}{e}") <= 2030):
                return s, e
        return None

    def detect_movie(self, filename):
        name, ext = os.path.splitext(filename)
        if ext.lower() not in VIDEO_EXTS: return None
        
        # Look for Year (19xx or 20xx)
        m = re.search(r'^(.*?)[\\.\\s\\(\\)\\[\\]\\-_]+(19\\d{2}|20\\d{2})', name)
        if m:
            title = m.group(1).replace('.', ' ').strip()
            year = m.group(2)
            return title, year
        return None

    def scan(self):
        self.scan_results = []
        root_abs = os.path.abspath(self.root)
        root_name = os.path.basename(root_abs)
        
        # Clean show name from root folder
        show_name = re.sub(r'\\(\\d{4}\\)', '', root_name).replace('.', ' ').replace('_', ' ').strip().title()

        for current_root, _, files in os.walk(root_abs):
            if BACKUP_DIR_NAME in current_root: continue
            
            for f in files:
                full_src = os.path.join(current_root, f)
                _, ext = os.path.splitext(f)
                
                new_name = None
                new_folder = None
                
                if self.mode == "Series":
                    res = self.detect_series(f)
                    if res:
                        s, e = res
                        # Apply Template
                        try:
                            # Basic format implementation
                            # Supported: {ShowName}, {s}, {e}, {s:02}, {e:02}
                            # Python f-string logic replacement
                            name_part = self.template.replace("{ShowName}", show_name)
                            # Regex replace for formatting specific tokens like {s:02} is hard dynamically,
                            # so we do simple replacement logic
                            final_n = name_part.replace("{s}", str(s)).replace("{e}", str(e))
                            final_n = final_n.replace("{s:02}", f"{s:02}").replace("{e:02}", f"{e:02}")
                            
                            new_name = f"{final_n}{ext}"
                            new_folder = f"Season {s:02}"
                        except Exception:
                            new_name = "Template Error"
                
                elif self.mode == "Movies":
                    res = self.detect_movie(f)
                    if res:
                        title, year = res
                        t_clean = self.clean_name(title)
                        
                        # Simple movie template: {Title} ({Year})
                        # We can expand this later if needed
                        new_name = f"{t_clean} ({year}){ext}"
                        new_folder = f"{t_clean} ({year})"

                if new_name:
                    full_dst_folder = os.path.join(root_abs, new_folder) if self.mode == "Series" else os.path.join(root_abs, "Movies", new_folder)
                    full_dst = os.path.join(full_dst_folder, new_name)
                    
                    self.scan_results.append({
                        "original_name": f,
                        "src": full_src,
                        "dst": full_dst,
                        "folder": new_folder,
                        "new_name": new_name,
                        "status": "Pending"
                    })
                    
                    # Scan for subtitles
                    self.scan_subtitles(full_src, full_dst_folder, new_name)

    def scan_subtitles(self, video_src, dst_folder, video_new_name):
        src_dir = os.path.dirname(video_src)
        base = os.path.splitext(os.path.basename(video_src))[0]
        dst_base = os.path.splitext(video_new_name)[0]
        
        for f in os.listdir(src_dir):
            if f.startswith(base) and f != os.path.basename(video_src):
                _, ext = os.path.splitext(f)
                if ext.lower() in SUB_EXTS:
                    suffix = f[len(base):] # e.g. .en.srt
                    sub_new_name = f"{dst_base}{suffix}"
                    
                    self.scan_results.append({
                        "original_name": f,
                        "src": os.path.join(src_dir, f),
                        "dst": os.path.join(dst_folder, sub_new_name),
                        "folder": "[Subtitle]",
                        "new_name": sub_new_name,
                        "status": "Pending"
                    })

# --- WORKER THREADS ---
class ScanWorker(QThread):
    finished = pyqtSignal(list)
    
    def __init__(self, scanner):
        super().__init__()
        self.scanner = scanner

    def run(self):
        self.scanner.scan()
        self.finished.emit(self.scanner.scan_results)

class ApplyWorker(QThread):
    progress = pyqtSignal(int, str)
    finished = pyqtSignal(str) # Path to manifest
    
    def __init__(self, operations, root):
        super().__init__()
        self.operations = operations
        self.root = root

    def run(self):
        backup_dir = os.path.join(self.root, BACKUP_DIR_NAME)
        if not os.path.exists(backup_dir): os.makedirs(backup_dir)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        manifest_path = os.path.join(backup_dir, f"backup_{timestamp}.json")
        
        manifest_data = {
            "timestamp": timestamp,
            "root": self.root,
            "ops": []
        }
        
        total = len(self.operations)
        for i, op in enumerate(self.operations):
            src, dst = op['src'], op['dst']
            
            try:
                # Create Folder
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                
                # Conflict Handling (Simple Rename)
                if os.path.exists(dst) and os.path.abspath(src) != os.path.abspath(dst):
                    base, ext = os.path.splitext(dst)
                    dst = f"{base}_copy{ext}"

                if os.path.abspath(src) != os.path.abspath(dst):
                    shutil.move(src, dst)
                    manifest_data["ops"].append({"src": src, "dst": dst})
                    self.progress.emit(int((i+1)/total * 100), f"Moved: {os.path.basename(dst)}")
                else:
                    self.progress.emit(int((i+1)/total * 100), "Skipped (Same File)")
                    
            except Exception as e:
                print(f"Error moving {src}: {e}")
        
        # Save Manifest
        with open(manifest_path, 'w') as f:
            json.dump(manifest_data, f, indent=4)
            
        self.finished.emit(manifest_path)

class UndoWorker(QThread):
    progress = pyqtSignal(int, str)
    finished = pyqtSignal()
    
    def __init__(self, manifest_path):
        super().__init__()
        self.manifest_path = manifest_path

    def run(self):
        try:
            with open(self.manifest_path, 'r') as f:
                data = json.load(f)
            
            ops = data.get("ops", [])
            total = len(ops)
            
            # Reverse ops
            for i, op in enumerate(reversed(ops)):
                src, dst = op['src'], op['dst'] # src was original location
                
                if os.path.exists(dst):
                    os.makedirs(os.path.dirname(src), exist_ok=True)
                    try:
                        shutil.move(dst, src)
                        self.progress.emit(int((i+1)/total * 100), f"Restored: {os.path.basename(src)}")
                    except Exception as e:
                        pass
                else:
                    self.progress.emit(int((i+1)/total * 100), f"Missing: {os.path.basename(dst)}")
                    
            self.finished.emit()
            
        except Exception as e:
            print(f"Undo Error: {e}")
            self.finished.emit()

# --- MAIN GUI ---
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"{APP_NAME} v{VERSION}")
        self.resize(1000, 700)
        self.items = []
        self.current_manifest = None
        
        self.setup_ui()
        self.apply_theme()

    def apply_theme(self):
        self.setStyleSheet(DARK_STYLESHEET)

    def setup_ui(self):
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QVBoxLayout(main_widget)
        layout.setContentsMargins(10, 10, 10, 10)

        # 1. Top Bar (Config)
        config_frame = QFrame()
        config_frame.setObjectName("Card")
        top_layout = QHBoxLayout(config_frame)
        
        # Mode Selection
        self.combo_mode = QComboBox()
        self.combo_mode.addItems(["Series", "Movies"])
        self.combo_mode.currentTextChanged.connect(self.update_template_placeholder)
        top_layout.addWidget(QLabel("Mode:"))
        top_layout.addWidget(self.combo_mode)
        
        # Template
        top_layout.addWidget(QLabel("Template:"))
        self.txt_template = QLineEdit()
        self.txt_template.setText("{ShowName} - S{s:02}E{e:02}")
        self.txt_template.setFixedWidth(250)
        top_layout.addWidget(self.txt_template)
        
        # Path
        self.btn_browse = QPushButton("Select Folder")
        self.btn_browse.setIcon(QIcon.fromTheme("folder-open"))
        self.btn_browse.clicked.connect(self.browse_folder)
        top_layout.addWidget(self.btn_browse)
        
        self.lbl_path = QLabel("No folder selected")
        self.lbl_path.setStyleSheet("color: #888; font-style: italic;")
        top_layout.addWidget(self.lbl_path)
        
        top_layout.addStretch()
        
        # Scan Button
        self.btn_scan = QPushButton("Scan / Preview")
        self.btn_scan.clicked.connect(self.start_scan)
        top_layout.addWidget(self.btn_scan)

        layout.addWidget(config_frame)

        # 2. Main Table
        self.tabs = QTabWidget()
        layout.addWidget(self.tabs)
        
        # Preview Tab
        self.tab_preview = QWidget()
        preview_layout = QVBoxLayout(self.tab_preview)
        
        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(["Original Name", "New Name", "New Folder", "Status"])
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        preview_layout.addWidget(self.table)
        
        self.tabs.addTab(self.tab_preview, "Preview & Apply")

        # Undo Tab
        self.tab_undo = QWidget()
        undo_layout = QVBoxLayout(self.tab_undo)
        
        self.btn_load_manifest = QPushButton("Select Backup Manifest to Undo")
        self.btn_load_manifest.clicked.connect(self.browse_manifest)
        self.btn_load_manifest.setObjectName("Secondary")
        undo_layout.addWidget(self.btn_load_manifest)
        
        self.lbl_manifest = QLabel("No manifest loaded")
        undo_layout.addWidget(self.lbl_manifest)
        
        self.btn_perform_undo = QPushButton("Perform Undo")
        self.btn_perform_undo.clicked.connect(self.start_undo)
        self.btn_perform_undo.setEnabled(False)
        self.btn_perform_undo.setStyleSheet("background-color: #a00; color: white;")
        undo_layout.addWidget(self.btn_perform_undo)
        undo_layout.addStretch()
        
        self.tabs.addTab(self.tab_undo, "Undo / Restore")

        # 3. Bottom Bar
        bottom_layout = QHBoxLayout()
        self.progress = QProgressBar()
        bottom_layout.addWidget(self.progress)
        
        self.btn_apply = QPushButton("APPLY CHANGES")
        self.btn_apply.clicked.connect(self.start_apply)
        self.btn_apply.setEnabled(False)
        self.btn_apply.setStyleSheet("font-weight: bold; padding: 10px 30px;")
        bottom_layout.addWidget(self.btn_apply)
        
        layout.addLayout(bottom_layout)

    def update_template_placeholder(self, mode):
        if mode == "Series":
            self.txt_template.setText("{ShowName} - S{s:02}E{e:02}")
        else:
            self.txt_template.setText("{Title} ({Year})")

    def browse_folder(self):
        d = QFileDialog.getExistingDirectory(self, "Select Folder")
        if d:
            self.lbl_path.setText(d)
            self.start_scan()

    def start_scan(self):
        path = self.lbl_path.text()
        if not os.path.isdir(path): return
        
        self.btn_scan.setEnabled(False)
        scanner = FileScanner(path, self.combo_mode.currentText(), self.txt_template.text())
        
        self.worker = ScanWorker(scanner)
        self.worker.finished.connect(self.on_scan_finished)
        self.worker.start()

    def on_scan_finished(self, results):
        self.items = results
        self.table.setRowCount(len(results))
        self.btn_scan.setEnabled(True)
        
        for i, item in enumerate(results):
            self.table.setItem(i, 0, QTableWidgetItem(item['original_name']))
            self.table.setItem(i, 1, QTableWidgetItem(item['new_name']))
            self.table.setItem(i, 2, QTableWidgetItem(item['folder']))
            status_item = QTableWidgetItem(item['status'])
            status_item.setForeground(QColor("#00ff00"))
            self.table.setItem(i, 3, status_item)
            
        if results:
            self.btn_apply.setEnabled(True)
            self.btn_apply.setText(f"APPLY ({len(results)} files)")
        else:
            self.btn_apply.setEnabled(False)
            self.btn_apply.setText("APPLY")

    def start_apply(self):
        # ESCAPED NEWLINE HERE: \\n
        confirm = QMessageBox.question(self, "Confirm", "This will rename/move files. A backup manifest will be created.\\nContinue?", 
                                       QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if confirm != QMessageBox.StandardButton.Yes: return

        self.btn_apply.setEnabled(False)
        self.table.setEnabled(False)
        
        self.apply_worker = ApplyWorker(self.items, self.lbl_path.text())
        self.apply_worker.progress.connect(self.update_progress)
        self.apply_worker.finished.connect(self.on_apply_finished)
        self.apply_worker.start()

    def update_progress(self, val, msg):
        self.progress.setValue(val)
        self.statusBar().showMessage(msg)

    def on_apply_finished(self, manifest_path):
        self.table.setEnabled(True)
        self.progress.setValue(100)
        # ESCAPED NEWLINE HERE: \\n
        QMessageBox.information(self, "Success", f"Operation Complete!\\nManifest saved to:\\n{manifest_path}")
        # Clear table
        self.table.setRowCount(0)
        self.items = []
        self.btn_apply.setText("APPLY")

    # --- UNDO LOGIC ---
    def browse_manifest(self):
        f, _ = QFileDialog.getOpenFileName(self, "Select Manifest", self.lbl_path.text(), "JSON Files (*.json)")
        if f:
            self.lbl_manifest.setText(f)
            self.btn_perform_undo.setEnabled(True)

    def start_undo(self):
        path = self.lbl_manifest.text()
        self.btn_perform_undo.setEnabled(False)
        
        self.undo_worker = UndoWorker(path)
        self.undo_worker.progress.connect(self.update_progress)
        self.undo_worker.finished.connect(self.on_undo_finished)
        self.undo_worker.start()

    def on_undo_finished(self):
        self.progress.setValue(100)
        QMessageBox.information(self, "Undo", "Undo operations completed.")
        self.btn_perform_undo.setEnabled(True)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    
    # Adjust palette for dark theme if needed
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor(53, 53, 53))
    palette.setColor(QPalette.ColorRole.WindowText, Qt.GlobalColor.white)
    app.setPalette(palette)
    
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
`;
