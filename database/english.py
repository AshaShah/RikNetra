import json

def read_text_groups_robust(filename):
    """
    Read text groups from a file with better handling of blank lines
    """
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        groups = []
        current_group = []
        
        for line in lines:
            stripped_line = line.strip()
            
            if stripped_line:  # Non-empty line
                current_group.append(line.rstrip('\n'))  # Keep original line breaks
            else:  # Empty line (blank line)
                if current_group:  # If we have content, save the group
                    groups.append('\n'.join(current_group))
                    current_group = []
        
        # Add the last group if it exists
        if current_group:
            groups.append('\n'.join(current_group))
        
        return groups
    
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found.")
        return []
    except Exception as e:
        print(f"Error reading file: {e}")
        return []

def update_json_with_cleaned_text(json_filename, text_groups):
    """
    Update the JSON file by replacing text_english fields
    """
    try:
        # Read the JSON file
        with open(json_filename, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        print(f"JSON nodes: {len(data['nodes'])}")
        print(f"Text groups: {len(text_groups)}")
        
        # Debug: Show first few groups to verify they're correct
        for i in range(min(3, len(text_groups))):
            print(f"Group {i+1} preview: {repr(text_groups[i][:100])}...")
            print(f"Group {i+1} lines: {text_groups[i].count(chr(10)) + 1}")
            print("---")
        
        # Update each node
        min_count = min(len(data['nodes']), len(text_groups))
        print(f"Updating {min_count} nodes...")
        
        for i in range(min_count):
            data['nodes'][i]['text_english'] = text_groups[i]
        
        # Save the updated JSON
        with open(json_filename, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
        
        print(f"Successfully updated {min_count} nodes")
        return data
        
    except Exception as e:
        print(f"Error: {e}")
        return None

# Main execution
if __name__ == "__main__":
    json_file = "k3database.json"
    cleaned_text_file = "english_cleaned.txt"
    
    text_groups = read_text_groups_robust(cleaned_text_file)
    print(f"Found {len(text_groups)} text groups")
    
    if text_groups:
        update_json_with_cleaned_text(json_file, text_groups)