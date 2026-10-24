#!/usr/bin/env python3
"""
Kyrandia 2: Hand of Fate - Desktop Application Launcher
Provides native desktop window (WebKitGTK) with automatic browser fallback and CLI options.
"""

import os
import sys
import time
import socket
import argparse
import threading
import webbrowser

from server import run_server, app_state

def find_free_port(start_port=8080):
    for port in range(start_port, start_port + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

def run_gtk_webkit_window(url: str, title: str = "Kyrandia 2: Hand of Fate - Asset Studio"):
    try:
        import gi
        gi.require_version('Gtk', '3.0')
        gi.require_version('WebKit2', '4.1')
        from gi.repository import Gtk, WebKit2, GLib
    except Exception as e:
        print(f"[Desktop App] PyGObject / WebKit2 not available ({e}), falling back to browser.")
        return False

    try:
        window = Gtk.Window(title=title)
        window.set_default_size(1360, 840)
        window.set_position(Gtk.WindowPosition.CENTER)
        window.connect('destroy', Gtk.main_quit)

        webview = WebKit2.WebView()
        settings = webview.get_settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_webgl(True)

        webview.load_uri(url)
        window.add(webview)
        window.show_all()

        print(f"[Desktop App] Native GTK/WebKit window opened successfully!")
        Gtk.main()
        return True
    except Exception as e:
        print(f"[Desktop App] Failed to open native window: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="The Legend of Kyrandia 2: Hand of Fate - Asset Studio & Extractor")
    parser.add_argument('--browser', action='store_true', help="Open directly in the system web browser instead of native window")
    parser.add_argument('--port', type=int, default=0, help="Port to run the local server on (default: auto)")
    parser.add_argument('--dir', type=str, default="", help="Custom game directory path")
    parser.add_argument('--export-all', type=str, metavar="OUT_DIR", help="CLI: Export all backgrounds, models, MIDI, and audio to folder and exit")
    parser.add_argument('--export-bg', type=str, metavar="OUT_DIR", help="CLI: Export all backgrounds as PNG to folder and exit")
    parser.add_argument('--export-models', type=str, metavar="OUT_DIR", help="CLI: Export all models as PNG to folder and exit")
    parser.add_argument('--export-midi', type=str, metavar="OUT_DIR", help="CLI: Export all soundtracks as Standard MIDI to folder and exit")
    args = parser.parse_args()

    # Set custom game directory if provided
    if args.dir:
        if os.path.isdir(args.dir):
            app_state.set_directory(args.dir)
            print(f"[App] Set game directory to: {app_state.game_dir}")
        else:
            print(f"[App] Error: Directory '{args.dir}' does not exist.")
            sys.exit(1)

    # CLI batch export commands
    if args.export_all or args.export_bg or args.export_models or args.export_midi:
        out_dir = args.export_all or args.export_bg or args.export_models or args.export_midi
        export_type = "all" if args.export_all else ("backgrounds" if args.export_bg else ("models" if args.export_models else "midi"))
        print(f"[CLI Export] Starting export of '{export_type}' to '{out_dir}'...")
        job = app_state.extractor.start_batch_export(export_type, out_dir)
        while job.status == "running":
            time.sleep(0.3)
            print(f"\r[CLI Export] Progress: {job.progress:.1f}% ({job.processed_items}/{job.total_items}) - {job.current_item}", end="", flush=True)
        print()
        if job.status == "completed":
            print(f"[CLI Export] Done! Extracted {len(job.extracted_files)} files to {job.dest_dir}")
        else:
            print(f"[CLI Export] Error: {job.error_message}")
        return

    # Start local server
    port = args.port if args.port > 0 else find_free_port(8080)
    server = run_server("127.0.0.1", port)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    url = f"http://127.0.0.1:{port}/"
    print(f"\n=================================================================")
    print(f"  KYRANDIA 2: HAND OF FATE - ASSET STUDIO & EXTRACTOR")
    print(f"  Local Desktop Server: {url}")
    print(f"  Game Directory: {app_state.game_dir}")
    print(f"  PAKs: {len(app_state.repo.paks)} | Assets: {len(app_state.repo.all_entries)}")
    print(f"=================================================================\n")

    # Launch native desktop window unless --browser specified
    opened_native = False
    if not args.browser and os.environ.get("DISPLAY"):
        opened_native = run_gtk_webkit_window(url)

    if not opened_native:
        print(f"[Desktop App] Opening in system browser at {url}...")
        webbrowser.open(url)
        print("Press Ctrl+C in this terminal to quit.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down Asset Studio...")
            server.server_close()

if __name__ == "__main__":
    main()
