'use strict';

let writeUnsignedExpGolomb = (v, s) => {
  if (s === undefined) {
    s = '';
  }

  let num = (v + 1).toString(2);
  let b = num.length - 1;

  for (let i = 0; i < b; i++) {
    s += '0';
  }

  return s + num;
};

let writeExpGolomb = (v, s) => {
  if (v <= 0) {
    v = -v * 2;
  } else {
    v = v * 2 - 1
  }

  return writeUnsignedExpGolomb(v, s);
};

let writeBits = (n, v, s) => {
  if (s === undefined) {
    s = '';
  }

  let num = (v & ((1 << n)-1)).toString(2);
  let b = n - num.length;

  for (let i = 0; i < b; i++) {
    s += '0';
  }

  return s + num;
};

let writeUnsignedByte = (v, s) => {
  return writeBits(8, v, s);
};

module.exports = {
  writeUnsignedExpGolomb: writeUnsignedExpGolomb,
  writeExpGolomb: writeExpGolomb,
  writeBits: writeBits,
  writeUnsignedByte: writeUnsignedByte
};
