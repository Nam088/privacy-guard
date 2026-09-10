# Architecture & Protocol Interception

Privacy Guard uses a decoupled, event-driven defense-in-depth architecture to inspect, parse, and selectively suppress telemetry at the transport and runtime layer.

```mermaid
flowchart TD
    subgraph Browser["Client Browser Context"]
        DOM["DOM / Composer / Video Player"]
        Worker["Web Worker (Armadillo E2EE)"]
        WS["WebSocket (DGW: /ws/lightspeed, /ws/realtime)"]
        HTTP["HTTP Client (Fetch / XHR)"]
        WebNav["Navigation & Links (All URLs)"]
    end

    subgraph PrivacyGuard["Privacy Guard Interception Core"]
        WorkerProxy["Worker & MessagePort Proxy"]
        DGWParser["DGW Zero-Copy Binary Frame Evaluator"]
        HttpRules["GraphQL HTTP Suppression Engine"]
        PresenceTransform["StreamController Presence Normalizer"]
        BeaconFilter["Beacon & Telemetry Scrambler"]
        DNRRules["DeclarativeNetRequest Engine"]
    end

    subgraph MetaEdge["Meta Infrastructure & 3rd Party"]
        DGWServer["Meta DGW Edge (/ws/*)"]
        GraphQLServer["Meta GraphQL (/api/graphql/)"]
        TelemetryServer["Banzai & Merlin Telemetry (/ajax/bz)"]
        PixelTrackers["External Meta Pixels & Trackers"]
    end

    DOM -->|User actions| WS & HTTP & Worker
    Worker -->|MAWBridgeFireAndForget| WorkerProxy
    WS -->|Binary frame dispatch| DGWParser
    HTTP -->|Relay GraphQL requests| HttpRules
    WebNav -->|Network requests| DNRRules

    WorkerProxy -->|Suppress seen / typing| DOM
    DGWParser -->|Drop labels 21, 72, 235, 3| DGWServer
    HttpRules -->|Synthetic 200 Relay OK| DOM
    HttpRules -.->|Drop seen / search mutations| GraphQLServer
    PresenceTransform -->|Spoof offline state| DGWServer
    BeaconFilter -.->|Suppress dwell time & VPV| TelemetryServer
    DNRRules -->|Block fbevents.js & strip fbclid| PixelTrackers
```

For more details on protocol signatures and mappings, see [Protocol Mapping Guide](PROTOCOL_MAPPING_GUIDE.md).
