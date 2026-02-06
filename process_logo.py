from PIL import Image
import os

def process_logo(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    # 1. Remove nearly black background (around #1E1E1E)
    datas = img.getdata()
    newData = []
    for item in datas:
        # If the pixel is very dark (background), make it transparent
        if item[0] < 45 and item[1] < 45 and item[2] < 45:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
    
    img.putdata(newData)
    
    # 2. Trim empty space
    # (Optional: crop to contents)
    
    img.save(output_path, "PNG")
    print(f"Processed logo saved to {output_path}")

if __name__ == "__main__":
    logo_path = r"c:\projects\hotel\public\logo.png"
    backup_path = r"c:\projects\hotel\public\logo.old.png"
    
    if not os.path.exists(backup_path):
        os.rename(logo_path, backup_path)
    
    process_logo(backup_path, logo_path)
