import { spawn } from 'node:child_process';
/** Run approved local commands. Termination always includes their process tree. */
export function executeLocalCommand(command: string, cwd: string, timeoutMs: number, onOutput: (text: string) => void = () => {}): Promise<{code: number; passed: boolean; output: string}> {
  return new Promise((resolve) => {
    if (!command.trim()) return resolve({code:1,passed:false,output:'No safe local run command was available for this project.'});
    const child = spawn(command, {cwd,shell:true,env:process.env,detached:process.platform !== 'win32'});
    let output = '', finished = false;
    const terminate = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') spawn('taskkill', ['/pid',String(child.pid),'/T','/F'], {windowsHide:true});
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
    };
    const finish = (code: number, passed = code === 0) => {
      if (finished) return;
      finished = true; clearTimeout(timer); terminate();
      resolve({code,passed,output:output || `Command exited with code ${code}.`});
    };
    const onData = (chunk: Buffer) => {
      const text=chunk.toString(); output=(output+text).slice(-6000); onOutput(text);
      if (command.includes('uvicorn') && /(running on|application startup complete|127\.0\.0\.1:8000)/i.test(output)) finish(0,true);
    };
    child.stdout?.on('data',onData); child.stderr?.on('data',onData);
    child.on('error',error=>{output=(output+'\n'+error.message).slice(-6000);finish(1,false);});
    child.on('close',code=>finish(code??1));
    const timer=setTimeout(()=>{output=(output+`\nCommand timed out after ${timeoutMs/1000}s. Process tree stopped.`).slice(-6000);finish(1,false);},timeoutMs);
  });
}
