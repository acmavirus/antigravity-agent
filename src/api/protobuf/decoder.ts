// Copyright by AcmaTvirus
import * as protobuf from 'protobufjs';

/**
 * Lớp giải mã Protobuf dự trên định nghĩa từ antigravity.proto (trích xuất logic từ old/app/core/auth_handler.py)
 */
export class ProtobufDecoder {
    private static root: protobuf.Root | null = null;

    private static getRoot(): protobuf.Root {
        if (!this.root) {
            this.root = protobuf.Root.fromJSON({
                nested: {
                    TokenInfo: {
                        fields: {
                            key: { id: 1, type: "string" },
                            payload: { id: 2, type: "bytes" }
                        }
                    },
                    google: {
                        nested: {
                            internal: {
                                nested: {
                                    antigravity: {
                                        nested: {
                                            SessionResponse: {
                                                fields: {
                                                    auth: { id: 6, type: "AuthInfo" },
                                                    context: { id: 19, type: "UserContext" }
                                                }
                                            },
                                            AuthInfo: {
                                                fields: {
                                                    access_token: { id: 1, type: "string" },
                                                    id_token: { id: 3, type: "string" }
                                                }
                                            },
                                            UserContext: {
                                                fields: {
                                                    plan_name: { id: 3, type: "string" },
                                                    email: { id: 7, type: "string" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
        return this.root;
    }

    public static decode(input: string | Buffer): any {
        try {
            let buffer = typeof input === 'string' ? Buffer.from(input.trim(), 'base64') : input;

            // Xử lý header 0x01 thường gặp trong SQLite blobs của VS Code (đánh dấu version/format)
            if (buffer.length > 0 && buffer[0] === 0x01) {
                buffer = buffer.subarray(1);
            }

            const SessionResponse = this.getRoot().lookupType("google.internal.antigravity.SessionResponse");
            try {
                const message = SessionResponse.decode(buffer);
                const obj = SessionResponse.toObject(message, {
                    defaults: true,
                    enums: String,
                    longs: String,
                    bytes: String,
                });
                if (obj.context?.email) return obj;
            } catch (e) {
                // Ignore, try other format
            }

            // Try decoding as TokenInfo wrapper
            const TokenInfo = this.getRoot().lookupType("TokenInfo");
            try {
                const tokenMsg = TokenInfo.decode(buffer);
                const tokenObj = TokenInfo.toObject(tokenMsg);

                if (tokenObj.payload && tokenObj.payload.length > 0) {
                    const payloadBuffer = tokenObj.payload; // Already Buffer/Uint8Array
                    const innerMsg = SessionResponse.decode(payloadBuffer);
                    return SessionResponse.toObject(innerMsg, {
                        defaults: true,
                        enums: String,
                        longs: String,
                        bytes: String,
                    });
                }
            } catch (e) {
                // Ignore
            }

            return null;
        } catch (e: any) {
            console.error('[ProtobufDecoder] Decoding error:', e.message);
            if (input instanceof Buffer) {
                console.error('[ProtobufDecoder] Hex Dump (first 16 bytes):', input.subarray(0, 16).toString('hex'));
            }
            return null;
        }
    }
}
