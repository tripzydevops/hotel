import sys
import os
import subprocess
import argparse

def main():
    parser = argparse.ArgumentParser(description="Hotel Rate Sentinel Task Runner")
    parser.add_argument("script", help="The script to run (name only, e.g., 'check_sentiment_data')")
    parser.add_argument("args", nargs=argparse.REMAINDER, help="Additional arguments for the script")
    
    args = parser.parse_args()
    
    # Resolve the project root (one level up from this script's directory's parent)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    # Add project root to PYTHONPATH
    env = os.environ.copy()
    python_path = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = f"{project_root}:{python_path}" if python_path else project_root
    
    # Find the script
    script_name = args.script
    if not script_name.endswith(".py"):
        script_name += ".py"
        
    script_path = os.path.join(script_dir, script_name)
    
    if not os.path.exists(script_path):
        print(f"Error: Script '{script_name}' not found in {script_dir}")
        sys.exit(1)
        
    # Execute the script
    cmd = [sys.executable, script_path] + args.args
    print(f"🚀 Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, env=env)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
