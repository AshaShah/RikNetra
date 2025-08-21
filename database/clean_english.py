def add_blank_line_before_digit_one(input_file, output_file):
    """
    Add blank line only before lines that start with '1 ' (digit one followed by space)
    """
    try:
        # Read the input file
        with open(input_file, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        result = []
        
        for i, line in enumerate(lines):
            # Check if line starts with '1 ' (after stripping leading whitespace)
            if line.strip().startswith('1 '):
                # Add blank line before this line (unless it's the first line)
                if i > 0 and result and result[-1].strip() != '':
                    result.append('\n')
            result.append(line)
        
        # Write to output file
        with open(output_file, 'w', encoding='utf-8') as file:
            file.writelines(result)
        
        print(f"Successfully processed file. Output saved to: {output_file}")
        
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

# Usage example
input_filename = "english_cleaned.txt"  # Replace with your input file name
output_filename = "english_numbered.txt"  

add_blank_line_before_digit_one(input_filename, output_filename)

