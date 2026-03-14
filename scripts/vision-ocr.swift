import AppKit
import Foundation
import Vision

struct OcrLine: Codable {
    let confidence: Float
    let height: Double
    let text: String
    let width: Double
    let x: Double
    let y: Double
}

func recognize(path: String) throws -> [OcrLine] {
    guard let image = NSImage(contentsOfFile: path) else {
        throw NSError(domain: "VisionOcr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to load image"])
    }
    var rect = NSRect(origin: .zero, size: image.size)
    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw NSError(domain: "VisionOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to create CGImage"])
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    return observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else {
            return nil
        }
        let box = observation.boundingBox
        return OcrLine(
            confidence: candidate.confidence,
            height: box.height,
            text: candidate.string,
            width: box.width,
            x: box.origin.x,
            y: box.origin.y
        )
    }
}

var output: [String: [OcrLine]] = [:]
var failures: [String: String] = [:]

for path in CommandLine.arguments.dropFirst() {
    do {
        output[path] = try recognize(path: path)
    } catch {
        failures[path] = String(describing: error)
    }
}

let payload: [String: Any] = [
    "failures": failures,
    "pages": output.mapValues { lines in
        lines.map { line in
            [
                "confidence": line.confidence,
                "height": line.height,
                "text": line.text,
                "width": line.width,
                "x": line.x,
                "y": line.y
            ] as [String: Any]
        }
    }
]

let data = try JSONSerialization.data(withJSONObject: payload, options: [])
FileHandle.standardOutput.write(data)
