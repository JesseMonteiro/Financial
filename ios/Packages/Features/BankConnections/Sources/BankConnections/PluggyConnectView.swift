import SwiftUI

#if os(iOS)
import WebKit

struct PluggyConnectView: UIViewRepresentable {
    let connectToken: String
    let onFinished: (String?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onFinished: onFinished)
    }

    func makeUIView(context: Context) -> WKWebView {
        let content = WKUserContentController()
        content.add(context.coordinator, name: "pluggy")
        let config = WKWebViewConfiguration()
        config.userContentController = content
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.loadHTMLString(html(token: connectToken), baseURL: URL(string: "https://cdn.pluggy.ai"))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let onFinished: (String?) -> Void
        private var didFinish = false

        init(onFinished: @escaping (String?) -> Void) {
            self.onFinished = onFinished
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "pluggy", let body = message.body as? [String: Any] else { return }
            let type = body["type"] as? String
            if type == "success" {
                finish(body["itemId"] as? String)
            } else if type == "close" || type == "error" {
                finish(nil)
            }
        }

        private func finish(_ itemId: String?) {
            guard !didFinish else { return }
            didFinish = true
            onFinished(itemId)
        }
    }

    private func html(token: String) -> String {
        let escaped = token.replacingOccurrences(of: "'", with: "\\'")
        return """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js"></script>
        </head>
        <body>
        <script>
          const pluggyConnect = new PluggyConnect({
            connectToken: '\(escaped)',
            includeSandbox: true,
            onSuccess: (itemData) => {
              const itemId = (itemData && itemData.item && itemData.item.id) || itemData.id || itemData.itemId || null;
              window.webkit.messageHandlers.pluggy.postMessage({ type: 'success', itemId: itemId });
            },
            onError: (error) => {
              window.webkit.messageHandlers.pluggy.postMessage({ type: 'error', message: String(error) });
            },
            onClose: () => {
              window.webkit.messageHandlers.pluggy.postMessage({ type: 'close' });
            }
          });
          pluggyConnect.init();
        </script>
        </body>
        </html>
        """
    }
}
#else
struct PluggyConnectView: View {
    let connectToken: String
    let onFinished: (String?) -> Void

    var body: some View {
        ContentUnavailableView(
            "Pluggy Connect",
            systemImage: "link",
            description: Text("Disponível apenas no iOS.")
        )
        .onAppear { onFinished(nil) }
    }
}
#endif

