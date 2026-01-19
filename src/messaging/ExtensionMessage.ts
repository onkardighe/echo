export type ExtensionToWebviewMessage =
    | { type: "LOCAL_SDP"; sdp: string }
    | { type: "CALL_STATUS"; status: "idle" | "connecting" | "connected" | "ended" }
    | { type: "ERROR"; message: string };
