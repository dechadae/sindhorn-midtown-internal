import Foundation

/// Verdicts, on the Mac, until the server has them.
///
/// The phone's store (betta-explorer/src/store.js) put the rule this way:
/// moving on IS a verdict, so both keys write a row. Rows go to the local CSV
/// first and to a queue that is drained to Supabase; a row leaves the queue
/// only when the server has accepted it, so a request that times out loses
/// nothing. A judgement is the expensive thing in this whole project - the
/// owner's attention - and is never discarded because the network was slow.
///
/// The same table the phone writes to, with the same columns, so one query
/// reads both surfaces and `device` tells them apart: `macos-metal/<build>`
/// against `android-webview/<build>`.
///
/// The publishable key is public by design: the table's RLS policy allows
/// insert only, so a copy of the key can add rows and cannot read them back.
struct VerdictRow: Codable {
    let seed: String
    let arm: String
    let framing: String
    let verdict: String
    let constitution: String
    let device: String
    let aspect: Double
    let session_id: String
    let judged_at: String
    /// "explorer" when the constitution drew the frame, "studio" when words
    /// asked for it. Test 04's arm comparison reads explorer rows only, so a
    /// studio keep can never be counted as evidence about the constitution.
    var source: String = "explorer"
    /// The style a studio verdict is about. Null for every explorer row.
    var style_id: String? = nil
}

final class VerdictStore {
    static let build = "1.0"
    static let device = "macos-metal/\(build)"

    static let urlBase = "https://ndzwypnjkhlpgxoqbiwx.supabase.co"
    static let key = "sb_publishable_ibFmzwWg_HR2ywkaj0RF2A_OvjfvuBY"
    private static let table = "betta_verdicts"

    private let log = ExplorerStorage.file("judgements.csv")
    /// Studio verdicts keep their own file. judgements.csv is a frozen
    /// experimental record and does not grow a new kind of row.
    private let studioLog = ExplorerStorage.file("studio.csv")
    private let queueFile = "queue.json"
    private(set) var judged = 0
    private(set) var kept = 0
    private var flushing = false
    /// The rows this sitting recorded, newest last, for undo and the title.
    private var sitting: [VerdictRow] = []

    let sessionId: String

    init() {
        let idFile = ExplorerStorage.file("session-id")
        if let id = try? String(contentsOf: idFile, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines),
           !id.isEmpty {
            sessionId = id
        } else {
            let id = UUID().uuidString.lowercased()
            try? id.write(to: idFile, atomically: true, encoding: .utf8)
            sessionId = id
        }
        // The lifetime tally comes from the CSV, so the title says what the
        // owner has actually done here rather than what happened since launch.
        if let text = try? String(contentsOf: log, encoding: .utf8) {
            for line in text.split(separator: "\n").dropFirst() {
                judged += 1
                if line.hasSuffix(",keep") || line.contains(",keep,") { kept += 1 }
            }
        }
    }

    var rate: Int { judged > 0 ? Int((Double(kept) / Double(judged) * 100).rounded()) : 0 }
    var pending: Int { readQueue().count }

    func record(frame: FrameRef, verdict: String, constitutionVersion: Int, aspect: Double) {
        let row = VerdictRow(
            seed: frame.seed, arm: "C", framing: frame.composition, verdict: verdict,
            constitution: "v\(constitutionVersion)", device: Self.device,
            aspect: (aspect * 10_000).rounded() / 10_000,
            session_id: sessionId, judged_at: ExplorerStorage.now(),
            source: frame.style == nil ? "explorer" : "studio",
            style_id: frame.style
        )
        appendCSV(row)
        var queue = readQueue()
        queue.append(row)
        writeQueue(queue)
        sitting.append(row)
        judged += 1
        if verdict == "keep" { kept += 1 }
        flush()
    }

    /// Removes the last verdict from the CSV, and from the queue if the server
    /// has not taken it yet. Undo is for the fumble a second ago; a row already
    /// accepted is corrected in analysis, not deleted by an app that cannot
    /// see the table.
    @discardableResult
    func undo() -> VerdictRow? {
        guard let last = sitting.popLast() else { return nil }
        if let text = try? String(contentsOf: log, encoding: .utf8) {
            var lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
            while let tail = lines.last, tail.isEmpty { lines.removeLast() }
            if lines.count > 1, lines.last?.hasPrefix("\(last.arm),\(last.seed),") == true {
                lines.removeLast()
                try? (lines.joined(separator: "\n") + "\n").write(to: log, atomically: true, encoding: .utf8)
            }
        }
        var queue = readQueue()
        if let i = queue.lastIndex(where: { $0.seed == last.seed && $0.judged_at == last.judged_at }) {
            queue.remove(at: i)
            writeQueue(queue)
        }
        judged -= 1
        if last.verdict == "keep" { kept -= 1 }
        return last
    }

    private func appendCSV(_ row: VerdictRow) {
        guard row.source == "explorer" else {
            let line = "\(row.style_id ?? ""),\(row.seed),\(row.framing),\(row.verdict),\(row.judged_at)\n"
            if let handle = try? FileHandle(forWritingTo: studioLog) {
                handle.seekToEndOfFile()
                handle.write(line.data(using: .utf8)!)
                try? handle.close()
            } else {
                try? ("style,seed,composition,verdict,at\n" + line)
                    .write(to: studioLog, atomically: true, encoding: .utf8)
            }
            return
        }
        let line = "\(row.arm),\(row.seed),\(row.framing),\(row.verdict),\(row.judged_at)\n"
        if let handle = try? FileHandle(forWritingTo: log) {
            handle.seekToEndOfFile()
            handle.write(line.data(using: .utf8)!)
            try? handle.close()
        } else {
            try? ("arm,seed,composition,verdict,at\n" + line).write(to: log, atomically: true, encoding: .utf8)
        }
    }

    private func readQueue() -> [VerdictRow] {
        ExplorerStorage.readJSON(queueFile, as: [VerdictRow].self) ?? []
    }

    private func writeQueue(_ rows: [VerdictRow]) {
        ExplorerStorage.writeJSON(rows, to: queueFile)
    }

    /// Told after every accepted send: rows sent, rows still queued.
    var onSent: ((Int, Int) -> Void)?

    /// Sends everything queued, oldest first, in one request. Clears only the
    /// rows it sent: anything queued while the request was in flight stays,
    /// and is sent by the next round, which starts as soon as this one lands.
    func flush(completion: ((Int, Int) -> Void)? = nil) {
        guard !flushing else { completion?(0, pending); return }
        let queue = readQueue()
        guard !queue.isEmpty,
              let url = URL(string: "\(Self.urlBase)/rest/v1/\(Self.table)"),
              let body = try? JSONEncoder().encode(queue) else { completion?(0, queue.count); return }
        flushing = true
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue(Self.key, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(Self.key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = body
        let sent = queue.count
        URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.flushing = false
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if error == nil, (200..<300).contains(status) {
                    let remaining = Array(self.readQueue().dropFirst(sent))
                    self.writeQueue(remaining)
                    self.onSent?(sent, remaining.count)
                    completion?(sent, remaining.count)
                    if !remaining.isEmpty { self.flush() }
                } else {
                    completion?(0, self.pending)
                }
            }
        }.resume()
    }
}
