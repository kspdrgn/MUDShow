use serde_json::json;

use crate::mud_backend::{ConnectionEvent, ParseStatus, ProtocolFamily, TrafficDirection};

const IAC: u8 = 0xff;
const SE: u8 = 0xf0;
const SB: u8 = 0xfa;
const WILL: u8 = 0xfb;
const WONT: u8 = 0xfc;
const DO: u8 = 0xfd;
const DONT: u8 = 0xfe;
const MAX_PENDING_BYTES: usize = 64 * 1024;

pub enum DecodedEvent {
    Text(Vec<u8>),
    Structured(ConnectionEvent),
    Reply(Vec<u8>),
}

#[derive(Default)]
pub struct TelnetDecoder {
    pending: Vec<u8>,
}

impl TelnetDecoder {
    pub fn feed(&mut self, bytes: &[u8]) -> Vec<DecodedEvent> {
        self.pending.extend_from_slice(bytes);
        if self.pending.len() > MAX_PENDING_BYTES {
            let keep_from = self.pending.len() - MAX_PENDING_BYTES;
            self.pending.drain(..keep_from);
            return vec![DecodedEvent::Structured(ConnectionEvent::Structured {
                protocol: ProtocolFamily::Telnet,
                event_type: "buffer-limit".to_string(),
                direction: TrafficDirection::Incoming,
                payload: json!({ "droppedBytes": keep_from }),
                parse_status: ParseStatus::Malformed,
                error: Some("Telnet decoder buffer limit exceeded".to_string()),
            })];
        }

        let mut events = Vec::new();
        let mut text = Vec::new();
        let mut index = 0;
        while index < self.pending.len() {
            if self.pending[index] != IAC {
                text.push(self.pending[index]);
                index += 1;
                continue;
            }
            if index + 1 >= self.pending.len() {
                break;
            }
            if !text.is_empty() {
                events.push(DecodedEvent::Text(std::mem::take(&mut text)));
            }

            let command = self.pending[index + 1];
            if command == IAC {
                text.push(IAC);
                index += 2;
                continue;
            }
            if matches!(command, WILL | WONT | DO | DONT) {
                if index + 2 >= self.pending.len() {
                    break;
                }
                let option = self.pending[index + 2];
                events.push(DecodedEvent::Structured(telnet_event(command, option)));
                events.push(DecodedEvent::Reply(vec![IAC, reply_for(command), option]));
                index += 3;
                continue;
            }
            if command == SB {
                let Some(end) = find_subnegotiation_end(&self.pending[index + 2..]) else {
                    break;
                };
                let payload_end = index + 2 + end;
                let option = self.pending.get(index + 2).copied().unwrap_or_default();
                let payload = self.pending[index + 3..payload_end].to_vec();
                events.push(DecodedEvent::Structured(ConnectionEvent::Structured {
                    protocol: ProtocolFamily::Telnet,
                    event_type: "subnegotiation".to_string(),
                    direction: TrafficDirection::Incoming,
                    payload: json!({ "option": option, "bytes": payload }),
                    parse_status: ParseStatus::Parsed,
                    error: None,
                }));
                index = payload_end + 2;
                continue;
            }
            events.push(DecodedEvent::Structured(ConnectionEvent::Structured {
                protocol: ProtocolFamily::Telnet,
                event_type: "command".to_string(),
                direction: TrafficDirection::Incoming,
                payload: json!({ "command": command }),
                parse_status: ParseStatus::Parsed,
                error: None,
            }));
            index += 2;
        }
        if !text.is_empty() {
            events.push(DecodedEvent::Text(text));
        }
        self.pending.drain(..index);
        events
    }

    pub fn flush(&mut self) -> Option<DecodedEvent> {
        if self.pending.is_empty() {
            return None;
        }
        let dropped = self.pending.len();
        self.pending.clear();
        Some(DecodedEvent::Structured(ConnectionEvent::Structured {
            protocol: ProtocolFamily::Telnet,
            event_type: "incomplete-frame".to_string(),
            direction: TrafficDirection::Incoming,
            payload: json!({ "droppedBytes": dropped }),
            parse_status: ParseStatus::Malformed,
            error: Some("Incomplete Telnet frame at end of stream".to_string()),
        }))
    }
}

fn find_subnegotiation_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(2).position(|window| window == [IAC, SE])
}

fn reply_for(command: u8) -> u8 {
    match command {
        WILL | WONT => DONT,
        DO | DONT => WONT,
        _ => DONT,
    }
}

fn telnet_event(command: u8, option: u8) -> ConnectionEvent {
    ConnectionEvent::Structured {
        protocol: ProtocolFamily::Telnet,
        event_type: "negotiation".to_string(),
        direction: TrafficDirection::Incoming,
        payload: json!({ "command": command, "option": option }),
        parse_status: ParseStatus::Parsed,
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_text_and_telnet_negotiation_order() {
        let mut decoder = TelnetDecoder::default();
        let events = decoder.feed(b"hi\xff\xfb\x01there");
        assert!(matches!(events[0], DecodedEvent::Text(ref text) if text == b"hi"));
        assert!(matches!(events[1], DecodedEvent::Structured(ConnectionEvent::Structured { .. })));
        assert!(matches!(events[2], DecodedEvent::Reply(ref bytes) if bytes == &[IAC, DONT, 1]));
        assert!(matches!(events[3], DecodedEvent::Text(ref text) if text == b"there"));
    }

    #[test]
    fn retains_split_commands_and_subnegotiations() {
        let mut decoder = TelnetDecoder::default();
        assert!(decoder.feed(&[IAC]).is_empty());
        assert!(decoder.feed(&[SB, 201, b'G', b'M']).is_empty());
        let events = decoder.feed(&[b'C', IAC, SE]);
        assert!(events.iter().any(|event| matches!(event, DecodedEvent::Structured(ConnectionEvent::Structured { protocol: ProtocolFamily::Telnet, .. }))));
    }

    #[test]
    fn flush_classifies_incomplete_input() {
        let mut decoder = TelnetDecoder::default();
        decoder.feed(&[IAC, SB, 201]);
        assert!(matches!(decoder.flush(), Some(DecodedEvent::Structured(ConnectionEvent::Structured { parse_status: ParseStatus::Malformed, .. }))));
    }
}
