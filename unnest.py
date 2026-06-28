import re

def unnest_css(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    start_str = ':root[data-theme="light"] {'
    start_idx = content.find(start_str)

    if start_idx == -1:
        print('Block not found!')
        return

    depth = 0
    end_idx = -1
    for i in range(start_idx + len(start_str), len(content)):
        if content[i] == '{': depth += 1
        elif content[i] == '}':
            if depth == 0:
                end_idx = i
                break
            depth -= 1

    if end_idx == -1:
        print('Closing brace not found!')
        return

    inner_css = content[start_idx + len(start_str):end_idx]
    
    # We will use regex to find all selectors.
    # A selector is anything before a { that is not inside a block.
    
    new_inner = []
    
    # Simple state machine
    buffer = ""
    in_comment = False
    i = 0
    while i < len(inner_css):
        if not in_comment and inner_css[i:i+2] == '/*':
            in_comment = True
            new_inner.append(buffer)
            buffer = "/*"
            i += 2
            continue
        elif in_comment and inner_css[i:i+2] == '*/':
            in_comment = False
            buffer += "*/"
            new_inner.append(buffer)
            buffer = ""
            i += 2
            continue
            
        if in_comment:
            buffer += inner_css[i]
            i += 1
            continue
            
        if inner_css[i] == '{':
            # buffer contains selector
            selector_str = buffer.strip()
            if selector_str:
                selectors = [s.strip() for s in selector_str.split(',')]
                new_selectors = []
                for s in selectors:
                    if s.startswith('@'):
                        new_selectors.append(s)
                    else:
                        new_selectors.append(f':root[data-theme="light"] {s}')
                
                # Replace the buffer with the new selector string
                # preserve leading whitespace
                leading_ws = buffer[:len(buffer) - len(buffer.lstrip())]
                buffer = leading_ws + ',\n'.join(new_selectors) + ' {'
            else:
                buffer += '{'
                
            new_inner.append(buffer)
            buffer = ""
            
            # Now we are inside a rule, read until }
            rule_buffer = ""
            rule_depth = 1
            i += 1
            while i < len(inner_css):
                rule_buffer += inner_css[i]
                if inner_css[i] == '{':
                    rule_depth += 1
                elif inner_css[i] == '}':
                    rule_depth -= 1
                    if rule_depth == 0:
                        i += 1
                        break
                i += 1
            new_inner.append(rule_buffer)
            continue
            
        buffer += inner_css[i]
        i += 1
        
    new_inner.append(buffer)
    
    final_content = content[:start_idx] + "".join(new_inner) + content[end_idx+1:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)
        
    print('Successfully un-nested CSS!')

unnest_css('src/styles/components.css')
