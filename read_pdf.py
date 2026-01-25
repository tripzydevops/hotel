
import sys
import os

try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf not installed. Trying to install...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    from pypdf import PdfReader

def read_pdf(path):
    try:
        reader = PdfReader(path)
        text = ""
        print(f"--- PDF Content ({len(reader.pages)} pages) ---")
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            print(f"\n[Page {i+1}]\n{page_text}")
            text += page_text
        return text
    except Exception as e:
        print(f"Error reading PDF: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python read_pdf.py <path>")
        sys.exit(1)
    
    path = sys.argv[1]
    read_pdf(path)
