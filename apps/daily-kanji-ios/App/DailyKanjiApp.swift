import SwiftUI

@main
struct DailyKanjiApp: App {
    @UIApplicationDelegateAdaptor(DailyKanjiAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            DailyKanjiBootstrapView(scenePhase: scenePhase)
        }
    }
}

struct DailyKanjiSceneActivationGate {
    private var didActivateCurrentActivePhase = false

    mutating func shouldActivate(for phase: ScenePhase, isModelLoaded: Bool) -> Bool {
        guard phase == .active else {
            didActivateCurrentActivePhase = false
            return false
        }
        guard isModelLoaded, !didActivateCurrentActivePhase else {
            return false
        }

        didActivateCurrentActivePhase = true
        return true
    }
}

@MainActor
private struct DailyKanjiBootstrapView: View {
    let scenePhase: ScenePhase

    @State private var model: DailyKanjiAppModel?
    @State private var pendingDeepLink: URL?
    @State private var activationGate = DailyKanjiSceneActivationGate()

    var body: some View {
        Group {
            if let model {
                ContentView(model: model)
                    .task {
                        DailyKanjiPushTokenDispatcher.shared.onDeviceToken = { token in
                            model.registerDeviceToken(token)
                        }
                        activateIfNeeded(model, phase: scenePhase)
                    }
            } else {
                ProgressView("Caricamento Daily Kanji")
                    .task {
                        await loadModel()
                    }
            }
        }
        .onOpenURL { url in
            guard let model else {
                pendingDeepLink = url
                return
            }

            model.openDeepLink(url)
        }
        .onChange(of: scenePhase) { _, newPhase in
            activateIfNeeded(model, phase: newPhase)
        }
    }

    private func activateIfNeeded(_ model: DailyKanjiAppModel?, phase: ScenePhase) {
        if activationGate.shouldActivate(for: phase, isModelLoaded: model != nil) {
            model?.activate()
        }
    }

    private func loadModel() async {
        guard model == nil else {
            return
        }

        let repository = DailyKanjiRepository()
        let loadedAt = Date.now
        let snapshot = await repository.loadSnapshotAsync(now: loadedAt)
        guard !Task.isCancelled else {
            return
        }

        let loadedModel = DailyKanjiAppModel(
            repository: repository,
            initialRepositorySnapshot: snapshot,
            cacheWriter: repository.makeCacheWriter(),
            now: loadedAt
        )
        if let pendingDeepLink {
            loadedModel.openDeepLink(pendingDeepLink)
            self.pendingDeepLink = nil
        }
        model = loadedModel
    }
}
