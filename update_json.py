import json
import sys
import os

def update_json(file_path, section_name, section_content_file):
    if not os.path.exists(file_path):
        print(f"Error: {file_path} does not exist")
        return False
    
    if not os.path.exists(section_content_file):
        print(f"Error: {section_content_file} does not exist")
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        with open(section_content_file, 'r', encoding='utf-8') as f:
            section_content = json.load(f)
            
        data[section_name] = section_content
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        
        print(f"Successfully updated {file_path} from {section_content_file}")
        return True
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python update_json.py <file_path> <section_name> <section_content_file>")
        sys.exit(1)
    
    update_json(sys.argv[1], sys.argv[2], sys.argv[3])
