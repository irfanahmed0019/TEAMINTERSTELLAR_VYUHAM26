import { claimPairingCode, normalizePairingCode } from "./pairingCode";
import * as vscode from "vscode";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { executeLocalCommand } from "./processRunner";
import { loadAppConfig } from "./config";
import { SessionClient, RemoteSession } from "./sessionClient";
import { sidebarHtml } from "./webviewHtml";
import { ResultsPanel, RESULTS_VIEW_ID } from "./resultsPanel";
import { startBridge, consumeStagedSession, SessionConnect } from "./bridge";

const practiceTaskDetails: Record<
  string,
  { title: string; cases: number; inputs: string }
> = {
  "python-arithmetic-add-v1": {
    title: "Add two numbers",
    cases: 4,
    inputs: "two lines per case: 5 and 7; 0 and 0; -3 and 8; 12 and -4",
  },
  "python-loops-fibonacci-v1": {
    title: "Fibonacci numbers",
    cases: 1,
    inputs: "10",
  },
  "python-conditions-sign-v1": {
    title: "Number sign",
    cases: 3,
    inputs: "-3, 0, 7",
  },
  "python-functions-double-v1": {
    title: "Double a number",
    cases: 3,
    inputs: "-2, 0, 9",
  },
  "python-strings-vowels-v1": {
    title: "Count vowels",
    cases: 3,
    inputs: "sky, hello, aeiou",
  },
  "python-loops-triangular-v1": {
    title: "Sum 1 to n",
    cases: 4,
    inputs: "0, 1, 4, 7",
  },
  "python-loops-multiples3-v1": {
    title: "Count multiples of 3",
    cases: 4,
    inputs: "0, 2, 3, 10",
  },
  "python-conditions-vote-v1": {
    title: "Voting age",
    cases: 4,
    inputs: "0, 17, 18, 70",
  },
  "python-conditions-pass-v1": {
    title: "Pass or retry",
    cases: 4,
    inputs: "0, 49, 50, 100",
  },
  "python-functions-square-v1": {
    title: "Square a number",
    cases: 4,
    inputs: "-3, 0, 2, 5",
  },
  "python-functions-negate-v1": {
    title: "Negate a number",
    cases: 4,
    inputs: "-4, 0, 3, 9",
  },
  "python-strings-uppercase-v1": {
    title: "Count uppercase letters",
    cases: 4,
    inputs: '"AbC", "abc", empty line, "A1 Z"',
  },
  "python-strings-consonants-v1": {
    title: "Count consonants",
    cases: 4,
    inputs: '"sky", "hello", "aeiou", empty line',
  },
};
const isPracticeTask = (id: string | undefined): boolean =>
  !!id && Object.hasOwn(practiceTaskDetails, id);
const viewId = "buildMyLogic.sidebar";
type Connection = { sessionId: string };
type Message = {
  command:
    | "ready"
    | "connect"
    | "pair"
    | "runTests"
    | "submit"
    | "failed"
    | "disconnect";
  pairingCode?: string;
  sessionId?: string;
  tool?: string;
  message?: string;
};

class Sidebar implements vscode.WebviewViewProvider {
  private running = false;
  private evidenceConsent = false;
  private connectEpoch = 0;
  private credentialWrites: Promise<void> = Promise.resolve();
  private connectionSettings: Promise<void> = Promise.resolve();
  private conquestQueue: Promise<void> = Promise.resolve();
  private view?: vscode.WebviewView;
  private session?: RemoteSession;
  private connection?: Connection;
  private live = false;
  private loopToken = 0;
  private lastHeartbeatAt = 0;
  private evidenceSubscriptions: vscode.Disposable[] = [];
  private diagnosticTimer?: NodeJS.Timeout;
  private pendingUriSession?: { sessionId: string };
  constructor(
    private readonly api: SessionClient,
    private readonly results: ResultsPanel,
    private readonly context: vscode.ExtensionContext,
  ) {}
  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = sidebarHtml(view.webview.cspSource);
    view.onDidDispose(() => {
      this.stop();
      this.clearEvidenceSubscriptions();
    });
    view.webview.onDidReceiveMessage((m: unknown) => {
      if (valid(m)) void this.handle(m);
    });
    const pending = this.pendingUriSession;
    this.pendingUriSession = undefined;
    if (pending?.sessionId) void this.connect(pending.sessionId, false);
    else {
      const saved = vscode.workspace
        .getConfiguration("buildMyLogic")
        .get<Connection>("session");
      if (saved?.sessionId) void this.connect(saved.sessionId, true);
    }
  }
  public async focusSessionChat() {
    await vscode.commands.executeCommand("buildMyLogic.sidebar.focus");
  }
  private async waitForView(timeout = 2500) {
    const started = Date.now();
    while (!this.view && Date.now() - started < timeout)
      await new Promise((resolve) => setTimeout(resolve, 50));
  }
  public async connectFromUri(uri: vscode.Uri) {
    try {
      const params = new URLSearchParams(uri.query);
      const sessionId =
        params.get("sessionId") || params.get("session_id") || "";
      if (!sessionId)
        return this.status(
          "The BuildMyLogic link is missing its Session ID.",
          true,
        );
      const apiBaseUrl =
        params.get("apiBaseUrl") ||
        params.get("api_base_url") ||
        this.api.getBaseUrl();
      const parsed = new URL(apiBaseUrl);
      const allowed =
        parsed.origin === "https://buildmylogicxyz.vercel.app" ||
        (parsed.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(parsed.hostname));
      if (!allowed)
        throw new Error(
          "This connection address is not an approved BuildMyLogic website. No credential was sent.",
        );
      this.api.setBaseUrl(parsed.origin);
      const key = "bml.session." + parsed.origin + ":" + sessionId;
      const token =
        params.get("token") || (await this.context.secrets.get(key));
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
        throw new Error(
          "Use the pairing code shown on the signed-in Sessions page. A display Session ID alone cannot connect.",
        );
      this.api.setSessionToken(token);
      await this.context.secrets.store(key, token);
      await vscode.workspace
        .getConfiguration("buildMyLogic")
        .update("apiBaseUrl", parsed.origin, vscode.ConfigurationTarget.Global);
      this.pendingUriSession = { sessionId };
      try {
        await vscode.commands.executeCommand(
          "workbench.view.extension.buildMyLogic",
        );
      } catch {
        /* The URI still activates the extension if the view command is unavailable. */
      }
      await this.waitForView();
      if (this.view && this.pendingUriSession?.sessionId === sessionId) {
        this.pendingUriSession = undefined;
        await this.connect(sessionId, false);
      }
    } catch (error) {
      this.status(
        error instanceof Error
          ? error.message
          : "Could not connect the BuildMyLogic session.",
        true,
      );
    }
  }
  private async handle(m: Message) {
    try {
      if (m.command === "ready") {
        if (this.session) this.post({ type: "session", session: this.session });
        else if (this.restoring) this.post({ type: "restoring", on: true });
        return;
      }
      if (m.command === "pair") return await this.pair(m.pairingCode || "");
      if (m.command === "connect")
        return void this.connect(m.sessionId || "", false);
      if (m.command === "disconnect") {
        this.connectEpoch++;
        this.stop();
        this.clearEvidenceSubscriptions();
        this.session = undefined;
        this.connection = undefined;
        this.api.setSessionToken(undefined);
        const epoch = this.connectEpoch,
          base = this.api.getBaseUrl();
        await this.saveConnectionSettings(epoch, base);
        if (epoch !== this.connectEpoch) return;
        this.results.update(undefined, "");
        return this.post({ type: "disconnected" });
      }
      if (!this.session || !this.connection)
        return this.status(
          "Connect an active BuildMyLogic session first.",
          true,
        );
      const taskGeneration = this.session.task_generation ?? 0,
        taskChallenge = this.session.challenge_id;
      const unchangedTask = () =>
        this.session?.challenge_id === taskChallenge &&
        (this.session?.task_generation ?? 0) === taskGeneration;
      if (
        ["runTests", "submit", "failed"].includes(m.command) &&
        this.session?.challenge_id === "project-context-pending"
      ) {
        return this.status(
          "No coding task yet. Choose a task on the website first.",
        );
      }
      if (m.command === "failed") {
        const connection = this.connection;
        const yes = await vscode.window.showWarningMessage(
          "You couldn't complete this challenge? This marks it failed and starts recovery.",
          { modal: true },
          "Yes, Help Me Recover",
        );
        if (
          yes !== "Yes, Help Me Recover" ||
          this.connection !== connection ||
          !unchangedTask()
        )
          return;
        const r = await this.api.fail(
          connection.sessionId,
          "Learner selected I Failed",
          taskGeneration,
        );
        if (this.connection !== connection || !unchangedTask()) return;
        this.session = r.state || this.session;
        return this.post({
          type: "failed",
          text: `${r.recovery || ""}\n\nMini-task: ${r.mini_task || ""}`,
          session: this.session,
        });
      }
      if (m.command === "submit" || m.command === "runTests") {
        if (this.running)
          return this.status(
            "Wait for the current workspace action to finish.",
          );
        this.running = true;
        try {
          if (m.command === "submit") await this.submitProject();
          else await this.test();
        } finally {
          this.running = false;
        }
      }
    } catch (e) {
      this.status(
        e instanceof Error ? e.message : "Session action failed.",
        true,
      );
    }
  }
  /** Serialize settings transitions; a late old write is reconciled before the next writer. */
  private async saveConnectionSettings(epoch: number, base: string) {
    const current = () =>
      epoch === this.connectEpoch && base === this.api.getBaseUrl();
    const write = this.connectionSettings.then(async () => {
      if (!current()) return;
      const config = vscode.workspace.getConfiguration("buildMyLogic");
      await config.update(
        "session",
        this.connection,
        vscode.ConfigurationTarget.Global,
      );
      if (!current()) {
        await config.update(
          "session",
          this.connection,
          vscode.ConfigurationTarget.Global,
        );
        return;
      }
      if (this.connection) {
        await config.update(
          "apiBaseUrl",
          base,
          vscode.ConfigurationTarget.Global,
        );
        if (!current()) {
          await config.update(
            "session",
            this.connection,
            vscode.ConfigurationTarget.Global,
          );
          await config.update(
            "apiBaseUrl",
            this.api.getBaseUrl(),
            vscode.ConfigurationTarget.Global,
          );
        }
      }
    });
    this.connectionSettings = write.catch(() => {});
    await write;
  }
  private async pair(value: string) {
    if (!normalizePairingCode(value))
      return this.status(
        "Enter the 8-character pairing code from the signed-in website. The Session ID is only a display ID.",
        true,
      );
    const epoch = ++this.connectEpoch,
      base = this.api.getBaseUrl();
    this.stop();
    this.clearEvidenceSubscriptions();
    this.session = undefined;
    this.connection = undefined;
    this.api.setSessionToken(undefined);
    this.results.update(undefined, "");
    this.post({ type: "disconnected" });
    try {
      this.status("Claiming your one-use pairing code…");
      const claim = await claimPairingCode(base, value);
      if (epoch !== this.connectEpoch || this.api.getBaseUrl() !== base) return;
      const key = "bml.session." + base + ":" + claim.session_id;
      const current = () =>
        epoch === this.connectEpoch && this.api.getBaseUrl() === base;
      const store = this.credentialWrites.then(async () => {
        if (!current()) return;
        const previous = await this.context.secrets.get(key);
        if (!current()) return;
        try {
          await this.context.secrets.store(key, claim.connection_token);
          if (!current()) {
            // Writes from this Sidebar are serialized, so rollback cannot erase a newer pairing.
            const saved = await this.context.secrets.get(key);
            if (saved === claim.connection_token) {
              if (previous !== undefined)
                await this.context.secrets.store(key, previous);
              else await this.context.secrets.delete(key);
            }
          }
        } catch {
          throw new Error(
            "VS Code could not safely save the secure session credential. Check SecretStorage before generating a new pairing code.",
          );
        }
      });
      this.credentialWrites = store.catch(() => {});
      await store;
      if (!current()) return;
      // Existing connect reads the token from SecretStorage and keeps normal evidence consent.
      await this.connect(claim.session_id, false);
    } catch (error) {
      if (epoch !== this.connectEpoch) return;
      this.status(
        error instanceof Error
          ? error.message
          : "Pairing could not finish. Generate a new code on the website.",
        true,
      );
    }
  }
  private async connect(sessionId: string, silent: boolean) {
    sessionId = sessionId.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{5,39}$/.test(sessionId)) {
      if (!silent)
        this.status(
          "Enter the Session ID copied from the BuildMyLogic website.",
          true,
        );
      return;
    }
    const epoch = ++this.connectEpoch,
      base = this.api.getBaseUrl();
    const current = () =>
      epoch === this.connectEpoch && this.api.getBaseUrl() === base;
    this.stop();
    this.clearEvidenceSubscriptions();
    this.session = undefined;
    this.connection = undefined;
    this.results.update(undefined, "");
    this.post({ type: "disconnected" });
    if (silent) this.setRestoring(true);
    try {
      if (!silent) this.status("Connecting to your BuildMyLogic session…");
      const savedToken = await this.context.secrets.get(
        "bml.session." + base + ":" + sessionId,
      );
      if (!current()) return;
      this.api.setSessionToken(savedToken);
      const r = await this.api.connect(sessionId);
      if (!current()) return;
      if (!r.session || r.session.session_id !== sessionId)
        throw new Error(
          "The returned session does not match this connection. Generate a new pairing code.",
        );
      this.session = r.session;
      this.connection = { sessionId };
      await this.saveConnectionSettings(epoch, base);
      if (!current()) return;
      this.post({ type: "session", session: this.session });
      if (silent) this.setRestoring(false);
      void this.notifyConquests(this.session);
      this.status(
        this.session?.challenge_id === "project-context-pending"
          ? "Connected. No coding task yet."
          : "Connected. Task loaded.",
        false,
      );
      this.startLiveSync();
      // The session is already connected here. A failure while sharing evidence
      // (for example a finished task refusing new events) must not drop the saved
      // connection or tell the learner to pair again.
      try {
        await this.consentEvidence();
      } catch (evidenceError) {
        if (!current()) return;
        this.status(
          `Connected. Evidence sharing did not start: ${
            evidenceError instanceof Error
              ? evidenceError.message
              : "the website refused it."
          }`,
          false,
        );
      }
      if (!current()) return;
    } catch (error) {
      if (!current()) return;
      this.session = undefined;
      this.connection = undefined;
      this.stop();
      this.clearEvidenceSubscriptions();
      await this.saveConnectionSettings(epoch, base);
      if (!current()) return;
      const message =
        error instanceof Error
          ? error.message
          : "This Session ID is not active.";
      this.status(
        `${message} Generate a new pairing code on the signed-in Sessions page and enter it here.`,
        true,
      );
    } finally {
      if (silent && epoch === this.connectEpoch) this.setRestoring(false);
    }
  }
  /** While a saved session is restoring, the pairing form is disabled so a typed code is not lost. */
  private restoring = false;
  private setRestoring(on: boolean) {
    this.restoring = on;
    this.post({ type: "restoring", on });
  }
  /** Stop the live sync loop (used on disconnect and when the view closes). */
  private stop() {
    this.live = false;
    this.loopToken += 1;
    this.lastHeartbeatAt = 0;
  }
  /**
   * Live sync: long-poll the session state so anything the learner changes on
   * the BuildMyLogic website (hint, status, checkpoint, mentor note) renders in
   * VS Code the moment it happens instead of after a 15 second timer.
   * A heartbeat still goes out every 15s so the website can show the extension
   * as connected.
   */
  private startLiveSync() {
    this.stop();
    this.live = true;
    const token = this.loopToken;
    void this.liveSync(token);
  }
  private async liveSync(token: number) {
    while (this.live && token === this.loopToken) {
      const connection = this.connection;
      if (!connection) return;
      const cycleStarted = Date.now();
      try {
        if (Date.now() - this.lastHeartbeatAt >= 15000) {
          await this.api.heartbeat(connection.sessionId);
          this.lastHeartbeatAt = Date.now();
        }
        const since = this.session?.rev;
        const response = await this.api.state(connection.sessionId, {
          since,
          waitMs: 8000,
        });
        if (!this.live || token !== this.loopToken) return;
        this.post({ type: "connection", connected: true });
        const next = response.state;
        const current = next || this.session;
        this.status(
          current?.challenge_id === "project-context-pending"
            ? "Connected. No coding task yet."
            : isPracticeTask(current?.challenge_id) &&
                current?.status === "completed"
              ? "Practice complete. Your result is saved. Choose another question on the website."
              : "Connected. Task loaded.",
        );
        if (next) await this.notifyConquests(next);
        if (
          next &&
          (typeof since !== "number" ||
            next.rev !== since ||
            JSON.stringify(next.conquest_receipts) !==
              JSON.stringify(this.session?.conquest_receipts))
        ) {
          this.session = next;
          this.post({ type: "session", session: next, live: true });
        }
      } catch {
        if (!this.live || token !== this.loopToken) return;
        this.post({ type: "connection", connected: false });
        this.status("○ Reconnecting to BuildMyLogic…", true);
      }
      // Older servers may ignore long-poll parameters. Never spin requests.
      const remaining = 8000 - (Date.now() - cycleStarted);
      if (remaining > 0)
        await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }
  private notifyConquests(session: RemoteSession): Promise<void> {
    this.conquestQueue = this.conquestQueue
      .catch(() => {})
      .then(() => this.deliverConquests(session));
    return this.conquestQueue;
  }
  private async deliverConquests(session: RemoteSession) {
    const connection = this.connection;
    if (!connection || connection.sessionId !== session.session_id) return;
    for (const receipt of session.conquest_receipts ?? []) {
      if (this.connection !== connection) return;
      const seen = this.context.globalState.get<string[]>(
        "websiteConquestNotified",
        [],
      );
      if (seen.includes(receipt.id)) continue;
      await this.context.globalState.update(
        "websiteConquestNotified",
        [...seen, receipt.id].slice(-200),
      );
      if (this.connection !== connection) return;
      void vscode.window
        .showInformationMessage(
          `Misconception Conquered: ${receipt.summary}. Website changed-task recovery recorded. Original project checks are unchanged.`,
          "Open Failure Replay",
        )
        .then((action) => {
          if (action === "Open Failure Replay")
            void vscode.env.openExternal(
              vscode.Uri.parse(
                new URL(
                  "/progress?view=struggle",
                  this.api.getBaseUrl(),
                ).toString(),
              ),
            );
        });
    }
  }
  private clearEvidenceSubscriptions() {
    this.evidenceConsent = false;
    this.evidenceSubscriptions.forEach((subscription) =>
      subscription.dispose(),
    );
    this.evidenceSubscriptions = [];
    if (this.diagnosticTimer) clearTimeout(this.diagnosticTimer);
    this.diagnosticTimer = undefined;
  }
  private installEvidenceSubscriptions() {
    const consent = this.evidenceConsent;
    this.clearEvidenceSubscriptions();
    this.evidenceConsent = consent;
    if (!this.connection || !this.evidenceConsent) return;
    this.evidenceSubscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (
          !this.session ||
          !this.connection ||
          !this.isInActiveWorkspace(document.uri)
        )
          return;
        if (
          !safeEvidencePath(
            vscode.workspace.asRelativePath(document.uri, false),
          )
        )
          return;
        void this.recordFileEvidence(document);
      }),
    );
    this.evidenceSubscriptions.push(
      vscode.languages.onDidChangeDiagnostics((event) => {
        if (
          !this.session ||
          !this.connection ||
          !event.uris.some((uri) => this.isInActiveWorkspace(uri))
        )
          return;
        if (this.diagnosticTimer) clearTimeout(this.diagnosticTimer);
        this.diagnosticTimer = setTimeout(
          () => void this.sendDiagnostics(),
          500,
        );
      }),
    );
  }
  private async recordFileEvidence(document: vscode.TextDocument) {
    if (!this.session || !this.connection) return;
    const connection = this.connection;
    const signals = await this.collectEvidenceSignals(document);
    if (this.connection !== connection) return;
    try {
      const result = await this.api.event(
        connection.sessionId,
        "file_evidence",
        {
          file: vscode.workspace
            .asRelativePath(document.uri, false)
            .slice(0, 180),
          language: document.languageId,
          lines: document.lineCount,
          signals,
        },
      );
      if (this.connection !== connection) return;
      if (result.state) {
        this.session = result.state;
        this.post({ type: "session", session: this.session });
      }
    } catch {
      /* Evidence is best-effort and never blocks saving a file. */
    }
  }
  private async collectEvidenceSignals(document: vscode.TextDocument) {
    const source = document.getText().toLowerCase();
    const relative = vscode.workspace
      .asRelativePath(document.uri, false)
      .toLowerCase();
    const signals = ["workspace:project", `file:${relative}`];
    if (relative.endsWith("main.py")) signals.push("file:main.py");
    if (/\bprint\s*\(/.test(source)) signals.push("code:print");
    if (/\b(?:import\s+|from\s+)pandas\b/.test(source))
      signals.push("dependency:pandas", "import:pandas");
    if (/\b(?:import\s+|from\s+)matplotlib\b/.test(source))
      signals.push("dependency:matplotlib", "import:matplotlib");
    if (/\b(venv|virtualenv)\b/.test(source)) signals.push("code:venv");
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) return signals;
    for (const name of [
      "venv",
      ".venv",
      "requirements.txt",
      "pyproject.toml",
    ]) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(root, name));
        signals.push(`workspace:${name}`);
      } catch {
        /* Missing workspace evidence is expected. */
      }
    }
    try {
      const requirements = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(root, "requirements.txt"),
      );
      const text = new TextDecoder().decode(requirements).toLowerCase();
      if (text.includes("pandas")) signals.push("dependency:pandas");
      if (text.includes("matplotlib")) signals.push("dependency:matplotlib");
    } catch {
      /* requirements.txt is optional. */
    }
    return signals.slice(0, 30);
  }
  private isInActiveWorkspace(uri: vscode.Uri) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root || uri.scheme !== "file") return false;
    const relative = path.relative(root, uri.fsPath);
    return (
      relative !== ".." &&
      !relative.startsWith(".." + path.sep) &&
      !path.isAbsolute(relative)
    );
  }
  private async consentEvidence() {
    if (!this.connection || !vscode.workspace.isTrusted) return;
    const connection = this.connection;
    const yes = await vscode.window.showInformationMessage(
      "Share bounded project context, file names, language and error messages with BuildMyLogic during this session? Secret paths are excluded. Full source uploads still ask separately. No AFK, idle or edit timing is tracked. Disconnect to stop sharing.",
      { modal: true },
      "Share session evidence",
    );
    if (yes !== "Share session evidence" || this.connection !== connection)
      return;
    this.evidenceConsent = true;
    this.installEvidenceSubscriptions();
    await this.sendProjectContext();
  }
  private async sendProjectContext() {
    const connection = this.connection,
      root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!connection || !root || !this.evidenceConsent) return;
    const inspected: string[] = [],
      technologies: string[] = [],
      languages = new Set<string>();
    for (const name of [
      "package.json",
      "pyproject.toml",
      "requirements.txt",
      "Cargo.toml",
      "go.mod",
    ]) {
      try {
        const raw = await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(root, name),
        );
        if (raw.byteLength > 32000) continue;
        const value = Buffer.from(raw).toString("utf8");
        inspected.push(name);
        if (name === "package.json") {
          languages.add("JavaScript/TypeScript");
          const manifest = JSON.parse(value);
          technologies.push(
            ...Object.keys(manifest.dependencies || {}).slice(0, 15),
          );
        }
        if (name.includes("requirements") || name === "pyproject.toml") {
          languages.add("Python");
          for (const dependency of [
            "django",
            "fastapi",
            "flask",
            "pandas",
            "pytest",
          ])
            if (value.toLowerCase().includes(dependency))
              technologies.push(dependency);
        }
        if (name === "Cargo.toml") languages.add("Rust");
        if (name === "go.mod") languages.add("Go");
      } catch {
        /* Missing or unreadable manifests establish no project knowledge. */
      }
    }
    if (this.connection !== connection) return;
    const response = await this.api.event(
      connection.sessionId,
      "project_context",
      {
        inspected_files: inspected,
        languages: [...languages],
        technologies,
        summary: inspected.length
          ? "Only listed manifests were inspected locally. Existing mission has not been regenerated or validated against source files. Run assertion-backed project tests to establish correctness."
          : "No supported manifests were found. Project contents and language remain unverified.",
      },
    );
    if (this.connection === connection && response.state)
      this.session = response.state;
    await this.offerProjectChallenge();
  }
  private async offerProjectChallenge() {
    const connection = this.connection,
      root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (
      !connection ||
      !root ||
      !this.evidenceConsent ||
      !vscode.workspace.isTrusted ||
      this.session?.attempts ||
      isPracticeTask(this.session?.challenge_id) ||
      /^python-(decimal-contract|literal-repair):/.test(
        this.session?.challenge_id || "",
      )
    )
      return;
    const choice = await vscode.window.showQuickPick(
      [
        {
          label:
            "Project utility repair + reviewed changed-input recheck (4+ cases)",
          flow: "partition",
        },
        { label: "Project literal-test utility repair only", flow: "literal" },
        { label: "Decimal input-validation repair", flow: "decimal" },
      ],
      {
        title:
          "Choose bounded project assessment. Other project/framework code remains unsupported.",
      },
    );
    if (!choice) return;
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: root,
      filters: { Python: ["py"] },
      title: "Choose actual Python source module",
    });
    const test = selected?.[0]
      ? await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          defaultUri: root,
          filters: { Python: ["py"] },
          title:
            "Choose its existing literal test file (never executed/imported)",
        })
      : undefined;
    if (!selected?.[0] || !test?.[0] || this.connection !== connection) return;
    const relative = (uri: vscode.Uri) =>
      vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/");
    const sourcePath = relative(selected[0]),
      testPath = relative(test[0]);
    if (
      sourcePath === testPath ||
      ![selected[0], test[0]].every((uri) => this.isInActiveWorkspace(uri)) ||
      ![sourcePath, testPath].every(
        (p) =>
          safeEvidencePath(p) &&
          /^(?![./])(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.py$/.test(p),
      )
    )
      throw new Error(
        "Choose different safe source/test files inside this workspace.",
      );
    if (
      (await vscode.workspace.fs.stat(selected[0])).size > 32000 ||
      (await vscode.workspace.fs.stat(test[0])).size > 32000
    )
      throw new Error("Source/test exceeds32KBlimit.");
    const source = Buffer.from(
      await vscode.workspace.fs.readFile(selected[0]),
    ).toString("utf8");
    const names = [...source.matchAll(/^def ([A-Za-z][A-Za-z_0-9]*)\(/gm)].map(
      (m) => m[1],
    );
    const name = await vscode.window.showQuickPick(names, {
      title:
        "Choose selected standalone utility. Inspector rejects dependencies/unsafe or unsupported syntax.",
    });
    if (!name || this.connection !== connection) return;
    const quote = (v: string) =>
      process.platform === "win32"
        ? '"' + v.replace(/"/g, "") + '"'
        : "'" + v.replace(/'/g, "'\\''") + "'";
    const file =
      choice.flow !== "decimal"
        ? "python_literal_repair.py"
        : "python_decimal_contract.py";
    const command =
      (process.platform === "win32" ? "py -3" : "python3") +
      " -I " +
      quote(this.context.asAbsolutePath("media/" + file)) +
      (choice.flow === "partition" ? " --inspect-partition " : " --inspect ") +
      quote(sourcePath) +
      " " +
      quote(name) +
      " " +
      quote(testPath);
    const run = await this.runCommand(command, root.fsPath, 10000);
    if (run.cancelled || this.connection !== connection) return;
    if (!run.passed)
      return this.status("No repair assigned: " + run.output, true);
    let context: Record<string, unknown>;
    try {
      context = JSON.parse(run.output.trim());
    } catch {
      throw new Error("Inspector returned no bounded contract.");
    }
    if (
      context.path !== sourcePath ||
      context.test_path !== testPath ||
      typeof context.source !== "string" ||
      context.source.length > 8000
    )
      throw new Error("Inspector provenance mismatch.");
    const literal = choice.flow !== "decimal";
    if (
      !literal &&
      (!Array.isArray(context.cases) ||
        context.cases.length < 2 ||
        context.cases.length > 32)
    )
      throw new Error(
        "Decimal inspector returned no bounded2-32case contract. No task assigned.",
      );
    const cases = literal ? context.cases_json : JSON.stringify(context.cases);
    const partitionCopy =
      choice.flow === "partition"
        ? " Initial repair uses the first N-2 approved cases. The last 2 distinct inputs are reserved for later changed-input recheck after learning. All are reviewed and the file is viewable; NOT secret/unseen/independent. Learning context derives from inspected code constructs, not a diagnosed cause."
        : "";
    const approved = await vscode.window.showInformationMessage(
      `Assign repair for ${sourcePath}:${name}? Only selected bounded function runs, never module/test imports. Not an arbitrary Python sandbox. Share exact snippet and approved finite cases. Test file ${testPath}, SHA256 ${context.test_digest}; skipped ${context.skipped}; observed baseline failures ${context.baseline_failures}. Passing these cases is not hidden-test/whole-project correctness or mastery.${literal ? " No extra oracle is invented." : " Additional authored decimal-input rules apply."}\n${context.source}\n${cases}${partitionCopy}`,
      { modal: true },
      "Assign inspected repair",
    );
    if (
      approved !== "Assign inspected repair" ||
      this.connection !== connection
    )
      return;
    const result = await this.api.projectChallenge(
      connection.sessionId,
      context,
    );
    if (this.connection === connection && result.state) {
      this.session = result.state;
      this.post({ type: "session", session: this.session });
      this.status(
        "Finite source/test-grounded repair assigned. Other projects and framework integration remain unassessed.",
      );
    }
  }
  private async runProjectRecheck() {
    const connection = this.connection,
      root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!connection || !this.evidenceConsent || !vscode.workspace.isTrusted)
      throw new Error(
        "Connect a trusted workspace and approve scoped evidence sharing first.",
      );
    const fresh = await this.api.state(connection.sessionId);
    if (this.connection !== connection) return;
    const session = fresh.state ?? this.session;
    if (session) this.session = session;
    const context = session?.project_context,
      contract = context?.repair_contract,
      partition = contract?.partition;
    if (
      !connection ||
      !session ||
      !root ||
      !context?.test_path ||
      !context.test_digest ||
      !contract ||
      !partition ||
      partition.source_session_id !== connection.sessionId ||
      !/^python-literal-repair:/.test(session.challenge_id)
    )
      throw new Error(
        "This session has no approved changed-input partition. Older finite-only tasks cannot claim a fresh recheck.",
      );
    if (session.status !== "completed")
      throw new Error(
        "Complete the initial repair first, then the owner-scoped website learning/diagnosis step.",
      );
    if (
      session.project_recheck_ready?.binding.source_session_id !==
        connection.sessionId ||
      session.project_recheck_ready?.binding.partition_digest !==
        partition.partition_digest
    )
      throw new Error(
        "Finish and save the owner-scoped website learning and prediction step before this reviewed changed-input recheck.",
      );
    const approved = await vscode.window.showInformationMessage(
      "Run the 2 reviewed changed-input cases from the same pinned project test file? They are NOT secret/unseen or proof of independence/mastery. The website verifies owner/session and learning prerequisites before accepting a recovery receipt. No unrelated module/test imports run.",
      { modal: true },
      "Run reviewed changed-input cases",
    );
    if (
      approved !== "Run reviewed changed-input cases" ||
      this.connection !== connection
    )
      return;
    const quote = (v: string) =>
      process.platform === "win32"
        ? '"' + v.replace(/"/g, "") + '"'
        : "'" + v.replace(/'/g, "'\\''") + "'";
    const command =
      (process.platform === "win32" ? "py -3" : "python3") +
      " -I " +
      quote(this.context.asAbsolutePath("media/python_literal_repair.py")) +
      " --recheck " +
      quote(context.inspected_files[0]) +
      " " +
      quote(contract.function_name) +
      " " +
      quote(context.test_path) +
      " " +
      quote(context.test_digest) +
      " " +
      quote(contract.arguments.join(",")) +
      " " +
      quote(contract.cases_digest) +
      " " +
      quote(partition.partition_digest);
    const result = await this.runCommand(command, root.fsPath, 10000);
    if (result.cancelled || this.connection !== connection) return;
    if (result.code === 3) {
      this.status(
        "Recheck blocked, no recovery evidence recorded: " + result.output,
        true,
      );
      return;
    }
    if (result.code !== 0 && result.code !== 1)
      throw new Error("Recheck execution unavailable. No evidence recorded.");
    const response = await this.api.projectRecheck(connection.sessionId, {
      source_session_id: connection.sessionId,
      evaluator_id: session.challenge_id,
      partition_digest: partition.partition_digest,
      passed: result.passed,
      output: result.output,
    });
    if (this.connection !== connection) return;
    if (response.state) {
      this.session = response.state;
      this.post({ type: "session", session: this.session });
    }
    this.status(
      "Changed-input result returned to the owner-scoped website recovery gate. This alone does not establish conquest, unseen transfer or mastery.",
    );
  }
  private async sendDiagnostics() {
    if (!this.session || !this.connection) return;
    const diagnostics = vscode.languages
      .getDiagnostics()
      .filter(
        ([uri, items]) =>
          this.isInActiveWorkspace(uri) &&
          safeEvidencePath(vscode.workspace.asRelativePath(uri, false)) &&
          items.some(
            (item) => item.severity === vscode.DiagnosticSeverity.Error,
          ),
      )
      .slice(0, 5)
      .map(([uri, items]) => ({
        file: vscode.workspace.asRelativePath(uri, false).slice(0, 180),
        diagnostics: items
          .filter((item) => item.severity === vscode.DiagnosticSeverity.Error)
          .slice(0, 5)
          .map((item) => ({
            message: String(item.message).slice(0, 300),
            line: item.range.start.line + 1,
          })),
      }));
    if (!diagnostics.length) return;
    await this.api
      .event(this.connection.sessionId, "compiler_error", {
        diagnostics,
        error: diagnostics
          .map((item) =>
            item.diagnostics.map((diagnostic) => diagnostic.message).join("; "),
          )
          .join(" | "),
      })
      .catch(() => {});
  }
  private async showCompletedPractice(): Promise<boolean> {
    const session = this.session;
    if (
      !session ||
      !isPracticeTask(session.challenge_id) ||
      session.status !== "completed"
    )
      return false;
    this.results.update(
      session,
      session.checkpoints
        ?.map((item) => item.lastOutput || "")
        .filter(Boolean)
        .join("\n") ||
        "This practice task is already complete. Your recorded result is unchanged.",
    );
    this.status(
      "Practice complete. Your result is saved. Choose another question on the website.",
    );
    await this.results.show();
    return true;
  }
  private pendingResult?: { fingerprint: string; key: string };
  private async test() {
    if (!this.session || !this.connection) return;
    if (await this.showCompletedPractice()) return;
    if (this.session.challenge_id === "project-context-pending")
      return this.status(
        "No coding task yet. Choose a task on the website first.",
      );
    const connection = this.connection,
      challenge = this.session.challenge_id,
      generation = this.session.task_generation ?? 0;
    const sameTask = () =>
      this.connection === connection &&
      this.session?.challenge_id === challenge &&
      (this.session?.task_generation ?? 0) === generation;
    const practice = isPracticeTask(this.session.challenge_id);
    const activeDocument = practice
      ? vscode.window.activeTextEditor?.document
      : undefined;
    const folder =
      practice && activeDocument?.uri.scheme === "file"
        ? path.dirname(activeDocument.uri.fsPath)
        : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (
      practice &&
      (!activeDocument ||
        activeDocument.uri.scheme !== "file" ||
        !activeDocument.uri.fsPath.endsWith(".py"))
    )
      return this.status(
        "Open your saved Python file, then run tests. No attempt recorded.",
      );
    if (!folder)
      throw new Error("Open the challenge workspace before running tests.");
    const plan = await this.api.runPlan(
      this.connection.sessionId,
      process.platform,
    );
    if (!sameTask()) return;
    this.post({
      type: "status",
      text:
        plan.run_plan?.guidance ||
        "BuildMyLogic is checking the next checkpoint locally.",
    });
    const checkpointResults = await this.runNextCheckpoint(
      folder,
      plan.run_plan?.command || "",
      activeDocument,
    );
    if (!checkpointResults.length) return;
    if (!sameTask() || this.session?.session_id !== connection.sessionId)
      return this.status(
        "Session changed. Local output was not sent to another session.",
        true,
      );
    const passed = checkpointResults.filter((item) => item.passed).length;
    const total = checkpointResults.length;
    const latest = checkpointResults[checkpointResults.length - 1];
    const resultBody = {
      status: latest?.passed ? "passed" : "failed",
      passed,
      total,
      score: passed,
      error: latest?.passed ? "" : latest?.output,
      stdout: latest?.output,
      checkpoint_results: checkpointResults,
      task_generation: generation,
    };
    // One key per submission. A failed send (error, timeout, lost reply) keeps its
    // key, so retrying the SAME result is recognised by the server and never counts
    // twice. A new click with different output gets a new key and always counts.
    const fingerprint = JSON.stringify([
      connection.sessionId,
      generation,
      resultBody,
    ]);
    const pending = this.pendingResult;
    const clientEventId =
      pending && pending.fingerprint === fingerprint
        ? pending.key
        : randomUUID();
    this.pendingResult = { fingerprint, key: clientEventId };
    const r = await this.api.test(connection.sessionId, {
      ...resultBody,
      attempt: this.session.attempts + 1,
      client_event_id: clientEventId,
    });
    this.pendingResult = undefined;
    if (!sameTask()) return;
    this.session = r.state || this.session;
    if (
      this.session.challenge_id !== challenge ||
      (this.session.task_generation ?? 0) !== generation
    ) {
      this.results.update(this.session);
      this.post({ type: "session", session: this.session });
      this.status(
        "Three wrong attempts. Switched to beginner arithmetic. Earlier question and attempts stay in history.",
      );
      return;
    }
    if (this.session.status === "completed") {
      this.clearEvidenceSubscriptions();
      this.post({
        type: "status",
        text: "Challenge proven. Live sync keeps running so the website can send follow-ups.",
        error: false,
      });
    }
    this.results.update(this.session, latest?.output || "No command output.");
    await this.results.show();
    this.post({
      type: "tests",
      passed: Boolean(latest?.passed && latest?.evidence_kind === "assertion"),
      output: latest?.output || "No command output.",
      guidance: plan.run_plan?.guidance,
      session: this.session,
    });
  }

  private async runNextCheckpoint(
    folder: string,
    runCommand: string,
    selectedDocument?: vscode.TextDocument,
  ) {
    if (!this.session)
      return [] as Array<{
        index: number;
        passed: boolean;
        output: string;
        evidence_kind: string;
      }>;
    const checkpoints: NonNullable<RemoteSession["checkpoints"]> = this.session
      .checkpoints?.length
      ? this.session.checkpoints
      : [
          {
            index: 0,
            title: "Run the project",
            detail: "Run the project locally.",
            status: "active" as const,
            attempts: 0,
          },
        ];
    const checkpoint =
      checkpoints.find((item) => item.status !== "passed") ||
      checkpoints[checkpoints.length - 1];
    if (checkpoint.evaluator) runCommand = checkpoint.evaluator.command;
    if (
      runCommand.startsWith("buildmylogic:") &&
      !isPracticeTask(runCommand.slice("buildmylogic:".length)) &&
      ![
        "buildmylogic:python-literal-repair-v1",
        "buildmylogic:python-decimal-contract",
      ].includes(runCommand)
    )
      return (this.status("Unsupported local task. No attempt recorded."), []);
    const text = `${checkpoint.title} ${checkpoint.detail}`.toLowerCase();
    let result: { passed: boolean; output: string; cancelled?: boolean };
    if (
      isPracticeTask(
        checkpoint.evaluator?.command.replace(/^buildmylogic:/, ""),
      ) &&
      checkpoint.evaluator?.command.startsWith("buildmylogic:")
    ) {
      const connection = this.connection;
      const taskId = checkpoint.evaluator!.command.slice(
        "buildmylogic:".length,
      );
      const task = practiceTaskDetails[taskId];
      if (
        this.session.challenge_id !== taskId ||
        checkpoint.evaluator!.id !== taskId ||
        JSON.stringify(checkpoint.evaluator!.expectedOutputIncludes) !==
          JSON.stringify(["BML_PRACTICE_PASS:" + taskId])
      )
        return (
          this.status("Task and tests do not match. No attempt recorded."),
          []
        );
      const doc = selectedDocument || vscode.window.activeTextEditor?.document;
      if (!doc || doc.uri.scheme !== "file" || !doc.uri.fsPath.endsWith(".py"))
        return (
          this.status("Open your saved Python file. No attempt recorded."),
          []
        );
      const version = doc.version;
      const unchanged = () =>
        vscode.window.activeTextEditor?.document === doc &&
        doc.version === version &&
        !doc.isClosed &&
        this.connection === connection;
      const yes = await vscode.window.showWarningMessage(
        `Run ${doc.uri.fsPath} on your computer for this practice task? It can read or change files and use the network. This is not a sandbox. Task: ${task.title} (${taskId}). ${task.cases} fixed ${task.cases === 1 ? "case" : "cases"}; input cases: ${task.inputs}. Nothing is read until you agree.`,
        { modal: true },
        "Run my Python code",
      );
      if (yes !== "Run my Python code" || !unchanged()) return [];
      if (doc.isDirty && !(await doc.save()))
        return (this.status("Save cancelled. No attempt recorded."), []);
      if (!unchanged())
        return (
          this.status("File changed. Run tests again. No attempt recorded."),
          []
        );
      const quote = (v: string) =>
        process.platform === "win32"
          ? '"' + v.replace(/"/g, "") + '"'
          : "'" + v.replace(/'/g, "'\\''") + "'";
      const evaluation = await this.runCommand(
        (process.platform === "win32" ? "py -3" : "python3") +
          " -I " +
          quote(this.context.asAbsolutePath("media/python_loops_practice.py")) +
          " " +
          quote(checkpoint.evaluator!.command.slice("buildmylogic:".length)) +
          " " +
          quote(doc.uri.fsPath),
        path.dirname(doc.uri.fsPath),
        18000,
        () => unchanged() && !doc.isDirty,
      );
      if (
        evaluation.cancelled ||
        evaluation.code === 3 ||
        /not found|not recognized|No Python|was not found/i.test(
          evaluation.output,
        )
      ) {
        this.status("Check blocked. No attempt recorded. " + evaluation.output);
        return [];
      }
      if (!unchanged() || doc.isDirty)
        return (
          this.status("File changed during the run. No attempt recorded."),
          []
        );
      result = evaluation;
    } else if (
      checkpoint.evaluator?.command === "buildmylogic:python-literal-repair-v1"
    ) {
      const context = this.session.project_context,
        contract = context?.repair_contract;
      const relative = context?.inspected_files[0];
      if (
        !context?.test_path ||
        !context.test_digest ||
        !relative ||
        !contract ||
        contract.version !== 1 ||
        !safeEvidencePath(relative) ||
        !safeEvidencePath(context.test_path)
      )
        throw new Error(
          "Literal repair provenance unavailable. Start a newly inspected session.",
        );
      const quote = (v: string) =>
        process.platform === "win32"
          ? '"' + v.replace(/"/g, "") + '"'
          : "'" + v.replace(/'/g, "'\\''") + "'";
      runCommand =
        (process.platform === "win32" ? "py -3" : "python3") +
        " -I " +
        quote(this.context.asAbsolutePath("media/python_literal_repair.py")) +
        " " +
        quote(relative) +
        " " +
        quote(contract.function_name) +
        " " +
        quote(context.test_path) +
        " " +
        quote(context.test_digest) +
        " " +
        quote(contract.arguments.join(",")) +
        " " +
        quote(contract.cases_digest) +
        (contract.partition
          ? " " + quote(contract.partition.partition_digest)
          : "");
      const evaluation = await this.runCommand(runCommand, folder, 10000);
      if (evaluation.code === 3) {
        this.status(
          "Evaluation blocked, no attempt recorded: " + evaluation.output,
          true,
        );
        return [];
      }
      result = evaluation;
    } else if (
      checkpoint.evaluator?.command === "buildmylogic:python-decimal-contract"
    ) {
      const context = this.session.project_context;
      const relative = context?.inspected_files[0];
      const fn = /function ([A-Za-z_][A-Za-z_0-9]*) in /.exec(
        context?.summary || "",
      )?.[1];
      if (!relative || !fn || !safeEvidencePath(relative))
        throw new Error(
          "Project evaluator provenance is unavailable. Start a new inspected session.",
        );
      const evaluator = this.context.asAbsolutePath(
        "media/python_decimal_contract.py",
      );
      const quote = (value: string) =>
        process.platform === "win32"
          ? '"' + value.replace(/"/g, "") + '"'
          : "'" + value.replace(/'/g, "'\\''") + "'";
      runCommand =
        (process.platform === "win32" ? "py -3" : "python3") +
        " -I " +
        quote(evaluator) +
        " " +
        quote(relative) +
        " " +
        quote(fn) +
        (context?.test_path && context.test_digest
          ? " " + quote(context.test_path) + " " + quote(context.test_digest)
          : "");
      const evaluation = await this.runCommand(runCommand, folder, 10000);
      if (evaluation.code === 3) {
        this.status(
          "Evaluation blocked, no attempt recorded: " + evaluation.output,
          true,
        );
        return [];
      }
      result = evaluation;
    } else if (checkpoint.evaluator) {
      result = await this.runCommand(runCommand, folder, 60000);
    } else if (
      this.session.language.toLowerCase().includes("python") &&
      text.includes("python") &&
      text.includes("venv")
    ) {
      const version = await this.runCommand(
        process.platform === "win32" ? "py -3 --version" : "python3 --version",
        folder,
        15000,
      );
      if (version.cancelled) {
        this.status(version.output);
        return [];
      }
      const venv = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0]!.uri,
        "venv",
      );
      let venvExists = false;
      try {
        await vscode.workspace.fs.stat(venv);
        venvExists = true;
      } catch {
        /* checkpoint reports the missing folder */
      }
      result = {
        passed: version.code === 0 && venvExists,
        output: `${version.output}\n${venvExists ? "venv found." : "venv is missing. Create it with: " + (process.platform === "win32" ? "py -3 -m venv venv" : "python3 -m venv venv")}`,
      };
    } else if (
      this.session.language.toLowerCase().includes("python") &&
      (text.includes("fastapi") ||
        text.includes("jinja2") ||
        text.includes("pip install"))
    ) {
      const python =
        process.platform === "win32"
          ? "venv\\Scripts\\python.exe"
          : "venv/bin/python";
      result = await this.runCommand(
        `${python} -c "import fastapi, uvicorn, jinja2; print('FastAPI, Uvicorn and Jinja2 are installed.')"`,
        folder,
        20000,
      );
    } else if (
      text.includes("templates") ||
      text.includes("static") ||
      text.includes("project directory") ||
      text.includes("folder structure")
    ) {
      const root = vscode.workspace.workspaceFolders![0]!.uri;
      const names = ["blog_api", "blog_api/templates", "blog_api/static"];
      const missing: string[] = [];
      for (const name of names) {
        try {
          await vscode.workspace.fs.stat(
            vscode.Uri.joinPath(root, ...name.split("/")),
          );
        } catch {
          missing.push(name);
        }
      }
      result = {
        passed: missing.length === 0,
        output: missing.length
          ? `Missing required folders: ${missing.join(", ")}`
          : "blog_api, templates and static folders are present.",
      };
    } else {
      result = await this.runCommand(
        runCommand,
        folder,
        runCommand.includes("uvicorn") ? 12000 : 60000,
      );
    }
    if (result.cancelled) {
      this.status(result.output);
      return [];
    }
    const assertion =
      result.passed &&
      Boolean(checkpoint.evaluator?.expectedOutputIncludes.length) &&
      checkpoint.evaluator!.expectedOutputIncludes.every((expected) =>
        result.output.includes(expected),
      );
    if (result.passed && !assertion)
      this.status(
        "Execution succeeded, but no checkpoint-specific evaluator proved these requirements. Progress remains detected, not completed.",
      );
    return [
      {
        index: checkpoint.index,
        passed: result.passed,
        output: result.output,
        evaluator_id: checkpoint.evaluator?.id,
        evidence_kind: assertion ? "assertion" : "execution",
      },
    ];
  }

  private async runCommand(
    command: string,
    cwd: string,
    timeoutMs: number,
    validate?: () => boolean,
  ): Promise<{
    code: number;
    passed: boolean;
    output: string;
    cancelled?: boolean;
  }> {
    if (!vscode.workspace.isTrusted)
      return {
        code: 1,
        passed: false,
        cancelled: true,
        output:
          "Trust this workspace before running local commands. No test was recorded.",
      };
    const approval = await vscode.window.showWarningMessage(
      `Run this command locally in ${cwd}?\n${command}`,
      { modal: true },
      "Run command",
    );
    if (approval !== "Run command" || (validate && !validate()))
      return {
        code: 1,
        passed: false,
        cancelled: true,
        output: "Command cancelled. No test was run or recorded.",
      };
    const outputChannel =
      vscode.window.createOutputChannel("BuildMyLogic Tests");
    outputChannel.show(true);
    outputChannel.appendLine(`$ ${command}`);
    return executeLocalCommand(command, cwd, timeoutMs, (text) =>
      outputChannel.append(text),
    );
  }

  private async submitProject() {
    if (!this.connection) return;
    if (await this.showCompletedPractice()) return;
    // Standalone practice is graded by the same real local evaluator as Run
    // Tests. Project source review cannot refresh a practice test result.
    if (this.session && isPracticeTask(this.session.challenge_id))
      return this.test();
    if (this.session?.challenge_id === "project-context-pending")
      return this.status(
        "No coding task yet. Choose a task on the website first.",
      );
    const connection = this.connection,
      generation = this.session?.task_generation ?? 0,
      challenge = this.session?.challenge_id;
    const sameTask = () =>
      this.connection === connection &&
      this.session?.challenge_id === challenge &&
      (this.session?.task_generation ?? 0) === generation;
    if (!vscode.workspace.isTrusted)
      throw new Error("Trust this workspace before submitting files.");
    const consent = await vscode.window.showWarningMessage(
      "Submit project source files to BuildMyLogic and its AI review service? Do not include private data or secrets.",
      { modal: true },
      "Submit source",
    );
    if (consent !== "Submit source" || !sameTask()) return;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) throw new Error("Open the project folder before submitting it.");
    const excluded =
      "{**/node_modules/**,**/.git/**,**/venv/**,**/.venv/**,**/__pycache__/**,**/dist/**,**/build/**,**/.env,**/.env.*,**/*.pem,**/*.key,**/.npmrc,**/.pypirc,**/.ssh/**,**/credentials*,**/secrets*}";
    const files: Array<{ path: string; content: string }> = [];
    let bytes = 0;
    for (const uri of await vscode.workspace.findFiles("**/*", excluded, 250)) {
      if (files.length >= 250 || bytes >= 8 * 1024 * 1024) break;
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        if (raw.includes(0)) continue;
        const content = Buffer.from(raw).toString("utf8");
        if (!content.trim()) continue;
        files.push({
          path: vscode.workspace.asRelativePath(uri, false),
          content: content.slice(0, 250000),
        });
        bytes += content.length;
      } catch {
        /* Ignore unreadable binary files. */
      }
    }
    if (!sameTask()) return;
    const result = await this.api.submit(
      connection.sessionId,
      files,
      generation,
    );
    if (!sameTask()) return;
    this.session = result.state || this.session;
    const review = result.review as
      | {
          score?: number;
          verdict?: string;
          strengths?: string[];
          issues?: string[];
          nextSteps?: string[];
        }
      | undefined;
    this.post({
      type: "submission",
      session: this.session,
      review,
      text: `${review?.verdict || "Project submitted for BuildMyLogic review."}\n\nFiles reviewed: ${files.length}`,
    });
  }
  private status(text: string, error = false) {
    this.post({ type: "status", text, error });
  }
  private post(message: unknown) {
    const m = message as { session?: RemoteSession };
    if (m.session) {
      this.results.update(m.session);
    }
    void this.view?.webview.postMessage(message);
  }
}
function valid(v: unknown): v is Message {
  return (
    !!v &&
    typeof v === "object" &&
    [
      "ready",
      "connect",
      "pair",
      "runTests",
      "submit",
      "failed",
      "disconnect",
    ].includes(String((v as Message).command))
  );
}
export function activate(context: vscode.ExtensionContext) {
  const config = loadAppConfig();
  const results = new ResultsPanel();
  const sidebar = new Sidebar(
    new SessionClient(config.apiBaseUrl),
    results,
    context,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(RESULTS_VIEW_ID, results),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("buildmylogic.sessionChat", () =>
      sidebar.focusSessionChat(),
    ),
  );
  const connectSession = (connect: SessionConnect) =>
    sidebar.connectFromUri(
      vscode.Uri.parse(
        `vscode://buildmylogic.buildmylogic/connect?sessionId=${encodeURIComponent(connect.sessionId)}&apiBaseUrl=${encodeURIComponent(connect.apiBaseUrl)}`,
      ),
    );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(viewId, sidebar),
  );
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri: (uri) => {
        void sidebar.connectFromUri(uri);
      },
    }),
  );
  // Local desktop bridge: lets the BuildMyLogic website pick a project folder
  // and open it here without any dev server running.
  context.subscriptions.push(
    startBridge(context, {
      extensionVersion: String(context.extension?.packageJSON?.version || ""),
      connectSession: (connect) => connectSession(connect),
    }),
  );
  // A folder opened from the website reloads this window; finish its pending
  // session connect here.
  void consumeStagedSession(context).then((staged) => {
    if (staged) void connectSession(staged);
  });
}
export function deactivate() {}

/** Pure path policy shared by passive evidence and tests. */
export function safeEvidencePath(relative: string): boolean {
  return !/(^|[\\/])(?:\.env(?:\.|$)|\.git|node_modules|\.ssh|venv|\.venv)(?:[\\/]|$)|(?:secret|credential|\.pem$|\.key$|\.npmrc$|\.pypirc$)/i.test(
    relative,
  );
}
