#!/usr/bin/env python3
"""
ReachFlow - Patch and deploy script (voice profile feature)
Copies the updated App.jsx and useSupabaseData.js into your repo, commits, and pushes.

Run from the root of your reachflow repo, with the three downloaded files
sitting in the same folder as this script (or edit SOURCE_DIR below):
  python3 deploy_voice_profile.py
"""

import os
import shutil
import subprocess
import sys

SOURCE_DIR = os.path.dirname(os.path.abspath(__file__))  # folder this script lives in

FILES = {
    "App.jsx":                  "src/App.jsx",
    "useSupabaseData.js":       "src/useSupabaseData.js",
}

COMMIT_MSG = "feat: agency voice profile, AI message drafting, regenerate, brand-save fix"


def run(cmd, cwd=None):
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Command failed: {cmd}")
        print(result.stderr)
        sys.exit(1)
    return result.stdout.strip()


def main():
    if not os.path.exists(".git"):
        print("❌ Run this script from the root of your reachflow repo.")
        sys.exit(1)

    repo_root = os.getcwd()
    print(f"📁 Repo: {repo_root}\n")

    print("📋 Copying files...")
    for src_name, dest_rel in FILES.items():
        src_path = os.path.join(SOURCE_DIR, src_name)
        if not os.path.exists(src_path):
            print(f"❌ Could not find {src_name} next to this script ({src_path})")
            print("   Download it from the chat and place it in the same folder as this script.")
            sys.exit(1)
        dest_path = os.path.join(repo_root, dest_rel)
        shutil.copy2(src_path, dest_path)
        print(f"   {src_name} → {dest_rel}")

    print("\n📦 Staging changes...")
    dest_paths = " ".join(FILES.values())
    run(f"git add {dest_paths}", cwd=repo_root)

    diff = run("git diff --cached --stat", cwd=repo_root)
    print(f"\n📊 Staged:\n{diff}")

    print(f'\n💾 Committing...')
    run(f'git commit -m "{COMMIT_MSG}"', cwd=repo_root)

    print("🚀 Pushing to GitHub...")
    run("git push", cwd=repo_root)

    print("\n✅ Code pushed — Vercel is rebuilding now.")
    print("\n⚠️  ONE MORE STEP — run this in Supabase SQL Editor before testing:")
    print("""
    ALTER TABLE agencies
      ADD COLUMN IF NOT EXISTS voice_profile JSONB
      DEFAULT '{"tone":"","doList":[],"dontList":[],"sampleMessages":[],"description":""}'::jsonb;

    UPDATE agencies
    SET voice_profile = '{"tone":"","doList":[],"dontList":[],"sampleMessages":[],"description":""}'::jsonb
    WHERE voice_profile IS NULL;
    """)
    print("Without this, Settings → Brand voice & tone will fail to save (column doesn't exist yet).")


if __name__ == "__main__":
    main()
