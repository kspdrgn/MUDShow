export function stripTelnet(buf: Buffer): Buffer {
  const out: number[] = [];
  let i = 0;

  while (i < buf.length) {
    if (buf[i] === 0xff) {
      if (i + 1 >= buf.length) {
        break;
      }

      const cmd = buf[i + 1];

      if (cmd >= 0xfb && cmd <= 0xfe) {
        i += 3;
      } else if (cmd === 0xf0) {
        i += 2;
      } else if (cmd === 0xfa) {
        i += 2;

        while (i + 1 < buf.length && !(buf[i] === 0xff && buf[i + 1] === 0xf0)) {
          i++;
        }

        if (i + 1 < buf.length) {
          i += 2;
        }
      } else {
        i += 2;
      }
    } else {
      out.push(buf[i]);
      i++;
    }
  }

  return Buffer.from(out);
}
