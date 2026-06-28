import sys
def check(path):
    s = open(path, 'r', encoding='utf-8').read()
    in_comment = False
    in_string = False
    string_char = None
    for i, c in enumerate(s):
        if not in_comment and not in_string:
            if c == '/' and i+1 < len(s) and s[i+1] == '*':
                in_comment = True
            elif c in ['\"', '\'']:
                in_string = True
                string_char = c
        elif in_comment:
            if c == '*' and i+1 < len(s) and s[i+1] == '/':
                in_comment = False
        elif in_string:
            if c == string_char and s[i-1] != '\\':
                in_string = False
    if in_comment: print(f'{path}: Unclosed comment!')
    if in_string: print(f'{path}: Unclosed string!')
    if not in_comment and not in_string: print(f'{path}: OK')

check('src/styles/components.css')
check('src/styles/screens.css')
check('src/styles/base.css')
