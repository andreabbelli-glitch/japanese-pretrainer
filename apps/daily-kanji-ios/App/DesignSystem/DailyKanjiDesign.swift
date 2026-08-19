import SwiftUI

enum DailyKanjiDesign {
    static let pageInset: CGFloat = 20
    static let sectionSpacing: CGFloat = 24
    static let surfaceRadius: CGFloat = 20
}

struct DailyKanjiCardSurface<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(
                RoundedRectangle(
                    cornerRadius: DailyKanjiDesign.surfaceRadius,
                    style: .continuous
                )
            )
            .overlay {
                RoundedRectangle(
                    cornerRadius: DailyKanjiDesign.surfaceRadius,
                    style: .continuous
                )
                .stroke(Color(.separator).opacity(0.22), lineWidth: 0.5)
            }
    }
}

struct DailyKanjiSettingsToolbarButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label("Impostazioni", systemImage: "gearshape")
                .labelStyle(.iconOnly)
                .frame(width: 44, height: 44)
        }
        .accessibilityLabel("Impostazioni")
        .accessibilityHint("Apre le impostazioni dell'app")
    }
}
