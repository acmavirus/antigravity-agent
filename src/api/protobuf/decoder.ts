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
            
            // Hàm helper để giải mã từ buffer tiềm năng là session data
            const tryDecodeSession = (buf: Buffer): any => {
                    // 1. Thử giải mã Protobuf chuẩn
                    try {
                        const message = SessionResponse.decode(buf);
                        const obj = SessionResponse.toObject(message, {
                            defaults: true,
                            enums: String,
                            longs: String,
                            bytes: String,
                        });
                        
                        // Cố gắng tìm email thực từ context
                        let foundEmail = obj.context?.email;
                        if (!foundEmail || foundEmail === "auto-imported-account@gmail.com") {
                            // Thử tìm trong các trường khác của obj nếu có (ví dụ: user.email)
                            if (obj.user?.email) foundEmail = obj.user.email;
                            else if (obj.auth?.user_email) foundEmail = obj.auth.user_email;
                        }

                        if (obj.auth?.access_token && obj.auth.access_token.length > 50) {
                            obj.context = obj.context || {};
                            obj.context.email = foundEmail || "auto-imported-account@gmail.com";
                            return obj;
                        }
                    } catch (e) {}

                // 2. Thử giải mã nếu là raw string (ví dụ: ya29.a0AUM...)
                const str = buf.toString('utf8');
                if (str.startsWith('ya29.')) {
                    return {
                        auth: { access_token: str, id_token: "" },
                        context: { email: "auto-imported-account@gmail.com" }
                    };
                }
                return null;
            };

            // Thử giải mã trực tiếp
            const direct = tryDecodeSession(buffer);
            if (direct) return direct;

            // Thử giải mã qua TokenInfo wrapper
            const TokenInfo = this.getRoot().lookupType("TokenInfo");
            try {
                // Đôi khi buffer bị bọc thêm một lớp Protobuf nữa (field 1: bytes)
                const reader = protobuf.Reader.create(buffer);
                let wrappedBuffer: Buffer | null = null;
                while (reader.pos < reader.len) {
                    const tag = reader.uint32();
                    if ((tag >>> 3) === 1 && (tag & 7) === 2) {
                        wrappedBuffer = Buffer.from(reader.bytes());
                        break;
                    } else {
                        reader.skipType(tag & 7);
                    }
                }

                const tokenBuf = wrappedBuffer || buffer;
                const tokenMsg = TokenInfo.decode(tokenBuf);
                const tokenObj: any = TokenInfo.toObject(tokenMsg);

                if (tokenObj.payload) {
                    const payloadBytes = Buffer.from(tokenObj.payload);
                    
                    // Payload có thể là Protobuf chứa string sessionBase64 ở field 1
                    let sessionBase64 = "";
                    try {
                        const payloadReader = protobuf.Reader.create(payloadBytes);
                        while (payloadReader.pos < payloadReader.len) {
                            const tag = payloadReader.uint32();
                            if ((tag >>> 3) === 1 && (tag & 7) === 2) {
                                sessionBase64 = payloadReader.string();
                                break;
                            } else {
                                payloadReader.skipType(tag & 7);
                            }
                        }
                    } catch (e) {
                        sessionBase64 = payloadBytes.toString('utf8');
                    }

                    if (sessionBase64) {
                        // Làm sạch base64 string
                        sessionBase64 = sessionBase64.replace(/[^A-Za-z0-9+/=]/g, '');
                        let sessionBuffer = Buffer.from(sessionBase64, 'base64');
                        
                        // Đôi khi sessionBuffer lại bị bọc thêm 1 lớp field 1: bytes
                        try {
                            const r = protobuf.Reader.create(sessionBuffer);
                            if (r.pos < r.len) {
                                const tag = r.uint32();
                                if ((tag >>> 3) === 1 && (tag & 7) === 2) {
                                    sessionBuffer = Buffer.from(r.bytes());
                                }
                            }
                        } catch (e) {}

                        const result = tryDecodeSession(sessionBuffer);
                        if (result) return result;
                    }
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
