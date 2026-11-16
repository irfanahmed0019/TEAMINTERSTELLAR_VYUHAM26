"""Finite local exercise check. Runs learner code, NOT a security sandbox."""
import ast
import os
import signal
import subprocess
import sys
import tempfile
from pathlib import Path


TASKS = {
    'python-loops-fibonacci-v1': [('10', '0 1 1 2 3 5 8 13 21 34')],
    'python-conditions-sign-v1': [('-3', 'negative'), ('0', 'zero'), ('7', 'positive')],
    'python-functions-double-v1': [('-2', '-4'), ('0', '0'), ('9', '18')],
    'python-strings-vowels-v1': [('sky', '0'), ('hello', '2'), ('aeiou', '5')],
}


def main():
    # No argument retains the released Fibonacci contract. Never accept custom cases.
    task = sys.argv[1] if len(sys.argv) >= 2 else 'python-loops-fibonacci-v1'
    if len(sys.argv) > 3 or task not in TASKS:
        print('Unsupported practice task. No attempt recorded.')
        return 3
    path = Path(sys.argv[2]) if len(sys.argv) == 3 else Path('main.py')
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 32000:
        print('Choose a saved Python file (up to 32 KB, not a link). No attempt recorded.')
        return 3
    source = path.read_text(encoding='utf-8')
    try:
        tree = ast.parse(source)
    except SyntaxError as error:
        print('Fix the Python syntax: ' + str(error))
        return 1
    nodes = list(ast.walk(tree))
    if task in ('python-loops-fibonacci-v1', 'python-strings-vowels-v1'):
        valid = any(isinstance(node, (ast.For, ast.While)) for node in nodes)
        requirement = 'Use a for or while loop in your Python file.'
    elif task == 'python-conditions-sign-v1':
        valid = any(isinstance(node, ast.If) for node in nodes)
        requirement = 'Use if/else in your Python file.'
    else:
        defined = any(isinstance(node, ast.FunctionDef) and node.name == 'double' for node in nodes)
        called = any(isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'double' for node in nodes)
        valid = defined and called
        requirement = 'Define double(n) and call double in your Python file.'
    if not valid:
        print(requirement)
        return 1
    for input_value, expected in TASKS[task]:
        if not run_case(path, input_value, expected):
            return 1
    print('BML_PRACTICE_PASS:' + task)
    print('Passed this finite exercise only. Not proof of general skill.')
    return 0


def run_case(path, input_value, expected):
    # File-backed output avoids unbounded parent memory. A short deadline and
    # polled size cap stop noisy code; this is not an isolation/security claim.
    with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as stdin:
        stdin.write((input_value + '\n').encode('utf-8'))
        stdin.seek(0)
        # Suppress only prompts emitted by actual builtin input() calls. Other
        # printed prefixes still fail strict output comparison. Not a sandbox.
        bootstrap = "import builtins,runpy,sys; original=builtins.input; builtins.input=lambda prompt='': original(); runpy.run_path(sys.argv[1],run_name='__main__')"
        child = subprocess.Popen([sys.executable, '-I', '-c', bootstrap, str(path.resolve())], stdout=output, stderr=subprocess.STDOUT, stdin=stdin, start_new_session=os.name != 'nt')
        import time
        deadline = time.monotonic() + 3
        while child.poll() is None:
            if time.monotonic() > deadline or os.fstat(output.fileno()).st_size > 64000:
                if os.name != 'nt':
                    os.killpg(child.pid, signal.SIGKILL)
                else:
                    child.kill()
                child.wait()
                print('Code stopped: time or output limit reached.')
                return False
            time.sleep(.02)
        if os.name != 'nt':
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        output.seek(0)
        text = output.read(64001).decode('utf-8', errors='replace')
    if child.returncode != 0 or len(text) > 64000 or text.strip() != expected:
        print('Input: ' + (input_value or '(none)') + '\nExpected: ' + expected + '\nYour output: ' + text[:2000])
        return False
    return True


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, UnicodeError) as error:
        print('Could not read or run the selected Python file. No attempt recorded: ' + type(error).__name__)
        sys.exit(3)
