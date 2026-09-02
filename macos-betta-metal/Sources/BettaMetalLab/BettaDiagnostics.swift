import AppKit
import Foundation
import Metal
import Darwin

final class BettaDiagnostics {
    static let shared = BettaDiagnostics()

    private struct PersistedState: Codable {
        var sessionID: String
        var startedAt: String
        var lastStage: String
        var completed: Bool
        var log: [String]
    }

    private let queue = DispatchQueue(label: "com.sindhornmidtown.BettaMetalLab.diagnostics")
    private let iso = ISO8601DateFormatter()
    private let endpoint = URL(string: "https://sjpvhgxacsiorrtijqua.supabase.co/functions/v1/betta-bug-report")!
    private let installKey = "sindhorn-betta-metal:diagnostics-install-id:v1"

    private(set) var sessionID = UUID().uuidString
    private(set) var failureStage: String?
    private(set) var errorText: String?
    private var lines: [String] = []
    private var startedAt = Date()
    private var previousIncomplete: PersistedState?

    private init() {
        previousIncomplete = loadPersisted().flatMap { $0.completed ? nil : $0 }
    }

    func begin() {
        queue.sync {
            sessionID = UUID().uuidString
            startedAt = Date()
            failureStage = nil
            errorText = nil
            lines.removeAll(keepingCapacity: true)
            appendLocked("diagnostics.begin")
            persistLocked(stage: "diagnostics.begin", completed: false)
        }
    }

    func checkpoint(_ stage: String, detail: String? = nil) {
        queue.sync {
            let suffix = detail.flatMap { $0.isEmpty ? nil : " — \($0)" } ?? ""
            appendLocked("\(stage)\(suffix)")
            persistLocked(stage: stage, completed: false)
        }
    }

    func fail(stage: String, error: Error) {
        queue.sync {
            failureStage = stage
            errorText = error.localizedDescription
            appendLocked("FAIL \(stage) — \(error.localizedDescription)")
            persistLocked(stage: stage, completed: false)
        }
    }

    func markStartupComplete() {
        queue.sync {
            appendLocked("startup.complete")
            persistLocked(stage: "startup.complete", completed: true)
        }
    }

    func reportText() -> String {
        queue.sync { makeReportTextLocked() }
    }

    func saveReport(to url: URL) throws {
        try reportText().write(to: url, atomically: true, encoding: .utf8)
    }

    func send(userNote: String?, completion: @escaping (Result<String, Error>) -> Void) {
        let payload: [String: Any] = queue.sync { makePayloadLocked(userNote: userNote) }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("macos-lab-v1", forHTTPHeaderField: "X-Betta-Reporter")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])
        } catch {
            completion(.failure(error))
            return
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error {
                DispatchQueue.main.async { completion(.failure(error)) }
                return
            }
            guard let http = response as? HTTPURLResponse else {
                DispatchQueue.main.async { completion(.failure(NSError(domain: "BettaDiagnostics", code: 1, userInfo: [NSLocalizedDescriptionKey: "No HTTP response from bug-report server."]))) }
                return
            }
            guard let data,
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                DispatchQueue.main.async { completion(.failure(NSError(domain: "BettaDiagnostics", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "Bug-report server returned an unreadable response (HTTP \(http.statusCode))."]))) }
                return
            }
            if http.statusCode >= 200 && http.statusCode < 300,
               object["ok"] as? Bool == true,
               let reportID = object["report_id"] as? String {
                DispatchQueue.main.async { completion(.success(reportID)) }
            } else {
                let message = (object["error"] as? String) ?? "HTTP \(http.statusCode)"
                DispatchQueue.main.async { completion(.failure(NSError(domain: "BettaDiagnostics", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "Bug report was not accepted: \(message)"]))) }
            }
        }.resume()
    }

    private func makePayloadLocked(userNote: String?) -> [String: Any] {
        let info = Bundle.main.infoDictionary ?? [:]
        return [
            "install_id": installID(),
            "app_version": info["CFBundleShortVersionString"] as? String ?? "unknown",
            "app_build": info["CFBundleVersion"] as? String ?? "unknown",
            "git_sha": info["BettaGitSHA"] as? String ?? "unknown",
            "failure_stage": failureStage ?? "none",
            "error_text": errorText ?? "",
            "os_version": ProcessInfo.processInfo.operatingSystemVersionString,
            "hardware_model": hardwareModel(),
            "metal_device": MTLCreateSystemDefaultDevice()?.name ?? "unavailable",
            "screen_info": screenInfo(),
            "launch_args": Array(CommandLine.arguments.dropFirst().prefix(32)),
            "diagnostics": diagnosticsObjectLocked(),
            "report_text": makeReportTextLocked(),
            "user_note": userNote ?? ""
        ]
    }

    private func diagnosticsObjectLocked() -> [String: Any] {
        var object: [String: Any] = [
            "session_id": sessionID,
            "started_at": iso.string(from: startedAt),
            "log": lines,
            "report_generated_at": iso.string(from: Date())
        ]
        if let previousIncomplete {
            object["previous_incomplete_launch"] = [
                "session_id": previousIncomplete.sessionID,
                "started_at": previousIncomplete.startedAt,
                "last_stage": previousIncomplete.lastStage,
                "log": previousIncomplete.log
            ]
        }
        return object
    }

    private func makeReportTextLocked() -> String {
        let info = Bundle.main.infoDictionary ?? [:]
        var out: [String] = []
        out.append("Sindhorn Betta Metal Lab — Diagnostic Report")
        out.append("Generated: \(iso.string(from: Date()))")
        out.append("Session: \(sessionID)")
        out.append("App: \(info["CFBundleShortVersionString"] as? String ?? "unknown") (\(info["CFBundleVersion"] as? String ?? "unknown"))")
        out.append("Git SHA: \(info["BettaGitSHA"] as? String ?? "unknown")")
        out.append("macOS: \(ProcessInfo.processInfo.operatingSystemVersionString)")
        out.append("Hardware: \(hardwareModel())")
        out.append("Metal: \(MTLCreateSystemDefaultDevice()?.name ?? "unavailable")")
        out.append("Failure stage: \(failureStage ?? "none")")
        if let errorText, !errorText.isEmpty { out.append("Error: \(errorText)") }
        out.append("")
        out.append("Startup log:")
        out.append(contentsOf: lines)
        if let previousIncomplete {
            out.append("")
            out.append("Previous incomplete launch:")
            out.append("Session: \(previousIncomplete.sessionID)")
            out.append("Started: \(previousIncomplete.startedAt)")
            out.append("Last stage: \(previousIncomplete.lastStage)")
            out.append(contentsOf: previousIncomplete.log)
        }
        out.append("")
        out.append("Privacy: this report contains app/runtime diagnostics only; it does not collect username, hostname, serial number, files, or document contents.")
        return out.joined(separator: "\n")
    }

    private func appendLocked(_ message: String) {
        lines.append("[\(iso.string(from: Date()))] \(message)")
        if lines.count > 240 { lines.removeFirst(lines.count - 240) }
    }

    private func installID() -> String {
        if let existing = UserDefaults.standard.string(forKey: installKey), !existing.isEmpty { return existing }
        let fresh = UUID().uuidString
        UserDefaults.standard.set(fresh, forKey: installKey)
        return fresh
    }

    private func diagnosticsURL() -> URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let directory = base.appendingPathComponent("Sindhorn Betta Metal Lab", isDirectory: true).appendingPathComponent("Diagnostics", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("last-startup.json")
    }

    private func persistLocked(stage: String, completed: Bool) {
        guard let url = diagnosticsURL() else { return }
        let state = PersistedState(
            sessionID: sessionID,
            startedAt: iso.string(from: startedAt),
            lastStage: stage,
            completed: completed,
            log: lines
        )
        guard let data = try? JSONEncoder().encode(state) else { return }
        try? data.write(to: url, options: .atomic)
    }

    private func loadPersisted() -> PersistedState? {
        guard let url = diagnosticsURL(), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(PersistedState.self, from: data)
    }

    private func screenInfo() -> [[String: Any]] {
        NSScreen.screens.enumerated().map { index, screen in
            [
                "index": index,
                "frame_width": Int(screen.frame.width),
                "frame_height": Int(screen.frame.height),
                "visible_width": Int(screen.visibleFrame.width),
                "visible_height": Int(screen.visibleFrame.height),
                "scale": screen.backingScaleFactor
            ]
        }
    }

    private func hardwareModel() -> String {
        var size: size_t = 0
        guard sysctlbyname("hw.model", nil, &size, nil, 0) == 0, size > 0 else { return "unknown" }
        var buffer = [CChar](repeating: 0, count: size)
        guard sysctlbyname("hw.model", &buffer, &size, nil, 0) == 0 else { return "unknown" }
        return String(cString: buffer)
    }
}
