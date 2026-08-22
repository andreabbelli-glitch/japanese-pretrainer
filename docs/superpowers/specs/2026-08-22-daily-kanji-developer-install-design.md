# Daily Kanji Developer Program Device Install Design

## Goal

Replace the seven-day Personal Team renewal system with the smallest reliable
physical-device workflow supported by the paid Apple Developer Program. Daily
Kanji must be installable and launchable on the registered iPhone over the
local network without a scheduled reinstall job, background retries, or
provisioning-cache manipulation.

Success means:

- app and widget are signed by Apple Developer team `F5U46464YH`;
- both embedded development profiles authorize the intended device and have
  more than 30 days of remaining validity;
- one synchronous command builds, validates, installs, and launches the app by
  cable or Wi-Fi;
- the Mac has no Daily Kanji renewal LaunchAgent, renewal state, lock, marker,
  or renewal log;
- the repository has no active script, test, command, or operational
  documentation for periodic renewal;
- private runtime configuration remains outside Git and is never printed.

## Verified Starting Point

The local Apple signing assets already demonstrate that the paid membership is
active:

- the installed Apple Development certificate belongs to team `F5U46464YH`
  and is valid until June 2027;
- Xcode-managed profiles for `dev.local.daily-kanji` and
  `dev.local.daily-kanji.widget` belong to the same team, include one device,
  and are valid until August 2027;
- the iPhone is paired with CoreDevice and can advertise local-network
  availability, although the control tunnel may be unavailable while the
  phone is locked or asleep;
- no Daily Kanji renewal LaunchAgent is currently loaded and no renewal log or
  state artifact remains outside the repository;
- `~/Library/Application Support/DailyKanji/device.env` remains present with
  mode `0600` and contains the required private device/runtime configuration.

Apple documents the seven-day profile lifetime as a Personal Team limitation.
The paid-program path uses a registered device, development certificate, and
development provisioning profile; automatic signing lets Xcode manage those
profiles.

## Chosen Approach

Use a paid-team development build with Xcode automatic signing, then install
the built `.app` through CoreDevice. This is preferred over:

- Ad Hoc export, which adds archive/export configuration and manual profile
  lifecycle without improving this single-user development workflow;
- TestFlight, which adds App Store Connect upload/review operations and a
  90-day build lifetime;
- App Store distribution, which is unrelated to a private local-first app;
- scheduled rebuilding, which only compensated for Personal Team's seven-day
  profiles and is no longer necessary.

The selected workflow still follows Apple's annual certificate, provisioning,
and membership lifecycle. It removes the seven-day reinstall requirement; it
does not claim that a development build remains valid forever.

## Canonical Workflow

The repository exposes one physical-device entry point:

```text
apps/daily-kanji-ios/scripts/install-device.sh
```

It performs exactly one foreground attempt:

```mermaid
flowchart LR
  CONFIG["Read protected device.env"] --> DEVICE["Resolve paired CoreDevice"]
  DEVICE --> CONNECT["Check connection and mount DDI"]
  CONNECT --> RESOURCES["Verify packaged resources"]
  RESOURCES --> PROJECT["Generate Xcode project"]
  PROJECT --> BUILD["Release build with automatic signing"]
  BUILD --> PROFILES["Validate app and widget profiles"]
  PROFILES --> SIGNATURE["Verify deep code signature"]
  SIGNATURE --> INSTALL["Install through CoreDevice"]
  INSTALL --> LAUNCH["Launch Daily Kanji"]
```

The build uses:

- scheme `DailyKanji`;
- configuration `Release`;
- team `F5U46464YH` from `project.yml`;
- `-allowProvisioningUpdates` and
  `-allowProvisioningDeviceRegistration`;
- the stable hardware UDID as the Xcode destination;
- a dedicated ignored Derived Data directory whose root is private (`0700`);
- an ephemeral `0600` xcconfig when private runtime values are configured.

The script does not schedule itself, daemonize, retry, restart Apple services,
or write operational state. A failed attempt exits non-zero with a direct
remediation message; a later manual invocation is the only retry.

## Signing and Provisioning Invariants

Before installation, the workflow must validate the built artifact rather than
trusting Xcode's successful exit alone.

Exactly two `embedded.mobileprovision` files must exist: one for the app and one
for the widget. For each profile, verify:

- `TeamIdentifier` is `F5U46464YH`;
- `application-identifier` is respectively
  `F5U46464YH.dev.local.daily-kanji` or
  `F5U46464YH.dev.local.daily-kanji.widget`;
- the registered hardware UDID is in `ProvisionedDevices`;
- `ExpirationDate` is at least 30 days in the future.

Then run a strict deep code-signature verification over the containing app.
These checks deliberately reject stale Personal Team profiles even if Xcode
could otherwise produce an installable artifact.

## Device and Wi-Fi Behavior

`DEVICE_ID` is the stable hardware UDID stored in `device.env`. CoreDevice may
use a different internal identifier, so the installer resolves both columns
from `devicectl`'s supported JSON output and uses:

- the CoreDevice identifier for `devicectl`;
- the hardware UDID for the Xcode destination and provisioning-profile
  membership checks.

Both USB and `localNetwork` transports are accepted. The installer checks the
device connection and Developer Disk Image before spending time on packaging
or building. If the wireless tunnel is unavailable, it asks for the iPhone to
be unlocked and on the same Wi-Fi; it does not revive services or enter a retry
loop.

## Private Configuration

The only retained local configuration is:

```text
~/Library/Application Support/DailyKanji/device.env
```

It may define:

- `DEVICE_ID`;
- the dataset sync endpoint/token pair;
- the mobile review endpoint/token pair;
- `DAILY_KANJI_ENABLE_APNS` when the capability is intentionally configured.

Endpoint/token pairs are all-or-nothing. Values containing newlines are
rejected. The generated xcconfig is temporary, mode `0600`, removed on exit,
and never printed. Secrets and local device identifiers remain unversioned and
are redacted from command output. Because the resulting app bundle may embed
private runtime values, the installer applies `umask 077` and keeps the entire
Derived Data tree behind an owner-only `0700` root. Private values inherited
from the caller environment are captured and then de-exported before any child
process runs; the temporary xcconfig is the only channel into the build.

Push Notifications remain opt-in. Buying the Developer Program does not by
itself authorize silently enabling APNs in an existing local configuration.
When enabled, the temporary xcconfig overrides an app-target-specific
entitlements setting; the widget always keeps its App Group-only entitlements
and never receives `aps-environment`.

## Complete Legacy Removal

Remove the former renewal implementation rather than keeping compatibility
wrappers or archived copies:

- `install-renew-launchd.sh`;
- `xcode-renew-if-needed.sh`;
- `xcode-renew.sh`;
- `coredevice-recovery.sh`;
- renewal LaunchAgent/profile-state/recovery tests;
- test-lane entries and documentation that describe scheduled renewal,
  profile-state snapshots, renewal windows, retry locks, service restarts, or
  unattended logs.

Remove any live Mac artifacts if present:

- `~/Library/LaunchAgents/dev.local.daily-kanji.renew.plist` and its loaded
  service;
- renewal-only files below
  `~/Library/Application Support/DailyKanji/`, while preserving `device.env`;
- `~/Library/Logs/DailyKanji/` renewal logs.

The current repository and runtime must contain no compatibility marker or
historical copy. Existing Git history is not rewritten: rewriting shared
`main` would be a separate destructive migration with no operational benefit.

## Error Handling

The installer fails early and clearly for:

- missing tools, device configuration, or paired device;
- unreachable/locked device or unavailable Developer Disk Image;
- incomplete endpoint/token pairs or invalid APNs flag;
- resource validation or Xcode project generation failure;
- account, signing, registration, or provisioning failure;
- wrong team, bundle ID, device list, profile count, or profile lifetime;
- invalid deep signature, install failure, or launch failure.

There is no automatic recovery budget because there is no background
orchestrator. The user fixes the concrete cause and reruns the same command.

## Verification

Automated verification must cover:

- configuration parsing without secret disclosure;
- owner-only permissions for private configuration and Derived Data;
- absence of device identifiers in user-facing output;
- stable-UDID to CoreDevice-ID resolution;
- cable/local-network acceptance and connectivity failures;
- one-shot ordering and fail-fast behavior;
- both embedded-profile paths and exact profile count;
- team, application identifier, device inclusion, and minimum validity checks;
- automatic-signing flags, Release configuration, install, and launch;
- absence of renewal scripts and renewal test-lane entries;
- existing iOS offline/resource contracts.

Required repository gates:

```sh
./scripts/with-node.sh pnpm test:ios-ops
./scripts/with-node.sh pnpm daily-kanji:test
./scripts/with-node.sh pnpm agent:check
```

Physical-device acceptance requires the iPhone to be unlocked and reachable
over the same Wi-Fi, followed by:

1. a successful canonical install command;
2. output proving both profiles pass the paid-team and lifetime checks;
3. successful CoreDevice install and process launch;
4. a read-back confirming `dev.local.daily-kanji` is installed;
5. no loaded renewal job or renewal-only runtime artifact.

Each implementation slice receives an independent reviewer pass before its
commit. The completed task is committed and pushed directly to `main`, per the
repository policy.

## Out of Scope

- rewriting Git history to erase old commits;
- App Store, Ad Hoc, enterprise, or TestFlight distribution;
- unattended rebuilds or certificate/profile renewal;
- automatic provisioning-cache deletion;
- changing app behavior, content, sync semantics, or review semantics;
- enabling APNs without an explicit local capability decision;
- promising operation beyond Apple membership, certificate, or profile
  validity.
