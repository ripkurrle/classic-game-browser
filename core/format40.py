"""
Westwood Format 40 XOR-Delta Decompressor.
Used for frame-to-frame delta decompression in .WSA animations.
"""

def decode_frame_delta(dst: bytearray, src: bytes, no_xor: bool = False):
    """
    Applies Format 40 delta data to an existing frame buffer.
    If no_xor is True, values are copied directly rather than XOR-ed.
    """
    sp = 0
    dp = 0
    src_len = len(src)
    dst_len = len(dst)

    while sp < src_len:
        cmd = src[sp]
        sp += 1

        if cmd == 0:
            if sp + 2 > src_len:
                break
            cnt = src[sp]
            sp += 1
            val = src[sp]
            sp += 1
            for _ in range(cnt):
                if dp < dst_len:
                    if no_xor:
                        dst[dp] = val
                    else:
                        dst[dp] ^= val
                    dp += 1
        elif (cmd & 0x80) == 0:
            cnt = cmd
            for _ in range(cnt):
                if dp < dst_len and sp < src_len:
                    if no_xor:
                        dst[dp] = src[sp]
                    else:
                        dst[dp] ^= src[sp]
                    dp += 1
                    sp += 1
        elif cmd != 0x80:
            dp += (cmd & 0x7F)
        else:
            if sp + 2 > src_len:
                break
            cmd16 = src[sp] | (src[sp + 1] << 8)
            sp += 2
            if cmd16 == 0:
                # 0x80 0x00 0x00 => exit code
                break

            if (cmd16 & 0x8000) == 0:
                dp += cmd16
            elif (cmd16 & 0x4000) == 0:
                cnt = cmd16 & 0x3FFF
                for _ in range(cnt):
                    if dp < dst_len and sp < src_len:
                        if no_xor:
                            dst[dp] = src[sp]
                        else:
                            dst[dp] ^= src[sp]
                        dp += 1
                        sp += 1
            else:
                cnt = cmd16 & 0x3FFF
                if sp >= src_len:
                    break
                val = src[sp]
                sp += 1
                for _ in range(cnt):
                    if dp < dst_len:
                        if no_xor:
                            dst[dp] = val
                        else:
                            dst[dp] ^= val
                        dp += 1
