"""
Creative Voice (.VOC) to standard RIFF/WAVE (.wav) Converter.
"""

import io
import wave
import struct
from typing import Optional

def voc_to_wav(voc_data: bytes) -> bytes:
    """
    Parses a Creative Voice File (.VOC) and converts it to standard 8-bit PCM WAV.
    """
    if len(voc_data) < 26 or not voc_data.startswith(b'Creative Voice File\x1a'):
        return b""

    header_len = struct.unpack('<H', voc_data[20:22])[0]
    pos = header_len
    l = len(voc_data)

    pcm_data = bytearray()
    sample_rate = 11025  # default

    while pos < l:
        block_type = voc_data[pos]
        pos += 1
        if block_type == 0:
            break

        if pos + 3 > l:
            break
        block_len = voc_data[pos] | (voc_data[pos + 1] << 8) | (voc_data[pos + 2] << 16)
        pos += 3

        block_payload = voc_data[pos : pos + block_len]
        pos += block_len

        if block_type == 1:  # Sound data
            if len(block_payload) >= 2:
                sr_div = block_payload[0]
                codec = block_payload[1]
                if sr_div < 256:
                    sample_rate = 1000000 // (256 - sr_div)
                pcm_data.extend(block_payload[2:])
        elif block_type == 2:  # Sound continue
            pcm_data.extend(block_payload)

    if not pcm_data:
        return b""

    # Write WAV file
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav_file:
        wav_file.setnchannels(1)       # Mono
        wav_file.setsampwidth(1)      # 8-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(bytes(pcm_data))

    return buf.getvalue()
