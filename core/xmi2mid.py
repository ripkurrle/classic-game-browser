"""
Miles Sound System XMIDI to Standard MIDI (.mid) Converter.
Converts Westwood Studios .XMI music tracks into Standard MIDI File (SMF Format 0/1).
"""

import struct
from typing import List, Tuple, Dict, Any, Optional

def put_vlq(value: int) -> bytes:
    """Encodes an integer into a standard MIDI Variable-Length Quantity (VLQ)."""
    buf = bytearray([value & 0x7F])
    value >>= 7
    while value > 0:
        buf.insert(0, (value & 0x7F) | 0x80)
        value >>= 7
    return bytes(buf)


def parse_vlq(data: bytes, pos: int) -> Tuple[int, int]:
    """Reads a standard MIDI VLQ from data at pos. Returns (value, new_pos)."""
    val = 0
    l = len(data)
    while pos < l:
        b = data[pos]
        pos += 1
        val = (val << 7) | (b & 0x7F)
        if not (b & 0x80):
            break
    return val, pos


def parse_xmi_delta(data: bytes, pos: int) -> Tuple[int, int]:
    """
    Reads an XMIDI delta time.
    In XMIDI, delta bytes have bit 7 == 0 and are accumulated until a byte with bit 7 == 1 is encountered.
    """
    delta = 0
    l = len(data)
    while pos < l:
        b = data[pos]
        if b & 0x80:
            break
        delta += b
        pos += 1
    return delta, pos


def convert_evnt_to_midi(evnt_data: bytes, ppqn: int = 60, title: str = "") -> bytes:
    """
    Converts an XMIDI EVNT chunk payload into a standard MIDI file (SMF Format 0).
    """
    pos = 0
    l = len(evnt_data)
    current_time = 0
    events: List[Tuple[int, int, bytes]] = []
    order = 0

    if title:
        # Insert track name meta event at time 0
        name_bytes = title.encode('latin1', errors='replace')
        events.append((0, order, bytes([0xFF, 0x03]) + put_vlq(len(name_bytes)) + name_bytes))
        order += 1

    tempo_set = False

    while pos < l:
        delta, pos = parse_xmi_delta(evnt_data, pos)
        current_time += delta  # Exact XMIDI ticks at PPQN=60 (120 Hz)

        if pos >= l:
            break

        status = evnt_data[pos]
        pos += 1
        cmd = status >> 4

        if cmd == 0x9:  # Note On with XMIDI duration
            if pos + 2 > l:
                break
            note = evnt_data[pos]
            vel = evnt_data[pos + 1]
            pos += 2

            dur, pos = parse_vlq(evnt_data, pos)

            # Note On event
            events.append((current_time, order, bytes([status, note, vel])))
            order += 1

            # Corresponding Note Off event scheduled at current_time + dur
            off_status = 0x80 | (status & 0x0F)
            events.append((current_time + dur, order, bytes([off_status, note, 0])))
            order += 1

        elif cmd in (0x8, 0xA, 0xB, 0xE):  # 2 data bytes (Note Off, Poly Aftertouch, Control Change, Pitch Bend)
            if pos + 2 > l:
                break
            d1 = evnt_data[pos]
            d2 = evnt_data[pos + 1]
            pos += 2
            # Handle XMIDI bank change controller 114 -> 32 if needed
            if cmd == 0xB and d1 == 114:
                d1 = 32
            events.append((current_time, order, bytes([status, d1, d2])))
            order += 1

        elif cmd in (0xC, 0xD):  # 1 data byte (Program Change, Channel Pressure)
            if pos >= l:
                break
            d1 = evnt_data[pos]
            pos += 1
            events.append((current_time, order, bytes([status, d1])))
            order += 1

        elif status == 0xFF:  # Meta Event
            if pos >= l:
                break
            meta_type = evnt_data[pos]
            pos += 1
            meta_len, pos = parse_vlq(evnt_data, pos)
            meta_payload = evnt_data[pos : pos + meta_len]
            pos += meta_len

            if meta_type == 0x51 and len(meta_payload) == 3:  # Set Tempo
                tempo_set = True

            events.append((current_time, order, bytes([0xFF, meta_type]) + put_vlq(len(meta_payload)) + meta_payload))
            order += 1

            if meta_type == 0x2F:  # End of Track
                break

        elif status in (0xF0, 0xF7):  # System Exclusive
            sysex_len, pos = parse_vlq(evnt_data, pos)
            sysex_payload = evnt_data[pos : pos + sysex_len]
            pos += sysex_len
            events.append((current_time, order, bytes([status]) + put_vlq(sysex_len) + sysex_payload))
            order += 1

    if not tempo_set:
        # Default 120 BPM (500,000 us/qn)
        events.append((0, 0, bytes([0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20])))

    # Sort events by tick time, preserving original order for simultaneous events
    events.sort(key=lambda ev: (ev[0], ev[1]))

    # Construct MTrk track payload
    track_payload = bytearray()
    last_tick = 0
    has_eot = False

    for ev_time, _, ev_data in events:
        d_tick = max(0, ev_time - last_tick)
        last_tick = ev_time
        track_payload.extend(put_vlq(d_tick))
        track_payload.extend(ev_data)
        if ev_data.startswith(b'\xFF\x2F'):
            has_eot = True
            break

    if not has_eot:
        track_payload.extend(b'\x00\xFF\x2F\x00')

    # Construct SMF Format 0 file
    # MThd: Format 0, 1 track, ppqn
    mthd = b'MThd\x00\x00\x00\x06' + struct.pack('>HHH', 0, 1, ppqn)
    mtrk = b'MTrk' + struct.pack('>I', len(track_payload)) + bytes(track_payload)
    return mthd + mtrk


def parse_xmi_file(xmi_bytes: bytes) -> List[Tuple[str, bytes]]:
    """
    Parses an XMIDI container and returns a list of (sequence_name, midi_bytes).
    Most XMIDI files contain 1-3 sequences (e.g. main loop, intro, variation).
    """
    sequences: List[Tuple[str, bytes]] = []

    # Search for all EVNT chunks in the file
    p = 0
    l = len(xmi_bytes)
    evnt_indices = []
    while p + 8 <= l:
        if xmi_bytes[p : p + 4] == b'EVNT':
            sz = struct.unpack('>I', xmi_bytes[p + 4 : p + 8])[0]
            if p + 8 + sz <= l and sz > 0:
                evnt_indices.append((p + 8, sz))
                p += 8 + sz
                if sz % 2 == 1:
                    p += 1
                continue
        p += 1

    if not evnt_indices:
        return sequences

    # If multiple EVNT chunks, find the largest or return all
    # Typically, small EVNT chunks are empty placeholders (size 28), while actual songs are > 100 bytes
    song_chunks = [(off, sz) for off, sz in evnt_indices if sz > 50]
    if not song_chunks:
        song_chunks = evnt_indices

    for idx, (off, sz) in enumerate(song_chunks):
        chunk_data = xmi_bytes[off : off + sz]
        seq_title = f"Track {idx + 1}"
        mid_data = convert_evnt_to_midi(chunk_data, ppqn=60, title=seq_title)
        sequences.append((seq_title, mid_data))

    return sequences


def xmi_to_midi(xmi_bytes: bytes) -> bytes:
    """Converts the primary music track from an XMIDI file into Standard MIDI (.mid)."""
    seqs = parse_xmi_file(xmi_bytes)
    if not seqs:
        # Return empty minimal midi file
        return b'MThd\x00\x00\x00\x06\x00\x00\x00\x01\x00\x3cMTrk\x00\x00\x00\x04\x00\xff\x2f\x00'

    # Pick the largest track (which is the full song)
    seqs.sort(key=lambda s: len(s[1]), reverse=True)
    return seqs[0][1]


def get_midi_metadata(mid_bytes: bytes) -> Dict[str, Any]:
    """Extracts summary statistics from a standard MIDI file for the UI."""
    notes_count = 0
    duration_ticks = 0
    channels = set()
    programs = set()

    if len(mid_bytes) < 14 or not mid_bytes.startswith(b'MThd'):
        return {'valid': False}

    _, _, _, tracks, ppqn = struct.unpack('>4sIHHH', mid_bytes[:14])
    pos = 14
    l = len(mid_bytes)

    while pos + 8 <= l:
        cid = mid_bytes[pos : pos + 4]
        sz = struct.unpack('>I', mid_bytes[pos + 4 : pos + 8])[0]
        pos += 8
        if cid == b'MTrk':
            tp = pos
            tend = min(l, pos + sz)
            tick = 0
            while tp < tend:
                delta, tp = parse_vlq(mid_bytes, tp)
                tick += delta
                if tp >= tend:
                    break
                st = mid_bytes[tp]
                tp += 1
                cmd = st >> 4
                ch = st & 0x0F
                if cmd == 0x9:
                    note = mid_bytes[tp]
                    vel = mid_bytes[tp + 1]
                    tp += 2
                    if vel > 0:
                        notes_count += 1
                        channels.add(ch)
                elif cmd in (0x8, 0xA, 0xB, 0xE):
                    tp += 2
                elif cmd in (0xC, 0xD):
                    if cmd == 0xC:
                        programs.add(mid_bytes[tp])
                    tp += 1
                elif st == 0xFF:
                    mtype = mid_bytes[tp]
                    tp += 1
                    mlen, tp = parse_vlq(mid_bytes, tp)
                    if mtype == 0x51 and mlen == 3 and tp + 3 <= tend:
                        us_per_q = (mid_bytes[tp] << 16) | (mid_bytes[tp + 1] << 8) | mid_bytes[tp + 2]
                        if us_per_q > 0:
                            tempo_bpm = round(60000000.0 / us_per_q)
                    tp += mlen
                elif st in (0xF0, 0xF7):
                    slen, tp = parse_vlq(mid_bytes, tp)
                    tp += slen
            duration_ticks = max(duration_ticks, tick)
        pos += sz

    tempo_bpm = locals().get('tempo_bpm', 120)
    duration_seconds = (duration_ticks / max(ppqn, 1)) * (60.0 / tempo_bpm)

    return {
        'valid': True,
        'size_bytes': len(mid_bytes),
        'notes_count': notes_count,
        'channels_used': sorted(list(channels)),
        'instruments_used': sorted(list(programs)),
        'ppqn': ppqn,
        'tempo_bpm': tempo_bpm,
        'duration_ticks': duration_ticks,
        'estimated_seconds': round(duration_seconds, 1),
    }
