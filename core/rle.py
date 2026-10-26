"""
Westwood Format 3 (RLE) Decompressor.
Used across Westwood games (Kyrandia series, Eye of the Beholder, Lands of Lore, Dune II)
for RLE-compressed screens (.CPS) and graphics.
"""

import struct


def westwood_rle_decode(source: bytes, dest_length: int) -> bytes:
    """
    Decompresses Westwood Format 3 RLE byte data into an uncompressed buffer.
    In Westwood's RLE format:
    - If code == 0x00: extended repeat sequence. Next 2 bytes are count (16-bit big-endian integer),
      followed by 1 byte value to repeat.
    - If code >= 0x80: repeat run. Count = 0x100 - code. Next byte is the value to repeat.
    - If 0 < code < 0x80: literal copy. Count = code. Next 'count' bytes are copied directly.
    """
    dest = bytearray()
    sp = 0
    src_len = len(source)

    while sp < src_len and len(dest) < dest_length:
        code = source[sp]
        sp += 1

        if code == 0x00:
            if sp + 3 > src_len:
                break
            count = struct.unpack('>H', source[sp : sp + 2])[0]
            val = source[sp + 2]
            sp += 3
            if count > dest_length - len(dest):
                count = dest_length - len(dest)
            dest.extend([val] * count)
        elif code >= 0x80:
            count = 0x100 - code
            if sp >= src_len:
                break
            val = source[sp]
            sp += 1
            if count > dest_length - len(dest):
                count = dest_length - len(dest)
            dest.extend([val] * count)
        else:
            count = code
            if sp + count > src_len:
                count = src_len - sp
            if count > dest_length - len(dest):
                count = dest_length - len(dest)
            dest.extend(source[sp : sp + count])
            sp += count

    if len(dest) < dest_length:
        dest.extend(bytes(dest_length - len(dest)))

    return bytes(dest)
