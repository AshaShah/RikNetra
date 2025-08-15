import json
import re

# Read the nodes from test.json
with open('test.json', encoding='utf-8') as f:
    data = json.load(f)

# Read and split english.txt by blank lines (two or more newlines)
with open('english.txt', encoding='utf-8') as f:
    eng_txt = f.read()
eng_blocks = [block.strip() for block in re.split(r'\n\s*\n', eng_txt) if block.strip()]

# Read and split sanskrit.txt by blank lines (two or more newlines)
with open('sanskrit.txt', encoding='utf-8') as f:
    san_txt = f.read()
san_blocks = [block.strip() for block in re.split(r'\n\s*\n', san_txt) if block.strip()]

# Check counts
if len(data['nodes']) != len(eng_blocks) or len(data['nodes']) != len(san_blocks):
    raise ValueError(f"Counts do not match: nodes={len(data['nodes'])}, english={len(eng_blocks)}, sanskrit={len(san_blocks)}")

# Add the new fields (without changing "text")
for i, node in enumerate(data['nodes']):
    node['text_english'] = eng_blocks[i]
    node['text_sanskrit'] = san_blocks[i]

# Write back to test.json
with open('test.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Added text_english and text_sanskrit to each node, original text untouched.")