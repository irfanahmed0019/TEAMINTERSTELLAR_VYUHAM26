"""Finite local exercise check. Runs learner code, NOT a security sandbox."""
import ast
import os
import signal
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    path = Path('main.py')
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 32000:
        print('Open a workspace with main.py (up to 32 KB, not a link). No attempt recorded.')
        return 3
    source = path.read_text(encoding='utf-8')
    try:
        tree = ast.parse(source)
    except SyntaxError as error:
        print('Fix the Python syntax: ' + str(error))
        return 1
    if not any(isinstance(node, (ast.For, ast.While)) for node in ast.walk(tree)):
        print('Use a for or while loop in main.py.')
        return 1
    # File-backed output avoids unbounded parent memory. A short deadline and
    # polled size cap stop noisy code; this is not an isolation/security claim.
    with tempfile.TemporaryFile() as output:
        child = subprocess.Popen([sys.executable, '-I', str(path.resolve())], stdout=output, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=os.name != 'nt')
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
                return 1
            time.sleep(.02)
        if os.name != 'nt':
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        output.seek(0)
        text = output.read(64001).decode('utf-8', errors='replace')
    expected = '0 1 1 2 3 5 8 13 21 34'
    if child.returncode != 0 or text.strip() != expected:
        print('Expected: ' + expected + '\nYour output: ' + text[:2000])
        return 1
    print('BML_PRACTICE_PASS:python-loops-fibonacci-v1')
    print('Passed this one exercise only. Not proof of general loop skill.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, UnicodeError) as error:
        print('Could not read or run main.py. No attempt recorded: ' + type(error).__name__)
        sys.exit(3)
