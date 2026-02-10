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

    public static decode(base64Data: string): any {
        try {
            const buffer = Buffer.from(base64Data.trim(), 'base64');
            const SessionResponse = this.getRoot().lookupType("google.internal.antigravity.SessionResponse");
            const message = SessionResponse.decode(buffer);
            return SessionResponse.toObject(message, {
                defaults: true,
                enums: String,
                longs: String,
                bytes: String,
            });
        } catch (e) {
            console.error('Protobuf decoding error:', e);
            return null;
        }
    }
}
