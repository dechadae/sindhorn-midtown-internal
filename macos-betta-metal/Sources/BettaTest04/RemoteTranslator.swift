import Foundation
import Security

/// The model, reached through the Edge Function that holds the key.
///
/// The Mac never sees the model key. It sends the sentence, the numbers on
/// screen and the glossary version to `betta-studio`, which holds the key,
/// caps the rate and returns a patch. The token that proves the request came
/// from the owner lives in the Keychain, never in a file beside the app.
///
/// Everything that comes back is checked before it is drawn:
///   - a key that is not a field is reported and not applied
///   - a value that is not a finite number is refused
///   - the contracts then judge the result, as they judge every style
/// Nothing retries itself. A model that returns nonsense says so on the rail,
/// which is rule two: stop rather than invent.
struct RemoteTranslator: Translator {
    let name = "studio"
    let endpoint: URL
    let token: String
    let glossaryVersion: Int
    /// Seconds to wait. A turn is a small request; a slow one is a failure.
    var timeout: TimeInterval = 30

    private struct Reply: Decodable {
        let patch: [String: Double]?
        let note: String?
        let error: String?
        /// Keys the function itself rejected, if it says.
        let unread: [String]?
    }

    func translate(prompt: String, style: GeneratedStyle) throws -> Turn {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(token, forHTTPHeaderField: "X-Studio-Token")

        var numbers: [String: Double] = [:]
        for (field, value) in Studio.values(of: style) { numbers[field] = value }
        let body: [String: Any] = [
            "prompt": prompt,
            "style": numbers,
            "parts": style.parts.map { [
                "primitive": $0.primitive.rawValue, "scale": $0.scale,
                "orbitRadius": $0.orbitRadius, "orbitAngleDeg": $0.orbitAngleDeg,
                "tiltDeg": $0.tiltDeg, "phaseOffset": $0.phaseOffset,
            ] },
            "glossary": glossaryVersion,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        // The room is a conversation: a turn is answered before the next one
        // is typed, so this waits rather than threading a callback through the
        // whole window. The timeout is the guard.
        let semaphore = DispatchSemaphore(value: 0)
        var data: Data?
        var response: URLResponse?
        var failure: Error?
        URLSession.shared.dataTask(with: request) {
            data = $0; response = $1; failure = $2
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + timeout + 5)

        if let failure {
            throw TranslationError.nothingUnderstood("The studio did not answer: \(failure.localizedDescription)")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard let data else {
            throw TranslationError.nothingUnderstood("The studio answered with nothing.")
        }
        let reply = try? JSONDecoder().decode(Reply.self, from: data)
        if status == 429 {
            throw TranslationError.nothingUnderstood("Too many turns too quickly — wait a moment.")
        }
        guard (200..<300).contains(status) else {
            throw TranslationError.nothingUnderstood(
                reply?.error ?? "The studio refused the request (\(status))."
            )
        }
        guard let reply else {
            throw TranslationError.nothingUnderstood("The studio's answer was not JSON.")
        }
        if let error = reply.error {
            throw TranslationError.nothingUnderstood(error)
        }
        guard let returned = reply.patch, !returned.isEmpty else {
            throw TranslationError.nothingUnderstood(reply.note ?? "The studio changed nothing.")
        }

        // Only fields this build knows, only finite numbers. A model is a
        // guest in the vocabulary, not an author of it.
        var patch: [String: Double] = [:]
        var unread: [String] = reply.unread ?? []
        for (key, value) in returned {
            guard Studio.fields[key] != nil else { unread.append(key); continue }
            guard value.isFinite else { unread.append("\(key) (not a number)"); continue }
            patch[key] = value
        }
        guard !patch.isEmpty else {
            throw TranslationError.nothingUnderstood(
                "The studio returned \(unread.count) field\(unread.count == 1 ? "" : "s") I don't have: \(unread.joined(separator: ", "))"
            )
        }
        return Turn(prompt: prompt, patch: patch,
                    note: reply.note ?? "\(patch.count) fields", unread: unread, source: name)
    }
}

/// The studio token, in the Keychain.
///
/// The publishable Supabase key ships inside the phone app by design - its
/// table policy is insert-only, so a copy of it can add rows and nothing
/// else. A paid endpoint cannot be guarded that way, so the studio has its own
/// token. It is a lock on the door, not a limit on the room.
enum StudioToken {
    private static let service = "com.sindhorn-midtown.betta-explorer.studio"
    private static let account = "studio-token"

    static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let text = String(data: data, encoding: .utf8),
              !text.isEmpty else { return nil }
        return text
    }

    @discardableResult
    static func write(_ token: String) -> Bool {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        guard !token.isEmpty else { return true }
        var add = base
        add[kSecValueData as String] = Data(token.utf8)
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    /// Where the function lives: the flipgazine project, which is where the
    /// Gemini key already is and where betta-bug-report already runs. The
    /// verdicts go to the other project; the studio never touches that one.
    static var endpoint: URL {
        URL(string: "https://sjpvhgxacsiorrtijqua.supabase.co/functions/v1/betta-studio")!
    }
}
