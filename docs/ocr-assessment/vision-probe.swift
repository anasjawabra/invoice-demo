import Vision
import AppKit
let args = CommandLine.arguments
for path in args.dropFirst() {
  guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("cannot load \(path)"); continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["ar-SA", "en-US"]
  req.usesLanguageCorrection = true
  let h = VNImageRequestHandler(cgImage: cg, options: [:])
  do { try h.perform([req]) } catch { print("error \(error)"); continue }
  print("=== \(path) revision \(req.revision) supported: \((try? req.supportedRecognitionLanguages()) ?? [])")
  for o in (req.results ?? []) { if let c = o.topCandidates(1).first { print(String(format: "%.2f", c.confidence), c.string) } }
}
