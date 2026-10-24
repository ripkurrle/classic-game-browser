"""
Westwood Format 80 (LCW) Decompressor.
Used across Westwood games (Kyrandia series, Dune II, Lands of Lore, C&C)
for compressed screens (.CPS), palettes (.COL), and shapes/sprites (.SHP).
"""

def format80_decode(source: bytes, dest_length: int) -> bytes:
    """
    Decompresses Westwood Format 80 byte data into an uncompressed buffer.
    """
    dest = bytearray(dest_length)
    sp = 0
    dp = 0
    src_len = len(source)

    while dp < dest_length and sp < src_len:
        cmd = source[sp]
        sp += 1

        if cmd == 0x80:
            # End of stream marker
            break
        elif (cmd & 0x80) == 0:
            # Short move, relative
            size = (cmd >> 4) + 3
            if size > dest_length - dp:
                size = dest_length - dp
            if sp >= src_len:
                break
            offset = ((cmd & 0x0F) << 8) | source[sp]
            sp += 1
            for _ in range(size):
                if dp >= offset:
                    dest[dp] = dest[dp - offset]
                dp += 1
        elif cmd == 0xFE:
            # Long set (fill)
            if sp + 2 > src_len:
                break
            size = source[sp] | (source[sp + 1] << 8)
            sp += 2
            if size > dest_length - dp:
                size = dest_length - dp
            if sp >= src_len:
                break
            val = source[sp]
            sp += 1
            dest[dp : dp + size] = bytes([val]) * size
            dp += size
        elif cmd == 0xFF:
            # Long move, absolute
            if sp + 4 > src_len:
                break
            size = source[sp] | (source[sp + 1] << 8)
            sp += 2
            if size > dest_length - dp:
                size = dest_length - dp
            offset = source[sp] | (source[sp + 1] << 8)
            sp += 2
            for _ in range(size):
                if offset < dest_length:
                    dest[dp] = dest[offset]
                dp += 1
                offset += 1
        elif (cmd & 0x40) != 0:
            # Short move, absolute
            size = (cmd & 0x3F) + 3
            if size > dest_length - dp:
                size = dest_length - dp
            if sp + 2 > src_len:
                break
            offset = source[sp] | (source[sp + 1] << 8)
            sp += 2
            for _ in range(size):
                if offset < dest_length:
                    dest[dp] = dest[offset]
                dp += 1
                offset += 1
        else:
            # Short copy (literal)
            size = cmd & 0x3F
            if size > dest_length - dp:
                size = dest_length - dp
            if sp + size > src_len:
                size = src_len - sp
            dest[dp : dp + size] = source[sp : sp + size]
            dp += size
            sp += size

    return bytes(dest[:dp])
