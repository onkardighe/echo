export type WebviewToExtensionMessage =
    | { type: "START_CALL" }
    | { type: "JOIN_CALL"; sdp: string }
    | { type: "ANSWER_CALL"; sdp: string }
    | { type: "END_CALL" }
    | { type: "COPY_TO_CLIPBOARD"; text: string }
    | { type: "ERROR"; message: string };
